'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createShutdownHandler } = require('../shutdown');

test('shutdown closes Minecraft and Discord exactly once', async () => {
  const calls = [];
  const shutdown = createShutdownHandler({
    mc: { stop: () => calls.push('minecraft') },
    client: { destroy: () => calls.push('discord') },
    log: (_tag, message) => calls.push(message),
  });

  await Promise.all([shutdown('SIGTERM'), shutdown('SIGINT')]);

  assert.equal(calls.filter(value => value === 'minecraft').length, 1);
  assert.equal(calls.filter(value => value === 'discord').length, 1);
  assert.ok(calls.includes('Received SIGTERM; closing bot connections.'));
  assert.ok(calls.includes('Connection cleanup finished.'));
});

test('shutdown continues cleanup when Minecraft stop throws', async () => {
  const calls = [];
  const shutdown = createShutdownHandler({
    mc: { stop: () => { throw new Error('minecraft failed'); } },
    client: { destroy: () => calls.push('discord') },
    log: (_tag, message) => calls.push(message),
  });

  await shutdown('SIGINT');

  assert.ok(calls.includes('discord'));
  assert.ok(calls.some(value => String(value).includes('Unable to close Minecraft connection')));
});
