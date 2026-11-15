# Main Bot 2.0 — today's manual verification checklist

Use this after deployment. Mark each item **PASS**, **FAIL**, or **NOT TESTED**. CI does not replace live testing.

## Merge record
- #46 merged first: voice command extraction, text shortcut handler, Minecraft event handlers, shared response utilities, WispByte website status API removal, tests, docs, and checklist.
- #47 merged second: Discord interaction routing extraction.
- #48 merged third: general and admin command handler separation.
- #49 merged: restore the missing IP prompt key helper that caused the WispByte ReferenceError.
- #50 merged: pin patched uuid 11.1.1 across the transitive dependency tree and explicitly deny the unnecessary protobufjs install script.
- #51 merged: extract the IP prompt key into one shared, tested helper used by both message handlers.
- Previously merged: #37, #38, #40, #41, #42, and #45.
- #43 and #44 were closed without merging because #45 superseded their lockfile work.
- No open pull requests remain in Main-Bot.

## Build and startup
- [x] PR changes #46 → #47 → #48, followed by fixes #49 → #50 → #51, are merged to `main`.
- [x] GitHub Actions passed on the final PR validation (run #308): syntax, lockfile install, production audit, and 91 tests.
- [x] Production dependency audit reported 0 vulnerabilities after the UUID override.
- [x] WispByte log confirms Node.js v26.13.0.
- [x] protobufjs install script is explicitly denied; transitive uuid is pinned to patched 11.1.1.
- [ ] Apply the latest `main` files to WispByte and confirm its dependency install is clean.
- [ ] Run `npm audit --omit=dev` on WispByte and confirm 0 vulnerabilities.
- [ ] Bot starts once, logs into Discord, and reconciles slash commands.
- [ ] No secrets or runtime JSON files are committed.

## Discord commands and permissions
- [ ] `/help` lists the intended commands.
- [ ] Public commands work for ordinary members.
- [ ] Admin commands reject non-admin users.
- [ ] `/ping` access matches the intended policy.
- [ ] `???`, `?hello`, and other normal text are not treated as shortcuts.
- [ ] `?ip` posts the Java/Bedrock choice prompt.
- [ ] Replying to that exact prompt with Java or Bedrock returns the correct address.
- [ ] Unrelated messages and replies to other messages do not consume a pending IP choice.
- [ ] `?java`, `?bedrock`, `?pl`, `?world download`, `?help`, `?invite`, `?roles`, `?channels`, and `?rules` work.
- [ ] `?start`, `?stop`, and `?rejoin` enforce the right access rules.

## Discord AFK
- [ ] `/afk [reason]` persists the reason and timestamp.
- [ ] AFK mentions show reason/time and respect cooldowns.
- [ ] The next user message clears AFK and posts a return notice.
- [ ] Departing members' AFK records are cleared.

## Minecraft utility and relay
- [ ] Minecraft client stays stopped after a fresh Main Bot restart.
- [ ] Authorized `/start` starts it and `/stop` stops it.
- [ ] Transient disconnects reconnect only after manual startup.
- [ ] Java/Bedrock, plugin, and world-download information is current.
- [ ] Discord ↔ Minecraft relay works.
- [ ] Relayed messages do not trigger Discord AI.

## AI and summaries
- [ ] AI only responds to supported direct mentions/replies.
- [ ] Per-user/channel context isolation works.
- [ ] Rate limits, queue, Gemini failover, and failure fallback work.
- [ ] `/forget` clears only the requester's context.
- [ ] `/aforget` is admin-only.
- [ ] `/summarize` respects access and returns a private summary.

## Voice
- [ ] `/vc join` joins the admin's regular voice channel.
- [ ] Self-mute and self-deafen remain enabled.
- [ ] `/vc status` reports the saved channel and connection state.
- [ ] `/vc leave` disconnects and clears saved state.
- [ ] Saved voice session restores after normal restart.
- [ ] Missing permissions/deleted channels fail gracefully.

## Website and retired status API
- [ ] Homepage and SMP page have no live status/player-count panel.
- [ ] Website source contains no WispByte API URL, `/api/status`, polling, or player-count renderer.
- [ ] Main Bot no longer starts an HTTP status server.
- [ ] No `STATUS_PORT` or `STATUS_ALLOWED_ORIGINS` setting is needed.
- [ ] Discord-only `/status` still works and does not display a player count.

## Final cleanup
- [ ] README, audit, and `.env.example` match the code.
- [ ] No stale WispByte website-status references remain.
- [ ] Full `npm test` passes.
- [ ] Review logs and record every failed test with expected vs actual behavior and redacted logs.
