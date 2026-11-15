'use strict';

const VOICE_SESSION_GROUP = 'cottage-main-24-7';
const SESSION_FILE_VERSION = 2;

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

  // Discord permits one voice connection per bot account per guild. Keep one
  // independent session per guild so connecting in one server never replaces
  // the bot's connection in another server.
  const sessions = new Map();

  function normalizeTarget(value, fallbackGuildId = null) {
    if (!value || typeof value !== 'object') return null;

    const guildId = typeof value.guildId === 'string' ? value.guildId : fallbackGuildId;
    const channelId = value.channelId;

    if (
      typeof guildId !== 'string' || !guildId ||
      typeof channelId !== 'string' || !channelId
    ) {
      return null;
    }

    return { guildId, channelId };
  }

  function readSavedTargets() {
    try {
      if (!fs.existsSync(filePath)) return [];

      const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!saved || typeof saved !== 'object') return [];

      // Version 2 stores one target per guild. Accept the old single-target
      // shape so existing WispByte deployments migrate without losing a session.
      if (
        saved.version === SESSION_FILE_VERSION &&
        saved.sessions &&
        typeof saved.sessions === 'object' &&
        !Array.isArray(saved.sessions)
      ) {
        return Object.entries(saved.sessions)
          .map(([guildId, target]) => normalizeTarget(target, guildId))
          .filter(Boolean);
      }

      const legacyTarget = normalizeTarget(saved);
      return legacyTarget ? [legacyTarget] : [];
    } catch (error) {
      log('Voice', 'Unable to read saved voice sessions: ' + error.message);
      return [];
    }
  }

  for (const target of readSavedTargets()) {
    sessions.set(target.guildId, {
      target,
      connection: null,
      joining: null,
    });
  }

  function getOrCreateSession(guildId) {
    let session = sessions.get(guildId);
    if (!session) {
      session = { target: null, connection: null, joining: null };
      sessions.set(guildId, session);
    }
    return session;
  }

  function persistSessions() {
    try {
      const savedSessions = {};

      for (const [guildId, session] of sessions) {
        if (session.target) {
          savedSessions[guildId] = { ...session.target };
        }
      }

      if (Object.keys(savedSessions).length === 0) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return;
      }

      fs.writeFileSync(filePath, JSON.stringify({
        version: SESSION_FILE_VERSION,
        sessions: savedSessions,
      }, null, 2), 'utf8');
    } catch (error) {
      log('Voice', 'Unable to persist voice sessions: ' + error.message);
    }
  }

  function attachConnectionLogging(connection, guildId) {
    connection.on('error', error => {
      log('Voice', 'Voice connection error in guild ' + guildId + ': ' + (error?.message || error));
    });

    connection.on('stateChange', (oldState, newState) => {
      log('Voice', 'Voice connection in guild ' + guildId + ': ' + oldState.status + ' → ' + newState.status + '.');
    });
  }

  async function join(channel) {
    if (
      !channel ||
      !channel.guild ||
      typeof channel.guild.id !== 'string' ||
      !channel.guild.id ||
      typeof channel.id !== 'string' ||
      !channel.guild.voiceAdapterCreator
    ) {
      throw new Error('Choose a voice channel in a server where the bot can connect.');
    }

    const nextTarget = {
      guildId: channel.guild.id,
      channelId: channel.id,
    };

    let session = getOrCreateSession(nextTarget.guildId);

    // Serialize changes within one guild only. Joins in different guilds can
    // proceed independently and therefore remain connected simultaneously.
    if (session.joining) {
      await session.joining.catch(() => {});
      session = getOrCreateSession(nextTarget.guildId);
    }

    if (
      session.connection &&
      session.target?.channelId === nextTarget.channelId &&
      session.connection.state.status === voice.VoiceConnectionStatus.Ready
    ) {
      return { alreadyConnected: true, target: { ...session.target } };
    }

    const operation = (async () => {
      if (session.connection) {
        session.connection.destroy();
        session.connection = null;
      }

      // If moving within this guild, remove the old saved target while the
      // replacement connection is being established. Other guild targets stay.
      session.target = null;
      persistSessions();

      let nextConnection = null;
      try {
        nextConnection = voice.joinVoiceChannel({
          channelId: nextTarget.channelId,
          guildId: nextTarget.guildId,
          adapterCreator: channel.guild.voiceAdapterCreator,
          selfDeaf: true,
          selfMute: true,
          group: VOICE_SESSION_GROUP,
        });

        session.connection = nextConnection;
        attachConnectionLogging(nextConnection, nextTarget.guildId);

        await voice.entersState(
          nextConnection,
          voice.VoiceConnectionStatus.Ready,
          25_000,
        );
      } catch (error) {
        if (session.connection === nextConnection && nextConnection) {
          nextConnection.destroy();
          session.connection = null;
        }
        session.target = null;
        persistSessions();
        throw new Error('Could not connect to the voice channel: ' + error.message);
      }

      session.target = nextTarget;
      persistSessions();
      log('Voice', 'Joined persistent voice channel ' + nextTarget.channelId + ' in guild ' + nextTarget.guildId + '.');

      return { alreadyConnected: false, target: { ...nextTarget } };
    })();

    session.joining = operation;
    try {
      return await operation;
    } finally {
      if (session.joining === operation) session.joining = null;
    }
  }

  async function leave(guildId) {
    if (typeof guildId !== 'string' || !guildId) {
      throw new TypeError('A guild ID is required to leave a voice session.');
    }

    let session = sessions.get(guildId);
    if (session?.joining) {
      await session.joining.catch(() => {});
      session = sessions.get(guildId);
    }

    const hadSession = Boolean(session?.target || session?.connection);

    if (session?.connection) {
      session.connection.destroy();
    }

    sessions.delete(guildId);
    persistSessions();
    log('Voice', 'Persistent voice session stopped in guild ' + guildId + '.');

    return { left: hadSession };
  }

  function getStatus(guildId) {
    const session = typeof guildId === 'string' ? sessions.get(guildId) : null;
    const target = session?.target || null;

    return {
      active: Boolean(target),
      guildId: target?.guildId || guildId || null,
      channelId: target?.channelId || null,
      connectionState: session?.connection?.state?.status || 'Disconnected',
    };
  }

  async function restore() {
    const savedTargets = [...sessions.values()]
      .map(session => session.target)
      .filter(Boolean)
      .map(target => ({ ...target }));

    if (savedTargets.length === 0) {
      return { restored: 0, attempted: 0 };
    }

    const results = await Promise.all(savedTargets.map(async saved => {
      const guild = await client.guilds.fetch(saved.guildId).catch(() => null);
      if (!guild) {
        log('Voice', 'Saved voice guild ' + saved.guildId + ' is unavailable; keeping its session for a later restart.');
        return false;
      }

      const channel = await guild.channels.fetch(saved.channelId).catch(() => null);
      if (!channel || !channel.isVoiceBased?.() || !channel.guild?.voiceAdapterCreator) {
        const session = sessions.get(saved.guildId);
        if (session?.target?.channelId === saved.channelId) {
          session.target = null;
          if (!session.connection) sessions.delete(saved.guildId);
          persistSessions();
        }
        log('Voice', 'Saved voice channel ' + saved.channelId + ' in guild ' + saved.guildId + ' is unavailable; cleared that session.');
        return false;
      }

      try {
        await join(channel);
        log('Voice', 'Restored the persistent voice session in guild ' + saved.guildId + '.');
        return true;
      } catch (error) {
        log('Voice', 'Could not restore the voice session in guild ' + saved.guildId + ': ' + error.message);
        return false;
      }
    }));

    return {
      restored: results.filter(Boolean).length,
      attempted: savedTargets.length,
    };
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
