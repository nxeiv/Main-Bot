# The Cottage★ Main Bot

The main Discord and Minecraft companion bot for **The Cottage★ SMP**.

It connects the Cottage★ Discord community with the Minecraft server, provides server information and help, manages the Minecraft AFK session, and provides Gemini-powered AI features.

## Unicode theme

The bot uses a consistent Unicode-first visual theme across user-facing responses.

- Pictographic emoji are replaced with text-friendly Unicode symbols where an appropriate symbol exists.
- AI-generated Discord and Minecraft responses pass through the same Unicode theme layer.
- Common interface states use symbols such as ✓, ✕, ⓘ, ⚠︎, ⚒︎, ⌂, ⌫, and ⌁.
- The theme preserves Discord mentions, channel references, URLs, commands, and the Cottage★ branding.
- The Unicode layer also catches remaining default emoji presentation characters so AI output does not unexpectedly switch back to pictographic emoji.

This is a presentation layer only; it does not change the bot's underlying command behavior.
## Features

### Discord

- AI chat with conversation memory
- Deterministic answers for confirmed Cottage★ information
- Discord/community help
- Minecraft/SMP help
- Feature descriptions and tutorials
- Minecraft connection and player-count status
- Administrative `/start`, `/stop`, `/status`, and `/maintenance` controls
- AI-assisted administrative requests with admin verification
- Scheduled administrative actions with persistence across restarts
- `/forget` for clearing one user's AI conversation
- `/aforget` for clearing all AI conversations
- `/ai status` for administrator-only AI diagnostics
- Slash-command watchdog and automatic reconciliation
- Daily Minecraft player welcomes
- Discord-to-Minecraft and Minecraft-to-Discord integration

### Channel summaries

Users can mention the bot and ask it to summarize a channel, for example:

`@Main Bot can you summarize this channel?`

or:

`@Main Bot summarize #general`

The summary system:

- Reads up to the latest 100 messages it can access
- Removes empty/system messages
- Resolves channel names, channel mentions, and "this channel"/"here"
- Limits the transcript sent to Gemini
- Generates a concise summary focused on decisions, questions, announcements, plans, and unresolved topics
- Adds a dismiss button
- Allows only the person who requested the summary to dismiss it
- Does not use emojis in the generated summary prompt

### Minecraft

The Minecraft side uses Mineflayer and provides:

- Minecraft connection and reconnection handling
- Exponential reconnect backoff
- Player detection and player-count tracking
- Player join detection
- Minecraft chat integration
- Discord/Minecraft chat relay
- Lightweight anti-AFK activity
- Daily AI-generated welcomes
- Minecraft status reporting to Discord

The current server configuration targets **The Cottage★ SMP** on Minecraft **1.21.11**.

## Project structure

| File | Purpose |
| --- | --- |
| `index.js` | Discord client, slash commands, events, scheduling, administrative controls, and Discord/Minecraft integration |
| `minecraft.js` | Mineflayer connection, reconnect logic, player detection, chat, and anti-AFK behavior |
| `ai.js` | Gemini clients, conversation memory, deterministic answers, AI requests, rate limiting, and administrative request parsing |
| `summary.js` | Channel-summary generation and dismiss-button handling |
| `summary-bootstrap.js` | Hooks the summary request handler into Discord message processing |
| `config.js` | Server, Discord, bot, administrator, and reconnect configuration |
| `.env.example` | Template for required secrets |
| `.gitignore` | Prevents secrets, dependencies, runtime state, logs, and local files from being committed |
| `daily-welcomes.json` | Runtime state for daily Minecraft welcomes; created locally and ignored by Git |
| `scheduled-actions.json` | Runtime state for persistent scheduled actions; created locally and ignored by Git |

## Requirements

- Node.js **26 or newer**
- npm
- A Discord bot application with the required intents and permissions
- A Minecraft account for the AFK client
- One or more Gemini API keys
- Network access to Discord, Gemini, and the Minecraft server

