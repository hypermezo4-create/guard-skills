---
name: mohammed-meta-router
description: Discover and route work to the most relevant installed, vendored, or cataloged Agent Skill while preserving provenance, safety checks, and user intent.
metadata:
  author: Mohammed-MEZO
---

# Mohammed Meta Router

Use this skill when a task could benefit from another Agent Skill but the correct capability is not obvious.

## Routing workflow

1. Define the concrete task and required output.
2. Prefer an already-installed, task-specific skill over a generic skill.
3. If `vendor/manifest.json` exists, search the full local mirror first. It is the offline source of truth for mirrored skill IDs, source, hashes, audits, duplicate status, and installation policy.
4. If only catalog metadata exists, search `registry/skills.json` by name, source, and purpose.
5. Prefer original/official sources when equivalent copies exist; keep duplicates available for explicit comparison rather than silently pretending they do not exist.
6. Never treat popularity as proof of safety or correctness.
7. Before enabling a third-party skill, inspect its `.upstream.json`, available external audits, local findings, credentials/network requirements, and license metadata.
8. Never automatically install an entry marked `blocked-by-default`. Human review is required before any forced installation.
9. Use the smallest set of skills needed for the task. Do not load thousands of unrelated skills into model context just because they are mirrored locally.
10. Preserve upstream names and attribution when reporting what was used.

## Offline commands

Search the full mirror:

```bash
npm run find:vendored -- <query>
```

Install one reviewed local snapshot:

```bash
npm run install:vendored -- <full-skill-id>
```

Verify the universe snapshot before relying on it as complete:

```bash
npm run verify:mirror
```

## Decision priority

Use this order when multiple skills overlap:

1. Official first-party skill for the product/framework.
2. Existing project-specific skill already trusted by the repository.
3. Specialized community skill with clear provenance and acceptable audit status.
4. Generic fallback skill.

## Output

When routing, state the selected skill ID/source and why it matches. If no safe, relevant skill exists, proceed without adding one instead of inventing a skill name.
