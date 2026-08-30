# VibeCodeProtocols (VCP)

VCP ayuda a una IA a cambiar código sin inventar que revisó, probó o entendió algo.

En una frase:

```text
entender -> decidir -> test rojo -> cambio chico -> casos borde -> revisión -> evidencia -> release
```

Es un protocolo autocontenido: instala un runtime local con documentación, templates y gates
ejecutables. No necesita descargar otros skills ni conectar servicios externos para aplicar su
flujo base.

## Para qué sirve

VCP organiza el trabajo de Claude Code, Codex u otro agente que pueda leer Markdown y ejecutar
Git, Node, Bash o PowerShell. Sirve para:

- evitar el patrón "código primero, tests después";
- separar planificación, implementación, revisión y publicación;
- retomar una feature sin confundirla con una sesión anterior;
- registrar decisiones, deuda, lecciones y handoffs en `.vibe/`;
- frenar un release cuando cambió el árbol, el plan se pisa, falta evidencia o aparece un riesgo
  básico de seguridad.

VCP no promete que un test verde vuelva bueno al producto. Obliga a distinguir lo que se ejecutó
de lo que todavía requiere revisión humana.

## Instalación

Desde el clone de VCP, elegí el proyecto donde querés trabajar:

```bash
./scripts/install.sh --project /ruta/a/mi-proyecto
```

En Windows PowerShell:

```powershell
.\scripts\install.ps1 -ProjectDir C:\ruta\a\mi-proyecto
```

La instalación deja el runtime completo dentro del proyecto:

```text
<proyecto>/.vibe/vcp-runtime/
```

Reiniciá tu agente, abrí ese proyecto y usá `/VibeCodeProtocols`. Desde entonces ejecutá los
comandos desde `.vibe/vcp-runtime/scripts/`, no desde el clone original de VCP.


## Diccionario: qué significa cada palabra rara

Este documento usa unos pocos términos técnicos. Acá está qué quiere decir cada uno, en
castellano común. Si alguno aparece más abajo sin explicación, es un error de este README.

| Palabra | Qué significa acá |
|---|---|
| **gate** | Un chequeo automático que deja pasar o frena. Es un programa que responde sí o no, no una opinión. Si frena, dice exactamente qué encontró. |
| **verde / rojo** | Verde = el chequeo pasó. Rojo = frenó. Vienen de los colores de los tableros de pruebas. |
| **verde vacío** | Un chequeo que pasó **sin haber comparado nada** — porque el archivo que tenía que mirar no existía. No es lo mismo que "revisé y está bien". Por eso VCP lo escribe distinto: `VACÍO:` en vez de `OK:`. |
| **hash** | Una huella del contenido de un archivo: un número largo que cambia si cambia un solo carácter. Sirve para detectar que algo se tocó. |
| **cadena de hashes** | Cada línea guarda la huella de la anterior. Editar una línea vieja rompe todas las que siguen, así que la edición se nota. |
| **receipt** (recibo) | El archivo donde queda escrito qué se verificó, con qué comando y qué dio. Es evidencia para que otro la revise, no una prueba criptográfica. |
| **runtime** | La copia de VCP que se instala **dentro** de tu proyecto, en `.vibe/vcp-runtime/`. Es la herramienta, no tu código. |
| **baseline** (línea base) | La lista de hallazgos de seguridad que ya se revisaron y se aceptaron a propósito, para que el chequeo no vuelva a frenar por ellos. |
| **manifest** (inventario) | Una lista que dice qué archivos entran y cuáles quedan afuera, **con el motivo escrito** de cada exclusión. |
| **scope** (alcance) | Qué archivos declaró una tarea que iba a tocar. Después se compara contra lo que realmente tocó. |
| **slug** | El nombre corto de una feature, en minúsculas y con guiones: `integridad-verificable`. Sirve como nombre de carpeta. |
| **packet** | El paquete de evidencia que junta la investigación previa: de dónde salió cada dato y qué respalda. |
| **RED / GREEN** | RED = escribir la prueba primero y verla fallar de verdad. GREEN = recién ahí escribir el código que la hace pasar. Si nunca se vio fallar, la prueba puede no estar probando nada. |
| **cobertura** | Qué porcentaje del código ejecutaron las pruebas. 100 % no significa "sin errores": significa que ninguna línea quedó sin correr ni una sola vez. |
| **límite honesto** | Una frase escrita a propósito que dice **qué NO detecta** un chequeo. VCP las guarda como datos revisables en `contracts/honest-limits.json`, para que nadie las borre sin que se note. |
| **idempotente** | Que se puede correr muchas veces y el resultado es el mismo que correrlo una. El instalador lo es: no duplica nada. |

