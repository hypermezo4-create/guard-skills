# Security Policy

## Trust model

This repository separates **possession**, **discovery**, and **trust**.

- Built-in repository skills under `skills/` are reviewed as normal project content.
- `vendor/skills/` may contain the complete upstream snapshot of every skills.sh entry, including duplicates and skills with warnings or failed audits.
- Mirroring a skill means preserving a copy for discovery/review. It is **not** endorsement, approval, or permission to execute it.
- Third-party authorship, source identity, hashes, audit results, and license metadata stay attached to the mirrored copy.

## Mirror security controls

The full mirror engine:

1. obtains the official skill file tree and upstream SHA-256 hash from skills.sh;
2. rejects path traversal and unsafe generated paths;
3. computes a second deterministic local SHA-256 hash over mirrored file paths and contents;
4. records available skills.sh partner audits;
5. records basic local signals for credential access, network access, shell execution, destructive commands, privilege escalation, and prompt-injection language;
6. records GitHub license metadata when the source is GitHub and the API makes it available;
7. retains risky skills for inspection but marks failed/high-risk/destructive entries `blocked-by-default`;
8. requires `npm run verify:mirror` to pass before the snapshot can be called complete.

## Before enabling a third-party skill

1. Verify the source repository/domain and exact skill ID.
2. Review `.upstream.json`, the skill files, referenced scripts/binaries, network calls, MCP servers, and credential requirements.
3. Check current external audit results and local findings.
4. Do not install `blocked-by-default` entries unless a human has deliberately reviewed the risk and intentionally uses `--force`.
5. Check the upstream license before redistribution or modification.
6. Prefer a pinned mirrored hash when reproducibility matters.

## Secrets

Never commit API keys, GitHub tokens, Vercel OIDC tokens, `.env` files, private keys, cookies, or session data.

The official skills.sh v1 API uses authenticated Vercel OIDC bearer tokens. Keep tokens outside Git history. The mirror accepts `VERCEL_OIDC_TOKEN` and a compatibility environment name `SKILLS_SH_TOKEN`; neither is written to the mirror.

## Reporting

Open a private security advisory on the repository when possible. Do not publish active credentials or exploit payloads in a public issue.
