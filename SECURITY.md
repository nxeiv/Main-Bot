# Security Policy

## Supported versions

Security fixes are prepared for the current `main` branch. Older commits and locally modified deployments may not contain current protections. Update to the latest reviewed code before reporting an issue that may already have been fixed.

## Reporting a vulnerability

Please do not publish tokens, passwords, private logs, personal information, or exploitable details in a public issue or discussion.

Use GitHub's **Report a vulnerability** option in the repository's Security tab when private vulnerability reporting is available. If it is unavailable, contact the repository maintainer privately through an established channel.

Include the affected commit or branch, the component involved, the conditions required to reproduce the issue, and a concise impact description. Share only the minimum information needed to investigate. Do not test against the live Discord server, Minecraft server, or third-party services without explicit permission.

The maintainer reviews reports on a best-effort basis. No response or remediation time is guaranteed. Please coordinate public disclosure with the maintainer so users have a reasonable opportunity to update.

## If a credential was exposed

Revoke or rotate the credential first. Removing it from the latest source does not remove prior copies from Git history, forks, caches, or clones. Review deployment logs and any other locations where the credential may have been copied.

## Deployment security

- Keep `.env` and production environment values out of Git.
- Keep `ADMIN_USER_IDS` and `ADMIN_ROLE_IDS` in the deployment environment, not source code.
- Use separate, least-privilege credentials for Discord, Gemini, and hosting.
- Restrict access to the Discord error-reporting channel because diagnostic messages may contain technical details.
- Do not enable wildcard CORS for the status API unless access from every website is intentional. CORS is not authentication.
- Keep Discord channel permissions and command authorization aligned with the bot's intended audience.
- Do not expose private configuration, credentials, or logs through the public status endpoint.

## Automated checks

Pull requests and pushes to `main` run JavaScript syntax checks, unit tests, and a production-dependency audit. Dependabot is configured to check npm packages and GitHub Actions weekly. Passing these checks does not prove that the application is free of vulnerabilities.
