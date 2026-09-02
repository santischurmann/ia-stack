---
name: vcp-deploy
description: |
  ES: Sub-paso opcional de Phase 8.2 — build versionado, dist.zip+checksums, CHANGELOG, tag. Solo si el proyecto distribuye artefacto.
  EN: Optional Phase 8.2 sub-step — versioned build, dist.zip+checksums, CHANGELOG, tag. Only if the project ships a distributable artifact.
allowed-tools: Read, Write, Edit, Bash, Glob
---

# VCP Deploy — artifact sub-step (Phase 8.2)

**Precondition:** Phases 6.1 a 8.1 already done (verify+simplify+security+adversarial+tests+commit green). This file does NOT re-verify — it packages.

Interrupted → safe to re-run: zip/checksums regenerate, version bump applies once (after user answers).

---

## STEP 1 — version

```bash
node -e "console.log(require('./package.json').version)"   # Node
grep -m1 "^version" pyproject.toml | cut -d'"' -f2          # Python
cat go.mod | head -3                                        # Go
```

🔵 **Subir versión — hoy es X.Y.Z**

- **A)** Patch — corrige un bug, nada cambia para quien la usa — *(recomendado por defecto)*
- **B)** Minor — agrega algo nuevo sin romper lo anterior
- **C)** Major — rompe compatibilidad

Esperando tu respuesta antes de continuar.

---

## STEP 2 — build

```bash
npm run build 2>&1                              # Node/TS
python -m build --wheel 2>&1                     # Python
mkdir -p dist && go build -o dist/<bin> ./cmd/... 2>&1   # Go
cargo build --release 2>&1 && cp target/release/<bin> dist/   # Rust
```

0 errors, artifacts confirmed in `dist/`.

---

## STEP 3 — dist.zip + checksums

```bash
VERSION=$(grep -m1 "^version" pyproject.toml 2>/dev/null | cut -d'"' -f2 || node -e "console.log(require('./package.json').version)")
ZIP_NAME="dist-${VERSION:-$(date +%Y%m%d)}.zip"
rm -f dist.zip checksums.txt
zip -r "$ZIP_NAME" dist/ --exclude "*.map" --exclude "**/__pycache__/**" --exclude "**/.pytest_cache/**" --exclude "**/node_modules/**" --exclude "**/*.test.*" --exclude "**/*.spec.*"
sha256sum "$ZIP_NAME" > checksums.txt
echo "$ZIP_NAME — $(du -sh "$ZIP_NAME" | cut -f1) — $(cat checksums.txt)"
```

---

## STEP 4 — CHANGELOG.md

Move `## [Unreleased]` content to `## [X.Y.Z] — YYYY-MM-DD`, add empty `## [Unreleased]` on top.

---

## STEP 5 — tag (not push — 8.1 owns push confirmation)

```bash
git tag -a "v${VERSION}" -m "Release v${VERSION}"
```

Publishing (push + tags) is asked in Phase 8.1, not here — don't duplicate the confirm.

---

## REPORT

```
DEPLOY ARTIFACT — v<version>
File: <zip_name> (<size>) — SHA256 <hash>
Tag: v<version> (local)
CHANGELOG: updated
```
