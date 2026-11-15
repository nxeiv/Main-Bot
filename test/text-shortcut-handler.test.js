'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createTextShortcutHandler } = require('../text-shortcut-handler');

function harness(overrides = {}) {
  const calls = [];
  const pendingIpChoices = new Map();
  const dependencies = {
    SERVER_INFO: {
      javaAddress: 'java.example:25565',
      bedrockAddress: 'bedrock.example:19132',
    },
    pendingIpChoices,
    setUserAfk: (id, reason) => calls.push(['setAfk', id, reason]),
    getUserAfk: () => ({ reason: 'Study', setAt: 1000 }),
    ai: {
      getInstantAnswer: key => key === 'plugins' ? 'Plugin list' : null,
    },
    hasFeatureAccess: () => true,
    log: (...args) => calls.push(['log', ...args]),
    mc: { rejoin: () => ({ scheduled: true }) },
    REJOIN_DELAY_MS: 30000,
    buildRejoinComponents: () => [],
    executeAdministrativeAction: async action =>
      action === 'start' ? 'started' : 'stopped',
    buildStatusEmbed: () => 'status-embed',
    buildStatusComponents: () => 'status-components',
    summary: { handleMessageCommand: async () => calls.push(['summary']) },
    client: {
      channels: {
        fetch: async () => ({ type: 0, isTextBased: () => true }),
      },
    },
    ChannelType: { GuildText: 0, GuildAnnouncement: 5 },
    ...overrides,
  };
  const handler = createTextShortcutHandler(dependencies);
  const message = {
    guild: { id: 'guild' },
    channel: { id: 'channel' },
    author: { id: '123456789012345678', tag: 'user' },
    member: {},
    reply: async value => {
      calls.push(['reply', value]);
      return { id: 'prompt' };
    },
  };
  return { handler, message, calls, pendingIpChoices };
}

test('IP shortcut asks for platform, mentions its requester, and stores a scoped prompt', async () => {
  const h = harness();
  await h.handler({ message: h.message, shortcut: 'ip' });

  assert.equal(h.pendingIpChoices.size, 1);
  assert.equal([...h.pendingIpChoices.values()][0].promptMessageId, 'prompt');
  assert.equal(
    h.calls[0][1].content,
    '<@123456789012345678> Java or Bedrock?\nReply to this message with Java or Bedrock.',
  );
  assert.deepEqual(h.calls[0][1].allowedMentions.users, ['123456789012345678']);
});

test('Java and Bedrock shortcuts return configured addresses and mention the requester', async () => {
  const h = harness();
  await h.handler({ message: h.message, shortcut: 'java' });
  await h.handler({ message: h.message, shortcut: 'bedrock' });

  assert.match(h.calls[0][1].content, /java\.example/);
  assert.match(h.calls[1][1].content, /bedrock\.example/);
  assert.match(h.calls[0][1].content, /^<@123456789012345678>/);
  assert.match(h.calls[1][1].content, /^<@123456789012345678>/);
});

test('AFK and plugin shortcuts use their injected services and mention the requester', async () => {
  const h = harness();
  await h.handler({ message: h.message, shortcut: 'afk Study' });
  await h.handler({ message: h.message, shortcut: 'pl' });

  assert.ok(h.calls.some(call =>
    call[0] === 'setAfk' &&
    call[1] === '123456789012345678' &&
    call[2] === 'Study'
  ));
  assert.ok(h.calls.some(call =>
    call[0] === 'reply' &&
    call[1].content === '<@123456789012345678> Plugin list'
  ));
  assert.ok(h.calls.some(call =>
    call[0] === 'reply' &&
    /You are now AFK/.test(call[1].content) &&
    call[1].content.startsWith('<@123456789012345678>')
  ));
});

test('unknown shortcut remains handled with deterministic help guidance and a requester mention', async () => {
  const h = harness();
  await h.handler({ message: h.message, shortcut: 'not-real' });

  assert.match(h.calls[0][1].content, /Try/);
  assert.equal(h.calls[0][1].content.startsWith('<@123456789012345678>'), true);
});
