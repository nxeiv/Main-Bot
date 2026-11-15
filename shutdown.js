'use strict';

function createShutdownHandler({ client, mc, log }) {
  let shutdownPromise = null;

  function recordFailure(resource, error) {
    log(
      'Shutdown',
      `Unable to close ${resource}: ${String(error?.message || error || 'Unknown error')}`,
    );
  }

  return function shutdown(signal = 'unknown') {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      log('Shutdown', `Received ${signal}; closing bot connections.`);

      try {
        mc?.stop?.();
      } catch (error) {
        recordFailure('Minecraft connection', error);
      }

      try {
        client?.destroy?.();
      } catch (error) {
        recordFailure('Discord client', error);
      }

      log('Shutdown', 'Connection cleanup finished.');
    })();

    return shutdownPromise;
  };
}

module.exports = {
  createShutdownHandler,
};
