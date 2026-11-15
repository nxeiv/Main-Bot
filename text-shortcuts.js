'use strict';

const SUPPORTED_TEXT_SHORTCUTS = new Set([
  'ip', 'java', 'bedrock', 'pl', 'world download',
  'help', 'invite', 'roles', 'channels', 'rules',
  'start', 'stop', 'rejoin', 'status', 'afk',
]);

function parseTextShortcut(content) {
  const text = String(content || '').trim();

  if (!text.startsWith('?')) {
    return null;
  }

  const rawCommand = text
    .slice(1)
    .trim()
    .replace(/\s+/g, ' ');
  const command = rawCommand.toLowerCase();

  if (SUPPORTED_TEXT_SHORTCUTS.has(command)) {
    return command;
  }

  // Normalize only the command name; preserve the user's reason casing.
  if (/^afk(?:\s+.{1,200})?$/i.test(rawCommand)) {
    return `afk${rawCommand.slice(3)}`;
  }

  if (/^summarize <#\d+>$/.test(command)) {
    return command;
  }

  return null;
}

function normalizeIpChoice(content) {
  const choice = String(content || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  if (choice === 'java' || choice === 'java edition') {
    return 'java';
  }

  if (choice === 'bedrock' || choice === 'bedrock edition') {
    return 'bedrock';
  }

  return null;
}

module.exports = {
  parseTextShortcut,
  normalizeIpChoice,
};
