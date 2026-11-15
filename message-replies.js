'use strict';

function replyMentioningAuthor(message, payload) {
  if (!message || typeof message.reply !== 'function') {
    throw new TypeError('A Discord message with a reply method is required.');
  }

  const authorId = String(message.author?.id || '').trim();
  if (!/^\\d{17,20}$/.test(authorId)) {
    throw new TypeError('A valid message author ID is required to mention the requester.');
  }

  const options = typeof payload === 'string'
    ? { content: payload }
    : { ...(payload || {}) };

  const existingContent = typeof options.content === 'string'
    ? options.content
    : '';
  const alreadyMentionsAuthor =
    existingContent.includes(`<@${authorId}>`) ||
    existingContent.includes(`<@!${authorId}>`);

  options.content = alreadyMentionsAuthor
    ? existingContent
    : `<@${authorId}>${existingContent ? ` ${existingContent}` : ''}`;

  const existingAllowedMentions =
    options.allowedMentions && typeof options.allowedMentions === 'object'
      ? options.allowedMentions
      : {};
  const existingUsers = Array.isArray(existingAllowedMentions.users)
    ? existingAllowedMentions.users.map(String)
    : [];

  options.allowedMentions = {
    ...existingAllowedMentions,
    parse: [],
    users: [...new Set([...existingUsers, authorId])],
  };

  return message.reply(options);
}

module.exports = { replyMentioningAuthor };
