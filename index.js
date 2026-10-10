'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const {
  ActivityType,
  ChannelType,
  Client,
  Colors,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  SlashCommandBuilder,
} = require('discord.js');

const config = require('./config');
const mc = require('./minecraft');
const ai = require('./ai');
const summary = require('./summary');
const { applyUnicodeTheme } = require('./unicode');
const reminders = require('./reminders');

const scheduledAdminActions = new Map();

const runtimeHealth = {
  lastMinecraftConnectedAt: null,
  lastMinecraftDisconnectedAt: null,
  lastMinecraftDisconnectReason: null,
  lastDiscordErrorAt: null,
  lastDiscordError: null,
};

// ============================================================
// BEDROCK JOIN VIDEO FOLLOW-UP
// ============================================================

const pendingBedrockVideoRequests = new Set();

const SCHEDULE_FILE = path.join(
  __dirname,
  'scheduled-actions.json',
);

const DAILY_WELCOME_FILE = path.join(
  __dirname,
  'daily-welcomes.json',
);

let dailyWelcomeState = {
  date: '',
  players: [],
};

function getPhilippineDateKey() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function saveDailyWelcomeState() {
  try {
    fs.writeFileSync(
      DAILY_WELCOME_FILE,
      JSON.stringify(dailyWelcomeState, null, 2),
      'utf8',
    );
  } catch (error) {
    log(
      'AI',
      `Unable to save daily welcome state: ${error.message}`,
    );
  }
}

function loadDailyWelcomeState() {
  const today = getPhilippineDateKey();

  try {
    if (fs.existsSync(DAILY_WELCOME_FILE)) {
      const raw = fs.readFileSync(
        DAILY_WELCOME_FILE,
        'utf8',
      );

      if (raw.trim()) {
        const saved = JSON.parse(raw);

        if (
          saved &&
          saved.date === today &&
          Array.isArray(saved.players)
        ) {
          dailyWelcomeState = {
            date: today,
            players: saved.players.filter(
              player => typeof player === 'string',
            ),
          };

          return;
        }
      }
    }
  } catch (error) {
    log(
      'AI',
      `Unable to load daily welcome state: ${error.message}`,
    );
  }

  dailyWelcomeState = {
    date: today,
    players: [],
  };

  saveDailyWelcomeState();
}

function shouldWelcomePlayer(username) {
  const today = getPhilippineDateKey();

  if (dailyWelcomeState.date !== today) {
    dailyWelcomeState = {
      date: today,
      players: [],
    };
  }

  if (dailyWelcomeState.players.includes(username)) {
    return false;
  }

  dailyWelcomeState.players.push(username);
  saveDailyWelcomeState();

  return true;
}

loadDailyWelcomeState();

const PERSISTABLE_ADMIN_ACTIONS = new Set([
  'start',
  'stop',
  'maintenance',
]);

function saveScheduledAdminActions() {
  try {
    const schedules = [...scheduledAdminActions.values()].map(task => ({
      id: task.id,
      action: task.action,
      executeAt: task.executeAt,
      scheduledAt: task.scheduledAt,
      scheduledBy: task.scheduledBy || null,
      channelId: task.channelId || null,
    }));

    fs.writeFileSync(
      SCHEDULE_FILE,
      JSON.stringify(schedules, null, 2),
      'utf8',
    );

    log(
      'Scheduler',
      `Saved ${schedules.length} scheduled action(s) to disk.`,
    );
  } catch (error) {
    log(
      'Scheduler',
      `Unable to save scheduled actions: ${error.message}`,
    );
  }
}

function loadScheduledAdminActions() {
  try {
    if (!fs.existsSync(SCHEDULE_FILE)) {
      return [];
    }

    const raw = fs.readFileSync(
      SCHEDULE_FILE,
      'utf8',
    );

    if (!raw.trim()) {
      return [];
    }

    const schedules = JSON.parse(raw);

    if (!Array.isArray(schedules)) {
      throw new Error('Schedule file must contain a JSON array.');
    }

    return schedules.filter(task => (
      task &&
      PERSISTABLE_ADMIN_ACTIONS.has(task.action) &&
      Number.isSafeInteger(task.executeAt) &&
      task.executeAt > 0
    ));
  } catch (error) {
    log(
      'Scheduler',
      `Unable to load scheduled actions: ${error.message}`,
    );

    return [];
  }
}

const USER_AFK_FILE = path.join(
  __dirname,
  'user-afk.json',
);

const userAfkStatuses = new Map();

function saveUserAfkStatuses() {
  try {
    const serializedStatuses = Object.fromEntries(
      userAfkStatuses.entries(),
    );

    fs.writeFileSync(
      USER_AFK_FILE,
      JSON.stringify(serializedStatuses, null, 2),
      'utf8',
    );
  } catch (error) {
    log(
      'AFK',
      `Unable to save user AFK statuses: ${error.message}`,
    );
  }
}

function loadUserAfkStatuses() {
  try {
    if (!fs.existsSync(USER_AFK_FILE)) {
      return;
    }

    const raw = fs.readFileSync(USER_AFK_FILE, 'utf8');

    if (!raw.trim()) {
      return;
    }

    const saved = JSON.parse(raw);

    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
      throw new Error('user-afk.json must contain a JSON object.');
    }

    for (const [userId, status] of Object.entries(saved)) {
      if (
        typeof userId === 'string' &&
        status &&
        typeof status === 'object' &&
        typeof status.reason === 'string' &&
        Number.isSafeInteger(status.setAt) &&
        status.setAt > 0
      ) {
        userAfkStatuses.set(userId, {
          reason: status.reason.slice(0, 200),
          setAt: status.setAt,
        });
      }
    }
  } catch (error) {
    log(
      'AFK',
      `Unable to load user AFK statuses: ${error.message}`,
    );
  }
}

function setUserAfk(userId, reason = 'AFK') {
  const normalizedReason = String(reason || '').trim() || 'AFK';

  userAfkStatuses.set(userId, {
    reason: normalizedReason.slice(0, 200),
    setAt: Date.now(),
  });

  saveUserAfkStatuses();
}

function clearUserAfk(userId) {
  const cleared = userAfkStatuses.delete(userId);

  if (cleared) {
    saveUserAfkStatuses();
  }

  return cleared;
}

function getUserAfk(userId) {
  return userAfkStatuses.get(userId) || null;
}

