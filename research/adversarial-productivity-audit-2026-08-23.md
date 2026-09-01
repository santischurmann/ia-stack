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
| 31 | Destino Obsidian explícito y validado | export actual usa `--dir graphify-out/obsidian`; `verify-obsidian-export.mjs` valida destino project-local, árbol sin symlinks, `graph.canvas` JSON y nota Markdown; tests dedicados | **HECHO** — verifica forma/destino, no semántica de notas |
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


## Hallazgo 56 — borrar `.vibe/AUDIT.md` entero pasaba como "cadena íntegra"

**Encontrado**: 2026-08-28, corriendo todos los gates en un directorio vacío.

`verify-audit-chain.mjs check` sobre un archivo inexistente leía cadena vacía, verificaba cero
líneas y escribía `OK: ... has an intact audit chain over 0 chained line(s)`, exit 0. Lo mismo con
el archivo presente pero vacío. Es la forma más simple del límite que el propio gate ya declaraba
—"la cadena no detecta reescrituras completas ni truncamiento"—, sólo que llevada al extremo:
no hace falta reescribir nada, alcanza con borrar el archivo.

Lo grave no es el exit 0: un proyecto que todavía no escribió su primera línea de auditoría no
incumple nada. Lo grave es la palabra **íntegra** sobre cero líneas verificadas.

**HECHO** — T13. Cero líneas selladas ahora escribe `VACÍO:` en vez de `OK:`, y
`--require-inputs` lo convierte en `AUDIT_CHAIN_NO_INPUTS` exit 1 donde el protocolo ya exige que
el rastro exista. **Sigue sin cubrirse**: recortar las últimas líneas de una cadena con contenido,
y recalcular la cadena entera sobre contenido falso. Los dos necesitan un ancla fuera del archivo.

## Hallazgo 57 — tres lecturas de código no encontraron lo que una ejecución sí

**Encontrado**: 2026-08-28, comparando cómo se armó cada lista de "verdes vacíos".

La lista de gates que decían `OK:` sin haber comparado nada se armó tres veces leyendo el código,
y quedó corta las tres:

| Método | Encontró | Se le escapó |
|---|---:|---|
| `grep` sobre `return { ok: true` con mensajes de ausencia | 6 | el 7º, en `verify-phase-decisions.mjs` |
| batería completa de gates sobre el repo real | 7 | los caminos de `check` sobre archivo ausente |
| sonda: cada gate en un directorio vacío | 9 | (lo que la sonda no prueba, declarado abajo) |

El 7º hueco lo había abierto **T11, horas antes**, en el mismo día en que T12 catalogó los otros
seis. O sea: la lista de huecos ya estaba desactualizada cuando se escribió.

**HECHO** — T13, `verify-empty-probe.mjs`. La lección quedó como gate y no como nota: un
`verify-*.mjs` que no declare qué hace sin entradas es rechazo, así que la lista no puede volver a
quedar corta en silencio. **Lo que la sonda no prueba, declarado**: una sola invocación por gate,
sólo el caso extremo de la carpeta vacía, y `self` es una declaración humana que nadie verifica.


## Hallazgo 58 — el instalador dejaba su propio runtime como superficie del proyecto

**Encontrado**: 2026-08-28, instalando VCP en una carpeta limpia por primera vez.

El repo de VCP ignora `.vibe/vcp-runtime/` en su propio `.gitignore`, pero **el instalador nunca
escribía esa regla en el proyecto del usuario**. Resultado, reproducido en un repo recién creado:
los 114 archivos del runtime quedaban sin seguimiento, o sea dentro de lo que git considera
superficie viva.

Dos consecuencias, la segunda grave:

1. El usuario commitea 114 archivos de esta herramienta junto con su trabajo, sin querer.
2. `verify-security-baseline.mjs` usa `git ls-files --others --exclude-standard` para armar la
   superficie a escanear. Con el runtime ahí adentro, **un hallazgo dentro del runtime bloquea el
   proyecto del usuario con un CRITICAL que no escribió y no puede arreglar editando su código**.
   Reproducido plantando un archivo con un secreto dentro del runtime instalado: el gate pasó de
   `OK` a `REJECTED: 1 blocking security finding(s)` en un proyecto cuyo código no había cambiado.

