'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { isExplicitBotInvocation } = require('../message-policy');

test('a direct bot mention is an explicit invocation', () => {
  assert.equal(
    isExplicitBotInvocation({ isDirectMention: true, isReplyToBot: false }),
    true,
  );
});

test('a direct reply to the bot is an explicit invocation', () => {
  assert.equal(
    isExplicitBotInvocation({ isDirectMention: false, isReplyToBot: true }),
    true,
  );
});

test('a message that mentions and replies to the bot is an explicit invocation', () => {
  assert.equal(
    isExplicitBotInvocation({ isDirectMention: true, isReplyToBot: true }),
    true,
  );
});

test('ordinary conversation is not an explicit invocation', () => {
  assert.equal(
    isExplicitBotInvocation({ isDirectMention: false, isReplyToBot: false }),
    false,
  );
});

test('missing invocation flags default to false', () => {
  assert.equal(isExplicitBotInvocation(), false);
});
