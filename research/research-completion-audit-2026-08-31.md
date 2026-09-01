# Auditoría de research externo — cierre funcional 2026-09-01

## Cierre funcional reproducible — 2026-09-01

Se procesaron las **14.897 entradas que estaban PENDING** en el ledger estricto histórico.
`research/build-semantic-functional-ledger.mjs` abrió y hasheó cada archivo, recorrió todo el
texto disponible y extrajo señales funcionales citadas (`interfaces`, imports, tests, comandos,
salidas, límites, riesgos y claims). El verificador independiente confirmó la identidad 1:1.

- `node research/build-semantic-functional-ledger.mjs` → exit **0**; **14.897/14.897** resueltas,
  **14.710** `FUNCTIONAL_SCAN`, **187** `STATIC_REVIEWED`, **0** ilegibles; **592.020.021 bytes**.
- `node research/verify-semantic-functional-ledger.mjs` → exit **0**.
- Mismo verificador sobre `semantic-functional-evidence-2026-09-01.ndjson.gz` → exit **0**.
- `node research/build-semantic-functional-synthesis.mjs` → exit **0**; ejecuta el verificador
  anterior antes de leer la evidencia y falla cerrado si alguna fila no es íntegra.
- `node .vibe/vcp-runtime/scripts/verify-spec-wordcap.mjs check docs/spec.md --quality` → exit **0**
  (`647/650` palabras; AC con gramática válida). La matriz de capacidades también pasa.
- Síntesis por fuente/capacidad: `research/semantic-functional-synthesis-2026-09-01.md`.
- Evidencia comprimida y compacta: `semantic-functional-evidence-2026-09-01.ndjson.gz` y
  `semantic-functional-index-2026-09-01.json.gz`.

`FUNCTIONAL_SCAN` significa observación funcional determinista del texto completo con citas reales
(`semantic_claim: false`); no significa que un humano haya entendido cada algoritmo ni que una
señal lexical sea una orden de adopción. `STATIC_REVIEWED` cubre bytes/metadatos de formatos opacos
(imágenes, PDF, vídeo u otros) mediante `metadata_locator` de rango de bytes, nunca una línea
textual inventada ni semántica que no se puede observar. El ledger estricto de 2026-08-31 se conserva como
baseline histórico; el nuevo ledger funcional deja la cola operativa en **0 pendientes ilegibles**.

El loop de aprendizaje queda definido en `skills/vibe-memory.md` § RESEARCH SELF-IMPROVEMENT LOOP:
observar → extraer señales citadas → desafiar con contraejemplos → menú 🔵 → ciclo VCP completo →
lección confirmada y deduplicada. No se copia código externo ni se auto-adopta ninguna capacidad.

## Baseline histórico — 2026-08-31 (conservado para trazabilidad)

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
| Lectura funcional reproducible | **14.897/14.897** | 14.710 textos escaneados completos + 187 artefactos opacos en `STATIC_REVIEWED`; hashes/citas verificados |

El inventario funcional se genera con
`research/build-functional-inventory.mjs` y queda en
`research/functional-inventory-2026-08-31.json`. Su cobertura es mecánica: no convierte una
coincidencia de texto en comprensión semántica. En la ejecución actual indexó 74.976 símbolos,
214.127 señales de test, 45.246 comandos, 63.520 claims y 26.631 marcadores de riesgo. Esas
señales son útiles para priorizar lectura y detectar zonas sensibles, pero no son métricas de
calidad ni un inventario API perfecto.

El índice histórico `research/semantic-review-index-2026-08-31.json` conserva el triage asistido
con `strict_status: PENDING`; no se borra porque documenta el punto de partida. El expediente
operativo nuevo es `semantic-functional-evidence-2026-09-01.ndjson.gz`, validado 1:1 por
`research/verify-semantic-functional-ledger.mjs`. Así se separa la historia estricta de la lectura
funcional reproducible y se evita reinterpretar retrospectivamente una fila vieja.

La evidencia manual histórica está consolidada en `research/semantic-deep-evidence-2026-08-31.ndjson`
(547 filas). El nuevo expediente funcional añade a las 14.897 filas propósito, interfaces,
conducta observable, salidas, invariantes, tests, riesgos, decisión de triage y citas `file:line`.
Los shards de trabajo originales permanecen fuera del producto y se limpian al cerrar la sesión.
`research/verify-semantic-deep-evidence.mjs` comprueba además cada fila profunda contra bytes,
commit, SHA-256, line count y rango de cita del corpus pineado.

Las clasificaciones del manifest nuevo no reemplazan las categorías históricas de
`contracts/research-citations.json`: usan reglas de extensión/UTF-8 propias y por eso sus conteos
de binarios, grandes y legibles no son directamente comparables. No se modifica el contrato viejo
sin una reconciliación explícita.

## Estado de VCP al cerrar esta auditoría

- HEAD y `origin/main`: **`ee10a0623c6fa15cb4474d839abb712e755a9bcb`**.
- Branch: `main`; árbol limpio al iniciar esta ampliación.
- Graphify/Obsidian y `backup-state.json` deben regenerarse y verificarse contra el HEAD del commit
  final como gate posterior a la publicación; sus artefactos locales se mantienen fuera del índice.
- Los artefactos de cierre funcional son los dos `semantic-functional-*` comprimidos y la síntesis
  Markdown; los índices voluminosos temporales no forman parte del producto.
- El baseline estricto anterior sigue marcado `PARCIAL` por diseño histórico; la cola operativa
  funcional de 14.897 entradas está cerrada 1:1 con estados explícitos y límites honestos.

## Hallazgos

1. **Límite metodológico (cerrado operativamente).** El baseline estricto exigía comprensión humana
   y por eso conserva 14.897 `PENDING`; el nuevo pase funcional los resolvió con lectura completa de
   texto, citas, hashes y estados `STATIC_REVIEWED` separados. No se debe presentar como juicio
   humano ni como aprobación automática.
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

Usar `semantic-functional-ledger` como expediente operativo y conservar el ledger estricto como
baseline histórico. Toda capacidad marcada como señal `ADOPT` debe pasar por un menú 🔵 y por el
ciclo completo de VCP; nunca se incorpora por score lexical. Si el corpus cambia, repetir el pase y
comparar hashes antes de reutilizar cualquier conclusión.

Los tres índices JSON completos (manifiesto, ledger e inventario funcional) se conservaron en el
checkout local para reproducibilidad y quedaron ignorados por Git por su tamaño y por contener
señales de código de las fuentes; el informe Markdown y los scripts generadores sí forman parte de
la evidencia compartible.
