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
  const features = [...SERVER_INFO.features];
  assert.equal(new Set(features).size, features.length);
  const guideTopics = Object.keys(FEATURE_GUIDE).sort();
  const tutorialTopics = Object.keys(FEATURE_TUTORIALS).sort();
  assert.deepEqual(tutorialTopics, guideTopics);
  for (const feature of features) {
    assert.ok(FEATURE_GUIDE[feature], feature + ' needs a guide');
    assert.ok(FEATURE_TUTORIALS[feature], feature + ' needs a tutorial');
  }
});

test('feature aliases point to known advertised features', () => {
  const helpTopics = new Set([...Object.keys(FEATURE_GUIDE), ...Object.keys(FEATURE_TUTORIALS)]);
  for (const [alias, feature] of Object.entries(FEATURE_ALIASES)) {
    assert.ok(alias.trim().length > 0, 'empty feature alias');
    assert.ok(helpTopics.has(feature), alias + ' points to unknown help topic ' + feature);
  }
});

test('help text describes opt-in AI and the new prefix shortcuts', () => {
  assert.match(BOT_HELP_MESSAGE, /Mention me or reply to one of my messages/);
  assert.match(BOT_HELP_MESSAGE, /\/afk/);
  assert.match(BOT_HELP_MESSAGE, /\?ip/);
  assert.match(BOT_HELP_MESSAGE, /\?java/);
  assert.match(BOT_HELP_MESSAGE, /\?bedrock/);
  assert.match(BOT_HELP_MESSAGE, /case-insensitive/i);
  assert.doesNotMatch(BOT_HELP_MESSAGE, /afk\?\s*[—-]/i);
  assert.doesNotMatch(BOT_HELP_MESSAGE, /who are you\?/i);
  assert.match(SYSTEM_PROMPT, /Chapter 1 • Season 6/);
  assert.match(SYSTEM_PROMPT, /\?ip/);
  assert.doesNotMatch(SYSTEM_PROMPT, /The Cottage★ SMP DOES support cracked/i);
  assert.equal(SERVER_INFO.javaAddress, 'the-cottage-c1-s6.playwithbao.com:34159');
  assert.equal(SERVER_INFO.bedrockAddress, 'the-cottage-c1-s6.playwithbao.com:32211');
  assert.equal(SERVER_INFO.bedrockVersion, 'Any (Geyser-supported Bedrock versions)');
  assert.match(SERVER_INFO.bedrockJoiningInfo, /32211/);
  assert.match(SERVER_INFO.bedrockJoiningInfo, /add The Cottage★ as a server manually/i);
  assert.doesNotMatch(SERVER_INFO.bedrockJoiningInfo, /friend request|friends list|Emmcee4483|invite/i);
  assert.doesNotMatch(SYSTEM_PROMPT, /Emmcee4483|friend request|friends list/i);
  assert.match(SYSTEM_PROMPT, /1563549543365222513/);
  assert.doesNotMatch(SYSTEM_PROMPT, /A verified direct Bedrock IP\/port is not currently published/);
  assert.doesNotMatch(SYSTEM_PROMPT, /Bedrock-specific skin restoration is not currently enabled because Floodgate is not installed/);
  assert.equal(SERVER_INFO.serverVersion, 'Minecraft 26.2');
  for (const feature of ['Quick Restocks', 'Better Mending', 'Vein Mining', 'Team System', 'Discord Bridge']) {
    assert.ok(SERVER_INFO.features.includes(feature), feature + ' should be advertised');
  }
  for (const retired of ['Open Doors', 'True Hardcore', 'Cottage Protection', 'Cottage Voice', 'Cottage Harvest']) {
    assert.ok(!SERVER_INFO.features.includes(retired), retired + ' must not be advertised for Season 6');
  }
});
