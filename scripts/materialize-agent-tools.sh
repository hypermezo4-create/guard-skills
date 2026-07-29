#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMPORT_DIR="$ROOT/imports/mohammed-agent-tools"
BUNDLE_B64="$IMPORT_DIR/skills.tar.xz.b64"
EXPECTED_FILE="$IMPORT_DIR/bundle.sha256"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

[[ -f "$BUNDLE_B64" ]] || { echo "missing $BUNDLE_B64" >&2; exit 1; }
[[ -f "$EXPECTED_FILE" ]] || { echo "missing $EXPECTED_FILE" >&2; exit 1; }

base64 --decode "$BUNDLE_B64" > "$TMP_DIR/skills.tar.xz"
EXPECTED="$(awk '{print $1}' "$EXPECTED_FILE")"
ACTUAL="$(sha256sum "$TMP_DIR/skills.tar.xz" | awk '{print $1}')"
[[ "$EXPECTED" == "$ACTUAL" ]] || { echo "bundle sha256 mismatch" >&2; exit 1; }

if tar -tJf "$TMP_DIR/skills.tar.xz" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
  echo "unsafe path found in import bundle" >&2
  exit 1
fi

rm -rf "$ROOT/.agents/skills"
mkdir -p "$ROOT/.agents"
tar -xJf "$TMP_DIR/skills.tar.xz" -C "$ROOT/.agents"

COUNT="$(find "$ROOT/.agents/skills" -mindepth 2 -maxdepth 2 -name SKILL.md -type f | wc -l | tr -d ' ')"
[[ "$COUNT" == "358" ]] || { echo "expected 358 skills, found $COUNT" >&2; exit 1; }

cat > "$ROOT/.agents/IMPORTED_FROM_MOHAMMED_AI_AGENT_TOOLS.md" <<'MARKER'
# Imported Agent Tools Pack

This directory contains the 358 skills imported from `Mohammed_AI_Agent_Tools(1).zip`.
Third-party authorship, source metadata, and license files are preserved inside the individual skill folders.
Importing a skill into this repository does not reassign upstream authorship to Mohammed.
MARKER

echo "Materialized $COUNT Agent Tools skills into .agents/skills (sha256: $ACTUAL)."
