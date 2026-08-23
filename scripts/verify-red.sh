#!/usr/bin/env bash
# Bash entrypoint for the one strict, cross-platform Node-native RED adapter.
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: verify-red.sh '<project-relative-test-file>' 'node --test'" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/verify-red-node.mjs" check --test "$1" --command "$2"
