'use strict';

require('dotenv').config();

const discordToken = String(process.env.DISCORD_TOKEN || '').trim();
const minecraftPassword = String(process.env.MC_PASSWORD || '');
const sparkLoginPassword = String(process.env.MC_LOGIN_PASSWORD || '');
const minecraftHost = String(process.env.MC_SERVER_HOST || '').trim();
const minecraftPort = Number.parseInt(process.env.MC_SERVER_PORT || '', 10);
const bedrockPort = Number.parseInt(process.env.MC_BEDROCK_PORT || '', 10);

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

const primaryGuildId = '1398568016915992667';
const additionalGuildIds = parseDiscordIdList(
  process.env.DISCORD_ADDITIONAL_GUILD_IDS,
);
const configuredGuildIds = [...new Set([
  primaryGuildId,
  ...additionalGuildIds,
])];

const config = {
  discord: {
    token: discordToken,
    clientId: '1501273403615608933',
    // Keep the original Cottage guild as the primary server for its relay and
    // status channels. Additional guilds receive shared commands and AI.
    guildId: primaryGuildId,
    guildIds: configuredGuildIds,
    statusChannelId: '1551186617635704832',
    chatChannelId: '1551228249214820483',
    errorChannelId: String(process.env.ERROR_CHANNEL_ID || '').trim(),
  },

  // Privileged identities are supplied by the host environment, not committed
  // to this public repository. Configure at least one user ID or role ID.
  adminUserIds,
  adminRoleIds,

  server: {
    // Connection details are private deployment configuration, never committed.
    ip: minecraftHost || null,
    port: Number.isInteger(minecraftPort) && minecraftPort > 0 && minecraftPort <= 65535
      ? minecraftPort
      : null,
    bedrockPort: Number.isInteger(bedrockPort) && bedrockPort > 0 && bedrockPort <= 65535
      ? bedrockPort
      : null,
    version: 'Paper 26.3',
    clientProtocolVersion: '1.21.11',
  },

  bot: {
    username: 'Server',
    password: minecraftPassword,
    sparkLoginPassword,
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

if (minecraftHost && (!Number.isInteger(minecraftPort) || minecraftPort <= 0 || minecraftPort > 65535)) {
  missing.push('a valid MC_SERVER_PORT when MC_SERVER_HOST is configured');
}
if (Number.isInteger(minecraftPort) && minecraftPort > 0 && !minecraftHost) {
  missing.push('MC_SERVER_HOST when MC_SERVER_PORT is configured');
}
if (Number.isInteger(bedrockPort) && (bedrockPort <= 0 || bedrockPort > 65535)) {
  missing.push('a valid MC_BEDROCK_PORT');
}

const invalidGuildIds = config.discord.guildIds
  .filter(id => !/^[0-9]{17,20}$/.test(id));

if (invalidGuildIds.length > 0) {
  missing.push('valid Discord snowflake IDs in DISCORD_ADDITIONAL_GUILD_IDS');
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
