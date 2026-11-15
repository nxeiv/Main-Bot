'use strict';

function createAfkNotificationCooldown({
  cooldownMs = 60_000,
  now = Date.now,
} = {}) {
  if (!Number.isFinite(cooldownMs) || cooldownMs < 0) {
    throw new TypeError('cooldownMs must be a non-negative finite number.');
  }

  const notifiedAt = new Map();

  function shouldNotify(userId, channelId) {
    if (!userId || !channelId) return false;

    const timestamp = now();
    const key = `${channelId}:${userId}`;
    const lastNotified = notifiedAt.get(key);

    if (Number.isFinite(lastNotified) && timestamp - lastNotified < cooldownMs) {
      return false;
    }

    notifiedAt.set(key, timestamp);

    // Keep the map bounded during long-running bot sessions.
    for (const [entry, sentAt] of notifiedAt) {
      if (timestamp - sentAt >= cooldownMs) notifiedAt.delete(entry);
    }

    return true;
  }

  function clearUser(userId) {
    if (!userId) return;
    const suffix = `:${userId}`;
    for (const key of notifiedAt.keys()) {
      if (key.endsWith(suffix)) notifiedAt.delete(key);
    }
  }

  return { shouldNotify, clearUser };
}

module.exports = { createAfkNotificationCooldown };
