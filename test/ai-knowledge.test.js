'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BOT_HELP_MESSAGE,
  FEATURE_ALIASES,
  FEATURE_GUIDE,
  FEATURE_TUTORIALS,
  SERVER_INFO,
  SYSTEM_PROMPT,
} = require('../ai-knowledge');

test('every advertised SMP feature has a guide and tutorial', () => {
  const features = [...SERVER_INFO.features].sort();
  assert.equal(new Set(features).size, features.length);
  assert.deepEqual(Object.keys(FEATURE_GUIDE).sort(), features);
  assert.deepEqual(Object.keys(FEATURE_TUTORIALS).sort(), features);
});

test('feature aliases point to known advertised features', () => {
  const features = new Set(SERVER_INFO.features);
  for (const [alias, feature] of Object.entries(FEATURE_ALIASES)) {
    assert.ok(alias.trim().length > 0, 'empty feature alias');
    assert.ok(features.has(feature), alias + ' points to unknown feature ' + feature);
  }
});

test('help text describes opt-in AI and does not advertise removed text shortcuts', () => {
  assert.match(BOT_HELP_MESSAGE, /Mention me or reply to one of my messages/);
  assert.match(BOT_HELP_MESSAGE, /\/afk/);
  assert.doesNotMatch(BOT_HELP_MESSAGE, /afk\?\s*[—-]/i);
  assert.doesNotMatch(BOT_HELP_MESSAGE, /who are you\?/i);
  assert.match(SYSTEM_PROMPT, /The Cottage★ SMP DOES support cracked/i);
});
