'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createVoiceSessionManager } = require('../voice-session');

function createHarness({ savedState = null, failGuildIds = [] } = {}) {
  const files = new Map();
  if (savedState) files.set('/runtime/voice-session.json', JSON.stringify(savedState));

  const fs = {
    existsSync: path => files.has(path),
    readFileSync: path => files.get(path),
    writeFileSync: (path, value) => files.set(path, value),
    unlinkSync: path => files.delete(path),
  };

  const connections = [];
  const guilds = new Map();
  const channels = new Map();

  function addGuild(guildId, channelIds = []) {
    const guild = {
      id: guildId,
      voiceAdapterCreator: () => ({}),
      channels: {
        fetch: async channelId => channels.get(guildId + ':' + channelId) || null,
      },
    };

    guilds.set(guildId, guild);
    for (const channelId of channelIds) {
      const channel = {
        id: channelId,
        type: 2,
        guild,
        isVoiceBased: () => true,
      };
      channels.set(guildId + ':' + channelId, channel);
    }
    return guild;
  }

  const voice = {
    VoiceConnectionStatus: { Ready: 'ready' },
    joinVoiceChannel: options => {
      const connection = new EventEmitter();
      connection.options = options;
      connection.state = { status: 'ready' };
      connection.destroyed = false;
      connection.destroy = () => {
        connection.destroyed = true;
        connection.state = { status: 'destroyed' };
      };
      connections.push(connection);
      return connection;
    },
    entersState: async () => undefined,
  };

  const client = {
    guilds: {
      fetch: async guildId => {
        if (failGuildIds.includes(guildId)) throw new Error('unavailable');
        return guilds.get(guildId) || null;
      },
    },
  };

  const manager = createVoiceSessionManager({
    client,
    voice,
    fs,
    filePath: '/runtime/voice-session.json',
    log: () => {},
  });

  function makeChannel(guildId, channelId) {
    const guild = guilds.get(guildId) || addGuild(guildId);
    const channel = {
      id: channelId,
      type: 2,
      guild,
      isVoiceBased: () => true,
    };
    channels.set(guildId + ':' + channelId, channel);
    return channel;
  }

  return { manager, files, connections, voice, guilds, addGuild, makeChannel };
}

test('joining saves a versioned session and remains self-muted and self-deafened', async () => {
  const { manager, files, connections, makeChannel } = createHarness();
  const channel = makeChannel('guild-123', 'channel-456');
  const result = await manager.join(channel);

  assert.equal(result.alreadyConnected, false);
  assert.deepEqual(JSON.parse(files.get('/runtime/voice-session.json')), {
    version: 2,
    sessions: {
      'guild-123': { guildId: 'guild-123', channelId: 'channel-456' },
    },
  });
  assert.equal(connections[0].options.selfMute, true);
  assert.equal(connections[0].options.selfDeaf, true);
  assert.equal(manager.getStatus('guild-123').active, true);
});

test('joining the same ready channel does not create a duplicate connection', async () => {
  const { manager, connections, makeChannel } = createHarness();
  const channel = makeChannel('guild-123', 'channel-456');
  await manager.join(channel);
  const result = await manager.join(channel);

  assert.equal(result.alreadyConnected, true);
  assert.equal(connections.length, 1);
});

test('different guilds keep simultaneous independent voice connections', async () => {
  const { manager, files, connections, makeChannel } = createHarness();
  const cottageChannel = makeChannel('guild-cottage', 'voice-cottage');
  const secondServerChannel = makeChannel('guild-second', 'voice-second');

  await Promise.all([
    manager.join(cottageChannel),
    manager.join(secondServerChannel),
  ]);

  assert.equal(connections.length, 2);
  assert.equal(connections.every(connection => !connection.destroyed), true);
  assert.equal(manager.getStatus('guild-cottage').channelId, 'voice-cottage');
  assert.equal(manager.getStatus('guild-second').channelId, 'voice-second');
  assert.equal(Object.keys(JSON.parse(files.get('/runtime/voice-session.json')).sessions).length, 2);
});

