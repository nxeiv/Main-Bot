'use strict';

require('dotenv').config();

const discordToken = String(process.env.DISCORD_TOKEN || '').trim();
const minecraftPassword = String(process.env.MC_PASSWORD || '');

function parseDiscordIdList(value) {
  return [...new Set(
    String(value || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean),
  )];
}

const adminUserIds = parseDiscordIdList(process.env.ADMIN_USER_IDS);
const adminRoleIds = parseDiscordIdList(process.env.ADMIN_ROLE_IDS);

const config = {
  discord: {
    token: discordToken,
    clientId: '1501273403615608933',
    guildId: '1398568016915992667',
    statusChannelId: '1551186617635704832',
    chatChannelId: '1551228249214820483',
    errorChannelId: String(process.env.ERROR_CHANNEL_ID || '').trim(),
  },

  // Privileged identities are supplied by the host environment, not committed
  // to this public repository. Configure at least one user ID or role ID.
  adminUserIds,
  adminRoleIds,

  // Central feature access policy.
  // Change a feature here instead of editing permission checks throughout the bot.
  featureAccess: {
    help: 'public',
    status: 'admin',
    dashboard: 'admin',
    start: 'admin',
    stop: 'admin',
    forget: 'public',
    aforeget: 'admin',
    ai: 'admin',
    summarize: 'public',
    ping: 'admin',
  },

  server: {
    ip: 'the-cottage-c1-s6.playwithbao.com',
    port: 34159,
    version: 'Paper 26.2',
    clientProtocolVersion: '1.21.11',
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

if (config.adminUserIds.length === 0 && config.adminRoleIds.length === 0) {
  missing.push('at least one of ADMIN_USER_IDS or ADMIN_ROLE_IDS');
}

const invalidAdminIds = [...config.adminUserIds, ...config.adminRoleIds]
  .filter(id => !/^\d{17,20}$/.test(id));

if (invalidAdminIds.length > 0) {
  missing.push('valid Discord snowflake IDs in ADMIN_USER_IDS / ADMIN_ROLE_IDS');
}

if (missing.length > 0) {
  console.error(
    `[Config] Missing or invalid configuration: ${missing.join(', ')}.`,
  );
  console.error('[Config] Add the missing values and restart the bot.');
  process.exit(1);
}

module.exports = config;
