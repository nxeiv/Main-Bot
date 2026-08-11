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

// Render health server
const http = require('http');

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('BOT Server is online.');
}).listen(PORT, '0.0.0.0', () => {
  log('Web', `Health server listening on port ${PORT}.`);
});

// Render keep-alive
const RENDER_URL = 'https://discomine-priv.onrender.com';

setInterval(() => {
  http.get(RENDER_URL, res => {
    res.resume();
    log('Web', `Keep-alive ping sent. HTTP ${res.statusCode}.`);
  }).on('error', error => {
    log('Web', `Keep-alive ping failed: ${error.message}`);
  });
}, 60 * 1000);

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
