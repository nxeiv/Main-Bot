'use strict';

const { createGeneralCommandHandler } = require('./general-command-handler');
const { createAdminCommandHandler } = require('./admin-command-handler');

function registerInteractionHandlers(dependencies) {
  const {
    client, Events, MessageFlags, log, mc, REJOIN_DELAY_MS, hasFeatureAccess,
    buildStatusEmbed, buildStatusComponents, publishRejoinNotice, summary, ai,
    getDiscordPing, forgetUserConversation, getInteractionAiSessionId,
    forgetAllConversations, executeAdministrativeAction, createEmbed, Colors,
    config, isRejoinAuthorized, buildRejoinComponents, requireFeatureAccess,
    handleVoiceCommand, setUserAfk, getUserAfk,
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
    isRejoinAuthorized, publishRejoinNotice, buildRejoinComponents,
    requireFeatureAccess, buildStatusEmbed, buildStatusComponents,
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
  
        log('Admin', `Rejoin retry requested by ${interaction.user.tag} (${interaction.user.id}).`);
  
        const sourceMessageIsEphemeral =
          Boolean(interaction.message?.flags?.has?.(MessageFlags.Ephemeral));
  
        const updatedMessage = await interaction.update({
          content: 'Retrying... A fresh 30-second disconnect window has started.',
          components: [],
        });
  
        if (sourceMessageIsEphemeral) {
          await publishRejoinNotice(interaction.channel);
        }
  
        return updatedMessage;
      } catch (error) {
        log('Admin', `Rejoin retry failed: ${error.message}`);
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
  
    if (!interaction.isChatInputCommand()) {
      return;
    }
  
    log(
      'Discord',
      `/${interaction.commandName} requested by ${interaction.user.tag}.`,
    );
  
    const status = mc.getStatus();
  
    switch (interaction.commandName) {
      case 'vc':
        return handleVoiceCommand(interaction);
      case 'summarize':
      case 'forget':
      case 'help':
      case 'afk':
        return handleGeneralCommand(interaction);
      case 'ping':
      case 'aforget':
      case 'start':
      case 'stop':
      case 'rejoin':
      case 'status':
        return handleAdminCommand(interaction, status);
      default:
        return undefined;
    }
  });
}

module.exports = { registerInteractionHandlers };