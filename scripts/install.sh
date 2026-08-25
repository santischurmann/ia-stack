#!/usr/bin/env bash
# VibeCodeProtocols installer. It installs a co-located runtime into each chosen project so
# every command in SKILL.md resolves from that project, not from the package clone.
set -euo pipefail

SKILL_NAME="VibeCodeProtocols"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
TARGET_DIR="$HOME/.claude/skills"
RUNTIME_DIR="$HOME/.claude/vcp-runtime"
PROJECT_DIR=""

usage() {
  echo "Usage: install.sh [--target-dir <dir>] [--runtime-dir <dir>] [--project <project-root>]" >&2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target-dir) TARGET_DIR="${2:?--target-dir needs a path}"; shift 2 ;;
    --runtime-dir) RUNTIME_DIR="${2:?--runtime-dir needs a path}"; shift 2 ;;
    --project) PROJECT_DIR="${2:?--project needs a path}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

copy_runtime() {
  local destination="$1"
  mkdir -p "$destination/scripts" "$destination/templates" "$destination/skills"
  cp -R "$PACKAGE_DIR/scripts/." "$destination/scripts/"
  cp -R "$PACKAGE_DIR/templates/." "$destination/templates/"
  cp -R "$PACKAGE_DIR/skills/." "$destination/skills/"
  cp "$PACKAGE_DIR/SKILL.md" "$destination/SKILL.md"
  cp "$PACKAGE_DIR/SECURITY.md" "$destination/SECURITY.md"
}

echo "=== VibeCodeProtocols Installer ==="
echo "Source:  $PACKAGE_DIR"
echo "Skills:  $TARGET_DIR"
echo "Runtime: $RUNTIME_DIR"

mkdir -p "$TARGET_DIR" "$TARGET_DIR/vcp-skills"
cp "$PACKAGE_DIR/SKILL.md" "$TARGET_DIR/$SKILL_NAME.md"
cp -R "$PACKAGE_DIR/skills/." "$TARGET_DIR/vcp-skills/"
copy_runtime "$RUNTIME_DIR"
chmod +x "$RUNTIME_DIR/scripts/"*.sh
echo "OK: skill, sub-skills, and self-contained runtime installed."

if [ -n "$PROJECT_DIR" ]; then
  if [ ! -d "$PROJECT_DIR" ]; then
    echo "REJECTED: project directory does not exist: $PROJECT_DIR" >&2
    exit 1
  fi
  PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"
  VIBE_DIR="$PROJECT_DIR/.vibe"
  if [ ! -d "$VIBE_DIR" ]; then
    mkdir -p "$VIBE_DIR/sessions" "$VIBE_DIR/receipts" "$VIBE_DIR/handoffs"
    cp "$PACKAGE_DIR/templates/vibe/"* "$VIBE_DIR/"
    touch "$VIBE_DIR/AUDIT.md"
    PROJECT_NAME="$(basename "$PROJECT_DIR")"
    TODAY="$(date +%Y-%m-%d)"
    sed -i "s/(fill in)/$PROJECT_NAME/1" "$VIBE_DIR/PROJECT.md" 2>/dev/null || true
    sed -i "s/YYYY-MM-DD/$TODAY/g" "$VIBE_DIR/PROJECT.md" 2>/dev/null || true
  fi
  copy_runtime "$VIBE_DIR/vcp-runtime"
  chmod +x "$VIBE_DIR/vcp-runtime/scripts/"*.sh
  echo "OK: project runtime -> $VIBE_DIR/vcp-runtime"
else
  echo "NOTE: no project initialized. Run this command from the package with --project <project-root>."
fi

echo "Next: restart Claude Code, open the project, then invoke /VibeCodeProtocols."
