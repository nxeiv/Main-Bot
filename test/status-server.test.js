'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createStatusServer } = require('../status-server');

test('status API exposes only the public allowlisted fields and correct CORS origin', async t => {
  const monitor = {
    start() {},
    stop() {},
    getSnapshot() {
      return {
        state: 'online',
        online: true,
        players: 4,
        maxPlayers: 20,
        version: 'Paper test',
        checkedAt: '2026-11-16T00:00:00.000Z',
        host: 'private.example.invalid',
        port: 25565,
        motd: 'private MOTD',
      };
    },
  };
  const api = createStatusServer({
    monitor,
    listenHost: '127.0.0.1',
    listenPort: 0,
    allowedOrigins: ['https://the-cottage.onrender.com'],
  });
  const server = api.start();
  await once(server, 'listening');
  t.after(() => api.stop());

  const address = server.address();
  const response = await fetch('http://127.0.0.1:' + address.port + '/api/status', {
    headers: { Origin: 'https://the-cottage.onrender.com' },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://the-cottage.onrender.com');
  const body = await response.json();
  assert.deepEqual(body, {
    online: true,
    state: 'online',
    players: 4,
    maxPlayers: 20,
    version: 'Paper test',
    checkedAt: '2026-11-16T00:00:00.000Z',
  });
  assert.doesNotMatch(JSON.stringify(body), /private\.example|25565|private MOTD/);
});

test('status API health route is read-only and unsupported methods are rejected', async t => {
  const monitor = {
    start() {},
    stop() {},
    getSnapshot: () => ({ state: 'unknown', online: null }),
  };
  const api = createStatusServer({ monitor, listenHost: '127.0.0.1', listenPort: 0 });
  const server = api.start();
  await once(server, 'listening');
  t.after(() => api.stop());
  const base = 'http://127.0.0.1:' + server.address().port;

  const health = await fetch(base + '/health');
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);

  const post = await fetch(base + '/api/status', { method: 'POST' });
  assert.equal(post.status, 405);
});
