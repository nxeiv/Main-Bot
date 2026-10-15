'use strict';

const fs = require('node:fs');
const path = require('node:path');

function createAfkStore({ filePath, log = () => {} }) {
  if (!filePath) {
    throw new Error('An AFK state file path is required.');
  }

  const resolvedFilePath = path.resolve(filePath);
  const statuses = new Map();

  function save() {
    try {
      fs.writeFileSync(
        resolvedFilePath,
        JSON.stringify(Object.fromEntries(statuses.entries()), null, 2),
        'utf8',
      );
    } catch (error) {
      log('Unable to save user AFK statuses: ' + error.message);
    }
  }

  function load() {
    try {
      if (!fs.existsSync(resolvedFilePath)) {
        return;
      }

      const raw = fs.readFileSync(resolvedFilePath, 'utf8');

      if (!raw.trim()) {
        return;
      }

      const saved = JSON.parse(raw);

      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
        throw new Error('user-afk.json must contain a JSON object.');
      }

      for (const [userId, status] of Object.entries(saved)) {
        if (
          typeof userId === 'string' &&
          status &&
          typeof status === 'object' &&
          typeof status.reason === 'string' &&
          Number.isSafeInteger(status.setAt) &&
          status.setAt > 0
        ) {
          statuses.set(userId, {
            reason: status.reason.slice(0, 200),
            setAt: status.setAt,
          });
        }
      }
    } catch (error) {
      log('Unable to load user AFK statuses: ' + error.message);
    }
  }

  function setUserAfk(userId, reason = 'AFK') {
    if (!userId) {
      throw new Error('A user ID is required to set AFK status.');
    }

    const normalizedReason = String(reason || '').trim() || 'AFK';

    statuses.set(userId, {
      reason: normalizedReason.slice(0, 200),
      setAt: Date.now(),
    });

    save();
  }

  function clearUserAfk(userId) {
    const cleared = statuses.delete(userId);

    if (cleared) {
      save();
    }

    return cleared;
  }

  function getUserAfk(userId) {
    return statuses.get(userId) || null;
  }

  load();

  return {
    clearUserAfk,
    getUserAfk,
    setUserAfk,
  };
}

module.exports = {
  createAfkStore,
};
