'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ChannelType } = require('discord.js');

const { collectSummary, buildTranscript } = require('../summary');

function createTarget() {
  const messages = new Map([
    ['later', {
      content: 'Decision: keep the SMP public.',
      createdTimestamp: 2,
      author: { username: 'PlayerTwo', bot: false },
      member: { displayName: 'Player Two' },
      system: false,
    }],
    ['earlier', {
      content: 'We should test the new spawn first.',
      createdTimestamp: 1,
      author: { username: 'PlayerOne', bot: false },
      member: { displayName: 'Player One' },
      system: false,
    }],
  ]);

  return {
    id: 'channel-id',
    name: 'backyard',
    type: ChannelType.GuildText,
    isTextBased: () => true,
    messages: { fetch: async () => messages },
  };
}

test('transcripts sort messages chronologically and remove Discord mentions', () => {
  const transcript = buildTranscript([
    {
      content: 'hi <@123456789012345678> in <#123456789012345678>',
      createdTimestamp: 1,
      author: { username: 'Player' },
      system: false,
    },
  ]);

  assert.equal(transcript, 'Player: hi @user in #channel');
});

test('channel summaries use the requester identity and an isolated AI session', async () => {
  const target = createTarget();
  let captured = null;
  const ai = {
    ask: async (prompt, options) => {
      captured = { prompt, options };
      return 'Summary';
    },
  };

  const result = await collectSummary({
    requesterId: '987654321098765432',
    target,
    ai,
  });

  assert.equal(result, 'Summary');
  assert.equal(captured.options.userId, 'summary:987654321098765432');
  assert.equal(captured.options.cooldownUserId, '987654321098765432');
  assert.equal(captured.options.stateless, true);
  assert.match(captured.prompt, /untrusted user-generated content/);
  assert.match(captured.prompt, /TRANSCRIPT_JSON:/);
  assert.match(captured.prompt, /Decision: keep the SMP public/);
});

test('channel summaries reject missing requester IDs', async () => {
  await assert.rejects(
    collectSummary({
      requesterId: '',
      target: createTarget(),
      ai: { ask: async () => 'never reached' },
    }),
    /requester ID is required/,
  );
});
