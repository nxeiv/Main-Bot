'use strict';

function createGeneralCommandHandler(dependencies) {
  const { summary, ai, forgetUserConversation, getInteractionAiSessionId, MessageFlags, setUserAfk, getUserAfk } = dependencies;
  return async function handleGeneralCommand(interaction) {
    switch (interaction.commandName) {
      case 'summarize':
        return summary.handleSlashCommand({ interaction, ai });
      case 'forget':
        return interaction.reply({ content: forgetUserConversation(getInteractionAiSessionId(interaction)), flags: MessageFlags.Ephemeral });
      case 'help':
        return interaction.reply({ content: ai.getHelpMessage(), flags: MessageFlags.Ephemeral });
      case 'afk': {
        const reason = interaction.options.getString('reason', false)?.trim() || 'AFK';
        setUserAfk(interaction.user.id, reason);
        const saved = getUserAfk(interaction.user.id);
        const safeReason = saved.reason.replace(/([*_~|>])/g, '\\$1');
        const startedAt = Math.floor(saved.setAt / 1000);
        return interaction.reply({ content: `✓ You are now AFK. Reason: **${safeReason}** · <t:${startedAt}:F>`, allowedMentions: { parse: [] } });
      }
      default:
        return undefined;
    }
  };
}

module.exports = { createGeneralCommandHandler };