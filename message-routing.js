'use strict';

function shouldHandleConversationalMessage({
  guildId,
  configuredGuildId,
  isDirectBotMention,
  isReplyToBot,
}) {
  return Boolean(
    guildId &&
    configuredGuildId &&
    guildId === configuredGuildId &&
    (isDirectBotMention || isReplyToBot)
  );
}

module.exports = {
  shouldHandleConversationalMessage,
};
