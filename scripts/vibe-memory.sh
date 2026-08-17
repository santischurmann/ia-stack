#!/usr/bin/env bash
# vibe-memory.sh — .vibe/ memory helper
# Usage:
#   ./vibe-memory.sh init                  — initialize .vibe/ in current project
#   ./vibe-memory.sh save <type> "<text>"  — append to the right file
#   ./vibe-memory.sh read                  — print all memory files
#   ./vibe-memory.sh archive               — archive SESSION.md to sessions/

set -euo pipefail

VIBE_DIR=".vibe"
TODAY=$(date +%Y-%m-%d)
TIME=$(date +%H:%M)

cmd="${1:-read}"

case "$cmd" in
  init)
    if [ -d "$VIBE_DIR" ]; then
      echo ".vibe/ already exists. Not overwriting."
      exit 0
    fi
    mkdir -p "$VIBE_DIR/sessions" "$VIBE_DIR/receipts"
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
    if [ -d "$PACKAGE_DIR/templates/vibe" ]; then
      cp "$PACKAGE_DIR/templates/vibe/"* "$VIBE_DIR/"
      touch "$VIBE_DIR/AUDIT.md"   # no template — append-only log starts empty, not copied
    else
      touch "$VIBE_DIR/PROJECT.md" "$VIBE_DIR/DECISIONS.md" \
            "$VIBE_DIR/PATTERNS.md" "$VIBE_DIR/SESSION.md" "$VIBE_DIR/DEBT.md" \
            "$VIBE_DIR/RETRO.md" "$VIBE_DIR/LESSONS.md" "$VIBE_DIR/AUDIT.md"
      echo "⚠ templates/vibe/ not found next to this script — .vibe/ created with empty files only, no COMPANY.md (org chart). Run from inside the VibeCodeProtocols repo, or copy templates/vibe/COMPANY.md manually."
    fi
    PROJECT=$(basename "$(pwd)")
    sed -i "s/(fill in)/$PROJECT/1" "$VIBE_DIR/PROJECT.md" 2>/dev/null || true
    sed -i "s/YYYY-MM-DD/$TODAY/g" "$VIBE_DIR/PROJECT.md" 2>/dev/null || true
    echo "✓ .vibe/ initialized for: $PROJECT"
    ;;

  save)
    type="${2:?Usage: vibe-memory.sh save <decision|pattern|session|debt> '<text>'}"
    text="${3:?Provide text to save}"
    case "$type" in
      decision)
        echo -e "\n## [$TODAY] Decision: $text\n**Context:**\n**Decision:**\n**Reason:**\n---" \
          >> "$VIBE_DIR/DECISIONS.md"
        echo "✓ Saved to DECISIONS.md"
        ;;
      pattern)
        echo -e "\n## Pattern: $text\n**When:**\n**How:**\n---" \
          >> "$VIBE_DIR/PATTERNS.md"
        echo "✓ Saved to PATTERNS.md"
        ;;
      session)
        echo -e "\n## $TODAY $TIME — $text" >> "$VIBE_DIR/SESSION.md"
        echo "✓ Saved to SESSION.md"
        ;;
      debt)
        echo -e "\n## [$TODAY] Debt: $text\n**Location:**\n**Severity:**\n**Why deferred:**\n---" \
          >> "$VIBE_DIR/DEBT.md"
        echo "✓ Saved to DEBT.md"
        ;;
      audit)
        echo "[$TODAY $TIME] $text" >> "$VIBE_DIR/AUDIT.md"
        echo "✓ Saved to AUDIT.md"
        ;;
      lesson)
        echo "Refused: LESSONS.md is confirm-gated by design (skills/vibe-memory.md § LESSONS PROTOCOL)."
        echo "This script never writes it directly — that would bypass the 🔵 confirm-before-write rule."
        echo "The orchestrator drafts candidates and asks you; write to LESSONS.md yourself with an editor if scripting this on purpose."
        exit 1
        ;;
      *)
        echo "Unknown type: $type. Use: decision | pattern | session | debt | audit (lesson is confirm-gated, not scriptable)"
        exit 1
        ;;
    esac
    ;;

  read)
    echo "=== .vibe/ MEMORY ==="
    for f in PROJECT.md DECISIONS.md PATTERNS.md DEBT.md RETRO.md LESSONS.md COMPANY.md AUDIT.md SESSION.md; do
      if [ -f "$VIBE_DIR/$f" ]; then
        echo ""
        echo "--- $f ---"
        cat "$VIBE_DIR/$f"
      fi
    done
    ;;

  archive)
    TOPIC="${2:-session}"
    ARCHIVE="$VIBE_DIR/sessions/${TODAY}-$(echo "$TOPIC" | tr ' ' '-' | tr '[:upper:]' '[:lower:]').md"
    cp "$VIBE_DIR/SESSION.md" "$ARCHIVE"
    echo "# Session — (next)" > "$VIBE_DIR/SESSION.md"
    echo "✓ Archived: $ARCHIVE"
    ;;

  *)
    echo "Commands: init | save <type> '<text>' | read | archive [topic]"
    exit 1
    ;;
esac
