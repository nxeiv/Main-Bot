'use strict';

const SUPPORTED_TEXT_SHORTCUTS = new Set([
  'ip',
  'java',
  'java ip',
  'java address',
  'bedrock',
  'bedrock ip',
  'bedrock address',
  'plugins',
  'world download',
  'help',
  'invite',
  'roles',
  'channels',
  'rules',
  'start',
  'stop',
  'rejoin',
  'status',
  'dashboard',
  'ai status',
]);

function parseTextShortcut(content) {
  const text = String(content || '').trim();

  if (!text.startsWith('?')) {
    return null;
  }

  const command = text
    .slice(1)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  if (SUPPORTED_TEXT_SHORTCUTS.has(command)) {
    return command;
  }

  // The channel mention is required, matching the command handler's input.
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