The Node.js version requirement is also declared in `package.json`.

## Configuration

Secrets are loaded from environment variables through `dotenv`.

Create a local `.env` file in the project root:

```env
DISCORD_TOKEN=your_discord_bot_token

GEMINI_API_KEY=your_primary_gemini_api_key
GEMINI_API_KEY_2=your_second_gemini_api_key
GEMINI_API_KEY_3=your_third_gemini_api_key
GEMINI_API_KEY_4=your_fourth_gemini_api_key

MC_PASSWORD=
```

At minimum, `DISCORD_TOKEN` and `GEMINI_API_KEY` should be configured for the full bot feature set.

Additional Gemini keys are optional and provide failover when a configured key hits a supported quota, rate-limit, or temporary availability error.

`MC_PASSWORD` is optional with the current `offline` Minecraft authentication configuration.

Do **not** commit `.env` or any real credentials to GitHub.

### Non-secret server configuration

Normal server settings are kept in `config.js`, including:

- Discord client and guild IDs
- Status, maintenance, chat, and other channel IDs
- Administrator user IDs
- Minecraft hostname and port
- Minecraft version
- Minecraft bot username
- Minecraft authentication mode
- Reconnect timing

Review `config.js` before deploying the bot to a different server or Discord guild.

## Installation

Clone the repository and enter it:

```bash
git clone https://github.com/nxeiv/Main-Bot.git
cd Main-Bot
```

Install dependencies:

```bash
npm install
```

Create `.env` using `.env.example`, then start the bot:

```bash
npm start
```

You can also run:

```bash
node index.js
```

On successful startup, the bot should log into Discord, reconcile the guild slash commands, restore any valid scheduled administrative actions, and start the Minecraft AFK session.

## Discord commands

| Command | Access | Purpose |
| --- | --- | --- |
| `/start` | Administrator | Starts the Minecraft AFK session |
| `/stop` | Administrator | Stops the Minecraft AFK session |
| `/status` | General | Shows Minecraft AFK status |
| `/maintenance` | Administrator | Sends the configured maintenance announcement |
| `/forget` | General | Clears the requesting user's AI conversation |
| `/aforget` | Administrator | Clears all normal AI conversations |
| `/ai status` | Administrator | Shows AI health and queue diagnostics |

Administrative requests made through the AI system are independently checked against the configured administrator IDs before an administrative action is executed.

## AI system

The AI system has two main paths:

1. **Known-answer path** — confirmed Cottage★ information is answered locally without calling Gemini.
2. **Gemini path** — general conversation and requests are sent through the configured Gemini clients.

The AI system includes:

- Per-user cooldowns
- Global request throttling
- A bounded request queue
- Conversation history limits
- Multiple Gemini-key failover
- Separate stateless administrative-command parsing
- Response quality checks
- Minecraft-specific response formatting

The bot should never be used as a source for unconfirmed server information. If a server-specific fact is not configured or confirmed, the AI is instructed not to invent it.

## Administrative request safety

AI-assisted administrative requests are not executed solely because Gemini classified a message.

The bot:

1. Checks whether the request is likely administrative.
2. Verifies the requesting Discord user against `adminUserIds`.
3. Uses the stateless administrative parser.
4. Validates the returned action, target, delay, and confidence.
5. Executes only supported administrative actions.

Supported persisted actions include:

- `start`
- `stop`
- `maintenance`

Scheduled actions are saved locally so future actions can survive a bot restart.

## Minecraft connection

The current configuration uses:

- Host: `the-cottage-c1-s5.play.hosting`
- Port: `25565`
- Version: `1.21.11`
- Bot username: `Server`
- Authentication: `offline`

The reconnect system starts at a 1-minute delay and backs off to a maximum of 5 minutes.