Una aclaración que vale para todo VCP: **los chequeos prueban forma, cadena y estado, nunca
verdad.** Pueden decirte que una decisión quedó registrada de forma coherente; no pueden decirte
que sea la decisión correcta, ni que la persona la haya entendido.
## El flujo, simple

| Fase | Pregunta que responde | Resultado necesario |
|---|---|---|
| 0. Bootstrap | ¿Qué proyecto y feature son ésta? | Contexto, estado y feature activa claros |
| 1. Spec | ¿Qué problema resolvemos y qué no? | Criterios de aceptación y límites |
| 2. Plan | ¿Qué se toca y en qué orden? | Tareas sin escritores en conflicto |
| 3. Build | ¿La conducta está probada antes de cambiarla? | RED -> GREEN -> TRIANGULATE -> REFACTOR |
| 4. Final | ¿La evidencia coincide con lo que se libera? | Suite, seguridad, revisión, receipt y backup |

Cuando una decisión cambia alcance, costo, riesgo o publicación, VCP muestra opciones 🔵. El
agente recomienda una, explica el motivo y espera la decisión humana; no elige por silencio.

## Research: investigar antes de especificar

Para un cambio que no sea claramente trivial, VCP no empieza escribiendo código ni una spec a
ciegas. Primero hace una pasada de **Discovery**. Su salida es la evidencia que alimenta la spec;
no es un reporte decorativo al final.

1. **Research trazable:** fuentes, versión/fecha, límites de lectura y claims que sí o no sostienen
   una decisión.
2. **Diagnóstico CAIO:** qué proceso está roto, dónde se pierde información, qué trabajo se repite
   y qué bucle queda abierto.
3. **Mapa de bucle:** entrada, medida, responsable de decidir, acción, control y aprendizaje; se
   compara el flujo actual con el flujo objetivo.
4. **PRD y planes:** problema, usuarios, resultado operativo, dependencias, implementación,
   adopción y recurrencia del primer bucle a cerrar.

Cada decisión se guarda como JSON inmutable bajo
`docs/discovery/<feature>/runs/run-NNN/{decisions,packets}/`. Un packet completed conserva su
snapshot de research y hash; la validación nunca relee un ledger mutable para reinterpretar la
historia. Las vistas Markdown bajo `docs/discovery/<feature>/views/` son derivadas, no fuente de
verdad: se regeneran y se comparan byte a byte.

```bash
# Verifica la cadena inmutable de decisiones y snapshots.
node .vibe/vcp-runtime/scripts/verify-discovery-core.mjs check --feature <feature-slug>

# Resuelve cada fuente citada contra el árbol: el archivo existe y su huella sigue siendo la declarada.
node .vibe/vcp-runtime/scripts/verify-discovery-core.mjs sources --feature <feature-slug>

# Ancla externa: el expediente solo crecio a lo largo de la historia de git.
node .vibe/vcp-runtime/scripts/verify-discovery-core.mjs history --feature <feature-slug>

# Genera y luego comprueba vistas reproducibles (sin timestamps ni paths del entorno).
node .vibe/vcp-runtime/scripts/verify-discovery-views.mjs render --feature <feature-slug>
node .vibe/vcp-runtime/scripts/verify-discovery-views.mjs check --feature <feature-slug>
```

Discovery puede terminar en `completed`, `skipped` u `overridden`, siempre con evidencia y motivo.
No prueba que una fuente sea suficiente semánticamente ni sustituye a quien decide el producto:
hace visible qué evidencia se usó, qué quedó fuera y qué decisión humana falta antes de pasar a
Spec.

## Uso diario

1. Elegí una sola feature y completá su spec.
2. Aprobá un plan con tareas chicas y archivos escritores declarados.
3. Para cada tarea: reproducí RED, implementá GREEN, buscá un caso borde y recién después
   refactorizá.
4. Cerrá con los gates de release y un backup posterior al commit.

Ejemplo mínimo desde un proyecto ya instalado:

