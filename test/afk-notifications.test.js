'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAfkNotificationCooldown } = require('../afk-notifications');

test('AFK mention notifications are throttled per user and channel', () => {
  let now = 1_000;
  const cooldown = createAfkNotificationCooldown({
    cooldownMs: 60_000,
    now: () => now,
  });

  assert.equal(cooldown.shouldNotify('user-a', 'channel-a'), true);
  assert.equal(cooldown.shouldNotify('user-a', 'channel-a'), false);
  assert.equal(cooldown.shouldNotify('user-a', 'channel-b'), true);

  now += 60_000;
  assert.equal(cooldown.shouldNotify('user-a', 'channel-a'), true);
});

test('clearing a user's AFK state also clears their notification cooldowns', () => {
  const cooldown = createAfkNotificationCooldown({ now: () => 10_000 });

  assert.equal(cooldown.shouldNotify('user-a', 'channel-a'), true);
  cooldown.clearUser('user-a');
  assert.equal(cooldown.shouldNotify('user-a', 'channel-a'), true);
});

test('invalid cooldown values are rejected', () => {
  assert.throws(
    () => createAfkNotificationCooldown({ cooldownMs: -1 }),
    /cooldownMs/,
  );
});
