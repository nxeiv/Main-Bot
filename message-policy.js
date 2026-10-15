'use strict';

function isExplicitBotInvocation({ isDirectMention, isReplyToBot } = {}) {
  return Boolean(isDirectMention || isReplyToBot);
}

module.exports = {
  isExplicitBotInvocation,
};
