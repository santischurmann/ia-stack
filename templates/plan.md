# Plan: <nombre>

Spec: `docs/spec.md` (versión <n>) · Fecha: DD-MM-AAAA

Una tarea hace una sola cosa y toca pocos archivos. Los archivos de cada tarea van también en
`docs/tasks.json`, que lee `scripts/verify-scope-diff.mjs`.

| Id | Tarea | Criterio | Prueba | Nivel | Depende de |
|---|---|---|---|---|---|
| T01 | <qué hace> | <número de la spec> | `<archivo de prueba>` | barato / medio | — |
| T02 | <...> | <...> | `<...>` | medio | T01 |

## Grupos
- **Grupo A:** T01, T02. Subsesión nueva con un encargo (`skills/encargo.md`).

## Orden de commits
Un commit local por tarea. Un solo push al terminar, con todo verde.

## Si algo falla
Un intento fallido: la tarea sube un nivel. Tercer intento: se frena y se pregunta.
