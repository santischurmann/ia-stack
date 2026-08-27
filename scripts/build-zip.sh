#!/usr/bin/env bash
# build-zip.sh — VibeCodeProtocols distributable package builder
# Run from the vibecodeprotocols/ directory
# Output: vibecodeprotocols-<version>.zip + vibecodeprotocols-<version>.sha256

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
VERSION="${1:-$(date +%Y.%m.%d)}"
if [[ ! "$VERSION" =~ ^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$ || "$VERSION" == *..* ]]; then
  echo "REJECTED: version must be 1-64 safe alphanumeric/._- characters, without '..'" >&2
  exit 2
fi
PACKAGE_NAME="$(basename "$PACKAGE_DIR")"
OUTPUT_NAME="vibecodeprotocols-${VERSION}"
OUTPUT_ARCHIVE="${OUTPUT_NAME}.zip"
CHECKSUM_FILE="${OUTPUT_NAME}.sha256"

echo "=== VibeCodeProtocols Package Builder ==="
echo "Version: $VERSION"
echo "Source:  $PACKAGE_DIR"
echo ""

# Work from parent directory
cd "$(dirname "$PACKAGE_DIR")"

# Package only the distributable runtime surface. Do not zip the entire working tree: local
# .env files, .vibe state, Graphify/Obsidian artifacts, research caches and editor files may be
# ignored by Git but still present on disk. An allowlist avoids leaking them into a release.
INCLUDE=(
  "$PACKAGE_NAME/README.md"
  "$PACKAGE_NAME/SECURITY.md"
  "$PACKAGE_NAME/INSTALL.md"
  "$PACKAGE_NAME/SKILL.md"
  "$PACKAGE_NAME/CHANGELOG.md"
  "$PACKAGE_NAME/LICENSE"
  "$PACKAGE_NAME/scripts"
  "$PACKAGE_NAME/contracts"
  "$PACKAGE_NAME/tests"
  "$PACKAGE_NAME/skills"
  "$PACKAGE_NAME/templates"
  "$PACKAGE_NAME/examples"
)
for path in "${INCLUDE[@]}"; do
  if [ ! -e "$path" ]; then
    echo "REJECTED: required distribution path is missing: $path" >&2
    exit 1
  fi
done
for tool in zip sha256sum; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "REJECTED: required packaging command is unavailable: $tool" >&2
    exit 1
  fi
done

# Clean only names this invocation owns; never delete a generic checksums.txt in the parent.
rm -f "$OUTPUT_ARCHIVE" "$CHECKSUM_FILE"

# Create zip
zip -r "$OUTPUT_ARCHIVE" "${INCLUDE[@]}"

# Generate checksums
sha256sum "$OUTPUT_ARCHIVE" > "$CHECKSUM_FILE"

SIZE=$(du -sh "$OUTPUT_ARCHIVE" | cut -f1)
SHA=$(awk '{print substr($1,1,16) "..."}' "$CHECKSUM_FILE")

echo "✓ $OUTPUT_ARCHIVE ($SIZE)"
echo "✓ $CHECKSUM_FILE (SHA256: $SHA)"
echo ""
echo "=== Distribute ==="
echo ""
echo "Option A — Direct download (share the .zip file)"
echo "  Recipient: unzip ${OUTPUT_NAME}.zip && cd ${PACKAGE_NAME} && ./scripts/install.sh"
echo ""
echo "Option B — Git clone"
echo "  git clone <your-repo-url> && cd ${PACKAGE_NAME} && ./scripts/install.sh"
