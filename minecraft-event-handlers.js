'use strict';

function registerMinecraftEventHandlers(dependencies) {
  const {
    mc, runtimeHealth, updatePresence, buildStatusEmbed, createEmbed,
    Colors, shorten, formatDelay, log, notifyChannel, config,
    shouldWelcomePlayer,
  } = dependencies;

  if (!mc?.emitter?.on) {
    throw new TypeError('Minecraft event handlers require an event emitter.');
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
  
  // Minecraft chat relay remains available; in-game AI responses are disabled.
  mc.emitter.on('minecraftPlayerJoined', async ({ username }) => {
    if (!username || username === config.bot.username) {
      return;
    }
  
    if (!shouldWelcomePlayer(username)) {
      return;
    }
  
    await new Promise(resolve => setTimeout(resolve, 1500));
    try {
      mc.chat(`Welcome to The Cottage★, ${username}!`);
      log('Minecraft', `Sent daily welcome to ${username}.`);
    } catch (error) {
      log('Minecraft', `Unable to send daily welcome to ${username}: ${error.message}`);
    }
  });
  
  mc.emitter.on('minecraftPlayerLeft', async ({ username }) => {
    if (!username) return;
  
    const embed = createEmbed('Player Left', Colors.Blurple)
      .setDescription(`⌂ **${username}** left The Cottage★ SMP.`);
    void notifyChannel(embed);
  });
}

module.exports = { registerMinecraftEventHandlers };
