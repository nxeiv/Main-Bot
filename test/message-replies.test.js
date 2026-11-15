'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { replyMentioningAuthor } = require('../message-replies');

function makeMessage() {
  const calls = [];
  return {
    calls,
    author: { id: '123456789012345678' },
    reply: async payload => { calls.push(payload); return payload; },
  };
}

test('message replies explicitly mention the author and allow only that user', async () => {
  const message = makeMessage();
  await replyMentioningAuthor(message, 'You are now AFK.');
  assert.equal(message.calls[0].content, '<@123456789012345678> You are now AFK.');
  assert.deepEqual(message.calls[0].allowedMentions, {
    parse: [],
    users: ['123456789012345678'],
  });
});

test('message reply helper preserves embeds and explicitly allowed user mentions', async () => {
  const message = makeMessage();
  await replyMentioningAuthor(message, {
    embeds: [{ title: 'Status' }],
    allowedMentions: { parse: [], users: ['222222222222222222'] },
  });
  assert.equal(message.calls[0].content, '<@123456789012345678>');
  assert.deepEqual(message.calls[0].allowedMentions, {
    parse: [],
    users: ['222222222222222222', '123456789012345678'],
  });
});

test('message reply helper does not duplicate an existing author mention', async () => {
  const message = makeMessage();
  await replyMentioningAuthor(message, '<@!123456789012345678> Welcome back.');
  assert.equal(message.calls[0].content, '<@!123456789012345678> Welcome back.');
  assert.deepEqual(message.calls[0].allowedMentions.users, ['123456789012345678']);
});

test('message reply helper rejects missing author IDs', async () => {
  await assert.rejects(
    replyMentioningAuthor({ author: {}, reply: async () => {} }, 'Hello.'),
    TypeError,
  );
});