```bash
# Antes de construir: evita que dos tareas escriban lo mismo sin dependencia declarada.
node .vibe/vcp-runtime/scripts/verify-plan-conflicts.mjs check docs/tasks.json

# Después de GREEN: el diff real debe coincidir con los writers de la tarea.
# Elegí una base explícita (por ejemplo origin/main) y declarà sólo artefactos operativos
# que no son parte del cambio, uno por --ignore.
node .vibe/vcp-runtime/scripts/verify-scope-diff.mjs check \
  --tasks docs/tasks.json --task T01 --base origin/main \
  --ignore docs/tasks.json

# RED estricto para un test Node nativo.
.vibe/vcp-runtime/scripts/verify-red.sh test/auth.test.mjs "node --test"

# Antes de publicar: escanea el delta real contra la base elegida.
node .vibe/vcp-runtime/scripts/verify-security-baseline.mjs check --base origin/main

# Después del commit: genera y registra el backup local revisado.
graphify update .
graphify export obsidian --dir graphify-out/obsidian
node .vibe/vcp-runtime/scripts/verify-backup-state.mjs record \
  --report graphify-out/GRAPH_REPORT.md --graph graphify-out/graph.json \
  --manifest graphify-out/backup-state.json
node .vibe/vcp-runtime/scripts/verify-backup-state.mjs check graphify-out/backup-state.json
node .vibe/vcp-runtime/scripts/verify-graphify-manifest.mjs check
```

Antes del primer receipt, reemplazá el placeholder de feature en `.vibe/SESSION.md` por el slug
real. VCP no lo inventa porque una feature falsa vuelve inútil la trazabilidad.

`verify-scope-diff.mjs` compara los tres campos escritores de la tarea (`files_to_create`,
`files_to_modify`, `test_files`) con los paths trackeados y untracked que Git observa desde la
base elegida. Exit `1` si falta un writer, aparece un archivo extra o el plan es inseguro.
`--ignore` es obligatorio y explícito para cada artefacto operativo que deba quedar fuera; no hay
una exclusión global de `.vibe/`. Corré este gate después de GREEN y otra vez antes del receipt si
el working tree cambió.

## Los gates mecánicos