Este defecto era **invisible desde el repo de VCP**, porque ahí la regla sí existe. Sólo aparece
instalando en una carpeta limpia, que es exactamente lo que nadie había hecho nunca.

**HECHO** — los dos instaladores (`install.sh` e `install.ps1`) agregan la regla de forma
idempotente, creando el `.gitignore` si no existe y respetando su contenido previo. Verificado en
una instalación limpia real: la superficie del proyecto pasó de 124 archivos a 11, con 0 del
runtime, y tres instalaciones seguidas dejan la regla una sola vez.


## Hallazgo 59 — la cobertura mentía cuando el código cambiaba durante la corrida

**Encontrado**: 2026-08-28, persiguiendo una lectura de 98,85 % que no se reproducía.

El chequeo de cobertura reportó ramas sin cubrir que no existían. Ocho corridas seguidas dieron
el patrón exacto:

| Corridas | Estado del árbol | Resultado |
|---|---|---|
| 1, 2, 6, 7, 8 | quieto | todo cubierto |
| 3, 4, 5 | se estaba editando un script | ramas inventadas |

La herramienta mapea líneas contra el archivo tal como está al terminar de medir. Si el archivo
cambió durante la corrida, el mapa no corresponde a lo que se ejecutó. El riesgo real no es el
número: es perder horas buscando en el código un hueco que sólo existía en la medición.

**HECHO** — el gate toma una huella sha256 del contenido de todos los scripts antes y después de
medir. Si difieren, rechaza con `COVERAGE_SOURCE_CHANGED` y **no publica ningún porcentaje**, en
vez de informar un número que no vale.

**Límite honesto**: la huella cubre `scripts/`, que es lo que el gate mide. Un cambio en `tests/`
durante la corrida sigue sin detectarse. Y la anomalía original, sobre `verify-discovery-views`,
nunca se reprodujo: la explicación es la misma clase de causa, pero eso es una hipótesis
respaldada por el patrón de las ocho corridas, no la reproducción de ese caso puntual.


## Hallazgo 60 — la suite no estaba verde en un clon recién hecho

**Encontrado**: 2026-08-28, clonando el repo publicado desde GitHub y corriendo la suite ahí,
en vez de en el árbol de trabajo. Es la LESSON-2 de esta misma sesión aplicándose sola, horas
después de escribirla.

Dos pruebas fallaban en el clon y ninguna era visible desde el repo de origen:

1. **El parser del instalador PowerShell asumía finales de línea LF.** Git normaliza al hacer
   checkout, así que en Windows `install.ps1` llega con CRLF; buscar el cierre de la función con
   LF crudo devolvía `-1`, el `slice` se comía el resto del archivo y la prueba encontraba
   directorios que `Copy-Runtime` no copia. Pasaba **sólo en la máquina donde el archivo
   casualmente tenía LF** — la mía. Mismo error latente en el parser del instalador Bash.
2. **La prueba del manifiesto Graphify exigía un archivo que está en `.gitignore`.** Un clon no
   tiene `graphify-out/`, así que esa prueba no podía pasar nunca fuera del árbol del autor.

**HECHO** — los dos parsers normalizan CRLF antes de leer, y la prueba del manifiesto se declara
**SALTEADA con el motivo impreso** cuando no hay grafo: `sin graphify-out/manifest.json: corré
`graphify update .` antes. No es un verde, es una prueba que no corrió.` Saltear en silencio
habría sido exactamente el verde vacío que esta misma sesión pasó la noche eliminando.

Verificado clonando de nuevo: **535 pasan, 0 fallan, 1 salteada con motivo a la vista**.


## Hallazgo 61 — tres bugs reales, cada uno en un gate escrito ese mismo día

**Encontrado**: 2026-08-28, atacando los gates de forma adversarial y **reproduciendo cada uno**
antes de tocar nada. Los tres estaban en código escrito en esta misma sesión.

### 1. El ancla de git rechazaba en falso a la mayoría de los usuarios de Windows

`verify-audit-chain history` comparaba los bytes crudos del archivo de trabajo contra el blob
guardado. git guarda LF y entrega CRLF en un checkout con `core.autocrlf=true`, que es su default
en Windows: el mismo contenido escrito distinto. **Reproducido clonando** con esa configuración —
`REJECTED: el archivo sin commitear no extiende la última versión registrada`— sobre una traza que
nadie había tocado. El ancla recién construida estaba rota para el caso más común.

