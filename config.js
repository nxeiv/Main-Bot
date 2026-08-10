'use strict';

require('dotenv').config();

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const reconnectInitialDelayMs = parsePositiveInteger(
  process.env.RECONNECT_INITIAL_DELAY_MS,
  60_000,
);
const reconnectMaxDelayMs = Math.max(
  reconnectInitialDelayMs,
  parsePositiveInteger(process.env.RECONNECT_MAX_DELAY_MS, 300_000),
);

const config = {
  discord: {
    token: process.env.DISCORD_TOKEN || 'MTUwMTI3MzQwMzYxNTYwODkzMw.G3NpUO.273J6gmjweXKhieKg6qjqsm7MpXDi-IvZ6ZHuY',
    clientId: process.env.CLIENT_ID || '1501273403615608933',
    guildId: process.env.GUILD_ID || '1398568016915992667',
    statusChannelId: process.env.STATUS_CHANNEL_ID || '',
  },
  server: {
    ip: process.env.MC_SERVER_IP || 'the-cottage-c1-s4.play.hosting',
    port: parsePositiveInteger(process.env.MC_SERVER_PORT, 25565),
    version: process.env.MC_SERVER_VERSION === 'auto'
      ? false
      : (process.env.MC_SERVER_VERSION || '1.21.11'),
  },
  bot: {
    username: process.env.MC_USERNAME || 'Server',
    password: process.env.MC_PASSWORD || '',
    auth: process.env.MC_AUTH || 'offline',
  },
  reconnect: {
    initialDelayMs: reconnectInitialDelayMs,
    maxDelayMs: reconnectMaxDelayMs,
  },
};

const missing = [];
if (!config.discord.token) missing.push('DISCORD_TOKEN');
if (!config.discord.clientId) missing.push('CLIENT_ID');
if (!config.discord.guildId) missing.push('GUILD_ID');
if (!config.server.ip) missing.push('MC_SERVER_IP');

if (missing.length > 0) {
  console.error(`[Config] Missing required environment variables: ${missing.join(', ')}.`);
  console.error('[Config] Add the missing values and restart the bot.');
  process.exit(1);
}

module.exports = config;