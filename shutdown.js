'use strict';

function createShutdownHandler({ client, mc, statusServer, log }) {
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

      if (statusServer?.listening) {
        try {
          await new Promise((resolve, reject) => {
            statusServer.close(error => {
              if (error) reject(error);
              else resolve();
            });
          });
        } catch (error) {
          recordFailure('status server', error);
        }
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
