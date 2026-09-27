'use strict';

const { Client, Events } = require('discord.js');
const summary = require('./summary');

if (!Client.prototype.__cottageSummaryPatched) {
  const originalOn = Client.prototype.on;

  Client.prototype.on = function patchedClientOn(event, listener) {
    if (event !== Events.MessageCreate || typeof listener !== 'function') {
      return originalOn.call(this, event, listener);
    }

    const client = this;

    const wrappedListener = async message => {
      try {
        if (
          !message.author?.bot &&
          message.guild &&
          client.user &&
          message.mentions?.has(client.user)
        ) {
          const mentionRegex = new RegExp(`<@!?${client.user.id}>`, 'g');
          const question = String(message.content || '')
            .replace(mentionRegex, '')
            .trim();

          if (/^\s*(?:can\s+you\s+)?summar(?:y|ize|ise)\s+/i.test(question)) {
            const ai = require('./ai');
            const handled = await summary.handleMention({
              message,
              question,
              client,
              ai,
            });

            if (handled) {
              return;
            }
          }
        }
      } catch (error) {
        console.error('[Summary] Unable to intercept summary request:', error?.message || error);
      }

      return listener(message);
    };

    return originalOn.call(this, event, wrappedListener);
  };

  Object.defineProperty(Client.prototype, '__cottageSummaryPatched', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}
