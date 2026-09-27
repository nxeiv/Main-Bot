'use strict';

const BANISH_TRIGGER = /\bbanish\b/i;
const BANISH_DURATION_MS = 5 * 1000;

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

  const member = message.member;

  if (!member) {
    return { handled: false };
  }

  const userId = message.author.id;
  const state = activeBanishments.get(userId);
  const normalizedMessage = normalizePhrase(message.content);

  if (state) {
    if (normalizedMessage === normalizePhrase(state.escapePhrase)) {
      activeBanishments.delete(userId);

      try {
        if (member.moderatable && member.communicationDisabledUntilTimestamp) {
          await member.timeout(null, 'Banish escape phrase used.');
        }

        await message.reply(
          `✓ <@${userId}> has escaped banishment. Welcome back.`,
        );
      } catch (error) {
        activeBanishments.set(userId, state);
        throw error;
      }

      return {
        handled: true,
        escaped: true,
      };
    }

    const timedOut = await timeoutMember(
      member,
      'Banish timer reset because the user sent another message.',
    );

    if (timedOut) {
      await message.reply(
        `⚠︎ Your banishment timer has been reset to 5 seconds. Say **"${state.escapePhrase}"** after the timeout ends to escape.`,
      );
    }

    return {
      handled: true,
      banished: true,
      timedOut,
    };
  }

  if (!BANISH_TRIGGER.test(message.content)) {
    return { handled: false };
  }

  const escapePhrase = pickEscapePhrase();
  const timedOut = await timeoutMember(
    member,
    'Triggered the Cottage★ banish mechanic.',
  );

  if (!timedOut) {
    await message.reply(
      '✕ I cannot banish you because I do not have permission to timeout this member.',
    );

    return {
      handled: true,
      timedOut: false,
    };
  }

  activeBanishments.set(userId, {
    escapePhrase,
  });

  await message.reply(
    `⚒︎ <@${userId}> has been **banished** for 5 seconds. Say **"${escapePhrase}"** after the timeout ends to escape.`,
  );

  return {
    handled: true,
    banished: true,
    timedOut: true,
  };
}

module.exports = {
  handleBanishMessage,
};