'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isMinecraftRelayMessage,
  shouldHandleConversationalMessage,
} = require('../message-routing');

const base = {
  guildId: 'cottage-guild',
  configuredGuildId: 'cottage-guild',
  channelId: 'general',
  excludedChannelId: 'minecraft-chat',
  isWebhookMessage: false,
  isReplyToMinecraftRelay: false,
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

test('mentions and replies in another guild do not invoke the Cottage bot', () => {
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

test('the configured Discord-Minecraft relay channel never invokes AI', () => {
  assert.equal(shouldHandleConversationalMessage({
    ...base,
    channelId: 'minecraft-chat',
    isDirectBotMention: true,
  }), false);
  assert.equal(shouldHandleConversationalMessage({
    ...base,
    channelId: 'minecraft-chat',
    isReplyToBot: true,
  }), false);
});

test('webhook messages and replies to Minecraft relay messages never invoke AI', () => {
  assert.equal(shouldHandleConversationalMessage({
    ...base,
    isWebhookMessage: true,
    isDirectBotMention: true,
  }), false);
  assert.equal(shouldHandleConversationalMessage({
    ...base,
    isReplyToMinecraftRelay: true,
    isReplyToBot: true,
  }), false);
});

test('Discord webhook messages are recognized as relay messages', () => {
  assert.equal(isMinecraftRelayMessage({
    webhookId: 'webhook-id',
    author: { bot: false },
    content: 'makkrabb » hello',
  }), true);
});

test('bot-authored Minecraft relay formatting is recognized', () => {
  assert.equal(isMinecraftRelayMessage({
    author: { bot: true },
    content: 'makkrabb » HHAH',
  }), true);
});

test('ordinary bot messages are not misidentified as Minecraft relays', () => {
  assert.equal(isMinecraftRelayMessage({
    author: { bot: true },
    content: 'Did you need help with anything?',
  }), false);
  assert.equal(isMinecraftRelayMessage({
    author: { bot: false },
    content: 'makkrabb » hello',
  }), false);
});
