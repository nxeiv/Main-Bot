# The Cottage★ Main Bot

The **The Cottage★ Main Bot** is the Discord and Minecraft companion service for **The Cottage★** and its SMP.

It connects the Cottage★ community with Minecraft, provides public and administrative Discord tools, maintains the Minecraft AFK session, exposes a small read-only status bridge for the website, and provides Gemini-powered AI features.

> **The Cottage★ is the home. The SMP is the backyard.**

The bot is infrastructure for the community — useful in the background without trying to become the main character.

---

# Cottage★ theme

The bot follows the same identity as the website, but translates it into Discord and terminal-friendly interfaces.

## Home / Backyard language

The bot uses the same conceptual vocabulary as the rest of the project:

- **Cottage / Home** — the community and Discord
- **Backyard** — the Minecraft SMP
- **Archive / Memory** — saved conversation and community context where applicable
- **Infrastructure** — the bot and services that quietly keep things working

These names are intentionally human rather than technical wherever the UI allows it.

## Unicode-first interface theme

The bot uses a consistent **Unicode-first visual theme** across user-facing responses.

- Pictographic emoji are avoided where a suitable text/Unicode symbol exists.
- Common interface states use symbols such as `✓`, `✕`, `ⓘ`, `⚠︎`, `⚒︎`, `⌂`, `⌫`, `◎`, and `⌁`.
- AI-generated Discord and Minecraft responses pass through the same Unicode theme layer.
- Discord mentions, channel references, URLs, commands, and the **Cottage★** name are preserved.
- Remaining default emoji-presentation characters are normalized so AI output does not unexpectedly switch back to pictographic emoji.

This is a presentation layer only. It does not change command behavior or underlying data.

The goal is the same as the website: **quiet, warm, recognizable, and not overly decorated.**

---

# What it does

## Discord

- AI chat with channel-aware conversation memory
- reply-aware AI follow-ups
- deterministic answers for confirmed Cottage★ information
- Discord/community help
- Minecraft/SMP help
- feature descriptions and tutorials
- Minecraft connection and player-count status
- administrative `/start`, `/stop`, `/status`, `/dashboard`, and `/maintenance`
- `/summarize <channel>` for public channel summaries
- administrator moderation tools
- reply-based `banish?` moderation
- persistent moderation and banishment state
- admin-verified AI administrative requests
- scheduled administrative actions with persistence
- `/forget` and `/aforget`
- administrator-only `/ai status`
- public `/afk [reason]`
- daily Minecraft player welcomes
- Discord ↔ Minecraft chat integration
- optional private error reporting
- slash-command watchdog and reconciliation

## Minecraft

The Minecraft side uses Mineflayer and provides:

- connection and reconnection handling
- exponential reconnect backoff
- player detection and count tracking
- player join/leave detection
- Minecraft chat integration
- Discord ↔ Minecraft chat relay
- lightweight anti-AFK activity
- daily player welcomes
- Minecraft status reporting to Discord
- public website status data

The configured Minecraft account is **Server**.

---

# Architecture

| File | Responsibility |
| --- | --- |
| `index.js` | Discord client, commands, events, scheduling, permissions, HTTP status API, and Discord/Minecraft orchestration |
| `minecraft.js` | Mineflayer connection, reconnect logic, player tracking, chat, and anti-AFK behavior |
| `ai.js` | Gemini clients, conversation memory, deterministic answers, AI requests, rate limiting, and administrative request parsing |
| `summary.js` | Channel-summary generation and dismiss-button behavior |
| `unicode.js` | Shared Unicode-first presentation/theme layer |
| `banish.js` | Reply-based admin banishment and persistent banishment state |
| `moderation.js` | Persistent warnings, moderation events, durations, and moderation history |
| `config.js` | Discord, Minecraft, access policy, reconnect, and moderation configuration |
| `.env.example` | Environment variable template |
| `package.json` | Dependencies, scripts, and Node.js requirement |

Runtime state is deliberately kept outside source code.

---

# Access model

Feature access is centralized in `config.js`.

Current access levels include:

| Feature | Access |
| --- | --- |
| `/help` | Public |
| `/forget` | Public |
| `/summarize` | Public |
| `/afk` | Public |
| `/start` | Admin |
| `/stop` | Admin |
| `/status` | Admin |
| `/dashboard` | Admin |
| `/maintenance` | Admin |
| `/aforget` | Admin |
| `/ai status` | Admin |
| moderation commands | Admin |
| banishment controls | Admin |

Administrators can be granted through configured user IDs and the Cottage★ Moderator role.

The project uses the central `featureAccess` map so access rules can be changed in one place rather than being scattered through command handlers.

---

# Public website status bridge

The Main Bot exposes a small read-only HTTP server for the Cottage★ website.

Current public API base:

`https://the-cottage-bot.wisp.uno/`

## Endpoints

