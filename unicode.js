'use strict';

/*
 * The Cottage★ Unicode Theme
 *
 * Keep the bot's visible interface consistent with Unicode symbols rather
 * than pictographic emoji. This is a presentation layer: it does not alter
 * mentions, URLs, commands, or Discord syntax.
 */

const SYMBOL_REPLACEMENTS = new Map([
  ['🛠️', '⚒︎'],
  ['🛠', '⚒︎'],
  ['⛏️', '⛏︎'],
  ['⛏', '⛏︎'],
  ['❌', '✕'],
  ['✅', '✓'],
  ['⚠️', '⚠︎'],
  ['⚠', '⚠︎'],
  ['ℹ️', 'ⓘ'],
  ['ℹ', 'ⓘ'],
  ['🧹', '⌫'],
  ['🏡', '⌂'],
  ['💙', '♥︎'],
]);

function applyUnicodeTheme(text) {
  return String(text ?? '')
    .replace(/🛠️|🛠|⛏️|⛏|❌|✅|⚠️|⚠|ℹ️|ℹ|🧹|🏡|💙/gu, match => (
      SYMBOL_REPLACEMENTS.get(match) || match
    ))
    // Convert any remaining default emoji presentation into a neutral
    // Unicode bullet, while keeping ordinary text symbols such as ★ and ✓.
    .replace(/\p{Emoji_Presentation}/gu, '•')
    .replace(/\p{Emoji_Modifier}/gu, '')
    .replace(/\uFE0F|\u200D/gu, '');
}

module.exports = {
  applyUnicodeTheme,
};
