'use strict';

const VOICE_SESSION_GROUP = 'cottage-main-24-7';

function createVoiceSessionManager({
  client,
  voice,
  fs,
  filePath,
  log = () => {},
}) {
  if (!client || !voice || !fs || !filePath) {
    throw new TypeError('Voice session manager requires client, voice, fs, and filePath.');
  }

  let connection = null;
  let target = null;
  let joining = null;

  function readSavedTarget() {
    try {
      if (!fs.existsSync(filePath)) return null;
      const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (
        !saved ||
        typeof saved.guildId !== 'string' ||
        typeof saved.channelId !== 'string'
      ) {
        return null;
      }
      return { guildId: saved.guildId, channelId: saved.channelId };
    } catch (error) {
      log('Voice', `Unable to read saved voice session: ${error.message}`);
      return null;
    }
  }

  function saveTarget(nextTarget) {
    fs.writeFileSync(filePath, JSON.stringify(nextTarget, null, 2), 'utf8');
  }

  function clearSavedTarget() {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (error) {
      log('Voice', `Unable to clear saved voice session: ${error.message}`);
    }
  }

  function attachConnectionLogging(nextConnection) {
    nextConnection.on('error', error => {
      log('Voice', `Voice connection error: ${error?.message || error}`);
    });

    nextConnection.on('stateChange', (oldState, newState) => {
      log('Voice', `Voice connection: ${oldState.status} → ${newState.status}.`);
    });
  }

  async function join(channel) {
    if (!channel || !channel.guild || !channel.guild.voiceAdapterCreator) {
      throw new Error('Choose a voice channel in a server where the bot can connect.');
    }

    const nextTarget = {
      guildId: channel.guild.id,
      channelId: channel.id,
    };

    if (
      connection &&
      target?.guildId === nextTarget.guildId &&
      target?.channelId === nextTarget.channelId &&
      connection.state.status === voice.VoiceConnectionStatus.Ready
    ) {
      return { alreadyConnected: true, target: { ...target } };
    }

    if (joining) {
      await joining;
      if (
        connection &&
        target?.guildId === nextTarget.guildId &&
        target?.channelId === nextTarget.channelId &&
        connection.state.status === voice.VoiceConnectionStatus.Ready
      ) {
        return { alreadyConnected: true, target: { ...target } };
      }
    }

    joining = (async () => {
      if (connection) {
        connection.destroy();
        connection = null;
      }

      const nextConnection = voice.joinVoiceChannel({
        channelId: nextTarget.channelId,
        guildId: nextTarget.guildId,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: true,
        group: VOICE_SESSION_GROUP,
      });

      connection = nextConnection;
      attachConnectionLogging(nextConnection);

      try {
        await voice.entersState(
          nextConnection,
          voice.VoiceConnectionStatus.Ready,
          25_000,
        );
      } catch (error) {
        // Keep the saved target only after a successful join. A failed attempt
        // must not silently become a persistent reconnect request.
        if (connection === nextConnection) {
          nextConnection.destroy();
          connection = null;
        }
        throw new Error(`Could not connect to the voice channel: ${error.message}`);
      }

      target = nextTarget;
      saveTarget(target);
      log('Voice', `Joined persistent voice channel ${target.channelId} in guild ${target.guildId}.`);
      return { alreadyConnected: false, target: { ...target } };
    })();

    try {
      return await joining;
    } finally {
      joining = null;
    }
  }

  function leave() {
    if (connection) {
      connection.destroy();
      connection = null;
    }

    const hadTarget = Boolean(target || readSavedTarget());
    target = null;
    clearSavedTarget();
    log('Voice', 'Persistent voice session stopped.');
    return { left: hadTarget };
  }

  function getStatus() {
    const saved = target || readSavedTarget();
    return {
      active: Boolean(saved),
      guildId: saved?.guildId || null,
      channelId: saved?.channelId || null,
      connectionState: connection?.state?.status || 'Disconnected',
    };
  }

  async function restore() {
    const saved = readSavedTarget();
    if (!saved) return { restored: false, reason: 'no_saved_session' };

    const guild = await client.guilds.fetch(saved.guildId).catch(() => null);
    if (!guild) {
      log('Voice', 'Saved voice guild is unavailable; keeping the session file for a later restart.');
      return { restored: false, reason: 'guild_unavailable' };
    }

    const channel = await guild.channels.fetch(saved.channelId).catch(() => null);
    if (!channel || !channel.isVoiceBased?.() || !channel.guild?.voiceAdapterCreator) {
      log('Voice', 'Saved voice channel is unavailable; clearing the stale session.');
      clearSavedTarget();
      return { restored: false, reason: 'channel_unavailable' };
    }

    try {
      await join(channel);
      log('Voice', 'Restored the persistent voice session.');
      return { restored: true };
    } catch (error) {
      log('Voice', `Could not restore the voice session: ${error.message}`);
      return { restored: false, reason: 'connection_failed' };
    }
  }

  return {
    join,
    leave,
    getStatus,
    restore,
  };
}

module.exports = {
  VOICE_SESSION_GROUP,
  createVoiceSessionManager,
};
