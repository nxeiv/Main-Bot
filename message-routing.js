'use strict';

function isMinecraftRelayMessage(message) {
  if (!message || typeof message !== 'object') {
    return false;
  }

  if (message.webhookId) {
    return true;
  }

  const isBotAuthored = Boolean(message.author?.bot);
  const content = String(message.content || '');
  const hasMinecraftRelayFormat =
    /^\s*[A-Za-z0-9_]{1,16}\s*»\s*/u.test(content);

  return isBotAuthored && hasMinecraftRelayFormat;
}

function shouldHandleConversationalMessage({
  guildId,
  configuredGuildId,
  channelId,
  excludedChannelId,
  isWebhookMessage,
  isReplyToMinecraftRelay,
  isDirectBotMention,
  isReplyToBot,
}) {
  return Boolean(
    guildId &&
    configuredGuildId &&
    guildId === configuredGuildId &&
    (!excludedChannelId || channelId !== excludedChannelId) &&
    !isWebhookMessage &&
    !isReplyToMinecraftRelay &&
    (isDirectBotMention || isReplyToBot)
  );
}

module.exports = {
  isMinecraftRelayMessage,
  shouldHandleConversationalMessage,
};
