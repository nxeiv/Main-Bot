'use strict';

function createRejoinController({
  disconnect,
  connect,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  log = () => {},
}) {
  if (typeof disconnect !== 'function' || typeof connect !== 'function') {
    throw new TypeError('Rejoin controller requires disconnect and connect functions.');
  }

  let timer = null;

  function cancel() {
    if (timer === null) return false;
    clearTimeoutFn(timer);
    timer = null;
    return true;
  }

  function schedule(delayMs = 30_000, options = {}) {
    if (!Number.isSafeInteger(delayMs) || delayMs < 0) {
      throw new RangeError('Rejoin delay must be a non-negative safe integer.');
    }

    if (timer !== null && options.replacePending !== true) {
      return { scheduled: false, reason: 'already-scheduled' };
    }

    cancel();
    disconnect();

    let scheduledTimer;
    scheduledTimer = setTimeoutFn(() => {
      // A cancelled or replaced timer may already have queued its callback.
      if (timer !== scheduledTimer) return;

      timer = null;
      try {
        connect();
        log('The manual rejoin delay elapsed; the Minecraft AFK session is connecting again.');
      } catch (error) {
        log('The manual rejoin could not start: ' + (error?.message || error));
      }
    }, delayMs);
    timer = scheduledTimer;

    if (timer && typeof timer.unref === 'function') timer.unref();
    log('The Minecraft AFK session was disconnected. Rejoining in ' + Math.ceil(delayMs / 1000) + ' seconds.');

    return { scheduled: true, delayMs };
  }

  return {
    cancel,
    isScheduled: () => timer !== null,
    schedule,
  };
}

module.exports = { createRejoinController };
