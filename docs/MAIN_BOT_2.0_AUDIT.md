# Main Bot 2.0 — Repository Audit

_Last reviewed: 15 November 2026_

## Audit scope

Reviewed the repository tree, runtime entry point, configuration, command definitions, text shortcut parser, permission helpers, Discord AFK storage, AI service, Minecraft connection and relay modules, voice-session manager, status bridge, shutdown handling, tests, dependency manifest, privacy notice, security policy, and CI workflow.

This is a source-level audit. It does not replace a live staging deployment, a complete runtime exercise against Discord/Gemini/Minecraft, or a host-specific security review.

## Current architecture inventory

| Area | Current files | Assessment |
|---|---|---|
| Runtime and Discord events | `index.js` | KEEP, then split. The entry point is about 2,600 lines and currently owns event routing, command execution, scheduled actions, status embeds, AFK handling, and AI orchestration. |
| Command registry | `command-registry.js`, `commands.js`, `text-shortcuts.js`, `ai-knowledge.js` | KEEP, IMPROVE. Slash definitions, shortcut names, access metadata, categories, and help output now derive from one registry. Runtime execution handlers still live in `index.js` and need extraction. |
| Text shortcuts | `text-shortcuts.js` | KEEP. Parsing is intentionally strict and ignores unknown question-mark messages. Move metadata into the shared command registry. |
| Configuration | `config.js`, `.env.example` | KEEP, IMPROVE. Core secrets and admin IDs are environment-driven; service IDs and some feature values remain embedded in configuration/source. |
| Permissions | `permissions.js`, `role-access.js`, `rejoin-access.js` | KEEP, IMPROVE. Feature access now comes from registry metadata and one permission service; the restricted rejoin allow-list remains a dedicated policy helper. |
| Discord AFK | `afk-store.js`, `afk-notifications.js` | KEEP. State persists across restarts. Repeated mention notifications are now throttled per channel/user; departing members' AFK entries are cleared. |
| Discord AI | `ai.js`, `ai-knowledge.js` | KEEP, IMPROVE. It already has a bounded request queue, per-user cooldowns, key failover, and bounded message context. Session expiry, stronger cancellation/timeouts, and clearer separation from Discord events remain desirable. |
| Minecraft connection | `minecraft.js`, `spark-login.js` | KEEP, IMPROVE. The client remains opt-in after process restarts and reconnects after transient failures once manually started. |
| Minecraft chat relay | `minecraft-chat.js`, `message-routing.js` | KEEP. Input validation and relay/AI separation exist; add more integration coverage around webhook and mention edge cases. |
| Voice connection | `voice-session.js` | KEEP, IMPROVE. Explicit join/leave and persistent restore exist. Improve diagnostics, recovery testing, and permission-loss handling. |
| Website status bridge | `status-server.js` | KEEP, IMPROVE. Public status is filtered and CORS is allow-listed; add endpoint tests for malformed requests and operational health. |
| Summaries | `summary.js` | KEEP. It is already separated from the main entry point and uses temporary private responses. |
| Shutdown | `shutdown.js` | KEEP. Extracted and testable; ensure every future service registers its cleanup. |
| Presentation | `unicode.js` | KEEP. Small, focused presentation helper. |
| Tests | `test/*.test.js` | KEEP, EXPAND. Existing unit tests cover many helpers; live service behavior still needs staging/manual verification. |

## Feature inventory

### KEEP
- Discord community commands, deterministic help and server information.
- Discord-only Gemini conversations and channel summaries.
- Persistent Discord AFK state, return clearing, duration display, and mention notifications.
- Minecraft connection controls, status, Java/Bedrock information, plugin/world information, chat relay, and website bridge.
- Manual `/start` and `?start` for the Minecraft AFK client; it must remain stopped after a process restart.
- Persistent, muted/deafened Discord voice connection with explicit `/vc join`, `/vc leave`, and `/vc status`.
- Central configuration, reusable permission helpers, graceful shutdown, and existing regression tests.

### IMPROVE
- Continue extracting the oversized `index.js` into focused Discord event, interaction, text-command, scheduled-action, and status modules. (The first architecture increment now provides a shared command registry and permission service.)
- Expand the command registry to drive runtime dispatch as well as slash metadata, text shortcuts, categories, permissions, and generated help.
- Route all privileged operations through one permission policy, including rejoin and scheduled actions.
- Add expiry/cleanup for inactive AI sessions, request timeouts/cancellation, and robust queue shutdown.
- Add voice connection state monitoring and tests for reconnect, deleted channels, and missing permissions.
- Standardize structured logs, redact secrets/tokens, and keep private message contents out of routine diagnostics.
- Add member-removal AFK cleanup and notification cooldowns (implemented in this branch).
- Improve status reporting to distinguish configured/connected/healthy/degraded rather than treating configuration as operational health.
- Add integration tests for Discord event routing, command permissions, and external service failures.
- Keep dependency versions and lockfile synchronized in every change.

### REMOVE
- Minecraft-side Gemini/chatbot behavior (already removed from the Discord-first cleanup).
- Unused `mineflayer-pathfinder` dependency (removed from the manifest in this branch; ensure the committed lockfile is regenerated before deployment).
- Duplicate dashboard and AI-status commands in favor of unified `/status`.
- Redundant Java/Bedrock address shortcut aliases and the old `?plugins` alias in favor of `?pl`.

## Important findings and risks

1. **Large runtime entry point:** `index.js` still combines too many concerns. This is the main maintainability risk and should be addressed incrementally with tests around each extracted boundary.
2. **Command metadata duplication:** slash definitions, runtime switch cases, text shortcut parsing, and help content are still separate sources of truth. The command registry should become the authoritative metadata source.
3. **Permission drift risk:** reusable helpers exist, but not every privileged path is expressed through one policy. Scheduled actions must retain the authorization decision of the original requester and never become user-triggerable through an untrusted persisted file.
4. **AI session lifecycle:** sessions are in-memory and keyed by caller context. They need explicit idle expiry and bounded total session storage in addition to bounded request history.
5. **Operational health semantics:** the status view should report actual recent service checks and stale data, not only whether credentials are configured.
6. **Voice restore constraints:** persistence restores the configured channel after normal process restart, but hosting uptime, Discord availability, and channel permissions remain external requirements.
7. **Dependency/lockfile consistency:** dependency manifest and lockfile must be updated together. The validation workflow currently refreshes the lockfile in CI before installation; that should not be used as a substitute for committing the updated lockfile.
8. **Sensitive diagnostics:** error stacks and raw error messages can contain request details. Review log/report paths and redact secrets before forwarding errors to Discord.
9. **Hard-coded operational identifiers:** service/channel IDs and the restricted rejoin allow-list should be reviewed and centralized as validated configuration values.
10. **Live compatibility:** the Minecraft client protocol is intentionally separate from the SMP server version. Do not change protocol versions based only on the server's advertised version.

## Recommended implementation order

1. **Architecture foundation:** shared command registry, permission policy, response helpers, and event-module boundaries. Keep behavior unchanged.
2. **Reliability:** AFK cooldown/member cleanup, AI session expiry/timeouts, voice restore/reconnect diagnostics, and scheduler safety.
3. **Security and operations:** secret redaction, validated configuration, least-privilege status endpoints, dependency audit, and structured logs.
4. **Verification:** unit/integration tests, staging smoke tests, then production deployment with rollback instructions.

## Explicitly not claimed

This audit does not claim that every external integration has been exercised live, that the hosting platform guarantees 24/7 uptime, or that the bot is vulnerability-free. CI passing is necessary but not sufficient for release readiness.
