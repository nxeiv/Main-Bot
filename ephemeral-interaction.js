'use strict';

const EPHEMERAL_RESPONSE_METHODS = new Set(['reply', 'deferReply', 'followUp']);

function withEphemeralFlag(options, ephemeralFlag) {
  if (!Number.isInteger(ephemeralFlag) || ephemeralFlag <= 0) {
    throw new TypeError('A valid ephemeral message flag is required.');
  }

  const payload = typeof options === 'string'
    ? { content: options }
    : { ...(options || {}) };
  const providedFlags = typeof payload.flags === 'number'
    ? payload.flags
    : Number(payload.flags?.bitfield || 0);

  payload.flags = (Number.isFinite(providedFlags) ? providedFlags : 0) | ephemeralFlag;
  return payload;
}

function createEphemeralInteraction(interaction, ephemeralFlag) {
  if (!interaction || typeof interaction !== 'object') {
    throw new TypeError('A Discord interaction is required.');
  }

  return new Proxy(interaction, {
    get(target, property) {
      const value = Reflect.get(target, property, target);

      if (EPHEMERAL_RESPONSE_METHODS.has(property) && typeof value === 'function') {
        return (...args) => Reflect.apply(
          value,
          target,
          [withEphemeralFlag(args[0], ephemeralFlag), ...args.slice(1)],
        );
      }

      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

module.exports = {
  createEphemeralInteraction,
  withEphemeralFlag,
};
