# Auditoría de research externo — 2026-08-31

## Actualización de evidencia — 2026-08-31 (última ejecución)

Se añadieron tres shards de lectura profunda, con citas y hashes verificados, y se consolidó la
evidencia en `research/semantic-deep-evidence-2026-08-31.ndjson`.

- Lecturas profundas verificadas: **547** filas únicas (antes 397).
- Nuevos lotes: `awesome-claude-skills` (100 + 100), `gstack` (25 + 25) y `marin` (25 + 25).
- Verificador nativo: `node research/verify-semantic-deep-evidence.mjs` → **exit 0**.
- Pase exhaustivo de las **14.897** entradas PENDING: `node research/build-full-evidence-pass.mjs`
  leyó y hasheó **14.897/14.897** archivos materializados (14.365 textuales, 532 binarios/grandes);
  `node research/verify-full-evidence-pass.mjs` → **exit 0**, salida SHA-256
  `b0aedfa67143bd0e798a52f3fb2e03a601ea99e2d6efa40d24439a3664f999f4`.
- El ledger canónico sigue deliberadamente en **90 READ, 594 EXCLUDED y 14.897 PENDING**:
  una fila asistida no se promociona a READ sin revisión funcional adversarial.
- Por lo tanto, la cobertura semántica estricta **sigue sin estar demostrada al 100 %**.

## Resultado honesto

El corpus de las 14 fuentes fue reconstruido desde commits pineados y sus entradas fueron
enumeradas de forma reproducible. Se procesaron byte-a-byte los archivos regulares materializados
para obtener SHA-256, tamaño, clasificación y cantidad de líneas.

Esto **no equivale a una lectura semántica completa**. El research histórico registra 320 archivos
leídos por agentes sobre 15.581 (2,05 %). El barrido de 14.421 archivos y el escaneo estructural
completo no permiten afirmar que cada función, workflow o decisión haya sido comprendida.

## Corpus verificado

- Entradas de archivo en los 14 árboles: **15.581**.
- Archivos regulares materializados en Windows: **15.575**.
- Symlinks: **6**, registrados pero no dereferenciados por seguridad/compatibilidad de Windows.
- Árboles Git: 14/14 sin truncamiento; conteos coinciden con los manifests históricos.
- Commits: cada fuente usa el commit SHA declarado por el research.
- Manifest detallado: `research/corpus-manifest-2026-08-31.json`.
- Escaneo estructural: `research/corpus-structural-scan-2026-08-31.json`.

Symlinks no dereferenciados:

- `garrytan/gstack:connect-chrome` → `open-gstack-browser`.
- `marin-community/marin:.claude/agents` → `../.agents/agents`.
- `marin-community/marin:.claude/skills` → `../.agents/skills`.
- `marin-community/marin:lib/levanter/infra/babysit-tpu-vm` → `babysit-tpu-vm.sh`.
- `thedotmack/claude-mem:openclaw/skills/do/SKILL.md` → `../../../plugin/skills/do/SKILL.md`.
- `thedotmack/claude-mem:openclaw/skills/make-plan/SKILL.md` → `../../../plugin/skills/make-plan/SKILL.md`.

## Lectura frente a escaneo

| Medida | Resultado | Qué demuestra |
|---|---:|---|
| Árboles enumerados | 15.581/15.581 | Que cada entrada del commit fue contabilizada |
| Archivos regulares con SHA-256 | 15.575 | Que se leyó cada byte materializado |
| Symlinks registrados | 6/6 | Que no se ocultaron entradas no materializadas |
| Escaneo estructural | 15.575 | Líneas, extensiones y patrones aproximados |
| Inventario funcional mecánico | 15.575/15.575 | Símbolos, señales de test, comandos, imports, claims y riesgos observables |
| Lectura semántica manual profunda en lotes | 547/15.581 | Once lotes independientes con citas; no promovidos al ledger estricto |
| Lectura semántica de Codex registrada | 90/15.581 | Archivos funcionales consultados directamente y con veredicto |
| Pase estático completo de Codex | 15.581/15.581 | Cada entrada materializada fue abierta, hasheada y resumida con señales deterministas; no equivale a comprensión semántica |
| Evidencia exhaustiva de PENDING | 14.897/14.897 | Cada pendiente tiene fila 1:1, hash observado y estado conservador; no equivale a lectura semántica humana |
| Research semántico completo | **NO DEMOSTRADO** | El ledger conserva 14.897 pendientes |

