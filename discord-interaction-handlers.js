'use strict';

const { createEphemeralInteraction } = require('./ephemeral-interaction');
const { createGeneralCommandHandler } = require('./general-command-handler');
const { createAdminCommandHandler } = require('./admin-command-handler');
const { createCommunityMessageCommandHandler } = require('./community-message-command-handler');

function registerInteractionHandlers(dependencies) {
  const {
    client, Events, MessageFlags, log, mc, REJOIN_DELAY_MS, hasFeatureAccess,
    buildStatusEmbed, buildStatusComponents, summary, ai,
    getDiscordPing, forgetUserConversation, getInteractionAiSessionId,
    forgetAllConversations, executeAdministrativeAction, createEmbed, Colors,
    config, isRejoinAuthorized, buildRejoinComponents, requireFeatureAccess,
    handleVoiceCommand, setUserAfk, getUserAfk, stickyMessages,
  } = dependencies;

  if (!client?.on || !Events?.InteractionCreate) {
    throw new TypeError('Interaction handler requires a Discord client and event constants.');
  }

  const handleGeneralCommand = createGeneralCommandHandler({
    summary, ai, forgetUserConversation, getInteractionAiSessionId,
    MessageFlags, setUserAfk, getUserAfk,
  });
  const handleAdminCommand = createAdminCommandHandler({
    hasFeatureAccess, log, MessageFlags, getDiscordPing, forgetAllConversations,
    mc, REJOIN_DELAY_MS, executeAdministrativeAction, createEmbed, Colors, config,
    isRejoinAuthorized, buildRejoinComponents,
    requireFeatureAccess, buildStatusEmbed, buildStatusComponents,
  });
  const handleCommunityMessageCommand = createCommunityMessageCommandHandler({
    stickyMessages, MessageFlags, log,
  });

  client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isButton() && interaction.customId === 'rejoin:retry') {
      if (!hasFeatureAccess('rejoin', interaction.user.id, interaction.member)) {
        return interaction.reply({
          content: 'Unknown or unavailable command.',
          flags: MessageFlags.Ephemeral,
        });
      }

      try {
        const result = mc.rejoin(REJOIN_DELAY_MS, { replacePending: true });
        if (!result.scheduled) {
          return interaction.reply({
            content: 'ⓘ A rejoin is already in progress.',
            flags: MessageFlags.Ephemeral,
          });
        }

        log('Admin', 'Rejoin retry requested by ' + interaction.user.tag + ' (' + interaction.user.id + ').');
        return interaction.update({
          content: 'Retrying... A fresh 30-second disconnect window has started.',
          components: [],
        });
      } catch (error) {
        log('Admin', 'Rejoin retry failed: ' + error.message);
        if (!interaction.replied && !interaction.deferred) {
          return interaction.reply({
            content: '✕ Error: the AFK bot could not be scheduled to rejoin.',
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    }

    if (interaction.isButton() && interaction.customId === 'status:refresh') {
      return interaction.update({
        embeds: [buildStatusEmbed()],
        components: [buildStatusComponents()],
      });
    }

    if (!interaction.isChatInputCommand()) return;

    const allowedGuildIds = config?.discord?.guildIds;
    if (
      Array.isArray(allowedGuildIds) &&
      allowedGuildIds.length > 0 &&
      !allowedGuildIds.includes(interaction.guildId)
    ) {
      return interaction.reply({
        content: 'Main Bot is not enabled in this server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const commandInteraction = createEphemeralInteraction(
      interaction,
      MessageFlags.Ephemeral,
    );

    log(
      'Discord',
      '/' + commandInteraction.commandName + ' requested by ' + commandInteraction.user.tag + '.',
    );

    const status = mc.getStatus();

    switch (commandInteraction.commandName) {
      case 'vc':
        return handleVoiceCommand(commandInteraction);
      case 'summarize':
      case 'forget':
      case 'help':
      case 'afk':
        return handleGeneralCommand(commandInteraction);
      case 'sticky':
      case 'say':
        if (!hasFeatureAccess(commandInteraction.commandName, commandInteraction.user.id, commandInteraction.member)) {
          return commandInteraction.reply({
            content: '✕ You are not authorized to use this command.',
            flags: MessageFlags.Ephemeral,
          });
        }
        return handleCommunityMessageCommand(commandInteraction);
      case 'ping':
      case 'aforget':
      case 'start':
      case 'stop':
      case 'rejoin':
      case 'status':
        return handleAdminCommand(commandInteraction, status);
      default:
        return undefined;
    }
  });
}

module.exports = { registerInteractionHandlers };
