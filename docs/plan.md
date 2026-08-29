# Plan: integridad-verificable

**Date:** 2026-08-27
**Spec:** [docs/spec.md](./spec.md)
**Status:** Ejecutado — las 13 tareas en `done`, cerrado el 2026-08-29

---

## Task Breakdown

| ID | Description | Writers | Depends on | ACs |
|----|-------------|---------|------------|-----|
| T01 | Hash-chain de `.vibe/AUDIT.md` | `scripts/verify-audit-chain.mjs` (nuevo), `tests/verify-audit-chain.test.mjs`, `skills/vibe-memory.md`, contrato, docs | — | AC1–AC4 |
| T02 | Baseline de findings de seguridad | `contracts/security-baseline.json` (nuevo), `scripts/verify-security-baseline.mjs`, su test, contrato, docs | T01 | AC5–AC7 |
| T03 | Commit atómico con receipt revalidado | `scripts/verify-receipt.mjs`, `tests/verify-receipt-gate.test.mjs`, contrato, docs | T02 | AC8–AC9 |
| T04 | Microtests de wording crítico | `contracts/honest-limits.json` (nuevo), `scripts/verify-vcp-contract.mjs`, su test, docs | T03 | AC10 |
| T05 | Hallazgo 51: verify-red-node confunde el titulo de un test con un archivo roto | `scripts/verify-red-node.mjs`, `research/adversarial-productivity-audit-2026-08-23.md`, `CHANGELOG.md`, `skills/subagent-red.md`, `tests/verify-red-node.test.mjs` | T04 | — |
| T06 | Hallazgo 53: el runtime instalado se desincroniza del repo fuente sin deteccion | `scripts/verify-runtime-sync.mjs (nuevo)`, `SKILL.md`, `README.md`, `scripts/verify-vcp-contract.mjs`, `tests/verify-vcp-contract.test.mjs`, `CHANGELOG.md`, `contracts/honest-limits.json`, `research/adversarial-productivity-audit-2026-08-23.md`, `tests/verify-runtime-sync.test.mjs` | T05 | — |
| T07 | Reglas de protocolo: contexto acotado (36/37) y disciplina (44/45/46) | `SKILL.md`, `scripts/verify-vcp-contract.mjs`, `tests/verify-vcp-contract.test.mjs`, `contracts/honest-limits.json`, `CHANGELOG.md`, `research/adversarial-productivity-audit-2026-08-23.md` | T06 | — |
| T08 | Trazabilidad de evidencia: criterio-prueba (41) y research con fuentes citadas (33) | `scripts/verify-evidence-trace.mjs (nuevo)`, `tests/verify-evidence-trace.test.mjs (nuevo)`, `SKILL.md`, `README.md`, `scripts/verify-vcp-contract.mjs`, `tests/verify-vcp-contract.test.mjs`, `contracts/honest-limits.json`, `CHANGELOG.md`, `research/adversarial-productivity-audit-2026-08-23.md` | T07 | — |
| T09 | Estado ante interrupcion: reintentos (43), checkpoint de cuota (34/35/38), red no verificada (32) | `scripts/verify-session-state.mjs (nuevo)`, `tests/verify-session-state.test.mjs (nuevo)`, `SKILL.md`, `README.md`, `scripts/verify-vcp-contract.mjs`, `tests/verify-vcp-contract.test.mjs`, `contracts/honest-limits.json`, `CHANGELOG.md`, `research/adversarial-productivity-audit-2026-08-23.md`, `templates/vibe/SESSION.md` | T08 | — |
| T10 | Hallazgo 55: el sello del backup depende de cuando se corre Graphify, no del contenido | `scripts/verify-backup-state.mjs`, `SKILL.md`, `README.md`, `scripts/verify-vcp-contract.mjs`, `tests/verify-vcp-contract.test.mjs`, `contracts/honest-limits.json`, `CHANGELOG.md`, `research/adversarial-productivity-audit-2026-08-23.md`, `tests/verify-backup-state.test.mjs` | T09 | — |
| T11 | Gate de decisiones por fase: ninguna fase cierra sin una eleccion registrada y encadenada | `scripts/verify-phase-decisions.mjs (nuevo)`, `tests/verify-phase-decisions.test.mjs (nuevo)`, `templates/phase-decisions.json (nuevo)`, `SKILL.md`, `README.md`, `scripts/verify-vcp-contract.mjs`, `tests/verify-vcp-contract.test.mjs`, `contracts/honest-limits.json`, `CHANGELOG.md` | T10 | — |
| T12 | Verde vacio visible en los 3 gates que lo tenian: no comparar nada no se escribe como verificar | `scripts/verify-evidence-trace.mjs`, `scripts/verify-session-state.mjs`, `scripts/verify-phase-decisions.mjs`, `scripts/verify-vcp-contract.mjs`, `SKILL.md`, `README.md`, `contracts/honest-limits.json`, `CHANGELOG.md`, `tests/verify-evidence-trace.test.mjs`, `tests/verify-session-state.test.mjs`, `tests/verify-phase-decisions.test.mjs`, `tests/verify-vcp-contract.test.mjs` | T11 | — |
| T13 | Sonda de directorio vacio: ningun gate puede decir OK sin haber comparado nada, y un gate nuevo tiene que declararlo | `scripts/verify-empty-probe.mjs (nuevo)`, `tests/verify-empty-probe.test.mjs (nuevo)`, `contracts/empty-probe.json (nuevo)`, `scripts/verify-audit-chain.mjs`, `scripts/verify-runtime-sync.mjs`, `scripts/verify-vcp-contract.mjs`, `SKILL.md`, `README.md`, `contracts/honest-limits.json`, `CHANGELOG.md`, `tests/verify-audit-chain.test.mjs`, `tests/verify-runtime-sync.test.mjs`, `tests/verify-vcp-contract.test.mjs` | T12 | — |


