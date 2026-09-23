'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  ActivityType,
  Client,
  Colors,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} = require('discord.js');

const config = require('./config');
const mc = require('./minecraft');
const ai = require('./ai');

const scheduledAdminActions = new Map();

// ============================================================
// BEDROCK JOIN VIDEO FOLLOW-UP
// ============================================================

const pendingBedrockVideoRequests = new Set();

const SCHEDULE_FILE = path.join(
  __dirname,
  'scheduled-actions.json',
);

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
    .setDescription('Starts AFK Session'),

  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stops AFK Session'),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Shows AFK Status'),

  new SlashCommandBuilder()
    .setName('maintenance')
    .setDescription(
      'Announces that the server is under maintenance DO NOT USE IF NOT SMP MODERATOR.',
    ),

  new SlashCommandBuilder()
    .setName('forget')
    .setDescription('Forget your AI conversation context'),

  new SlashCommandBuilder()
    .setName('aforget')
    .setDescription('Forget all AI conversation contexts (admin only)'),
].map(command => command.toJSON());

function log(tag, message) {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${timestamp}] [${tag}] ${message}`);
}

function isAdmin(userId) {
  return config.adminUserIds?.includes(userId);
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
  `✅ Scheduled **${task.action}** action completed.`,
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

function shorten(text, limit = 1000) {
  const normalized = String(text || 'Unknown reason').replace(/\s+/g, ' ').trim();
  return normalized.length > limit
    ? `${normalized.slice(0, limit - 3)}...`
    : normalized;
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  const route = Routes.applicationGuildCommands(
    config.discord.clientId,
    config.discord.guildId,
  );

  try {
    log('Discord', 'Checking existing slash commands...');

    const existing = await rest.get(route);

    log(
      'Discord',
      `Discord currently reports ${existing.length} guild command(s).`,
    );

    for (const command of existing) {
      log(
        'Discord',
        `Existing command: /${command.name} (${command.id})`,
      );
    }

    log('Discord', 'Registering slash commands...');

    const registered = await rest.put(route, {
      body: commands,
    });

    log(
      'Discord',
      `Slash commands registered successfully: ${registered.length} command(s).`,
    );

    for (const command of registered) {
      log(
        'Discord',
        `Registered command: /${command.name} (${command.id})`,
      );
    }
  } catch (error) {
    log(
      'Discord',
      `Unable to register slash commands: ${error.message}`,
    );
  }
}

let commandWatchdogRunning = false;

async function commandWatchdog() {
  if (commandWatchdogRunning) return;

  commandWatchdogRunning = true;

  try {
    const rest = new REST({ version: '10' }).setToken(config.discord.token);

    const route = Routes.applicationGuildCommands(
      config.discord.clientId,
      config.discord.guildId,
    );

    const existing = await rest.get(route);

    const existingNames = new Set(
      existing.map(command => command.name),
    );

    const expectedNames = new Set(
      commands.map(command => command.name),
    );

    const missing = commands.filter(
      command => !existingNames.has(command.name),
    );

    const unexpected = existing.filter(
      command => !expectedNames.has(command.name),
    );

    if (missing.length === 0 && unexpected.length === 0) {
      log(
        'Watchdog',
        `Slash commands OK (${existing.length}/${commands.length}).`,
      );
      return;
    }

    if (missing.length > 0) {
      log(
        'Watchdog',
        `Missing commands detected: ${missing
          .map(command => `/${command.name}`)
          .join(', ')}`,
      );
    }

    if (unexpected.length > 0) {
      log(
        'Watchdog',
        `Unexpected commands detected: ${unexpected
          .map(command => `/${command.name}`)
          .join(', ')}`,
      );
    }

    await rest.put(route, {
      body: commands,
    });

    log(
      'Watchdog',
      `Slash commands repaired successfully (${commands.length} command(s)).`,
    );
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
          name: `Watching #minecraft-server⛏️`,
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

