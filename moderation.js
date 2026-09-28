'use strict';

const fs = require('node:fs');
const path = require('node:path');

const STATE_FILE = path.join(__dirname, 'moderation-state.json');
const MAX_EVENTS = 500;

let state = {
  warnings: {},
  events: [],
};

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    state = {
      warnings: parsed.warnings && typeof parsed.warnings === 'object' ? parsed.warnings : {},
      events: Array.isArray(parsed.events) ? parsed.events.slice(-MAX_EVENTS) : [],
    };
  } catch (error) {
    console.error('[Moderation] Unable to load state:', error?.message || error);
  }
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.error('[Moderation] Unable to save state:', error?.message || error);
  }
}

function recordEvent(event) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    ...event,
  };

  state.events.push(entry);
  if (state.events.length > MAX_EVENTS) {
    state.events = state.events.slice(-MAX_EVENTS);
  }
  saveState();
  return entry;
}

function recordWarning({ targetId, targetTag, moderatorId, moderatorTag, reason }) {
  const list = Array.isArray(state.warnings[targetId])
    ? state.warnings[targetId]
    : [];

  const warning = {
    id: `warn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    targetId,
    targetTag,
    moderatorId,
    moderatorTag,
    reason: String(reason || 'No reason provided').trim().slice(0, 500),
  };

  list.push(warning);
  state.warnings[targetId] = list;

  recordEvent({
    type: 'warning',
    ...warning,
  });

  return warning;
}

function getWarnings(userId) {
  return Array.isArray(state.warnings[userId])
    ? [...state.warnings[userId]].sort((a, b) => a.timestamp - b.timestamp)
    : [];
}

function getEvents(userId, limit = 20) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  return state.events
    .filter(event => !userId || event.targetId === userId)
    .slice(-safeLimit)
    .reverse();
}

function clearWarnings(userId) {
  const count = getWarnings(userId).length;
  delete state.warnings[userId];
  if (count > 0) {
    recordEvent({
      type: 'warning_clear',
      targetId: userId,
    });
  } else {
    saveState();
  }
  return count;
}

function formatDuration(durationMs) {
  const seconds = Math.max(1, Math.round(Number(durationMs || 0) / 1000));
  if (seconds % 86400 === 0) return `${seconds / 86400}d`;
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

loadState();

module.exports = {
  formatDuration,
  recordEvent,
  recordWarning,
  getWarnings,
  getEvents,
  clearWarnings,
};