loadUserAfkStatuses();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const commands = [
  new SlashCommandBuilder()
    .setName('start')
    .setDescription('▶ Starts the Minecraft AFK session'),

  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('■ Stops the Minecraft AFK session'),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('ⓘ Shows Minecraft AFK status'),

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
    .setName('remind')
    .setDescription('Creates a personal reminder')
    .addStringOption(option =>
      option
        .setName('duration')
        .setDescription('How long from now, such as 30m, 2h, or 1d')
        .setRequired(true),
    )
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('What you want to be reminded about')
        .setMaxLength(500)
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName('reminders')
    .setDescription('Lists your active reminders'),

  new SlashCommandBuilder()
    .setName('remind-cancel')
    .setDescription('Cancels one of your reminders')
    .addStringOption(option =>
      option
        .setName('id')
        .setDescription('Reminder ID from /reminders')
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName('maintenance')
    .setDescription(
      '⚒︎ Announces server maintenance DO NOT USE IF NOT SMP MODERATOR.',
    ),

  new SlashCommandBuilder()
    .setName('forget')
    .setDescription('⌫ Forgets your AI conversation context'),

  new SlashCommandBuilder()
    .setName('aforget')
    .setDescription('⌫ Forgets all AI conversation contexts (admin only)'),

  new SlashCommandBuilder()
    .setName('ai')
    .setDescription('◉ AI diagnostics (admin only)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('ⓘ Shows AI health and queue diagnostics'),
    ),

  new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('◎ Shows Discord, Minecraft, and AI health'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('ⓘ Shows Cottage★ commands and features'),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Shows the bot latency'),

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

function log(tag, message) {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${timestamp}] [${tag}] ${message}`);
}


function getPublicMinecraftStatus() {
  const status = mc.getStatus();

  let state = 'offline';

  if (status.connected) {
    state = 'online';
  } else if (status.connecting) {
    state = 'connecting';
  } else if (status.reconnecting) {
    state = 'reconnecting';
  }

  return {
    online: status.connected,
    state,
    players: Number.isSafeInteger(status.playerCount)
      ? status.playerCount
      : 0,
    uptime: Number.isSafeInteger(status.uptime)
      ? status.uptime
      : 0,
    reconnectAttempts: Number.isSafeInteger(status.reconnectAttempts)
      ? status.reconnectAttempts
      : 0,
    checkedAt: new Date().toISOString(),
  };
}

function getAllowedStatusOrigins() {
  return String(process.env.STATUS_ALLOWED_ORIGINS || '*')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

function applyStatusCors(request, response) {
  const requestOrigin = request.headers.origin;
  const allowedOrigins = getAllowedStatusOrigins();

  if (allowedOrigins.includes('*')) {
    response.setHeader('Access-Control-Allow-Origin', '*');
  } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    response.setHeader('Access-Control-Allow-Origin', requestOrigin);
  }

  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function startStatusServer() {
  const port = Number(process.env.PORT || process.env.STATUS_PORT || 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    log('Web', `Invalid status server port: ${port}`);
    return;
  }

  const server = http.createServer((request, response) => {
    applyStatusCors(request, response);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method !== 'GET') {
      response.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    if (request.url === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({
        ok: true,
        service: 'The Cottage★ Main Bot',
        checkedAt: new Date().toISOString(),
      }));
      return;
    }

    if (request.url === '/api/status') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(getPublicMinecraftStatus()));
      return;
    }

    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Not Found' }));
  });

  server.on('error', error => {
    log('Web', `Status server error: ${error.message}`);
  });

  server.listen(port, '0.0.0.0', () => {
    log('Web', `Status API listening on 0.0.0.0:${port}`);
  });

  return server;
}

function isAdmin(userId, member = null) {
  if (config.adminUserIds?.includes(userId)) {
    return true;
  }

  return Boolean(
    member?.roles?.cache?.some(role =>
      config.adminRoleIds?.includes(role.id),
    ),
  );
}

function hasFeatureAccess(feature, userId, member = null) {
  const access = config.featureAccess?.[feature] || 'admin';

  if (access === 'public') {
    return true;
  }

  if (access === 'admin' || access === 'moderator') {
    return isAdmin(userId, member);
  }

  if (access === 'owner') {
    return config.adminUserIds?.includes(userId);
  }

  return false;
}

async function requireFeatureAccess(interaction, feature) {
  if (hasFeatureAccess(
    feature,
    interaction.user.id,
    interaction.member,
  )) {
    return true;
  }

  await interaction.reply({
    content: '✕ You are not authorized to use this command.',
    flags: MessageFlags.Ephemeral,
  });

  return false;
}

function getDiscordAiSessionId(message) {
  const guildId = message.guild?.id || 'dm';
  const channelId = message.channel?.id || 'unknown-channel';
  return `discord:${guildId}:${channelId}:${message.author.id}`;
}

function getInteractionAiSessionId(interaction) {
  const guildId = interaction.guildId || 'dm';
  const channelId = interaction.channelId || 'unknown-channel';
  return `discord:${guildId}:${channelId}:${interaction.user.id}`;
}

function shortenStack(error, limit = 1200) {
  const stack = String(error?.stack || error?.message || error || 'Unknown error');
  return stack.length > limit
    ? `${stack.slice(0, limit - 3)}...`
    : stack;
}

async function reportErrorToDiscord(error, context = 'Main Bot') {
  const channelId = config.discord.errorChannelId;

  log(
    'Error',
    `${context}: ${error?.stack || error?.message || error || 'Unknown error'}`,
  );

  if (!channelId) return;

  try {
    const channel = await client.channels.fetch(channelId);

    if (!channel?.isTextBased()) return;

    await channel.send({
      embeds: [{
        color: Colors.Red,
        title: '✕ Main Bot Error',
        fields: [
          {
            name: 'Component',
            value: shorten(context, 256),
          },
          {
            name: 'Error',
            value: shortenStack(error),
          },
        ],
        footer: { text: 'The Cottage★ Diagnostics' },
        timestamp: new Date().toISOString(),
      }],      allowedMentions: { parse: [] },    });
  } catch (reportError) {
    console.error(
      '[Error] Unable to send Discord error report:',
      reportError?.message || reportError,
    );
  }
}

function getDiscordConnectionState() {
  if (!client.isReady()) return 'Starting';
  return client.ws.status === 0 ? 'Connected' : 'Reconnecting / unavailable';
}
function getDiscordPing() {
  const ping = Number(client.ws.ping);

  if (!Number.isFinite(ping) || ping < 0) {
    return 0;
  }

  return Math.round(ping);
}

function getBackyardState() {
  const status = mc.getStatus();

  if (status.connected) return 'awake';
  if (status.connecting) return 'waking up';
  if (status.reconnecting) return 'trying to wake up';
  return 'asleep';
}

function isLikelyAdminRequest(text) {
  const normalized = String(text || '').toLowerCase().trim();

  if (!normalized) {
    return false;
  }

  const adminPatterns = [
    // Start / stop
    /\b(start|start up|turn on|bring up|connect)\b.*\b(bot|afk|server|session)\b/,
    /\b(start|start up|turn on|bring up|connect)\b/,
    /\b(stop|shut down|turn off|disconnect)\b.*\b(bot|afk|server|session)\b/,
    /\b(stop|shut down|turn off|disconnect)\b/,

    // Status
    /\b(status|state|uptime)\b.*\b(server|bot|afk|session)\b/,
    /\b(server|bot|afk|session)\b.*\b(status|state|uptime)\b/,
    /^\s*(status|state|uptime)\??\s*$/,

    // Maintenance
    /\b(maintenance|maint)\b/,
    /\b(put|place|set|take)\b.*\bserver\b.*\bmaintenance\b/,

    // Restart
    /\b(restart|reboot)\b.*\b(server|bot|afk|session)\b/,
    /\b(server|bot|afk|session)\b.*\b(restart|reboot)\b/,

    // Cancel / scheduling
    /\b(cancel|unschedule)\b.*\b(all|everything|every|schedule|schedules|scheduled actions|scheduled tasks)\b/,
    /\b(cancel|unschedule)\b.*\b(start|stop|status|maintenance|restart|reboot)\b/,
    /\b(schedule|scheduled|in \d+ ?(second|seconds|minute|minutes|hour|hours)|after \d+ ?(second|seconds|minute|minutes|hour|hours))\b/,
  ];

  return adminPatterns.some(pattern => pattern.test(normalized));
}

let scheduledAdminTaskSequence = 0;

function getScheduledAdminAction(action) {
  const matchingTasks = [];

  for (const scheduled of scheduledAdminActions.values()) {
    if (scheduled.action === action) {
      matchingTasks.push(scheduled);
    }
  }

  return matchingTasks.sort(
    (a, b) => a.executeAt - b.executeAt,
  );
}

function cancelAllScheduledAdminActions() {
  const cancelledTasks = [];

  for (const [taskId, scheduled] of scheduledAdminActions.entries()) {
    clearTimeout(scheduled.timeout);
    scheduledAdminActions.delete(taskId);
    cancelledTasks.push(scheduled);
  }

  if (cancelledTasks.length > 0) {
    saveScheduledAdminActions();
  }

  return cancelledTasks;
}

function scheduleAdminAction(
  action,
  delayMs,
  execute,
  metadata = {},
) {
  if (!PERSISTABLE_ADMIN_ACTIONS.has(action)) {
    throw new Error(
      `Administrative action "${action}" cannot be persisted.`,
    );
  }

  scheduledAdminTaskSequence += 1;

  const taskId =
    `${action}-${Date.now()}-${scheduledAdminTaskSequence}`;

  const executeAt = Date.now() + delayMs;

  const timeout = setTimeout(async () => {
    scheduledAdminActions.delete(taskId);
    saveScheduledAdminActions();

    try {
      log(
        'Admin',
        `Executing scheduled action: ${action} (${taskId})`,
      );

      await execute();
    } catch (error) {
      log(
        'Admin',
        `Scheduled action "${action}" (${taskId}) failed: ${error.message}`,
      );
    }
  }, delayMs);

  scheduledAdminActions.set(taskId, {
    id: taskId,
    action,
    timeout,
    executeAt,
    scheduledAt: Date.now(),
    ...metadata,
  });

  saveScheduledAdminActions();

  return executeAt;
}

function restoreScheduledAdminActions() {
  const savedSchedules = loadScheduledAdminActions();

  if (savedSchedules.length === 0) {
    log(
      'Scheduler',
      'No scheduled administrative actions to restore.',
    );

    return;
  }

  let restoredCount = 0;
  let expiredCount = 0;

  for (const savedTask of savedSchedules) {
    const remainingMs =
      savedTask.executeAt - Date.now();

    if (remainingMs <= 0) {
      expiredCount += 1;
      continue;
    }

    scheduledAdminTaskSequence += 1;

    const taskId =
      `${savedTask.action}-${Date.now()}-${scheduledAdminTaskSequence}`;

    const timeout = setTimeout(async () => {
      scheduledAdminActions.delete(taskId);

      saveScheduledAdminActions();

      try {
        log(
          'Admin',
          `Executing restored scheduled action: ${savedTask.action} (${taskId})`,
        );

        const result =
          await executeAdministrativeAction(
            savedTask.action,
          );

        log(
          'Admin',
          `Restored scheduled ${savedTask.action} completed: ${result}`,
        );

        await notifyScheduledActionCompletion({
          ...savedTask,
          id: taskId,
          timeout: undefined,
        });
      } catch (error) {
        log(
          'Admin',
          `Restored scheduled action "${savedTask.action}" (${taskId}) failed: ${error.message}`,
        );
      }
    }, remainingMs);

    scheduledAdminActions.set(taskId, {
      ...savedTask,
      id: taskId,
      timeout,
    });

    restoredCount += 1;

    log(
      'Scheduler',
      `Restored ${savedTask.action} scheduled for ${new Date(savedTask.executeAt).toISOString()}.`,
    );
  }

  saveScheduledAdminActions();

  log(
    'Scheduler',
    `Restored ${restoredCount} scheduled action(s). Skipped ${expiredCount} expired action(s).`,
  );
}

async function executeAdministrativeAction(action) {
  switch (action) {
    case 'start': {
      const status = mc.getStatus();

      if (
        status.connected ||
        status.connecting ||
        status.reconnecting
      ) {
        log(
          'Admin',
          'Start request ignored because the Minecraft bot is already active.',
        );

        return 'already active';
      }

      mc.start();

      return 'started';
    }

    case 'stop': {
      const status = mc.getStatus();

      if (
        !status.connected &&
        !status.connecting &&
        !status.reconnecting
      ) {
        log(
          'Admin',
          'Stop request ignored because the Minecraft bot is already stopped.',
        );

        return 'already stopped';
      }

      mc.stop();

      return 'stopped';
    }

    case 'maintenance': {
      const maintenanceChannel = await client.channels.fetch(
        config.discord.maintenanceChannelId,
      );

      if (!maintenanceChannel?.isTextBased()) {
        throw new Error(
          'The configured maintenance channel is not a text channel.',
        );
      }

      await maintenanceChannel.send(
        '# 🛠️ **Server is under maintenance** <@&1447218476795166791>',
      );

      return 'maintenance announced';
    }

    default:
          
      throw new Error(
        `Unsupported administrative action: ${action}`,
      );
  }
}

async function notifyScheduledActionCompletion(task) {
  if (!task.channelId) {
    return;
  }

  try {
    const channel = await client.channels.fetch(
      task.channelId,
    );

    if (!channel?.isTextBased()) {
      return;
    }

await channel.send(
  `✓ Scheduled **${task.action}** action completed.`,
);
      
  } catch (error) {
    log(
      'Admin',
      `Unable to send scheduled action confirmation: ${error.message}`,
    );
  }
}

function formatUptime(totalSeconds) {
  if (!totalSeconds) return '0s';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    hours && `${hours}h`,
    minutes && `${minutes}m`,
    `${seconds}s`,
  ].filter(Boolean).join(' ');
}

function formatAfkDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);

  if (seconds || parts.length === 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(' ');
}
function formatDelay(delayMs) {
  const seconds = Math.round(delayMs / 1000);
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `${seconds} seconds`;
}

function getBotState(status) {
  if (status.connected) return 'Online';
  if (status.connecting || status.reconnecting) return 'Reconnecting';
  return 'Offline';
}

function createEmbed(title, color) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setFooter({ text: 'By Makkrabb' })
    .setTimestamp();
}

function forgetUserConversation(userId) {
  ai.resetUserConversation(userId);
  return '⌫ Your AI conversation context has been forgotten. You can start fresh now.';
}

function forgetAllConversations() {
  ai.resetConversation();
  return '⌫ All AI conversation contexts have been forgotten.';
}

function buildStatusEmbed(status, title, color) {
  return createEmbed(title, color)
    .addFields(
      { name: 'Server', value: `\`${status.server}\``, inline: true },
      { name: 'Bot Status', value: getBotState(status), inline: true },
      { name: 'Players Online', value: String(status.playerCount), inline: true },
      {
        name: 'Uptime',
        value: status.connected ? formatUptime(status.uptime) : 'Not connected',
        inline: true,
      },
      {
        name: 'Reconnect Attempts',
        value: String(status.reconnectAttempts),
        inline: true,
      },
      { name: 'Bot Name', value: `\`${config.bot.username}\``, inline: true },
    );
}

