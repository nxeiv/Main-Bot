'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createVoiceSessionManager } = require('../voice-session');

function createHarness() {
  const files = new Map();
  const fs = {
    existsSync: path => files.has(path),
    readFileSync: path => files.get(path),
    writeFileSync: (path, value) => files.set(path, value),
    unlinkSync: path => files.delete(path),
  };
  const connections = [];
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
  const guild = {
    id: 'guild-123',
    voiceAdapterCreator: () => ({}),
  };
  const channel = { id: 'channel-456', guild };
  const client = { guilds: { fetch: async () => guild } };
  const manager = createVoiceSessionManager({
    client,
    voice,
    fs,
    filePath: '/runtime/voice-session.json',
    log: () => {},
  });
  return { manager, files, connections, channel, voice, guild };
}

test('joining saves a persistent, muted and deafened voice session', async () => {
  const { manager, files, connections, channel } = createHarness();
  const result = await manager.join(channel);

  assert.equal(result.alreadyConnected, false);
  assert.deepEqual(JSON.parse(files.get('/runtime/voice-session.json')), {
    guildId: 'guild-123',
    channelId: 'channel-456',
  });
  assert.equal(connections[0].options.selfMute, true);
  assert.equal(connections[0].options.selfDeaf, true);
  assert.equal(manager.getStatus().active, true);
});

test('joining the same ready channel does not create a duplicate connection', async () => {
  const { manager, connections, channel } = createHarness();
  await manager.join(channel);
  const result = await manager.join(channel);

  assert.equal(result.alreadyConnected, true);
  assert.equal(connections.length, 1);
});

test('leaving destroys the connection and removes the saved session', async () => {
  const { manager, files, connections, channel } = createHarness();
  await manager.join(channel);
  const result = manager.leave();

  assert.equal(result.left, true);
  assert.equal(connections[0].destroyed, true);
  assert.equal(files.has('/runtime/voice-session.json'), false);
  assert.equal(manager.getStatus().active, false);
});

test('failed connections are not persisted', async () => {
  const { manager, files, channel, voice } = createHarness();
  voice.entersState = async () => { throw new Error('timeout'); };

  await assert.rejects(manager.join(channel), /Could not connect/);
  assert.equal(files.has('/runtime/voice-session.json'), false);
});
