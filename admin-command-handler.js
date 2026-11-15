'use strict';

function createAdminCommandHandler(dependencies) {
  const {
    hasFeatureAccess, log, MessageFlags, getDiscordPing, forgetAllConversations,
    mc, REJOIN_DELAY_MS, executeAdministrativeAction, createEmbed, Colors, config,
    isRejoinAuthorized, publishRejoinNotice, buildRejoinComponents,
    requireFeatureAccess, buildStatusEmbed, buildStatusComponents,
  } = dependencies;

  return async function handleAdminCommand(interaction, status = mc.getStatus()) {
    switch (interaction.commandName) {
      case 'ping':
        if (!hasFeatureAccess('ping', interaction.user.id, interaction.member)) {
          log('Admin', `Rejected /ping from unauthorized user ${interaction.user.tag} (${interaction.user.id}).`);
          return interaction.reply({ content: '✕ You are not authorized to use this command.', flags: MessageFlags.Ephemeral });
        }
        log('Admin', `Verified /ping request from ${interaction.user.tag} (${interaction.user.id}).`);
        return interaction.reply({ content: `PONG! ${getDiscordPing()}ms`, flags: MessageFlags.Ephemeral });
      case 'aforget':
        if (!hasFeatureAccess('aforget', interaction.user.id, interaction.member)) {
          log('Admin', `Rejected /aforget from unauthorized user ${interaction.user.tag} (${interaction.user.id}).`);
          return interaction.reply({ content: '✕ You are not authorized to use this command.', flags: MessageFlags.Ephemeral });
        }
        return interaction.reply({ content: forgetAllConversations(), flags: MessageFlags.Ephemeral });
      case 'start':
        if (!hasFeatureAccess('start', interaction.user.id, interaction.member)) {
          log('Admin', `Rejected /start from ${interaction.user.tag} (${interaction.user.id}).`);
          return interaction.reply({ content: '✕ You are not authorized to use this command.', flags: MessageFlags.Ephemeral });
        }
        log('Admin', `Verified /start request from ${interaction.user.tag} (${interaction.user.id}).`);
        if (status.connected || status.connecting || status.reconnecting) {
          return interaction.reply({ embeds: [createEmbed('Bot Already Active', Colors.Yellow).setDescription('The bot is already connected or waiting to reconnect.')], flags: MessageFlags.Ephemeral });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await executeAdministrativeAction('start');
        return interaction.editReply({ embeds: [createEmbed('Joining Server', Colors.Green).setDescription(`Connecting to ${config.server.ip}. The server may take up to two minutes to wake.`).addFields({ name: 'Bot Name', value: `\`${config.bot.username}\``, inline: true }, { name: 'Server', value: `\`${config.server.ip}\``, inline: true })] });
      case 'stop':
        if (!hasFeatureAccess('stop', interaction.user.id, interaction.member)) {
          log('Admin', `Rejected /stop from ${interaction.user.tag} (${interaction.user.id}).`);
          return interaction.reply({ content: '✕ You are not authorized to use this command.', flags: MessageFlags.Ephemeral });
        }
        log('Admin', `Verified /stop request from ${interaction.user.tag} (${interaction.user.id}).`);
        if (!status.connected && !status.connecting && !status.reconnecting) {
          return interaction.reply({ embeds: [createEmbed('Bot Already Offline', Colors.Blurple).setDescription('There is no active AFK session to stop.')], flags: MessageFlags.Ephemeral });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await executeAdministrativeAction('stop');
        return interaction.editReply({ embeds: [createEmbed('Bot Stopped', Colors.Red).setDescription('The AFK session was stopped. Use /start to connect again.')] });
      case 'rejoin':
        if (!isRejoinAuthorized(interaction.user.id, interaction.member)) {
          log('Admin', `Rejected /rejoin from ${interaction.user.tag} (${interaction.user.id}).`);
          return interaction.reply({ content: 'Unknown or unavailable command.', flags: MessageFlags.Ephemeral });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
          const result = mc.rejoin(REJOIN_DELAY_MS);
          if (!result.scheduled) return interaction.editReply({ content: 'ⓘ A rejoin is already in progress.', components: [] });
          log('Admin', `Verified /rejoin request from ${interaction.user.tag} (${interaction.user.id}).`);
          await publishRejoinNotice(interaction.channel);
          return interaction.editReply({ content: 'Rejoining... The AFK bot will stay disconnected for 30 seconds before reconnecting.', components: [buildRejoinComponents()] });
        } catch (error) {
          log('Admin', `/rejoin failed: ${error.message}`);
          return interaction.editReply({ content: '✕ Error: the AFK bot could not be scheduled to rejoin.', components: [] });
        }
      case 'status':
        if (!(await requireFeatureAccess(interaction, 'status'))) return;
        return interaction.reply({ embeds: [buildStatusEmbed()], components: [buildStatusComponents()], flags: MessageFlags.Ephemeral });
      default:
        return undefined;
    }
  };
}

module.exports = { createAdminCommandHandler };