mc.emitter.on('disconnected', () => {
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

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) {
    return;
  }
    
  // ============================================================
  // BEDROCK JOIN VIDEO FOLLOW-UP
  // ============================================================

  const normalizedFollowUpMessageText = message.content
    .trim()
    .toLowerCase()
    .replace(/[!?.,]+$/g, '');

  if (
    message.guild?.id === config.discord.guildId &&
    pendingBedrockVideoRequests.has(message.author.id) &&
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
    normalizedMessageText === 'forget'
  ) {
    ai.resetUserConversation(
      `discord:${message.author.id}`,
    );

    await message.reply(
      '🧹 Your AI conversation context has been forgotten. You can start fresh now.',
    );

    return;
  }

  if (
    message.guild?.id === config.discord.guildId &&
    normalizedMessageText === 'aforget'
  ) {
    if (!isAdmin(message.author.id)) {
      await message.reply(
        '❌ You are not authorized to use **aforget**.',
      );

      return;
    }

    ai.resetConversation();

    await message.reply(
      '🧹 All AI conversation contexts have been forgotten.',
    );

    return;
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
        '❌ The AFK bot is currently not connected to Minecraft.',
      );
    }

    return;
  }

  // ============================================================
  // MAIN BOT MENTION
  // ============================================================

  if (
    message.guild?.id === config.discord.guildId &&
    message.mentions.has(client.user)
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

    // ========================================================
    // AI FORGET
    // ========================================================

    if (normalizedQuestion === 'forget') {
      ai.resetUserConversation(
        `discord:${message.author.id}`,
      );

      await message.reply(
        '🧹 Your AI conversation context has been forgotten. You can start fresh now.',
      );

      return;
    }

    // ========================================================
    // ADMIN AI FORGET
    // ========================================================

    if (normalizedQuestion === 'aforget') {
      if (!isAdmin(message.author.id)) {
        await message.reply(
          '❌ You are not authorized to use **aforget**.',
        );

        return;
      }

      ai.resetConversation();

      await message.reply(
        '🧹 All AI conversation contexts have been forgotten.',
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
        `Hello <@${message.author.id}>! Welcome to The Cottage★! 🏡

Please read <#1478166898020585592>, pick some roles in <#1398624929099812937>, and say hi in <#1398568017708978258>!

We hope you have fun here and love being part of The Cottage★! 💙`,
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
  isAdmin(message.author.id) &&
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
        'ℹ️ There are currently no scheduled administrative actions to cancel.',
      );

      return;
    }

    const cancelledNames = cancelledTasks.map(
      task => task.action,
    );

    await message.reply(
      `✅ Cancelled ${cancelledTasks.length} scheduled administrative action${
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
      `❌ There is no scheduled **${adminCommand.targetAction}** action.`,
    );

    return;
  }
    
const task = scheduledTasks[0];

clearTimeout(task.timeout);
scheduledAdminActions.delete(task.id);

saveScheduledAdminActions();

const timestamp = Math.floor(task.executeAt / 1000);

  await message.reply(
    `✅ Cancelled the scheduled **${task.action}** for <t:${timestamp}:F> (<t:${timestamp}:R>).`,
  );

  return;
}
            
// ----------------------------------------------------
// RESTART
// ----------------------------------------------------

if (adminCommand.action === 'restart') {
  await message.reply(
    '⚠️ I can understand restart requests, but The Cottage★ SMP is hosted on Play Hosting, which does not provide the public server-control API needed for the Main Bot to restart the actual server.',
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
      'ℹ️ There are currently no scheduled administrative actions.',
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
      '❌ Status checks cannot be scheduled. Ask me for the status now.',
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
          ? 'ℹ️ The Minecraft AFK bot is already running.'
          : '✅ Minecraft AFK bot started.',
      );
    } else if (adminCommand.action === 'stop') {
      await message.reply(
        result === 'already stopped'
          ? 'ℹ️ The Minecraft AFK bot is already stopped.'
          : '✅ Minecraft AFK bot stopped.',
      );
    } else if (adminCommand.action === 'maintenance') {
      await message.reply(
        '✅ Maintenance announcement sent.',
      );
    }

    return;

  } catch (error) {
    log(
      'Admin',
      `Immediate ${adminCommand.action} failed: ${error.message}`,
    );

    await message.reply(
      `❌ Unable to execute **${adminCommand.action}**: ${error.message}`,
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
            `✅ Scheduled **${adminCommand.action}** for <t:${Math.floor(
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
          `❌ I couldn't process that administrative request: ${error.message}`,
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

const response = await ai.ask(question, {
  userId: `discord:${message.author.id}`,
  platform: 'discord',
});

      log('AI', `Discord response: ${response}`);

      await message.reply(response);
    } catch (error) {
      log(
        'AI',
        `Unable to answer Discord mention: ${error.message}`,
      );

      await message.reply(
        '❌ Server could not get an AI response right now.',
      );
    }

    return;
  }

  // ============================================================
  // AUTORESPONDERS
  // ============================================================

  const text = message.content.trim().toLowerCase();

  if (text === 'invite?') {
    await message.reply('https://the-cottage.onrender.com/');
    return;
  }

  if (text === 'ip?') {
    await message.reply(
      'https://discord.com/channels/1398568016915992667/1478252152169431134/1545519313606287390',
    );
    return;
  }

  if (text === 'mcrules?') {
    await message.reply(
      'https://discord.com/channels/1398568016915992667/1477236505465327626/1545520572652453980',
    );
    return;
  }

  if (text === 'world download?') {
    await message.reply(
      'https://discord.com/channels/1398568016915992667/1478252152169431134/1507948745122381824',
    );
    return;
  }

  if (text === 'rules?') {
    await message.reply(
      'Here are the rules! <#1478166898020585592>',
    );
    return;
  }
});
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  log(
    'Discord',
    `/${interaction.commandName} requested by ${interaction.user.tag}.`,
  );

  const status = mc.getStatus();

  switch (interaction.commandName) {
    case 'forget': {
      ai.resetUserConversation(
        `discord:${interaction.user.id}`,
      );

      return interaction.reply({
        content:
          '🧹 Your AI conversation context has been forgotten. You can start fresh now.',
        ephemeral: true,
      });
    }

    case 'aforget': {
      if (!isAdmin(interaction.user.id)) {
        return interaction.reply({
          content:
            '❌ You are not authorized to use this command.',
          ephemeral: true,
        });
      }

      ai.resetConversation();

      return interaction.reply({
        content:
          '🧹 All AI conversation contexts have been forgotten.',
        ephemeral: true,
      });
    }
    case 'maintenance': {
      if (!isAdmin(interaction.user.id)) {
        return interaction.reply({
          content: '❌ You are not authorized to use this command.',
          ephemeral: true,
        });
      }

      try {
        const maintenanceChannel = await client.channels.fetch(
          config.discord.maintenanceChannelId,
        );

        if (!maintenanceChannel?.isTextBased()) {
          return interaction.reply({
            content:
              '❌ The configured maintenance channel is not a text channel.',
            ephemeral: true,
          });
        }

        await maintenanceChannel.send(
          '# 🛠️ **Server is under maintenance** <@&1447218476795166791>',
        );

        return interaction.reply({
          content: '✅ Maintenance announcement sent.',
          ephemeral: true,
        });
      } catch (error) {
        log(
          'Discord',
          `Unable to send maintenance announcement: ${error.message}`,
        );

        return interaction.reply({
          content:
            '❌ Failed to send the maintenance announcement.',
          ephemeral: true,
        });
      }
    }

    case 'start': {
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
          ephemeral: true,
        });
      }

      await interaction.deferReply();

      mc.start();

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
          ephemeral: true,
        });
      }

      await interaction.deferReply();

      mc.stop();

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
      const color = status.connected
        ? Colors.Green
        : (
          status.connecting || status.reconnecting
            ? Colors.Yellow
            : Colors.DarkGrey
        );

      return interaction.reply({
        embeds: [
          buildStatusEmbed(
            status,
            `Bot Status: ${getBotState(status)}`,
            color,
          ),
        ],
      });
    }

    default:
      return undefined;
  }
});
client.once(Events.ClientReady, async readyClient => {
  log('Discord', `Logged in as ${readyClient.user.tag}.`);

  await registerCommands();
    
  // Slash command watchdog: check every 5 minutes.
  log('Watchdog', 'Slash command watchdog started (every 5 minutes).');

  setInterval(() => {
    void commandWatchdog();
  }, 5 * 60 * 1000);

  updatePresence();

  restoreScheduledAdminActions();

  log('Bot', 'Starting AFK session.');
  mc.start();
});

process.on('uncaughtException', error => {
  console.error('[Fatal] Uncaught exception:', error.stack || error.message);
});

process.on('unhandledRejection', reason => {
  console.error('[Fatal] Unhandled rejection:', reason);
});

log('Discord', 'Starting Discord bot.');
client.login(config.discord.token);
