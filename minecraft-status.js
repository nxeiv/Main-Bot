'use strict';

const net = require('node:net');

const MAX_PACKET_BYTES = 1024 * 1024;

function encodeVarInt(value) {
  let remaining = value >>> 0;
  const bytes = [];
  do {
    let byte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (remaining !== 0);
  return Buffer.from(bytes);
}

function readVarInt(buffer, offset = 0) {
  let result = 0;
  let bytesRead = 0;

  while (bytesRead < 5) {
    const index = offset + bytesRead;
    if (index >= buffer.length) return null;

    const byte = buffer[index];
    result |= (byte & 0x7f) << (7 * bytesRead);
    bytesRead += 1;

    if ((byte & 0x80) === 0) {
      return { value: result | 0, bytesRead };
    }
  }

  throw new Error('Invalid Minecraft VarInt.');
}

function encodeString(value) {
  const body = Buffer.from(String(value), 'utf8');
  return Buffer.concat([encodeVarInt(body.length), body]);
}

function buildHandshakePacket(host, port) {
  const portBytes = Buffer.alloc(2);
  portBytes.writeUInt16BE(port, 0);

  const payload = Buffer.concat([
    encodeVarInt(0),
    encodeVarInt(-1),
    encodeString(host),
    portBytes,
    encodeVarInt(1),
  ]);

  return Buffer.concat([encodeVarInt(payload.length), payload]);
}

function buildStatusRequestPacket() {
  return Buffer.from([1, 0]);
}

function normalizeStatusResponse(status) {
  if (!status || typeof status !== 'object' || Array.isArray(status)) {
    throw new Error('Minecraft status response was not an object.');
  }

  const online = Number(status.players?.online);
  const maximum = Number(status.players?.max);
  const version = typeof status.version?.name === 'string'
    ? status.version.name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80)
    : null;

  return {
    players: Number.isSafeInteger(online) && online >= 0 ? online : null,
    maxPlayers: Number.isSafeInteger(maximum) && maximum >= 0 ? maximum : null,
    version,
  };
}

function parseStatusResponse(buffer) {
  const frame = readVarInt(buffer, 0);
  if (!frame) return null;
  if (frame.value < 1 || frame.value > MAX_PACKET_BYTES) {
    throw new Error('Minecraft status packet size is invalid.');
  }

  const frameStart = frame.bytesRead;
  const frameEnd = frameStart + frame.value;
  if (buffer.length < frameEnd) return null;

  const packet = buffer.subarray(frameStart, frameEnd);
  const packetId = readVarInt(packet, 0);
  if (!packetId || packetId.value !== 0) {
    throw new Error('Unexpected Minecraft status packet.');
  }

  const stringLength = readVarInt(packet, packetId.bytesRead);
  if (!stringLength || stringLength.value < 0 || stringLength.value > MAX_PACKET_BYTES) {
    throw new Error('Minecraft status JSON length is invalid.');
  }

  const stringStart = packetId.bytesRead + stringLength.bytesRead;
  const stringEnd = stringStart + stringLength.value;
  if (packet.length < stringEnd) return null;

  const json = packet.toString('utf8', stringStart, stringEnd);
  return normalizeStatusResponse(JSON.parse(json));
}

function queryMinecraftServer({ host, port, timeoutMs = 4000 }) {
  const safeHost = String(host || '').trim();
  const safePort = Number(port);
  const timeout = Number.isFinite(timeoutMs)
    ? Math.min(Math.max(Math.floor(timeoutMs), 500), 15000)
    : 4000;

  if (!safeHost || !Number.isInteger(safePort) || safePort < 1 || safePort > 65535) {
    return Promise.reject(new Error('Minecraft status target is not configured.'));
  }

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: safeHost, port: safePort });
    let buffer = Buffer.alloc(0);
    let settled = false;

    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(result);
    };

    socket.setTimeout(timeout, () => {
      finish(new Error('Minecraft status check timed out.'));
    });

    socket.once('connect', () => {
      socket.write(Buffer.concat([
        buildHandshakePacket(safeHost, safePort),
        buildStatusRequestPacket(),
      ]));
    });

    socket.on('data', chunk => {
      if (settled) return;
      buffer = Buffer.concat([buffer, chunk]);

      if (buffer.length > MAX_PACKET_BYTES + 5) {
        finish(new Error('Minecraft status response exceeded the size limit.'));
        return;
      }

      try {
        const result = parseStatusResponse(buffer);
        if (result) finish(null, result);
      } catch (error) {
        finish(error);
      }
    });

    socket.once('error', error => finish(error));
    socket.once('close', () => {
      if (!settled) finish(new Error('Minecraft status connection closed early.'));
    });
  });
}

function createMinecraftStatusMonitor({
  host,
  port,
  intervalMs = 45000,
  timeoutMs = 4000,
  checker = queryMinecraftServer,
  now = () => new Date(),
} = {}) {
  const configured = Boolean(
    String(host || '').trim() &&
    Number.isInteger(Number(port)) &&
    Number(port) > 0 &&
    Number(port) <= 65535,
  );

  let timer = null;
  let inFlight = null;
  let snapshot = {
    state: configured ? 'checking' : 'unknown',
    online: null,
    players: null,
    maxPlayers: null,
    version: null,
    checkedAt: null,
  };

  const getSnapshot = () => ({ ...snapshot });

  async function checkNow() {
    if (!configured) {
      snapshot = {
        state: 'unknown',
        online: null,
        players: null,
        maxPlayers: null,
        version: null,
        checkedAt: null,
      };
      return getSnapshot();
    }

    if (inFlight) return inFlight;

    inFlight = (async () => {
      try {
        const result = await checker({ host, port: Number(port), timeoutMs });
        snapshot = {
          state: 'online',
          online: true,
          players: result.players,
          maxPlayers: result.maxPlayers,
          version: result.version,
          checkedAt: now().toISOString(),
        };
      } catch (_) {
        // A failed ping cannot distinguish hibernation from a stopped server,
        // a crash, or a network problem. Never label it as confirmed sleeping.
        snapshot = {
          state: 'unavailable',
          online: false,
          players: null,
          maxPlayers: null,
          version: null,
          checkedAt: now().toISOString(),
        };
      } finally {
        inFlight = null;
      }

      return getSnapshot();
    })();

    return inFlight;
  }

  function start() {
    if (timer) return;
    void checkNow();
    const interval = Number.isFinite(intervalMs)
      ? Math.min(Math.max(Math.floor(intervalMs), 15000), 300000)
      : 45000;
    timer = setInterval(() => { void checkNow(); }, interval);
    timer.unref?.();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { start, stop, checkNow, getSnapshot };
}

module.exports = {
  buildHandshakePacket,
  buildStatusRequestPacket,
  createMinecraftStatusMonitor,
  encodeVarInt,
  normalizeStatusResponse,
  parseStatusResponse,
  queryMinecraftServer,
  readVarInt,
};
