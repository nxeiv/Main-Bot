'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REMINDERS_FILE = path.join(__dirname, 'reminders.json');
const MAX_REMINDERS_PER_USER = 25;
const MAX_MESSAGE_LENGTH = 500;
const MAX_DELAY_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_TIMEOUT_MS = 2_147_483_647;
const TIMEOUT_BUFFER_MS = 1_000;

const reminders = new Map();
const timers = new Map();

let client = null;
let sequence = 0;

function log(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log('[' + timestamp + '] [Reminders] ' + message);
}

function normalizeReminderMessage(message) {
  return String(message || '').replace(/\s+/g, ' ').trim().slice(0, MAX_MESSAGE_LENGTH);
}

function parseDuration(input) {
  const raw = String(input || '').trim().toLowerCase();

  if (!raw) {
    throw new Error('Please provide a duration such as 30m, 2h, or 1d.');
  }

  const normalized = raw.replace(/\s+/g, '');
  const pattern = /(\d+)(s|m|h|d|w)/g;
  let totalMs = 0;
  let consumed = 0;
  let match;

  while ((match = pattern.exec(normalized)) !== null) {
    if (match.index !== consumed) {
      throw new Error('Invalid duration. Use values such as 30m, 2h, 1d, or 1h30m.');
    }

    const amount = Number(match[1]);
    const unit = match[2];

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error('Duration values must be positive whole numbers.');
    }

    const multiplier = {
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
      w: 604_800_000,
    }[unit];

    totalMs += amount * multiplier;

    if (!Number.isSafeInteger(totalMs) || totalMs > MAX_DELAY_MS) {
      throw new Error('Reminders can be scheduled up to 365 days ahead.');
    }

    consumed = pattern.lastIndex;
  }

  if (consumed !== normalized.length || totalMs <= 0) {
    throw new Error('Invalid duration. Use values such as 30m, 2h, 1d, or 1h30m.');
  }

  return totalMs;
}

function getUserReminders(userId) {
  return [...reminders.values()]
    .filter(reminder => reminder.userId === userId)
    .sort((a, b) => a.executeAt - b.executeAt);
}

function saveReminders() {
  try {
    const data = [...reminders.values()].map(reminder => ({
      id: reminder.id,
      userId: reminder.userId,
      userTag: reminder.userTag,
      guildId: reminder.guildId,
      channelId: reminder.channelId,
      message: reminder.message,
      executeAt: reminder.executeAt,
      createdAt: reminder.createdAt,
    }));

    fs.writeFileSync(
      REMINDERS_FILE,
      JSON.stringify(data, null, 2),
      'utf8',
    );
  } catch (error) {
    log('Unable to save reminders: ' + error.message);
  }
}

function loadReminders() {
  try {
    if (!fs.existsSync(REMINDERS_FILE)) {
      return;
    }

    const raw = fs.readFileSync(REMINDERS_FILE, 'utf8');

    if (!raw.trim()) {
      return;
    }

    const saved = JSON.parse(raw);

    if (!Array.isArray(saved)) {
      throw new Error('reminders.json must contain a JSON array.');
    }

    for (const reminder of saved) {
      if (
        !reminder ||
        typeof reminder.id !== 'string' ||
        typeof reminder.userId !== 'string' ||
        typeof reminder.message !== 'string' ||
        !Number.isSafeInteger(reminder.executeAt) ||
        reminder.executeAt <= 0
      ) {
        continue;
      }

      reminders.set(reminder.id, {
        id: reminder.id,
        userId: reminder.userId,
        userTag: typeof reminder.userTag === 'string' ? reminder.userTag : 'Unknown User',
        guildId: typeof reminder.guildId === 'string' ? reminder.guildId : null,
        channelId: typeof reminder.channelId === 'string' ? reminder.channelId : null,
        message: normalizeReminderMessage(reminder.message),
        executeAt: reminder.executeAt,
        createdAt: Number.isSafeInteger(reminder.createdAt)
          ? reminder.createdAt
          : Date.now(),
      });
    }

    log('Loaded ' + reminders.size + ' reminder(s) from disk.');
  } catch (error) {
    log('Unable to load reminders: ' + error.message);
  }
}

function nextId() {
  sequence += 1;
  return 'r-' + Date.now().toString(36).slice(-6) + '-' + sequence;
}

