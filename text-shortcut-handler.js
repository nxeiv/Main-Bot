'use strict';

const { getIpPromptKey } = require('./ip-prompt-key');

function createTextShortcutHandler(dependencies) {
  const {
    SERVER_INFO, pendingIpChoices, setUserAfk, getUserAfk, ai,
    hasFeatureAccess, log, mc, REJOIN_DELAY_MS, buildRejoinComponents,
    executeAdministrativeAction, buildStatusEmbed, buildStatusComponents,
    summary, client, ChannelType,
  } = dependencies;

  if (!pendingIpChoices || typeof pendingIpChoices.set !== 'function') {
    throw new TypeError('Text shortcut handler requires a pending IP choice map.');
  }

return async function handleTextShortcut({ message, shortcut }) {
  const rawShortcut = String(shortcut || '')
    .trim()
    .replace(/\s+/g, ' ');
  const normalizedQuestion = rawShortcut.toLowerCase();

  if (normalizedQuestion === 'ip') {
    const prompt = await message.reply(
      'Java or Bedrock?\nReply to this message with Java or Bedrock.',
    );

    pendingIpChoices.set(getIpPromptKey(message), {
      promptMessageId: prompt.id,
      expiresAt: Date.now() + 180_000,
    });

    return true;
  }

  if (normalizedQuestion === 'java') {
    await message.reply('Java IP: ' + SERVER_INFO.javaAddress);
    return true;
  }

  if (normalizedQuestion === 'bedrock') {
    await message.reply('Bedrock IP: ' + SERVER_INFO.bedrockAddress);
    return true;
  }

  if (normalizedQuestion.startsWith('afk')) {
    const reason = rawShortcut.slice(3).trim() || 'AFK';
    setUserAfk(message.author.id, reason);
    const saved = getUserAfk(message.author.id);
    const safeReason = saved.reason.replace(/([*_~|>])/g, '\\$1');
    const startedAt = Math.floor(saved.setAt / 1000);
    await message.reply({
      content: `✓ You are now AFK. Reason: **${safeReason}** · <t:${startedAt}:F>`,
      allowedMentions: { parse: [] },
    });
    return true;
  }

  if (normalizedQuestion === 'pl') {
    await message.reply(ai.getInstantAnswer('plugins') || 'The plugin list is currently unavailable.');
    return true;
  }

  if (normalizedQuestion === 'channels') {
    await message.reply({
      content:
        'Here are the main channels around the community:\n' +
        '- Rules: <#1478166898020585592>\n' +
        '- Roles: <#1398624929099812937>\n' +
        '- General chat: <#1398568017708978258>\n' +
        '- Minecraft status: <#1533895421988962334>\n' +
        '- Minecraft community: <#1533883039287873566>',
      allowedMentions: { parse: [] },
    });
    return true;
  }

  const isShortcut =
    normalizedQuestion === 'start' ||
    normalizedQuestion === 'stop' ||
    normalizedQuestion === 'rejoin' ||
    normalizedQuestion === 'status' ||
    /^summarize\s+<\#\d+>$/.test(normalizedQuestion);

  if (!isShortcut) {
    const knownAnswer =
      ai.getInstantAnswer(`${normalizedQuestion}?`) ||
      ai.getInstantAnswer(normalizedQuestion);

    if (knownAnswer) {
      await message.reply(knownAnswer);
    } else {
      await message.reply(
        `I don't recognize the shortcut \`?${normalizedQuestion}\`. Try \`?help\` to see the available shortcuts.`,
      );
    }

    return true;
  }

  if (normalizedQuestion === 'rejoin') {
    if (!hasFeatureAccess('rejoin', message.author.id, message.member)) {
      log('Admin', `Rejected ?rejoin from ${message.author.tag} (${message.author.id}).`);
      await message.reply('Unknown or unavailable command.');
      return true;
    }

    try {
      const result = mc.rejoin(REJOIN_DELAY_MS);
      if (!result.scheduled) {
        await message.reply('ⓘ A rejoin is already in progress.');
        return true;
      }

      log('Admin', `Verified ?rejoin request from ${message.author.tag} (${message.author.id}).`);
      await message.reply({
        content: 'Rejoining... The AFK bot will stay disconnected for 30 seconds before reconnecting.',
        components: [buildRejoinComponents()],
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      log('Admin', `Text shortcut rejoin failed: ${error.message}`);
      await message.reply('✕ Error: the AFK bot could not be scheduled to rejoin.');
    }

    return true;
  }

  if (normalizedQuestion === 'start' || normalizedQuestion === 'stop') {
    const action = normalizedQuestion === 'start' ? 'start' : 'stop';

    if (!hasFeatureAccess(action, message.author.id, message.member)) {
      await message.reply('✕ You are not authorized to use this command.');
      return true;
    }

    try {
      const result = await executeAdministrativeAction(action);

      await message.reply(
        action === 'start'
          ? result === 'already active'
            ? 'ⓘ The Minecraft AFK bot is already running.'
            : '✓ Minecraft AFK bot started.'
          : result === 'already stopped'
            ? 'ⓘ The Minecraft AFK bot is already stopped.'
            : '✓ Minecraft AFK bot stopped.',
      );
    } catch (error) {
      log(
        'Admin',
        `Text shortcut ${action} failed: ${error.message}`,
      );

      await message.reply(
        `✕ Unable to execute **${action}**: ${error.message}`,
      );
    }

    return true;
  }

  if (normalizedQuestion === 'status') {
    if (!hasFeatureAccess('status', message.author.id, message.member)) {
      await message.reply('✕ You are not authorized to use this command.');
      return true;
    }

    await message.reply({
      embeds: [buildStatusEmbed()],
      components: [buildStatusComponents()],
    });

    return true;
  }

  const summarizeMatch = normalizedQuestion.match(
    /^summarize\s+<\#(\d+)>$/,
  );

  if (summarizeMatch) {
    let target;

    try {
      target = await client.channels.fetch(summarizeMatch[1]);
    } catch (error) {
      await message.reply(
        '✕ I could not find that Discord channel.',
      );
      return true;
    }

    if (!target?.isTextBased()) {
      await message.reply('✕ I can only summarize text-based Discord channels.');
      return true;
    }

    if (!(
      target.type === ChannelType.GuildText ||
      target.type === ChannelType.GuildAnnouncement
    )) {
      await message.reply('✕ I can only summarize text-based Discord channels.');
      return true;
    }

    await summary.handleMessageCommand({
      message,
      target,
      ai,
    });

    return true;
  }

  return false;
}
}

module.exports = { createTextShortcutHandler };
