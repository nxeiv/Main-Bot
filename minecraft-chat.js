'use strict';

const MAX_MINECRAFT_CHAT_LENGTH = 256;

function validateMinecraftChatMessage(value) {
  const text = String(value ?? '')
    .replace(/\r?\n|\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return { ok: false, code: 'empty' };
  }

  // Mineflayer's chat method must never be used as an implicit command API.
  if (text.startsWith('/')) {
    return { ok: false, code: 'command' };
  }

  if (/[\u0000-\u001F\u007F]/u.test(text)) {
    return { ok: false, code: 'control_characters' };
  }

  if (text.length > MAX_MINECRAFT_CHAT_LENGTH) {
    return { ok: false, code: 'too_long' };
  }

  return { ok: true, text };
}

module.exports = {
  MAX_MINECRAFT_CHAT_LENGTH,
  validateMinecraftChatMessage,
};
