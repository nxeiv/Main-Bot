# Main Bot + Cottage Website — Today's verification checklist

Use this after the next deployment when electricity and hosting access are available. Mark each item **PASS**, **FAIL**, or **NOT TESTED**. Do not treat a passing CI run as proof of live Discord/Minecraft behavior.

## Repository and deployment
- [ ] Latest intended PR changes are present on `main`.
- [ ] GitHub Actions validation is green on the final merge commit.
- [ ] Host installs dependencies with `npm ci` and starts `node index.js`.
- [ ] Only one Main Bot process is running.
- [ ] No credentials, private IDs, or runtime-state files were committed.

## Discord startup and commands
- [ ] Bot logs in and slash commands reconcile successfully.
- [ ] `/help` shows the expected commands and correct access labels.
- [ ] Public commands work for an ordinary member.
- [ ] Admin-only commands reject an ordinary member without leaking diagnostics.
- [ ] `?help`, `?ip`, `?java`, `?bedrock`, `?pl`, `?world download`, `?invite`, `?roles`, `?channels`, and `?rules` work.
- [ ] Ordinary text such as `???`, `?hello`, and messages containing question marks are not mistaken for commands.
- [ ] `?start`, `?stop`, and `?rejoin` enforce the intended permissions.
- [ ] `/ping` access matches the intended policy.

## AFK and Minecraft utility
- [ ] Discord `/afk [reason]` stores the reason and timestamp.
- [ ] Mentioning an AFK member shows the reason/time and respects the notification cooldown.
- [ ] The member's next message clears AFK and posts the return notice.
- [ ] The Minecraft utility client remains stopped after a fresh Main Bot process restart.
- [ ] Authorized `/start` starts the utility client; `/stop` stops it.
- [ ] Unexpected disconnects reconnect only after the client has been manually started.
- [ ] Java/Bedrock address guidance and plugin/world information are correct.
- [ ] Discord ↔ Minecraft chat relay works without triggering Discord AI on relayed messages.
- [ ] Minecraft join/leave events and player counts are correct inside Discord diagnostics only.

## AI and summaries
- [ ] AI responds only to direct mentions and supported replies in allowed channels.
- [ ] AI context is isolated by user and channel as intended.
- [ ] Rate limits, queue behavior, and Gemini key failover behave correctly.
- [ ] Gemini failures produce a safe fallback and useful private logs.
- [ ] `/forget` clears only the requesting user's context.
- [ ] `/aforget` is restricted to administrators.
- [ ] `/summarize` respects channel access and returns a private summary.

## Voice
- [ ] `/vc join` joins the invoking admin's regular voice channel.
- [ ] Bot self-mute and self-deafen remain enabled.
- [ ] `/vc status` reports the saved channel and connection state.
- [ ] `/vc leave` disconnects and clears the saved session.
- [ ] A normal process restart restores a saved voice session.
- [ ] Missing channel permissions and deleted channels fail gracefully.

## Website / SMP card
- [ ] SMP card has no live player-count display.
- [ ] Website no longer requests `the-cottage-bot.wisp.uno`, `/api/status`, or the former WispByte status endpoint.
- [ ] No WispByte status polling, API helper, environment variable, or status widget remains in the website.
- [ ] SMP card still shows the static server information and season/chapter content correctly.
- [ ] No unrelated website, Discord invite, or community content was removed.

## Cleanup and final review
- [ ] README, environment template, and architecture docs match the actual implementation.
- [ ] No stale references to the removed website status bridge remain.
- [ ] `npm test` passes on the deployed code.
- [ ] Review startup/runtime logs for Discord, Minecraft, Gemini, voice, and permission errors.
- [ ] Record every FAIL with the exact command, expected result, actual result, and relevant redacted log excerpt.
