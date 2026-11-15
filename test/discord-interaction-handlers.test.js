'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { registerInteractionHandlers } = require('../discord-interaction-handlers');

function harness(overrides = {}) {
  const client = new EventEmitter(); const calls = [];
  const dependencies = {
    client, Events: { InteractionCreate: 'interactionCreate' }, MessageFlags: { Ephemeral: 64 },
    log: (...args) => calls.push(['log', ...args]), mc: { getStatus: () => ({ connected: false, connecting: false, reconnecting: false }) },
    REJOIN_DELAY_MS: 30000, hasFeatureAccess: () => false,
    buildStatusEmbed: () => 'status', buildStatusComponents: () => [], publishRejoinNotice: async () => {},
    summary: { handleSlashCommand: async () => calls.push(['summary']) }, ai: { getHelpMessage: () => 'help' },
    getDiscordPing: () => 42, forgetUserConversation: () => 'forgot', getInteractionAiSessionId: () => 'session',
    forgetAllConversations: () => 'forgot-all', executeAdministrativeAction: async () => calls.push(['admin']),
    createEmbed: () => ({ setDescription() { return this; }, addFields() { return this; } }),
    Colors: { Green: 'green', Yellow: 'yellow', Red: 'red', Blurple: 'blurple' },
    config: { discord: { guildIds: ['cottage-guild', 'gree-guild'] }, server: { ip: 'server.example' }, bot: { username: 'Server' } },
    isRejoinAuthorized: () => false, buildRejoinComponents: () => [],
    requireFeatureAccess: async () => false, handleVoiceCommand: async () => calls.push(['vc']),
    setUserAfk: () => {}, getUserAfk: () => ({ reason: 'AFK', setAt: 1000 }),
    ...overrides,
  };
  registerInteractionHandlers(dependencies);
  return { client, calls };
}

function interaction(commandName, guildId = 'cottage-guild') {
  return {
    isButton: () => false, isChatInputCommand: () => true, commandName,
    user: { id: 'member', tag: 'member' }, member: {},
    guildId,
    reply: async value => value, deferReply: async value => value, followUp: async value => value, editReply: async value => value,
    options: { getString: () => null },
  };
}

test('admin-only slash commands deny an ordinary member before performing actions', async () => {
  const h = harness();
  await h.client.listeners('interactionCreate')[0](interaction('start'));
  assert.ok(h.calls.some(call => call[0] === 'log' && String(call[2]).includes('Rejected /start')));
  assert.equal(h.calls.some(call => call[0] === 'admin'), false);
});

test('voice slash command delegates to the extracted voice handler', async () => {
  const h = harness();
  await h.client.listeners('interactionCreate')[0](interaction('vc'));
  assert.ok(h.calls.some(call => call[0] === 'vc'));
});
test('slash command responses are ephemeral in every configured guild', async () => {
  const h = harness();
  const result = await h.client.listeners('interactionCreate')[0](interaction('help', 'gree-guild'));
  assert.equal(result.flags, 64);
  assert.equal(result.content, 'help');
});

test('slash commands are rejected privately in guilds outside the allow-list', async () => {
  const h = harness();
  const result = await h.client.listeners('interactionCreate')[0](interaction('help', 'unknown-guild'));
  assert.equal(result.flags, 64);
  assert.match(result.content, /not enabled in this server/);
  assert.equal(h.calls.some(call => call[0] === 'log' && String(call[2]).includes('/help requested')), false);
});