Temporary DNS or network errors such as `EAI_AGAIN`, connection resets, or socket closures can cause a reconnect cycle. These are handled by the Minecraft connection manager rather than requiring a manual restart.

## Running on WispByte / Pterodactyl

The bot can run as a Node.js application under a Pterodactyl-style host.

The important application settings are:

- `JS_FILE=index.js`
- Node.js 26 or newer
- Dependencies installed with `npm install`

For the existing WispByte deployment, keep the provider's startup wrapper and make sure `JS_FILE` points to `index.js`.

Do not run a second copy of the same Main Bot at the same time. Two instances would both attempt to use the same Discord bot account and Minecraft account.

## Temporary Android / Termux hosting

The bot can also be run locally on an Android phone with Termux.

Install Termux from its official GitHub releases rather than an old package source:

`https://github.com/termux/termux-app/releases`

Then:

```bash
pkg update
pkg upgrade
pkg install nodejs git

git clone https://github.com/nxeiv/Main-Bot.git
cd Main-Bot
npm install
```

Create the local `.env` file, then run:

```bash
node index.js
```

For longer temporary sessions, Android battery optimization can stop background processes. Keep Termux running and consider using:

```bash
termux-wake-lock
```

Only run one Main Bot instance at a time. Stop the WispByte instance before starting the phone instance, or stop the phone instance before starting WispByte again.

## Runtime files

The following files are generated locally and are intentionally ignored by Git:

- `daily-welcomes.json`
- `scheduled-actions.json`
- logs and log rotations

They contain runtime state rather than source code.

If the bot is moved to a new host, these files do not need to be committed to GitHub. Copy them separately only when preserving local runtime state is actually desired.

## Troubleshooting

### `Missing required environment variables: DISCORD_TOKEN`

Make sure the project root contains a `.env` file with:

```env
DISCORD_TOKEN=your_token_here
```

Restart the bot after changing environment variables.

### `getaddrinfo EAI_AGAIN`

This normally indicates a temporary DNS/network-resolution problem. Check whether the host can reach Discord and the Minecraft server. The Minecraft connection manager will automatically retry.

If both `discord.com` and the Minecraft hostname fail with `EAI_AGAIN`, the problem is likely the hosting environment's network/DNS path rather than the bot's Minecraft configuration.

### Discord slash commands are missing

The slash-command watchdog periodically checks the configured guild and reconciles the expected command set.

Check:

- `DISCORD_TOKEN`
- `clientId`
- `guildId`
- Discord application permissions
- The bot's connection to Discord

### Gemini requests fail

Check:

- `GEMINI_API_KEY`
- Optional failover keys
- Gemini quota/rate limits
- Network access to Gemini

The bot can automatically try another configured Gemini key for supported quota and temporary availability failures.

### The bot disconnects from Minecraft

Check the Minecraft server itself first. If the server is reachable, review the bot logs for the disconnect reason. Unexpected Minecraft disconnects automatically enter the reconnect system unless the session was manually stopped.

## Security

Never commit:

- Discord bot tokens
- Gemini API keys
- Minecraft passwords
- Private credentials
- Private configuration containing secrets

The repository's `.gitignore` excludes `.env`, dependencies, runtime state, logs, and common local tooling files.

If a token or API key is ever exposed, rotate it immediately through the relevant provider.

## Development guidelines

When modifying the bot:

- Keep Discord orchestration in `index.js`.
- Keep Minecraft connection logic in `minecraft.js`.
- Keep AI logic and deterministic server knowledge in `ai.js`.
- Keep channel-summary behavior in `summary.js`.
- Keep secrets in environment variables.
- Keep runtime state out of Git.
- Do not add unconfirmed server information to the AI knowledge base.
- Test Discord and Minecraft reconnection behavior after network-related changes.
- Avoid changing provider startup commands unless the deployment actually requires it.

## Repository

Official repository:

https://github.com/nxeiv/Main-Bot

The project is maintained for The Cottage★ SMP.
