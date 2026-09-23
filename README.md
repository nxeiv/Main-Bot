# ⌂ The Cottage★ Main Bot

The main Discord and Minecraft companion bot for **The Cottage★ SMP**.

It connects the Cottage★ Discord community with the Minecraft server, provides server information and help, manages the Minecraft AFK session, and uses Gemini-powered AI for conversations and in-game interactions.

## ◈ Features

- ◆ **AI Chat** — Natural conversations through Discord and Minecraft.
- ⌖ **Discord Help** — Answers common questions about the Cottage★ community.
- ▣ **SMP Help** — Provides confirmed Minecraft server information and joining guidance.
- ◇ **Feature Help** — Explains The Cottage★ SMP features and how they work.
- ◌ **Minecraft Status** — Reports the Minecraft bot connection and player count.
- ⌁ **AFK System** — Keeps the Minecraft bot connected when needed.
- ⌘ **Server Controls** — Supports administrative start, stop, status, and maintenance controls.
- ◷ **Scheduling** — Supports scheduled administrative actions with persistent recovery.
- ◎ **Conversation Memory** — Maintains relevant AI conversation context.
- ⌫ **Forget Controls** — Allows users and administrators to clear AI conversation context.
- ◉ **Command Watchdog** — Checks and repairs the registered Discord slash commands.
- → **Instant Answers** — Handles common Cottage★ questions without an AI request.
- ✦ **Daily Minecraft Welcomes** — Generates a short AI welcome for players when they join, once per Philippine calendar day.

## ◇ Project Structure

| File | Purpose |
| --- | --- |
| `index.js` | Main Discord bot, slash commands, event handling, scheduling, and Minecraft-to-Discord integration. |
| `minecraft.js` | Minecraft bot connection, player detection, chat handling, anti-AFK behavior, and Minecraft events. |
| `ai.js` | Gemini AI integration, conversation memory, request handling, and administrative request parsing. |
| `config.js` | Environment-based configuration for Discord, Minecraft, and bot settings. |
| `daily-welcomes.json` | Runtime state used to prevent duplicate daily Minecraft welcomes. |
| `scheduled-actions.json` | Runtime state used to restore scheduled administrative actions after a restart. |

## ▣ Requirements

- Node.js
- A Discord bot application with the required permissions and intents
- A Minecraft account for the AFK bot
- A Gemini API key
- The required Node.js dependencies from `package.json`

## ◈ Configuration

Configuration is loaded through environment variables.

At minimum, the bot requires credentials and connection settings for Discord, Minecraft, and Gemini.

Keep API keys, bot tokens, passwords, and other private credentials outside the repository.

## ⌘ Running the Bot

Install the project dependencies:

```bash
npm install
```

Then start the bot:

```bash
node index.js
```

The bot will log into Discord, register its guild slash commands, restore persistent administrative schedules, and start the Minecraft AFK session.

## ◇ Discord Commands

The bot currently registers:

- `/start` — Start the Minecraft AFK session.
- `/stop` — Stop the Minecraft AFK session.
- `/status` — View the current Minecraft bot status.
- `/maintenance` — Send the configured server maintenance announcement.
- `/forget` — Forget the requesting user's AI conversation context.
- `/aforget` — Forget all AI conversation contexts. Administrator only.

Administrative actions can also be scheduled through the bot's AI-assisted administrative request system.

## ⌁ Minecraft Integration

The Minecraft bot connects to **The Cottage★ SMP** and provides:

- ◆ Connection and reconnection handling
- ◆ Player count tracking
- ◆ Player join detection
- ◆ Minecraft chat integration
- ◆ Discord-to-Minecraft chat relay
- ◆ Anti-AFK activity
- ◆ Daily AI-generated player welcomes
- ◆ Minecraft status reporting to Discord

Daily welcomes use the **Asia/Manila** calendar date and are persisted so restarting the bot does not cause the same player to be welcomed again on the same day.

## ◈ Slash Command Watchdog

The bot checks its guild slash commands periodically.

If commands are missing or unexpected commands are detected, the bot re-registers the expected command set automatically.

## ◇ Scheduling

Administrative actions can be scheduled for later execution.

Persisted schedules survive a bot restart when the scheduled execution time has not yet passed.

Supported persisted administrative actions include:

- `start`
- `stop`
- `maintenance`

## ⌂ The Cottage★ SMP

This bot is built specifically for **The Cottage★ SMP**, a Minecraft community project maintained by Makkrabb.

The bot is intended to support the community while keeping server information, administrative tools, and AI-assisted features in one place.

## ▣ Development

The project is maintained for The Cottage★ SMP.

When making changes, keep the bot's Discord and Minecraft responsibilities separated between their respective modules and avoid committing private credentials or runtime state files.

## ◇ License

No open-source license is currently specified for this repository. Unless a license is added, the repository's code remains subject to the default copyright rules.
