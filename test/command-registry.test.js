'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  COMMAND_REGISTRY,
  TEXT_SHORTCUTS,
  buildHelpMessage,
  buildSlashCommands,
} = require('../command-registry');
const { parseTextShortcut } = require('../text-shortcuts');

test('command registry has unique command names and shortcut names', () => {
  assert.equal(new Set(COMMAND_REGISTRY.map(command => command.name)).size, COMMAND_REGISTRY.length);
  assert.equal(new Set(TEXT_SHORTCUTS).size, TEXT_SHORTCUTS.length);
});

test('slash commands are generated from registry metadata', () => {
  const generated = buildSlashCommands();
  const expected = COMMAND_REGISTRY.filter(command => command.description);
  assert.deepEqual(
    generated.map(command => command.name),
    expected.map(command => command.name),
  );
});

test('help text is generated from registered commands and shortcuts', () => {
  const help = buildHelpMessage();
  for (const command of COMMAND_REGISTRY.filter(entry => entry.description)) {
    assert.ok(help.includes('/' + command.name), 'help is missing /' + command.name);
  }
  for (const shortcut of TEXT_SHORTCUTS) {
    assert.ok(help.includes('?' + shortcut), 'help is missing ?' + shortcut);
  }
});

test('argument-based shortcuts remain strict', () => {
  assert.equal(parseTextShortcut('?world download'), 'world download');
  assert.equal(parseTextShortcut('?summarize <#123456789012345678>'), 'summarize <#123456789012345678>');
  assert.equal(parseTextShortcut('?summarize'), null);
  assert.equal(parseTextShortcut('?plugins'), null);
  assert.equal(parseTextShortcut('???'), null);
});


test('sticky and say commands are registered as administrator-only channel message tools', () => {
  for (const name of ['sticky', 'say']) {
    const entry = COMMAND_REGISTRY.find(command => command.name === name);
    assert.ok(entry, name + ' command is missing');
    assert.equal(entry.access, 'admin');
    assert.equal(entry.options, 'channel-message');
  }
  const generated = buildSlashCommands();
  for (const name of ['sticky', 'say']) {
    const command = generated.find(entry => entry.name === name);
    assert.ok(command);
    assert.deepEqual(command.options.map(option => option.name), ['channel', 'message']);
    assert.equal(command.options[1].max_length, 2000);
  }
});
