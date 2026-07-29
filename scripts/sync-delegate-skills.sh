#!/usr/bin/env bash
set -euo pipefail

UPSTREAM_REPO="${DELEGATE_SKILLS_REPO:-https://github.com/amElnagdy/delegate-skills.git}"
UPSTREAM_REF="${DELEGATE_SKILLS_REF:-master}"
ROOT="$(git rev-parse --show-toplevel)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

EXPECTED_SKILLS=(
  claude-delegate
  codex-delegate
  opencode-delegate
  agy-delegate
  grok-delegate
  kimi-delegate
  qoder-delegate
)
EXPECTED_REFERENCES=(
  writing-the-brief.md
  dispatch-and-poll.md
  review-and-land.md
  multi-task-queues.md
)

echo "Cloning ${UPSTREAM_REPO}@${UPSTREAM_REF}..."
git clone --depth 1 --branch "$UPSTREAM_REF" "$UPSTREAM_REPO" "$TMP_DIR/upstream"
SOURCE_SHA="$(git -C "$TMP_DIR/upstream" rev-parse HEAD)"

LICENSE_FILE="$TMP_DIR/upstream/LICENSE"
if [[ ! -f "$LICENSE_FILE" ]] || ! grep -q '^MIT License$' "$LICENSE_FILE"; then
  echo 'delegate-skills license is missing or is no longer MIT; refusing automatic sync.' >&2
  exit 1
fi
if ! grep -q 'Copyright (c) 2026 Ahmed Mohammed (amElnagdy)' "$LICENSE_FILE"; then
  echo 'delegate-skills copyright notice changed; refusing automatic sync pending review.' >&2
  exit 1
fi

mapfile -t DISCOVERED < <(find "$TMP_DIR/upstream/skills" -mindepth 2 -maxdepth 2 -name SKILL.md -printf '%h\n' | xargs -r -n1 basename | sort)
mapfile -t EXPECTED_SORTED < <(printf '%s\n' "${EXPECTED_SKILLS[@]}" | sort)
if [[ "$(printf '%s\n' "${DISCOVERED[@]}")" != "$(printf '%s\n' "${EXPECTED_SORTED[@]}")" ]]; then
  echo 'Upstream delegate skill set changed. Refusing to auto-trust an unreviewed addition/removal.' >&2
  echo 'Expected:' >&2
  printf '  %s\n' "${EXPECTED_SORTED[@]}" >&2
  echo 'Discovered:' >&2
  printf '  %s\n' "${DISCOVERED[@]}" >&2
  exit 1
fi

for skill in "${EXPECTED_SKILLS[@]}"; do
  src="$TMP_DIR/upstream/skills/$skill"
  [[ -f "$src/SKILL.md" ]] || { echo "$skill missing SKILL.md" >&2; exit 1; }
  [[ -f "$src/scripts/relay.mjs" ]] || { echo "$skill missing scripts/relay.mjs" >&2; exit 1; }
  for ref in "${EXPECTED_REFERENCES[@]}"; do
    [[ -f "$src/references/$ref" ]] || { echo "$skill missing references/$ref" >&2; exit 1; }
  done

  node --check "$src/scripts/relay.mjs"
  rm -rf "$ROOT/skills/$skill"
  mkdir -p "$ROOT/skills/$skill"
  cp -a "$src/." "$ROOT/skills/$skill/"
done

mkdir -p "$ROOT/third_party/delegate-skills"
cp "$LICENSE_FILE" "$ROOT/third_party/delegate-skills/LICENSE"

node - "$ROOT/third_party/delegate-skills/SOURCE.json" "$SOURCE_SHA" <<'NODE'
const fs = require('node:fs');
const [path, sha] = process.argv.slice(2);
const data = {
  source: 'https://github.com/amElnagdy/delegate-skills',
  ref: 'master',
  commit: sha,
  license: 'MIT',
  copyright: 'Copyright (c) 2026 Ahmed Mohammed (amElnagdy)',
  skills: [
    'claude-delegate',
    'codex-delegate',
    'opencode-delegate',
    'agy-delegate',
    'grok-delegate',
    'kimi-delegate',
    'qoder-delegate'
  ]
};
fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
NODE

echo "Synced ${#EXPECTED_SKILLS[@]} delegate skills from ${SOURCE_SHA}."
