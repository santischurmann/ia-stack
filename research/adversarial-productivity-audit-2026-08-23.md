# Auditoría adversarial de productividad — 2026-08-23

## Base de evidencia

Esta auditoría no usa “intuiciones de agentes” como evidencia. Cruzó el código y tests actuales,
el grafo local, el ledger de research y sesiones directamente vinculadas a VCP:

- Claude: `<home>\.claude\projects\C--Users-Santi-Desktop-Claude-VibeCodeProtocols\8d69523c-56e9-4520-82b9-a88818e0c44f.jsonl` (4.743 eventos, 14–21 Ago).
- Codex: 21 sesiones con `cwd` exactamente VCP (73 MB totales revisados por el auditor).
- Graphify previo: `graphify-out/GRAPH_REPORT.md`, construido sobre `4df2a302` mientras el
  baseline de esta auditoría era `ad29447`.
- Research: `research/source-matrix.md` y `research/sources/multi-repo-2026-08-21.md`.

Límite: el research anterior es honesto sobre su cobertura. La ronda de 10 repos tuvo 78
candidatos con veredicto; sólo 24 están `VALIDADO`. No se declara que 50 ideas externas fueron
validadas de forma independiente.

## Las 50 mejoras encontradas

Estado: **HECHO** = implementado y falsificado en esta rama; **SIGUIENTE** = evidencia suficiente
pero requiere un cambio independiente; **NO AUTOMATIZAR** = sería prosa, infraestructura externa
o ampliación de alcance sin una garantía mecánica nueva.

