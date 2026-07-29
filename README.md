# Mohammed Skills Universe

[![skills.sh](https://skills.sh/b/hypermezo4-create/guard-skills)](https://skills.sh/hypermezo4-create/guard-skills)

A safety-first Agent Skills hub maintained by **Mohammed-MEZO** (`hypermezo4-create`). It keeps the original guard-skills pack, adds Mohammed-specific routing/auditing skills, and provides tooling to synchronize the changing skills.sh catalog into a searchable local registry.

> This project does **not** claim authorship of third-party skills. Original authors, sources, licenses, and provenance stay intact. See [ATTRIBUTION.md](ATTRIBUTION.md).

## What is included

### Built-in guard skills

The original focused guard pack remains available:

- `clean-code-guard`
- `test-guard`
- `docs-guard`
- `wp-guard`
- `woo-guard`

These are second-pass quality gates for generated code, tests, documentation, WordPress, and WooCommerce work.

### Mohammed skills

- `mohammed-meta-router` — chooses the smallest, most relevant trusted skill for a task and avoids invented skill names.
- `mohammed-skill-auditor` — reviews provenance, executable behavior, credentials, network access, destructive actions, and audit evidence before trusting a third-party skill.

### Global catalog sync

`scripts/sync-skills-sh.mjs` reads the official skills.sh API and generates:

- `registry/skills.json`
- `registry/sources.json`
- `registry/summary.json`

The sync is paginated, deduplicates by stable skill ID, preserves upstream source/install links, and does **not** execute third-party skill code.

## Install this pack

List everything directly included in this repository:

```bash
npx skills add hypermezo4-create/guard-skills --list
```

Install the full local pack:

```bash
npx skills add hypermezo4-create/guard-skills
```

Install only Mohammed's router/auditor:

```bash
npx skills add hypermezo4-create/guard-skills --skill mohammed-meta-router
npx skills add hypermezo4-create/guard-skills --skill mohammed-skill-auditor
```

Install a guard:

```bash
npx skills add hypermezo4-create/guard-skills --skill clean-code-guard
npx skills add hypermezo4-create/guard-skills --skill test-guard
npx skills add hypermezo4-create/guard-skills --skill docs-guard
npx skills add hypermezo4-create/guard-skills --skill wp-guard
npx skills add hypermezo4-create/guard-skills --skill woo-guard
```

Install for a specific supported agent:

```bash
npx skills add hypermezo4-create/guard-skills --skill '*' --agent codex
npx skills add hypermezo4-create/guard-skills --skill mohammed-meta-router --agent cursor
```

## Sync the skills.sh ecosystem

Requirements:

- Node.js 20+
- an authenticated skills.sh API bearer token supplied as `VERCEL_OIDC_TOKEN` or `SKILLS_SH_TOKEN`

Run:

```bash
npm run sync
```

Other views:

```bash
npm run sync:trending
npm run sync:hot
```

The skills.sh API is the source of truth for the external catalog. The generated registry is a snapshot and will change as the ecosystem changes.

## Why the catalog is metadata-first

Installing or rehosting every public skill blindly would create three problems: stale copies, license/attribution violations, and a large supply-chain attack surface. This repository therefore separates **discovery** from **trust**.

A catalog match tells you that a skill exists. Before enabling a new third-party skill, verify its source, inspect its files, review current audits when available, understand credentials/network access, and confirm its license. See [SECURITY.md](SECURITY.md).

## Repository layout

```text
.
├── skills/
│   ├── clean-code-guard/
│   ├── docs-guard/
│   ├── test-guard/
│   ├── woo-guard/
│   ├── wp-guard/
│   ├── mohammed-meta-router/
│   └── mohammed-skill-auditor/
├── scripts/
│   └── sync-skills-sh.mjs
├── registry/
│   └── README.md
├── .github/workflows/
│   └── sync-skills.yml
├── ATTRIBUTION.md
├── SECURITY.md
└── package.json
```

## Validate local skills

```bash
npm run validate
```

This asks the Skills CLI to discover the local package at full depth so the repository structure can be checked before publishing changes.

## Updating installed skills

```bash
npx skills update
```

Or update one skill:

```bash
npx skills update clean-code-guard
```

## Upstream credit

The original guard pack is from `amElnagdy/guard-skills`. This fork keeps that credit and its existing license. The skills.sh ecosystem is made up of many independent authors and repositories; indexing them here does not transfer authorship to this project.

## License

Repository-local code and inherited guard content remain subject to the existing repository license. Third-party catalog entries and any upstream content remain subject to their own source licenses.
