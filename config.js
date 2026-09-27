'use strict';

require('dotenv').config();
require('./summary-bootstrap');

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// Secrets are loaded from the environment.
// Keep ordinary server/community configuration in source control.
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
  },

  adminUserIds: [
    '1235216001260458084',
  ],

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
    initialDelayMs: parsePositiveInteger('60000', 60_000),
    maxDelayMs: Math.max(
      60_000,
      parsePositiveInteger('300000', 300_000),
    ),
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
