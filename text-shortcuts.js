'use strict';

function parseTextShortcut(content) {
  const text = String(content || '').trim();

  if (!text.startsWith('?')) {
    return null;
  }

  const command = text
    .slice(1)
    .trim()
    .replace(/\?$/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

  return command || null;
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
