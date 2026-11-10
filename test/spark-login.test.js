'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');

const {
  LOGIN_ACTION_ID,
  attachSparkLoginHandler,
  buildLoginClickPacket,
  unwrapNbt,
} = require('../spark-login');

function readVarInt(buffer, state) {
  let value = 0;
  let position = 0;
  let byte;

  do {
    byte = buffer[state.offset++];
    value |= (byte & 0x7f) << position;
    position += 7;
    if (position > 35) throw new Error('VarInt is too big.');
  } while ((byte & 0x80) !== 0);

  return value >>> 0;
}

function readString(buffer, state) {
  const length = readVarInt(buffer, state);
  const value = buffer.toString('utf8', state.offset, state.offset + length);
  state.offset += length;
  return value;
}

function createDialog(inputKeys) {
  return {
    type: 'compound',
    value: {
      inputs: {
        type: 'list',
        value: {
          type: 'compound',
          value: inputKeys.map(key => ({
            type: 'compound',
            value: {
              key: { type: 'string', value: key },
              type: { type: 'string', value: 'minecraft:text' },
            },
          })),
        },
      },
    },
  };
}

function createFakeBot() {
  const client = new EventEmitter();
  client.rawPackets = [];
  client.writeRaw = packet => client.rawPackets.push(packet);
  return { _client: client };
}

test('unwrapNbt turns a typed compound/list into normal JavaScript values', () => {
  assert.deepEqual(unwrapNbt(createDialog(['password'])), {
    inputs: [{ key: 'password', type: 'minecraft:text' }],
  });
});

test('buildLoginClickPacket writes a configuration custom-click packet with the password field', () => {
  const packet = buildLoginClickPacket('a-test-secret');
  const state = { offset: 0 };

  assert.equal(readVarInt(packet, state), 0x08);
  assert.equal(readString(packet, state), LOGIN_ACTION_ID);

  const nbtLength = readVarInt(packet, state);
  assert.equal(packet.length - state.offset, nbtLength);

  const nbt = packet.subarray(state.offset);
  let offset = 0;
  assert.equal(nbt.readUInt8(offset++), 0x0a); // TAG_Compound
  assert.equal(nbt.readUInt8(offset++), 0x08); // TAG_String

  const keyLength = nbt.readUInt16BE(offset);
  offset += 2;
  assert.equal(nbt.toString('utf8', offset, offset + keyLength), 'password');
  offset += keyLength;

  const valueLength = nbt.readUInt16BE(offset);
  offset += 2;
  assert.equal(nbt.toString('utf8', offset, offset + valueLength), 'a-test-secret');
  offset += valueLength;
  assert.equal(nbt.readUInt8(offset), 0x00); // TAG_End
});

test('SparkLogin handler submits one login response only during configuration', () => {
  const bot = createFakeBot();
  const authProblems = [];
  const logMessages = [];

  attachSparkLoginHandler(bot, {
    password: 'stored-secret',
    log: message => logMessages.push(message),
    onAuthProblem: message => authProblems.push(message),
  });

  const dialog = createDialog(['password']);
  bot._client.emit('packet', { dialog }, { state: 'play', name: 'show_dialog' });
  assert.equal(bot._client.rawPackets.length, 0);

  bot._client.emit('packet', { dialog }, { state: 'configuration', name: 'show_dialog' });
  bot._client.emit('packet', { dialog }, { state: 'configuration', name: 'show_dialog' });

  assert.equal(bot._client.rawPackets.length, 1);
  assert.equal(authProblems.length, 1);
  assert.match(authProblems[0], /showed the login dialog again/);
  assert.equal(logMessages.length, 1);
});

test('SparkLogin handler fails closed when no credential is configured', () => {
  const bot = createFakeBot();
  const authProblems = [];

  attachSparkLoginHandler(bot, {
    password: '',
    onAuthProblem: message => authProblems.push(message),
  });

  bot._client.emit('packet', {
    dialog: createDialog(['password']),
  }, { state: 'configuration', name: 'show_dialog' });

  assert.equal(bot._client.rawPackets.length, 0);
  assert.equal(authProblems.length, 1);
  assert.match(authProblems[0], /MC_LOGIN_PASSWORD/);
});

test('SparkLogin handler does not auto-register or continue a reset flow', () => {
  const bot = createFakeBot();
  const authProblems = [];

  attachSparkLoginHandler(bot, {
    password: 'stored-secret',
    onAuthProblem: message => authProblems.push(message),
  });

  bot._client.emit('packet', {
    dialog: createDialog(['password', 'confirm_password']),
  }, { state: 'configuration', name: 'show_dialog' });

  assert.equal(bot._client.rawPackets.length, 0);
  assert.equal(authProblems.length, 1);
  assert.match(authProblems[0], /will not auto-register/);

  const resetBot = createFakeBot();
  const resetProblems = [];
  attachSparkLoginHandler(resetBot, {
    password: 'stored-secret',
    onAuthProblem: message => resetProblems.push(message),
  });

  resetBot._client.emit('packet', {
    dialog: {
      type: 'compound',
      value: {
        action: {
          type: { type: 'string', value: 'minecraft:custom' },
          id: { type: 'string', value: 'sparklogin:reset_continue' },
        },
      },
    },
  }, { state: 'configuration', name: 'show_dialog' });

  assert.equal(resetBot._client.rawPackets.length, 0);
  assert.equal(resetProblems.length, 1);
  assert.match(resetProblems[0], /reset\/re-registration/);
});
