# The Cottage★ Main Bot

The **The Cottage★ Main Bot** is the Discord and Minecraft companion service for **The Cottage★** and its SMP.

It connects the Cottage★ community with Minecraft, provides public and administrative Discord tools, can run an optional Minecraft utility session, and provides Discord-only Gemini-powered AI features.

> **The Cottage★ is the home. The SMP is the backyard.**

The bot is infrastructure for the community — useful in the background without trying to become the main character.

## Project notices

- **License:** [GNU General Public License v3.0 only](LICENSE)
- **Privacy:** [Privacy notice](PRIVACY.md)
- **Security:** [Security policy and vulnerability reporting](SECURITY.md)

The privacy notice describes the message, identifier, and runtime-state handling implemented by this bot. Review it before enabling the bot in additional channels or communities.

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
- Discord AI responses pass through the shared Unicode theme layer.
- Discord mentions, channel references, URLs, commands, and the **Cottage★** name are preserved.
- Remaining default emoji-presentation characters are normalized so AI output does not unexpectedly switch back to pictographic emoji.

This is a presentation layer only. It does not change command behavior or underlying data.

The goal is the same as the website: **quiet, warm, recognizable, and not overly decorated.**

---

# What it does

## Discord

- Discord AI chat with channel-aware conversation memory
- reply-aware AI follow-ups
- deterministic answers for confirmed Cottage★ information
- Discord/community help
- Minecraft/SMP help
- feature descriptions and tutorials
- Minecraft connection status
- administrative `/start`, `/stop`, `/rejoin`, and unified `/status`
- `/ping` for a quick Discord latency check
- `/summarize <channel>` for private channel summaries
- admin-verified AI administrative requests
- scheduled administrative actions with persistence
- `/forget` and `/aforget`

- administrator-only `/vc join`, `/vc leave`, and `/vc status` for a persistent, muted and deafened Discord voice connection
- public `/afk [reason]`
- daily Minecraft player welcomes
- Discord ↔ Minecraft chat integration
- optional private error reporting
- slash-command watchdog and reconciliation

## Minecraft

The Minecraft side uses Mineflayer and provides:

- connection and reconnection handling
- exponential reconnect backoff
- player detection and join/leave events
- Minecraft chat relay (no Minecraft-side AI responses)
- Discord ↔ Minecraft chat relay
- lightweight anti-AFK activity
- deterministic daily player welcomes
- Minecraft status reporting to Discord

The configured Minecraft account is **Server**.

---

# Architecture

| File | Responsibility |
| --- | --- |
| `index.js` | Discord client, events, scheduling, permissions, and Discord/Minecraft orchestration |
| `command-registry.js` | Authoritative command metadata, slash-command generation, text shortcuts, categories, access labels, and generated help |
| `commands.js` | Thin slash-command registry adapter |
| `message-routing.js` | Pure policy for deciding when conversational AI may respond |
| `afk-store.js` | Persistent per-user Discord AFK state and validation |
| `shutdown.js` | Idempotent cleanup of Minecraft and Discord connections |
| `minecraft.js` | Mineflayer connection, reconnect logic, player tracking, chat, and anti-AFK behavior |
| `rejoin-controller.js` | Delayed manual disconnect/reconnect cycle |
| `rejoin-access.js` | Dedicated user/role allow-list for the rejoin command |
| `ai.js` | Gemini clients, conversation memory, AI requests, rate limiting, and administrative request parsing |
| `ai-knowledge.js` | Confirmed server facts, feature guides, aliases, help text, and AI system prompt |
| `summary.js` | Channel-summary generation and dismiss-button behavior |
| `unicode.js` | Shared Unicode-first presentation/theme layer |
| `permissions.js` | Central command access policy driven by command registry metadata |
| `config.js` | Discord, Minecraft, reconnect, and server configuration |
| `.env.example` | Environment variable template |
| `package.json` | Dependencies, scripts, and Node.js requirement |

Runtime state is deliberately kept outside source code.

---

# Access model

Command access levels are declared once in `command-registry.js` and enforced by `permissions.js`.

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
| `/aforget` | Admin |

Administrators can be granted through configured user IDs and the Cottage★ Moderator role.

The command registry is the source of truth for public, admin, owner, and restricted access labels. Unknown commands fail closed.

---

# Website integration

The website does not depend on a live API hosted by the Minecraft utility bot. The SMP card is informational and does not display a live player count. This removes the former WispByte-hosted status bridge and its external polling dependency.

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
| `/status` | Admin | Unified Discord, Minecraft connection, and AI diagnostics |
| `/aforget` | Admin | Clears all Discord AI conversations |
| `/vc join` | Admin | Joins the invoking member's current voice channel and restores the connection after normal bot restarts |
| `/vc leave` | Admin | Stops and clears the persistent voice session |
| `/vc status` | Admin | Shows the saved channel and current connection state |

The bot's `/help` response mirrors the supported commands directly in Discord. The Minecraft client no longer invokes Gemini; AI conversations remain in Discord.

