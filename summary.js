'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Events,
} = require('discord.js');

const attachedClients = new WeakSet();

function normalizeChannelName(name) {
  return String(name || '')
    .trim()
    .replace(/^#/, '')
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function resolveChannel(message, request) {
  const guild = message.guild;
  if (!guild) return null;

  const mention = request.match(/<#(\d+)>/);
  if (mention) {
    return guild.channels.cache.get(mention[1]) || null;
  }

  const cleaned = request
    .replace(/\b(?:please|can you|could you|would you|the|channel)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const channelName = normalizeChannelName(cleaned);
  if (!channelName) return null;

  return guild.channels.cache.find(channel => (
    channel &&
    typeof channel.name === 'string' &&
    normalizeChannelName(channel.name) === channelName
  )) || null;
}

function extractChannelRequest(question) {
  const match = String(question || '').match(
    /^\s*(?:can\s+you\s+)?summar(?:y|ize|ise)\s+(?:the\s+)?(?:channel\s+)?(.+?)\s*\??\s*$/i,
  );

  return match ? match[1].trim() : null;
}

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
    .reverse()
    .map(message => {
      const content = cleanMessageContent(message);
      if (!content) return null;

      const author = message.member?.displayName || message.author?.username || 'Unknown';
      return `${author}: ${content}`;
    })
    .filter(Boolean);

  // Keep the prompt comfortably below Discord/Gemini limits while retaining
  // the newest conversation when a channel is especially busy.
  const maxCharacters = 18000;
  let transcript = '';

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const next = lines[index] + (transcript ? `\n${transcript}` : '');
    if (next.length > maxCharacters) break;
    transcript = next;
  }

  return transcript;
}

function attachDismissHandler(client) {
  if (attachedClients.has(client)) return;
  attachedClients.add(client);

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('summary:dismiss:')) return;

    const [, , ownerId] = interaction.customId.split(':');

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content: 'Only the person who requested this summary can dismiss it.',
        ephemeral: true,
      });
      return;
    }

    await interaction.message.delete().catch(async () => {
      if (interaction.deferred || interaction.replied) return;
      await interaction.reply({
        content: 'The summary could not be dismissed.',
        ephemeral: true,
      }).catch(() => {});
    });
  });
}

async function handleMention({ message, question, client, ai }) {
  const channelRequest = extractChannelRequest(question);
  if (!channelRequest) return false;

  attachDismissHandler(client);

  const target = resolveChannel(message, channelRequest);

  if (!target) {
    await message.reply(
      'I could not find that channel. Try mentioning it directly, like `@Main Bot summarize <#123456789012345678>`.',
    );
    return true;
  }

  if (
    target.type !== ChannelType.GuildText &&
    target.type !== ChannelType.GuildAnnouncement
  ) {
    await message.reply('I can only summarize text-based Discord channels.');
    return true;
  }

  if (!target.isTextBased() || typeof target.messages?.fetch !== 'function') {
    await message.reply('I cannot read that channel right now.');
    return true;
  }

  await message.channel.sendTyping().catch(() => {});

  try {
    const fetched = await target.messages.fetch({ limit: 100 });
    const usableMessages = [...fetched.values()]
      .filter(item => !item.system)
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    if (usableMessages.length === 0) {
      await message.reply(`The channel <#${target.id}> does not have any recent messages to summarize.`);
      return true;
    }

    const transcript = buildTranscript(usableMessages);

    if (!transcript) {
      await message.reply(`The channel <#${target.id}> does not have readable recent messages to summarize.`);
      return true;
    }

    const prompt = [
      `Summarize the recent conversation from Discord channel #${target.name}.`,
      'Use only the transcript below. Do not invent details.',
      'Keep the summary concise and useful for someone who missed the conversation.',
      'Keep the final answer under 1200 characters.',
      'Use a short heading followed by 3 to 7 bullet points when appropriate.',
      'Mention important decisions, questions, announcements, plans, or unresolved topics.',
      'Do not include a generic introduction or conclusion.',
      'Do not use emojis.',
      '',
      'TRANSCRIPT:',
      transcript,
    ].join('\n');

    const generatedSummary = await ai.ask(prompt, {
      userId: `summary:${message.id}`,
      platform: 'discord',
    });

    const safeSummary = String(generatedSummary || '')
      .trim()
      .slice(0, 1800);

    if (!safeSummary) {
      throw new Error('AI returned an empty summary.');
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`summary:dismiss:${message.author.id}:${message.id}`)
        .setLabel('Dismiss')
        .setStyle(ButtonStyle.Secondary),
    );

    await message.reply({
      content: `⌁ **Summary of <#${target.id}>**\n\n${safeSummary}`,
      components: [row],
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    console.error(`[Summary] Unable to summarize #${target.name}:`, error?.message || error);
    await message.reply({
      content: 'I could not summarize that channel right now. Please try again in a moment.',
      allowedMentions: { parse: [] },
    });
  }

  return true;
}

module.exports = {
  handleMention,
};
