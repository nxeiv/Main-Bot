'use strict';

function createCommunityMessageCommandHandler({
  stickyMessages,
  MessageFlags,
  log = () => {},
} = {}) {
  if (!stickyMessages || typeof stickyMessages.setSticky !== 'function') {
    throw new TypeError('Community message handler requires the sticky message manager.');
  }

  return async function handleCommunityMessageCommand(interaction) {
    const commandName = interaction.commandName;
    if (commandName !== 'sticky' && commandName !== 'say') return undefined;

    const channel = interaction.options.getChannel('channel', true);
    const content = interaction.options.getString('message', true).trim();

    if (!interaction.guildId || channel.guildId !== interaction.guildId) {
      return interaction.reply({
        content: '✕ Choose a text channel from this server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!channel.isTextBased?.() || typeof channel.send !== 'function') {
      return interaction.reply({
        content: '✕ That channel cannot receive messages.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!content || content.length > 2000) {
      return interaction.reply({
        content: '✕ Message content must be between 1 and 2,000 characters.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (commandName === 'sticky') {
      await stickyMessages.setSticky({
        guildId: interaction.guildId,
        channel,
        content,
        actorId: interaction.user.id,
      });
      log('Community', 'Sticky message updated in ' + interaction.guildId + '/' + channel.id + ' by ' + interaction.user.id + '.');
      return interaction.reply({
        content: '✓ Sticky message updated in <#' + channel.id + '>.',
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
    }

    await channel.send({
      content,
      allowedMentions: { parse: [] },
    });
    log('Community', 'Message posted in ' + interaction.guildId + '/' + channel.id + ' by ' + interaction.user.id + '.');
    return interaction.reply({
      content: '✓ Message sent to <#' + channel.id + '>.',
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  };
}

module.exports = { createCommunityMessageCommandHandler };
