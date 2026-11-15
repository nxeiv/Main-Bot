'use strict';

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
      case 'vc': {
        return handleVoiceCommand(interaction);
      }
  
      case 'summarize': {
        return summary.handleSlashCommand({ interaction, ai });
      }
  
      case 'ping': {
        if (!hasFeatureAccess('ping', interaction.user.id, interaction.member)) {
          log(
            'Admin',
            `Rejected /ping from unauthorized user ${interaction.user.tag} (${interaction.user.id}).`,
          );
  
          return interaction.reply({
            content: '✕ You are not authorized to use this command.',
            flags: MessageFlags.Ephemeral,
          });
        }
  
        log(
          'Admin',
          `Verified /ping request from ${interaction.user.tag} (${interaction.user.id}).`,
        );
  
        return interaction.reply({
          content: `PONG! ${getDiscordPing()}ms`,
          flags: MessageFlags.Ephemeral,
        });
      }
  
      case 'forget': {
        return interaction.reply({
          content: forgetUserConversation(getInteractionAiSessionId(interaction)),
          flags: MessageFlags.Ephemeral,
        });
      }
  
      case 'aforget': {
        if (!hasFeatureAccess('aforget', interaction.user.id, interaction.member)) {
          log(
            'Admin',
            `Rejected /aforget from unauthorized user ${interaction.user.tag} (${interaction.user.id}).`,
          );
          return interaction.reply({
            content:
              '✕ You are not authorized to use this command.',
            flags: MessageFlags.Ephemeral,
          });
        }
  
        return interaction.reply({
          content: forgetAllConversations(),
          flags: MessageFlags.Ephemeral,
        });
      }
      case 'start': {
        if (!hasFeatureAccess('start', interaction.user.id, interaction.member)) {
          log(
            'Admin',
            `Rejected /start from unauthorized user ${interaction.user.tag} (${interaction.user.id}).`,
          );
  
          return interaction.reply({
            content: '✕ You are not authorized to use this command.',
            flags: MessageFlags.Ephemeral,
          });
        }
  
        log(
          'Admin',
          `Verified /start request from ${interaction.user.tag} (${interaction.user.id}).`,
        );
  
        if (
          status.connected ||
          status.connecting ||
          status.reconnecting
        ) {
          return interaction.reply({
            embeds: [
              createEmbed(
                'Bot Already Active',
                Colors.Yellow,
              ).setDescription(
                'The bot is already connected or waiting to reconnect.',
              ),
            ],
            flags: MessageFlags.Ephemeral,
          });
        }
  
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
        await executeAdministrativeAction('start');
  
        return interaction.editReply({
          embeds: [
            createEmbed(
              'Joining Server',
              Colors.Green,
            )
              .setDescription(
                `Connecting to ${config.server.ip}. The server may take up to two minutes to wake.`,
              )
              .addFields(
                {
                  name: 'Bot Name',
                  value: `\`${config.bot.username}\``,
                  inline: true,
                },
                {
                  name: 'Server',
                  value: `\`${config.server.ip}\``,
                  inline: true,
                },
              ),
          ],
        });
      }
  
      case 'stop': {
        if (!hasFeatureAccess('stop', interaction.user.id, interaction.member)) {
          log(
            'Admin',
            `Rejected /stop from unauthorized user ${interaction.user.tag} (${interaction.user.id}).`,
          );
  
          return interaction.reply({
            content: '✕ You are not authorized to use this command.',
            flags: MessageFlags.Ephemeral,
          });
        }
  
        log(
          'Admin',
          `Verified /stop request from ${interaction.user.tag} (${interaction.user.id}).`,
        );
  
        if (
          !status.connected &&
          !status.connecting &&
          !status.reconnecting
        ) {
          return interaction.reply({
            embeds: [
              createEmbed(
                'Bot Already Offline',
                Colors.Blurple,
              ).setDescription(
                'There is no active AFK session to stop.',
              ),
            ],
            flags: MessageFlags.Ephemeral,
          });
        }
  
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
        await executeAdministrativeAction('stop');
  
        return interaction.editReply({
          embeds: [
            createEmbed(
              'Bot Stopped',
              Colors.Red,
            ).setDescription(
              'The AFK session was stopped. Use /start to connect again.',
            ),
          ],
        });
      }
  
      case 'rejoin': {
        if (!isRejoinAuthorized(interaction.user.id, interaction.member)) {
          log('Admin', `Rejected /rejoin from ${interaction.user.tag} (${interaction.user.id}).`);
          return interaction.reply({
            content: 'Unknown or unavailable command.',
            flags: MessageFlags.Ephemeral,
          });
        }
  
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
        try {
          const result = mc.rejoin(REJOIN_DELAY_MS);
          if (!result.scheduled) {
            return interaction.editReply({
              content: 'ⓘ A rejoin is already in progress.',
              components: [],
            });
          }
  
          log('Admin', `Verified /rejoin request from ${interaction.user.tag} (${interaction.user.id}).`);
          await publishRejoinNotice(interaction.channel);
  
          return interaction.editReply({
            content: 'Rejoining... The AFK bot will stay disconnected for 30 seconds before reconnecting.',
            components: [buildRejoinComponents()],
          });
        } catch (error) {
          log('Admin', `/rejoin failed: ${error.message}`);
          return interaction.editReply({
            content: '✕ Error: the AFK bot could not be scheduled to rejoin.',
            components: [],
          });
        }
      }
  
      case 'status': {
        if (!(await requireFeatureAccess(interaction, 'status'))) {
          return;
        }
  
        return interaction.reply({
          embeds: [buildStatusEmbed()],
          components: [buildStatusComponents()],
          flags: MessageFlags.Ephemeral,
        });
      }
  
      case 'help': {
        return interaction.reply({
          content: ai.getHelpMessage(),
          flags: MessageFlags.Ephemeral,
        });
      }
  
      case 'afk': {
        const reason = interaction.options.getString('reason', false)?.trim() || 'AFK';
  
        setUserAfk(interaction.user.id, reason);
  
        const storedReason = getUserAfk(interaction.user.id).reason;
        const safeReason = storedReason.replace(/([*_~|>])/g, '\\$1');
  
        const startedAt = Math.floor(getUserAfk(interaction.user.id).setAt / 1000);
        return interaction.reply({
          content: `✓ You are now AFK. Reason: **${safeReason}** · <t:${startedAt}:F>`,
          allowedMentions: { parse: [] },
        });
      }
  
      default:
        return undefined;
    }
  });
}

module.exports = { registerInteractionHandlers };