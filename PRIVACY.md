# Privacy Notice

_Last reviewed: 13 November 2026_

This notice describes the data handling visible in the current The Cottage★ Main Bot source. It is intended to help server members understand what the bot processes. It is not legal advice and does not replace the privacy terms of Discord, Google, the Minecraft server host, or the bot's hosting provider.

## What the bot processes

Depending on which features are used, the bot may process:

- **Discord messages and identifiers:** message text, Discord user IDs, channel IDs, display names, and role information needed to respond, enforce access, or keep separate conversation contexts.
- **Minecraft chat and player names:** chat text sent to the bot, player usernames, and join/leave events needed for replies, chat relay, and daily welcomes.
- **AFK status:** a Discord user ID, the optional AFK reason, and the time the status was set.
- **Scheduled actions:** the action name (`start` or `stop`), execution and scheduling timestamps, the requesting user ID, and the Discord channel ID used for the completion notice.
- **Operational information:** connection state, player counts, uptime, reconnect counts, timestamps, and diagnostic errors.

Do not send passwords, API keys, payment details, private contact information, or other sensitive information to the bot.

## When information is processed or shared

- Messages that invoke the AI through a direct mention, a reply to the bot, or a supported Minecraft AI interaction may be sent to **Google Gemini** through the configured API. Known server answers may be handled locally without a Gemini request.
- `/summarize` reads up to the latest 100 non-bot, non-system messages in the selected text channel, builds a transcript capped at 18,000 characters, and sends that transcript to Google Gemini to generate the summary.
- The configured Discord-to-Minecraft relay sends ordinary messages from its designated Discord channel to the Minecraft server. Slash-prefixed Minecraft commands, bot messages, and webhook messages are not forwarded.
- Discord is used to deliver messages, commands, and bot responses. The hosting provider runs the bot and may process application logs and runtime files as part of providing that service.
- The public read-only status endpoint returns only operational fields such as online state, player count, uptime, reconnect attempts, and a check timestamp. It does not intentionally return the configured Minecraft hostname, port, API keys, or Discord identifiers.

Google Gemini, Discord, the Minecraft server host, and the bot's hosting provider operate under their own terms and privacy practices. Review those providers' policies for information about their handling and retention.

## Where information is stored and how long it remains

- **AI conversation context** is held in process memory for the lifetime of the running bot. `/forget` clears the requesting user's conversation context; `/aforget` clears all normal AI conversation contexts. Restarting the bot also clears in-memory conversation context.
- **Channel summaries** are generated as temporary responses and the bot attempts to delete them after 10 minutes. A summary request uses a temporary AI session rather than adding the channel transcript to a persistent conversation.
- **AFK status** is stored in the local `user-afk.json` runtime file until the status is cleared or the file is removed.
- **Daily welcome state** is stored in `daily-welcomes.json` and tracks player names for the current date in the Asia/Manila timezone; it is refreshed when the date changes.
- **Scheduled administrative actions** are stored in `scheduled-actions.json` while pending and are removed as they execute or are cancelled.
- **Application logs** are written to the process output and may be retained by the hosting provider according to that provider's configuration. Some log entries include Minecraft player names, chat prompts, or diagnostic error details.

Runtime files are intended to remain on the bot host and are excluded from Git. The project does not define a universal retention period for host logs or provider-side processing.

## Choices and requests

Use `/forget` to clear your own in-memory AI conversation context. AFK status can be cleared through the bot's AFK flow. For a request about local runtime files or host logs, contact the community staff who operate the bot; they may need to perform the deletion on the hosting system.

## Changes

This notice may be updated when bot features, providers, or data handling change. The date above identifies the last review of this file.
