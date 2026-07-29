# Security Policy

## Trust model

This repository separates **discovery** from **trust**.

- Built-in skills under `skills/` are part of this repository and can be reviewed normally.
- Entries synchronized from skills.sh are catalog metadata only.
- A catalog entry is **not** an endorsement, approval, or instruction to execute it.
- Third-party skill authorship, source links, and licenses must be preserved.

## Before enabling a third-party skill

1. Verify the source repository/domain and exact skill ID.
2. Review the skill files and any referenced scripts, binaries, network calls, MCP servers, or credential requirements.
3. Check current skills.sh audit results when available.
4. Reject or quarantine skills with failed audits, high/critical risk, hidden downloads, credential exfiltration, destructive commands, or unclear provenance.
5. Check the upstream license before redistributing contents.
6. Pin or record a source commit/hash for reproducible use.

## Secrets

Never commit API keys, GitHub tokens, Vercel OIDC tokens, `.env` files, private keys, cookies, or session data.

The skills.sh API uses short-lived Vercel OIDC bearer tokens. Keep them outside Git history and refresh them through an authenticated Vercel context.

## Reporting

Open a private security advisory on the repository when possible. Do not publish active credentials or exploit payloads in a public issue.
