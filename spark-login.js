'use strict';

const LOGIN_ACTION_ID = 'sparklogin:login_submit';
const RESET_ACTION_ID = 'sparklogin:reset_continue';
const CONFIG_CUSTOM_CLICK_ACTION_PACKET_ID = 0x08;

/**
 * Unwrap prismarine-nbt's typed tree into ordinary JavaScript values.
 * Minecraft-protocol delivers inline dialogs as NBT compounds.
 */
function unwrapNbt(value) {
  if (Array.isArray(value)) {
    return value.map(unwrapNbt);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (
    typeof value.type === 'string' &&
    Object.prototype.hasOwnProperty.call(value, 'value')
  ) {
    return unwrapNbt(value.value);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, unwrapNbt(child)]),
  );
}

function containsString(value, target) {
  if (value === target) return true;
  if (Array.isArray(value)) return value.some(item => containsString(item, target));
  if (!value || typeof value !== 'object') return false;

  return Object.values(value).some(child => containsString(child, target));
}

function encodeVarInt(value) {
  const bytes = [];
  let remaining = value >>> 0;

  do {
    let byte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (remaining !== 0);

  return Buffer.from(bytes);
}

function encodeProtocolString(value) {
  const bytes = Buffer.from(value, 'utf8');
  return Buffer.concat([encodeVarInt(bytes.length), bytes]);
}

/**
 * Builds a Configuration-state custom_click_action packet containing a
 * single NBT string field. This uses writeRaw because the current
 * minecraft-protocol serializer has had an incorrect NBT length for this
 * packet; the normal write('custom_click_action', ...) path can truncate it.
 */
function buildLoginClickPacket(password) {
  const key = Buffer.from('password', 'utf8');
  const value = Buffer.from(password, 'utf8');

  if (key.length > 0xffff || value.length > 0xffff) {
    throw new RangeError('SparkLogin credential is too long for an NBT string.');
  }

  // Anonymous NBT compound:
  // TAG_Compound, TAG_String("password", <credential>), TAG_End.
  const nbt = Buffer.alloc(1 + 1 + 2 + key.length + 2 + value.length + 1);
  let offset = 0;

  nbt.writeUInt8(0x0a, offset++); // TAG_Compound
  nbt.writeUInt8(0x08, offset++); // TAG_String
  nbt.writeUInt16BE(key.length, offset);
  offset += 2;
  key.copy(nbt, offset);
  offset += key.length;
  nbt.writeUInt16BE(value.length, offset);
  offset += 2;
  value.copy(nbt, offset);
  offset += value.length;
  nbt.writeUInt8(0x00, offset); // TAG_End

  return Buffer.concat([
    encodeVarInt(CONFIG_CUSTOM_CLICK_ACTION_PACKET_ID),
    encodeProtocolString(LOGIN_ACTION_ID),
    encodeVarInt(nbt.length),
    nbt,
  ]);
}

/**
 * Automatically answers SparkLogin's existing-account pre-join dialog.
 * Registration and account-reset dialogs deliberately fail closed: the
 * bot must be repaired by an administrator rather than auto-registering.
 */
function attachSparkLoginHandler(bot, options = {}) {
  const client = bot?._client;
  if (!client || typeof client.on !== 'function' || typeof client.writeRaw !== 'function') {
    throw new TypeError('Mineflayer client does not expose packet and raw-write handlers.');
  }

  const password = String(options.password || '');
  const log = typeof options.log === 'function' ? options.log : () => {};
  const onAuthProblem = typeof options.onAuthProblem === 'function'
    ? options.onAuthProblem
    : () => {};

  let submittedForThisConnection = false;

  const handlePacket = (data, metadata) => {
    if (metadata?.state !== 'configuration' || metadata?.name !== 'show_dialog') {
      return;
    }

    const dialog = unwrapNbt(data?.dialog);
    if (!dialog || typeof dialog !== 'object') return;

    if (containsString(dialog, RESET_ACTION_ID)) {
      onAuthProblem('SparkLogin requires an account reset/re-registration. Fix the Server account before restarting Main-Bot.');
      return;
    }

    const inputs = Array.isArray(dialog.inputs) ? dialog.inputs : [];
    const inputKeys = inputs
      .map(input => input?.key)
      .filter(key => typeof key === 'string');

    if (!inputKeys.includes('password')) return;

    if (inputKeys.includes('confirm_password')) {
      onAuthProblem('SparkLogin is asking to register the Server account. Main-Bot will not auto-register; check the account before reconnecting.');
      return;
    }

    if (!password) {
      onAuthProblem('SparkLogin requested a password, but MC_LOGIN_PASSWORD is not configured in the hosting environment.');
      return;
    }

    if (submittedForThisConnection) {
      onAuthProblem('SparkLogin showed the login dialog again after a submission. The credential may be incorrect; Main-Bot stopped to avoid repeated attempts.');
      return;
    }

    submittedForThisConnection = true;

    try {
      client.writeRaw(buildLoginClickPacket(password));
      log('SparkLogin login response submitted during the pre-join configuration phase.');
    } catch (error) {
      onAuthProblem(`Could not submit the SparkLogin response: ${error.message}`);
    }
  };

  client.on('packet', handlePacket);

  return () => {
    client.removeListener('packet', handlePacket);
  };
}

module.exports = {
  LOGIN_ACTION_ID,
  attachSparkLoginHandler,
  buildLoginClickPacket,
  unwrapNbt,
};
