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

- AI chat with channel-aware conversation memory
- Reply-aware AI follow-ups that use the referenced bot message as context
- Unified Discord, Minecraft, and AI health dashboard
- Deterministic answers for confirmed Cottage★ information
- Discord/community help
- Minecraft/SMP help
- Feature descriptions and tutorials
- Minecraft connection and player-count status
- Administrative `/start`, `/stop`, `/status`, `/dashboard`, and `/maintenance` controls
- `/summarize <channel>` for a dismissable channel summary
- Administrator moderation tools: `/warn`, `/modlog`, `/banishlist`, `/unbanish`, and `/clearwarns`
- Reply-to-message `banish?` moderation with a configurable 5-second timeout and escape phrase
- Persistent banishment and moderation event state
- AI-assisted administrative requests with admin verification
- Scheduled administrative actions with persistence across restarts
- `/forget` for clearing one user's AI conversation
- `/aforget` for clearing all AI conversations
- `/ai status` for administrator-only AI diagnostics, including request/error counters
- `/afk <reason>` for the bot's Discord AFK presence; `afk? <reason>` is the admin text shortcut
- Discord error reporting through an optional private error channel
- Slash-command watchdog and automatic reconciliation
- Daily Minecraft player welcomes
- Discord-to-Minecraft and Minecraft-to-Discord integration

### Channel summaries

Use the slash command:

`/summarize channel:#general`

The command:
- Uses Discord's channel picker to select the target channel
- Reads up to the latest 100 messages it can access
- Limits the transcript sent to Gemini
- Generates a concise summary focused on decisions, questions, announcements, plans, and unresolved topics
- Returns the result in a dedicated embed with a `Dismiss summary` button
- Allows only the person who requested the summary to dismiss it
- Does not use emojis or decorative Unicode in the generated summary

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
| `config.js` | Server, Discord, bot, administrator, reconnect, moderation, and banish configuration |
| `banish.js` | Configurable reply-to-message banishment system and persistent banish state |
| `moderation.js` | Persistent warnings, moderation events, duration parsing, and moderation history |
| `.env.example` | Template for required secrets |
| `.gitignore` | Prevents secrets, dependencies, runtime state, logs, and local files from being committed |
| `daily-welcomes.json` | Runtime state for daily Minecraft welcomes; created locally and ignored by Git |
| `scheduled-actions.json` | Runtime state for persistent scheduled actions; created locally and ignored by Git |
| `banish-state.json` | Runtime state for active banishments; created locally and ignored by Git |
| `moderation-state.json` | Runtime moderation history and warnings; created locally and ignored by Git |

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