**HECHO**: la comparación normaliza el fin de línea de los dos lados. Es el mismo error del
hallazgo 60, en código escrito el mismo día.

### 2. Una lista de decisiones vacía pasaba como verificada

`verify-phase-decisions check` sobre `{"decisions": []}` devolvía
`OK: registra 0 decisión(es) encadenadas ... cada una con su menú, su recomendación, la opción
elegida y por qué`. Un verde afirmando haber verificado la nada, y `--require-inputs` tampoco lo
agarraba. Es el verde vacío que este release eliminó en otros gates, escondido detrás de una lista
vacía en vez de un archivo ausente.

**HECHO**: escribe `VACÍO:` y con `--require-inputs` es rechazo.

### 3. El gate de cobertura se creía cualquier línea impresa

`parseScriptCoverage` leía **toda** la salida, no sólo la tabla. Una prueba que imprimiera
`ℹ  inventado.mjs | 100.00 | 100.00 | 100.00 |` fabricaba una entrada de cobertura para un archivo
que no existe. El gate que vigila la cobertura de todos los demás aceptaba lo que alguien decidiera
imprimir.

**HECHO**: sólo lee entre las marcas `start of coverage report` y `end of coverage report` que
escribe node. Un reporte que no abrió o no cerró da cero filas. Obligó además a arreglar los
fixtures de sus propias pruebas: alimentaban tablas sin esas marcas, o sea probaban el parser
contra una salida que node nunca produce.

### Lo que el ataque NO probó, y hay que decirlo

De 130 agentes, **100 murieron por límite de sesión**. Los 6 atacantes sí corrieron y propusieron
41 huecos, pero la fase de refutación se cayó casi entera. El workflow reportó **"39 confirmados"**
y **eso es falso**: sin escépticos vivos, mi propio guion contaba como confirmado todo lo que nadie
pudo refutar. Es el mismo error de verde vacío, en espejo — y en la herramienta escrita para
buscar verdes vacíos.

Los tres de arriba son los que **yo mismo reproduje corriendo**. Los otros 38 quedan como
**propuestos, sin refutar y sin verificar**, y están en el journal del workflow para retomarlos.


## Hallazgo 62 — revisión de los 38 huecos que el ataque dejó sin verificar

**Hecho**: 2026-08-28. El ataque adversarial propuso 41 huecos pero su fase de refutación murió
por límite de cuota, así que 38 quedaron sin verificar y el informe decía "39 confirmados", que
era falso. Se revisaron **reproduciendo cada uno a mano**, sin agentes.

### Reproducidos y arreglados (6)

| Gate | Qué pasaba | Estado |
|---|---|---|
| `verify-security-baseline` | Un `.env.production` con `DATABASE_PASSWORD` sin comillas **pasaba en verde**: el detector exigía una comilla después del signo igual, que es la forma de escribirlo en código. Los `.env` no la usan, y son donde más viven las credenciales. | **HECHO** — detector de asignación sin comillas, con la palabra clave admitida como sufijo del identificador (`AWS_SECRET_ACCESS_KEY`). |
| `pretooluse-red` | **Denegaba TODA escritura real.** Claude Code manda `file_path` absoluto y la normalización rechaza todo path absoluto, por diseño, para frenar traversal. | **HECHO** — se relativiza contra el proyecto antes de normalizar; lo de afuera sigue denegado. |
| `verify-audit-chain history` | **El ancla se apagaba sola**: con el path escrito con barra invertida, `git log` listaba los commits y `git show` fallaba en todos, así que cada versión quedaba vacía, el crecimiento pasaba trivialmente y una traza fabricada de cero salía OK. | **HECHO** — el path se normaliza para git, y si NINGUNA versión se pudo mostrar es un rechazo, no un ancla en silencio. |
| `verify-phase-decisions` | Mover una fase sin decisión al final de `phase_order` **borraba la detección de fase salteada sin tocar un solo hash**, porque el orden no entraba a la preimagen. | **HECHO** — entra el prefijo de `phase_order` hasta la fase de cada decisión: agregar una fase futura sigue siendo legítimo, reordenar rompe el sello. |
| `verify-graphify-manifest` | Un solo archivo versionado con acento dejaba el gate en **rojo permanente**, con el nombre destrozado en el mensaje: `git ls-files` sin `-z` escapa los nombres no ASCII. | **HECHO** — `ls-files -z` y separación por NUL. |
| `verify-empty-probe` | La clase `usage` **no exigía motivo**: declarar un gate con argumentos incompletos lo silencia —sale 2 siempre— y quedaba contado como probado. | **HECHO** — `usage` exige `why` como `self` y `skip`; los tres gates que la usaban ahora declaran el suyo. |

