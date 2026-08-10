'use strict';

// Copyright (C) 2026 DiscoMine Contributors
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.


const mineflayer = require('mineflayer');
const EventEmitter = require('events');
const config = require('./config');

const state = {
  bot: null,
  connected: false,
  startTime: null,
  reconnectAttempts: 0,
  isConnecting: false,
  isReconnecting: false,
  manualStop: false,
  playerCount: 0,
  intervals: [],
  reconnectTimer: null,
  connectionTimer: null,
};

const emitter = new EventEmitter();

function clearIntervals() {
  state.intervals.forEach(id => clearInterval(id));
  state.intervals = [];
}

function addInterval(fn, ms) {
  const id = setInterval(fn, ms);
  state.intervals.push(id);
  return id;
}

function clearTimers() {
  if (state.reconnectTimer) { clearTimeout(state.reconnectTimer); state.reconnectTimer = null; }
  if (state.connectionTimer) { clearTimeout(state.connectionTimer); state.connectionTimer = null; }
}

function log(tag, msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] [${tag}] ${msg}`);
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function formatDelay(delayMs) {
  const seconds = Math.round(delayMs / 1000);
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `${seconds} seconds`;
}

function logStatus() {
  const status = getStatus();
  if (!status.connected) return;

  const players = status.playerCount === 1 ? '1 other player' : `${status.playerCount} other players`;
  log('Status', `Online for ${formatDuration(status.uptime)}. Detected ${players}. Anti-AFK is active.`);
}

function start() {
  if (state.connected || state.isConnecting || state.isReconnecting) {
    log('Bot', 'The bot is already running or connecting.');
    return;
  }
  state.manualStop = false;
  state.reconnectAttempts = 0;
  createBot();
}

function stop() {
  state.manualStop = true;
  clearTimers();
  clearIntervals();
  if (state.bot) {
    try {
      state.bot.removeAllListeners();
      state.bot.end();
    } catch (e) {
      log('Bot', `Unable to stop the bot: ${e.message}`);
    }
    state.bot = null;
  }
  state.connected = false;
  state.isConnecting = false;
  state.isReconnecting = false;
  state.playerCount = 0;
  state.startTime = null;
  log('Bot', 'Bot stopped.');
  emitter.emit('stopped');
}

function getStatus() {
  return {
    connected: state.connected,
    connecting: state.isConnecting,
    reconnecting: state.isReconnecting,
    playerCount: state.playerCount,
    uptime: state.connected && state.startTime
      ? Math.floor((Date.now() - state.startTime) / 1000)
      : 0,
    reconnectAttempts: state.reconnectAttempts,
    server: `${config.server.ip}:${config.server.port}`,
  };
}

function createBot() {
  if (state.isConnecting || state.isReconnecting) return;
  state.isConnecting = true;

  if (state.bot) {
    clearIntervals();
    try { state.bot.removeAllListeners(); state.bot.end(); } catch (_) { }
    state.bot = null;
  }

  log('Bot', `Connecting to ${config.server.ip}:${config.server.port}...`);
  emitter.emit('connecting');

  let bot;
  try {
    const mcVersion = config.server.version || false;
    if (mcVersion) {
      log('Bot', `Using Minecraft version ${mcVersion}.`);
    } else {
      log('Bot', 'No Minecraft version specified; detecting it automatically.');
    }

    bot = mineflayer.createBot({
      username: config.bot.username,
      password: config.bot.password || undefined,
      auth: config.bot.auth,
      host: config.server.ip,
      port: config.server.port,
      version: mcVersion,
      hideErrors: false,
      checkTimeoutInterval: 600000,
    });
  } catch (err) {
    state.isConnecting = false;
    log('Bot', `Failed to start: ${err.message}`);
    rejoinASAP();
    return;
  }

  state.bot = bot;

  clearTimers();
  state.connectionTimer = setTimeout(() => {
    if (!state.connected) {
      state.isConnecting = false;
      log('Bot', 'Connection timed out: no spawn event after 150 seconds.');
      try { bot.removeAllListeners(); bot.end(); } catch (_) { }
      state.bot = null;
      rejoinASAP();
    }
  }, 150_000);

  let spawnHandled = false;

  bot.once('spawn', () => {
    if (spawnHandled) return;
    spawnHandled = true;

    clearTimers();
    state.connected = true;
    state.isConnecting = false;
    state.startTime = Date.now();
    state.reconnectAttempts = 0;
    state.isReconnecting = false;

    log('Bot', `Connected (Minecraft ${bot.version}). Checking for other players.`);
    emitter.emit('connected', { version: bot.version });

    setTimeout(() => checkAndActOnPlayers(bot), 2_000);
  });

  bot.on('kicked', (reason) => {
    const r = typeof reason === 'object' ? JSON.stringify(reason) : reason;
    log('Bot', `Kicked from the server: ${r}`);
    state.connected = false;
    clearIntervals();
    emitter.emit('kicked', r);
  });

  bot.on('end', (reason) => {
    log('Bot', `Disconnected: ${reason || 'unknown reason'}.`);
    state.connected = false;
    state.isConnecting = false;
    state.playerCount = 0;
    clearIntervals();
    emitter.emit('disconnected', reason);

    if (state.manualStop) return;

    log('Bot', 'Connection lost unexpectedly. Scheduling a reconnection.');
    rejoinASAP();
  });

  bot.on('error', (err) => {
    log('Bot', `Network error: ${err.message}`);
  });
}

function startAntiAFK(bot) {
  addInterval(() => {
    if (!state.connected || !bot) return;
    try { bot.swingArm(); } catch (_) { }
  }, 15_000 + Math.random() * 45_000);

  addInterval(() => {
    if (!state.connected || !bot) return;
    try {
      bot.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * Math.PI / 2, true);
    } catch (_) { }
  }, 8_000 + Math.random() * 12_000);

  addInterval(() => {
    if (!state.connected || !bot) return;
    try { bot.setQuickBarSlot(Math.floor(Math.random() * 9)); } catch (_) { }
  }, 30_000 + Math.random() * 60_000);

  addInterval(() => {
    if (!state.connected || !bot || typeof bot.setControlState !== 'function') return;
    try {
      bot.look(Math.random() * Math.PI * 2, 0, true);
      bot.setControlState('forward', true);
      setTimeout(() => {
        if (bot && typeof bot.setControlState === 'function')
          bot.setControlState('forward', false);
      }, 500 + Math.random() * 1_500);
    } catch (_) { }
  }, 120_000 + Math.random() * 240_000);

  addInterval(() => {
    if (!state.connected || !bot || typeof bot.setControlState !== 'function') return;
    if (Math.random() > 0.6) {
      try {
        bot.setControlState('sneak', true);
        setTimeout(() => {
          if (bot && typeof bot.setControlState === 'function')
            bot.setControlState('sneak', false);
        }, 300 + Math.random() * 800);
      } catch (_) { }
    }
  }, 60_000 + Math.random() * 90_000);

  addInterval(() => {
    if (!state.connected || !bot || typeof bot.setControlState !== 'function') return;
    try {
      bot.setControlState('jump', true);
      setTimeout(() => {
        if (bot && typeof bot.setControlState === 'function')
          bot.setControlState('jump', false);
      }, 100);
    } catch (_) { }
  }, 90_000 + Math.random() * 180_000);

  log('Anti-AFK', 'Started. The bot will perform occasional lightweight actions.');
}

function checkAndActOnPlayers(bot) {
  if (!state.connected || !bot) return;

  const count = Object.values(bot.players || {})
    .filter(p => p.username !== config.bot.username)
    .length;
  state.playerCount = count;

  if (count > 0) {
    log('Bot', `Detected ${count} other player${count === 1 ? '' : 's'}. Staying connected.`);
  } else {
    log('Bot', 'No other players are online. Holding the server slot.');
  }

  startAntiAFK(bot);
  logStatus();
  addInterval(logStatus, 300_000);

  let lastPlayerCount = count;
  addInterval(() => {
    if (!state.connected || !bot) return;

    const currentCount = Object.values(bot.players || {})
      .filter(p => p.username !== config.bot.username)
      .length;
    state.playerCount = currentCount;

    if (currentCount === lastPlayerCount) return;
    lastPlayerCount = currentCount;

    if (currentCount > 0) {
      log('Bot', `Player count changed: ${currentCount} other player${currentCount === 1 ? '' : 's'} online. Staying connected.`);
    } else {
      log('Bot', 'All other players have left. Continuing to hold the server slot.');
    }
  }, 5_000);
}

function rejoinASAP() {
  if (state.manualStop) return;
  if (state.isReconnecting) return;

  state.isReconnecting = true;
  state.reconnectAttempts++;

  const exponent = Math.min(state.reconnectAttempts - 1, 16);
  const delay = Math.min(
    config.reconnect.initialDelayMs * 2 ** exponent,
    config.reconnect.maxDelayMs,
  );
  log('Bot', `Retry scheduled in ${formatDelay(delay)} (attempt ${state.reconnectAttempts}).`);
  emitter.emit('reconnecting', { attempt: state.reconnectAttempts, delayMs: delay });

  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null;
    state.isReconnecting = false;
    createBot();
  }, delay);
}

module.exports = { start, stop, getStatus, emitter };
