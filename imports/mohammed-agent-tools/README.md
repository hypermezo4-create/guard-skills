# Mohammed Agent Tools — 358-skill import

This import originates from the user-provided `Mohammed_AI_Agent_Tools(1).zip` bundle.

## Verified structure

- Top-level skills: **358**
- Mohammed custom skills: **144**
- Upstream-backed skills: **214**
- Materialized destination: `.agents/skills/<skill>/`
- Generated catalog: `catalog.json`

The uploaded pack contains 358 top-level skill directories. Some upstream packs contain additional nested `SKILL.md` files; those nested files are preserved inside their parent skill and do not change the 358 top-level count.

## Import strategy

The import deliberately avoids treating third-party work as Mohammed-authored:

1. The 144 `mohammed-*` custom skills are stored in a compact, SHA-256 verified archive because they are upload-local content.
2. The other 214 skills are reconstructed from the upstream GitHub source/path recorded by the uploaded pack. When the uploaded metadata contains an exact commit, that commit is requested; otherwise the current upstream HEAD is resolved and the resolved commit is written into `.mohammed-import.json`.
3. Full upstream skill directories are copied, including scripts, references, assets, and license files. If a skill directory does not contain its own license file, the repository-level upstream license is copied into the materialized skill where available.
4. The pipeline fails unless exactly 358 top-level skills exist after reconstruction.
5. `catalog.json` records provenance, resolved commit, license metadata, content hash, file count, and byte count for each materialized skill.

This means the 167 upstream skills whose uploaded metadata did not pin a commit are provenance-preserving reconstructions, not a claim of byte-for-byte identity with the original ZIP snapshot.

## Integrity

`bundle.sha256` records the expected hashes for:

- `mohammed-custom-144.tar.xz`
- `upstream-manifest.json.xz`

Both are stored Base64-encoded in this directory and verified before materialization.

## Run locally

```bash
npm run import:agent-tools
```

Third-party authorship and licenses remain upstream-owned. Hosting a skill in Mohammed Skills Universe does not relabel unrelated upstream work as authored or reviewed by Mohammed.
