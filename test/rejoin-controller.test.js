'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createRejoinController } = require('../rejoin-controller');

function createFakeTimers() {
  const timers = [];
  return {
    timers,
    setTimeoutFn(callback, delayMs) {
      const timer = { callback, delayMs, cancelled: false };
      timers.push(timer);
      return timer;
    },
    clearTimeoutFn(timer) {
      timer.cancelled = true;
    },
  };
}

test('rejoin disconnects immediately and reconnects after the requested delay', () => {
  const calls = [];
  const fakeTimers = createFakeTimers();
  const controller = createRejoinController({
    disconnect: () => calls.push('disconnect'),
    connect: () => calls.push('connect'),
    setTimeoutFn: fakeTimers.setTimeoutFn,
    clearTimeoutFn: fakeTimers.clearTimeoutFn,
  });

  const result = controller.schedule(30_000);
  assert.deepEqual(result, { scheduled: true, delayMs: 30_000 });
  assert.deepEqual(calls, ['disconnect']);
  assert.equal(fakeTimers.timers[0].delayMs, 30_000);
  assert.equal(controller.isScheduled(), true);

  fakeTimers.timers[0].callback();
  assert.deepEqual(calls, ['disconnect', 'connect']);
  assert.equal(controller.isScheduled(), false);
});

test('a second request does not create a duplicate rejoin timer', () => {
  const calls = [];
  const fakeTimers = createFakeTimers();
  const controller = createRejoinController({
    disconnect: () => calls.push('disconnect'),
    connect: () => calls.push('connect'),
    setTimeoutFn: fakeTimers.setTimeoutFn,
    clearTimeoutFn: fakeTimers.clearTimeoutFn,
  });

  controller.schedule(30_000);
  const second = controller.schedule(30_000);
  assert.deepEqual(second, { scheduled: false, reason: 'already-scheduled' });
  assert.equal(fakeTimers.timers.length, 1);
  assert.deepEqual(calls, ['disconnect']);
});

test('manual cancellation prevents the delayed reconnect', () => {
  const calls = [];
  const fakeTimers = createFakeTimers();
  const controller = createRejoinController({
    disconnect: () => calls.push('disconnect'),
    connect: () => calls.push('connect'),
    setTimeoutFn: fakeTimers.setTimeoutFn,
    clearTimeoutFn: fakeTimers.clearTimeoutFn,
  });

  controller.schedule(30_000);
  assert.equal(controller.cancel(), true);
  assert.equal(controller.isScheduled(), false);
  assert.equal(fakeTimers.timers[0].cancelled, true);
  fakeTimers.timers[0].callback();
  assert.deepEqual(calls, ['disconnect']);
});

test('Retry replaces an already scheduled rejoin window', () => {
  const calls = [];
  const fakeTimers = createFakeTimers();
  const controller = createRejoinController({
    disconnect: () => calls.push('disconnect'),
    connect: () => calls.push('connect'),
    setTimeoutFn: fakeTimers.setTimeoutFn,
    clearTimeoutFn: fakeTimers.clearTimeoutFn,
  });

  controller.schedule(30_000);
  const retried = controller.schedule(30_000, { replacePending: true });
  assert.deepEqual(retried, { scheduled: true, delayMs: 30_000 });
  assert.equal(fakeTimers.timers[0].cancelled, true);
  assert.equal(fakeTimers.timers.length, 2);
  assert.deepEqual(calls, ['disconnect', 'disconnect']);
});

test('invalid rejoin delays are rejected', () => {
  const controller = createRejoinController({ disconnect() {}, connect() {} });
  assert.throws(() => controller.schedule(-1), RangeError);
  assert.throws(() => controller.schedule(1.5), RangeError);
});
