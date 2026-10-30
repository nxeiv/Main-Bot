'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const commands = require('../commands');

test('slash command names are unique', () => {
  const names = commands.map(command => command.name);
  assert.equal(new Set(names).size, names.length);
});

test('the existing public and administrative command set is preserved', () => {
  const names = new Set(commands.map(command => command.name));

  for (const name of [
    'start',
    'stop',
    'rejoin',
    'status',
    'afk',
    'forget',
    'aforget',
    'ai',
    'dashboard',
    'help',
    'ping',
    'summarize',
  ]) {
    assert.ok(names.has(name), 'missing slash command: ' + name);
  }

  assert.equal(names.size, 12);
});

test('every command has a description', () => {
  for (const command of commands) {
    assert.equal(typeof command.description, 'string', command.name);
    assert.ok(command.description.length > 0, command.name);
  }
});
