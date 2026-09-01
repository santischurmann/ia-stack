# Plan: intake-de-producto

**Date:** 2026-09-01
**Spec:** [docs/spec.md](./spec.md)
**Status:** completado y verificado

---

## Task Breakdown

| ID | Description | Writers | Depends on | ACs |
|----|-------------|---------|------------|-----|
| B1 | Fase de Intake: artefacto JSON y gate nativo | `scripts/verify-intake.mjs`, `tests/verify-intake.test.mjs`, `templates/intake.json`, contratos, docs | — | AC1–AC6 |
| B2 | Diagnóstico previo: CAIO, mapa de bucle, PRD y planes operativos | `scripts/verify-product-diagnostics.mjs`, `tests/verify-product-diagnostics.test.mjs`, `templates/diagnostics/*`, contratos, docs | B1 | seis artefactos de Discovery estructuralmente válidos |
| B3 | Orden canónico y menú completo por fase | `scripts/verify-phase-menu.mjs`, `tests/verify-phase-menu.test.mjs`, `templates/phase-plan.json`, contratos, docs | B1 | plan y decisiones tienen el mismo orden y todas las fases cierran |

Una sola tarea a propósito. El Intake es la primera de seis fases que el encargo pide; construirlas
juntas produciría un diff que nadie puede revisar y seis gates que nacen sin haberse usado nunca.
Cada una entra en su propio ciclo, y la siguiente se decide con la evidencia de la anterior.

---

## Cómo se hace el RED sin un falso rojo

El gate no existe todavía, así que importarlo desde una prueba daría `Cannot find package`, que el
protocolo prohíbe expresamente como rojo. El orden es otro: primero se escribe el gate como un
esqueleto que **acepta todo** —`main` devuelve 0 sin mirar nada—, y las pruebas fallan sobre
aserciones reales, no sobre la carga del módulo. Un rojo que dice «acepté un intake sin la mitad de
las respuestas» prueba algo; uno que dice «no encuentro el archivo» no prueba nada.

---

## Orden

1. Esqueleto permisivo de `scripts/verify-intake.mjs`.
2. `tests/verify-intake.test.mjs` — seis pruebas, una por AC, más las de falsificación. **Rojas.**
3. Implementación hasta el verde.
4. TRIANGULATE: JSON corrupto, esquema ajeno, arrays con forma inesperada, campos con espacios,
   respuestas de una palabra, pregunta bloqueante sin texto, directorio ausente, ruta insegura.
5. Fila en `contracts/empty-probe.json` y límite honesto en `contracts/honest-limits.json`.
6. `SKILL.md` y `README.md`.

---

## Scope gate después del GREEN

```bash
node scripts/verify-scope-diff.mjs check --tasks docs/tasks.json --task B1 --base HEAD \
  --ignore .vibe/SESSION.md --ignore .vibe/AUDIT.md --ignore docs/tasks.json
```

---

## Riesgos del plan

- **El gate puede volverse burocracia.** Ocho respuestas obligatorias sobre un cambio chico es
  fricción sin valor. Mitigación: el Intake sólo se exige donde el protocolo ya exige pipeline
  completo; el auto-routing a Direct Build no lo pide.
- **Un mínimo de largo por respuesta es un proxy pobre.** Veinte caracteres no distinguen una
  respuesta real de veinte caracteres de relleno. Se declara como límite, no se vende como control.
