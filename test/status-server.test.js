'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyStatusCors,
  getAllowedStatusOrigins,
  getPublicMinecraftStatus,
} = require('../status-server');

test('public Minecraft status exposes normalized public fields', () => {
  const result = getPublicMinecraftStatus({
    getStatus: () => ({
      connected: true,
      connecting: false,
      reconnecting: false,
      playerCount: 4,
      uptime: 120,
      reconnectAttempts: 2,
      privateAddress: 'must-not-leak',
    }),
  });

  assert.deepEqual({
    online: result.online,
    state: result.state,
    players: result.players,
    uptime: result.uptime,
    reconnectAttempts: result.reconnectAttempts,
  }, {
    online: true,
    state: 'online',
    players: 4,
    uptime: 120,
    reconnectAttempts: 2,
  });
  assert.equal('privateAddress' in result, false);
  assert.ok(Number.isFinite(Date.parse(result.checkedAt)));
});

test('unknown Minecraft status values safely fall back to public defaults', () => {
  const result = getPublicMinecraftStatus({
    getStatus: () => ({
      connected: false,
      connecting: false,
      reconnecting: true,
      playerCount: 'unknown',
      uptime: null,
      reconnectAttempts: NaN,
    }),
  });

  assert.equal(result.state, 'reconnecting');
  assert.equal(result.online, false);
  assert.equal(result.players, 0);
  assert.equal(result.uptime, 0);
  assert.equal(result.reconnectAttempts, 0);
});

test('allowed status origins are parsed and trimmed', () => {
  assert.deepEqual(
    getAllowedStatusOrigins({
      STATUS_ALLOWED_ORIGINS: ' https://one.example,https://two.example ',
    }),
    ['https://one.example', 'https://two.example'],
  );
  assert.deepEqual(getAllowedStatusOrigins({}), ['*']);
});

test('CORS only reflects explicitly allowed origins when wildcard is disabled', () => {
  const headers = {};
  const response = { setHeader: (name, value) => { headers[name] = value; } };

  applyStatusCors(
    { headers: { origin: 'https://allowed.example' } },
    response,
    { STATUS_ALLOWED_ORIGINS: 'https://allowed.example' },
  );

  assert.equal(headers['Access-Control-Allow-Origin'], 'https://allowed.example');
  assert.equal(headers.Vary, 'Origin');

  const deniedHeaders = {};
  applyStatusCors(
    { headers: { origin: 'https://other.example' } },
    { setHeader: (name, value) => { deniedHeaders[name] = value; } },
    { STATUS_ALLOWED_ORIGINS: 'https://allowed.example' },
  );
  assert.equal('Access-Control-Allow-Origin' in deniedHeaders, false);
});
