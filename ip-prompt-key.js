'use strict';

function getIpPromptKey(message) {
  const guildId = message?.guild?.id || 'dm';
  const channelId = message?.channel?.id;
  const authorId = message?.author?.id;

  if (
    typeof channelId !== 'string' ||
    !channelId ||
    typeof authorId !== 'string' ||
    !authorId
  ) {
    throw new TypeError(
      'IP prompt key requires a message with channel and author IDs.',
    );
  }

  return `${guildId}:${channelId}:${authorId}`;
}

module.exports = { getIpPromptKey };
