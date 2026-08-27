# Session — 2026-08-27

**Feature slug:** integridad-verificable
**Goal:** convertir en detector mecánico cuatro reglas que hoy son convención sin gate
(#22 commit atómico, #27 audit hash-chain, #47 baseline de findings, #40 wording crítico)
**Status:** in progress

---

## Phase 0 — Bootstrap

- Stack detectado: Node v24.13.1 nativo, sin manifiesto de paquetes (cero dependencias por diseño);
  `node --test` + `--experimental-test-coverage`; Bash/PowerShell sólo en instaladores. 🔵 aprobado.
- Memoria: proyecto nuevo — no existía `.vibe/`, creada desde `templates/vibe/`.
- Engram: `mem_context`/`mem_search` no están en el toolset de esta sesión. No hay recall previo;
  el estado se re-detecta por evidencia, nunca de memoria.
- Resume: sin estado previo (no había `SESSION.md` ni `tasks.json`), sesión limpia desde Spec.
- Nivel del proyecto: **C — Producto con plata** (🔵 usuario). Guardado en `PROJECT.md`.
- Triage: 4 features, muy por encima del umbral de 3 archivos de contexto → **full pipeline** (🔵 usuario).
- Contexto requerido enumerado para el triage: `scripts/verify-receipt.mjs`,
  `scripts/verify-security-baseline.mjs`, `scripts/verify-vcp-contract.mjs`, `.vibe/AUDIT.md`,
  `SKILL.md`, `README.md`, `SECURITY.md` + sus tests espejo. 7+ archivos, sin ambigüedad de
  requirements pero con artefacto durable pedido → full pipeline sin excepción.

## Phase 0.5 — Discovery

- Run `run-001`: d001 (pending/initial) → d002 (completed/activation), packet con 4 claims
  `SUPPORTED`, cada uno con locator `repo_file` y `content_identity` sha256 real.
- 4 triggers observados, cada uno cubierto por al menos un claim.
- CAIO: proceso roto y pérdida de información **observados** con evidencia; retrabajo queda como
  **hipótesis** (no se recolectó evidencia); bucle abierto observado en `verify-receipt.mjs:421`.
- Gates: `verify-discovery-core` exit 0 · `verify-discovery-views render+check` exit 0.
- No-goal declarado: la ventana TOCTOU se angosta, no se cierra. El hash-chain detecta reescritura
  accidental o protocolar, no a un actor con control del filesystem.

## Phase 0.5 — corrección (elección 🔵 "C y después A")

- **REQ-G13** (RED→GREEN): `locator.repo_file` acepta `line` como entero positivo opcional.
  Rechaza 0, negativos, decimales, strings numéricos y null; `line` sigue prohibido en un locator
  `web`. Alta `planned` y activación en commits separados, como exige el guard.
- **Corrección d003**: el run-001 pasa a 3 decisiones (d001 pending → d002 completed → d003
  correction). Los 4 claims conservan su `claim_id` (REQ-G06) y ganan `path` + `line` separados,
  con `content_identity` recapturado porque dos fuentes cambiaron desde d002.
- **Hallazgo nuevo del dogfooding**: `.vibe/vcp-runtime/` quedó desincronizado del repo fuente y
  ningún gate lo detecta. El gate de Discovery falló con `DISCOVERY_SNAPSHOT_INVALID` usando el
  runtime viejo y pasó con `scripts/` — un proyecto consumidor podría estar corriendo gates de una
  versión anterior sin enterarse. Candidato a tarea propia, no incluido en este alcance.
