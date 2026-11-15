'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { formatUptime, formatAfkDuration, formatDelay, getBotState } = require('../response-utils');

test('formatUptime formats hours, minutes, and seconds', () => {
  assert.equal(formatUptime(0), '0s');
  assert.equal(formatUptime(3661), '1h 1m 1s');
});

test('formatAfkDuration formats elapsed time without losing smaller units', () => {
  assert.equal(formatAfkDuration(0), '0s');
  assert.equal(formatAfkDuration(90061000), '1d 1h 1m 1s');
});

test('formatDelay uses minutes for exact minute values', () => {
  assert.equal(formatDelay(60000), '1 minute');
  assert.equal(formatDelay(120000), '2 minutes');
  assert.equal(formatDelay(45000), '45 seconds');
});

test('getBotState distinguishes online, reconnecting, and offline', () => {
  assert.equal(getBotState({ connected: true }), 'Online');
  assert.equal(getBotState({ connecting: true }), 'Reconnecting');
  assert.equal(getBotState({ reconnecting: true }), 'Reconnecting');
  assert.equal(getBotState({}), 'Offline');
});