| # | Mejora | Evidencia | Estado |
|---:|---|---|---|
| 1 | RED sólo con runner que pruebe el archivo pedido | falso `node -e` aprobado por regex | **HECHO** |
| 2 | Runner no soportado bloquea, no se adivina | audit de `verify-red.*` | **HECHO** (Node nativo) |
| 3 | Hook malformed fail-closed | `pretooluse-red.mjs` aceptaba stdin inválido | **HECHO** |
| 4 | RED receipt por feature/tarea/path | receipt global autorizaba T01 → T02 | **HECHO** |
| 5 | Receipt de RED vence y hashea tests | sesiones largas + assertion-loosening | **HECHO** |
| 6 | Inventory de todos los `.mjs` cubiertos | “100%” omitía scripts nuevos | **HECHO** |
| 7 | Declarar cobertura shell como funcional, no lineal | Node no instrumenta `.sh`/`.ps1` | **HECHO** |
| 8 | Security scan incluye untracked/staged/unstaged | 4.3 era antes de `git add -A` | **HECHO** |
| 9 | Redactar valores de secretos en evidencia | research `engram` + seguridad | **HECHO** |
| 10 | Runtime co-localizado en el proyecto | installer y docs usaban paths incompatibles | **HECHO** |
| 11 | E2E real de instalación Bash + PowerShell | instalación previa sólo verificaba copias; reinstalar podía anidar runtime | **HECHO** |
| 12 | Templates siempre presentes al inicializar memoria | `vibe-memory.sh` degradaba a archivos vacíos | **HECHO** |
| 13 | Archivos de sesión sin overwrite | archive repetido pisaba el primero | **HECHO** |
| 14 | Canonicalizar `src/../x` en plan | writer overlap evadible | **HECHO** |
| 15 | Case-fold conservador en plan | Windows puede colisionar por mayúsculas | **HECHO** |
| 16 | Ratchet mira código untracked | `git ls-files` omitía código nuevo | **HECHO** |
| 17 | Contrato documental testeado | README 90% contradecía la policy 100% | **HECHO** |
| 18 | Un template de plan con preflight | `templates/plan.md` y template embebido divergían | **HECHO** |
| 19 | README corto y honesto | uso real mostró confusión sobre qué es VCP | **HECHO** |
| 20 | Falsificación propia por cada gate nuevo | fallas RED/receipt previas se hallaron así | **HECHO** en cambios de esta ronda |
| 21 | Receipt schema verifica AC/evidence/4R estructurados | `bf2e14b`, `verify-receipt.mjs` v2 + tests | **HECHO** |
| 22 | Commit atómico con receipt revalidado | ventana TOCTOU entre `check` y `git commit` | **HECHO** — `verify-receipt.mjs commit` valida y escribe en una corrida y confirma después; la ventana se angosta, no se cierra (declarado) |
| 23 | Receipt exige índice exacto, worktree limpio | hoy puede attestear estado unstaged | **HECHO** — `verify-receipt.mjs check --require-clean-worktree` rechaza unstaged/untracked en 4.6; angosta la ventana TOCTOU de #22, no la cierra |
| 24 | Scope post-task compara diff real contra plan | plan declara writers; diff puede diferir | **HECHO** — `scripts/verify-scope-diff.mjs` compara writers con tracked+untracked, con `--ignore` explícito |
| 25 | Claim de task atómico con token/TTL | lock JSON no es atómico | **NO APLICA** — operador único, una sesión por vez (política 2026-08-28); el problema exige dos sesiones simultáneas sobre el mismo proyecto |
| 26 | Reconciliación de locks muertos al resume | sesión interrumpida deja ownership ambiguo | **NO APLICA** — misma razón que #25; del resume interrumpido lo que sí quedó cubierto es el checkpoint de estado (#34/#35) |
| 27 | Audit log con hash chain | “append-only” es hoy una convención | **HECHO** — `verify-audit-chain.mjs`: cada línea lleva el hash de la anterior; `append` sella y se niega sobre una traza rota |
| 28 | ZIP desde allowlist | `07557e7`, `build-zip.sh:31-41` | **HECHO** |
| 29 | Manifest de backup Graphify post-commit | grafo local estaba en `4df2a302`, no `ad29447` | **HECHO** |
| 30 | Manifest Graphify de inclusiones/exclusiones | “100% extracted” no cubre JSON sin nodos | **HECHO** — `verify-graphify-manifest.mjs` exige que cada archivo rastreado esté indexado o excluido con razón, y rechaza fantasmas; prueba contabilidad, no comprensión |
| 31 | Destino Obsidian explícito y validado | export actual usa `--dir graphify-out/obsidian`; falta gate de destino | **PARCIAL** |
| 32 | Receipt de remote ref/fetch | hubo timeout de `git fetch origin/main` | **HECHO** — `verify-session-state.mjs`, sección `## No verificado`: una comprobación que no se pudo hacer se declara con la marca literal y su motivo, y una afirmada como realizada dentro de esa sección es exit 1. No agrega dependencia de red —el gate no ejecuta `git fetch`, verifica que el fallo haya quedado registrado |
| 33 | Research ledger gate (URL/SHA/cita/cobertura) | sesiones tuvieron placeholders promovidos | **HECHO** — `verify-evidence-trace.mjs claims`: cada `linked_requirement_id`/`linked_ac_id` del packet vigente resuelve contra un id que la spec declara, o es referencia rota |
| 34 | Checkpoint completo al límite de proveedor | límites cortaron trabajo antes del cierre | **HECHO (checkpoint, no presupuestos)** — `verify-session-state.mjs`, sección `## Interrumpido en`: declarar la interrupción obliga a declarar `Fase`, `Tarea` y `Falta`, y una interrupción sin punto de retome es exit 1. Los presupuestos por fase **no** se implementaron, a propósito (ver #38) |
| 35 | Estado `provider_paused` | COMPANY default es presupuesto ilimitado | **HECHO (checkpoint, no presupuestos)** — el estado que hacía falta era el punto de retome, no un flag de proveedor: `## Interrumpido en` sirve para cuota agotada, caída o cualquier otro corte, y el gate no distingue la causa porque no la puede verificar |
| 36 | Context packet por agente | telemetría mostró contexto excesivo | **HECHO** — regla en SKILL.md: al subagente se le pasa el encargo, nunca el transcript; fijada en `verify-vcp-contract.mjs` |
| 37 | Prohibir transcript completo cuando hay resumen | misma presión de cuota | **HECHO** — misma regla que #36: si existe un resumen, va el resumen |
| 38 | Presupuesto determinista por fase/reintento | policy manual no puede detener dispatch | **CERRADO SIN PRESUPUESTOS** — decisión 2026-08-28: un tope mal calibrado frena trabajo legítimo y no hay datos históricos para calibrarlo. La mitad que sí paga es el checkpoint (#34/#35). El único tope que existe es por reintento, no por cuota: #43 |
| 39 | Pressure tests de reglas Markdown | `superpowers-14`, reglas pueden degradar en prompts | **CERRADO SIN IMPLEMENTAR** (política 2026-08-28) — cubierto parcialmente por `verify-vcp-contract` (64 frases fijadas) y los 24 límites honestos con su motivo. Rendimiento decreciente frente al costo de mantener otro gate al 100% para siempre |
| 40 | Microtests de wording crítico | `superpowers-9`, evita negaciones ambiguas | **HECHO** — `contracts/honest-limits.json`: cada límite es un dato revisable con su frase literal y el motivo de por qué existe; `verify-vcp-contract.mjs` la busca textual e imprime el motivo al rechazar |
| 41 | IDs AC → test como artefacto verificable | `jcode-2`, cobertura de intención | **HECHO** — `verify-evidence-trace.mjs criteria`: cada `AC<n>` de la spec nombrado por una prueba real, con la convención de `verify-test-bindings.mjs`. Corrido sobre este repo encontró 3: AC12 sin ninguna prueba que lo nombrara, AC8 y AC9 fuera de convención |
| 42 | Paridad estadística Bash/PowerShell | `i-have-adhd-3`, hoy hay fixtures de paridad básicos | **CERRADO SIN IMPLEMENTAR** (política 2026-08-28) — cubierto por las pruebas de instalación, que ejercitan ambos instaladores contra el mismo resultado. Una comparación estadística exige un corpus de corridas que no existe |
| 43 | Límite de ciclo de fix | `superpowers-2`, evita arreglos infinitos | **HECHO** — regla en SKILL.md (frenar y consultar al tercer intento fallido sobre el mismo problema) + `verify-session-state.mjs`, sección `## Intentos fallidos`: tres intentos sin `- decisión humana:` registrada son exit 1, nombrando el problema y los tres intentos con qué se probó y por qué falló cada vez |
| 44 | Reproducir/instrumentar antes de diagnosticar | `mattpocock-4`, baja fixes narrativos | **HECHO** — regla dura en SKILL.md + límite honesto con motivo: un diagnóstico sin reproducción es una hipótesis con tono de conclusión |
| 45 | Árbol de decisión de límite de fase | `mattpocock-1`, reduce ambigüedad de orquestación | **HECHO** — regla en SKILL.md: si un gate no se pudo correr, la fase no cerró; fijado como límite honesto |
| 46 | Redacción canónica reutilizable | `mattpocock-6`/`gstack`, evita patrones duplicados | **HECHO** — regla en SKILL.md: una redacción que ya existe se reusa citándola, no se reescribe |
| 47 | Baseline diff de findings | `paperclip`/`gstack`, separa deuda vieja de nueva | **HECHO** — `verify-security-baseline.mjs --baseline`: lo aceptado no bloquea, lo nuevo sí, y una entrada muerta también bloquea |
| 48 | Evidence locator seguro (URL sin credenciales) | `paperclip P07/P08` | **HECHO** — REQ-G12: el locator de un claim exige https sin credenciales o path project-relative, y rechaza caracteres de control |
| 49 | Tier de modelo sólo para razonamiento difícil | `superpowers-7/8`, optimiza costo sin bajar gates | **DECIDIDO, SIN CÓDIGO** (política 2026-08-28) — siempre el modelo más potente, coherente con el nivel del proyecto. Se descartó el automático por tipo de tarea: en la corrida real, agujeros graves aparecieron en tareas que desde afuera parecían mecánicas |
| 50 | No implementar runtime Paperclip ficticio | research confirma que requiere server/telemetría real | **NO AUTOMATIZAR** |
| 51 | Contención física de paths RED/hook | review independiente encontró escape por symlink tras cerrar `..` | **HECHO** |

## Orden aplicado

Se priorizó daño real y reversibilidad, no cantidad: los puntos marcados **HECHO** antes que las
ideas de proceso restantes. La razón es concreta: permitían aprobar RED falso, escribir fuera de
scope, omitir código nuevo del scan, instalar un sistema que no corría o mantener un grafo viejo.
Cada cambio aplicado trae prueba de falsificación.

Los puntos 21–49 quedan como backlog verificable, no como promesas. Antes de aplicar uno hay que
hacer el mismo ciclo: SPEC → PLAN → falsificación → implementación → revisión independiente.

## Hallazgos de la primera corrida real del protocolo (2026-08-27/28)

Ninguno de estos se detecta leyendo el código: aparecieron al ejecutar VCP de punta a punta sobre
sí mismo, con la feature `integridad-verificable`.

| # | Hallazgo | Evidencia | Estado |
|---|---|---|---|
| 50 | `SKILL.md` 3.1 prometía que un error de carga de módulo pasa el gate RED; `verify-red-node.mjs:152/157` lo rechaza a propósito | contradicción doc↔implementación, verificada corriendo el gate | **HECHO** — documentación corregida en `1f847f3`; el gate era el correcto |
| 51 | `verify-red-node.mjs` confunde el título de un test con un archivo roto: `SYNTAX_SIGNAL` (línea 7) corre sobre stdout+stderr crudo, donde también salen los títulos | Dos tests idénticos, mismo assert fallando: el titulado `...un collection error del runner` → `REJECTED: the test file failed to parse/load`; el mismo sin esa frase → `OK: RED gate passed`. Reproducido con fixtures fuera del repo | **HECHO** — T05: `SYNTAX_SIGNAL` pasa a ser sólo redacción y se consulta **únicamente** cuando no hay ningún bloque `ERR_ASSERTION` atado a su línea `not ok`; nunca provoca un rechazo por su cuenta. La diferencia es estructural y está medida: un archivo que no parsea nunca llega a ejecutar un assert, así que no puede producir ese bloque; si hay uno, el archivo cargó y corrió tests, y la frase encontrada es contenido del autor. No afloja el gate: el archivo roto sigue rechazado en el mismo punto, por el chequeo de bloques de assertion que ya existía, y conserva su mensaje específico de fallo de carga. Falsificado en las dos direcciones con procesos reales en `tests/verify-red-node.test.mjs`. Se revirtió además el rename que el defecto había forzado (`source-collection failures` → `source-collection errors`). El defecto, para que no se reintroduzca: el mensaje mentía —decía que el archivo no parsea cuando parsea perfecto— y cualquier test cuyo título contuviera `SyntaxError`, `Unexpected token`, `collection error`, `ERROR collecting` o `IndentationError` quedaba incapacitado de producir un RED válido; bloqueó T02 hasta renombrar un test existente |
| 52 | El escáner de seguridad dispara sobre el comentario que explica cómo evitarlo | `INJECTION` es `\bexec\s*\(` sobre el texto crudo del archivo, sin distinguir código de comentario. Un comentario que decía ``evita `.exec(` `` disparó el mismo hallazgo que documentaba | **DOCUMENTED_LIMIT** — convención del repo: fragmentar el literal (`'ex' + 'ec'`), como ya hace el propio escáner en su línea 52 |
| 53 | `.vibe/vcp-runtime/` se desincroniza del repo fuente sin detección | El gate de Discovery falló con `DISCOVERY_SNAPSHOT_INVALID` usando el runtime instalado y pasó con `scripts/`. Un proyecto consumidor puede correr gates de una versión vieja sin enterarse | **HECHO** — T06: nuevo gate `scripts/verify-runtime-sync.mjs check [--runtime <ruta>]`. Compara por hash de contenido la superficie exacta que copia `copy_runtime()` (`scripts/`, `contracts/`, `tests/`, `templates/`, `skills/` + `SKILL.md` + `SECURITY.md`) contra la copia instalada, y nombra las tres clases: los que difieren, los que faltan en el runtime y los que **sobran** —un gate borrado arriba que el proyecto sigue ejecutando. Sin runtime instalado sale `0`: un checkout fuente limpio es normal. La lista no se inventa: `tests/verify-runtime-sync.test.mjs` parsea `install.sh` y `install.ps1` y se pone rojo si cualquiera de los dos empieza a copiar otra cosa. Verificado que el instalador **no transforma** nada dentro del runtime (instalación fresca byte-idéntica en las 5 carpetas y los 2 archivos); el `sed`/`-replace` de `(fill in)`/`YYYY-MM-DD` toca sólo `<proyecto>/.vibe/PROJECT.md`, que está fuera de `vcp-runtime/`. Cableado en `SKILL.md` Phase 0 paso 1b, antes de cualquier otro gate, y **desde el checkout fuente**: correrlo desde `.vibe/vcp-runtime/` compararía la copia consigo misma, siempre verde. Corrido en este repo el día del arreglo listó 11 archivos divergentes (incluida la versión vieja de `verify-red-node.mjs` con el defecto del hallazgo 51) y 3 ausentes |
| 54 | El schema de `locator` no tenía campo de línea: había que enterrarla en el path (`SKILL.md#L693`) | detectado al registrar los claims reales del Discovery | **HECHO** — REQ-G13, `line` entero positivo opcional |

## Políticas decididas (2026-08-28)

Los 18 items que quedaban abiertos no eran todos código faltante: la mayoría esperaba una decisión
de política que sólo el dueño del proyecto puede tomar. Tomadas y registradas para que ninguna
sesión futura vuelva a preguntarlas.

| Items | Decisión | Motivo |
|---|---|---|
| 25, 26 (locks) | **NO APLICA** al modo actual | Operador único, una sesión por vez. El problema exige dos sesiones simultáneas sobre el mismo proyecto. Se reabre si alguna vez trabaja alguien más en paralelo — no antes. |
| 34, 35, 38 (cuota) | **Checkpoint al cortarse, sin topes** | Al agotarse la cuota se escribe dónde quedó y qué falta, para retomar sin reconstruir. **No** se ponen presupuestos por fase: un tope mal calibrado frena trabajo legítimo, y no hay datos históricos para calibrarlo. |
| 43 (reintentos) | **3 intentos, después pregunta** | Al tercer fallo sobre el mismo problema, frenar y mostrar qué se probó y por qué falló cada vez. Tres alcanza para descartar un error tonto sin quemar tiempo en un callejón sin salida. |
| 49 (modelo) | **Siempre el más potente** | Coherente con el nivel del proyecto (producto con plata). Descartado el automático por tipo de tarea: en la corrida real, agujeros graves aparecieron en tareas que desde afuera parecían mecánicas. |
| 36, 37 (contexto) | **Prohibido pasar conversaciones enteras** | Si existe un resumen, se pasa el resumen. Regla de trabajo, no código. Descartada la plantilla fija de encargo: los encargos de la corrida real salieron bien justamente por adaptarse a cada caso. |
| 33, 41 | **Implementar** | 41 (criterio ↔ prueba) es el único hueco sin cubrir. 33 (research con fuentes citadas) se hizo a mano en la corrida real y funcionó, pero nada obliga a la próxima sesión. |
| 39, 42 | **NO por ahora** | Ya cubiertos parcialmente por los controles de contrato y las pruebas de instalación. Rendimiento decreciente frente al costo de mantener un gate más al 100% para siempre. |
| 44, 45, 46 (disciplina) | **Los tres, como texto** | 44 (reproducir antes de diagnosticar) fue lo que más valor dio en la corrida real: cada agujero grave se reprodujo con un comando antes de escribir el arreglo. Cuestan poco: son reglas, no código. |
| 32 (red) | **Registrar "no verificado"** | Si la comprobación contra el remoto falla, se anota explícitamente en vez de seguir como si nada. No agrega dependencia de red. |

**Queda por implementar**: nada de lo decidido el 2026-08-28. El último bloque abierto —el
checkpoint de cuota (34/35), el tope de reintentos (43) y el registro de red no verificada (32)—
cerró con `scripts/verify-session-state.mjs`, cableado en Phase 0 paso 5b. El **38** se cierra
explícitamente **sin** presupuestos: se implementó la mitad que paga (dónde retomar) y no la que
frena trabajo legítimo (un tope por fase sin datos históricos para calibrarlo).

**Implementados desde entonces**: el gate criterio↔prueba (41) y el de research con fuentes
citadas (33), los dos en `scripts/verify-evidence-trace.mjs` — `criteria` cablado en Phase 4 antes
del receipt, `claims` al final de Phase 0.5. Las reglas de contexto (36/37) y las tres de
disciplina (44/45/46) quedaron como texto en `SKILL.md`, fijadas por `verify-vcp-contract.mjs`.

**Cerrado sin implementar, con motivo**: 25, 26 (no aplica al modo actual), 38 (sin presupuestos,
arriba), 39, 42 (cubiertos), 49 (decidido, no requiere código).

### Deriva encontrada al cerrar 32/34/35/38/43 (2026-08-28)

La columna de estado de la tabla de arriba estaba **corrida**: tres commits seguidos
(`19abb0b`, `fed0623`, `0ace5dc`) reemplazaron la primera aparición literal de `SIGUIENTE` en vez
de la fila que querían tocar, así que cada descripción aterrizó en el item equivocado y el reemplazo
de `19abb0b` llegó incluso a pisar la leyenda del propio estado. El resultado se leía perfectamente
plausible —cada celda decía `**HECHO**` con una referencia real a un gate que existe— pero el item
que nombraba no era el que ese gate cerró: el 27 (hash-chain) figuraba como una regla de contexto,
el 32 (red) como "misma regla que #36", y los items 36, 37, 40, 44, 45, 46 y 47, todos hechos,
seguían en `SIGUIENTE`. Corregido moviendo cada descripción a su fila; ninguna se perdió. La causa
no es de contenido sino de método —un reemplazo por texto literal sobre un archivo donde el mismo
literal aparece 18 veces— y no la detecta ningún gate: el contrato verifica frases en documentos
vivos, no la coherencia interna de un backlog.

## Hallazgo 55 — el sello del backup depende del orden en que se corre Graphify

**Encontrado**: 2026-08-28, ejecutando el paso 4.7 del propio protocolo.

`verify-backup-state.mjs` lee el commit que el `GRAPH_REPORT.md` declara (`- Built from commit:`)
y lo compara contra HEAD. Pero Graphify sólo regenera ese reporte cuando detecta cambios de
**topología** del código; si el grafo ya estaba al día, `update` no toca nada y el reporte conserva
el commit de cuando se generó.

El protocolo manda correr Graphify **después** del commit (4.7), pero también exige que
`verify-graphify-manifest.mjs` pase **antes** de commitear — y ese gate obliga a correr `update`
para indexar los archivos nuevos. Resultado: se corre dos veces, la primera surte efecto y la
segunda no, y el sello queda con el commit anterior aunque el contenido del grafo sea correcto.

**Verificado**: los 15 archivos cambiados entre el commit sellado (`0ace5dc`) y HEAD (`3b68a73`)
están todos indexados en `graphify-out/manifest.json`. El grafo está al día; sólo el sello miente.

**No resoluble con lo disponible**: `GRAPHIFY_FORCE=1` no regenera sin cambios de topología, y
`graphify label` —que sí regeneraría el reporte— exige una clave de API que este entorno no tiene.

**Estado**: SIGUIENTE. Tres caminos posibles, ninguno elegido todavía: corregir el orden en SKILL.md
para que Graphify corra una sola vez; ablandar el gate para aceptar un sello cuyo commit sea
ancestro cuando el contenido coincide (debilita un control que hoy detecta un backup genuinamente
viejo); o registrar el sello por separado del reporte.

**Lo que NO es**: no es un backup corrupto ni desactualizado. Es un sello que quedó atrás de su
propio contenido.