function buildDashboardEmbed() {
  const mcStatus = mc.getStatus();
  const aiStatus = ai.getAiDiagnostics();
  const readyAt = client.readyAt || new Date();
  const botUptime = Math.max(
    0,
    Math.floor((Date.now() - readyAt.getTime()) / 1000),
  );

  const mcState = mcStatus.connected
    ? '✓ Online'
    : mcStatus.connecting || mcStatus.reconnecting
      ? '⚠︎ Reconnecting'
      : '✕ Offline';

  const aiState = aiStatus.configuredKeys > 0
    ? '✓ Configured'
    : '✕ Unconfigured';

  return createEmbed(
    'The Cottage★ Main Bot',
    mcStatus.connected ? Colors.Green : Colors.Blurple,
  )
    .setDescription('◎ Unified Discord, Minecraft, and AI health')
    .addFields(
      {
        name: 'Discord',
        value: `${getDiscordConnectionState()}\nUptime: ${formatUptime(botUptime)}`,
        inline: true,
      },
      {
        name: 'Minecraft',
        value:
          `${mcState}\nPlayers: ${mcStatus.playerCount}\nReconnects: ${mcStatus.reconnectAttempts}`,
        inline: true,
      },
      {
        name: 'AI',
        value:
          `${aiState}\nQueue: ${aiStatus.queuedRequests}/${aiStatus.queueLimit}\nSessions: ${aiStatus.conversationSessions}`,
        inline: true,
      },
      {
        name: 'AI Model',
        value: `\`${aiStatus.model}\`\nContext: ${aiStatus.contextLimitMessages} messages`,
        inline: true,
      },
      {
        name: 'Minecraft Uptime',
        value: mcStatus.connected ? formatUptime(mcStatus.uptime) : 'Not connected',
        inline: true,
      },
      {
        name: 'Active Cooldowns',
        value: String(aiStatus.activeCooldowns),
        inline: true,
      },
      {
        name: 'AI Requests',
        value: String(aiStatus.totalRequests),
        inline: true,
      },
      {
        name: 'AI Errors',
        value: String(aiStatus.totalErrors),
        inline: true,
      },
    );
}

function buildDashboardComponents() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('dashboard:refresh')
      .setLabel('↻ Refresh')
      .setStyle(ButtonStyle.Secondary),
  );
}

function shorten(text, limit = 1000) {
  const normalized = String(text || 'Unknown reason').replace(/\s+/g, ' ').trim();
  return normalized.length > limit
    ? `${normalized.slice(0, limit - 3)}...`
    : normalized;
}

let applicationIdMismatchLogged = false;

function getDiscordApplicationId() {
  const runtimeApplicationId = client.user?.id;
  const configuredApplicationId = String(
    config.discord.clientId || '',
  ).trim();

  if (
    runtimeApplicationId &&
    configuredApplicationId &&
    runtimeApplicationId !== configuredApplicationId &&
    !applicationIdMismatchLogged
  ) {
    applicationIdMismatchLogged = true;

    log(
      'Discord',
      `Configured clientId (${configuredApplicationId}) does not match the logged-in bot application (${runtimeApplicationId}). Using the logged-in application ID for command registration.`,
    );
  }

  return runtimeApplicationId || configuredApplicationId;
}

const discordRest = new REST({ version: '10' }).setToken(config.discord.token);

discordRest.on('rateLimited', info => {
  const retryAfterMs = Number(info?.retryAfter || 0);
  const retryAfter = Number.isFinite(retryAfterMs)
    ? `${Math.max(0, Math.round(retryAfterMs))}ms`
    : 'unknown';

  log(
    'Discord',
    `REST rate limit encountered: ${info?.method || 'UNKNOWN'} ${info?.route || 'unknown route'} | scope=${info?.scope || 'unknown'} | retryAfter=${retryAfter} | limit=${info?.limit ?? 'unknown'}.`,
  );
});

function getSlashCommandRoute() {
  return Routes.applicationGuildCommands(
    getDiscordApplicationId(),
    config.discord.guildId,
  );
}

