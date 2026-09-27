'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');

function cleanMessageContent(message) {
  const content = String(message.content || '').trim();
  if (!content) return '';

  return content
    .replace(/<@!?\d+>/g, '@user')
    .replace(/<@&\d+>/g, '@role')
    .replace(/<#\d+>/g, '#channel')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTranscript(messages) {
  const lines = messages
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map(message => {
      const content = cleanMessageContent(message);
      if (!content) return null;

      const author =
        message.member?.displayName ||
        message.author?.username ||
        'Unknown';

      return `${author}: ${content}`;
    })
    .filter(Boolean);

  const maxCharacters = 18_000;
  let transcript = '';

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const next = lines[index] + (transcript ? `\n${transcript}` : '');

    if (next.length > maxCharacters) {
      break;
    }

    transcript = next;
  }

  return transcript;
}

async function collectSummary({ interaction, target, ai }) {
  if (
    target.type !== ChannelType.GuildText &&
    target.type !== ChannelType.GuildAnnouncement
  ) {
    throw new Error('I can only summarize text-based Discord channels.');
  }

  if (
    !target.isTextBased() ||
    typeof target.messages?.fetch !== 'function'
  ) {
    throw new Error('I cannot read that channel right now.');
  }

  const fetched = await target.messages.fetch({ limit: 100 });

  const usableMessages = [...fetched.values()]
    .filter(message => !message.system && !message.author?.bot);

  if (usableMessages.length === 0) {
    throw new Error(
      `The channel <#${target.id}> does not have any recent messages to summarize.`,
    );
  }

  const transcript = buildTranscript(usableMessages);

  if (!transcript) {
    throw new Error(
      `The channel <#${target.id}> does not have readable recent messages to summarize.`,
    );
  }

  const prompt = [
    `Summarize the recent conversation from Discord channel #${target.name}.`,
    'Use only the transcript below. Do not invent details.',
    'Keep the summary concise and useful for someone who missed the conversation.',
    'Keep the final answer under 1200 characters.',
    'Use a short heading followed by 3 to 7 bullet points when appropriate.',
    'Mention important decisions, questions, announcements, plans, or unresolved topics.',
    'Ignore bot-generated chatter, command spam, and repetitive low-value messages.',
    'Do not include a generic introduction or conclusion.',
    'Do not use emojis or decorative Unicode symbols.',
    '',
    'TRANSCRIPT:',
    transcript,
  ].join('\n');

  return ai.ask(prompt, {
    userId: `summary:${interaction.id}`,
    platform: 'discord',
    skipKnownAnswers: true,
  });
}

async function handleSlashCommand({ interaction, ai }) {
  const target = interaction.options.getChannel('channel', true);

  try {
    await interaction.deferReply();

    const generatedSummary = await collectSummary({
      interaction,
      target,
      ai,
    });

    const summaryText = String(generatedSummary || '')
      .replace(/[⌁◆◇✓✕ⓘ⚠︎⚒︎⌂⌫→]/g, '')
      .trim()
      .slice(0, 1800);

    if (!summaryText) {
      throw new Error('AI returned an empty summary.');
    }

    const embed = new EmbedBuilder()
      .setTitle('Channel Summary')
      .setDescription(summaryText)
      .addFields({
        name: 'Channel',
        value: `<#${target.id}>`,
        inline: true,
      })
      .setFooter({
        text: `Requested by ${interaction.user.displayName || interaction.user.username}`,
      })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`summary:dismiss:${interaction.user.id}:${interaction.id}`)
        .setLabel('Dismiss summary')
        .setStyle(ButtonStyle.Secondary),
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row],
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    console.error(
      `[Summary] Unable to summarize #${target?.name || 'unknown'}:`,
      error?.message || error,
    );

    const content =
      error?.message ||
      'I could not summarize that channel right now. Please try again in a moment.';

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({
        content,
        allowedMentions: { parse: [] },
      });
    }

    return interaction.reply({
      content,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

async function handleDismissButton(interaction) {
  const parts = String(interaction.customId).split(':');
  const ownerId = parts[2];

  if (!ownerId || interaction.user.id !== ownerId) {
    return interaction.reply({
      content: 'Only the person who requested this summary can dismiss it.',
      flags: MessageFlags.Ephemeral,
    });
  }

  try {
    // Acknowledge the button and remove the control immediately.
    await interaction.update({
      components: [],
    });
  } catch (error) {
    console.error(
      '[Summary] Unable to acknowledge dismiss interaction:',
      error?.message || error,
    );

    try {
      await interaction.deferUpdate();
    } catch (fallbackError) {
      console.error(
        '[Summary] Unable to defer dismiss interaction:',
        fallbackError?.message || fallbackError,
      );
    }
  }

  try {
    await interaction.message.delete();
  } catch (error) {
    // If deletion fails, at least leave the summary without an active button.
    console.error(
      '[Summary] Unable to delete dismissed summary:',
      error?.message || error,
    );

    try {
      await interaction.message.edit({
        components: [],
      });
    } catch (fallbackError) {
      console.error(
        '[Summary] Unable to disable dismissed summary button:',
        fallbackError?.message || fallbackError,
      );
    }
  }
}

module.exports = {
  handleSlashCommand,
  handleDismissButton,
};
