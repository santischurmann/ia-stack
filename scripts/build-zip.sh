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
for tool in sha256sum git; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "REJECTED: required packaging command is unavailable: $tool" >&2
    exit 1
  fi
done

# DOS archivadores DECLARADOS, y la regla intacta: si faltan LOS DOS, bloquea. Declarar un segundo
# no es sustituir en silencio -- que es lo que el protocolo prohibe --, es ensanchar a proposito la
# lista de herramientas aceptadas, y queda escrito aca y probado en tests/build-zip-script.test.mjs.
# bsdtar (libarchive) viene con Windows 10+, macOS y la mayoria de las distribuciones, y escribe
# zip estandar; Info-ZIP sigue siendo el preferido donde este.
ARCHIVER=""
if command -v zip >/dev/null 2>&1; then
  ARCHIVER="zip"
elif command -v bsdtar >/dev/null 2>&1; then
  ARCHIVER="bsdtar"
elif [ -x "/c/Windows/System32/tar.exe" ] && "/c/Windows/System32/tar.exe" --version 2>&1 | grep -q bsdtar; then
  ARCHIVER="/c/Windows/System32/tar.exe"
fi
if [ -z "$ARCHIVER" ]; then
  echo "REJECTED: required packaging command is unavailable: zip (ni bsdtar como alternativa declarada)" >&2
  exit 1
fi
echo "Archiver: $ARCHIVER"

# La lista blanca de arriba acota el nivel superior y nada mas: `zip -r` sobre un directorio se
# lleva TODO lo que haya adentro, versionado o no. Que hoy esos seis directorios esten limpios es
# una propiedad accidental, no un gate. Se enumera lo que git tiene versionado y se empaqueta eso.
if ! git -C "$PACKAGE_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "REJECTED: $PACKAGE_DIR is not a Git work tree, so tracked files cannot be told apart from local state" >&2
  exit 1
fi
TRACKED=()
while IFS= read -r -d '' rel; do
  TRACKED+=("$PACKAGE_NAME/$rel")
done < <(git -C "$PACKAGE_DIR" ls-files -z -- \
  README.md SECURITY.md INSTALL.md SKILL.md CHANGELOG.md LICENSE \
  scripts contracts tests skills templates examples)
if [ "${#TRACKED[@]}" -eq 0 ]; then
  echo "REJECTED: no tracked file matched the distribution allowlist" >&2
  exit 1
fi

# Clean only names this invocation owns; never delete a generic checksums.txt in the parent.
rm -f "$OUTPUT_ARCHIVE" "$CHECKSUM_FILE"

# Create zip — archivos versionados, uno por uno, nunca un directorio suelto.
if [ "$ARCHIVER" = "zip" ]; then
  zip -r "$OUTPUT_ARCHIVE" "${TRACKED[@]}"
else
  "$ARCHIVER" -a -c -f "$OUTPUT_ARCHIVE" "${TRACKED[@]}"
fi

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
