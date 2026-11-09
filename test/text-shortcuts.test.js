'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseTextShortcut,
  normalizeIpChoice,
} = require('../text-shortcuts');

test('text shortcuts require a leading question-mark prefix', () => {
  assert.equal(parseTextShortcut('?ip'), 'ip');
  assert.equal(parseTextShortcut('ip?'), null);
  assert.equal(parseTextShortcut('ip'), null);
  assert.equal(parseTextShortcut('hello ?ip'), null);
});

test('only explicitly supported shortcut phrases are recognized', () => {
  const supported = [
    'ip',
    'java',
    'java ip',
    'java address',
    'bedrock',
    'bedrock ip',
    'bedrock address',
    'plugins',
    'world download',
    'help',
    'invite',
    'roles',
    'channels',
    'rules',
    'start',
    'stop',
    'rejoin',
    'status',
    'dashboard',
    'ai status',
  ];

  for (const shortcut of supported) {
    assert.equal(
      parseTextShortcut('?' + shortcut),
      shortcut,
      'expected this registered shortcut to be recognized: ' + shortcut,
    );
  }

  assert.equal(
    parseTextShortcut('?summarize <#123456789012345678>'),
    'summarize <#123456789012345678>',
  );
});

test('shortcut parsing is case-insensitive and normalizes internal whitespace', () => {
  assert.equal(parseTextShortcut('?IP'), 'ip');
  assert.equal(parseTextShortcut('?Ip'), 'ip');
  assert.equal(parseTextShortcut('?  AI   STATUS  '), 'ai status');
  assert.equal(parseTextShortcut('?Summarize <#123456789012345678>'), 'summarize <#123456789012345678>');
});

test('ordinary question-mark messages are ignored instead of becoming shortcuts', () => {
  for (const message of [
    '?',
    '   ?   ',
    '???',
    '???!!!',
    '?!!!',
    '??ip',
    '?what is this',
    '?random text',
    '?plugins please',
    '?plugins!!!',
    '?ip?',
    '?help?',
    '?summarize',
    '?summarize #general',
    '?summarize <#not-a-channel-id>',
    '?summarize <#123456789012345678> please',
  ]) {
    assert.equal(
      parseTextShortcut(message),
      null,
      'expected ordinary text to be ignored: ' + message,
    );
  }
});

test('IP selection accepts Java and Bedrock regardless of capitalization', () => {
  assert.equal(normalizeIpChoice('Java'), 'java');
  assert.equal(normalizeIpChoice('jAvA eDiTiOn'), 'java');
  assert.equal(normalizeIpChoice('BEDROCK'), 'bedrock');
  assert.equal(normalizeIpChoice('Bedrock Edition'), 'bedrock');
  assert.equal(normalizeIpChoice('maybe'), null);
});
