'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { registerMinecraftEventHandlers } = require('../minecraft-event-handlers');

test('Minecraft connection events update health, presence, and notifications', async () => {
  const emitter = new EventEmitter(); const calls = [];
  const runtimeHealth = {};
  registerMinecraftEventHandlers({
    mc: { emitter, getStatus: () => ({ server: 'example' }), chat: message => calls.push(['chat', message]) },
    runtimeHealth, updatePresence: () => calls.push(['presence']),
    buildStatusEmbed: () => ({ setDescription(value) { this.description = value; return this; } }),
    createEmbed: title => ({ title, setDescription(value) { this.description = value; return this; } }),
    Colors: { Green: 'green', Orange: 'orange', Red: 'red', Blurple: 'blurple' },
    shorten: String, formatDelay: value => `${value}ms`, log: (...args) => calls.push(['log', ...args]),
    notifyChannel: value => calls.push(['notify', value]), config: { bot: { username: 'Server' } },
    shouldWelcomePlayer: () => false,
  });
  emitter.emit('connected', { version: '1.21.11' });
  assert.ok(runtimeHealth.lastMinecraftConnectedAt);
  assert.equal(runtimeHealth.lastMinecraftDisconnectReason, null);
  assert.ok(calls.some(call => call[0] === 'presence'));
  assert.ok(calls.some(call => call[0] === 'notify'));
});

test('Minecraft disconnect and reconnect events update diagnostics', () => {
  const emitter = new EventEmitter(); const calls = []; const runtimeHealth = {};
  registerMinecraftEventHandlers({
    mc: { emitter }, runtimeHealth, updatePresence: () => calls.push('presence'),
    buildStatusEmbed: () => ({ setDescription() { return this; } }),
    createEmbed: () => ({ setDescription() { return this; } }),
    Colors: { Green: 'green', Orange: 'orange', Red: 'red', Blurple: 'blurple' },
    shorten: String, formatDelay: value => `${value}ms`, log: (...args) => calls.push(args),
    notifyChannel: () => {}, config: { bot: { username: 'Server' } }, shouldWelcomePlayer: () => false,
  });
  emitter.emit('disconnected', 'network');
  assert.ok(runtimeHealth.lastMinecraftDisconnectedAt);
  assert.equal(runtimeHealth.lastMinecraftDisconnectReason, 'network');
  emitter.emit('reconnecting', { attempt: 2, delayMs: 1000 });
  assert.ok(calls.length >= 2);
});