### `GET /health`

Returns basic service health.

Example shape:

```json
{
  "ok": true,
  "service": "The Cottage★ Main Bot",
  "checkedAt": "..."
}
```

### `GET /api/status`

Returns public Minecraft status data.

Example shape:

```json
{
  "online": true,
  "state": "online",
  "players": 0,
  "uptime": 12345,
  "reconnectAttempts": 0,
  "checkedAt": "..."
}
```

Possible states include:

- `online`
- `connecting`
- `reconnecting`
- `offline`

The endpoint is intentionally read-only.

### Privacy boundary

The public API does **not** return the Minecraft hostname or port.

CORS can be controlled with:

`STATUS_ALLOWED_ORIGINS`

The server accepts `PORT` when supplied by the host, otherwise `STATUS_PORT`, falling back to port `3000`.

---

# Minecraft configuration

Current `config.js` settings:

| Setting | Current value |
| --- | --- |
| Host | `the-cottage-c1-s5.play.hosting` |
| Port | `25565` |
| Version | `1.21.11` |
| Bot username | `Server` |
| Authentication | `offline` |
| Reconnect start | `60 seconds` |
| Reconnect maximum | `300 seconds` |

The Minecraft hostname is used internally by the bot. It should not be added to public website UI.

---

# Discord commands

| Command | Access | Purpose |
| --- | --- | --- |
| `/help` | Public | Shows bot help and access labels |
| `/forget` | Public | Clears the requesting user's AI conversation |
| `/summarize <channel>` | Public | Summarizes recent messages |
| `/afk [reason]` | Public | Marks the requesting user as AFK |
| `/start` | Admin | Starts the Minecraft AFK session |
| `/stop` | Admin | Stops the Minecraft AFK session |
| `/status` | Admin | Shows Minecraft status |
| `/dashboard` | Admin | Shows Discord, Minecraft, and AI health |
| `/maintenance` | Admin | Sends the configured maintenance announcement |
| `/aforget` | Admin | Clears all AI conversations |
| `/ai status` | Admin | Shows AI health and queue diagnostics |
| `/warn` | Admin | Records a persistent moderation warning |
| `/modlog` | Admin | Views moderation history |
| `/banishlist` | Admin | Shows active banishments |
| `/unbanish` | Admin | Releases a member from banishment |
| `/clearwarns` | Admin | Clears recorded warnings |

The bot's `/help` response mirrors these access labels directly in Discord.

---

# AFK system

The bot's Minecraft client is designed to keep the SMP session available even when nobody else is online.

The anti-AFK system performs lightweight, randomized actions such as:

- arm swings
- camera movement
- hotbar changes
- short movement
- brief sneak/jump actions

The goal is to keep the session active without turning the bot into an intrusive player.

Player count excludes the `Server` account itself.

---

# Channel summaries

Use:

`/summarize channel:#general`

The command:

- uses Discord's channel picker
- reads up to the latest 100 accessible messages
- limits the transcript sent to Gemini
- focuses on decisions, questions, announcements, plans, and unresolved topics
- returns a dedicated summary embed
- provides a dismiss button
- only allows the requester to dismiss their summary

Generated summaries intentionally avoid decorative emoji or unnecessary Unicode styling.

---

# AI system

The AI has two main paths.

## 1. Known-answer path

Confirmed Cottage★ information is answered locally without calling Gemini.

This keeps stable server information deterministic and prevents unnecessary API usage.

## 2. Gemini path

General conversation and supported AI requests are sent through the configured Gemini clients.

The system includes:

- per-user cooldowns
- global request throttling
- a bounded request queue
- conversation history limits
- multiple Gemini-key failover
- stateless administrative parsing
- response quality checks
- Minecraft-specific response formatting
- the shared Unicode theme layer

The bot should never invent unconfirmed Cottage★ information.

---

# Administrative AI safety

AI does not receive permission to execute an administrative action simply because it classified a message as administrative.

The bot:

1. identifies a possible administrative request
2. verifies the requester
3. sends the request through the stateless admin parser
4. validates the requested action and target
5. executes only supported actions

Supported persisted actions include:

- `start`
- `stop`
- `maintenance`

Scheduled administrative actions are saved locally so they can survive a restart.

---

# Banishment

The Cottage★ banish mechanic is intentionally admin-only and reply-based.

Reply directly to a member's message with:

`banish?`

The bot applies the configured timeout, records the action, and gives the member the configured escape phrase.

Configuration lives in `config.js`:

- duration
- command
- escape phrase
- persistence file
- stale-state window

Active banishments survive bot restarts.

---

# Runtime state

The following files are generated locally and should not be committed:

- `daily-welcomes.json`
- `scheduled-actions.json`
- `banish-state.json`
- `moderation-state.json`
- `user-afk.json`
- logs and local runtime data

They contain state rather than source code.

---

