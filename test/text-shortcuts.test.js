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

test('text shortcut parsing is case-insensitive and normalizes spacing', () => {
  assert.equal(parseTextShortcut('?IP'), 'ip');
  assert.equal(parseTextShortcut('?Ip'), 'ip');
  assert.equal(parseTextShortcut('?  AI   STATUS  '), 'ai status');
  assert.equal(parseTextShortcut('?Summarize <#123456789012345678>'), 'summarize <#123456789012345678>');
});

test('an empty question-mark prefix is not a shortcut', () => {
  assert.equal(parseTextShortcut('?'), null);
  assert.equal(parseTextShortcut('   ?   '), null);
});

test('IP selection accepts Java and Bedrock regardless of capitalization', () => {
  assert.equal(normalizeIpChoice('Java'), 'java');
  assert.equal(normalizeIpChoice('jAvA eDiTiOn'), 'java');
  assert.equal(normalizeIpChoice('BEDROCK'), 'bedrock');
  assert.equal(normalizeIpChoice('Bedrock Edition'), 'bedrock');
  assert.equal(normalizeIpChoice('maybe'), null);
});
