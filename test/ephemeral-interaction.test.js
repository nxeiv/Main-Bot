'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createEphemeralInteraction, withEphemeralFlag } = require('../ephemeral-interaction');

test('ephemeral flag is added to string and object response payloads', () => {
  assert.deepEqual(withEphemeralFlag('Private reply', 64), {
    content: 'Private reply',
    flags: 64,
  });
  assert.deepEqual(withEphemeralFlag({ content: 'Private', flags: 4 }, 64), {
    content: 'Private',
    flags: 68,
  });
});

test('reply, deferReply, and followUp are forced ephemeral and retain their receiver', async () => {
  const calls = [];
  const interaction = {
    marker: 'original-interaction',
    reply(payload) { calls.push(['reply', this.marker, payload]); return payload; },
    deferReply(payload) { calls.push(['deferReply', this.marker, payload]); return payload; },
    followUp(payload) { calls.push(['followUp', this.marker, payload]); return payload; },
    editReply(payload) { calls.push(['editReply', this.marker, payload]); return payload; },
  };
  const privateInteraction = createEphemeralInteraction(interaction, 64);

  await privateInteraction.reply('first');
  await privateInteraction.deferReply({ flags: 4 });
  await privateInteraction.followUp({ content: 'second' });
  await privateInteraction.editReply({ content: 'edit' });

  assert.deepEqual(calls.map(call => [call[0], call[1], call[2].flags]), [
    ['reply', 'original-interaction', 64],
    ['deferReply', 'original-interaction', 68],
    ['followUp', 'original-interaction', 64],
    ['editReply', 'original-interaction', undefined],
  ]);
});
