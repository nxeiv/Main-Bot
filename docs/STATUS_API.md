# Private Minecraft status API

Main Bot exposes a small, read-only HTTP API for the Cottage★ website.

## Private WispByte environment

Set these values in the service's private environment settings. Do not commit the real values:

- `MC_SERVER_HOST`: Java server hostname from the current Discord joining announcement.
- `MC_SERVER_PORT`: Java server port from that announcement.
- `MC_BEDROCK_PORT`: Bedrock port, used by the bot's joining-help response.
- `STATUS_PORT`: HTTP listener port (use the port exposed by the WispByte service; default 15504).
- `STATUS_ALLOWED_ORIGINS`: `https://the-cottage.onrender.com`
- `STATUS_POLL_INTERVAL_MS`: optional, defaults to 45000.
- `STATUS_TIMEOUT_MS`: optional, defaults to 4000.

The server address is read only by the backend. The status API never returns the host, port, MOTD, player names, raw connection errors, or Discord identifiers.

## Endpoints

- `GET /health`: process health only.
- `GET /api/status`: `online`, `state`, `players`, `maxPlayers`, `version`, and `checkedAt`.

Possible states:

- `checking`: the first check has not completed.
- `unknown`: private connection settings are not configured.
- `online`: the Java status ping succeeded.
- `unavailable`: the status ping failed.

A failed ping cannot reliably distinguish BaoHost hibernation from a stopped process, crash, or network issue. The website therefore uses “not responding” wording and offers the manual Wake Server instructions without claiming that hibernation was confirmed.

## Website

The static SMP page polls `https://the-cottage-bot.wisp.uno/api/status` every 45 seconds. The API allows the configured website origin only. If the API itself cannot be reached, the website shows an unknown status and does not mislabel the Minecraft server.

The Wake Server instructions link to the designated Discord joining message for the current address and then open the Wake Server page. The website never submits the address automatically.
