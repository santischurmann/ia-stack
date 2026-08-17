#!/usr/bin/env bash
# VibeCodeProtocols — Install script
# Usage: ./install.sh [target_dir]
# Default target: ~/.claude/skills/

set -euo pipefail

SKILL_NAME="VibeCodeProtocols"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
TARGET_DIR="${1:-$HOME/.claude/skills}"

echo "=== VibeCodeProtocols Installer ==="
echo "Source:  $PACKAGE_DIR"
echo "Target:  $TARGET_DIR"
echo ""

# Create target directory
mkdir -p "$TARGET_DIR"

# Copy master skill
cp "$PACKAGE_DIR/SKILL.md" "$TARGET_DIR/$SKILL_NAME.md"
echo "✓ $SKILL_NAME.md → $TARGET_DIR/"

# Copy sub-skills
mkdir -p "$TARGET_DIR/vcp-skills"
cp -r "$PACKAGE_DIR/skills/." "$TARGET_DIR/vcp-skills/"
echo "✓ skills/ → $TARGET_DIR/vcp-skills/"

# Copy scripts to user scripts dir
SCRIPTS_TARGET="$HOME/.claude/vcp-scripts"
mkdir -p "$SCRIPTS_TARGET"
cp "$PACKAGE_DIR/scripts/"*.sh "$SCRIPTS_TARGET/"
cp "$PACKAGE_DIR/scripts/"*.mjs "$SCRIPTS_TARGET/" 2>/dev/null || true
cp "$PACKAGE_DIR/scripts/"*.ps1 "$SCRIPTS_TARGET/" 2>/dev/null || true
chmod +x "$SCRIPTS_TARGET/"*.sh
echo "✓ scripts/ → $SCRIPTS_TARGET/ (incl. verify-receipt.mjs, verify-red.ps1)"

# Initialize .vibe/ in current project (if in a project)
if [ -f "package.json" ] || [ -f "pyproject.toml" ] || [ -f "go.mod" ] || [ -f "Cargo.toml" ]; then
  if [ ! -d ".vibe" ]; then
    mkdir -p .vibe/sessions .vibe/receipts
    cp "$PACKAGE_DIR/templates/vibe/"* .vibe/
    touch .vibe/AUDIT.md   # no template — append-only log starts empty
    sed -i "s/(fill in)/$(basename "$(pwd)")/1" .vibe/PROJECT.md 2>/dev/null || true
    sed -i "s/YYYY-MM-DD/$(date +%Y-%m-%d)/g" .vibe/PROJECT.md 2>/dev/null || true
    echo "✓ .vibe/ initialized in current project"
  else
    echo "  .vibe/ already exists — skipping (not overwriting)"
  fi
else
  echo "  No project manifest found — skipping .vibe/ init (run from your project root)"
fi

echo ""
echo "=== Installation complete ==="
echo ""
echo "Next steps:"
echo "  1. Restart Claude Code (or reload settings)"
echo "  2. Open a project and invoke: /VibeCodeProtocols"
echo "  3. Describe what you want to build"
echo ""
echo "Memory folder will be created in your project at .vibe/"