# Optional private Discord channels
MODERATION_LOG_CHANNEL_ID=
ERROR_CHANNEL_ID=
```

At minimum, `DISCORD_TOKEN` and `GEMINI_API_KEY` should be configured for the full bot feature set.

Additional Gemini keys are optional and provide failover when a configured key hits a supported quota, rate-limit, or temporary availability error.

`MC_PASSWORD` is optional with the current `offline` Minecraft authentication configuration.

Do **not** commit `.env` or any real credentials to GitHub.

### Non-secret server configuration

Normal server settings are kept in `config.js`, including:

- Discord client and guild IDs
- Status, maintenance, chat, moderation-log, and error-report channel IDs
- Administrator user IDs and administrator role IDs
- Minecraft hostname and port
- Minecraft version
- Minecraft bot username
- Minecraft authentication mode
- Reconnect timing

Review `config.js` before deploying the bot to a different server or Discord guild.

Administrators can be configured by both user ID and role ID in `config.js`; members with a configured administrator role can use the administrator commands and admin AI actions.

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
| `/help` | **Public** | Shows the bot help message and access labels |
| `/forget` | **Public** | Clears the requesting user's AI conversation |
| `/summarize <channel>` | **Public** | Summarizes recent messages from a selected channel |
| `/start` | **Admin** | Starts the Minecraft AFK session |
| `/stop` | **Admin** | Stops the Minecraft AFK session |
| `/status` | **Admin** | Shows Minecraft AFK status |
| `/afk <reason>` | **Admin** | Marks the Discord bot as AFK; use `off` to clear |
| `/maintenance` | **Admin** | Sends the configured maintenance announcement |
| `/aforget` | **Admin** | Clears all AI conversations |
| `/ai status` | **Admin** | Shows AI health and queue diagnostics |
| `/dashboard` | **Admin** | Shows Discord, Minecraft, and AI health |
| `/warn <user> <reason>` | **Admin** | Records a persistent moderation warning |
| `/modlog <user>` | **Admin** | Shows recent moderation history |
| `/banishlist` | **Admin** | Shows active banishments |
| `/unbanish <user>` | **Admin** | Releases a member from banishment |
| `/clearwarns <user>` | **Admin** | Clears recorded moderation warnings |

The bot's `/help` response also displays `[Public]` or `[Admin]` beside each command so the access level can be checked directly in Discord.

## Testing guide

Use the labels below to separate **Public** tests from **Admin** tests.

### Feature access matrix

| Feature | Access | Test |
| --- | --- | --- |
| `/help` | **Public** | Run `/help`; confirm the response shows the access labels |
| `/forget` | **Public** | Run `/forget`; confirm your own AI context is cleared |
| `/summarize <channel>` | **Public** | Run it in a test channel; confirm a summary is generated and can be dismissed by the requester |
| Known-question autoresponders | **Public** | Post a supported question without mentioning the bot; confirm it answers automatically |
| General AI mention | **Public** | Mention the bot with a normal question; confirm it responds through Gemini |
| Reply-aware AI | **Public** | Reply to a bot message with a follow-up; confirm the referenced message is used as context |
| `/start` | **Admin** | Run as an admin; confirm the AFK Minecraft session starts or reports it is already active |
| `/stop` | **Admin** | Run as an admin during a safe test window; confirm the AFK session stops |
| `/status` | **Admin** | Run as an admin; confirm the Minecraft status embed appears |
| `/dashboard` | **Admin** | Run as an admin; confirm Discord, Minecraft, and AI health appear |
| `/maintenance` | **Admin** | Run only during an intentional maintenance test; confirm the configured maintenance channel receives the announcement |
| `/aforget` | **Admin** | Run as an admin; confirm normal AI conversation state is cleared |
| `/ai status` | **Admin** | Run as an admin; confirm AI diagnostics are returned |
| Moderation commands | **Admin** | Test with a dedicated test account using `/warn`, `/modlog`, and `/clearwarns`; banishment uses its own reply-based flow |
| Banishment | **Admin** | Reply to a test member's message with `banish?`; verify `/banishlist`, then use `/unbanish` |
| Admin AI requests | **Admin** | Make a clear administrative request as an admin; repeat as a non-admin and confirm the second request is rejected |
| Slash-command watchdog | **Public/Admin** | Leave the bot running and verify the command count remains stable in the logs |

### Recommended test order

1. **Start the bot.** Confirm Discord login, slash-command reconciliation, and Minecraft startup in the console.
2. **Run `/help` publicly.** Confirm the response includes `[Public]` and `[Admin]` labels.
3. **Test public deterministic questions.** Send `ip?`, `bedrock?`, `rules?`, `channels?`, `roles?`, `features?`, `java?`, `world download?`, and `smp join?` without mentioning the bot. They should answer automatically.
4. **Verify the removed responders.** Send `tpa?` and `rtp?` without mentioning the bot. They should produce **no automatic response**.
5. **Test public AI.** Mention the bot with a normal question, then reply to its response with a follow-up. This requires Gemini availability.
6. **Test `/forget` and `/summarize`.** Use a test conversation/channel so normal community messages are not affected.
7. **Switch to an admin account.** Test `/status`, `/dashboard`, and `/ai status` first because they are low-risk checks.
8. **Test Minecraft controls.** Test `/start` and `/stop` only when stopping the AFK session is acceptable. Use `/maintenance` only during a deliberate maintenance test.
9. **Test moderation.** With a test account, run `/warn`, `/modlog`, and `/clearwarns`.
10. **Test banishment.** Use the reply-based `banish?` flow, confirm `/banishlist`, then release the test account with `/unbanish`.
11. **Test access control.** From a non-admin account, try `/dashboard` and one moderation command. Both should return the unauthorized response.
12. **Test slash-command recovery.** Watch the 5-minute watchdog logs and confirm they report the registered guild commands rather than repeatedly reporting zero.
13. **Review the console.** Check for Discord errors, unknown-message errors, Gemini 503/429 failures, and unexpected permission failures.

### Removed TPA/RTP responders

These are no longer part of the deterministic knowledge or automatic question-reply system:

- `tpa?`
- `rtp?`
- `teleport?`
- `teleport request?`
- `random teleport?`
- `random teleport`

A user can still explicitly mention the bot or reply to it and ask about those topics; that follows the normal AI path rather than an automatic responder.


### Bot AFK status

The bot has a small Discord-side AFK presence separate from the Minecraft AFK session.

Admin controls:

`/afk <reason>`

The equivalent admin text shortcut is:

`afk? <reason>`

To clear the AFK state, use:

`/afk off`

or:

`afk? off`

Anyone can query the current state with:

`afk?`

When active, the bot changes its Discord presence to an AFK status containing the configured reason. The state is kept in memory and resets when the process restarts.


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

### Banish

The Cottage★ banish mechanic is deliberately admin-only and reply-based.

Reply directly to the member's message with:

`banish?`

The bot applies the configured timeout, records the action, and gives the member the configured escape phrase. After the timeout ends, another non-matching message resets the timeout. Active banishments survive bot restarts, and stale state is automatically discarded after the configured retention period.

The default escape phrase is:

`I am sorry for what I did and I will never do it again.`

The duration, command, escape phrase, persistence file, and stale-state window are configured in `config.js`.

### Moderation logging

When `MODERATION_LOG_CHANNEL_ID` is configured, banishments and administrator moderation actions are sent to that channel.

When `ERROR_CHANNEL_ID` is configured, uncaught exceptions, unhandled rejections, Discord client errors, and other explicitly reported failures are sent there as private diagnostic embeds.
