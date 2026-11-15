'use strict';

function createVoiceCommandHandler({
  requireFeatureAccess,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  voiceSession,
  log,
}) {
  if (
    typeof requireFeatureAccess !== 'function' ||
    !ChannelType ||
    !PermissionFlagsBits ||
    !MessageFlags ||
    !voiceSession ||
    typeof log !== 'function'
  ) {
    throw new TypeError('Voice command handler requires Discord constants, access checks, voice session, and logger.');
  }

  return async function handleVoiceCommand(interaction) {
    if (!(await requireFeatureAccess(interaction, 'vc'))) {
      return;
    }

    const action = interaction.options.getSubcommand();

    if (action === 'join') {
      const channel = interaction.member?.voice?.channel;

      if (!channel || channel.type !== ChannelType.GuildVoice) {
        return interaction.reply({
          content: 'ⓘ Join a regular voice channel first, then run `/vc join`.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const botMember = interaction.guild.members.me ||
        await interaction.guild.members.fetchMe();
      const permissions = channel.permissionsFor(botMember);

      if (
        !permissions?.has(PermissionFlagsBits.ViewChannel) ||
        !permissions?.has(PermissionFlagsBits.Connect)
      ) {
        return interaction.reply({
          content: '✕ I need View Channel and Connect permissions in that voice channel.',
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const result = await voiceSession.join(channel);
        return interaction.editReply({
          content: result.alreadyConnected
            ? `ⓘ I am already connected to <#${channel.id}>.`
            : `✓ Connected to <#${channel.id}>. I will remain there and restore this session after a normal bot restart. My microphone and audio reception are disabled.`,
        });
      } catch (error) {
        log('Voice', `/vc join failed: ${error.message}`);
        return interaction.editReply({
          content: `✕ I could not join that voice channel: ${error.message}`,
        });
      }
    }

    if (action === 'leave') {
      const result = voiceSession.leave();
      return interaction.reply({
        content: result.left
          ? '✓ Persistent voice connection stopped.'
          : 'ⓘ I do not have an active persistent voice session.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (action === 'status') {
      const currentVoice = voiceSession.getStatus();
      return interaction.reply({
        content: currentVoice.active
          ? `◎ Saved voice channel: <#${currentVoice.channelId}>\nConnection state: **${currentVoice.connectionState}**`
          : 'ⓘ No persistent voice channel is configured.',
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({
      content: '✕ Unknown voice action.',
      flags: MessageFlags.Ephemeral,
    });
  };
}

module.exports = {
  createVoiceCommandHandler,
};
