# Consolidado de lectura asistida — 2026-08-31

Este archivo consolida shards generados por agentes para administrar la cola. No reemplaza el ledger semántico estricto: todas las filas conservan `strict_status: PENDING` porque una heurística o resumen asistido no demuestra comprensión funcional completa.

- Entradas PENDING del ledger: **14897**.
- Registros consolidados: **14897**.
- Duplicados descartados al elegir el shard preferido: **7330**.
- Filas sin shard: **0**.

- Lectura semántica manual profunda (lotes revisados con citas): **100**; el resto es triage asistido y no se promueve.

| Fuente | Total | READ_CANDIDATE | STATIC_ONLY | REVIEW_REQUIRED | PENDING_REVIEW | UNREVIEWED |
|---|---:|---:|---:|---:|---:|---:|
| AgriciDaniel/claude-obsidian | 192 | 17 | 29 | 0 | 146 | 0 |
| ComposioHQ/awesome-claude-skills | 1080 | 57 | 4 | 0 | 1019 | 0 |
| ConardLi/garden-skills | 586 | 0 | 212 | 69 | 304 | 0 |
| DietrichGebert/ponytail | 148 | 0 | 33 | 37 | 77 | 0 |
| K-Dense-AI/scientific-agent-skills | 2435 | 0 | 304 | 513 | 1454 | 0 |
| Panniantong/agent-reach | 104 | 68 | 4 | 32 | 0 | 0 |
| anthropics/claude-plugins-official | 441 | 186 | 65 | 188 | 0 | 0 |
| garrytan/gstack | 1419 | 1132 | 90 | 196 | 0 | 0 |
| google/googletest | 249 | 12 | 6 | 0 | 231 | 0 |
| marin-community/marin | 3530 | 68 | 200 | 0 | 3262 | 0 |
| msitarzewski/agency-agents | 339 | 12 | 312 | 15 | 0 | 0 |
| rohitg00/ai-engineering-from-scratch | 2982 | 0 | 515 | 573 | 1894 | 0 |
| thedotmack/claude-mem | 1022 | 0 | 80 | 536 | 395 | 0 |
| tt-a1i/archify | 370 | 220 | 43 | 103 | 0 | 0 |

## Semántica de estados

- `READ_CANDIDATE`: el shard aporta un resumen y citas, pero requiere revisión adversarial antes de promoción.
- `STATIC_ONLY`: configuración, catálogo, metadata o contenido sin conducta aislable; no se inventan interfaces.
- `REVIEW_REQUIRED`: evidencia insuficiente o contradictoria; no cuenta como lectura completa.
- `PENDING_REVIEW`/`UNREVIEWED`: no se afirma lectura semántica.

El índice JSON conserva hash, commit, path, shard y citas para reproducibilidad. Las citas no prueban por sí solas que la interpretación sea suficiente; el gate canónico sigue siendo `semantic-ledger-2026-08-31.json`.
