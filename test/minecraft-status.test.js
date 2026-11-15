'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildHandshakePacket,
  buildStatusRequestPacket,
  createMinecraftStatusMonitor,
  encodeVarInt,
  normalizeStatusResponse,
  parseStatusResponse,
  readVarInt,
} = require('../minecraft-status');

function encodePacket(status) {
  const json = Buffer.from(JSON.stringify(status), 'utf8');
  const body = Buffer.concat([Buffer.from([0]), encodeVarInt(json.length), json]);
  return Buffer.concat([encodeVarInt(body.length), body]);
}

test('VarInt encoding and decoding round-trip common packet values', () => {
  for (const value of [0, 1, 127, 128, 255, 25565, -1]) {
    const encoded = encodeVarInt(value);
    const decoded = readVarInt(encoded);
    assert.ok(decoded);
    assert.equal(decoded.value, value);
    assert.equal(decoded.bytesRead, encoded.length);
  }
});

test('status handshake and request use the status protocol state', () => {
  const handshake = buildHandshakePacket('example.invalid', 25565);
  const length = readVarInt(handshake);
  assert.ok(length);
  assert.equal(handshake.length, length.bytesRead + length.value);
  assert.deepEqual(buildStatusRequestPacket(), Buffer.from([1, 0]));
});

test('status response exposes only normalized player and version fields', () => {
  const parsed = parseStatusResponse(encodePacket({
    version: { name: 'Paper test' },
    players: { online: 3, max: 20, sample: [{ name: 'private-player' }] },
    description: { text: 'do not expose this MOTD' },
    favicon: 'not-needed',
  }));
  assert.deepEqual(parsed, { players: 3, maxPlayers: 20, version: 'Paper test' });
  assert.doesNotMatch(JSON.stringify(parsed), /private-player|MOTD|favicon/);
});

test('status parser waits for incomplete frames and rejects invalid VarInts', () => {
  const packet = encodePacket({ players: { online: 0, max: 10 } });
  assert.equal(parseStatusResponse(packet.subarray(0, 2)), null);
  assert.throws(() => readVarInt(Buffer.from([0x80, 0x80, 0x80, 0x80, 0x80, 0x00])), /VarInt/);
});

test('monitor reports unknown without private target configuration', async () => {
  const monitor = createMinecraftStatusMonitor({});
  assert.equal((await monitor.checkNow()).state, 'unknown');
});

test('monitor reports online status without exposing connection configuration', async () => {
  const monitor = createMinecraftStatusMonitor({
    host: 'private.example.invalid',
    port: 25565,
    checker: async () => ({ players: 2, maxPlayers: 12, version: 'Paper test' }),
    now: () => new Date('2026-11-16T00:00:00.000Z'),
  });
  const status = await monitor.checkNow();
  assert.deepEqual(status, {
    state: 'online',
    online: true,
    players: 2,
    maxPlayers: 12,
    version: 'Paper test',
    checkedAt: '2026-11-16T00:00:00.000Z',
  });
  assert.doesNotMatch(JSON.stringify(status), /private\.example|25565/);
});

test('monitor never labels an ordinary failed ping as sleeping', async () => {
  const monitor = createMinecraftStatusMonitor({
    host: 'private.example.invalid',
    port: 25565,
    checker: async () => { throw new Error('connection refused'); },
  });
  const status = await monitor.checkNow();
  assert.equal(status.state, 'unavailable');
  assert.equal(status.online, false);
  assert.equal(status.players, null);
  assert.doesNotMatch(JSON.stringify(status), /sleeping|connection refused|private\.example|25565/);
});

test('normalizer safely handles missing optional response fields', () => {
  assert.deepEqual(normalizeStatusResponse({}), {
    players: null,
    maxPlayers: null,
    version: null,
  });
});
