# Mohammed Skills Universe

[![skills.sh](https://skills.sh/b/hypermezo4-create/guard-skills)](https://skills.sh/hypermezo4-create/guard-skills)

A full Agent Skills hub maintained by **Mohammed-MEZO** (`hypermezo4-create`). It combines the built-in guard pack, a curated delegate-agent pack, Mohammed-specific routing/auditing skills, a complete skills.sh file mirror, offline search, guarded local installation, provenance, hashes, security audits, and automated completeness verification.

> Third-party skills remain attributed to their original authors/sources and licenses. Mohammed-MEZO is the maintainer of this aggregation and its repository-local tooling/skills, not the original author of unrelated upstream work.

## Architecture

There are three practical layers:

1. `skills/` — reviewed repository-local and curated skills that the normal Skills CLI can discover directly.
2. `third_party/` — provenance/license records for curated upstream packs.
3. `vendor/skills/` — the broad external universe mirror. It is intentionally isolated so thousands of third-party skills are not automatically loaded or trusted just because the files exist in this repository.

### Repository-local guard/routing skills

- `clean-code-guard`
- `test-guard`
- `docs-guard`
- `wp-guard`
- `woo-guard`
- `mohammed-meta-router`
- `mohammed-skill-auditor`

## Curated delegate pack

Source: `amElnagdy/delegate-skills` (MIT).

Reviewed allowlist:

- `claude-delegate` — delegate implementation to Claude Code CLI.
- `codex-delegate` — delegate implementation to OpenAI Codex CLI.
- `opencode-delegate` — delegate implementation to OpenCode CLI.
- `agy-delegate` — delegate implementation to Google Antigravity CLI.
- `grok-delegate` — delegate implementation to Grok Build CLI.
- `kimi-delegate` — delegate implementation to Kimi Code CLI.
- `qoder-delegate` — delegate implementation to Qoder CLI.

Each upstream skill contains `SKILL.md`, `scripts/relay.mjs`, and four workflow references. The orchestrator writes a bounded brief, dispatches the separate implementer CLI, reviews the resulting diff/artifacts, re-runs gates, and lands the verified work itself.

Sync the reviewed pack:

```bash
npm run sync:delegate
```

The sync fails closed if the upstream skill list changes, the MIT notice changes, required files disappear, or a relay script fails JavaScript syntax validation. It records the exact source commit under `third_party/delegate-skills/SOURCE.json`.

The GitHub workflow `.github/workflows/sync-delegate-skills.yml` also supports manual and weekly synchronization.

## Full skills.sh mirror

```bash
npm install
npm run mirror:strict
```

The mirror engine paginates through the complete all-time skills.sh catalog and, for every indexed skill, requests the detailed snapshot containing its full file tree and upstream hash. It preserves duplicate entries instead of silently filtering them, collects available external audit results, computes a deterministic local content hash, records local risk signals, stores source/license metadata when available, and mirrors the upstream files under `vendor/skills/`.

Every indexed entry gets an isolated directory derived from its source, slug, and stable ID hash. That prevents duplicate or similarly named entries from overwriting each other.

### Prove that the mirror is complete

```bash
npm run verify:mirror
```

The verifier fails unless all of these are true:

- manifest count equals the API-reported total;
- zero mirror failures remain;
- zero skill snapshots are unavailable;
- every manifest ID and local snapshot path is unique;
- every mirrored skill contains `SKILL.md`;
- every upstream hash is present;
- every local deterministic hash matches the mirrored files;
- every `.upstream.json` identity, path, and hash matches the manifest.

A run is not called complete unless this command passes.

## Offline search

```bash
npm run find:vendored -- react
npm run find:vendored -- "next js" --limit=50
npm run find:vendored -- security --include-blocked --json
```

Search works against the local `vendor/manifest.json`, so discovery does not require loading thousands of skills into model context.

## Install a mirrored skill

```bash
npm run install:vendored -- vercel-labs/skills/find-skills
```

The installer resolves the exact isolated `localPath` recorded in the manifest and installs that vendored snapshot through the Skills CLI. Entries marked `blocked-by-default` are refused unless a human explicitly reviews them and intentionally supplies `--force`.

## Install this repository's reviewed local pack

```bash
npx skills add hypermezo4-create/guard-skills --list
npx skills add hypermezo4-create/guard-skills
```

Install individual layers:

```bash
npx skills add hypermezo4-create/guard-skills --skill mohammed-meta-router
npx skills add hypermezo4-create/guard-skills --skill mohammed-skill-auditor
npx skills add hypermezo4-create/guard-skills --skill codex-delegate
npx skills add hypermezo4-create/guard-skills --skill claude-delegate
```

## Authentication

The official skills.sh v1 API requires authenticated Vercel OIDC access. Version 2.2 uses `@vercel/oidc` and requests a valid token with an expiration buffer instead of reading one token once at process startup.

### Local setup

```bash
vercel link
vercel env pull .env.local --yes --environment=development
set -a && source .env.local && set +a
npm run mirror:strict
```

`SKILLS_SH_TOKEN` remains supported only as an explicit compatibility fallback. Authentication values are never written into generated mirror files.

### GitHub Actions setup

The preferred automation path uses the repository secret:

```text
VERCEL_TOKEN
```

The full-mirror workflow targets Vercel scope `mohammed-mezo`, project `mohammed-skills-universe`, obtains project-scoped OIDC, runs the strict mirror, and commits `vendor/` only after verification passes.

A legacy `SKILLS_SH_TOKEN` secret can still be used as fallback, but Vercel OIDC is the preferred path.

## Automation

- `.github/workflows/full-mirror.yml` — full skills.sh snapshot + strict verification.
- `.github/workflows/sync-delegate-skills.yml` — reviewed `amElnagdy/delegate-skills` synchronization.
- `.github/workflows/sync-skills.yml` — lighter metadata-only skills.sh synchronization.

## Generated mirror layout

```text
vendor/
├── manifest.json
├── summary.json
├── failures.json
├── licenses.json
└── skills/
    └── <source...>/<slug>--<id-hash>/
        ├── SKILL.md
        ├── ...all upstream skill files...
        └── .upstream.json
```

Each `.upstream.json` records provenance, the isolated local path, upstream/local hashes, install count, duplicate status, audits, license metadata when available, local risk findings, and installation policy.

## Useful commands

```bash
npm run sync:delegate
npm run mirror
npm run mirror:strict
npm run verify:mirror
npm run find:vendored -- <query>
npm run install:vendored -- <skill-id>
npm run sync
npm run validate
```

## Security model

The repository mirrors knowledge broadly but trusts narrowly. Curated third-party packs have explicit source/structure/license checks; broad mirrored content remains isolated and risky/failed-audit entries are blocked from installation by default. See `SECURITY.md`.

## Attribution

The original guard pack comes from `amElnagdy/guard-skills`. The delegate pack comes from `amElnagdy/delegate-skills`. The wider skills.sh ecosystem contains independent repositories, organizations, domains, and authors. Their identity and licensing remain upstream-owned. See `ATTRIBUTION.md`.

## License

Repository-local code and inherited guard content remain subject to the repository's existing license. Curated and mirrored third-party content remains subject to each upstream source's license and terms.
