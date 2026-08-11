'use strict';

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

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
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
].map(command => command.toJSON());

function log(tag, message) {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${timestamp}] [${tag}] ${message}`);
}

// Render web console + health server
const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const RENDER_URL = 'https://discomine-priv.onrender.com';

// Store recent console logs for the web dashboard
const recentLogs = [];
const MAX_LOGS = 100;

function addWebLog(message) {
  recentLogs.push({
    time: new Date().toISOString(),
    message: String(message),
  });

  if (recentLogs.length > MAX_LOGS) {
    recentLogs.shift();
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Save normal console logs to the web console too
const originalLog = console.log;

console.log = (...args) => {
  const message = args
    .map(arg => {
      if (typeof arg === 'string') return arg;

      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');

  addWebLog(message);
  originalLog(...args);
};

const server = http.createServer((req, res) => {
  // Main dashboard
  if (req.url === '/' || req.url === '/console') {
    const status = mc.getStatus();

    const botStatus = status.connected
      ? '🟢 Online'
      : (status.connecting || status.reconnecting)
        ? '🟡 Reconnecting'
        : '🔴 Offline';

    const discordStatus = client.isReady()
      ? '🟢 Connected'
      : '🔴 Disconnected';

    const logsHtml = recentLogs
      .slice()
      .reverse()
      .map(log => `
        <div class="log">
          <span class="time">${escapeHtml(log.time.slice(11, 19))}</span>
          <span>${escapeHtml(log.message)}</span>
        </div>
      `)
      .join('');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="refresh" content="10">
<title>DiscoMine Console</title>

<style>
  body {
    margin: 0;
    padding: 30px;
    background: #0d1117;
    color: #e6edf3;
    font-family: Arial, sans-serif;
  }

  .container {
    max-width: 1000px;
    margin: auto;
  }

  h1 {
    margin-bottom: 5px;
  }

  .subtitle {
    color: #8b949e;
    margin-bottom: 25px;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin-bottom: 25px;
  }

  .card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 10px;
    padding: 18px;
  }

  .label {
    color: #8b949e;
    font-size: 13px;
    margin-bottom: 8px;
  }

  .value {
    font-size: 20px;
    font-weight: bold;
  }

  .logs {
    background: #010409;
    border: 1px solid #30363d;
    border-radius: 10px;
    padding: 15px;
    max-height: 600px;
    overflow-y: auto;
    font-family: Consolas, monospace;
    font-size: 13px;
  }

  .log {
    padding: 5px 0;
    border-bottom: 1px solid #161b22;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .time {
    color: #8b949e;
    margin-right: 10px;
  }

  .refresh {
    color: #8b949e;
    font-size: 12px;
    margin-top: 10px;
  }
</style>
</head>

<body>
<div class="container">

  <h1>⛏️ DiscoMine Console</h1>
  <div class="subtitle">The Cottage★ SMP AFK Bot</div>

  <div class="cards">

    <div class="card">
      <div class="label">Minecraft</div>
      <div class="value">${botStatus}</div>
    </div>

    <div class="card">
      <div class="label">Players Online</div>
      <div class="value">${status.playerCount}</div>
    </div>

    <div class="card">
      <div class="label">Minecraft Server</div>
      <div class="value">${escapeHtml(status.server)}</div>
    </div>

    <div class="card">
      <div class="label">Discord</div>
      <div class="value">${discordStatus}</div>
    </div>

    <div class="card">
      <div class="label">Reconnect Attempts</div>
      <div class="value">${status.reconnectAttempts}</div>
    </div>

    <div class="card">
      <div class="label">Bot Uptime</div>
      <div class="value">
        ${status.connected ? escapeHtml(formatUptime(status.uptime)) : 'Offline'}
      </div>
    </div>

  </div>

  <h2>Console</h2>

  <div class="logs">
    ${logsHtml || '<div class="log">Waiting for logs...</div>'}
  </div>

  <div class="refresh">
    Automatically refreshes every 10 seconds.
  </div>

</div>
</body>
</html>
`;

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
    });

    return res.end(html);
  }

  // Simple health endpoint
  if (req.url === '/health') {
    res.writeHead(200, {
      'Content-Type': 'text/plain',
    });

    return res.end('DiscoMine is online.');
  }

  res.writeHead(404, {
    'Content-Type': 'text/plain',
  });

  res.end('Not found.');
});

server.listen(PORT, '0.0.0.0', () => {
  log('Web', `Health server listening on port ${PORT}.`);
  log('Web', `Console available at ${RENDER_URL}/console`);
});

// Render keep-alive
setInterval(() => {
  https.get(RENDER_URL, res => {
    res.resume();

    log(
      'Web',
      `Keep-alive ping sent. HTTP ${res.statusCode}.`,
    );
  }).on('error', error => {
    log(
      'Web',
      `Keep-alive ping failed: ${error.message}`,
    );
  });
}, 10 * 60 * 1000);

log('Web', `Keep-alive enabled: ${RENDER_URL}`);

log('Web', `Keep-alive enabled: ${RENDER_URL}`);

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

  try {
    log('Discord', 'Registering slash commands.');
    await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
      { body: commands },
    );
    log('Discord', 'Slash commands registered.');
  } catch (error) {
    log('Discord', `Unable to register slash commands: ${error.message}`);
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

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  log('Discord', `/${interaction.commandName} requested by ${interaction.user.tag}.`);
  const status = mc.getStatus();

  switch (interaction.commandName) {
    case 'start': {
      if (status.connected || status.connecting || status.reconnecting) {
        return interaction.reply({
          embeds: [
            createEmbed('Bot Already Active', Colors.Yellow)
              .setDescription('The bot is already connected or waiting to reconnect.'),
          ],
          ephemeral: true,
        });
      }

      await interaction.deferReply();
      mc.start();
      return interaction.editReply({
        embeds: [
          createEmbed('Joining Server', Colors.Green)
            .setDescription(`Connecting to ${config.server.ip}. The server may take up to two minutes to wake.`)
            .addFields(
              { name: 'Bot Name', value: `\`${config.bot.username}\``, inline: true },
              { name: 'Server', value: `\`${config.server.ip}\``, inline: true },
            ),
        ],
      });
    }

    case 'stop': {
      if (!status.connected && !status.connecting && !status.reconnecting) {
        return interaction.reply({
          embeds: [
            createEmbed('Bot Already Offline', Colors.Blurple)
              .setDescription('There is no active AFK session to stop.'),
          ],
          ephemeral: true,
        });
      }

      await interaction.deferReply();
      mc.stop();
      return interaction.editReply({
        embeds: [
          createEmbed('Bot Stopped', Colors.Red)
            .setDescription('The AFK session was stopped. Use /start to connect again.'),
        ],
      });
    }

    case 'status': {
      const color = status.connected
        ? Colors.Green
        : (status.connecting || status.reconnecting ? Colors.Yellow : Colors.DarkGrey);
      return interaction.reply({
        embeds: [buildStatusEmbed(status, `Bot Status: ${getBotState(status)}`, color)],
      });
    }

    default:
      return undefined;
  }
});

client.once(Events.ClientReady, async readyClient => {
  log('Discord', `Logged in as ${readyClient.user.tag}.`);
  await registerCommands();
  updatePresence();

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
