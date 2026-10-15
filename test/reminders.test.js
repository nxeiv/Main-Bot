'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseDuration } = require('../reminders');

test('parseDuration accepts supported single-unit durations', () => {
  assert.equal(parseDuration('30s'), 30_000);
  assert.equal(parseDuration('30m'), 30 * 60_000);
  assert.equal(parseDuration('2h'), 2 * 60 * 60_000);
  assert.equal(parseDuration('1d'), 24 * 60 * 60_000);
  assert.equal(parseDuration('1w'), 7 * 24 * 60 * 60_000);
});

test('parseDuration accepts compound durations and whitespace', () => {
  assert.equal(parseDuration('1h30m'), 90 * 60_000);
  assert.equal(parseDuration('1h 30m'), 90 * 60_000);
  assert.equal(parseDuration(' 2H '), 2 * 60 * 60_000);
});

test('parseDuration rejects empty, malformed, zero, and negative durations', () => {
  for (const value of ['', '   ', '0m', '-5m', '5', '1x', '1m30', '1m-2s']) {
    assert.throws(() => parseDuration(value), { name: 'Error' }, value || '(empty)');
  }
});

test('parseDuration enforces the maximum supported duration', () => {
  assert.throws(() => parseDuration('366d'), /365 days/);
  assert.throws(() => parseDuration('999999999999w'));
});