T05–T13 se **incorporaron al plan el 2026-08-29**, no antes de ejecutarse: se construyeron durante la sesión sin pasar por este documento. Sus escritores salen de `docs/tasks.json`, que sí los registró en el momento. Quedan sin columna de AC porque no nacieron de un criterio de la spec sino de hallazgos de auditoría, cada uno con su `approval_criteria` propio en `tasks.json`. **No pasaron por el preflight de conflictos de escritura antes de ejecutarse**; se corrió después, ver abajo.

---

## Execution Order (topological)

1. **T01** — hash-chain de `AUDIT.md`. **Slice mínimo**: se construye y valida primero, sola. Si
   el enfoque "convención → detector" falla, se descubre acá y no en la cuarta tarea.
2. **T02** — baseline de findings (requiere T01)
3. **T03** — commit atómico (requiere T02)
4. **T04** — microtests de wording (requiere T03)

La cadena es estrictamente secuencial por decisión explícita (🔵 Phase 4: paralelo = N). Aunque
se permitiera, las cuatro comparten `SKILL.md`, `CHANGELOG.md` y `verify-vcp-contract.mjs`, así que
el preflight las serializaría igual.

---

## Write-conflict preflight

Before approval, run:

```bash
node .vibe/vcp-runtime/scripts/verify-plan-conflicts.mjs check docs/tasks.json
```

Resultado real de esta corrida: **4 tareas, 14 writer paths declarados, 30 solapamientos
serializados, ningún conflicto sin secuenciar**. Los solapamientos son esperados y están cubiertos
por la ruta `depends_on` T01→T02→T03→T04.

---

## Scope gate después de cada GREEN

```bash
node .vibe/vcp-runtime/scripts/verify-scope-diff.mjs check \
  --tasks docs/tasks.json --task T01 --base <ref-previo> \
  --ignore .vibe/SESSION.md --ignore .vibe/AUDIT.md --ignore docs/tasks.json
```

Los tres `--ignore` son artefactos operativos que el propio protocolo escribe en cada gate
(ledger, audit trail, estado de tarea). Se declaran uno por uno a propósito: no existe una
exclusión global de `.vibe/`, porque ocultaría cambios reales de memoria del proyecto.

---

## Riesgos del plan

- **T01 y compatibilidad**: el `AUDIT.md` de esta misma sesión ya tiene líneas sin hash. AC4 exige
  aceptarlas; si el diseño del gate obligara a migrarlas, el plan estaría roto y hay que revisarlo.
- **T03 y atomicidad real**: un commit atómico de verdad requeriría un lock; lo que se construye
  angosta la ventana y el residuo queda declarado como non-goal, no como logro.
- **T04 y falsos positivos**: fijar frases exactas puede bloquear una reescritura legítima que
  mejore la redacción sin debilitar el límite. El contrato guarda la frase y su razón, para que un
  humano pueda decidir si la edición debilita o sólo reformula.
