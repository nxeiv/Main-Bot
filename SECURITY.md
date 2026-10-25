# Security Policy

## Reporting a vulnerability

Please do not post tokens, passwords, private logs, or exploitable details in a public issue.

Use GitHub's **Report a vulnerability** option in the repository's Security tab when private vulnerability reporting is available. If that option is not enabled, contact the repository maintainer privately through an established channel.

## If a credential was exposed

Revoke or rotate the credential first. Removing it from the latest source does not remove prior copies from Git history, forks, caches, or clones.

## Deployment configuration

- Keep `.env` and production environment values out of Git.
- Keep `ADMIN_USER_IDS` and `ADMIN_ROLE_IDS` in the deployment environment, not source code.
- Do not expose private configuration or logs through the public status endpoint.
- The public status endpoint is read-only and must remain limited to non-sensitive operational status.
