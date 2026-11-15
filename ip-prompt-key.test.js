'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getIpPromptKey } = require('./ip-prompt-key');

test('IP prompt keys are scoped to guild, channel, and author', () => {
  const message = {
    guild: { id: 'guild-1' },
    channel: { id: 'channel-1' },
    author: { id: 'user-1' },
  };

  assert.equal(getIpPromptKey(message), 'guild-1:channel-1:user-1');
  assert.notEqual(
    getIpPromptKey(message),
    getIpPromptKey({ ...message, channel: { id: 'channel-2' } }),
  );
  assert.notEqual(
    getIpPromptKey(message),
    getIpPromptKey({ ...message, author: { id: 'user-2' } }),
  );
  assert.notEqual(
    getIpPromptKey(message),
    getIpPromptKey({ ...message, guild: { id: 'guild-2' } }),
  );
});

test('IP prompt keys use a separate scope for direct messages', () => {
  assert.equal(
    getIpPromptKey({ guild: null, channel: { id: 'dm-channel' }, author: { id: 'user-1' } }),
    'dm:dm-channel:user-1',
  );
});

test('IP prompt key rejects messages missing channel or author IDs', () => {
  assert.throws(() => getIpPromptKey(null), TypeError);
  assert.throws(() => getIpPromptKey({ guild: null, channel: {}, author: { id: 'user-1' } }), TypeError);
  assert.throws(() => getIpPromptKey({ guild: null, channel: { id: 'channel-1' }, author: {} }), TypeError);
});
