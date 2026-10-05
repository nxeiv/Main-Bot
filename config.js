'use strict';

require('dotenv').config();

const discordToken = String(process.env.DISCORD_TOKEN || '').trim();
const minecraftPassword = String(process.env.MC_PASSWORD || '');

const config = {
  discord: {
    token: discordToken,
    clientId: '1501273403615608933',
    guildId: '1398568016915992667',
    statusChannelId: '1551186617635704832',
    maintenanceChannelId: '1478252152169431134',
    chatChannelId: '1551228249214820483',
    errorChannelId: String(process.env.ERROR_CHANNEL_ID || '').trim(),
  },

  // User IDs remain as a fallback for emergency/admin access.
  adminUserIds: [
    '1235216001260458084',
  ],

  // Members with any of these role IDs are also treated as administrators.
  // The current Cottage★ Moderator role is included by default.
  adminRoleIds: [
    '1398595607853142086',
  ],

  // Central feature access policy.
  // Change a feature here instead of editing permission checks throughout the bot.
  featureAccess: {
    help: 'public',
    status: 'admin',
    dashboard: 'admin',
    start: 'admin',
    stop: 'admin',
    maintenance: 'admin',
    forget: 'public',
    aforeget: 'admin',
    ai: 'admin',
    summarize: 'public',
  },

  server: {
    ip: 'the-cottage-c1-s5.play.hosting',
    port: 25565,
    version: '1.21.11',
  },

  bot: {
    username: 'Server',
    password: minecraftPassword,
    auth: 'offline',
  },

  reconnect: {
    initialDelayMs: 60_000,
    maxDelayMs: 300_000,
  },

};

const missing = [];

if (!config.discord.token) {
  missing.push('DISCORD_TOKEN');
}

if (missing.length > 0) {
  console.error(
    `[Config] Missing required environment variables: ${missing.join(', ')}.`,
  );
  console.error('[Config] Add the missing values and restart the bot.');
  process.exit(1);
}

module.exports = config;
