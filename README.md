# Mohammed Skills Universe

[![skills.sh](https://skills.sh/b/hypermezo4-create/guard-skills)](https://skills.sh/hypermezo4-create/guard-skills)

A full Agent Skills hub maintained by **Mohammed-MEZO** (`hypermezo4-create`). It combines the built-in guard pack, Mohammed-specific routing/auditing skills, a complete skills.sh file mirror, offline search, guarded local installation, provenance, hashes, security audits, and automated completeness verification.

> Third-party skills remain attributed to their original authors/sources and licenses. Mohammed-MEZO is the maintainer of this mirror and its own repository-local tooling/skills, not the original author of unrelated upstream work.

## Architecture

There are two layers:

1. `skills/` — trusted repository-local skills that the normal Skills CLI can discover directly.
2. `vendor/skills/` — the complete external universe mirror. It is intentionally isolated so thousands of third-party skills are not automatically loaded or trusted just because the files exist in this repository.

### Repository-local skills

- `clean-code-guard`
- `test-guard`
- `docs-guard`
- `wp-guard`
- `woo-guard`
- `mohammed-meta-router`
- `mohammed-skill-auditor`

## Full skills.sh mirror

```bash
npm run mirror
```

The mirror engine paginates through the complete all-time skills.sh catalog and, for every indexed skill, requests the detailed snapshot containing its full file tree and upstream hash. It preserves duplicates instead of silently dropping them, collects available external audit results, computes a local content hash, records basic local risk signals, stores source/license metadata when available, and mirrors the upstream files under `vendor/skills/`.

The official API exposes stable skill IDs, full skill file trees, SHA-256 content hashes, duplicate markers, and audit results. The mirror uses those fields as its upstream source of truth.

### Prove that the mirror is complete

```bash
npm run verify:mirror
```

The verifier fails unless all of these are true:

- manifest count equals the API-reported total;
- zero mirror failures remain;
- zero skill snapshots are unavailable;
- every mirrored skill contains `SKILL.md`;
- every local deterministic hash matches the manifest;
- every `.upstream.json` identity/hash matches the manifest.

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

The installer resolves the exact vendored snapshot and installs from the local directory through the Skills CLI. Entries marked `blocked-by-default` are refused unless a human explicitly reviews them and intentionally supplies `--force`.

## Install this repository's trusted local pack

```bash
npx skills add hypermezo4-create/guard-skills --list
npx skills add hypermezo4-create/guard-skills
```

Install Mohammed's routing/auditing layer only:

```bash
npx skills add hypermezo4-create/guard-skills --skill mohammed-meta-router
npx skills add hypermezo4-create/guard-skills --skill mohammed-skill-auditor
```

## Authentication

The official skills.sh v1 API requires authenticated Vercel OIDC access. The mirror accepts a current token via:

```bash
VERCEL_OIDC_TOKEN=... npm run mirror
```

For automation it also accepts the compatibility environment name `SKILLS_SH_TOKEN`. Tokens are never written into generated files.

## Automation

`.github/workflows/full-mirror.yml` performs the full mirror, runs the completeness verifier, and commits the generated `vendor/` snapshot only after verification succeeds. It also runs on a weekly schedule and can be dispatched manually.

The lighter `.github/workflows/sync-skills.yml` remains available for metadata-only catalog synchronization.

## Generated mirror layout

```text
vendor/
├── manifest.json
├── summary.json
├── failures.json
├── licenses.json
└── skills/
    └── <source...>/<slug>/
        ├── SKILL.md
        ├── ...all upstream skill files...
        └── .upstream.json
```

Each `.upstream.json` records provenance, upstream/local hashes, install count, duplicate status, audits, license metadata when available, local risk findings, and installation policy.

## Useful commands

```bash
npm run mirror
npm run verify:mirror
npm run find:vendored -- <query>
npm run install:vendored -- <skill-id>
npm run sync
npm run validate
```

## Security model

The repository mirrors knowledge broadly but trusts narrowly. A risky or failed-audit skill is retained for inspection and comparison, not silently deleted, while installation is blocked by default. See `SECURITY.md`.

## Attribution

The original guard pack comes from `amElnagdy/guard-skills`. The wider skills.sh ecosystem contains independent repositories, organizations, domains, and authors. Their identity and licensing remain upstream-owned. See `ATTRIBUTION.md`.

## License

Repository-local code and inherited guard content remain subject to the repository's existing license. Mirrored third-party content remains subject to each upstream source's license and terms.
