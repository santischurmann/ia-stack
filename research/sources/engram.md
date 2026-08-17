# EnGRAM — cobertura reabierta por manifiesto completo

Fuente: [`Gentleman-Programming/engram`](https://github.com/Gentleman-Programming/engram), commit inmutable `1dafc0f63051b2214100f7bd801357e4aab61c26` (no se usó `main` como sustituto del snapshot). Esta pasada corrige el informe anterior: ninguna clase de archivo se considera irrelevante por extensión.

## Resultado honesto

**Estado: PARCIAL bajo el requisito literal de “100% de funciones + contenido”.**

Se verificó y leyó por bytes el manifiesto entero: **499/499 blobs**. También se decodificó todo el texto UTF-8 y se indexaron las declaraciones de las **178/178 fuentes Go**. Eso no equivale a una revisión semántica humana/por agente de cada una de sus **3.246 `func`** ni de las 41.141 líneas Markdown; por eso no se declara exhaustiva. Los binarios tampoco pueden evaluarse como contenido fuente sin sus herramientas/plataformas de origen.

| Nivel de cobertura | Resultado comprobado | Qué permite afirmar |
|---|---:|---|
| Integridad del snapshot | 499 blobs, `git fsck` OK | El manifiesto y los objetos existen en el SHA fijado. |
| Lectura por bytes | 499/499 | Ningún archivo fue omitido silenciosamente. |
| Texto UTF-8 decodificado | 481/481 | Índice de líneas, extensiones y directorios sobre el texto real. |
| Inventario Go | 178/178 archivos, 3.246 `func`, 2.248 exportadas | Cobertura declarativa de todo el código Go, no comprensión de cada cuerpo. |
| Revisión semántica completa | No cerrada | Falta recorrer cuerpos de funciones, docs, config/tests y binarios con su formato. |

## Evidencia reproducible y comandos reales

Checkout temporal, fuera de VCP: `<home>\AppData\Local\Temp\vcp-engram-1dafc0f`.

```text
git clone --no-checkout https://github.com/Gentleman-Programming/engram.git <temp>
git -C <temp> checkout --detach 1dafc0f63051b2214100f7bd801357e4aab61c26
git -C <temp> rev-parse HEAD
# exit 0 -> 1dafc0f63051b2214100f7bd801357e4aab61c26

git -C <temp> fsck --no-dangling HEAD
# exit 0

# Para cada path de `git ls-tree -r --full-tree HEAD`, se ejecutó
# `git cat-file blob <sha>` y se leyó la respuesta por bytes.
# exit 0 -> BLOBS_READ=499; UTF8=481; BINARY=18
# MANIFEST_SHA256=74b66d8572d225efe6bd08e956d49773fbf0935b53a6c0c63c6df200296e15dc
```

El hash del manifiesto es SHA-256 de cada tripla `blob-sha<TAB>path<TAB>byte-size`, en el orden de `git ls-tree -r --full-tree HEAD`; permite repetir exactamente el inventario. El escáner Go leyó los 178 textos y registró declaraciones `func`/métodos y packages; no se hizo pasar ese análisis léxico por type-check o test. `go` no está disponible en esta máquina, por lo que no se corrieron `go test` ni `go vet` y no se instaló nada.

## Manifiesto por tipo y chunk de lectura

| Chunk | Paths concretos / patrón exacto | Archivos | Evidencia de lectura | Resultado |
|---|---|---:|---|---|
| Go | `**/*.go` | 178 | todos decodificados; package + `func` indexados | 3.246 funciones; semántica pendiente |
| Markdown | `**/*.md` | 212 | todos decodificados | 41.141 líneas; semántica pendiente salvo los docs listados abajo |
| Config, hooks y web | `**/*.{json,yml,yaml,sh,ps1,mjs,js,ts,templ,css,svg}`, `go.mod`, `go.sum`, root dotfiles | 91 | todos decodificados | contenido leído mecánicamente; revisión funcional pendiente |
| Binarios | `cmd/engram/main`, `cmd/engram/gentle-creation`, `assets/**/*.png`, `.engram/chunks/*.jsonl.gz` | 18 | bytes, SHA Git, tamaño y cabeceras inventariados | no son evidencia de comprensión funcional |

Desglose exacto de extensiones: `.go` 178; `.md` 212; `.json` 18; `.yml` 15; `.sh` 14; `.png` 11; `.gz` 5; `.ts` 6; `.mjs` 6; `.js` 5; `.ps1` 2; `.templ` 3; `.svg` 8; además archivos raíz/configuración de otras extensiones. Son **481** blobs UTF-8 y **18** binarios; total **499**.

Los 18 binarios no estaban “excluidos”: dos son ejecutables Mach-O versionados (`cmd/engram/main` y `cmd/engram/gentle-creation`, 17.223.858 bytes cada uno), 11 son PNG y cinco son archivos `.jsonl.gz` bajo `.engram/chunks/`. Se leyeron sus bytes y se clasificaron; su semántica requiere desensamblado/renderizado/descompresión y una revisión de seguridad antes de manipular contenido de memoria.

## Inventario completo de código Go por paquete/directorio

La siguiente matriz deriva del parseo de **todos** los `**/*.go`; `func` incluye funciones y métodos. Es un mapa para cerrar la revisión semántica sin perder fuentes como ocurrió antes.

| Paths | Go | `func` | exportadas | líneas |
|---|---:|---:|---:|---:|
| `cmd/engram/*.go` | 22 | 461 | 310 | 15.576 |
| `internal/cloud/**/*.go` | 52 | 1.086 | 750 | 33.568 |
| `internal/diagnostic/*.go` | 6 | 41 | 28 | 950 |
| `internal/llm/*.go` | 12 | 46 | 42 | 1.241 |
| `internal/mcp/*.go` | 9 | 332 | 258 | 12.572 |
| `internal/obsidian/*.go` | 15 | 67 | 45 | 2.731 |
| `internal/project/*.go` | 9 | 60 | 44 | 1.657 |
| `internal/server/*.go` | 4 | 146 | 92 | 4.825 |
| `internal/setup/*.go` | 8 | 170 | 89 | 6.192 |
| `internal/store/*.go` | 14 | 554 | 416 | 23.601 |
| `internal/sync/*.go` | 6 | 131 | 91 | 4.986 |
| `internal/timeutil/*.go` | 2 | 5 | 4 | 120 |
| `internal/tui/*.go` | 10 | 112 | 65 | 4.616 |
| `internal/version/*.go` | 2 | 17 | 8 | 431 |
| `plugin/*.go`, `tools/tools.go` | 7 | 18 | 6 | 803 |
| **Total** | **178** | **3.246** | **2.248** | **113.869** |

También se indexaron los tests dentro de esos paths: **96** archivos terminan en `_test.go`. Los directorios documentales que antes se omitían están contabilizados: `openspec/changes/**` aporta 147 Markdown, `openspec/specs/**` 7, `docs/**` 35, `skills/**` 21 y `plugin/**` 3; ninguno queda marcado como “irrelevante”.

## Hechos semánticos que sí se revisaron en profundidad

Estos hallazgos proceden de contenido leído, no de nombres de archivo:

- `internal/store/store.go` declara al store SQLite/FTS5 como núcleo de memoria. Su `ExtractLearnings` sólo extrae ítems de la última sección `## Key Learnings` o `## Aprendizajes Clave`; `PassiveCapture` normaliza y hashea el contenido antes de persistirlo.
- `plugin/codex/hooks/hooks.json` ata acciones concretas a `SessionStart`, `UserPromptSubmit`, `SubagentStop` y `SessionEnd`. `plugin/codex/scripts/subagent-stop.sh` envía la salida del subagente a `/observations/passive`; el servidor, no el hook, deduplica y guarda.
- `plugin/codex/scripts/post-compaction.sh` impone ordenar primero el resumen de sesión y luego recuperar contexto. `plugin/codex/skills/memory/SKILL.md` define el contrato de `mem_save`, `topic_key` y `mem_session_summary`.
- `internal/mcp/mcp.go`, el README y los skills describen el servidor MCP multiagente. Es un producto con binario, SQLite y herramientas en tiempo de ejecución; no es una dependencia que VCP pueda declarar autocontenida.

## Comparación con VCP y una sola idea candidata

VCP ya tiene el control que importa para su diseño dependency-free: captura pasiva en `skills/vibe-memory.md:92` mediante `⚠ signal`, deduplicación antes de proponer en `skills/vibe-memory.md:193-195` y confirmación humana antes de escribir en `skills/vibe-memory.md:197-209`. No se debe importar ni requerir el binario/MCP de EnGRAM.

**Candidata, no implementada:** añadir un campo opcional y explícito `LEARNING: <signal | none>` al bloque de salida de subagentes en `skills/orchestrator-opus.md:99-104`, para que el orquestador pueda transferir señales al `SESSION.md` sin inferirlas de prosa. La evidencia es la interfaz estructurada de EnGRAM (`plugin/codex/scripts/subagent-stop.sh` + `internal/store/store.go:ExtractLearnings`). Debe seguir siendo sólo captura: la escritura en `LESSONS.md` permanece confirmada por el usuario. Antes de adoptarla habría que pedir aprobación porque cambia el contrato de salida de todos los subagentes.

## Qué falta y siguiente chunk atómico

No queda una exclusión escondida: falta una revisión semántica de los cuerpos, documentación y configuración de los chunks anteriores. El siguiente bloque acotado y verificable es:

```text
cmd/engram/*.go
22 archivos · 15.576 líneas · 461 declaraciones func (310 exportadas)
```

Para aprobar ese chunk se deberá registrar, por archivo: funciones/métodos leídos, entradas y efectos observables, tests que los cubren y cualquier idea VCP con file:line. Hasta que todos los chunks textuales se cierren y los 18 binarios tengan tratamiento técnico documentado, la fuente queda **PARCIAL**.

## Continuación — internal/store/*.go semantic review — 2026-08-14

Se leyeron por completo los 4 archivos no-test de `internal/store/` (los 10 restantes son `_test.go`, no revisados en esta pasada): `store.go` (7.061 líneas), `relations.go` (1.507, sólo inventariado por tamaño, no leído función a función esta vez), `diagnostic.go` (329, cabecera/tipos leídos) y `runner.go` (26, completo).

### `store.go` — hallazgo central: cómo dedupean realmente `mem_save` / captura pasiva

No hay similarity/embeddings en este paquete. El dedup es **hash exacto + upsert por clave exacta**, en dos capas distintas:

1. **`AddObservation` (store.go:2251-2314)** — si `p.TopicKey` no es vacío, busca una fila existente con `topic_key` + `project` + `scope` **exactos** (`WHERE topic_key = ? AND project = ? AND scope = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1`). Si hay match, hace `UPDATE ... revision_count = revision_count + 1` en vez de insertar — no compara contenido, sólo la clave de tópico normalizada.
2. **`PassiveCapture` (store.go:6689-6743)** — para cada learning extraído por `ExtractLearnings`, calcula `hashNormalized(learning)` (store.go:6516-6520: `sha256(lowercase(join(fields(content), " ")))` — colapsa espacios, baja a minúsculas, SHA-256) y busca `WHERE normalized_hash = ? AND project = ? AND deleted_at IS NULL`. Match exacto = `Duplicates++` y se descarta; sin match = se guarda vía `AddObservation`. Cero umbral de similitud, cero embeddings: es dedup por igualdad textual normalizada, no semántico.

`SuggestTopicKey` (store.go:6395-6421) genera la clave `family/segment`: `inferTopicFamily` (store.go:6423-6472) clasifica por `typ` explícito o, si falta, por keyword-matching (`hasAny`, store.go:6474-6481) sobre `title+content` contra listas fijas de palabras (bug/fix/panic/crash → "bug"; architecture/design/adr → "architecture"; etc. — ninguna llamada a LLM). El segmento sale del título normalizado (`normalizeTopicSegment`, store.go:6483-6495: lowercase, `[^a-z0-9]+` → espacio, join con `-`, cap 100 chars) o, si el título está vacío, de las primeras 8 palabras del contenido. Así, "similar" para EnGRAM en `mem_suggest_topic_key` no es similitud semántica sino **misma family + mismo slug de título/primeras-8-palabras** — dos observaciones con títulos distintos pero contenido casi idéntico NO colisionan en `topic_key` salvo que además tengan `normalized_hash` idéntico vía `PassiveCapture`.

`dedupeWindowExpression` (store.go:6522-6531) sólo se usa en `AddObservation` (línea 2316, `s.cfg.DedupeWindow`, default 15 min) como ventana temporal SQL adicional — no aporta comparación de contenido, sólo acota la búsqueda del `topic_key` exacto a "recientes".

`runner.go` (26 líneas, completo) confirma que **mem_compare/mem_judge NO son heurística local**: `SemanticRunner` es una interfaz duck-typed (`Compare(ctx, prompt) (SemanticVerdict, error)`) satisfecha por `*llm.ClaudeRunner`/`*llm.OpenCodeRunner` (paquete `internal/llm`, no leído aún) — la comparación semántica real invoca un modelo vía CLI subprocess y devuelve `Relation` (`conflicts_with|supersedes|scoped|related|compatible|not_conflict"`), `Confidence` 0.0–1.0, `Reasoning` (≤200 chars) y el `Model` usado. Esto es justamente lo que el README de EnGRAM sugiere para `mem_judge`/`mem_compare`; el mecanismo README-vs-código coincide en que sí requiere una llamada LLM real, no un script determinista.

### Cruce con VCP — dato más preciso que el README

El README de EnGRAM sólo dice "detecta duplicados"; el código revela que es **exact-match en dos niveles (topic_key normalizado, y SHA-256 de contenido normalizado) sin ningún umbral de similitud difusa**. VCP's `skills/vibe-memory.md` § LESSONS PROTOCOL ya hace dedup antes de proponer (`skills/vibe-memory.md:193-195`) pero no especifica el algoritmo exacto en el texto actual. Idea concreta y barata de adoptar (sin dependencia del binario/MCP): documentar explícitamente en `skills/vibe-memory.md` que el paso de dedup debe comparar por **normalización textual exacta** (lowercase + colapso de espacios, ver `store.go:6516-6520`) antes de mostrar candidatos al humano, en vez de dejarlo implícito — es más barato y determinista que pedir similitud semántica, y es literalmente lo que hace la herramienta de referencia que motivó la comparación. No implementado; requiere aprobación porque toca el contrato de `skills/vibe-memory.md`.

### Qué queda pendiente de `internal/store/`

- `relations.go` (1.507 líneas) — sólo se leyó el propósito general por el nombre del paquete; funciones exportadas (relaciones entre observaciones: probablemente `conflicts_with`/`supersedes`) no revisadas función a función todavía.
- `diagnostic.go` (329 líneas) — sólo cabecera y 3 tipos leídos; el resto (probablemente diagnóstico de locks SQLite/WAL, visto en el nombre `SQLiteLockSnapshot`) no revisado.
- Los 10 archivos `_test.go` del paquete no fueron leídos en esta pasada (quedan como evidencia de comportamiento esperado, no confirmada por lectura).
- **167 de 178 archivos Go siguen sin revisión semántica**: `cmd/engram/*.go` (22, el chunk que este informe había marcado como "siguiente" y que se saltó a pedido explícito), `internal/cloud/**` (52, el paquete más grande), `internal/llm/*.go` (12, contendría `ClaudeRunner`/`OpenCodeRunner` referenciados arriba), `internal/mcp/*.go` (9, define las 258 funciones exportadas que exponen las tools `mem_*`), `internal/obsidian`, `internal/project`, `internal/server`, `internal/setup`, `internal/sync`, `internal/timeutil`, `internal/tui`, `internal/version`, `plugin/*.go`, `tools/tools.go`.
- Siguiente chunk atómico recomendado: `internal/mcp/*.go` (9 archivos, 332 funciones, 258 exportadas) — es el que define literalmente las tool signatures `mem_save`/`mem_search`/`mem_suggest_topic_key`/`mem_judge`/`mem_compare` que el README describe, cerrando el mapeo README↔código a nivel de interfaz pública en vez de sólo a nivel de store interno.

## Continuación — internal/mcp/*.go semantic review — 2026-08-14

Se leyeron los 9 archivos completos: `mcp.go` (3.005 líneas, servidor + 19 tool handlers), `activity.go` (235, completo), `write_queue.go` (104, completo), y los 6 `_test.go` (`mcp_test.go` 7.454, `mcp_compare_test.go` 277, `mcp_judge_test.go` 284, `mcp_conflict_loop_test.go` 673, `activity_test.go` 228, `write_queue_test.go` 303 — leídos vía grep dirigido sobre casos, no línea por línea íntegra los de mayor tamaño).

### Qué valida/hace cada tool `mem_*` relevante (semántica confirmada por código, no por README)

- **`mem_save` (`handleSave`, mcp.go:1186-1369)**: exige `content` no vacío (`observation` acepta como alias legacy, mcp.go:1190-1197). Resuelve el proyecto con precedencia explícita→sesión→override de proceso→config de repo→cwd (`resolveSaveWriteProjectWithProcessOverride`), normaliza el nombre y, si el proyecto es nuevo, calcula similitud fuzzy contra proyectos existentes (`projectpkg.FindSimilar`) para sugerir uno existente en vez de crear duplicados por typo — esto es distinto del dedup de contenido documentado en la pasada anterior. Tras el `INSERT`, llama `s.FindCandidates` (post-transacción, no bloqueante: error se loguea y se descarta, mcp.go:1320-1324) y si hay candidatos arma `judgment_required=true` + lista de `candidates[]` con `judgment_id` — el flujo de conflicto es: guardar primero, avisar después, nunca bloquear el save.
- **`mem_judge` (`handleJudge`, mcp.go:2063-2120)**: exige `judgment_id` y `relation`; valida `confidence` en rango [0,1] si viene. Marca el actor como `"agent"`/`"agent"` de forma fija (no hay forma de declarar que el humano decidió, sólo el `reason`/`evidence` textual) — persiste vía `s.JudgeRelation`, no hace ninguna inferencia propia.
- **`mem_compare` (`handleCompare`, mcp.go:2129-2194)**: exige `memory_id_a`, `memory_id_b`, `relation`, `reasoning` Y `confidence` (los 5 son obligatorios, a diferencia de `mem_judge` donde sólo 2 lo son) — confirma lo hallado en `runner.go`: este tool **no re-juzga nada**, sólo persiste un veredicto que el agente ya calculó externamente (posiblemente vía LLM subprocess); si `relation == "not_conflict"` es no-op y devuelve `sync_id` vacío.
- **`mem_search`**: `match_mode` sólo acepta `"all"` (FTS5 AND, default) o `"any"`; "cualquier otro valor retorna error" (mcp.go:287-289) — es texto puesto explícitamente en la tool description, no un detalle escondido.

### Mecanismo preciso no visto antes: nudge de actividad (`activity.go`)

`SessionActivity.NudgeIfNeeded` (activity.go:176-210) es un recordatorio determinista, no basado en LLM: no nudgea sesiones jóvenes (`now - startedAt < nudgeAfter`), no nudgea sesiones inactivas (`saveCount==0 && toolCallCount<=5`), y sólo dispara cuando pasó `nudgeAfter` desde el último save (o desde el inicio de sesión si nunca hubo save). El texto es literal: `"⚠️ No mem_save calls for this project in %d minutes. Did you make any decisions, fix bugs, or discover something worth persisting?"`. Es un contador puro (segundero + threshold), sin heurística de contenido.

`ActivityScore` (activity.go:213-235) agrega una frase de advertencia extra (`"high activity with no saves, consider persisting important decisions"`) cuando `toolCallCount > 5 && saveCount == 0` — dos umbrales distintos, ambos hardcodeados, sin config visible en este archivo.

### `write_queue.go` — no relevante para VCP (arquitectura de servidor)

Serializa todos los writes MCP en un único goroutine consumidor (`chan writeJob` con `recover()` sobre pánico de handler) para evitar contención SQLite concurrente. Es infraestructura de servidor persistente; VCP no tiene proceso long-running, así que no aplica.

### Cruce con VCP — LESSONS PROTOCOL

`skills/vibe-memory.md` no tiene hoy un mecanismo de "nudge por inactividad" ni de "similaridad fuzzy de nombre de proyecto" — son dos ideas nuevas, no cubiertas por la sección anterior (que ya cerró la de dedup exacto). **Candidata concreta y barata, no implementada:** el patrón de nudge de `activity.go` (dos umbrales: antigüedad mínima de sesión + tiempo desde último save, ambos deterministas sin LLM) podría formalizarse como una regla explícita en `skills/vibe-memory.md` § LESSONS PROTOCOL — por ejemplo "si pasaron N interacciones sin propuesta a `LESSONS.md`, recordar explícitamente al usuario antes de cerrar la sesión". Requiere aprobación porque cambia el contrato de cuándo el orquestador debe interrumpir con un recordatorio. La segunda idea (similitud fuzzy de nombres de proyecto para evitar duplicados por typo, `projectpkg.FindSimilar` en mcp.go:1250) no tiene equivalente claro en VCP porque VCP no tiene concepto de "proyecto" como clave de partición — se descarta como no aplicable.

### Estado de cobertura Go actualizado

**158 de 178 archivos Go siguen sin revisión semántica** (167 − 9 de este chunk = 158): `cmd/engram/*.go` (22), `internal/cloud/**` (52, el paquete más grande), `internal/llm/*.go` (12, contiene `ClaudeRunner`/`OpenCodeRunner`), `internal/obsidian` (15), `internal/project` (9, incluye `FindSimilar` citado arriba), `internal/server` (4), `internal/setup` (8), `internal/sync` (6), `internal/timeutil` (2), `internal/tui` (10), `internal/version` (2), `plugin/*.go`, `tools/tools.go` (7). También quedan `internal/store/relations.go` y `diagnostic.go` sin cerrar de la pasada anterior.

Siguiente chunk atómico recomendado: `internal/llm/*.go` (12 archivos, 46 funciones) — cierra la pregunta abierta de cómo `ClaudeRunner`/`OpenCodeRunner` arman el prompt y parsean la respuesta del subprocess LLM que sostiene `mem_judge`/`mem_compare`/`SemanticRunner`.

## Continuación — internal/llm/*.go semantic review — 2026-08-14

Se releyó el manifiesto completo vía `gh api .../git/trees/1dafc0f6...?recursive=1` para confirmar que sigue en 178 archivos `.go` (sin cambios de contenido esperados, es un SHA fijo; se repite el chequeo por disciplina, no porque pudiera variar). Se leyeron por completo los 6 archivos no-test de `internal/llm/` (los 6 `_test.go` — `claude_test.go`, `cost_test.go`, `factory_test.go`, `opencode_test.go`, `prompt_test.go`, `runner_test.go` — no se leyeron en esta pasada): `runner.go` (72 líneas), `claude.go` (161), `opencode.go` (172), `factory.go` (48), `prompt.go` (68), `cost.go` (30).

### Qué confirma el código sobre `AgentRunner`/`Verdict` (`runner.go`)

`internal/llm` es un **boundary paquete estricto por comentario de cabecera**: "only `cmd/engram/conflicts.go` and `internal/store/relations.go` are permitted to import it" — no hay enforcement en código (ni build tag ni linter visible en este archivo), es una convención documentada. `AgentRunner` es una interfaz de un solo método (`Compare(ctx, prompt) (Verdict, error)`). `Verdict` trae `Relation`, `Confidence` (float64 0.0–1.0), `Reasoning` (≤200 chars), `Model` y `DurationMS`. Cinco sentinel errors: `ErrCLINotInstalled`, `ErrCLIAuthMissing` (declarado pero no vi ningún `return` que lo use en los 6 archivos leídos — posible dead sentinel o usado sólo en tests/otro paquete), `ErrTimeout` (idem, no usado en este chunk), `ErrInvalidJSON`, `ErrUnknownRelation`.

### `ClaudeRunner` (`claude.go`) — subprocess real, no heurística

Invoca literalmente `claude -p --output-format json --model haiku --max-turns 1` con el prompt por stdin, vía `exec.CommandContext` inyectable (`runCLI` field, swappeable en tests). Parsea el envelope `{"type","result","total_cost_usd","modelUsage","duration_ms"}`, extrae `result` (string), le saca fences markdown con `fenceRE` (regex `^```[a-zA-Z]*\n?(.+?)\n?```$`), y decodifica eso como `innerVerdict{Relation,Confidence,Reasoning,Model}`. Valida `Relation` contra el vocabulario cerrado `validRelations` (mapa de 6 valores: conflicts_with/supersedes/scoped/related/compatible/not_conflict) — cualquier otro valor devuelve `ErrUnknownRelation`. Si `innerVerdict.Model` viene vacío, cae a la primera clave de `modelUsage`. `defaultRunCLI` traduce `exec.ErrNotFound` → `ErrCLINotInstalled` explícitamente.

### `OpenCodeRunner` (`opencode.go`) — mismo contrato, formato NDJSON distinto

Invoca `opencode run --format json --pure` y escanea NDJSON línea por línea con `bufio.Scanner`; líneas malformadas se saltean sin abortar. Busca eventos `"text"` (usa el último si hay varios — "last one wins", comentado explícitamente) y eventos `"step_start"`/`"step_finish"` para calcular `DurationMS` por diferencia de timestamps RFC3339, y para extraer `Model` de la metadata de `step_finish`. Si no hay ningún evento `"text"`, error explícito `"opencode: no text event found in NDJSON stream"`. Misma validación de `validRelations` compartida con `claude.go` (variable de paquete, no duplicada).

### `factory.go`, `prompt.go`, `cost.go`

`NewRunner(name)` sólo acepta `"claude"`/`"opencode"`; string vacío da un error que nombra explícitamente la env var `ENGRAM_AGENT_CLI` como fuente esperada — confirma que la selección de runner es 100% config-driven, cero autodetección de CLIs instalados. `BuildPrompt` arma el prompt canónico "locked" (comentario: cambiarlo rompe comparación cross-model) con los 6 placeholders `%[1]s`..`%[6]s` (ID/Title/Content de A y B) y pide explícitamente una única línea JSON de salida. `cost.go` son dos constantes hardcodeadas "LOCKED" (300 input tokens, 50 output tokens por par) calibradas empíricamente contra haiku — `EstimateScanCost(pairCount)` es una multiplicación simple, no hay llamada real a ningún endpoint de pricing.

### Cruce con VCP

Nada nuevo aplicable más allá de lo ya registrado (dedup exacto, nudge de actividad). El patrón de "vocabulario de relación cerrado + JSON single-line forzado en el prompt" (`prompt.go`) es interesante pero ya es exactamente el mismo patrón que usa VCP en sus templates de salida estructurada (p. ej. `templates/tasks.json`); no aporta mecanismo nuevo. La separación estricta "sólo dos archivos pueden importar este paquete" (comentario, no lint) tampoco tiene equivalente accionable en VCP (proyecto de skills Markdown, no Go modules). **Ninguna idea nueva de este chunk** — se registra explícitamente como "none found" más allá de lo ya documentado.

### Estado de cobertura Go actualizado

**146 de 178 archivos Go siguen sin revisión semántica** (158 − 12 de este chunk = 146): `cmd/engram/*.go` (22), `internal/cloud/**` (52, el paquete más grande, aún no tocado), `internal/obsidian` (15), `internal/project` (9), `internal/server` (4), `internal/setup` (8), `internal/sync` (6), `internal/timeutil` (2), `internal/tui` (10), `internal/version` (2), `plugin/*.go`, `tools/tools.go` (7). También siguen pendientes `internal/store/relations.go` y `diagnostic.go` (cuerpo completo) de dos pasadas atrás, y los `_test.go` de `internal/llm/` y `internal/store/`.

Siguiente chunk atómico recomendado: `internal/cloud/**/*.go` (52 archivos, 1.086 funciones, el paquete más grande del repo) — sigue sin ninguna lectura semántica pese a ser ~30% del código Go total.

## Continuación — internal/cloud/** semantic review (parcial) — 2026-08-17

`internal/cloud/**` tiene 52 archivos Go: 27 no-test + 25 `_test.go`. Se leyeron íntegros los 8 archivos no-test más chicos/medianos (`auth/auth.go` 317, `auth/foundation.go` 306, `autosync/manager.go` 711, `chunkcodec/chunkcodec.go` 516, `config.go` 92, `constants/constants.go` 50, `syncguidance/guidance.go` 129, `remote/transport.go` 423 líneas — 2.544 líneas en total) y se hizo lectura dirigida por `grep` de firmas `func`/comentarios de cabecera sobre otros 8 archivos grandes (`cloudstore/identity.go`, `cloudstore/project_controls.go`, `cloudstore/audit_log.go`, `cloudstore/dashboard_queries.go`, `cloudserver/mutations.go`, `cloudserver/admin_handlers.go`, `cloudserver/cloudserver.go`) — de estos últimos se leyó el cuerpo completo sólo de `rejectSensitiveAuthAuditMetadata`/`rejectSensitiveAuthAuditValue`/`sensitiveAuthAuditKey` (audit_log.go:910-968). **16 de 27 no-test revisados con distinto grado de profundidad; 11 no-test (`cloudstore/cloudstore.go`, `cloudstore/wildcard` lógica, `cloudserver/dashboard_admin_users.go`, `cloudserver/dashboard_session.go`, `dashboard/*.go` no-templ, los 3 `*_templ.go` generados, `dashboard/static/*`) y los 25 `_test.go` de `internal/cloud/**` NO se leyeron en esta pasada.**

### Hechos semánticos confirmados

- **Autenticación en dos capas, ninguna basada en JWT real** (`auth/auth.go`, `auth/foundation.go`): `Service.Authorize`/`ResolveBearerToken` valida un único bearer token legacy por comparación de hash SHA-256 constante-time (`legacyTokenEqual`, hmac.Equal sobre hashes, no sobre el token crudo). `PrincipalResolver.ResolveBearerToken` (foundation.go:558-601) es la ruta "managed": primero intenta legacy (sync/admin), luego calcula `ManagedTokenHasher.Hash` (HMAC-SHA256 con un "pepper" dedicado, dominio-separado con `"engram-cloud-token:v1:"`, foundation.go:547-552) y busca por hash exacto — cero comparación en texto plano en BD. El "JWT secret" del dashboard (`MintDashboardSession`/`ParseDashboardSession`, auth.go:60-128) no es JWT real: es HMAC propio sobre un payload JSON base64, exp de 8h fijo — reimplementación liviana, no librería JWT.
- **`sensitiveAuthAuditKey` + `rejectSensitiveAuthAuditValue` (cloudstore/audit_log.go:910-968)**: antes de insertar cualquier `AuthAuditEvent`, recorre recursivamente (reflection sobre punteros/interfaces/maps/slices) todo el `metadata map[string]any` buscando claves que contengan `token|authorization|cookie|secret|hash|password|bearer` (con excepción explícita para `token_prefix`, que se permite) y **rechaza el insert entero** (`ErrSensitiveAuditMetadata`) si encuentra una — no redacta, no trunca: falla duro. Es fail-closed, no best-effort.
- **`guardLastActiveAdminTx`** (grep en audit_log.go área ~881) y `WouldRemoveLastActiveAdmin`/`HasActiveAdmin` (identity.go, listados por firma): guardan la invariante "nunca te quedás sin admin activo" a nivel de transacción SQL antes de deshabilitar/degradar un principal.
- **`ProjectSyncControl`** (project_controls.go): tabla `cloud_project_controls`, default `enabled=true` cuando no hay fila (fail-open explícito, comentado). `handleMutationPush` en cloudserver/mutations.go devuelve 409 con `writeActionableError` si el proyecto está pausado — gate de sync por proyecto, no global.
- **`autosync/manager.go`** (leído completo): loop de sincronización con lease SQLite (`AcquireSyncLease`/`ReleaseSyncLease`), backoff exponencial ±25% jitter acotado (`computeBackoff`, fórmula documentada in-line), máquina de fases explícita (`idle→pushing/pulling→push_failed/pull_failed→backoff→healthy/disabled`), y `safeRun` con `recover()` que atrapa pánicos de ciclo y los convierte en `PhaseBackoff` con `reason_code=internal_error` en vez de tumbar el goroutine — patrón de resiliencia reutilizable.
- **`chunkcodec.CanonicalizeForProject`** (516 líneas): reescribe recursivamente el campo `project` en chunks de sync (sessions/observations/prompts/mutations) antes de aceptarlos, validando cada mutación contra un vocabulario cerrado de `(entity, op)` soportados — previene que un cliente inyecte datos con `project` falsificado en el payload.
- **`syncguidance.Guidance`** (guidance.go): clasifica errores de sync como "reparables" (`IsRepairableCloudSyncError`, vía interfaz + fallback heurístico sobre substrings del mensaje) y añade instrucciones deterministas de recuperación (comandos exactos `engram cloud upgrade doctor/repair`) al mensaje de error — nunca muta estado, sólo guía.

### Cruce con VCP — una idea nueva

**Candidata concreta, no implementada:** el patrón `sensitiveAuthAuditKey`/`rejectSensitiveAuthAuditValue` de `cloudstore/audit_log.go:910-968` — lista cerrada de fragmentos sensibles (`token|authorization|cookie|secret|hash|password|bearer`) aplicada recursivamente y en modo **fail-closed** (rechaza en vez de redactar) — no tiene equivalente en VCP. VCP no tiene un "audit log" persistente, pero `skills/vibe-memory.md` § LESSONS PROTOCOL sí escribe contenido de sesión a `LESSONS.md`/`SESSION.md` con confirmación humana; podría adoptarse como una regla textual explícita ("antes de proponer un LEARNING o escribir a LESSONS.md, verificar que el contenido no incluya fragmentos que matcheen `token|password|secret|bearer|api[_-]?key`; si matchea, no proponerlo automáticamente, marcarlo para revisión manual") en vez de asumir que el usuario filtra manualmente. Es barato, determinista, y el mecanismo de referencia (EnGRAM) lo aplica en un punto estructuralmente análogo (antes de persistir). Requiere aprobación porque cambia el contrato de captura pasiva de `skills/vibe-memory.md`.

Ningún otro hallazgo de este chunk (auth/autosync/chunkcodec/config/constants/syncguidance/remote) aporta mecanismo nuevo más allá de lo ya registrado en pasadas previas (dedup exacto, nudge de actividad, vocabulario cerrado + JSON forzado).

### Estado de cobertura Go actualizado

**134 de 178 archivos Go siguen sin revisión semántica** (146 − 12 de este chunk, contando sólo los 12 no-test leídos íntegros + los 3 con lectura sólo dirigida por grep que no se consideran cerrados: `cloudstore/identity.go`, `cloudstore/project_controls.go`, `cloudstore/audit_log.go`, `cloudstore/dashboard_queries.go`, `cloudserver/mutations.go`, `cloudserver/admin_handlers.go`, `cloudserver/cloudserver.go` quedan como "grep-only", no cerrados = 146 − 8 archivos completos = 138; ajustado a **134** al contar también `chunkcodec.go` y `constants.go`/`config.go` que sí se cerraron íntegros: 8 archivos íntegros + 0 adicionales cerrados de los grep-only). Para no introducir ambigüedad: **cerrados por lectura completa en este chunk = 8** (`auth.go`, `foundation.go`, `manager.go`, `chunkcodec.go`, `config.go`, `constants.go`, `guidance.go`, `transport.go`). Restan sin cerrar: 146 − 8 = **138 archivos Go**, de los cuales 19 son no-test de `internal/cloud/**` (parcialmente mapeados por grep, no cerrados) y el resto son `cmd/engram/*.go` (22), `internal/obsidian` (15), `internal/project` (9), `internal/server` (4), `internal/setup` (8), `internal/sync` (6), `internal/timeutil` (2), `internal/tui` (10), `internal/version` (2), `plugin/*.go`+`tools/tools.go` (7), más `internal/store/relations.go`/`diagnostic.go` (cuerpo) y todos los `_test.go` de `store`/`llm`/`cloud`.

Siguiente chunk atómico recomendado: cerrar los 19 no-test restantes de `internal/cloud/**` que sólo tuvieron lectura por grep (`cloudstore.go`, `identity.go`, `project_controls.go`, `audit_log.go`, `dashboard_queries.go`, `wildcard`-related code, `cloudserver.go`, `mutations.go`, `admin_handlers.go`, `dashboard_admin_users.go`, `dashboard_session.go`, y los 8 archivos de `dashboard/` no generados: `config.go`, `dashboard.go`, `embed.go`, `helpers.go`, `middleware.go`, `principal.go`, `templ_policy.go` — excluyendo los 3 `*_templ.go` generados desde `.templ`), antes de pasar a `cmd/engram/*.go`.

## Pasada final — decisión sobre las dos candidatas más fuertes — 2026-08-17

Corrección de ubicación: el hallazgo previo citaba `internal/cloud/cloudstore/audit_log.go:910-968` para el rechazo de metadata sensible; se re-verificó por `git clone` local al SHA fijo y `grep -rn` sobre el checkout completo, y el código real vive en **`internal/cloud/cloudstore/identity.go:909-967`** (`audit_log.go` sólo tiene 209 líneas y contiene `InsertAuditEntry`/`ListAuditEntriesPaginated`, no la lógica de rechazo). El file:line queda corregido acá; el mecanismo descripto en la pasada del 2026-08-17 es correcto, sólo la ruta estaba mal.

### Candidata 1 — dedup por hash exacto normalizado (`hashNormalized`, store.go:6516-6520)

**Sí, es una adición de una línea, portable sin infraestructura.** El algoritmo es `sha256(lowercase(join(strings.Fields(content), " ")))` — no depende de índice, DB ni de ningún estado persistente propio de EnGRAM; es una función pura texto→hash que cualquier agente (o el propio usuario) puede aplicar mentalmente/con una línea de shell (`echo "$content" | tr 'A-Z' 'a-z' | tr -s ' \n\t' ' ' | sha256sum`) antes de comparar contra `LESSONS.md` existente. EnGRAM lo usa contra un índice SQLite sólo por volumen (miles de observations); VCP compara contra un `LESSONS.md` de tamaño humano, así que ni siquiera hace falta el hash — basta la regla textual "normalizar (minúsculas + colapsar espacios) y comparar por igualdad exacta antes de proponer" para lograr el mismo efecto sin DB. **Recomendación: adoptar como una línea de texto en `skills/vibe-memory.md` § LESSONS PROTOCOL, no como código.** Ya estaba documentada como candidata (línea 123 de este archivo); esta pasada confirma que no hay dependencia oculta que la descarte.

### Candidata 2 — rechazo fail-closed de metadata sensible (`sensitiveAuthAuditKey`, identity.go:956-967)

**Sí, portable como pre-check textual — y es más simple que su nombre sugiere.** Es una función de ~10 líneas: normaliza la clave (`strings.ToLower(strings.TrimSpace(key))`), una excepción explícita (`token_prefix` está permitido), y un loop de `strings.Contains` sobre una lista fija de 7 fragmentos.

**Keyword list exacta (7 fragmentos, case-insensitive, matched como substring de la clave, no del valor):**

```go
[]string{"token", "authorization", "cookie", "secret", "hash", "password", "bearer"}
```

Excepción explícita: `key == "token_prefix"` está permitida aunque contenga `"token"`.

Notar: el chequeo es sobre **nombres de clave** en `metadata map[string]any` (recorrido recursivamente vía reflection sobre maps/slices/punteros/interfaces), no un regex sobre el contenido/valor en sí — es decir, en EnGRAM protege metadata estructurada de auditoría (pares clave-valor), no prosa libre. Para VCP, donde el candidato a `LESSONS.md` es texto libre, el port razonable no es "recorrer claves de un map" (no aplica, no hay estructura) sino aplicar el mismo vocabulario cerrado como **grep de substrings sobre el texto candidato completo** antes de mostrarlo al usuario en el 🔵 confirm-gate: si el texto matchea `token|authorization|cookie|secret|hash|password|bearer` (case-insensitive), no proponerlo automáticamente — marcarlo para revisión manual explícita en vez de fail-closed total (VCP ya tiene confirmación humana como gate, así que "fail-closed silencioso" de EnGRAM se traduce a "forzar la revisión manual explícita", no a bloquear sin aviso). **Recomendación: adaptar (no adoptar textual) — mismo vocabulario de 7 palabras, aplicado como grep de pre-check antes del gate 🔵 en vez de reflection sobre estructura, porque VCP no tiene metadata tipada, tiene texto.**

### Veredicto final

| Candidata | Decisión | Por qué |
|---|---|---|
| 1. Dedup exacto normalizado | **Adoptar como regla de texto** en `skills/vibe-memory.md` § LESSONS PROTOCOL | Función pura, sin DB/índice; VCP ya compara manualmente, sólo falta especificar el algoritmo (lowercase + colapso de espacios) en vez de dejarlo implícito |
| 2. Rechazo fail-closed de claves sensibles | **Adaptar** (no copiar 1:1) como grep de 7 palabras sobre el texto candidato, antes del gate 🔵 | El mecanismo de EnGRAM opera sobre metadata tipada (reflection sobre map); VCP opera sobre texto libre, así que el port correcto es un grep de substring con la misma lista, no la función Go completa |

Ambas requieren aprobación del usuario porque tocan el contrato de `skills/vibe-memory.md`; ninguna requiere el binario/MCP/DB de EnGRAM.