async function replaceSlashCommandsInBulk(source = 'Registrar') {
  const route = getSlashCommandRoute();

  const replaced = await discordRest.put(route, {
    body: commands.map(command =>
      typeof command?.toJSON === 'function'
        ? command.toJSON()
        : command,
    ),
  });

  const replacedCount = Array.isArray(replaced)
    ? replaced.length
    : commands.length;

  log(
    'Discord',
    `${source}: Replaced the guild slash-command set in bulk (${replacedCount}/${commands.length}).`,
  );

  return {
    existing: 0,
    expected: commands.length,
    created: replacedCount,
    updated: 0,
    removed: 0,
    replaced: true,
  };
}

async function reconcileSlashCommands(source = 'Registrar') {
  const rest = discordRest;
  const route = getSlashCommandRoute();

  const expectedByName = new Map(
    commands.map(command => [command.name, command]),
  );

  const existing = await rest.get(route);

  log(
    'Discord',
    `${source}: Discord currently reports ${existing.length} guild command(s).`,
  );

  // An empty command set is best repaired with one bulk overwrite instead of
  // creating every command individually. This is both faster and much gentler
  // on Discord's REST limits.
  if (existing.length === 0 && commands.length > 0) {
    return replaceSlashCommandsInBulk(source);
  }

  const existingByName = new Map(
    existing.map(command => [command.name, command]),
  );

  let created = 0;
  let updated = 0;
  let removed = 0;

  // Create only genuinely missing commands. This gives them a new Discord
  // command ID once, while leaving all existing command IDs untouched.
  for (const command of commands) {
    const current = existingByName.get(command.name);

    if (!current) {
      const createdCommand = await rest.post(route, {
        body: command,
      });

      created += 1;

      log(
        'Discord',
        `${source}: Created missing command /${createdCommand.name} (${createdCommand.id}).`,
      );

      continue;
    }

    // Update an existing command in place only when its definition changed.
    // Keeping the command ID is important because Discord stores command-level
    // Integration permission overrides against that command.
    //
    // Discord may return additional materialized/default fields that were not
    // present in the builder's JSON. Compare the fields we actually declare
    // instead of requiring Discord's response to match byte-for-byte.
    const commandsMatch = (desiredValue, actualValue) => {
      if (Array.isArray(desiredValue)) {
        // Discord may omit empty arrays such as `options: []` from GET
        // responses. Treat an omitted empty collection as equivalent.
        if (
          desiredValue.length === 0 &&
          (actualValue === undefined || actualValue === null)
        ) {
          return true;
        }

        if (          !Array.isArray(actualValue) ||
          desiredValue.length !== actualValue.length        ) {
          return false;
        }

        return desiredValue.every((item, index) =>
          commandsMatch(item, actualValue[index]),
        );
      }

      if (desiredValue && typeof desiredValue === 'object') {
        if (
          !actualValue ||
          typeof actualValue !== 'object' ||
          Array.isArray(actualValue)
        ) {
          return false;
        }

        return Object.entries(desiredValue).every(([key, child]) => {
          if (child === undefined) {
            return true;
          }

          if (child === null) {
            return actualValue[key] === null || actualValue[key] === undefined;
          }

          return commandsMatch(child, actualValue[key]);
        });
      }

      return desiredValue === actualValue;
    };

    if (!commandsMatch(command, current)) {
      const updatedCommand = await rest.patch(
        Routes.applicationGuildCommand(
          getDiscordApplicationId(),
          config.discord.guildId,
          current.id,
        ),
        { body: command },
      );

      updated += 1;

      log(
        'Discord',
        `${source}: Updated command /${updatedCommand.name} in place (${updatedCommand.id}).`,
      );
    }
  }

  // Remove only commands the bot no longer declares.
  for (const current of existing) {
    if (expectedByName.has(current.name)) {
      continue;
    }

    await rest.delete(
      Routes.applicationGuildCommand(
        getDiscordApplicationId(),
        config.discord.guildId,
        current.id,
      ),
    );

    removed += 1;

    log(
      'Discord',
      `${source}: Removed unexpected command /${current.name} (${current.id}).`,
    );
  }

  return {
    existing: existing.length,
    expected: commands.length,
    created,
    updated,
    removed,
  };
}

async function registerCommands() {
  try {
    const result = await reconcileSlashCommands('Registrar');

    log(
      'Discord',
      `Slash command reconciliation complete: ${result.created} created, ${result.updated} updated, ${result.removed} removed.`,
    );
  } catch (error) {
    log(
      'Discord',
      `Unable to reconcile slash commands: ${error.message}`,
    );
  }
}

let commandWatchdogRunning = false;
let consecutiveEmptyCommandReports = 0;
const EMPTY_COMMAND_REPORT_CONFIRMATIONS = 3;
const COMMAND_WATCHDOG_INTERVAL_MS = 15 * 60 * 1000;

async function commandWatchdog() {
  if (commandWatchdogRunning) return;

  commandWatchdogRunning = true;

  try {
    const rest = discordRest;
    const route = getSlashCommandRoute();

    const existing = await rest.get(route);

    log(
      'Discord',
      `Watchdog: Discord currently reports ${existing.length} guild command(s).`,
    );

    // A single empty response can be transient, so do not recreate commands
    // immediately. If Discord reports zero repeatedly, treat it as a real
    // missing-command condition and allow reconciliation to repair it.
    if (existing.length === 0 && commands.length > 0) {
      consecutiveEmptyCommandReports += 1;

      if (
        consecutiveEmptyCommandReports <
        EMPTY_COMMAND_REPORT_CONFIRMATIONS
      ) {
        log(
          'Watchdog',
          `Discord returned 0 guild commands. Waiting for confirmation (${consecutiveEmptyCommandReports}/${EMPTY_COMMAND_REPORT_CONFIRMATIONS}) before attempting repair.`,
        );
        return;
      }

      log(
        'Watchdog',
        `Discord returned 0 guild commands ${consecutiveEmptyCommandReports} times consecutively. Performing one bulk command replacement instead of individual creates.`,
      );

      const result = await replaceSlashCommandsInBulk('Watchdog');

      consecutiveEmptyCommandReports = 0;

      log(
        'Watchdog',
        `Slash command bulk repair complete: ${result.created}/${result.expected} command(s) replaced in one request.`,
      );

      return;
    } else {
      consecutiveEmptyCommandReports = 0;
    }

    const expectedNames = new Set(
      commands.map(command => command.name),
    );
    const existingNames = new Set(
      existing.map(command => command.name),
    );

    const missingNames = commands
      .filter(command => !existingNames.has(command.name))
      .map(command => command.name);

    const unexpectedNames = existing
      .filter(command => !expectedNames.has(command.name))
      .map(command => command.name);

    if (missingNames.length === 0 && unexpectedNames.length === 0) {
      log(
        'Watchdog',
        `Slash commands OK (${existing.length}/${commands.length}); definitions are managed by startup reconciliation.`,
      );
    } else {
      log(
        'Watchdog',
        `Slash command set drift detected. Missing: ${missingNames.join(', ') || 'none'}; unexpected: ${unexpectedNames.join(', ') || 'none'}.`,
      );

      const result = await reconcileSlashCommands('Watchdog');

      log(
        'Watchdog',
        `Slash command repair complete: ${result.created} created, ${result.updated} updated, ${result.removed} removed.`,
      );
    }
  } catch (error) {
    log(
      'Watchdog',
      `Command check failed: ${error.message}`,
    );
  } finally {
    commandWatchdogRunning = false;
  }
}

async function notifyChannel(embed) {
  if (!config.discord.statusChannelId) return;

  try {
    const channel = await client.channels.fetch(config.discord.statusChannelId);
    if (!channel?.isTextBased()) {
      log('Discord', 'The configured status channel is not a text channel.');
      return;
    }
    await channel.send({ embeds: [embed] });
  } catch (error) {
    log('Discord', `Unable to send a status update: ${error.message}`);
  }
}

function updatePresence() {
  if (!client.user) return;

  const status = mc.getStatus();
  const reconnecting = status.connecting || status.reconnecting;

  const presence = status.connected
    ? {
      status: 'online',
      activities: [{
        name: `Minecraft: The Cottage★ SMP★`,
        type: ActivityType.Playing,
      }],
    }
    : reconnecting
      ? {
        status: 'idle',
        activities: [{
          name: `Watching #minecraft-server⛏︎`,
          type: ActivityType.Watching,
        }],
      }
      : {
        status: 'dnd',
        activities: [{
          name: 'Offline - use /start',
          type: ActivityType.Watching,
        }],
      };

  client.user.setPresence(presence);
}

