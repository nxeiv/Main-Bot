# The Cottage★ BOT Dashboard

This directory contains the first visual foundation for the community-management dashboard.

## Current state

- Responsive dashboard layout and navigation
- Server/workspace selector placeholder
- Overview cards for the planned community features
- Initial editor layouts and message previews for:
  - Reaction roles
  - Sticky / persistent messages
  - Say a message
  - Welcome messages
  - Server boost messages
  - Leave messages
  - Join-to-create voice channels
- Controls remain disabled until authentication, authorization, persistence, and bot API wiring are implemented.

This is a UI foundation, not a production-ready admin panel. Do not publish it as a live management dashboard yet.

## Planned production architecture

- **Dashboard frontend + OAuth backend:** Render Web Service, with HTTPS and a GitHub-connected deploy.
- **Discord bot:** remains on WispByte.
- **Bot control API:** authenticated server-to-server requests only; never expose the bot token or control secret to browser JavaScript.
- **Authentication:** Discord OAuth2 with identify, guilds, and the minimum member scope needed for role checks.
- **Authorization:** re-check the signed-in user's access for the selected guild on every management request. Only administrators and configured Cottage★ staff should be able to make changes.
- **Configuration:** persistent, per-guild settings with validation and audit records.
- **Multi-server:** server selector and isolated configuration from the first production release.

## Security requirements

- HTTPS-only production cookies (HttpOnly, Secure, SameSite=Lax).
- OAuth state validation and short-lived sessions.
- CSRF protection for state-changing routes.
- Strict request size limits and input validation.
- Mention parsing disabled for /say and other user-authored bot posts unless an explicit safe mention policy is added.
- No bot tokens, OAuth client secrets, API secrets, or database credentials in source control or browser assets.
- Audit the actor, guild, feature, action, and timestamp for each configuration change.
- Never allow a dashboard user to select a guild where the bot is not installed or where they lack management access.

## Sticky message behaviour

A sticky message is configured per guild and channel. When a member sends a message, the bot removes its previous sticky copy and posts the configured content again. Bot messages and webhook messages do not trigger refreshes. The bot's internal message ID is implementation state only; administrators do not need to provide one.

The dashboard should expose enable/disable, channel selection, content editing, and a live preview. There should be at most one sticky message per configured channel in the initial implementation.

## Hosting notes

The current UI can be served as static files, but the production dashboard must be deployed together with its OAuth backend. The recommended split is Render for the dashboard web service and WispByte for Main Bot. Keep the bot-control API authenticated and server-to-server.
