'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// The module's configuration is validated at load time. Supply harmless
// placeholders so this unit test does not depend on a production .env file.
process.env.DISCORD_TOKEN ||= 'test-token';
process.env.ADMIN_USER_IDS ||= '12345678901234567';

const minecraft = require('../minecraft');

test('Minecraft AFK client is opt-in after a fresh process start', () => {
  const status = minecraft.getStatus();

  assert.equal(status.connected, false);
  assert.equal(status.connecting, false);
  assert.equal(status.reconnecting, false);
  assert.equal(status.manualStop, true);
});