mc.emitter.on('connected', ({ version }) => {
  runtimeHealth.lastMinecraftConnectedAt = Date.now();
  runtimeHealth.lastMinecraftDisconnectReason = null;
  updatePresence();
  const status = mc.getStatus();
  const embed = buildStatusEmbed(status, 'Bot Connected', Colors.Green)
    .setDescription(`Connected to ${status.server} using Minecraft ${version}.`);
  void notifyChannel(embed);
});

mc.emitter.on('kicked', reason => {
  updatePresence();
  const embed = createEmbed('Bot Kicked', Colors.Orange)
    .setDescription(`Reason: ${shorten(reason)}`);
  void notifyChannel(embed);
});

mc.emitter.on('disconnected', reason => {
  runtimeHealth.lastMinecraftDisconnectedAt = Date.now();
  runtimeHealth.lastMinecraftDisconnectReason = String(reason || 'unknown');
  updatePresence();
});

mc.emitter.on('reconnecting', ({ attempt, delayMs }) => {
  updatePresence();
  const delay = formatDelay(delayMs);
  log('Bot', `Reconnect attempt ${attempt} is scheduled in ${delay}.`);
  const embed = createEmbed('Reconnection Scheduled', Colors.Orange)
    .setDescription(`Attempt ${attempt} will begin in ${delay}.`);
  void notifyChannel(embed);
});

mc.emitter.on('stopped', () => {
  updatePresence();
  const embed = createEmbed('Bot Stopped', Colors.Red)
    .setDescription('The AFK session was stopped. Use /start to connect again.');
  void notifyChannel(embed);
});

mc.emitter.on('minecraftChat', async ({ username, message }) => {
  const trigger = /^server[,:]?\s+/i;

  if (!trigger.test(message)) return;

  const question = message.replace(trigger, '').trim();

  if (!question) return;

  try {
    log('AI', `Minecraft ${username}: ${question}`);

const response = await ai.ask(question, {
  userId: `mc:${username}`,
  platform: 'minecraft',
});

    log('AI', `Minecraft response: ${response}`);

    mc.chat(response);
  } catch (error) {
    log(
      'AI',
      `Unable to answer Minecraft chat: ${error.message}`,
    );
  }
});

mc.emitter.on('minecraftPlayerJoined', async ({ username }) => {
  if (!username || username === config.bot.username) {
    return;
  }

  if (!shouldWelcomePlayer(username)) {
    return;
  }

  await new Promise(resolve => setTimeout(resolve, 1500));

  try {
    log('AI', `Generating daily welcome for Minecraft player ${username}.`);

    const response = await ai.ask(
      `A player named ${username} just joined The Cottage★ SMP. Give them a short, friendly in-game welcome. Mention their username, make it feel natural and welcoming, and keep it under 180 characters. Do not use Markdown, emojis, commands, server facts, or a question.`,
      {
        userId: `mc:welcome:${username}`,
        platform: 'minecraft',
      },
    );

    mc.chat(response);
    log('AI', `Sent daily welcome to ${username}: ${response}`);
  } catch (error) {
    log(
      'AI',
      `Unable to generate daily welcome for ${username}: ${error.message}`,
    );

    try {
      mc.chat(`Welcome to The Cottage★, ${username}!`);
    } catch (chatError) {
      log(
        'AI',
        `Unable to send fallback welcome to ${username}: ${chatError.message}`,
      );
    }
  }
});

mc.emitter.on('minecraftPlayerLeft', async ({ username }) => {
  if (!username) return;

  const embed = createEmbed('Player Left', Colors.Blurple)
    .setDescription(`⌂ **${username}** left The Cottage★ SMP.`);
  void notifyChannel(embed);
});


