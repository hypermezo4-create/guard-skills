---
name: mohammed-meta-router
description: Discover and route work to the most relevant installed or cataloged Agent Skill while preserving provenance, safety checks, and user intent.
metadata:
  author: Mohammed-MEZO
---

# Mohammed Meta Router

Use this skill when a task could benefit from another Agent Skill but the correct capability is not obvious.

## Routing workflow

1. Define the concrete task and required output.
2. Prefer an already-installed, task-specific skill over a generic skill.
3. If discovery is needed, search `registry/skills.json` by skill name, source, and purpose.
4. Prefer original/official sources when equivalent copies exist.
5. Never treat popularity as proof of safety or correctness.
6. Before adding a new third-party skill, invoke the repository's safety policy: verify provenance, inspect files, check available audits, and review credential/network requirements.
7. Use the smallest set of skills needed for the task. Do not load thousands of unrelated skills into context.
8. Preserve upstream names and attribution when reporting what was used.

## Decision priority

Use this order when multiple skills overlap:

1. Official first-party skill for the product/framework.
2. Existing project-specific skill already trusted by the repository.
3. Specialized community skill with clear provenance and acceptable audit status.
4. Generic fallback skill.

## Output

When routing, state the selected skill ID/source and why it matches. If no safe, relevant skill exists, proceed without adding one instead of inventing a skill name.
