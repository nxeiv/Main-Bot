'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createShutdownHandler } = require('../shutdown');

test('shutdown closes Minecraft, the status server, and Discord once', async () => {
  const calls = [];
  const statusServer = {
    listening: true,
    close(callback) {
      calls.push('status');
      this.listening = false;
      callback();
    },
  };
  const shutdown = createShutdownHandler({
    mc: { stop: () => calls.push('minecraft') },
    statusServer,
    client: { destroy: () => calls.push('discord') },
    log: (_tag, message) => calls.push(message),
  });

  await Promise.all([shutdown('SIGTERM'), shutdown('SIGINT')]);

  assert.equal(calls.filter(value => value === 'minecraft').length, 1);
  assert.equal(calls.filter(value => value === 'status').length, 1);
  assert.equal(calls.filter(value => value === 'discord').length, 1);
  assert.ok(calls.includes('Received SIGTERM; closing bot connections.'));
  assert.ok(calls.includes('Connection cleanup finished.'));
});

test('shutdown continues cleanup when one resource throws', async () => {
  const calls = [];
  const shutdown = createShutdownHandler({
    mc: { stop: () => { throw new Error('minecraft failed'); } },
    statusServer: {
      listening: true,
      close(callback) {
        calls.push('status');
        callback();
      },
    },
    client: { destroy: () => calls.push('discord') },
    log: (_tag, message) => calls.push(message),
  });

  await shutdown('SIGINT');

  assert.ok(calls.includes('status'));
  assert.ok(calls.includes('discord'));
  assert.ok(calls.some(value => String(value).includes('Unable to close Minecraft connection')));
});

test('shutdown skips an HTTP server that is not listening', async () => {
  const calls = [];
  const shutdown = createShutdownHandler({
    mc: { stop: () => calls.push('minecraft') },
    statusServer: { listening: false, close: () => calls.push('status') },
    client: { destroy: () => calls.push('discord') },
    log: () => {},
  });

  await shutdown('SIGTERM');

  assert.deepEqual(calls, ['minecraft', 'discord']);
});