# Environment

Create a local `.env`:

```env
DISCORD_TOKEN=your_discord_bot_token

GEMINI_API_KEY=your_primary_gemini_api_key
GEMINI_API_KEY_2=your_second_gemini_api_key
GEMINI_API_KEY_3=your_third_gemini_api_key
GEMINI_API_KEY_4=your_fourth_gemini_api_key

MC_PASSWORD=

MODERATION_LOG_CHANNEL_ID=
ERROR_CHANNEL_ID=

STATUS_PORT=3000
STATUS_ALLOWED_ORIGINS=https://the-cottage.onrender.com
```

The exact hosting platform may provide `PORT` automatically. When it does, the bot uses that value for the status server.

Never commit real credentials.

---

# Requirements

- Node.js **26+**
- npm
- Discord bot application with required permissions/intents
- Minecraft account for the AFK client
- one or more Gemini API keys for AI features
- network access to Discord, Gemini, and Minecraft

The Node.js requirement is also declared in `package.json`.

---

# Installation

```bash
git clone https://github.com/nxeiv/Main-Bot.git
cd Main-Bot
npm install
```

Create `.env` using `.env.example`.

Start the bot:

```bash
npm start
```

Equivalent:

```bash
node index.js
```

Startup should establish the Discord connection, reconcile slash commands, load persistent state, start the status bridge, and begin the configured Minecraft session.

---

# WispByte / Pterodactyl

The Main Bot can run as a Node.js application under a Pterodactyl-style host.

The repository expects:

- Node.js 26+
- dependencies installed with `npm install`
- `index.js` as the entry point

The application should use:

`node index.js`

Do not run two copies of the same Main Bot at the same time.

Two instances would compete for:

- the same Discord bot account
- the same Minecraft account
- the same administrative state
- the same public status role

---

# Termux

The bot can also be run temporarily from Android through Termux.

Example setup:

```bash
pkg update
pkg upgrade
pkg install nodejs git

git clone https://github.com/nxeiv/Main-Bot.git
cd Main-Bot
npm install
```

Then create `.env` and run:

```bash
node index.js
```

Only run one Main Bot instance at a time.

---

# Testing

A practical test order is:

1. Start the bot and verify Discord login.
2. Verify slash-command reconciliation.
3. Run `/help` as a public user.
4. Test deterministic Cottage★ questions.
5. Test `/afk`.
6. Test a normal AI mention and a reply-aware follow-up.
7. Test `/forget` and `/summarize`.
8. Test `/status`, `/dashboard`, and `/ai status` as admin.
9. Test `/start` and `/stop` only during a safe maintenance window.
10. Test moderation and banishment using test accounts.
11. Verify the website can reach `/api/status`.
12. Review logs for Discord, Minecraft, Gemini, network, and permission errors.

---

# Troubleshooting

## Slash commands are missing

Check:

- `DISCORD_TOKEN`
- `clientId`
- `guildId`
- Discord permissions
- bot connectivity

The slash-command watchdog periodically checks the configured guild command set.

## Gemini requests fail

Check:

- Gemini API keys
- quota/rate limits
- temporary provider availability
- network connectivity

Configured failover keys are used for supported quota and temporary availability failures.

## Minecraft disconnects

Check the Minecraft server and review the disconnect reason.

Unexpected disconnects automatically enter the reconnect system unless the Minecraft session was deliberately stopped.

## `EAI_AGAIN`

This usually indicates temporary DNS or network resolution trouble.

Because the Minecraft connection manager already retries, temporary failures normally do not require a manual restart.

## Website status is unavailable

Check:

1. the Main Bot process is running
2. the HTTP status listener is bound successfully
3. the host-provided port / `STATUS_PORT` is correct
4. `STATUS_ALLOWED_ORIGINS` allows the website origin
5. `/health` and `/api/status` respond normally

---

# Development guidelines

When changing the bot:

- keep Discord orchestration in `index.js`
- keep Minecraft connection logic in `minecraft.js`
- keep AI behavior and confirmed server knowledge in `ai.js`
- keep summaries in `summary.js`
- keep Unicode presentation logic in `unicode.js`
- keep secrets in environment variables
- keep runtime state out of Git
- centralize feature access in `config.js`
- do not add unconfirmed server facts to the AI knowledge base
- test reconnect and status behavior after network-related changes
- keep public API responses limited to information that is safe to expose
- preserve the Cottage★ Unicode theme in user-facing responses

## Theme rule

When adding a new command, embed, error message, or AI-facing response, ask:

**Does this look like something that belongs in the Cottage★?**

Prefer calm, readable, human phrasing and restrained Unicode symbols over noisy emoji-heavy formatting.

---

# Repository

https://github.com/nxeiv/Main-Bot

The bot is maintained as infrastructure for **The Cottage★** and its backyard, **The Cottage★ SMP**.