### Reproducidos y NO arreglados, con motivo (2)

- **`verify-discovery-core`: la historia de Discovery se puede recortar.** Borrar la última
  decisión de un run pasa en verde. Reproducido. Es la **misma clase** que el truncado de la
  cadena de auditoría, y tiene la misma respuesta: el ancla de git. Queda pendiente aplicarle a
  Discovery el mismo tratamiento que recibió `verify-audit-chain history`.
- **`verify-vcp-coverage`: el inventario compara por nombre de archivo, no por ruta.** Un ayudante
  de pruebas homónimo cubriría a un script sin ninguna prueba. Reproducido con la función real.
  Exige que alguien cree un archivo con el mismo nombre en otra carpeta: es real, pero pide una
  decisión sobre qué formato de ruta emite node en cada versión, y eso merece su propia tarea.

### Revisados y NO son huecos (2 de los mirados)

- **`verify-scope-diff --ignore`**: es una **bandera documentada**, con su explicación en README.
  Lo que sí es cierto del reporte: la línea de OK sale idéntica se haya usado o no, así que la
  evasión no deja rastro en la salida. Mejora pendiente, no defecto.
- **`verify-receipt` con archivo acentuado**: no se reprodujo. El gate responde por su camino
  normal (`receipt not found`), no con el error de sistema que reportaba el ataque.

### Lo que queda sin revisar, dicho con el número exacto

De los 38, se reprodujeron y resolvieron **6**, se reprodujeron y quedaron pendientes **2**, y se
descartaron **2**. Los **28 restantes** —casi todos de severidad media y baja— siguen
**propuestos, sin verificar**, guardados en el journal del workflow. No están confirmados ni
refutados: nadie los corrió.


## Hallazgo 63 — revisión de los 28 que quedaban, uno por uno

**Hecho**: 2026-08-28. Se reprodujo cada propuesta a mano. Ninguna se dio por buena sin correrla.

### Reproducidos y arreglados (6)

| Gate | Qué pasaba |
|---|---|
| `verify-evidence-trace` | **`test.todo` y `test.skip` contaban como criterio cubierto.** Un AC "cubierto" por una prueba que nadie escribió, o que está apagada, pasaba en verde: trazabilidad falsa. Dejaron de contar. |
| `verify-security-baseline` | Con la base por omisión el delta es vacío por construcción, y escanear **cero archivos** decía `OK`. El límite del delta no cambia —sigue siendo el diseño— pero ahora se escribe `VACÍO:` y la salida dice cómo conseguir un delta real. |
| `verify-phase-decisions` | Dos opciones que sólo difieren en **caracteres invisibles** (ancho cero, marcas de dirección) satisfacían el mínimo del menú. Para quien lee son la misma. La unicidad se mide sobre el texto visible. |
| `verify-session-state` | Un `SESSION.md` de **0 bytes** satisfacía `--require-inputs`: un `touch` convertía el VACÍO en "OK: es retomable". Un archivo sin una sola sección no declara estado. |
| `verify-audit-chain check` | Inyectar líneas **sin sello arriba** de una traza sellada pasaba en verde. No se puede detectar desde adentro del archivo —los hashes viven ahí mismo— pero `history` **sí lo agarra**, verificado. Ahora `check` informa cuántas líneas heredadas hay antes del primer sello y nombra a `history`: crecer de 0 a 1 se ve. |
| `verify-security-baseline` | Un bloque duplicado y muerto quedó de un parche anterior mío. Eliminado. |

### Reproducidos, NO arreglados, con motivo (5)