test('leaving one guild does not disconnect or erase another guild session', async () => {
  const { manager, files, connections, makeChannel } = createHarness();
  await manager.join(makeChannel('guild-cottage', 'voice-cottage'));
  await manager.join(makeChannel('guild-second', 'voice-second'));

  const result = await manager.leave('guild-second');
  const saved = JSON.parse(files.get('/runtime/voice-session.json'));

  assert.equal(result.left, true);
  assert.equal(connections[0].destroyed, false);
  assert.equal(connections[1].destroyed, true);
  assert.equal(manager.getStatus('guild-cottage').active, true);
  assert.equal(manager.getStatus('guild-second').active, false);
  assert.deepEqual(Object.keys(saved.sessions), ['guild-cottage']);
});

test('moving channels in one guild does not disturb another guild', async () => {
  const { manager, connections, makeChannel } = createHarness();
  const cottageChannel = makeChannel('guild-cottage', 'voice-one');
  const cottageNextChannel = makeChannel('guild-cottage', 'voice-two');
  const secondServerChannel = makeChannel('guild-second', 'voice-second');

  await manager.join(cottageChannel);
  await manager.join(secondServerChannel);
  await manager.join(cottageNextChannel);

  assert.equal(connections[0].destroyed, true);
  assert.equal(connections[1].destroyed, false);
  assert.equal(connections[2].destroyed, false);
  assert.equal(manager.getStatus('guild-cottage').channelId, 'voice-two');
  assert.equal(manager.getStatus('guild-second').channelId, 'voice-second');
});

test('legacy single-session files migrate on the next successful write', async () => {
  const { manager, files, makeChannel } = createHarness({
    savedState: { guildId: 'guild-old', channelId: 'voice-old' },
  });

  assert.equal(manager.getStatus('guild-old').channelId, 'voice-old');
  await manager.join(makeChannel('guild-new', 'voice-new'));

  const saved = JSON.parse(files.get('/runtime/voice-session.json'));
  assert.equal(saved.version, 2);
  assert.equal(saved.sessions['guild-old'].channelId, 'voice-old');
  assert.equal(saved.sessions['guild-new'].channelId, 'voice-new');
});

test('restore reconnects every saved guild independently', async () => {
  const { manager, connections, addGuild } = createHarness({
    savedState: {
      version: 2,
      sessions: {
        'guild-cottage': { guildId: 'guild-cottage', channelId: 'voice-cottage' },
        'guild-second': { guildId: 'guild-second', channelId: 'voice-second' },
      },
    },
  });
  addGuild('guild-cottage', ['voice-cottage']);
  addGuild('guild-second', ['voice-second']);

  const result = await manager.restore();

  assert.deepEqual(result, { restored: 2, attempted: 2 });
  assert.equal(connections.length, 2);
  assert.equal(connections.every(connection => !connection.destroyed), true);
});

test('a missing guild keeps its saved target so a later restart can retry', async () => {
  const { manager, addGuild } = createHarness({
    savedState: {
      version: 2,
      sessions: {
        'guild-missing': { guildId: 'guild-missing', channelId: 'voice-missing' },
        'guild-present': { guildId: 'guild-present', channelId: 'voice-present' },
      },
    },
    failGuildIds: ['guild-missing'],
  });
  addGuild('guild-present', ['voice-present']);

  const result = await manager.restore();

  assert.deepEqual(result, { restored: 1, attempted: 2 });
  assert.equal(manager.getStatus('guild-missing').active, true);
  assert.equal(manager.getStatus('guild-present').active, true);
});

test('a stale channel clears only its own saved session', async () => {
  const { manager, files, addGuild } = createHarness({
    savedState: {
      version: 2,
      sessions: {
        'guild-stale': { guildId: 'guild-stale', channelId: 'voice-deleted' },
        'guild-good': { guildId: 'guild-good', channelId: 'voice-good' },
      },
    },
  });
  addGuild('guild-stale');
  addGuild('guild-good', ['voice-good']);

  await manager.restore();

  const saved = JSON.parse(files.get('/runtime/voice-session.json'));
  assert.equal(saved.sessions['guild-stale'], undefined);
  assert.equal(saved.sessions['guild-good'].channelId, 'voice-good');
});

test('failed connections are not persisted as active sessions', async () => {
  const { manager, files, voice, makeChannel } = createHarness();
  voice.entersState = async () => { throw new Error('timeout'); };

  await assert.rejects(manager.join(makeChannel('guild-123', 'channel-456')), /Could not connect/);
  assert.equal(files.has('/runtime/voice-session.json'), false);
  assert.equal(manager.getStatus('guild-123').active, false);
});