async function deliverReminder(reminder) {
  if (!client) {
    log('Client is unavailable for reminder ' + reminder.id + '; leaving it scheduled.');
    return false;
  }

  const content =
    '<@' + reminder.userId + '> — reminder: **' + reminder.message + '**';

  try {
    let channel = null;

    if (reminder.channelId) {
      channel = await client.channels.fetch(reminder.channelId).catch(() => null);
    }

    if (channel?.isTextBased()) {
      await channel.send({
        content,
        allowedMentions: {
          users: [reminder.userId],
        },
      });

      return true;
    }

    const user = await client.users.fetch(reminder.userId).catch(() => null);

    if (user) {
      await user.send({
        content: 'Reminder: **' + reminder.message + '**',
      });

      return true;
    }

    throw new Error('The original channel and user could not be reached.');
  } catch (error) {
    log('Unable to deliver reminder ' + reminder.id + ': ' + error.message);
    return false;
  }
}

function clearTimer(reminderId) {
  const timer = timers.get(reminderId);

  if (timer) {
    clearTimeout(timer);
    timers.delete(reminderId);
  }
}

function scheduleReminder(reminder) {
  clearTimer(reminder.id);

  const remainingMs = reminder.executeAt - Date.now();

  if (remainingMs <= 0) {
    void (async () => {
      const delivered = await deliverReminder(reminder);

      reminders.delete(reminder.id);
      clearTimer(reminder.id);
      saveReminders();

      if (delivered) {
        log('Delivered expired reminder ' + reminder.id + '.');
      }
    })();

    return;
  }

  const delay = Math.min(
    remainingMs,
    MAX_TIMEOUT_MS - TIMEOUT_BUFFER_MS,
  );

  const timer = setTimeout(async () => {
    timers.delete(reminder.id);

    if (Date.now() < reminder.executeAt) {
      scheduleReminder(reminder);
      return;
    }

    const delivered = await deliverReminder(reminder);

    reminders.delete(reminder.id);
    saveReminders();

    if (delivered) {
      log('Delivered reminder ' + reminder.id + ' to ' + reminder.userTag + '.');
    }
  }, delay);

  timers.set(reminder.id, timer);
}

function initialize(discordClient) {
  client = discordClient;

  for (const reminder of reminders.values()) {
    scheduleReminder(reminder);
  }

  log('Reminder scheduler initialized with ' + reminders.size + ' stored reminder(s).');
}

function createReminder({
  userId,
  userTag,
  guildId,
  channelId,
  durationMs,
  message,
}) {
  if (!userId) {
    throw new Error('A user is required.');
  }

  const userReminders = getUserReminders(userId);

  if (userReminders.length >= MAX_REMINDERS_PER_USER) {
    throw new Error('You can have up to ' + MAX_REMINDERS_PER_USER + ' active reminders.');
  }

  if (!Number.isSafeInteger(durationMs) || durationMs <= 0 || durationMs > MAX_DELAY_MS) {
    throw new Error('The reminder duration is outside the allowed range.');
  }

  const normalizedMessage = normalizeReminderMessage(message);

  if (!normalizedMessage) {
    throw new Error('Please provide something to remind you about.');
  }

  if (String(message || '').trim().length > MAX_MESSAGE_LENGTH) {
    throw new Error('Reminder messages can be at most ' + MAX_MESSAGE_LENGTH + ' characters.');
  }

  const now = Date.now();

  const reminder = {
    id: nextId(),
    userId,
    userTag: String(userTag || 'Unknown User'),
    guildId: guildId || null,
    channelId: channelId || null,
    message: normalizedMessage,
    executeAt: now + durationMs,
    createdAt: now,
  };

  reminders.set(reminder.id, reminder);
  saveReminders();
  scheduleReminder(reminder);

  return reminder;
}

function cancelReminder(userId, reminderId) {
  const reminder = reminders.get(String(reminderId || '').trim());

  if (!reminder) {
    return { ok: false, reason: 'not_found' };
  }

  if (reminder.userId !== userId) {
    return { ok: false, reason: 'not_owner' };
  }

  clearTimer(reminder.id);
  reminders.delete(reminder.id);
  saveReminders();

  return {
    ok: true,
    reminder,
  };
}

loadReminders();

module.exports = {
  MAX_MESSAGE_LENGTH,
  MAX_REMINDERS_PER_USER,
  cancelReminder,
  createReminder,
  getUserReminders,
  initialize,
  parseDuration,
};
