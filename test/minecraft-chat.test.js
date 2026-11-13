'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_MINECRAFT_CHAT_LENGTH,
  validateMinecraftChatMessage,
} = require('../minecraft-chat');

test('normalizes ordinary messages to a single line', () => {
  assert.deepEqual(validateMinecraftChatMessage('  hello\n   Cottage  '), {
    ok: true,
    text: 'hello Cottage',
  });
});

test('rejects empty messages', () => {
  assert.deepEqual(validateMinecraftChatMessage('  \n  '), {
    ok: false,
    code: 'empty',
  });
});

test('rejects slash-prefixed Minecraft commands', () => {
  assert.deepEqual(validateMinecraftChatMessage('  /op Server'), {
    ok: false,
    code: 'command',
  });
});

test('rejects control characters', () => {
  assert.deepEqual(validateMinecraftChatMessage('hello\u0000world'), {
    ok: false,
    code: 'control_characters',
  });
});

test('enforces the Minecraft chat message length limit', () => {
  assert.equal(validateMinecraftChatMessage('x'.repeat(MAX_MINECRAFT_CHAT_LENGTH)).ok, true);
  assert.deepEqual(validateMinecraftChatMessage('x'.repeat(MAX_MINECRAFT_CHAT_LENGTH + 1)), {
    ok: false,
    code: 'too_long',
  });
});
