'use strict';

const {
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

async function handleSlashCommand({ interaction, ai, ephemeral = true }) {
  const target = interaction.options.getChannel('channel', true);

  try {
    if (ephemeral) {
      await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.deferReply();
    }

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

    return interaction.editReply({
      embeds: [embed],
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


async function handlePublicSlashCommand({ interaction, ai }) {
  return handleSlashCommand({
    interaction,
    ai,
    ephemeral: false,
  });
}

module.exports = {
  handleSlashCommand,
  handlePublicSlashCommand,
};