| Gate | Qué comprueba | Límite importante |
|---|---|---|
| `verify-red-node.mjs` | Un `node:test` produjo evidencia TAP de fallo con forma de assertion. | Sólo cubre Node nativo y no demuestra intención ni calidad del test. |
| `verify-plan-conflicts.mjs` | Dos tareas no escriben el mismo archivo sin un orden explícito. | No reemplaza una revisión del diseño. **Compara sólo lo declarado: una escritura no declarada es invisible** — cruza los tres campos escritores de cada tarea entre sí, nunca contra lo que el código termina tocando. |
| `verify-receipt.mjs` | El árbol Git, modos, binarios y archivos no trackeados siguen siendo los revisados. `custody <receipt.json>` informa además si el commit que lleva el recibo está firmado y con qué clave; una firma rota siempre rechaza, y no firmar rechaza sólo con `--require-signature`. | Un receipt es evidencia local, no una firma de procedencia. La custodia mejora pero no se cierra: **si el agente puede correr `git commit -S`, firma como vos** — prueba que alguien con acceso a la clave firmó, no quién. Vale hasta donde tu clave exija presencia humana. |
| `verify-security-baseline.mjs` | El delta no contiene secretos conocidos, rutas sensibles, ejecución dinámica, patrones SQL/HTML riesgosos ni configuraciones GitHub Actions básicas peligrosas. | Es un piso nativo de patrones; no es SAST, SCA, taint analysis ni una base de CVEs. |
| `verify-vcp-coverage.mjs` | Cada script Node inventariado mantiene 100% de líneas, ramas y funciones. | Bash y PowerShell tienen pruebas funcionales de paridad, no cobertura por instrumentación Node. |
| `verify-backup-state.mjs` | El reporte Graphify y el grafo siguen byte a byte como se registraron, y el HEAD sobre el que se los registró sigue siendo el HEAD actual. `record` sella el HEAD real (`git rev-parse`), no el commit que el reporte declara: Graphify sólo reescribe `GRAPH_REPORT.md` cuando cambia la topología del código, así que un commit de sólo documentación dejaba ese sello atrasado para siempre. El orden es commit → graphify → record → check. | Prueba integridad desde el registro, no que el grafo se haya construido en ese commit ni que lo describa. Que el grafo cubra los archivos del commit actual lo prueba `verify-graphify-manifest.mjs` contra `git ls-files`; acá un grafo de otro proyecto se registra igual de verde. |
| `verify-graphify-manifest.mjs` | Cada archivo rastreado está indexado o excluido con razón declarada, y el manifest no conserva entradas que Git ya no rastrea. | Prueba contabilidad, no comprensión: un archivo indexado puede haber producido cero nodos. |
| `verify-vcp-contract.mjs` (límites honestos) | Cada frase declarada en `contracts/honest-limits.json` sigue textual en su archivo. Cada límite lleva un `why` que dice qué garantía se pierde si desaparece, y el rechazo lo imprime. | Verifica que la frase esté, no que el párrafo que la rodea siga siendo cierto. Un límite que nadie declaró en el contrato tampoco se protege. |
| `verify-receipt.mjs commit` | Valida el receipt, commitea y confirma después que el árbol commiteado es el índice validado. Nunca reescribe historial por su cuenta ni saltea los hooks del operador. | La ventana entre validar y escribir pasa de minutos a milisegundos, no desaparece. La confirmación prueba que el commit contiene el índice revisado; no prueba que no hubo una escritura concurrente. |
| `verify-security-baseline.mjs --baseline` | Distingue deuda ya revisada de un hallazgo nuevo: lo aceptado no bloquea, lo nuevo sí, y una entrada que ya no corresponde a ningún hallazgo real también bloquea. Cada entrada lleva motivo, responsable y fecha. | Aceptar un hallazgo de secreto cubre el archivo y la categoría, no un valor concreto: si se reemplaza por otro secreto en el mismo archivo, sigue aceptado. Una entrada cuyo archivo quedó fuera del delta no se puede juzgar y no caduca. |
| `verify-audit-chain.mjs` | Cada línea de `.vibe/AUDIT.md` lleva el hash de la anterior: editar una línea vieja rompe la cadena y el gate nombra la línea exacta. `append` sella y se niega a escribir sobre una traza ya rota. | **Modelo de amenaza, explícito:** `check` detecta la edición y el borrado **parcial** dentro del archivo. Recortar las últimas líneas o recalcular la cadena entera sobre contenido falso sí pasan `check` — y los agarra `history`, que compara contra **la propia historia de git**: una traza sólo crece, así que cada versión commiteada tiene que empezar con la anterior. Ese es el ancla externa, y no pide infraestructura ninguna. Lo que queda afuera: quien **reescriba la historia publicada** puede fabricar una secuencia coherente; eso ya no es editar un archivo, cambia el identificador de cada commit y lo ve cualquiera con un clon previo. |
| `verify-runtime-sync.mjs check` | El runtime instalado en `.vibe/vcp-runtime/` es, byte a byte, la superficie que copia el instalador desde este checkout: nombra los archivos que difieren, los que faltan y los que sobran (un gate borrado arriba que el proyecto sigue ejecutando). Sin runtime instalado sale `0`: un checkout fuente limpio es normal. | Detecta que la copia difiere, no que la copia sea correcta ni que el fuente lo sea: dos copias idénticas de un gate roto pasan igual. Compara contenido, no permisos —el `+x` que el instalador pone sobre `scripts/*.sh` no se verifica— y sólo puede hablar donde el checkout fuente y el runtime conviven en la misma máquina. |
| `verify-session-state.mjs check` | `.vibe/SESSION.md` sigue siendo retomable: ningún problema acumula tres intentos fallidos sin una decisión humana registrada, una interrupción declarada dice dónde retomar (`Fase`, `Tarea`, `Falta`), y toda comprobación que no se pudo hacer figura en `## No verificado` con la marca literal y su motivo. Las tres secciones son opcionales; sin ellas sale `0`. Sin `SESSION.md` escribe `VACÍO:` en vez de `OK:`, y con `--require-inputs` ese vacío pasa a rechazo. | Verifica que lo declarado sea coherente, no que sea verdad: una sesión que miente en su propio archivo pasa el gate. Tampoco mide cuota ni ejecuta red —no hay presupuestos ni topes por fase, a propósito— y sólo ve las tres secciones: un éxito afirmado en la prosa del resto del archivo le es invisible. |
| `verify-phase-decisions.mjs check` | Ninguna fase cierra sin una elección registrada: una decisión por fase en `docs/phase-decisions.json`, en el orden que declara el propio `phase_order` del archivo (sin saltos hacia atrás y sin fases omitidas antes de una que ya cerró), con el menú completo que se mostró, una recomendación, una opción elegida **que estaba en ese menú**, su justificación, y una cadena de hashes con el mismo criterio que `verify-audit-chain.mjs`. Agregar una opción al menú después de elegir rompe el hash de esa decisión y la cadena hacia adelante. Una decisión reemplazada se marca `superseded` y no se borra. Sin archivo escribe `VACÍO:` en vez de `OK:` y sale `0`; con `--require-inputs` ese vacío pasa a rechazo. | Demuestra que la decisión quedó registrada de forma coherente. No demuestra que la persona realmente haya querido esa opción ni que haya comprendido sus consecuencias — sí detecta el caso concreto de un agente que fabrica el menú y la elección en el mismo aliento, exigiendo un piso de dos segundos entre `shown_at` y `timestamp`. **Un agente que espera igual pasa: detecta lo imposible, no lo mentiroso**: un agente puede registrar decisiones que nadie tomó y el gate las acepta. Hereda los límites de la cadena de auditoría —recortar las últimas decisiones, reescribir la última (que es la cabeza de la cadena) o recalcular la cadena entera sobre contenido falso pasan en verde—, y `phase_order` no está encadenado: agregar una fase futura al final es indetectable. |
| `verify-empty-probe.mjs check` | Corre cada gate en una carpeta vacía y compara lo que dice contra lo que declara `contracts/empty-probe.json`. Un gate que escribe `OK:` ahí está afirmando haber verificado algo cuando no había nada que verificar. Cinco comportamientos posibles: `reject`, `usage`, `empty` (sale 0 y escribe `VACÍO:`), `self` (mira el propio checkout de VCP, no el proyecto) y `skip`; los dos últimos exigen motivo escrito. Un script `.mjs` de `scripts/` que no figure en el contrato es rechazo: agregar un gate obliga a declarar su comportamiento sin entradas. | Prueba **una sola** invocación por gate, la que declara el contrato: un subcomando distinto puede tener su propio verde vacío y la sonda no lo ve. Sólo prueba el caso extremo de la carpeta vacía, no un proyecto a medio llenar. Y `self` es una declaración humana, no una comprobación: escrita sobre un gate que sí mira el proyecto, el verde vacío vuelve a pasar. |
| `verify-shell-coverage.mjs check` | Cuánto de cada script de shell llegan a ejecutar los escenarios declarados en `contracts/shell-coverage.json`. Se mide con el instrumento que trae el propio bash: `PS4` con `$LINENO` más `set -x`, sin dependencias. Rechaza si un script cae por debajo del piso declarado, y nombra las líneas que no se ejecutaron. Un script sin escenarios exige motivo escrito y se cuenta en la salida. | **Mide líneas ejecutadas, no ramas**: una línea `if` cuenta como cubierta apenas se evalúa, aunque su `else` no se haya probado nunca. Mide los escenarios declarados, así que un camino que nadie escribió no aparece: el número dice cuánto ejercitan esos escenarios, nunca cuánto del script es correcto. No mide PowerShell: `Set-PSDebug -Trace` no da número de línea de forma portable, así que ese lenguaje queda **declarado sin medición**, no medido en cero. |
| `verify-evidence-trace.mjs` | `criteria`: cada `AC<n>` de `docs/spec.md` está nombrado por al menos una prueba real —el id como segmento separado por `·` de una llamada `test()`/`it()`, la misma convención que ya fija `verify-test-bindings.mjs`—. `claims`: cada `linked_requirement_id` y `linked_ac_id` del packet de la decisión Discovery vigente resuelve contra un identificador que la spec declara. | Para un criterio verifica que exista una prueba que lo nombre, no que esa prueba lo compruebe: es trazabilidad, no suficiencia. Un id en un comentario no cuenta, pero un título que lo nombra y no lo prueba sí. Sin spec, sin criterios declarados o sin Discovery escribe `VACÍO:` en vez de `OK:` y sale `0`; con `--require-inputs` ese vacío pasa a rechazo, que es como lo corre la Fase 4. |
| `verify-research-citations.mjs check` | Cada cita `archivo:línea` del informe de research externo figura en `contracts/research-citations.json` con el resultado de haberla resuelto contra su commit pineado, y al revés: un registro que ya no corresponde a ninguna cita del informe también frena. Una cita resuelta trae repo, ruta y el sha256 del contenido citado; una que no resolvió trae su motivo escrito. Si el contrato declara el barrido mecánico, cada sonda muestra el patrón con que buscó —que tiene que compilar—, la hipótesis que pone a prueba y conteos posibles. Agregar una cita al informe sin revalidarla rechaza. | **Compara el informe contra el registro de la revalidación, no contra los repositorios**: los clones pesan más de un giga, no están en el árbol y el gate no sale a la red, así que un contrato escrito a mano con huellas inventadas pasa igual —el ancla contra eso es que el contrato se commitea y la cadena de auditoría lo cubre—. Y **una cita resuelta dice que el archivo y la línea existen, no que digan lo que el informe afirma sobre ellos**: juzgar eso es leer, no comparar. Sobre el barrido, lo mismo en otra forma: **barrer no es leer**, cada sonda es una expresión regular y un cero significa que el patrón no encontró nada, no que no esté. |
| `verify-design-tokens.mjs check` | Cada superficie visual declarada en `contracts/design-tokens.json` mantiene su sistema de tokens entero: todo token declarado existe en el bloque claro, ninguno vive **sólo** en un bloque oscuro, los dos bloques oscuros —el de preferencia del sistema y el estampado— coinciden token por token, cada superficie trae su color de texto emparejado (`X` con `X-foreground`, la convención de shadcn/ui), ningún color literal queda fuera del sistema, el `body` fija su fondo desde un token, todo `font-size` sale de una rampa declarada y todo espaciado de un ritmo declarado, y no aparece ninguna de las firmas de diseño genérico que el contrato lista. | **Verifica forma y coherencia, nunca contraste ni legibilidad**: dos tokens que cumplen todas las reglas pueden ser gris sobre gris. Lee el CSS con expresiones regulares, no con un parser, así que un token dentro de una at-rule que no conoce o un archivo minificado le son invisibles —falla cerrado: lo invisible se reporta faltante, nunca presente—. Y sólo ve colores en hexadecimal o notación funcional: un `red` escrito con su nombre pasa, porque distinguirlo de `inherit` sin un parser da falsos positivos. Sobre lo genérico es más modesto todavía: **detecta la firma declarada, no juzga si un diseño es bueno.** Un diseño feo y original pasa; uno excelente que use una cara de la lista, no. |
| `verify-discovery-core.mjs` | La cadena inmutable de decisiones de la investigación: cada una en orden, con su paquete de evidencia congelado y su hash, y cada locator con forma válida —https sin credenciales, o ruta relativa que no escapa del proyecto—. | **Nunca abre la fuente citada ni comprueba que el locator exista.** Valida la forma del string, no lo que hay del otro lado: no resuelve la URL, no lee el archivo, no comprueba que la línea exista, y el sha256 de `content_identity` no se compara nunca contra contenido real. Un run entero de fuentes inventadas pasa en verde. Para eso está el subcomando aparte `sources`, que sí las resuelve contra el árbol —ver la fila siguiente—. Y sus hashes se calculan sobre archivos del mismo árbol, así que **`check` detecta una edición parcial, no una reescritura completa del run**: para eso está `history`, que compara contra la historia de git. |
| `verify-discovery-core.mjs sources` | Resuelve contra el árbol real cada fuente que los claims vigentes citan: el archivo existe, la línea citada cae dentro de él, y su sha256 sigue siendo el declarado. Un claim que cita un archivo inexistente **frena**. Una fuente que existe pero cambió desde la captura se informa como derivada y no bloquea, porque envejecer no es mentir; con `--require-current` también frena. **La deriva dice que la fuente se movió, no si el claim sigue siendo cierto.** | **No sale a la red: una fuente web se cuenta como no verificable, nunca como verificada.** Y comprueba el contenido de hoy, no el del día de la captura: no puede probar que la huella fuera correcta cuando se registró, sólo que el archivo actual la cumple o no. |
| `verify-discovery-core.mjs history` | El expediente **sólo creció**: ninguna decisión ni packet ya commiteado fue modificado o borrado en ninguna versión posterior. Es el ancla externa que le faltaba a la cadena — los hashes internos se calculan sobre archivos del mismo árbol que protegen, así que quien reescriba el run entero los recalcula y `check` sale verde; git no. Las vistas quedan afuera a propósito: son derivadas y cambiar es su trabajo. | **Quien reescriba la historia publicada puede fabricar una secuencia coherente**, igual que en la cadena de auditoría. Pero eso ya no es editar un archivo: cambia el identificador de cada commit y lo ve cualquiera con un clon previo. Y si el expediente nunca se commiteó, no hay ancla: eso se reporta como rechazo, no como verde. |
| `verify-scope-diff.mjs` | Los tres campos escritores de la tarea contra el delta real de Git desde una base explícita, incluidos los archivos sin versionar. | **No ve los archivos que Git ignora: escribir ahí pasa en verde.** Enumera con `--exclude-standard`, así que todo lo que cubra el `.gitignore` queda fuera del alcance verificado. |
| `verify-test-bindings.mjs` | Cada requisito activo tiene una prueba real: archivo local del proyecto, corrida en aislamiento, resultado leído del formato de salida exacto. | **No compara la prueba con la regla: un cuerpo vacío pasa verde.** Prueba que existe una prueba con ese título, que corre sola y que sale ok; nada obliga a que verifique lo que el requisito dice. |
| `verify-handoff-report.mjs` | Cada entrega entre roles declara explícitamente qué NO revisó su autor, para que una revisión acotada no se lea como completa. | **No bloquea placeholders en castellano: `ninguno` y `nada` pasan igual.** La lista de rellenos prohibidos son literales en inglés (`n/a`, `unknown`, `nothing`), así que el equivalente en castellano satisface el gate sin declarar nada. |

