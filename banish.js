'use strict';

const fs = require('node:fs');
const path = require('node:path');

const config = require('./config');
const moderation = require('./moderation');

const STATE_FILE = path.join(__dirname, config.banish.persistFile);

let activeBanishments = new Map();

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') return;

    const now = Date.now();
    activeBanishments = new Map(
      Object.entries(parsed).filter(([, state]) => (
        state &&
        Number.isFinite(state.startedAt) &&
        now - state.startedAt <= config.banish.staleAfterMs &&
        typeof state.escapePhrase === 'string'
      )),
    );
  } catch (error) {
    console.error('[Banish] Unable to load state:', error?.message || error);
  }
}

function saveState() {
  try {
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify(Object.fromEntries(activeBanishments), null, 2),
      'utf8',
    );
  } catch (error) {
    console.error('[Banish] Unable to save state:', error?.message || error);
  }
}

function normalizePhrase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[“”"']/g, '')
    .replace(/[!?.,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAdmin(userId, member = null) {
  if (config.adminUserIds?.includes(userId)) {
    return true;
  }

  return Boolean(
    member?.roles?.cache?.some(role =>
      config.adminRoleIds?.includes(role.id),
    ),
  );
}

async function logModerationEvent(client, description, color = 0x8f8f8f) {
  const channelId = config.discord.moderationLogChannelId;
  if (!channelId || !client) return;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) return;

    await channel.send({
      embeds: [{
        color,
        description,
        footer: { text: 'The Cottage★ Moderation' },
        timestamp: new Date().toISOString(),
      }],
    });
  } catch (error) {
    console.error('[Banish] Unable to send moderation log:', error?.message || error);
  }
}

async function timeoutMember(member, reason) {
  if (!member?.moderatable) return false;

  try {
    await member.timeout(config.banish.durationMs, reason);
    return true;
  } catch (error) {
    console.error('[Banish] Timeout failed:', error?.message || error);
    return false;
  }
}

function setActiveBanishment(userId, moderatorId) {
  const state = {
    moderatorId,
    startedAt: Date.now(),
    escapePhrase: config.banish.escapePhrase,
  };

  activeBanishments.set(userId, state);
  saveState();
  return state;
}

function clearActiveBanishment(userId) {
  const removed = activeBanishments.delete(userId);
  if (removed) saveState();
  return removed;
}

function getActiveBanishments() {
  return [...activeBanishments.entries()].map(([userId, state]) => ({
    userId,
    ...state,
  }));
}

async function handleBanishMessage(message) {
  if (!config.banish.enabled || !message.guild || message.author.bot) {
    return { handled: false };
  }

  const userId = message.author.id;
  const state = activeBanishments.get(userId);
  const normalizedMessage = normalizePhrase(message.content);

  if (state) {
    if (normalizedMessage === normalizePhrase(state.escapePhrase)) {
      clearActiveBanishment(userId);

      try {
        if (message.member?.moderatable && message.member.communicationDisabledUntilTimestamp) {
          await message.member.timeout(null, 'Banish escape phrase used.');
        }

        moderation.recordEvent({
          type: 'banish_escape',
          targetId: userId,
          targetTag: message.author.tag,
          moderatorId: state.moderatorId,
          reason: 'Escape phrase used.',
        });

        await message.reply(
          `✓ <@${userId}> has escaped banishment. Welcome back.`,
        );

        await logModerationEvent(
          message.client,
          `✓ <@${userId}> escaped banishment using the configured release phrase.`,
          0x57f287,
        );
      } catch (error) {
        activeBanishments.set(userId, state);
        saveState();
        throw error;
      }

      return { handled: true, escaped: true };
    }

    const timedOut = await timeoutMember(
      message.member,
      'Banish timer reset because the user sent another message.',
    );

    if (timedOut) {
      moderation.recordEvent({
        type: 'banish_reset',
        targetId: userId,
        targetTag: message.author.tag,
        moderatorId: state.moderatorId,
        reason: 'User sent another message after the banishment timeout.',
      });

      await message.reply(
        `⚠︎ Your banishment timer has been reset to ${moderation.formatDuration(config.banish.durationMs)}. Say **"${state.escapePhrase}"** after the timeout ends to escape.`,
      );
    }

    return { handled: true, banished: true, timedOut };
  }

  const command = String(config.banish.command || 'banish?').trim().toLowerCase();
  if (message.content.trim().toLowerCase() !== command) {
    return { handled: false };
  }

  if (!isAdmin(message.author.id, message.member)) {
    return { handled: true, authorized: false };
  }

  if (!message.reference?.messageId) {
    await message.reply(
      `ⓘ Reply to the member's message with **${config.banish.command}** to banish them.`,
    );
    return { handled: true, authorized: true, banished: false };
  }

  const targetMessage = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);

  if (!targetMessage || targetMessage.author.bot || targetMessage.author.id === message.author.id) {
    await message.reply('ⓘ That reply does not target a banishable member.');
    return { handled: true, authorized: true, banished: false };
  }

  const targetMember = await message.guild.members.fetch(targetMessage.author.id).catch(() => null);

  if (!targetMember) {
    await message.reply('✕ I could not find that member in the server.');
    return { handled: true, authorized: true, banished: false };
  }

  const timedOut = await timeoutMember(
    targetMember,
    `Banish command issued by ${message.author.tag}.`,
  );

  if (!timedOut) {
    await message.reply(
      `✕ I could not banish <@${targetMember.id}>. Check my **Timeout Members** permission and role hierarchy.`,
    );
    return { handled: true, authorized: true, banished: false };
  }

  const stateCreated = setActiveBanishment(targetMember.id, message.author.id);

  moderation.recordEvent({
    type: 'banish',
    targetId: targetMember.id,
    targetTag: targetMember.user.tag,
    moderatorId: message.author.id,
    moderatorTag: message.author.tag,
    reason: 'Banish command used as a reply to the target message.',
    durationMs: config.banish.durationMs,
    sourceMessageId: targetMessage.id,
  });

  await message.reply(
    `⚒︎ <@${targetMember.id}> has been **banished** for ${moderation.formatDuration(config.banish.durationMs)}. After the timeout ends, they must say **"${stateCreated.escapePhrase}"** to escape.`,
  );

  await logModerationEvent(
    message.client,
    `⚒︎ <@${targetMember.id}> was banished by <@${message.author.id}> for ${moderation.formatDuration(config.banish.durationMs)}.`,
    0xed4245,
  );

  return {
    handled: true,
    authorized: true,
    banished: true,
    targetUserId: targetMember.id,
  };
}

loadState();

module.exports = {
  handleBanishMessage,
  getActiveBanishments,
  clearActiveBanishment,
};