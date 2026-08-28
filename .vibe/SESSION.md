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

## Phase 1 — Spec

- Forcing Questions: **6/6** respondidas (FQ3 requirió una repregunta: la primera respuesta fue
  "no entiendo", se reformuló sin jerga y quedó resuelta como slice mínimo = T01 primero).
- `docs/spec.md`: 10 ACs sobre 4 tareas, T01 (hash-chain de AUDIT.md) declarado slice mínimo.
- Gate de word cap: **rechazó dos veces** (689 y 661 palabras) antes de pasar en 645/650. Se
  recortó narración, ningún criterio de aceptación. El gate funcionó como se diseñó.
- 0 marcadores `[NEEDS CLARIFICATION:` — no bloquea el paso a Plan.
- Non-goals declarados: nada criptográfico ni antimalicioso; la ventana TOCTOU se angosta, no se
  cierra; el hash-chain no resiste a quien controle el filesystem.

## Phase 2 — Plan

- `docs/plan.md` + `docs/tasks.json`: 4 tareas atómicas, cadena estricta T01→T02→T03→T04.
- Gate `verify-plan-conflicts`: **exit 0** — 14 writer paths declarados, 30 solapamientos, todos
  con ruta `depends_on`; ningún conflicto sin secuenciar.
- T01 marcado como slice mínimo: se valida solo antes de construir las otras tres.
- Riesgo declarado en el plan: el `AUDIT.md` de esta sesión ya tiene líneas sin hash, así que AC4
  (compatibilidad hacia atrás) no es teórico — es el estado real del archivo que hay que aceptar.

## Phase 3 — T01 (hash-chain de AUDIT.md) · DONE

- **RED**: rechazado en el primer intento. El gate exige un fallo de assertion real y el módulo no
  existía. Se resolvió con un esqueleto de valores centinela — no con funciones que lanzan, porque
  las pruebas llaman las funciones directo y un throw aborta antes del assert.
- **GREEN**: 9/9, cobertura 100%.
- **TRIANGULATE**: 14 pruebas. Reprodujo un ataque real — manglar todos los sufijos `chain:`
  degradaba el archivo a "traza heredada" y una línea con contenido falsificado pasaba con exit 0.
  Cerrado: un sufijo mal formado es manipulación, no una línea vieja.
- **Escritor (AC11)**: subcomando `append` en el mismo módulo, para que escritor y verificador
  compartan la función de sellado y no puedan divergir. 19 pruebas, 6 mutantes muertos.
- **Verificado sobre datos reales**: se falsificó una línea del `AUDIT.md` de esta misma sesión y
  el gate la detectó nombrando la línea 22.
- Gates finales: 325 tests · cobertura 100% · seguridad limpia · contrato 42 checks · scope-diff
  8 paths exactos · cadena de auditoría íntegra.
- Límites declarados y NO resueltos: borrar los sufijos enteros, recortar el final de la traza, o
  recalcular la cadena completa. Los tres exigen un ancla fuera del archivo.