- **Aceptar `unscanned-large-source` es un punto ciego permanente.** El identificador del hallazgo
  es `sha256(categoría + ruta + evidencia)`, y para un archivo demasiado grande la evidencia es una
  frase constante. Se le inyecta un secreto después y el gate sigue en verde. Reproducido. Arreglarlo
  bien exige que la aceptación cubra el **contenido**, y esa es la misma decisión de diseño que el
  research externo declaró sin respuesta buena. Merece su propia tarea, no un parche.
- **Un rename que sólo cambia mayúsculas deja `runtime-sync` en rojo permanente, y reinstalar no lo
  arregla**: en Windows el sistema de archivos no distingue mayúsculas, así que la copia escribe
  sobre el nombre viejo y el archivo esperado nunca aparece. Reproducido, incluido el paso de
  reinstalar. El arreglo es que el instalador borre el runtime antes de copiar, y borrar un
  directorio del proyecto del usuario necesita más cuidado del que entra en este lote.
- **Un secreto en UTF-16LE es invisible a todos los detectores** y el archivo igual se cuenta como
  escaneado. Reproducido. Arreglarlo pide decidir cómo detectar la codificación sin romper el
  escaneo de binarios, que hoy está deliberadamente acotado.
- **La sonda de carpeta vacía enumera sólo `verify-*.mjs`**, así que `pretooluse-red.mjs` y `ratchet.mjs` quedan afuera y ni siquiera aparecen como no declarados. Reproducido contando los archivos.
- **Once de veintitrés gates no tienen ningún límite honesto que los nombre**, y nada lo detecta.
  Verificado cruzando los dos inventarios. Es una regla que falta, no un defecto de código.

### Reproducidos y son correctos por diseño (4)

- **`--runtime` en `runtime-sync`**: sin la bandera verifica su propio runtime, con ella el del
  proyecto. Las dos respuestas son ciertas; lo que falta es que el mensaje diga cuál miró.
- **`record` acepta el mismo archivo como `--report` y `--graph`**: emite un recibo que aparenta
  sellar dos artefactos. Real, pero es un error de quien llama y el recibo dice qué rutas usó.
- **El contador de límites honestos suma duplicados**: decir 35 donde hay 34 distintos. Cosmético.
- **Correr `verify-vcp-contract` desde un proyecto siempre falla**: verifica los documentos del
  propio VCP, no los del consumidor. Lo que hay que arreglar es la documentación, no el gate.

### Refutados: no se reprodujeron (3)

- **Repetir el encabezado `###` no evade el tope de intentos**: el gate lo agarra igual, con otro
  código (`ATTEMPT_MALFORMED` en vez de `ATTEMPT_LIMIT`), porque la numeración corrida se rompe.
- **`graphify-manifest` con 0 archivos indexados**: rechaza, no da OK.
- **Una línea heredada que termina en un sufijo de sello válido**: rechaza, y es lo correcto — un
  sufijo con esa forma es indistinguible de un sello, y tratarlo como texto es el agujero que el
  propio gate documenta haber cerrado.

### Sin verificar (8)

Quedan sin correr: `receipt` desde un subdirectorio, `.git/info/exclude` contra `scope-diff`, el pie
de TAP de `red-node`, las extensiones que el hard gate RED no cubre, una traza de más de 64 MiB,
una promesa de contrato fijada sólo por su título, una clave escrita a mano en el manifiesto, y que
el sello del backup no cubra `manifest.json`. **Ni confirmados ni refutados.**


## Hallazgo 64 — los últimos 8, verificados uno por uno

**Hecho**: 2026-08-28. Se reprodujo cada uno. **Siete eran reales**; el octavo ya estaba cerrado.

### Arreglados (5)

- **`verify-red-node` rechazaba un RED genuino.** El pie de TAP se leía del PRIMER match, y node
  prefija la salida de cada prueba con `# `: una prueba que imprime `fail 0` produce una línea
  idéntica al pie. **HECHO** — se lee el último, que es el que el corredor escribe al cerrar.
- **El sello del backup no cubría `manifest.json`**, que es justo el archivo que dice qué archivos
  cubre el grafo. Alterar la cobertura después de sellar dejaba este gate y el del manifiesto en
  verde a la vez. **HECHO** — el inventario entra al recibo; un recibo viejo sin ese campo sigue
  verificando, y un proyecto sin inventario puede sellar igual.