El hook opcional `pretooluse-red.mjs` agrega fricción a `Write` y `Edit`: exige receipts
consistentes, tests reales hasheados y TTL válido. No es un sandbox ni un límite de confianza:
Bash, PowerShell y cualquier proceso que pueda escribir en el mismo filesystem pueden eludirlo.
VCP documenta ese límite para que la revisión humana no confunda fricción con una garantía.

## Seguridad nativa y límites

VCP trata todo texto generado por IA, los archivos del repositorio y la salida de herramientas
como datos no confiables. Sus gates fallan cerrados cuando no pueden inspeccionar con seguridad un
path, un link o una entrada crítica.

No instala dependencias de seguridad, no envía el código a servicios externos y no afirma detectar
todas las vulnerabilidades. Para una amenaza real, combiná este piso con revisión humana y los
controles que correspondan a tu proyecto.

Leé el [Modelo de seguridad y límites](SECURITY.md) antes de usar VCP en un entorno sensible.

## Memoria durable

`.vibe/` no es un log gigante. Cada archivo tiene un trabajo concreto:

```text
PROJECT.md    contexto estable del proyecto
SESSION.md    punto exacto para retomar la feature activa
DECISIONS.md  decisiones y motivos
PATTERNS.md   prácticas que funcionaron
DEBT.md       deuda aceptada explícitamente
LESSONS.md    aprendizajes confirmados
AUDIT.md      trail de gates y decisiones
handoffs/     qué revisó cada rol y qué no revisó
receipts/     evidencia local de release
vcp-runtime/  scripts, templates y skills instalados
```

## Verificar el propio VCP

Antes de publicar cambios en este repositorio corré:

```bash
node --test --test-concurrency=32
node scripts/verify-vcp-coverage.mjs
node scripts/verify-vcp-contract.mjs check
node scripts/verify-security-baseline.mjs check --base origin/main
git diff --check
```

El segundo comando exige 100% de líneas, ramas y funciones para los scripts Node de VCP. No
llames "100%" a una parte no instrumentada: los scripts Bash y PowerShell se validan con sus
fixtures funcionales específicos.

Para crear un paquete distribuible:

```bash
./scripts/build-zip.sh
```

El empaquetador usa una allowlist, rechaza paths inseguros y genera el SHA-256 del ZIP. Nunca
incluye `.git`, `.env`, `node_modules` ni backups locales.

## Documentación

- [Instalación](INSTALL.md)
- [Contrato completo del agente](SKILL.md)
- [Templates de spec y plan](skills/spec-plan-templates.md)
- [Memoria y lecciones](skills/vibe-memory.md)
- [Gate nativo de seguridad](skills/security-baseline.md)
- [Modelo de seguridad y límites](SECURITY.md)
- [Research y decisiones](research/)

VCP busca que el agente haga menos teatro y deje más evidencia útil.
