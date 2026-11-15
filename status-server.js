'use strict';

const http = require('node:http');
const { createMinecraftStatusMonitor } = require('./minecraft-status');

const SERVICE_NAME = 'The Cottage★ Main Bot';

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  response.end(JSON.stringify(payload));
}

function createStatusServer({
  host,
  port,
  listenHost = '0.0.0.0',
  listenPort = 15504,
  intervalMs = 45000,
  timeoutMs = 4000,
  allowedOrigins = ['https://the-cottage.onrender.com'],
  monitor,
  log = () => {},
} = {}) {
  const statusMonitor = monitor || createMinecraftStatusMonitor({
    host,
    port,
    intervalMs,
    timeoutMs,
  });
  const origins = new Set(
    (Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins])
      .map(origin => String(origin || '').trim())
      .filter(Boolean),
  );

  let server = null;

  function applyCors(request, response) {
    const origin = String(request.headers.origin || '');
    if (origin && origins.has(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');
      response.setHeader('Access-Control-Max-Age', '600');
    }
  }

  function handleRequest(request, response) {
    applyCors(request, response);

    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end();
      return;
    }

    const pathname = new URL(request.url || '/', 'http://localhost').pathname;

    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Method not allowed.' });
      return;
    }

    if (pathname === '/health') {
      sendJson(response, 200, {
        ok: true,
        service: SERVICE_NAME,
        checkedAt: new Date().toISOString(),
      });
      return;
    }

    if (pathname === '/api/status') {
      const status = statusMonitor.getSnapshot();
      // Deliberately whitelist public fields. Never serialize configuration,
      // hostnames, ports, MOTD, raw ping errors, or Discord identifiers.
      sendJson(response, 200, {
        online: status.online,
        state: status.state,
        players: status.players,
        maxPlayers: status.maxPlayers,
        version: status.version,
        checkedAt: status.checkedAt,
      });
      return;
    }

    sendJson(response, 404, { error: 'Not found.' });
  }

  function start() {
    if (server) return server;

    statusMonitor.start();
    server = http.createServer(handleRequest);
    server.on('error', error => {
      log('Status API server error: ' + String(error?.message || error));
    });
    server.listen(listenPort, listenHost, () => {
      log('Read-only status API listening on ' + listenHost + ':' + listenPort + '.');
    });
    return server;
  }

  function stop() {
    statusMonitor.stop();
    if (!server) return Promise.resolve();
    const current = server;
    server = null;
    return new Promise(resolve => {
      if (!current.listening) {
        resolve();
        return;
      }
      current.close(() => resolve());
    });
  }

  return { start, stop, getServer: () => server };
}

module.exports = { createStatusServer };
