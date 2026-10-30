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
- administrative `/start`, `/stop`, `/rejoin`, `/status`, and `/dashboard`
- `/ping` for a quick Discord latency check
- `/summarize <channel>` for private channel summaries
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
| `index.js` | Discord client, events, scheduling, permissions, HTTP status API, and Discord/Minecraft orchestration |
| `commands.js` | Slash-command definitions and Discord command schema |
| `message-routing.js` | Pure policy for deciding when conversational AI may respond |
| `status-server.js` | Read-only health and Minecraft status HTTP endpoints, including CORS policy |
| `afk-store.js` | Persistent per-user Discord AFK state and validation |
| `shutdown.js` | Idempotent cleanup of Minecraft, Discord, and HTTP connections |
| `minecraft.js` | Mineflayer connection, reconnect logic, player tracking, chat, and anti-AFK behavior |
| `rejoin-controller.js` | Delayed manual disconnect/reconnect cycle |
| `rejoin-access.js` | Dedicated user/role allow-list for the rejoin command |
| `ai.js` | Gemini clients, conversation memory, AI requests, rate limiting, and administrative request parsing |
| `ai-knowledge.js` | Confirmed server facts, feature guides, aliases, help text, and AI system prompt |
| `summary.js` | Channel-summary generation and dismiss-button behavior |
| `unicode.js` | Shared Unicode-first presentation/theme layer |
| `config.js` | Discord, Minecraft, access policy, reconnect, and server configuration |
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
| `/rejoin` | Dedicated allow-list (one user ID or the specified role) |
| `/status` | Admin |
| `/dashboard` | Admin |
| `/aforget` | Admin |
| `/ai status` | Admin |

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
| Java host | `the-cottage-c1-s6.playwithbao.com` |
| Java port | `34159` (current public Java address uses this port) |
| Public Java address | `the-cottage-c1-s6.playwithbao.com:34159` |
| Bedrock address | `the-cottage-c1-s6.playwithbao.com:32211` |
| Bedrock compatibility | Any (Geyser-supported Bedrock versions) — direct server entry only |
| Server software/version | `Minecraft 26.2 / Paper 26.2` |
| Mineflayer client protocol setting | `1.21.11` (separate from server version) |
| Bot username | `Server` |
| Authentication | `offline` |
| Reconnect start | `60 seconds` |
| Reconnect maximum | `300 seconds` |

The public Java and Bedrock addresses are used for player joining. Bedrock guidance uses direct server entry only; do not advertise alternate invitation-based joining methods. Keep `config.js`, `ai-knowledge.js`, the join-help shortcuts, and the website in sync if an address, port, or allocation changes. The Mineflayer client protocol is a separate internal setting and must not be changed to `26.2` without a compatible protocol stack and testing.

---

# Discord commands

| Command | Access | Purpose |
| --- | --- | --- |
| `/help` | Public | Shows bot help and access labels |
| `/forget` | Public | Clears the requesting user's AI conversation |
| `/summarize <channel>` | Public | Privately summarizes recent messages |
| `/afk [reason]` | Public | Marks the requesting user as AFK; response is public |
| `/ping` | Admin | Shows the current Discord bot latency |
| `/start` | Admin | Starts the Minecraft AFK session |
| `/stop` | Admin | Stops the Minecraft AFK session |
| `/rejoin` | Dedicated allow-list | Disconnects the AFK client, waits 30 seconds, then reconnects |
| `/status` | Admin | Shows Minecraft status |
| `/dashboard` | Admin | Shows Discord, Minecraft, and AI health |
| `/aforget` | Admin | Clears all AI conversations |
| `/ai status` | Admin | Shows AI health and queue diagnostics |

The bot's `/help` response mirrors the supported commands directly in Discord.

**Conversational AI is opt-in.** Members must directly mention the bot or reply to one of its messages in a normal conversation channel. Ordinary chat and messages that merely contain a keyword do not trigger AI. DiscordSRV webhook messages, replies to Minecraft relay messages, and the configured Discord-to-Minecraft relay channel are excluded from conversational AI.

