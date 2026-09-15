#!/usr/bin/env bash
# Bash entrypoint for the RED gate. Dispatches to the adapter declared for the runner.
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: verify-red.sh '<project-relative-test-file>' '<runner>'" >&2
  echo "  <runner> must be declared in contracts/red-adapters.json. Nothing is guessed." >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/verify-red.mjs" check --test "$1" --command "$2"
