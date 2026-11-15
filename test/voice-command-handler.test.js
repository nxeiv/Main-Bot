'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createVoiceCommandHandler } = require('../voice-command-handler');

const MessageFlags = { Ephemeral: 64 };
const ChannelType = { GuildVoice: 2 };
const PermissionFlagsBits = { ViewChannel: 1, Connect: 2 };

function makeHarness({
  action = 'status',
  authorized = true,
  channel = null,
  joinResult = { alreadyConnected: false },
  voiceStatus = { active: false },
  leaveResult = { left: true },
  guildId = 'guild-test',
} = {}) {
  const calls = [];
  const voiceSession = {
    join: async value => { calls.push(['join', value.id]); return joinResult; },
    leave: async id => { calls.push(['leave', id]); return leaveResult; },
    getStatus: id => { calls.push(['status', id]); return voiceStatus; },
  };
  const interaction = {
    guildId,
    options: { getSubcommand: () => action },
    member: { voice: { channel } },
    guild: {
      id: guildId,
      members: {
        me: { id: 'bot' },
        fetchMe: async () => ({ id: 'bot' }),
      },
    },
    reply: async payload => { calls.push(['reply', payload]); return payload; },
    deferReply: async payload => { calls.push(['deferReply', payload]); },
    editReply: async payload => { calls.push(['editReply', payload]); return payload; },
  };
  const handler = createVoiceCommandHandler({
    requireFeatureAccess: async () => authorized,
    ChannelType,
    PermissionFlagsBits,
    MessageFlags,
    voiceSession,
    log: (...args) => calls.push(['log', ...args]),
  });
  return { calls, interaction, handler };
}

test('voice command refuses unauthorized access before touching the session', async () => {
  const { calls, interaction, handler } = makeHarness({ authorized: false });
  await handler(interaction);
  assert.deepEqual(calls, []);
});

test('vc join requires a regular voice channel', async () => {
  const { calls, interaction, handler } = makeHarness({ action: 'join' });
  await handler(interaction);
  assert.equal(calls[0][0], 'reply');
  assert.match(calls[0][1].content, /Join a regular voice channel/);
});

test('vc join checks channel permissions before connecting', async () => {
  const channel = {
    id: 'voice-1',
    type: ChannelType.GuildVoice,
    permissionsFor: () => ({ has: bit => permissionsFor.has(bit) }),
  };
  const permissionsFor = new Set([PermissionFlagsBits.ViewChannel]);
  const { calls, interaction, handler } = makeHarness({ action: 'join', channel });
  await handler(interaction);
  assert.equal(calls.some(call => call[0] === 'join'), false);
  assert.match(calls[0][1].content, /View Channel and Connect/);
});

test('vc join connects after permission checks and confirms the audio restrictions', async () => {
  const channel = {
    id: 'voice-1',
    type: ChannelType.GuildVoice,
    permissionsFor: () => ({ has: () => true }),
  };
  const { calls, interaction, handler } = makeHarness({ action: 'join', channel });
  await handler(interaction);
  assert.deepEqual(calls.map(call => call[0]), ['deferReply', 'join', 'editReply']);
  assert.match(calls[2][1].content, /microphone and audio reception are disabled/);
});

test('vc leave and status are scoped to the invoking guild', async () => {
  const leave = makeHarness({ action: 'leave', guildId: 'guild-two' });
  await leave.handler(leave.interaction);
  const leaveReply = leave.calls.find(call => call[0] === 'reply');
  assert.match(leaveReply[1].content, /connection stopped in this server/);
  assert.deepEqual(leave.calls.find(call => call[0] === 'leave'), ['leave', 'guild-two']);

  const status = makeHarness({
    action: 'status',
    guildId: 'guild-three',
    voiceStatus: { active: true, channelId: 'voice-2', connectionState: 'ready' },
  });
  await status.handler(status.interaction);
  const statusReply = status.calls.find(call => call[0] === 'reply');
  assert.match(statusReply[1].content, /voice-2/);
  assert.match(statusReply[1].content, /ready/);
  assert.deepEqual(status.calls.find(call => call[0] === 'status'), ['status', 'guild-three']);
});
