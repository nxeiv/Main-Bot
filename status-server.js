'use strict';

const http = require('node:http');

function getPublicMinecraftStatus(mc) {
  const status = mc.getStatus();

  let state = 'offline';

  if (status.connected) {
    state = 'online';
  } else if (status.connecting) {
    state = 'connecting';
  } else if (status.reconnecting) {
    state = 'reconnecting';
  }

  return {
    online: status.connected,
    state,
    players: Number.isSafeInteger(status.playerCount)
      ? status.playerCount
      : 0,
    uptime: Number.isSafeInteger(status.uptime)
      ? status.uptime
      : 0,
    reconnectAttempts: Number.isSafeInteger(status.reconnectAttempts)
      ? status.reconnectAttempts
      : 0,
    checkedAt: new Date().toISOString(),
  };
}

function getAllowedStatusOrigins(env = process.env) {
  return String(env.STATUS_ALLOWED_ORIGINS || '*')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

function applyStatusCors(request, response, env = process.env) {
  const requestOrigin = request.headers.origin;
  const allowedOrigins = getAllowedStatusOrigins(env);

  if (allowedOrigins.includes('*')) {
    response.setHeader('Access-Control-Allow-Origin', '*');
  } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    response.setHeader('Access-Control-Allow-Origin', requestOrigin);
  }

  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function startStatusServer({ mc, log, env = process.env }) {
  const port = Number(env.PORT || env.STATUS_PORT || 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    log('Web', `Invalid status server port: ${port}`);
    return null;
  }

  const server = http.createServer((request, response) => {
    applyStatusCors(request, response, env);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method !== 'GET') {
      response.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    if (request.url === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({
        ok: true,
        service: 'The Cottage★ Main Bot',
        checkedAt: new Date().toISOString(),
      }));
      return;
    }

    if (request.url === '/api/status') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(getPublicMinecraftStatus(mc)));
      return;
    }

    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Not Found' }));
  });

  server.on('error', error => {
    log('Web', `Status server error: ${error.message}`);
  });

  server.listen(port, '0.0.0.0', () => {
    log('Web', `Status API listening on 0.0.0.0:${port}`);
  });

  return server;
}

module.exports = {
  applyStatusCors,
  getAllowedStatusOrigins,
  getPublicMinecraftStatus,
  startStatusServer,
};
