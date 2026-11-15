'use strict';

const {
  ChannelType,
  SlashCommandBuilder,
} = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('start')
    .setDescription('▶ Starts the Minecraft AFK session'),

  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('■ Stops the Minecraft AFK session'),

  new SlashCommandBuilder()
    .setName('rejoin')
    .setDescription('Disconnects the Minecraft AFK session and reconnects after 30 seconds'),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('◎ Shows unified Discord, Minecraft connection, and AI health'),

  new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Marks yourself as AFK')
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Optional reason for being AFK')
        .setRequired(false),
  ),

  new SlashCommandBuilder()
    .setName('forget')
    .setDescription('⌫ Forgets your AI conversation context'),

  new SlashCommandBuilder()
    .setName('aforget')
    .setDescription('⌫ Forgets all AI conversation contexts (admin only)'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('ⓘ Shows Cottage★ commands and features'),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Shows the bot latency'),

  new SlashCommandBuilder()
    .setName('vc')
    .setDescription('Manage the persistent 24/7 voice connection (admin only)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('join')
        .setDescription('Join the voice channel you are currently in and stay there'),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('leave')
        .setDescription('Stop the persistent voice connection'),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check the persistent voice connection'),
    ),

  new SlashCommandBuilder()
    .setName('summarize')
    .setDescription('Creates a private summary of recent messages (expires after 10 minutes)')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to summarize')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
        )
        .setRequired(true),
  ),



].map(command => command.toJSON());

module.exports = commands;
