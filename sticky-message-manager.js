'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MAX_MESSAGE_LENGTH = 2000;

function createStickyMessageManager({
  filePath,
  log = () => {},
  fsModule = fs,
  refreshDelayMs = 150,
} = {}) {
  if (!filePath) throw new TypeError('Sticky message manager requires a file path.');

  const absolutePath = path.resolve(filePath);
  const queues = new Map();
  const pendingRefreshes = new Map();
  let entries = load();

  function keyFor(guildId, channelId) {
    return String(guildId) + ':' + String(channelId);
  }

  function validate(guildId, channelId, content) {
    const text = String(content || '').trim();
    if (!guildId || !channelId) throw new TypeError('A guild and channel are required.');
    if (!text) throw new TypeError('Sticky message content cannot be empty.');
    if (text.length > MAX_MESSAGE_LENGTH) {
      throw new RangeError('Sticky message content cannot exceed 2,000 characters.');
    }
    return text;
  }

  function load() {
    try {
      if (!fsModule.existsSync(absolutePath)) return {};
      const parsed = JSON.parse(fsModule.readFileSync(absolutePath, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return Object.fromEntries(Object.entries(parsed).filter(([key, value]) => (
        typeof key === 'string' &&
        value &&
        typeof value.guildId === 'string' &&
        typeof value.channelId === 'string' &&
        typeof value.content === 'string'
      )));
    } catch (error) {
      log('Unable to load sticky messages: ' + String(error?.message || error));
      return {};
    }
  }

  function save() {
    fsModule.mkdirSync(path.dirname(absolutePath), { recursive: true });
    const temporaryPath = absolutePath + '.tmp';
    fsModule.writeFileSync(temporaryPath, JSON.stringify(entries, null, 2), 'utf8');
    fsModule.renameSync(temporaryPath, absolutePath);
  }

  function cancelPendingRefresh(key) {
    const pending = pendingRefreshes.get(key);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRefreshes.delete(key);
    for (const resolve of pending.resolvers) resolve(false);
  }

  async function deletePrevious(channel, entry) {
    if (!entry?.messageId) return;
    try {
      const previous = await channel.messages.fetch(entry.messageId);
      if (previous && previous.author?.id === channel.client?.user?.id) {
        await previous.delete();
      }
    } catch (error) {
      if (error?.code !== 10008 && error?.status !== 404) {
        log('Unable to remove previous sticky in ' + channel.id + ': ' + String(error?.message || error));
      }
    }
  }

  async function post(channel, entry) {
    await deletePrevious(channel, entry);
    const sent = await channel.send({
      content: entry.content,
      allowedMentions: { parse: [] },
    });
    entry.messageId = sent.id;
    save();
    return sent;
  }

  async function setSticky({ guildId, channel, content, actorId } = {}) {
    const text = validate(guildId, channel?.id, content);
    if (!channel?.isTextBased?.() || typeof channel.send !== 'function') {
      throw new TypeError('The selected channel cannot receive messages.');
    }

    const key = keyFor(guildId, channel.id);
    cancelPendingRefresh(key);
    const previous = entries[key];
    const entry = {
      guildId: String(guildId),
      channelId: String(channel.id),
      content: text,
      messageId: previous?.messageId || null,
      updatedAt: new Date().toISOString(),
      updatedBy: actorId ? String(actorId) : null,
    };

    entries[key] = entry;
    try {
      await post(channel, entry);
    } catch (error) {
      if (previous) entries[key] = previous;
      else delete entries[key];
      throw error;
    }
    log('Sticky message configured for ' + guildId + '/' + channel.id + '.');
    return { ...entry };
  }

  async function removeSticky({ guildId, channel } = {}) {
    if (!guildId || !channel?.id) throw new TypeError('A guild and channel are required.');
    const key = keyFor(guildId, channel.id);
    cancelPendingRefresh(key);
    const previous = entries[key];
    if (!previous) return false;

    delete entries[key];
    save();
    await deletePrevious(channel, previous);
    log('Sticky message removed for ' + guildId + '/' + channel.id + '.');
    return true;
  }

  function getSticky(guildId, channelId) {
    const entry = entries[keyFor(guildId, channelId)];
    return entry ? { ...entry } : null;
  }

  function listGuildStickies(guildId) {
    return Object.values(entries)
      .filter(entry => entry.guildId === String(guildId))
      .map(entry => ({ ...entry }));
  }

  function handleMemberMessage(message) {
    if (!message || message.author?.bot || message.webhookId || !message.guildId || !message.channel) {
      return Promise.resolve(false);
    }

    const key = keyFor(message.guildId, message.channel.id);
    if (!entries[key]) return Promise.resolve(false);

    return new Promise(resolve => {
      let pending = pendingRefreshes.get(key);
      if (pending) {
        clearTimeout(pending.timer);
        pending.resolvers.push(resolve);
      } else {
        pending = { resolvers: [resolve], timer: null };
        pendingRefreshes.set(key, pending);
      }

      pending.timer = setTimeout(async () => {
        if (pendingRefreshes.get(key) !== pending) return;
        pendingRefreshes.delete(key);

        const previousTask = queues.get(key) || Promise.resolve();
        const task = previousTask.catch(() => {}).then(async () => {
          const current = entries[key];
          if (!current) return false;
          try {
            await post(message.channel, current);
            return true;
          } catch (error) {
            log('Unable to refresh sticky in ' + message.channel.id + ': ' + String(error?.message || error));
            return false;
          }
        });

        queues.set(key, task);
        let result = false;
        try {
          result = await task;
        } finally {
          if (queues.get(key) === task) queues.delete(key);
          for (const finish of pending.resolvers) finish(result);
        }
      }, Math.max(0, Number(refreshDelayMs) || 0));
    });
  }

  return {
    setSticky,
    removeSticky,
    getSticky,
    listGuildStickies,
    handleMemberMessage,
  };
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  createStickyMessageManager,
};