The `/vc` commands use the Discord voice gateway through `@discordjs/voice`. `/vc join` joins the administrator's current regular voice channel with the bot self-muted and self-deafened; it does not transmit or receive member audio. The selected channel is stored in the local `voice-session.json` runtime file and restored after a normal bot restart. The connection can recover from supported transient voice-gateway interruptions while the process remains online. This is not an uptime guarantee: hosting outages, process shutdowns, Discord outages, deleted channels, or removed permissions can interrupt the session. The bot needs the **Connect** permission in the target channel.

**Conversational AI is opt-in.** Members must directly mention the bot or reply to one of its messages in a normal conversation channel. Ordinary chat and messages that merely contain a keyword do not trigger AI. DiscordSRV webhook messages, replies to Minecraft relay messages, and the configured Discord-to-Minecraft relay channel are excluded from conversational AI.

**Case-insensitive text shortcuts** begin with `?` and do not require a bot mention. Commands use one word, except `?world download` and `?summarize <#channel>`. Supported shortcuts: `?ip`, `?java`, `?bedrock`, `?pl`, `?world download`, `?help`, `?invite`, `?roles`, `?channels`, `?rules`, `?afk [reason]`, `?start`, `?stop`, `?rejoin`, `?status`, and `?summarize <#channel>`. Administrative shortcuts check the triggering member's configured permissions; `?rejoin` uses its dedicated allow-list. Shortcut replies are deterministic and do not call Gemini. Any ordinary message clears the author's AFK state and announces their return; mentioning an AFK member displays their reason and relative AFK timestamp.

The configured Mineflayer client protocol is separate from the server version. The project currently depends on upstream `mineflayer` 4.39.x, which does not yet natively support Minecraft Java 26.2; do not change the client protocol to `26.2` until a compatible protocol stack is installed and tested.

---

# AFK system

The Minecraft connection client remains a separate server utility. It does not answer in-game chat with AI; conversational AI runs only in Discord. The AFK client is opt-in: it stays stopped after a Main Bot process restart and must be started with an authorized `/start` or `?start` command. Once started, it automatically reconnects after unexpected disconnects for the remainder of that process run.

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
- Discord response formatting
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
MC_LOGIN_PASSWORD=

ERROR_CHANNEL_ID=

```

Never commit real credentials or privileged access IDs. The actual `ADMIN_USER_IDS` and `ADMIN_ROLE_IDS` values belong only in the deployment environment or an ignored local `.env` file.

`MC_LOGIN_PASSWORD` is the password for Main-Bot's already-registered SparkLogin account named `Server`. It is separate from `MC_PASSWORD`, which is the optional Minecraft account-authentication setting. Set `MC_LOGIN_PASSWORD` only in the hosting provider's private environment settings; never put the real value in GitHub or share it in chat. Main-Bot responds to SparkLogin's existing-account pre-join login dialog once per connection. It deliberately stops rather than auto-registering or repeatedly submitting a rejected password.

The bot fails closed during configuration if neither admin list is configured, or if the supplied IDs are malformed. Set at least one valid user ID or role ID in your hosting panel before deploying this branch.

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

Startup establishes the Discord connection, reconciles slash commands, loads persistent state, and restores an explicitly saved voice session. The Minecraft AFK client remains stopped after a process restart until an authorized `/start` or `?start` command is used.

---

# WispByte / Pterodactyl

The Main Bot can run as a Node.js application under a Pterodactyl-style host.

The repository expects:

- Node.js 26+
- dependencies installed with `npm ci`
- `index.js` as the entry point

The application should use:

`node index.js`

Do not run two copies of the same Main Bot at the same time.

Two instances would compete for:

- the same Discord bot account
- the same Minecraft account
- the same administrative state

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

The GitHub Actions validation workflow runs JavaScript syntax checks, installs the committed dependency tree with `npm ci`, audits production dependencies, and runs `npm test` on pull requests and pushes to `main`.

A practical manual test order is:

1. Start the bot and verify Discord login and slash-command reconciliation.
2. Run `/help` as a public user; confirm the new `/rejoin` entry appears.
3. Test `/afk`, `/forget`, and `/summarize`.
4. Test a normal AI mention and a reply-aware follow-up.
5. Test `?IP` and `?ip`; reply to the prompt with Java and Bedrock in separate tests.
6. Test `?java`, `?bedrock`, `?pl`, `?world download`, `?help`, `?invite`, `?roles`, `?channels`, and `?rules`.
7. Confirm `?server features`, `?server ip`, and `?smp join` are no longer handled as shortcuts.
8. Test existing admin shortcuts and slash commands with authorized and unauthorized accounts.
9. Test `/rejoin` using the explicitly allowed user ID and a member with the required role; other users should receive a generic unavailable response.
10. Test `@Main Bot ?rejoin` with an authorized account. Confirm plain, unpinged `?rejoin` is ignored.
11. Confirm the Minecraft AFK client stays offline after a fresh process restart. Use an authorized `/start` or `?start`, verify it connects, then use `/stop` or `?stop` and confirm it stays stopped.
12. Test `/rejoin` separately: confirm the immediate disconnect, 30-second reconnect delay, Retry button behavior, and rejection of unauthorized users.
13. Verify DiscordSRV relay messages and replies remain excluded from conversational AI.
14. Verify ordinary direct mentions and replies to Main Bot messages still work in normal conversation channels.
15. Confirm the website SMP card does not request or display live player counts.
16. Review logs for Discord, Minecraft, Gemini, network, and permission errors.