- **El hard gate RED no cubría `.sh`, `.ps1`, `.c`, `.cpp`, `.h`, `.vue`, `.svelte`, `.tf` ni
  `.html`** — pasaban sin receipt y sin decir nada. Reproducido: doce rutas permitidas, tres
  denegadas. **HECHO** — la lista se sacó a una constante exportada, se amplió a 38 extensiones, y
  su límite queda escrito: sigue siendo una lista, no una regla.
- **Una promesa de contrato fijada por el título dejaba borrar todo el cuerpo.** Se borró la tabla
  entera del diccionario —de 17 términos quedaron 2— y el contrato pasó en verde, con el README
  prometiendo un diccionario que no estaba. **HECHO** — se fija también una fila de la tabla.
- Una rama muerta en `verify-backup-state` que ninguna prueba podía alcanzar: eliminada.

### Reproducidos y NO arreglados, con motivo (2)

- **`.git/info/exclude` da vuelta el veredicto de `scope-diff` sin dejar rastro en el repo.** Una
  línea en un archivo que vive dentro de `.git/` —nunca commiteado, nunca revisable— convierte
  `REJECTED: changed paths outside T1` en `OK`, con el archivo fuera de alcance todavía en disco.
  Reproducido. **No se arregla acá porque la respuesta correcta no es obvia**: el gate usa git
  para saber qué cambió, y git respeta ese archivo por diseño. Lo honesto sería que el gate
  informe qué fuentes de exclusión estaban activas, y eso merece decidirse, no parchearse.
- **Una clave escrita a mano en el manifiesto compra cobertura.** El manifiesto no está
  versionado, así que agregarle `"docs/nuevo.md": {}` convierte un rechazo en OK sin dejar rastro
  revisable. Reproducido. Mismo motivo: el gate confía en un archivo que nadie revisa, y cerrarlo
  de verdad exige atar el manifiesto a quien lo produjo.

### Ya estaba cerrado (1)

- **Una traza de más de 64 MiB desbordaba el búfer y el ancla se volvía siempre-verde.** El
  arreglo del path —que ninguna versión se pueda mostrar es un rechazo, no un ancla en silencio—
  ya lo había cerrado. Verificado inyectando un `show` que desborda: ahora rechaza.

### Reproducido y sin arreglar, de la tanda anterior

- **`verify-receipt` corrido desde un subdirectorio calcula otra huella.** Comprobado: la huella
  desde la raíz y desde `sub/` difieren, así que un archivo sin rastrear en la raíz queda invisible
  y `--require-clean-worktree` cuenta cero. El arreglo es correr git desde la raíz del repo, no
  desde el directorio actual; queda anotado porque toca el cálculo de la huella, que es lo que
  sella cada receipt existente.

### Estado del ataque adversarial, cerrado

De las 41 propuestas: **20 reproducidas y arregladas**, **9 reproducidas y declaradas sin
arreglar con su motivo**, **4 correctas por diseño**, **3 refutadas** —no se reprodujeron— y
**5 que resultaron ser el mismo defecto contado dos veces o ya cerradas por otro arreglo**.
Ninguna quedó sin mirar.

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

**Estado**: **HECHO** — T10, 2026-08-28. Se eligió el tercer camino: **registrar el sello por
separado del reporte**. `verify-backup-state.mjs` dejó de leer el `- Built from commit:` del
`GRAPH_REPORT.md`; `record` lee el HEAD real con `git rev-parse` y `check` lo compara contra el HEAD
real de nuevo, además de los hashes de contenido que ya calculaba.

**Causa raíz real**: no era el orden de los comandos ni un backup viejo. El sello dependía de
**cuándo se ejecutó Graphify**, no de qué contiene el grafo — y Graphify sólo reescribe el reporte
cuando cambia la topología del código, así que un commit de sólo documentación lo deja apuntando a
un ancestro **para siempre**. Ningún reordenamiento en `SKILL.md` lo arregla: el reporte no se
regenera aunque se lo corra en el momento perfecto (`GRAPHIFY_FORCE=1` no alcanza sin cambios de
topología y `graphify label`, que sí lo regeneraría, exige una API key que este entorno no tiene).
El defecto estaba en tomar como sello un dato que escribe una herramienta externa según su propia
heurística de regeneración.

