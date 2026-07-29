#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMPORT_DIR="$ROOT/imports/mohammed-agent-tools"
SKILLS_DIR="$ROOT/.agents/skills"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR" "$ROOT/.agent-tools-upstream-cache"' EXIT

CUSTOM_B64="$IMPORT_DIR/mohammed-custom-144.tar.xz.b64"
UPSTREAM_B64="$IMPORT_DIR/upstream-manifest.json.xz.b64"
CUSTOM_SHA="a550829b9a80688231f45e2c2a5062da7df980d0b2822a9910a2a9c35d523ca3"
UPSTREAM_SHA="877bbdc84b831842f25952b6cb2d97c45b075528982bef0cbafe44e8fedaea59"

[[ -s "$CUSTOM_B64" ]] || { echo "missing $CUSTOM_B64" >&2; exit 1; }
[[ -s "$UPSTREAM_B64" ]] || { echo "missing $UPSTREAM_B64" >&2; exit 1; }

base64 --decode "$CUSTOM_B64" > "$TMP_DIR/custom.tar.xz"
ACTUAL_CUSTOM_SHA="$(sha256sum "$TMP_DIR/custom.tar.xz" | awk '{print $1}')"
[[ "$ACTUAL_CUSTOM_SHA" == "$CUSTOM_SHA" ]] || { echo "custom bundle sha256 mismatch" >&2; exit 1; }

base64 --decode "$UPSTREAM_B64" > "$TMP_DIR/upstream-manifest.json.xz"
ACTUAL_UPSTREAM_SHA="$(sha256sum "$TMP_DIR/upstream-manifest.json.xz" | awk '{print $1}')"
[[ "$ACTUAL_UPSTREAM_SHA" == "$UPSTREAM_SHA" ]] || { echo "upstream manifest sha256 mismatch" >&2; exit 1; }
xz --decompress --stdout "$TMP_DIR/upstream-manifest.json.xz" > "$TMP_DIR/upstream-manifest.json"

if tar -tJf "$TMP_DIR/custom.tar.xz" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
  echo "unsafe path found in custom skills bundle" >&2
  exit 1
fi

rm -rf "$SKILLS_DIR"
mkdir -p "$ROOT/.agents"
tar -xJf "$TMP_DIR/custom.tar.xz" -C "$ROOT/.agents"

CUSTOM_COUNT="$(find "$SKILLS_DIR" -mindepth 2 -maxdepth 2 -name SKILL.md -type f | wc -l | tr -d ' ')"
[[ "$CUSTOM_COUNT" == "144" ]] || { echo "expected 144 Mohammed custom skills, found $CUSTOM_COUNT" >&2; exit 1; }
echo "Verified 144 Mohammed custom skills."

node "$ROOT/scripts/materialize-agent-tools-upstreams.mjs" "$TMP_DIR/upstream-manifest.json"

FINAL_COUNT="$(find "$SKILLS_DIR" -mindepth 2 -maxdepth 2 -name SKILL.md -type f | wc -l | tr -d ' ')"
[[ "$FINAL_COUNT" == "358" ]] || { echo "expected 358 top-level skills, found $FINAL_COUNT" >&2; exit 1; }

TOTAL_SKILL_FILES="$(find "$SKILLS_DIR" -name SKILL.md -type f | wc -l | tr -d ' ')"
PAYLOAD_FILES="$(find "$SKILLS_DIR" -type f | wc -l | tr -d ' ')"

cat > "$ROOT/.agents/IMPORTED_FROM_MOHAMMED_AI_AGENT_TOOLS.md" <<MARKER
# Imported Mohammed AI Agent Tools Pack

This tree was materialized from the user-provided `Mohammed_AI_Agent_Tools(1).zip` inventory.

- Verified top-level skills: **$FINAL_COUNT**
- Mohammed custom skills: **$CUSTOM_COUNT**
- Upstream-backed skills: **$((FINAL_COUNT - CUSTOM_COUNT))**
- Recursive SKILL.md files: **$TOTAL_SKILL_FILES**
- Materialized files: **$PAYLOAD_FILES**
- Custom bundle SHA-256: `$ACTUAL_CUSTOM_SHA`
- Upstream manifest SHA-256: `$ACTUAL_UPSTREAM_SHA`

Third-party authorship and licenses remain with their upstream authors. Each upstream-backed skill records its source path and resolved Git commit in `.mohammed-import.json`.
MARKER

echo "Agent Tools materialization PASSED: $FINAL_COUNT top-level skills, $TOTAL_SKILL_FILES SKILL.md files, $PAYLOAD_FILES total files."
