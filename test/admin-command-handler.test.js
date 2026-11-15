'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAdminCommandHandler } = require('../admin-command-handler');

test('admin handler denies start before running the administrative action', async () => {
  const calls = []; const handler = createAdminCommandHandler({
    hasFeatureAccess: () => false, log: (...args) => calls.push(args), MessageFlags: { Ephemeral: 64 },
    getDiscordPing: () => 20, forgetAllConversations: () => 'forgot', mc: { getStatus: () => ({}) },
    REJOIN_DELAY_MS: 30000, executeAdministrativeAction: async () => calls.push('action'),
    createEmbed: () => ({ setDescription() { return this; }, addFields() { return this; } }),
    Colors: {}, config: { server: { ip: 'example' }, bot: { username: 'Server' } },
    isRejoinAuthorized: () => false, publishRejoinNotice: async () => {}, buildRejoinComponents: () => [],
    requireFeatureAccess: async () => false, buildStatusEmbed: () => 'status', buildStatusComponents: () => [],
  });
  const replies = [];
  await handler({ commandName: 'start', user: { id: 'u', tag: 'u' }, member: {}, reply: async value => replies.push(value) });
  assert.match(replies[0].content, /not authorized/); assert.equal(calls.includes('action'), false);
});