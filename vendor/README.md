# Mohammed Skills Universe — Full Mirror

This directory is the generated, full-file mirror of the skills indexed by skills.sh.

## Layout

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

Every mirrored skill keeps its upstream identity. `.upstream.json` records the skills.sh ID/source, upstream content hash, locally computed hash, install count, duplicate marker, available security audits, GitHub license metadata when available, local risk signals, and the default installation policy.

## Completeness rule

A mirror is considered complete only when `npm run verify:mirror` succeeds. The verifier requires:

- manifest count equals the API-reported total;
- zero mirror failures;
- zero unavailable snapshots;
- every mirrored directory contains `SKILL.md`;
- every local content hash matches the manifest;
- every `.upstream.json` identity/hash matches the manifest.

## Search offline

```bash
npm run find:vendored -- react
npm run find:vendored -- "next js" --limit=50
npm run find:vendored -- security --include-blocked --json
```

## Install from the mirror

```bash
npm run install:vendored -- vercel-labs/skills/find-skills
```

Entries marked `blocked-by-default` are retained in the mirror but are not installed unless a human deliberately reviews the audit/findings and supplies `--force`.

## Refresh

```bash
npm run mirror
npm run verify:mirror
```

`mirror` fetches the all-time catalog, obtains every skill's full file tree and hash, keeps duplicates rather than silently deleting them, collects available external audits, records local risk signals, and prunes entries that no longer exist in the current catalog.
