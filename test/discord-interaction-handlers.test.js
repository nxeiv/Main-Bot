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
    stickyMessages: { setSticky: async value => calls.push(['sticky', value]) },
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


test('sticky command requires admin access and configures the selected channel', async () => {
  const calls = [];
  const h = harness({
    hasFeatureAccess: feature => feature === 'sticky',
    stickyMessages: { setSticky: async value => calls.push(value) },
  });
  const target = {
    id: 'target-channel',
    guildId: 'cottage-guild',
    isTextBased: () => true,
    send: async () => {},
  };
  const command = interaction('sticky');
  command.options = {
    getChannel: () => target,
    getString: () => 'Pick your roles.',
  };
  const result = await h.client.listeners('interactionCreate')[0](command);
  assert.match(result.content, /Sticky message updated/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].content, 'Pick your roles.');
});

test('say command posts without parsing mentions and denies unauthorized users', async () => {
  const h = harness({ hasFeatureAccess: feature => feature === 'say' });
  let sent = null;
  const target = {
    id: 'target-channel',
    guildId: 'cottage-guild',
    isTextBased: () => true,
    send: async payload => { sent = payload; },
  };
  const command = interaction('say');
  command.options = {
    getChannel: () => target,
    getString: () => 'Welcome!',
  };
  const result = await h.client.listeners('interactionCreate')[0](command);
  assert.match(result.content, /Message sent/);
  assert.deepEqual(sent, {
    content: 'Welcome!',
    allowedMentions: { parse: [] },
  });

  const denied = harness();
  const deniedCommand = interaction('say');
  deniedCommand.options = command.options;
  const deniedResult = await denied.client.listeners('interactionCreate')[0](deniedCommand);
  assert.match(deniedResult.content, /not authorized/);
});