**Case-insensitive text shortcuts** begin with `?` and do not require a bot mention. Examples: `?ip` (then reply to the bot's prompt with `Java` or `Bedrock`), `?java`, `?bedrock`, `?plugins`, `?world download`, `?help`, `?invite`, `?roles`, `?channels`, `?rules`, `?start`, `?stop`, `?status`, `?dashboard`, `?ai status`, and `?summarize <#channel>`. Administrative shortcuts still enforce their configured permissions. Use slash commands for AFK and summaries. The special `?rejoin` shortcut requires a direct mention of the Main Bot and the dedicated rejoin allow-list. The slash form uses the same allow-list. The command disconnects the Minecraft AFK client for 30 seconds, then reconnects it. The Retry button starts a fresh 30-second rejoin cycle.

The configured Mineflayer client protocol is separate from the server version. The project currently depends on upstream `mineflayer` 4.39.x, which does not yet natively support Minecraft Java 26.2; do not change the client protocol to `26.2` until a compatible protocol stack is installed and tested.

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

Scheduled administrative actions are saved locally so they can survive a restart.

---

# Runtime state

The following files are generated locally and should not be committed:

- `daily-welcomes.json`
- `scheduled-actions.json`
- `user-afk.json`
- logs and local runtime data

They contain state rather than source code.

---

# Environment

Create a local `.env`:

```env
DISCORD_TOKEN=your_discord_bot_token

# Comma-separated privileged Discord IDs; at least one list must be configured.
# Keep actual values in local .env or your hosting provider's environment settings.
ADMIN_USER_IDS=
ADMIN_ROLE_IDS=

GEMINI_API_KEY=your_primary_gemini_api_key
GEMINI_API_KEY_2=your_second_gemini_api_key
GEMINI_API_KEY_3=your_third_gemini_api_key
GEMINI_API_KEY_4=your_fourth_gemini_api_key

MC_PASSWORD=

ERROR_CHANNEL_ID=

STATUS_PORT=3000
STATUS_ALLOWED_ORIGINS=https://the-cottage.onrender.com
```

The exact hosting platform may provide `PORT` automatically. When it does, the bot uses that value for the status server.

Never commit real credentials or privileged access IDs. The actual `ADMIN_USER_IDS` and `ADMIN_ROLE_IDS` values belong only in the deployment environment or an ignored local `.env` file.

The bot fails closed during configuration if neither admin list is configured, or if the supplied IDs are malformed. Set at least one valid user ID or role ID in your hosting panel before deploying this branch.

The status API is intentionally public and read-only. It exposes only the online state, player count, uptime, reconnection attempts, and timestamp; it does not return the server hostname or port. CORS defaults to the Cottage website origin, but CORS is a browser policy, not authentication.

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
npm ci
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
npm ci
```

Then create `.env` and run:

```bash
node index.js
```

Only run one Main Bot instance at a time.

---

# Testing

Run the automated unit tests and syntax checks before manual testing:

```bash
npm test
```

The GitHub Actions validation workflow runs JavaScript syntax checks and `npm test` on pull requests.

A practical manual test order is:

1. Start the bot and verify Discord login and slash-command reconciliation.
2. Run `/help` as a public user; confirm the new `/rejoin` entry appears.
3. Test `/afk`, `/forget`, and `/summarize`.
4. Test a normal AI mention and a reply-aware follow-up.
5. Test `?IP`, `?Ip`, and `?ip`; reply to each prompt with Java and Bedrock in separate tests.
6. Test `?java`, `?bedrock`, `?plugins`, `?world download`, `?help`, `?invite`, `?roles`, `?channels`, and `?rules`.
7. Confirm `?server features`, `?server ip`, and `?smp join` are no longer handled as shortcuts.
8. Test existing admin shortcuts and slash commands with authorized and unauthorized accounts.
9. Test `/rejoin` using the explicitly allowed user ID and a member with the required role; other users should receive a generic unavailable response.
10. Test `@Main Bot ?rejoin` with an authorized account. Confirm plain, unpinged `?rejoin` is ignored.
11. Confirm the AFK client disconnects immediately, stays offline for 30 seconds, then reconnects. Test the Retry button and verify unauthorized users cannot use it.
12. Verify DiscordSRV relay messages and replies remain excluded from conversational AI.
13. Verify ordinary direct mentions and replies to Main Bot messages still work in normal conversation channels.
14. Verify the website can reach `/api/status`.
15. Review logs for Discord, Minecraft, Gemini, network, and permission errors.