**Qué garantía se cambió por cuál**:
- **Se perdió**: que el grafo haya sido **construido** en el commit sellado. El gate ya no lo
  prueba, y registrar un grafo de otro proyecto sale en verde (reproducido con el CLI).
- **Se ganó**: el sello lo controla el protocolo. Se verifica el **contenido real** de los archivos
  contra un HEAD que registra el propio protocolo, en vez de confiar en una línea de texto escrita
  por una herramienta externa. La comparación de HEAD pasó de `head.startsWith(sello)` a igualdad
  exacta: un prefijo corto escrito a mano, que antes pasaba, ahora se rechaza.
- **La mitad que falta ya estaba cubierta**: que el grafo cubra los archivos del commit actual lo
  prueba `verify-graphify-manifest.mjs` contra `git ls-files`. El límite quedó declarado en
  `contracts/honest-limits.json` (`backup-state-is-freshness-not-graph-semantics` en README y
  `backup-seal-is-protocol-owned-not-graphify-owned` en SKILL, para que nadie vuelva a cablear el
  gate contra la línea del reporte).
- **No se aflojó** la detección de un backup genuinamente viejo: contenido del grafo o del reporte
  modificado después del registro, y HEAD movido después del registro, siguen siendo exit `1`, cada
  uno con su fixture explícito en `tests/verify-backup-state.test.mjs`.

**Costo lateral, parcialmente repuesto**: `record` ya no valida que `--report` apunte a un reporte
Graphify. Antes, un archivo sin la línea `Built from commit:` se rechazaba de rebote. No se repuso
esa validación —implicaría volver a leer justo la línea que causó este hallazgo—, pero sí un piso
que no depende de ella: el reporte y el grafo tienen que existir, ser archivos regulares dentro del
proyecto y **no estar vacíos**. Un `--report` de cero bytes ahora sale exit `1` en vez de sellarse
en verde. Lo que **sigue sin probarse** es que el archivo sea un reporte de Graphify:
`record --report NOTES.md` con contenido cualquiera se registra igual, y eso es error de operador
revisable —el manifest guarda la ruta—, no un backup falso.

### Defecto colateral encontrado atacando el arreglo: pérdida silenciosa de datos en `record`

**Encontrado**: 2026-08-28, atacando el propio gate con el CLI real. **Preexistente**, no
introducido por el cambio del sello. **Estado**: **HECHO** — mismo T10.

`record` escribía el manifest con `writeFileSync` sobre cualquier ruta que pasara
`writableProjectFile`, y esa función sólo comprobaba que fuera un archivo regular dentro del
proyecto. Cinco combinaciones de banderas **destruían un archivo y devolvían `OK` con exit 0**,
todas reproducidas:

| Bandera | Antes | Ahora |
|---|---|---|
| `--manifest` = `--graph` | grafo sobrescrito por el receipt, `OK` exit 0 | `REJECTED`, grafo intacto byte a byte |
| `--manifest` = `--report` | reporte sobrescrito, `OK` exit 0 | `REJECTED`, reporte intacto |
| `--manifest ./g/graph.json` (mismo archivo, otra escritura) | idem: una comparación de strings crudos no lo veía | `REJECTED` — se comparan rutas resueltas por `realpath` |
| `--manifest README.md` (archivo cualquiera del proyecto) | README sobrescrito, `OK` exit 0 | `REJECTED`, README intacto |
| `--report` vacío (0 bytes) | sellado en verde | `REJECTED` |

La regla que ahora se aplica es la que el propio test del archivo ya declaraba en un comentario
—«an existing regular manifest is the only overwrite allowed»— pero que el código nunca verificó:
si la ruta de salida ya existe, sólo se sobrescribe si es un receipt que escribió esta herramienta
(`schema: vcp.graphify-backup/v1`). Todo lo demás se rechaza **antes de escribir un solo byte**.
Re-registrar sobre un receipt anterior, que es el único overwrite legítimo, sigue funcionando.

Las pruebas verifican el **archivo**, no sólo el exit code: comparan el sha256 antes y después de
cada intento rechazado. Un gate cuyo trabajo es proteger evidencia no puede destruir evidencia por
una bandera mal tipeada, y comprobar únicamente el código de salida habría dejado pasar exactamente
ese defecto.

**Lo que NO era**: no era un backup corrupto ni desactualizado. Era un sello que quedó atrás de su
propio contenido.
