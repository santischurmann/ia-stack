# Plan: integridad-verificable

**Date:** 2026-08-27
**Spec:** [docs/spec.md](./spec.md)
**Status:** Draft

---

## Task Breakdown

| ID | Description | Writers | Depends on | ACs |
|----|-------------|---------|------------|-----|
| T01 | Hash-chain de `.vibe/AUDIT.md` | `scripts/verify-audit-chain.mjs` (nuevo), `tests/verify-audit-chain.test.mjs`, `skills/vibe-memory.md`, contrato, docs | — | AC1–AC4 |
| T02 | Baseline de findings de seguridad | `contracts/security-baseline.json` (nuevo), `scripts/verify-security-baseline.mjs`, su test, contrato, docs | T01 | AC5–AC7 |
| T03 | Commit atómico con receipt revalidado | `scripts/verify-receipt.mjs`, `tests/verify-receipt-gate.test.mjs`, contrato, docs | T02 | AC8–AC9 |
| T04 | Microtests de wording crítico | `contracts/honest-limits.json` (nuevo), `scripts/verify-vcp-contract.mjs`, su test, docs | T03 | AC10 |

---

## Execution Order (topological)

1. **T01** — hash-chain de `AUDIT.md`. **Slice mínimo**: se construye y valida primero, sola. Si
   el enfoque "convención → detector" falla, se descubre acá y no en la cuarta tarea.
2. **T02** — baseline de findings (requiere T01)
3. **T03** — commit atómico (requiere T02)
4. **T04** — microtests de wording (requiere T03)

La cadena es estrictamente secuencial por decisión explícita (🔵 Phase 2: paralelo = N). Aunque
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