async function handlePingGatedTextShortcut({ message, question }) {
  const normalizedQuestion = String(question || '')
    .trim()
    .toLowerCase();

  const isShortcut =
    normalizedQuestion === 'start?' ||
    normalizedQuestion === 'stop?' ||
    normalizedQuestion === 'status?' ||
    normalizedQuestion === 'ai status?' ||
    normalizedQuestion === 'dashboard?' ||
    /^summarize\?\s+<\#\d+>$/.test(normalizedQuestion);

  if (!isShortcut) {
    return false;
  }

  if (normalizedQuestion === 'start?' || normalizedQuestion === 'stop?') {
    const action = normalizedQuestion === 'start?' ? 'start' : 'stop';

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
        `Ping-gated ${action} shortcut failed: ${error.message}`,
      );

      await message.reply(
        `✕ Unable to execute **${action}**: ${error.message}`,
      );
    }

    return true;
  }

  if (normalizedQuestion === 'status?') {
    if (!hasFeatureAccess('status', message.author.id, message.member)) {
      await message.reply('✕ You are not authorized to use this command.');
      return true;
    }

    await message.reply({
      embeds: [
        buildStatusEmbed(
          mc.getStatus(),
          'Status Check',
          Colors.Blurple,
        ),
      ],
    });

    return true;
  }

  if (normalizedQuestion === 'dashboard?') {
    if (!hasFeatureAccess('dashboard', message.author.id, message.member)) {
      await message.reply('✕ You are not authorized to use this command.');
      return true;
    }

    await message.reply({
      embeds: [buildDashboardEmbed()],
      components: [buildDashboardComponents()],
    });

    return true;
  }

  if (normalizedQuestion === 'ai status?') {
    if (!hasFeatureAccess('ai', message.author.id, message.member)) {
      await message.reply('✕ You are not authorized to use this command.');
      return true;
    }

    const diagnostics = ai.getAiDiagnostics();

    const embed = createEmbed(
      'AI Diagnostics',
      Colors.Blurple,
    ).addFields(
      {
        name: 'Model',
        value: `\`${diagnostics.model}\``,
        inline: true,
      },
      {
        name: 'Configured Keys',
        value: String(diagnostics.configuredKeys),
        inline: true,
      },
      {
        name: 'Active Normal Key',
        value: String(diagnostics.activeNormalKey),
        inline: true,
      },
      {
        name: 'Active Admin Key',
        value: String(diagnostics.activeAdminKey),
        inline: true,
      },
      {
        name: 'Queued Requests',
        value: `${diagnostics.queuedRequests}/${diagnostics.queueLimit}`,
        inline: true,
      },
      {
        name: 'Active Cooldowns',
        value: String(diagnostics.activeCooldowns),
        inline: true,
      },
      {
        name: 'Conversation Sessions',
        value: String(diagnostics.conversationSessions),
        inline: true,
      },
      {
        name: 'Context Limit',
        value: `${diagnostics.contextLimitMessages} messages`,
        inline: true,
      },
      {
        name: 'AI Requests',
        value: String(diagnostics.totalRequests),
        inline: true,
      },
      {
        name: 'AI Errors',
        value: String(diagnostics.totalErrors),
        inline: true,
      },
      {
        name: 'Last AI Error',
        value: diagnostics.lastError
          ? `\`${diagnostics.lastError.slice(0, 900)}\``
          : 'None recorded',
        inline: false,
      },
    ).setDescription(
      'Admin access confirmed. This view exposes health metadata only; API keys and private conversation contents are never shown.',
    );

    await message.reply({
      embeds: [embed],
    });

    return true;
  }

  const summarizeMatch = normalizedQuestion.match(
    /^summarize\?\s+<\#(\d+)>$/,
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

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) {
    return;
  }

  // ============================================================
  // BEDROCK JOIN VIDEO FOLLOW-UP
  // ============================================================

  const normalizedFollowUpMessageText = message.content
    .replace(new RegExp(`<@!?${client.user?.id}>`, 'g'), '')
    .trim()
    .toLowerCase()
    .replace(/[!?.,]+$/g, '');

  if (
    message.guild?.id === config.discord.guildId &&
    pendingBedrockVideoRequests.has(message.author.id) &&
    message.mentions.users.has(client.user?.id) &&
    normalizedFollowUpMessageText === 'yes'
  ) {
    pendingBedrockVideoRequests.delete(message.author.id);

    await message.reply(
      `Here's a video demonstration on how to join the server simply!\nhttps://discord.com/channels/1398568016915992667/1478252152169431134/1551948220312190991`,
    );

    return;
  }

  // ============================================================
  // AI FORGET BUZZWORDS
  // ============================================================

  const rawMessageText = message.content.trim();
  const normalizedMessageText = rawMessageText.toLowerCase();

  if (
    message.guild?.id === config.discord.guildId &&
    !/^afk\??(?:\s+(.+))?$/i.test(rawMessageText)
  ) {
    const afkStatus = getUserAfk(message.author.id);

    if (afkStatus) {
      const afkDuration = formatAfkDuration(
        Date.now() - afkStatus.setAt,
      );

      clearUserAfk(message.author.id);

      log(
        'AFK',
        `${message.author.tag} returned; cleared their AFK status after ${afkDuration}.`,
      );
    }
  }

  // ============================================================
  // PRIVATE DISCORD -> MINECRAFT RELAY
  // ============================================================

  if (message.channel.id === config.discord.chatChannelId) {
    const text = message.content.trim();

    if (!text) {
      return;
    }

    try {
      mc.chat(text);
      await message.react('✅');
    } catch (error) {
      log(
        'Chat',
        `Unable to send Discord message to Minecraft: ${error.message}`,
      );

      await message.reply(
        '✕ The AFK bot is currently not connected to Minecraft.',      );
    }

    return;
  }
  // ============================================================
  // MAIN BOT MENTION
  // ============================================================

  const botDirectMentionRegex = new RegExp(
    `<@!?${client.user.id}>`,
  );

  const isDirectBotMention =
    client.user &&
    botDirectMentionRegex.test(message.content);

  let isReplyToBot =
    Boolean(client.user) &&
    message.mentions.repliedUser?.id === client.user.id;

  let replyTargetMessage = null;

  if (message.reference?.messageId) {
    try {
      replyTargetMessage = await message.channel.messages.fetch(
        message.reference.messageId,
      );

      isReplyToBot =
        isReplyToBot ||
        (Boolean(client.user) &&
          replyTargetMessage.author.id === client.user.id);
    } catch (error) {
      log(
        'Discord',
        `Unable to resolve reply target: ${error.message}`,
      );
    }
  }

  if (
    message.guild?.id === config.discord.guildId &&
    client.user &&
    (isDirectBotMention || isReplyToBot)
  ) {
const botMentionRegex = new RegExp(
  `<@!?${client.user.id}>`,
  'g',
);

const question = message.content
  .replace(botMentionRegex, '')
  .trim();

const normalizedQuestion = question
  .toLowerCase()
  .trim();

if (!question && !isReplyToBot) {
  await message.reply(
    'ⓘ Mention me with a question or message and I will help.',
  );

  return;
}

const aiSessionId = getDiscordAiSessionId(message);

const contextualAiQuestion =
  replyTargetMessage
    ? [
      'The user is replying directly to another Discord message.',
      `Referenced message author: ${replyTargetMessage.member?.displayName || replyTargetMessage.author?.username || 'Unknown'}`,
      `Referenced message: ${shorten(replyTargetMessage.content || '(no text content)', 2000)}`,
      `User request: ${question || '(no additional text; infer what the user is asking about from the referenced message)'}`,
    ].join('\n')
    : question;

    const directKnownAnswer =
      question ? ai.getInstantAnswer(question) : null;

    if (directKnownAnswer) {
      await message.reply(directKnownAnswer);
      return;
    }

    if (isDirectBotMention) {
      const handledShortcut = await handlePingGatedTextShortcut({
        message,
        question,
      });

      if (handledShortcut) {
        return;
      }
    }

    // ========================================================
    // AI FORGET
    // ========================================================

    if (normalizedQuestion === 'forget') {
      await message.reply(
        forgetUserConversation(getDiscordAiSessionId(message)),
      );

      return;
    }

    // ========================================================
    // ADMIN AI FORGET
    // ========================================================

    if (normalizedQuestion === 'aforget') {
      if (!isAdmin(message.author.id, message.member)) {
        await message.reply(
          '✕ You are not authorized to use **aforget**.',
        );

        return;
      }

      await message.reply(
        forgetAllConversations(),
      );

      return;
    }
      
          // ========================================================
    // NEW MEMBER WELCOME
    // ========================================================

    const isNewMemberRequest =
      /\bnew member\b/i.test(normalizedQuestion) ||
      /\bnew here\b/i.test(normalizedQuestion) ||
      /\bjust joined\b/i.test(normalizedQuestion) ||
      /\bnew to the server\b/i.test(normalizedQuestion);

    if (isNewMemberRequest) {
      await message.reply(
        `Hello <@${message.author.id}>! Welcome to The Cottage★! ⌂

Please read <#1478166898020585592>, pick some roles in <#1398624929099812937>, and say hi in <#1398568017708978258>!

We hope you have fun here and love being part of The Cottage★! ♥︎`,
      );

      return;
    }
      
          // ========================================================
    // JAVA JOINING INFORMATION
    // ========================================================

    const asksHowToJoin =
      /\bhow\s+(?:do|can)\s+i\s+join\b/i.test(normalizedQuestion) ||
      /\bhow\s+to\s+join\b/i.test(normalizedQuestion) ||
      /\bwhere\s+do\s+i\s+join\b/i.test(normalizedQuestion) ||
      /\bjoin\s+(?:the\s+)?(?:server|smp)\b/i.test(normalizedQuestion);

    const isJavaPlayer =
      /\bjava\b/i.test(normalizedQuestion);

    const isBedrockPlayer =
      /\bbedrock\b/i.test(normalizedQuestion);

    if (asksHowToJoin && isJavaPlayer) {
      await message.reply(
        `Hello! Since you're a Java player, here's the Cottage SMP intro message:

https://discord.com/channels/1398568016915992667/1478252152169431134/1545519313606287390

Most of the things you need to know about the SMP are there!`,
      );

      return;
    }
      
          // ========================================================
    // BEDROCK JOINING INFORMATION
    // ========================================================

    if (asksHowToJoin && isBedrockPlayer) {
      pendingBedrockVideoRequests.add(message.author.id);

      setTimeout(() => {
        pendingBedrockVideoRequests.delete(message.author.id);
      }, 10 * 60 * 1000);

      await message.reply(
        `Hello! Since you're a Bedrock player, here's the Cottage SMP intro message:

https://discord.com/channels/1398568016915992667/1478252152169431134/1545519313606287390

Most of the things you need to know about the SMP are there!

If you want a simpler way to join on Bedrock, just say **yes** and I'll send you a video!`,
      );

      return;
    }

    // ========================================================
    // ADMIN AI
    // ========================================================

if (
  isAdmin(message.author.id, message.member) &&
  isLikelyAdminRequest(question)
) {
      try {
        log(
          'Admin',
          `Parsing admin request from ${message.author.username}: ${question}`,
        );

        const adminCommand = await ai.parseAdminCommand(question, {
          userId: `admin:${message.author.id}`,
        });

        if (adminCommand?.action !== 'none') {
          log(
            'Admin',
            `Detected action=${adminCommand.action}, target=${adminCommand.targetAction}, delay=${adminCommand.delayMinutes}m`,
          );

          // ----------------------------------------------------
          // CANCEL
          // ----------------------------------------------------

if (adminCommand.action === 'cancel') {
  // --------------------------------------------------
  // CANCEL EVERYTHING
  // --------------------------------------------------

  if (adminCommand.targetAction === 'all') {
    const cancelledTasks =
      cancelAllScheduledAdminActions();

    if (cancelledTasks.length === 0) {
      await message.reply(
        'ⓘ There are currently no scheduled administrative actions to cancel.',
      );

      return;
    }

    const cancelledNames = cancelledTasks.map(
      task => task.action,
    );

    await message.reply(
      `✓ Cancelled ${cancelledTasks.length} scheduled administrative action${
        cancelledTasks.length === 1 ? '' : 's'
      }: ${cancelledNames.join(', ')}.`,
    );

    return;
  }

  // --------------------------------------------------
  // CANCEL THE NEXT TASK OF A SPECIFIC TYPE
  // --------------------------------------------------

  const scheduledTasks = getScheduledAdminAction(
    adminCommand.targetAction,
  );

  if (scheduledTasks.length === 0) {
    await message.reply(
      `✕ There is no scheduled **${adminCommand.targetAction}** action.`,
    );

    return;
  }
    
const task = scheduledTasks[0];

clearTimeout(task.timeout);
scheduledAdminActions.delete(task.id);

saveScheduledAdminActions();

const timestamp = Math.floor(task.executeAt / 1000);

  await message.reply(
    `✓ Cancelled the scheduled **${task.action}** for <t:${timestamp}:F> (<t:${timestamp}:R>).`,
  );

  return;
}
            
// ----------------------------------------------------
// RESTART
// ----------------------------------------------------

if (adminCommand.action === 'restart') {
  await message.reply(
    '⚠︎ I can understand restart requests, but The Cottage★ SMP is hosted on Play Hosting, which does not provide the public server-control API needed for the Main Bot to restart the actual server.',
  );

  return;
}

// ----------------------------------------------------
// STATUS
// ----------------------------------------------------
            
// ----------------------------------------------------
// SCHEDULED ACTIONS
// ----------------------------------------------------

if (adminCommand.action === 'scheduled') {
  if (scheduledAdminActions.size === 0) {
    await message.reply(
      'ⓘ There are currently no scheduled administrative actions.',
    );

    return;
  }

  const embed = createEmbed(
    'Scheduled Administrative Actions',
    Colors.Blurple,
  );

  const tasks = [...scheduledAdminActions.values()]
    .sort((a, b) => a.executeAt - b.executeAt);

  const actionCounts = new Map();

  for (const task of tasks) {
    const count =
      (actionCounts.get(task.action) || 0) + 1;

    actionCounts.set(task.action, count);

    const timestamp = Math.floor(task.executeAt / 1000);

    const displayName =
      count === 1
        ? task.action.charAt(0).toUpperCase() + task.action.slice(1)
        : `${task.action.charAt(0).toUpperCase() + task.action.slice(1)} #${count}`;

    const scheduledBy = task.scheduledBy
      ? `\nScheduled by: **${task.scheduledBy}**`
      : '';

    embed.addFields({
      name: displayName,
      value:
        `<t:${timestamp}:F>\n` +
        `<t:${timestamp}:R>` +
        scheduledBy,
      inline: false,
    });
  }

  await message.reply({
    embeds: [embed],
  });

  return;
}	

// ----------------------------------------------------
// STATUS
// ----------------------------------------------------

if (adminCommand.action === 'status') {
  if (adminCommand.delayMinutes > 0) {
    await message.reply(
      '✕ Status checks cannot be scheduled. Ask me for the status now.',
    );

    return;
  }

  const status = mc.getStatus();

  const embed = buildStatusEmbed(
    status,
    'Status Check',
    Colors.Blurple,
  );

  await message.reply({
    embeds: [embed],
  });

  return;
}

          // ----------------------------------------------------
          // APPROVED ACTION EXECUTOR
          // ----------------------------------------------------
            
const executeAction = () =>
  executeAdministrativeAction(adminCommand.action);

// ----------------------------------------------------
// IMMEDIATE ACTION
// ----------------------------------------------------

if (adminCommand.delayMinutes === 0) {
  try {
    const result = await executeAction();

    if (adminCommand.action === 'start') {
      await message.reply(
        result === 'already active'
          ? 'ⓘ The Minecraft AFK bot is already running.'
          : '✓ Minecraft AFK bot started.',
      );
    } else if (adminCommand.action === 'stop') {
      await message.reply(
        result === 'already stopped'
          ? 'ⓘ The Minecraft AFK bot is already stopped.'
          : '✓ Minecraft AFK bot stopped.',
      );
    } else if (adminCommand.action === 'maintenance') {
      await message.reply(
        '✓ Maintenance announcement sent.',
      );
    }

    return;

  } catch (error) {
    log(
      'Admin',
      `Immediate ${adminCommand.action} failed: ${error.message}`,
    );

    await message.reply(
      `✕ Unable to execute **${adminCommand.action}**: ${error.message}`,
    );

    return;
  }
}

          // ----------------------------------------------------
          // SCHEDULED ACTION
          // ----------------------------------------------------

          const delayMs =
            adminCommand.delayMinutes * 60 * 1000;

const executeAt = scheduleAdminAction(
  adminCommand.action,
  delayMs,
  async () => {
    const result = await executeAction();

    log(
      'Admin',
      `Scheduled ${adminCommand.action} completed: ${result}`,
    );

    await notifyScheduledActionCompletion({
      action: adminCommand.action,
      channelId: message.channel.id,
    });
  },
  {
    scheduledBy: message.author.username,
    channelId: message.channel.id,
  },
);

          await message.reply(
            `✓ Scheduled **${adminCommand.action}** for <t:${Math.floor(
              executeAt / 1000,
            )}:F> (<t:${Math.floor(executeAt / 1000)}:R>).`,
          );

          return;
        }
      } catch (error) {
        log(
          'Admin',
          `Unable to parse admin request: ${error.message}`,
        );

        await message.reply(
          `✕ I couldn't process that administrative request: ${error.message}`,
        );

        return;
      }
    }

    // ========================================================
    // NORMAL AI
    // ========================================================

    try {
      log(
        'AI',
        `Discord ${message.author.username} in #${message.channel.name}: ${question}`,
      );

const response = await ai.ask(contextualAiQuestion, {
  userId: aiSessionId,
  platform: 'discord',
  skipKnownAnswers: Boolean(replyTargetMessage),
});

      log('AI', `Discord response: ${response}`);

      await message.reply(response);
    } catch (error) {
      log(
        'AI',        `Unable to answer Discord mention: ${error.message}`,
      );

      try {
        await message.reply({
          content: applyUnicodeTheme('✕ Server could not get an AI response right now.'),
          failIfNotExists: false,
        });
      } catch (replyError) {
        log(
          'AI',
          `Unable to send AI error response: ${replyError.message}`,
        );

        try {
          await message.channel.send(
            applyUnicodeTheme('✕ Server could not get an AI response right now.'),
          );
        } catch (channelError) {
          log(
            'AI',
            `Unable to send AI fallback message: ${channelError.message}`,
          );
        }
      }
    }

    return;
  }


});
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isButton() && interaction.customId === 'dashboard:refresh') {
    return interaction.update({
      embeds: [buildDashboardEmbed()],
      components: [buildDashboardComponents()],
    });
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  log(
    'Discord',
    `/${interaction.commandName} requested by ${interaction.user.tag}.`,
  );

  const status = mc.getStatus();

  switch (interaction.commandName) {
    case 'summarize': {
      return summary.handleSlashCommand({ interaction, ai });
    }

    case 'ping': {
      if (!hasFeatureAccess('ping', interaction.user.id, interaction.member)) {
        log(
          'Admin',
          `Rejected /ping from unauthorized user ${interaction.user.tag} (${interaction.user.id}).`,
        );

        return interaction.reply({
          content: '✕ You are not authorized to use this command.',
          flags: MessageFlags.Ephemeral,
        });
      }

      log(
        'Admin',
        `Verified /ping request from ${interaction.user.tag} (${interaction.user.id}).`,
      );

      return interaction.reply({
        content: `PONG! ${getDiscordPing()}ms`,
        flags: MessageFlags.Ephemeral,
      });
    }

    case 'forget': {
      return interaction.reply({
        content: forgetUserConversation(getInteractionAiSessionId(interaction)),
        flags: MessageFlags.Ephemeral,
      });
    }

    case 'aforget': {
      if (!hasFeatureAccess('aforget', interaction.user.id, interaction.member)) {
        log(
          'Admin',
          `Rejected /aforget from unauthorized user ${interaction.user.tag} (${interaction.user.id}).`,
        );
        return interaction.reply({
          content:
            '✕ You are not authorized to use this command.',
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content: forgetAllConversations(),
        flags: MessageFlags.Ephemeral,
      });
    }
    case 'maintenance': {
      if (!hasFeatureAccess('maintenance', interaction.user.id, interaction.member)) {
        log(
          'Admin',
          `Rejected /maintenance from unauthorized user ${interaction.user.tag} (${interaction.user.id}).`,
        );
        return interaction.reply({
          content: '✕ You are not authorized to use this command.',
          flags: MessageFlags.Ephemeral,
        });
      }

      try {
        await executeAdministrativeAction('maintenance');
        runtimeHealth.maintenance = true;

        return interaction.reply({
          content: '✓ Maintenance announcement sent.',
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        log(
          'Discord',
          `Unable to send maintenance announcement: ${error.message}`,
        );

        return interaction.reply({
          content:
            '✕ Failed to send the maintenance announcement.',          flags: MessageFlags.Ephemeral,
        });
      }
    }

    case 'start': {
      if (!hasFeatureAccess('start', interaction.user.id, interaction.member)) {
        log(
          'Admin',
          `Rejected /start from unauthorized user ${interaction.user.tag} (${interaction.user.id}).`,
        );

        return interaction.reply({
          content: '✕ You are not authorized to use this command.',
          flags: MessageFlags.Ephemeral,
        });
      }

      log(
        'Admin',
        `Verified /start request from ${interaction.user.tag} (${interaction.user.id}).`,
      );

      if (
        status.connected ||
        status.connecting ||
        status.reconnecting
      ) {
        return interaction.reply({
          embeds: [
            createEmbed(
              'Bot Already Active',
              Colors.Yellow,
            ).setDescription(
              'The bot is already connected or waiting to reconnect.',
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      await executeAdministrativeAction('start');

      return interaction.editReply({
        embeds: [
          createEmbed(
            'Joining Server',
            Colors.Green,
          )
            .setDescription(
              `Connecting to ${config.server.ip}. The server may take up to two minutes to wake.`,
            )
            .addFields(
              {
                name: 'Bot Name',
                value: `\`${config.bot.username}\``,
                inline: true,
              },
              {
                name: 'Server',
                value: `\`${config.server.ip}\``,
                inline: true,
              },
            ),
        ],
      });
    }

    case 'stop': {
      if (!hasFeatureAccess('stop', interaction.user.id, interaction.member)) {
        log(
          'Admin',
          `Rejected /stop from unauthorized user ${interaction.user.tag} (${interaction.user.id}).`,
        );

        return interaction.reply({
          content: '✕ You are not authorized to use this command.',
          flags: MessageFlags.Ephemeral,
        });
      }

      log(
        'Admin',
        `Verified /stop request from ${interaction.user.tag} (${interaction.user.id}).`,
      );

      if (
        !status.connected &&
        !status.connecting &&
        !status.reconnecting
      ) {
        return interaction.reply({
          embeds: [
            createEmbed(
              'Bot Already Offline',
              Colors.Blurple,
            ).setDescription(
              'There is no active AFK session to stop.',
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      await executeAdministrativeAction('stop');

      return interaction.editReply({
        embeds: [
          createEmbed(
            'Bot Stopped',
            Colors.Red,
          ).setDescription(
            'The AFK session was stopped. Use /start to connect again.',
          ),
        ],
      });
    }

    case 'status': {
      if (!(await requireFeatureAccess(interaction, 'status'))) {
        return;
      }

      return interaction.reply({
        embeds: [
          buildStatusEmbed(
            status,
            'Status Check',
            status.connected ? Colors.Green : Colors.Blurple,
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    case 'help': {
      return interaction.reply({
        content: ai.getHelpMessage(),
        flags: MessageFlags.Ephemeral,
      });
    }

    case 'afk': {
      const reason = interaction.options.getString('reason', false)?.trim() || 'AFK';

      setUserAfk(interaction.user.id, reason);

      return interaction.reply({
        content: `✓ You are now marked as AFK: **${userAfkStatuses.get(interaction.user.id).reason}**`,
        flags: MessageFlags.Ephemeral,
      });
    }

    case 'remind': {
      const durationInput = interaction.options.getString('duration', true).trim();
      const message = interaction.options.getString('message', true).trim();

      try {
        const durationMs = reminders.parseDuration(durationInput);
        const reminder = reminders.createReminder({
          userId: interaction.user.id,
          userTag: interaction.user.tag,
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          durationMs,
          message,
        });

        const timestamp = Math.floor(reminder.executeAt / 1000);

        return interaction.reply({
          content:
            `✓ Reminder \`${reminder.id}\` set for <t:${timestamp}:F> (<t:${timestamp}:R>).\nReminder: **${reminder.message}**\nUse \`/reminders\` to view it or \`/remind-cancel\` to cancel it.`,
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        return interaction.reply({
          content: `✕ ${error.message}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    case 'reminders': {
      const activeReminders = reminders.getUserReminders(interaction.user.id);

      if (activeReminders.length === 0) {
        return interaction.reply({
          content: 'ⓘ You have no active reminders.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const embed = createEmbed('Your Reminders', Colors.Blurple)
        .setDescription('Active reminders are shown below. Times use your Discord locale.');

      for (const reminder of activeReminders.slice(0, 25)) {
        const timestamp = Math.floor(reminder.executeAt / 1000);

        embed.addFields({
          name: reminder.id,
          value:
            `<t:${timestamp}:F> (<t:${timestamp}:R>)\n${reminder.message}`,
          inline: false,
        });
      }

      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    }

    case 'remind-cancel': {
      const reminderId = interaction.options.getString('id', true).trim();
      const result = reminders.cancelReminder(
        interaction.user.id,
        reminderId,
      );

      if (!result.ok) {
        return interaction.reply({
          content:
            result.reason === 'not_owner'
              ? '✕ You can only cancel your own reminders.'
              : '✕ I could not find that reminder. Use /reminders to see your active reminders.',
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content:
          `✓ Cancelled reminder \`${result.reminder.id}\`: **${result.reminder.message}**`,
        flags: MessageFlags.Ephemeral,
      });
    }
    case 'dashboard': {
      if (!hasFeatureAccess('dashboard', interaction.user.id, interaction.member)) {
        return interaction.reply({
          content: '✕ You are not authorized to use this command.',
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        embeds: [buildDashboardEmbed()],
        components: [buildDashboardComponents()],
        flags: MessageFlags.Ephemeral,
      });
    }

    case 'ai': {
      if (!hasFeatureAccess('ai', interaction.user.id, interaction.member)) {
        log(
          'Admin',
          `Rejected /ai from unauthorized user ${interaction.user.tag} (${interaction.user.id}).`,
        );

        return interaction.reply({
          content: '✕ You are not authorized to use this command.',
          flags: MessageFlags.Ephemeral,
        });
      }

      log(
        'Admin',
        `Verified /ai request from ${interaction.user.tag} (${interaction.user.id}).`,
      );

      if (interaction.options.getSubcommand() === 'status') {
        const diagnostics = ai.getAiDiagnostics();

        const embed = createEmbed(
          'AI Diagnostics',
          Colors.Blurple,
        ).addFields(
          {
            name: 'Model',
            value: `\`${diagnostics.model}\``,
            inline: true,
          },
          {
            name: 'Configured Keys',
            value: String(diagnostics.configuredKeys),
            inline: true,
          },
          {
            name: 'Active Normal Key',
            value: String(diagnostics.activeNormalKey),
            inline: true,
          },
          {
            name: 'Active Admin Key',
            value: String(diagnostics.activeAdminKey),
            inline: true,
          },
          {
            name: 'Queued Requests',
            value: `${diagnostics.queuedRequests}/${diagnostics.queueLimit}`,
            inline: true,
          },
          {
            name: 'Active Cooldowns',
            value: String(diagnostics.activeCooldowns),
            inline: true,
          },
          {
            name: 'Conversation Sessions',
            value: String(diagnostics.conversationSessions),
            inline: true,
          },
          {
            name: 'Context Limit',
            value: `${diagnostics.contextLimitMessages} messages`,
            inline: true,
          },
          {
            name: 'AI Requests',
            value: String(diagnostics.totalRequests),
            inline: true,
          },
          {
            name: 'AI Errors',
            value: String(diagnostics.totalErrors),
            inline: true,
          },
          {
            name: 'Last AI Error',
            value: diagnostics.lastError
              ? `\`${diagnostics.lastError.slice(0, 900)}\``
              : 'None recorded',
            inline: false,
          },
        ).setDescription(
          'Admin access confirmed. This view exposes health metadata only; API keys and private conversation contents are never shown.',
        );

        return interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content: '✕ Unknown AI subcommand.',
        flags: MessageFlags.Ephemeral,
      });
    }

    default:
      return undefined;
  }
});
client.on(Events.Error, error => {
  runtimeHealth.lastDiscordErrorAt = Date.now();
  runtimeHealth.lastDiscordError = String(error?.message || error || 'Unknown error');
  void reportErrorToDiscord(error, 'Discord client error');
});

client.on('shardError', error => {
  runtimeHealth.lastDiscordErrorAt = Date.now();
  runtimeHealth.lastDiscordError = String(error?.message || error || 'Unknown error');
  void reportErrorToDiscord(error, 'Discord shard error');
});

client.once(Events.ClientReady, async readyClient => {
  log('Discord', `Logged in as ${readyClient.user.tag}.`);

  await registerCommands();
    
  // Slash command watchdog: health-check every 15 minutes.
  log('Watchdog', 'Slash command watchdog started (every 15 minutes).');

  setInterval(() => {
    void commandWatchdog();
  }, COMMAND_WATCHDOG_INTERVAL_MS);

  // Runtime watchdog: recover an unexpectedly inactive Minecraft session.
  setInterval(() => {
    const status = mc.getStatus();

    if (
      !status.connected &&
      !status.connecting &&
      !status.reconnecting &&
      !status.manualStop
    ) {
      log('Watchdog', 'Minecraft session is inactive; attempting recovery.');
      mc.start();
    }
  }, 10 * 60 * 1000);

  updatePresence();

  restoreScheduledAdminActions();

  reminders.initialize(readyClient);

  log('Bot', 'Starting AFK session.');
  mc.start();
});

process.on('uncaughtException', error => {
  console.error('[Fatal] Uncaught exception:', error.stack || error.message);
  void reportErrorToDiscord(error, 'Uncaught exception');
});

process.on('unhandledRejection', reason => {
  console.error('[Fatal] Unhandled rejection:', reason);
  void reportErrorToDiscord(
    reason instanceof Error ? reason : new Error(String(reason)),
    'Unhandled rejection',
  );
});

startStatusServer();

log('Discord', 'Starting Discord bot.');
client.login(config.discord.token);