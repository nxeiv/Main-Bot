'use strict';

const COMMAND_REGISTRY = Object.freeze([
  { name: 'help', category: 'General', access: 'public', description: 'ⓘ Shows Cottage★ commands and features', shortcut: 'help', help: 'Shows this help.' },
  { name: 'afk', category: 'General', access: 'public', description: 'Marks yourself as AFK', shortcut: 'afk', help: 'Marks yourself as AFK; your next message clears it.', options: 'afk' },
  { name: 'forget', category: 'General', access: 'public', description: '⌫ Forgets your AI conversation context', help: 'Clears your own Discord AI conversation context.' },
  { name: 'summarize', category: 'General', access: 'public', description: 'Creates a private summary of recent messages (expires after 10 minutes)', shortcut: 'summarize', help: 'Creates a temporary private summary of a channel.', options: 'summarize' },

  { name: 'ip', category: 'Minecraft', access: 'public', shortcut: 'ip', help: 'Choose Java or Bedrock server information.' },
  { name: 'java', category: 'Minecraft', access: 'public', shortcut: 'java', help: 'Shows the Java server address.' },
  { name: 'bedrock', category: 'Minecraft', access: 'public', shortcut: 'bedrock', help: 'Shows the Bedrock server address.' },
  { name: 'pl', category: 'Minecraft', access: 'public', shortcut: 'pl', help: 'Lists SMP plugins.' },
  { name: 'world download', category: 'Minecraft', access: 'public', shortcut: 'world download', help: 'Opens the world download information.' },
  { name: 'start', category: 'Minecraft', access: 'admin', description: '▶ Starts the Minecraft AFK session', shortcut: 'start', help: 'Starts the optional Minecraft AFK client.' },
  { name: 'stop', category: 'Minecraft', access: 'admin', description: '■ Stops the Minecraft AFK session', shortcut: 'stop', help: 'Stops the Minecraft AFK client.' },
  { name: 'rejoin', category: 'Minecraft', access: 'restricted', description: 'Disconnects the Minecraft AFK session and reconnects after 30 seconds', shortcut: 'rejoin', help: 'Reconnects the AFK client after 30 seconds (restricted access).' },

  { name: 'invite', category: 'Community', access: 'public', shortcut: 'invite', help: 'Shows the Cottage★ Discord invite.' },
  { name: 'roles', category: 'Community', access: 'public', shortcut: 'roles', help: 'Shows the server roles channel.' },
  { name: 'channels', category: 'Community', access: 'public', shortcut: 'channels', help: 'Shows useful community channels.' },
  { name: 'rules', category: 'Community', access: 'public', shortcut: 'rules', help: 'Shows the community rules channel.' },

  { name: 'status', category: 'Administration', access: 'admin', description: '◎ Shows unified Discord, Minecraft connection, and AI health', shortcut: 'status', help: 'Shows unified Discord, Minecraft, and AI diagnostics.' },
  { name: 'ping', category: 'Administration', access: 'admin', description: 'Shows the bot latency', help: 'Checks Discord bot latency.' },
  { name: 'aforget', category: 'Administration', access: 'admin', description: '⌫ Forgets all AI conversation contexts (admin only)', help: 'Clears all Discord AI conversation contexts.' },
  { name: 'vc', category: 'Administration', access: 'admin', description: 'Manage the persistent 24/7 voice connection (admin only)', help: 'Manage the persistent voice connection.', options: 'vc' },
]);

const TEXT_SHORTCUTS = Object.freeze(
  COMMAND_REGISTRY
    .filter(command => command.shortcut && command.name !== 'summarize')
    .map(command => command.shortcut),
);

function buildSlashCommands() {
  const {
    ChannelType,
    SlashCommandBuilder,
  } = require('discord.js');

  return COMMAND_REGISTRY
    .filter(command => command.description)
    .map(command => {
      const builder = new SlashCommandBuilder()
        .setName(command.name)
        .setDescription(command.description);

      if (command.options === 'afk') {
        builder.addStringOption(option => option
          .setName('reason')
          .setDescription('Optional reason for being AFK')
          .setRequired(false));
      }

      if (command.options === 'summarize') {
        builder.addChannelOption(option => option
          .setName('channel')
          .setDescription('Channel to summarize')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(true));
      }

      if (command.options === 'vc') {
        for (const [name, description] of [
          ['join', 'Join the voice channel you are currently in and stay there'],
          ['leave', 'Stop the persistent voice connection'],
          ['status', 'Check the persistent voice connection'],
        ]) {
          builder.addSubcommand(subcommand => subcommand
            .setName(name)
            .setDescription(description));
        }
      }

      return builder.toJSON();
    });
}

function buildHelpMessage() {
  const shortcutLines = COMMAND_REGISTRY
    .filter(command => command.shortcut)
    .map(command => {
      const usage = command.shortcut === 'afk' ? '?afk [reason]' :
        command.shortcut === 'summarize' ? '?summarize <#channel>' : '?' + command.shortcut;
      return '• ' + usage + ' — ' + command.help;
    });

  const groups = ['General', 'Minecraft', 'Community', 'Administration'];
  const slashByCategory = groups.map(category => {
    const commands = COMMAND_REGISTRY.filter(command => command.category === category && command.description);
    if (!commands.length) return '';
    return '**' + category + ' commands**\n' + commands.map(command => {
      if (command.name === 'vc') return '• /vc join · /vc leave · /vc status — ' + command.help;
      const usage = command.name === 'afk' ? '/afk [reason]' :
        command.name === 'summarize' ? '/summarize <channel>' : '/' + command.name;
      return '• ' + usage + ' — ' + command.help;
    }).join('\n');
  }).filter(Boolean);

  return [
    '**The Cottage★ Help**',
    '',
    'Mention me or reply to one of my messages when you want an AI answer. I stay quiet during normal conversation.',
    '',
    ...slashByCategory,
    '',
    '**Text shortcuts**',
    ...shortcutLines,
    '',
    'Shortcuts are case-insensitive and do not require a bot mention. Unknown question-mark messages are ignored. Administrative shortcuts check the triggering member\'s configured permissions; ?rejoin uses its dedicated allow-list. Shortcut replies are deterministic and never call Gemini.',
  ].join('\n');
}

module.exports = {
  COMMAND_REGISTRY,
  TEXT_SHORTCUTS,
  buildHelpMessage,
  buildSlashCommands,
};
