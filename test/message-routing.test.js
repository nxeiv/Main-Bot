'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  shouldHandleConversationalMessage,
} = require('../message-routing');

const base = {
  guildId: 'cottage-guild',
  configuredGuildId: 'cottage-guild',
  isDirectBotMention: false,
  isReplyToBot: false,
};

test('ordinary conversation does not invoke the bot', () => {
  assert.equal(shouldHandleConversationalMessage(base), false);
});

test('a direct bot mention invokes conversational handling', () => {
  assert.equal(shouldHandleConversationalMessage({
    ...base,
    isDirectBotMention: true,
  }), true);
});

test('a direct reply to the bot invokes conversational handling', () => {
  assert.equal(shouldHandleConversationalMessage({
    ...base,
    isReplyToBot: true,
  }), true);
});

test('a mention or reply in another guild does not invoke the Cottage bot', () => {
  assert.equal(shouldHandleConversationalMessage({
    ...base,
    guildId: 'another-guild',
    isDirectBotMention: true,
  }), false);
  assert.equal(shouldHandleConversationalMessage({
    ...base,
    guildId: 'another-guild',
    isReplyToBot: true,
  }), false);
});

test('missing guild context never invokes conversational handling', () => {
  assert.equal(shouldHandleConversationalMessage({
    ...base,
    guildId: null,
    isDirectBotMention: true,
  }), false);
});
