'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStickyMessageManager } = require('../sticky-message-manager');

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cottage-sticky-'));
  const filePath = path.join(directory, 'sticky-messages.json');
  const sent = [];
  const deleted = [];
  const channel = {
    id: 'channel-1',
    client: { user: { id: 'bot-1' } },
    isTextBased: () => true,
    messages: {
      fetch: async id => ({
        id,
        author: { id: 'bot-1' },
        delete: async () => deleted.push(id),
      }),
    },
    send: async payload => {
      sent.push(payload);
      return { id: 'message-' + sent.length };
    },
  };
  return { directory, filePath, channel, sent, deleted };
}

test('sets and persists a sticky message without allowing mention parsing', async () => {
  const f = fixture();
  const manager = createStickyMessageManager({ filePath: f.filePath });
  const result = await manager.setSticky({
    guildId: 'guild-1',
    channel: f.channel,
    content: 'Choose your roles below.',
    actorId: 'admin-1',
  });

  assert.equal(result.messageId, 'message-1');
  assert.deepEqual(f.sent[0], {
    content: 'Choose your roles below.',
    allowedMentions: { parse: [] },
  });
  const saved = JSON.parse(fs.readFileSync(f.filePath, 'utf8'));
  assert.equal(saved['guild-1:channel-1'].content, 'Choose your roles below.');
  fs.rmSync(f.directory, { recursive: true, force: true });
});

test('refreshes the sticky after member messages and ignores bot/webhook messages', async () => {
  const f = fixture();
  const manager = createStickyMessageManager({ filePath: f.filePath });
  await manager.setSticky({ guildId: 'guild-1', channel: f.channel, content: 'Sticky' });

  const base = {
    guildId: 'guild-1',
    channel: f.channel,
    author: { bot: false },
    webhookId: null,
  };
  assert.equal(await manager.handleMemberMessage(base), true);
  assert.deepEqual(f.deleted, ['message-1']);
  assert.equal(f.sent.length, 2);

  assert.equal(await manager.handleMemberMessage({ ...base, author: { bot: true } }), false);
  assert.equal(await manager.handleMemberMessage({ ...base, webhookId: 'webhook-1' }), false);
  assert.equal(f.sent.length, 2);
  fs.rmSync(f.directory, { recursive: true, force: true });
});

test('removes a sticky and rejects empty or oversized content', async () => {
  const f = fixture();
  const manager = createStickyMessageManager({ filePath: f.filePath });
  await assert.rejects(
    manager.setSticky({ guildId: 'guild-1', channel: f.channel, content: ' ' }),
    /cannot be empty/,
  );
  await assert.rejects(
    manager.setSticky({ guildId: 'guild-1', channel: f.channel, content: 'x'.repeat(2001) }),
    /2,000 characters/,
  );

  await manager.setSticky({ guildId: 'guild-1', channel: f.channel, content: 'Sticky' });
  assert.equal(await manager.removeSticky({ guildId: 'guild-1', channel: f.channel }), true);
  assert.equal(manager.getSticky('guild-1', 'channel-1'), null);
  assert.deepEqual(f.deleted, ['message-1']);
  fs.rmSync(f.directory, { recursive: true, force: true });
});

test('loads sticky configurations after a restart', async () => {
  const f = fixture();
  const first = createStickyMessageManager({ filePath: f.filePath });
  await first.setSticky({ guildId: 'guild-1', channel: f.channel, content: 'Persistent' });
  const second = createStickyMessageManager({ filePath: f.filePath });
  assert.equal(second.getSticky('guild-1', 'channel-1').content, 'Persistent');
  fs.rmSync(f.directory, { recursive: true, force: true });
});


test('coalesces quick member messages into one sticky refresh', async () => {
  const f = fixture();
  const manager = createStickyMessageManager({ filePath: f.filePath, refreshDelayMs: 20 });
  await manager.setSticky({ guildId: 'guild-1', channel: f.channel, content: 'Sticky' });
  const message = {
    guildId: 'guild-1',
    channel: f.channel,
    author: { bot: false },
    webhookId: null,
  };

  const first = manager.handleMemberMessage(message);
  const second = manager.handleMemberMessage(message);
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(f.sent.length, 2);
  assert.deepEqual(f.deleted, ['message-1']);
  fs.rmSync(f.directory, { recursive: true, force: true });
});
