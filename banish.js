'use strict';

const config = require('./config');

const BANISH_DURATION_MS = 5 * 1000;
const BANISH_COMMAND = /^banish\?$/i;

const ESCAPE_PHRASES = [
  'I am no longer banished.',
  'The Cottage★ welcomes me back.',
  'I have returned from banishment.',
  'I respectfully request release.',
  'I am ready to return to the Cottage★.',
];

const activeBanishments = new Map();

function normalizePhrase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[“”"']/g, '')
    .replace(/[!?.,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickEscapePhrase() {
  return ESCAPE_PHRASES[Math.floor(Math.random() * ESCAPE_PHRASES.length)];
}

function isAdmin(userId) {
  return config.adminUserIds?.includes(userId);
}

async function timeoutMember(member, reason) {
  if (!member?.moderatable) {
    return false;
  }

  try {
    await member.timeout(BANISH_DURATION_MS, reason);
    return true;
  } catch {
    return false;
  }
}

async function handleBanishMessage(message) {
  if (!message.guild || message.author.bot) {
    return { handled: false };
  }

  const userId = message.author.id;
  const state = activeBanishments.get(userId);
  const normalizedMessage = normalizePhrase(message.content);

  if (state) {
    if (normalizedMessage === normalizePhrase(state.escapePhrase)) {
      activeBanishments.delete(userId);

      try {
        if (message.member?.moderatable && message.member.communicationDisabledUntilTimestamp) {
          await message.member.timeout(null, 'Banish escape phrase used.');
        }

        await message.reply(`✓ <@${userId}> has escaped banishment. Welcome back.`);
      } catch (error) {
        activeBanishments.set(userId, state);
        throw error;
      }

      return { handled: true, escaped: true };
    }

    const timedOut = await timeoutMember(
      message.member,
      'Banish timer reset because the user sent another message.',
    );

    if (timedOut) {
      await message.reply(
        `⚠︎ Your banishment timer has been reset to 5 seconds. Say **"${state.escapePhrase}"** after the timeout ends to escape.`,
      );
    }

    return { handled: true, banished: true, timedOut };
  }

  if (!BANISH_COMMAND.test(message.content)) {
    return { handled: false };
  }

  if (!isAdmin(message.author.id)) {
    return { handled: true, authorized: false };
  }

  if (!message.reference?.messageId) {
    await message.reply(
      'ⓘ Reply to the member\'s message with **banish?** to banish them.',
    );
    return { handled: true, authorized: true, banished: false };
  }

  const targetMessage = await message.channel.messages.fetch(
    message.reference.messageId,
  ).catch(() => null);

  if (
    !targetMessage ||
    targetMessage.author.bot ||
    targetMessage.author.id === message.author.id
  ) {
    await message.reply('ⓘ That reply does not target a banishable member.');
    return { handled: true, authorized: true, banished: false };
  }

  const targetMember = await message.guild.members
    .fetch(targetMessage.author.id)
    .catch(() => null);

  if (!targetMember) {
    await message.reply('✕ I could not find that member in the server.');
    return { handled: true, authorized: true, banished: false };
  }

  const escapePhrase = pickEscapePhrase();
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

  activeBanishments.set(targetMember.id, {
    escapePhrase,
    moderatorId: message.author.id,
  });

  await message.reply(
    `⚒︎ <@${targetMember.id}> has been **banished** for 5 seconds. After the timeout ends, they must say **"${escapePhrase}"** to escape.`,
  );

  return {
    handled: true,
    authorized: true,
    banished: true,
    targetUserId: targetMember.id,
  };
}

module.exports = {
  handleBanishMessage,
};