El inventario funcional se genera con
`research/build-functional-inventory.mjs` y queda en
`research/functional-inventory-2026-08-31.json`. Su cobertura es mecánica: no convierte una
coincidencia de texto en comprensión semántica. En la ejecución actual indexó 74.976 símbolos,
214.127 señales de test, 45.246 comandos, 63.520 claims y 26.631 marcadores de riesgo. Esas
señales son útiles para priorizar lectura y detectar zonas sensibles, pero no son métricas de
calidad ni un inventario API perfecto.

La cola `PENDING` también tiene un índice de revisión asistida por agentes en
`research/semantic-review-index-2026-08-31.json`, generado por
`research/consolidate-semantic-review.mjs`. Sus 14.897 filas conservan hash, commit, path y
citas cuando un shard las aporta, pero todas mantienen `strict_status: PENDING`: `READ_CANDIDATE`,
`STATIC_ONLY` y `REVIEW_REQUIRED` son estados de triage y no sustituyen una lectura funcional
profunda.

La evidencia manual más fuerte de esta ejecución está consolidada en
`research/semantic-deep-evidence-2026-08-31.ndjson` (547 filas). Los shards de trabajo originales
permanecen en `.scratch-semantic/` y están excluidos del control de versiones. Cada fila contiene
propósito, entradas, conducta, salidas, invariantes, tests, riesgos, decisión VCP y citas
`file:line`. El gate
`research/verify-semantic-review-index.mjs` comprueba la identidad 1:1 de las 14.897 filas y
mantiene explícitamente `strict_status: PENDING`.
`research/verify-semantic-deep-evidence.mjs` comprueba además cada fila profunda contra bytes,
commit, SHA-256, line count y rango de cita del corpus pineado.

Las clasificaciones del manifest nuevo no reemplazan las categorías históricas de
`contracts/research-citations.json`: usan reglas de extensión/UTF-8 propias y por eso sus conteos
de binarios, grandes y legibles no son directamente comparables. No se modifica el contrato viejo
sin una reconciliación explícita.

## Estado de VCP al cerrar esta auditoría

- HEAD y `origin/main`: `f2fb9017df6656490c0a61283bec825bcaad2489`.
- Branch: `main`.
- Working tree: limpio antes de agregar estos dos artefactos de auditoría.
- Graphify report: construido desde `f2fb9017`.
- Backup state: `git_head=f2fb9017...` y `verify-backup-state` en verde.
- T07, T08, T09, T10, T11, T12 y T13 constan como completados en la sesión actual.
- El informe externo sigue diciendo `PARCIAL` y 320 lecturas; esa conclusión es correcta.

## Hallazgos

1. **P1 — research semántico profundo incompleto.** Se ejecutó un pase estático reproducible sobre
   las 15.581 entradas (`research/build-complete-review-index.mjs`), pero 14.897 siguen sin lectura
   funcional profunda. Condición para cerrar: cada entrada debe tener propósito, interfaces, tests,
   límites, citas y veredicto semántico; el índice estático no se promociona a `READ`.
2. **P2 — symlinks no dereferenciados.** Se conocen los seis destinos, pero no se verificó el
   contenido del destino en el snapshot Windows. Condición: resolverlos en un entorno seguro o
   mantenerlos como exclusión explícita.
3. **P2 — citas mayormente verificadas por existencia.** El contrato confirma paths y rangos; sólo
   unas pocas citas fueron leídas manualmente. Condición: separar `PATH_RESOLVED` de
   `CONTENT_CONFIRMED`.
4. **P2 — scan sesgado.** Las seis sondas responden preguntas preseleccionadas; un resultado cero
   no prueba ausencia semántica de una idea no incluida en los patrones.
5. **P2 — inventario estructural aproximado.** Las regex pueden contar falsos positivos en código
   generado, minificado o ejemplos. No usar sus cifras como inventario API definitivo.

## Decisión recomendada

El próximo research debe usar el manifest completo y continuar por lotes deterministas. Cada lote
debe producir lectura real, citas y contraargumentos. Hasta que el campo `PENDING` sea cero o esté
justificado como `EXCLUDED`, el estado correcto de las 14 fuentes es `PARCIAL`.

Los tres índices JSON completos (manifiesto, ledger e inventario funcional) se conservaron en el
checkout local para reproducibilidad y quedaron ignorados por Git por su tamaño y por contener
señales de código de las fuentes; el informe Markdown y los scripts generadores sí forman parte de
la evidencia compartible.
