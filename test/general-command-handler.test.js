'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createGeneralCommandHandler } = require('../general-command-handler');

test('general handler routes help, forget, and AFK commands', async () => {
  const calls = [];
  const handler = createGeneralCommandHandler({
    summary: { handleSlashCommand: async () => calls.push('summary') }, ai: { getHelpMessage: () => 'help' },
    forgetUserConversation: id => `forgot:${id}`, getInteractionAiSessionId: () => 'user-session',
    MessageFlags: { Ephemeral: 64 }, setUserAfk: (id, reason) => calls.push([id, reason]),
    getUserAfk: () => ({ reason: 'Away', setAt: 1000 }),
  });
  const replies = [];
  const interaction = { commandName: 'help', user: { id: 'u' }, options: { getString: () => 'Away' }, reply: async value => replies.push(value) };
  await handler(interaction);
  interaction.commandName = 'forget'; await handler(interaction);
  interaction.commandName = 'afk'; await handler(interaction);
  assert.equal(replies[0].content, 'help'); assert.equal(replies[1].content, 'forgot:user-session');
  assert.deepEqual(calls[0], ['u', 'Away']); assert.match(replies[2].content, /You are now AFK/);
});