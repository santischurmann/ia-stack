#!/usr/bin/env bash
# build-zip.sh — IA Stack distributable package builder
# Corre desde cualquier carpeta: las rutas salen de donde vive el script, no del directorio actual.
# Output, al lado de la carpeta del checkout: ia-stack-<version>.zip + ia-stack-<version>.sha256
# Adentro del zip todo cuelga de ia-stack/, se llame como se llame la carpeta del checkout.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$(dirname "$PACKAGE_DIR")"
VERSION="${1:-$(date +%Y.%m.%d)}"
if [[ ! "$VERSION" =~ ^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$ || "$VERSION" == *..* ]]; then
  echo "REJECTED: version must be 1-64 safe alphanumeric/._- characters, without '..'" >&2
  exit 2
fi
# La raiz FIJA de cada entrada del zip. Antes salia de `basename "$PACKAGE_DIR"`, el nombre de la
# carpeta donde alguien clono: la de este repositorio todavia tiene el nombre anterior del protocolo,
# asi que la release lo iba a llevar en cada entrada, y las instrucciones de abajo mandaban a hacer
# `cd` a una carpeta que en la maquina de quien descarga no existe.
ARCHIVE_ROOT="ia-stack"
OUTPUT_NAME="ia-stack-${VERSION}"
OUTPUT_ARCHIVE="${OUTPUT_NAME}.zip"
CHECKSUM_FILE="${OUTPUT_NAME}.sha256"

echo "=== IA Stack Package Builder ==="
echo "Version: $VERSION"
echo "Source:  $PACKAGE_DIR"
echo ""

# Work from parent directory
cd "$OUTPUT_DIR"

# Package only the distributable runtime surface. Do not zip the entire working tree: local
# .env files, .vibe state, Graphify/Obsidian artifacts, research caches and editor files may be
# ignored by Git but still present on disk. An allowlist avoids leaking them into a release.
#
# UNA sola lista, para comprobar que existe y para enumerar lo versionado. Eran dos copias escritas a
# mano y a las dos les faltaba lo mismo: AGENTS.md y .agents/, que los dos instaladores copian sin
# condicion. Un zip sin ellos instalaba a medias -- `cp: cannot stat` bajo `set -euo pipefail` --.
# tests/build-zip-script.test.mjs la compara contra la superficie que el gate de sincronia deriva de
# los instaladores, asi que si un instalador empieza a copiar algo nuevo, esa prueba se pone roja.
ALLOWLIST=(
  README.md SECURITY.md INSTALL.md SKILL.md CHANGELOG.md LICENSE AGENTS.md
  scripts contracts tests skills templates examples .agents
)
for path in "${ALLOWLIST[@]}"; do
  if [ ! -e "$PACKAGE_DIR/$path" ]; then
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
# lleva TODO lo que haya adentro, versionado o no. Que hoy esos directorios esten limpios es
# una propiedad accidental, no un gate. Se enumera lo que git tiene versionado y se empaqueta eso.
if ! git -C "$PACKAGE_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "REJECTED: $PACKAGE_DIR is not a Git work tree, so tracked files cannot be told apart from local state" >&2
  exit 1
fi
RELATIVE=()
while IFS= read -r -d '' rel; do
  RELATIVE+=("$rel")
done < <(git -C "$PACKAGE_DIR" ls-files -z -- "${ALLOWLIST[@]}")
if [ "${#RELATIVE[@]}" -eq 0 ]; then
  echo "REJECTED: no tracked file matched the distribution allowlist" >&2
  exit 1
fi
TRACKED=()
for rel in "${RELATIVE[@]}"; do
  TRACKED+=("$ARCHIVE_ROOT/$rel")
done

# El prefijo fijo necesita los archivos en disco bajo `ia-stack/`: ni zip ni bsdtar renombran rutas
# de la misma forma. Se arma una copia en un temporal PROPIO -- lo crea mktemp en esta corrida, y es
# lo unico que el trap borra -- con `git checkout-index`, que escribe el contenido del INDICE. La
# lista y el contenido salen del mismo lugar: un cambio local que no paso por `git add` no viaja,
# igual que no viaja un archivo sin versionar.
STAGE="$(mktemp -d)"
trap 'rm -rf -- "$STAGE"' EXIT
printf '%s\0' "${RELATIVE[@]}" | git -C "$PACKAGE_DIR" checkout-index --prefix="$STAGE/$ARCHIVE_ROOT/" -z --stdin

# Clean only names this invocation owns; never delete a generic checksums.txt in the parent.
rm -f "$OUTPUT_ARCHIVE" "$CHECKSUM_FILE"

# Create zip — archivos versionados, uno por uno, nunca un directorio suelto. Desde el temporal, en
# una subshell: el directorio de trabajo de este script no cambia.
if [ "$ARCHIVER" = "zip" ]; then
  (cd "$STAGE" && zip -r "$OUTPUT_DIR/$OUTPUT_ARCHIVE" "${TRACKED[@]}")
else
  (cd "$STAGE" && "$ARCHIVER" -a -c -f "$OUTPUT_DIR/$OUTPUT_ARCHIVE" "${TRACKED[@]}")
fi

# Generate checksums. Con el nombre solo, sin ruta: `sha256sum -c` se corre al lado del zip
# descargado, donde la ruta de la maquina que lo armo no existe.
sha256sum "$OUTPUT_ARCHIVE" > "$CHECKSUM_FILE"

SIZE=$(du -sh "$OUTPUT_ARCHIVE" | cut -f1)
SHA=$(awk '{print substr($1,1,16) "..."}' "$CHECKSUM_FILE")

echo "✓ $OUTPUT_ARCHIVE ($SIZE)"
echo "✓ $CHECKSUM_FILE (SHA256: $SHA)"
echo ""
echo "=== Distribute ==="
echo ""
echo "Option A — Direct download (share the .zip file)"
echo "  Recipient: unzip ${OUTPUT_NAME}.zip && cd ${ARCHIVE_ROOT} && ./scripts/install.sh"
echo ""
echo "Option B — Git clone"
echo "  git clone <your-repo-url> ${ARCHIVE_ROOT} && cd ${ARCHIVE_ROOT} && ./scripts/install.sh"
