# Main Bot 2.0 — today's manual verification checklist

Use this after deployment. Mark each item **PASS**, **FAIL**, or **NOT TESTED**. CI does not replace live testing.

## Build and startup
- [ ] PR changes are merged to `main` in dependency order.
- [ ] GitHub Actions is green on the final merge commit.
- [ ] Host runs Node.js 26+ and installs with `npm ci`.
- [ ] Bot starts once, logs into Discord, and reconciles slash commands.
- [ ] No secrets or runtime JSON files are committed.

## Discord commands and permissions
- [ ] `/help` lists the intended commands.
- [ ] Public commands work for ordinary members.
- [ ] Admin commands reject non-admin users.
- [ ] `/ping` access matches the intended policy.
- [ ] `???`, `?hello`, and other normal text are not treated as shortcuts.
- [ ] `?ip`, `?java`, `?bedrock`, `?pl`, `?world download`, `?help`, `?invite`, `?roles`, `?channels`, and `?rules` work.
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
- [ ] Discord-only `/status` still works.

## Final cleanup
- [ ] README, audit, and `.env.example` match the code.
- [ ] No stale WispByte website-status references remain.
- [ ] Full `npm test` passes.
- [ ] Review logs and record every failed test with expected vs actual behavior and redacted logs.
