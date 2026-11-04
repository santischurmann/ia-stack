## PHASE 1 — BOOTSTRAP

1. **Contrato de orquestación activo** (§ CONTRATO INTERNO DE ORQUESTACIÓN, arriba, siempre). Se
   usan los papeles, gates y reglas de evidencia nativos de IA Stack. **No se invoca ni se exige otra
   skill** para ensanchar, reemplazar o autorizar una fase.
1b. **Runtime sync check — antes de correr cualquier otro gate.** Todo lo que sigue se ejecuta desde
   `.vibe/ia-stack-runtime/`, una copia que `install.sh` dejó una vez y que envejece sola. Correr el
   protocolo entero contra gates viejos invalida todo lo demás, así que esto va primero. Se corre
   **desde el checkout fuente de IA Stack**, nunca desde el runtime (compararlo consigo
   mismo siempre da verde y no prueba nada):
   ```bash
   # parado en el checkout fuente de IA Stack
   node scripts/verify-runtime-sync.mjs check --runtime <project-root>/.vibe/ia-stack-runtime
   ```
   Exit `0` con `no runtime installed` (checkout limpio) o con `matches this source checkout` → seguir.
   Exit `1` → **reinstalar antes de continuar**: `bash scripts/install.sh --project <project-root>`
   (PowerShell: `scripts/install.ps1 -ProjectDir <project-root>`), y volver a correr el gate.
   Si el checkout fuente no está en esta máquina, decirlo en el reporte del paso 7: el gate no se
   pudo correr y la frescura del runtime queda sin verificar — no lo reportes como verde.
   El gate detecta que la copia difiere, no que la copia sea correcta ni que el fuente lo sea: dos
   copias idénticas de un gate roto pasan igual. Compara contenido, no permisos.
1c. **Lo que se hace cada 7 días — se pregunta ACÁ, que es donde la sesión abre.** Tres cosas del
   protocolo tienen período propio, y cada una sabe sola si le toca. Los tres comandos son de
   lectura, no escriben nada, y salen `0` incluso cuando no toca:
   ```bash
   node .vibe/ia-stack-runtime/scripts/tablero.mjs due
   node .vibe/ia-stack-runtime/scripts/verify-sereno.mjs due
   node .vibe/ia-stack-runtime/scripts/verify-ablation.mjs due docs/ablation.json
   ```
   El que diga `TOCA:` se atiende en su fase —el tablero y el bucle en la 9.0 y 9.0.1, la limpieza
   en el resto de la fase 9— y el que diga `OK:` o `VACÍO:` se deja pasar sin más. **Preguntar acá
   es la única forma de que el período se cumpla:** hasta el 2026-09-05 los tres vivían sólo en la
   fase 9, que es la última, y un agente que hace una tarea normal nunca llega ahí. La instrucción
   decía «al abrir sesión» y estaba escrita en el cierre. Una prueba lo fija: si mañana se agrega un
   cuarto chequeo de período y no se nombra acá, la suite se pone roja.

2. Detect stack: `ls package.json pyproject.toml go.mod Cargo.toml pom.xml 2>/dev/null`.
3. Leer `.vibe/PROJECT.md`, `SESSION.md`, `DECISIONS.md`, `RETRO.md` (últimas 2 entradas) y `LESSONS.md` (entradas `status: active`), si existen. El protocolo completo de lecciones —confirmación, dedup, retiro, decaimiento y recall al tocar— está en `skills/vibe-memory.md` § LESSONS PROTOCOL.
4. **Engram recall (opcional, best-effort, nunca bloqueante)** — buscá `mem_context`/`mem_search` en tu tool list (directas o diferidas). Si aparecen: `ToolSearch` para cargarlas, `mem_context` con el proyecto actual, ojeá 1-2 hits de `mem_search("vcp/<project>/<feature-slug>/gate-state")`. Si no aparecen: seguir sin más, sin reintento — pero SÍ mencionarlo en el paso 7. Esto es color adicional, **nunca** reemplaza el re-detect por evidencia del paso 5.
5. **Identidad al retomar, y comprobación por evidencia** — si `SESSION.md` muestra un gate sin terminar, o `tasks.json` tiene una tarea que no está `done`, **no se vuelve a empezar por SPEC**. Antes de leer el checkpoint se establece el `<feature-slug>` pedido: un nombre corto, en minúsculas y con guiones, de la funcionalidad que se pidió de verdad. Si el pedido abarca varias funcionalidades plausibles, **no se inventa una**: se le pide a la persona que la nombre.

   Run the mechanical identity gate first:
   ```bash
   node .vibe/ia-stack-runtime/scripts/verify-resume-state.mjs check --session .vibe/SESSION.md --feature <feature-slug>
   ```
   Compara el slug declarado en `SESSION.md` contra el que se le pasa, y nada más.
   **No verifica de dónde salió el slug pedido: el agente lo elige.** Un agente que pide el slug
   del checkpoint viejo retoma esa sesión con el gate en verde.

   Y corré el gate que compara los documentos entre sí, que es la otra mitad:
   ```bash
   node .vibe/ia-stack-runtime/scripts/verify-feature-activa.mjs check
   ```
   `docs/spec.md` y `.vibe/SESSION.md` tienen que nombrar la **misma** feature. Con menos de dos
   declarantes escribe `VACÍO:` y sale `0`: no hay dos nombres que comparar. **Detecta el desacuerdo,
   no lo resuelve** — cuál de los dos tiene razón lo decidís vos. Medido en el propio repositorio de
   IA Stack el 2026-09-04: los documentos daban tres respuestas distintas a «¿en qué estamos trabajando?»
   y nada las comparaba.

   Salir con `0` es el **único** resultado de identidad que permite retomar. Recién ahí se
   re-detecta la fase **por evidencia**: se corren las pruebas de esa tarea (si fallan, es antes del
   GREEN; si pasan, después), y se mira el `git diff` de los archivos de prueba — si cambiaron desde
   el RED, eso es una violación y se para. **Nunca se confía en la memoria.**

   Salir con `1` significa **nunca retomar en silencio**: se muestra el menú que corresponda, se
   espera la respuesta, se hace únicamente el cambio aprobado, y se vuelve a correr el gate antes de
   retomar nada.

🔵 **`SESSION.md` es de otra funcionalidad**

- **A)** Archivar la sesión existente y arrancar una limpia para `<feature-slug pedido>` — *(recomendado)*
- **B)** Seguir con la funcionalidad declarada, conservando su slug y su alcance
- **C)** Re-etiquetar, sólo si de verdad es el mismo trabajo con la funcionalidad renombrada, dejando el motivo escrito en `DECISIONS.md`
- **D)** Parar y revisar el estado

Esperando tu respuesta antes de continuar.

🔵 **`SESSION.md` no tiene una identidad de funcionalidad válida** (estado heredado o mal formado)

- **A)** Revisarlo, asignarle explícitamente su slug real y volver a correr el gate — *(recomendado)*
- **B)** Archivarlo y arrancar una sesión limpia para `<feature-slug pedido>`
- **C)** Parar y revisar el estado

Esperando tu respuesta antes de continuar.
   Do not archive, retag, or choose an option on the user's behalf. If there is no resumable state, write `**Feature slug:** <feature-slug>` in `SESSION.md` before the first gate. Full evidence protocol: `skills/caveman-tdd.md` § RESUME.
5b. **Estado retomable** — la identidad dice de quién es el checkpoint; esto dice si sirve para
   retomar. Se corre después del gate de identidad y antes de re-detectar la fase:
   ```bash
   node .vibe/ia-stack-runtime/scripts/verify-session-state.mjs check --session .vibe/SESSION.md
   ```
   Exit `0` → seguir. Exit `1` → resolver antes de retomar: **tres intentos fallidos sobre el mismo
   problema** sin decisión humana registrada, una interrupción que no dice dónde retomar
   (`Fase`/`Tarea`/`Falta`), o una comprobación afirmada dentro de `## No verificado` sin evidencia.
   Las tres secciones son opcionales y aparecen sólo cuando aplican: un `SESSION.md` sin ninguna es
   un estado normal, y sin `SESSION.md` sale `0` —un proyecto que todavía no arrancó no incumple
   nada—. Formato y ejemplos: `templates/vibe/SESSION.md`.
   Cuando la sesión se corta —cuota agotada, caída, lo que sea— lo que se escribe es
   `## Interrumpido en` con esos tres campos, para retomar sin reconstruir el estado leyendo el
   diff. **No hay presupuestos ni topes por fase**: el gate registra y verifica estado, no mide
   consumo ni corta trabajo (un tope mal calibrado frena trabajo legítimo y no hay datos históricos
   para calibrarlo). Y toda comprobación que no se pudo hacer —`git fetch` con timeout, un comando
   ausente, el checkout fuente en otra máquina— va a `## No verificado` con la marca literal y su
   motivo: un fallo silencioso no puede quedar leyéndose como un éxito.
   El gate verifica que lo declarado sea coherente, no que sea verdad. Una sesión que miente en su
   propio archivo pasa, y una que no declara nada también: el silencio compra verde, no un rechazo.
6. No `.vibe/` → create from `templates/vibe/` (incl. `COMPANY.md` org-chart/budget copy — fixed shape, not a scratch file — and empty `AUDIT.md`). AI-company layer detail: `skills/orchestrator-opus.md` § AI COMPANY LAYER.
7. Report 1 line: memory loaded / new project / Engram no detectado (nunca omitir esta rama en silencio).
7b. **Nivel de rigor del proyecto** (source: `research/sources/protocolo-muralla.md` point #24) —
   una sola vez por proyecto, no por cambio, si `.vibe/PROJECT.md` todavía no lo tiene declarado.
   Complementa a `risk_level` (que es por-cambio, Phase 7.1) — este es el piso general:

🔵 **Nivel de rigor del proyecto** (una vez, se guarda en `PROJECT.md`)

- **B)** Herramienta — alguien toma una decisión con un número mal si esto falla — *(recomendado
  cuando no está claro: es el punto medio, y equivocarse para abajo cuesta más que para arriba)*
- **A)** Vidriera — si algo falla se ve feo un rato, nadie pierde nada real
- **C)** Producto con plata — alguien pierde dinero o confianza real si esto falla

Esperando tu respuesta antes de continuar.

   La rigurosidad se paga y solo se paga cuando hay algo que perder — un nivel `A` no debería
   terminar arrastrando el aparato completo de un `C` salvo que un cambio puntual lo dispare por
   `risk_level` propio (Phase 7.1, ortogonal a esto).
7c. **Producción** — una sola vez por proyecto, si el bloque `## Producción` de `.vibe/PROJECT.md`
   está vacío. Lo contesta la persona y **nunca se infiere**: un agente que escribe «en vivo: no» en un
   archivo que nadie lee es la forma más barata de romper una app que usa gente real. Con las
   respuestas se completa ese bloque, con quién lo declaró y la fecha:

🔵 **¿Tu app ya la usa gente real?**

- **A)** Sí — está publicada y la usa gente — *(recomendado si dudás: tratarla como viva de más no rompe nada, de menos sí)*
- **B)** No todavía — sólo la uso yo o todavía no está publicada

Esperando tu respuesta antes de continuar.

   Si es **A**, se pregunta además, en palabras simples y una por vez: dónde corre; qué rama, al
   recibir un push, la publica sola (en Vercel, Railway o Netlify suele ser `main`); si hay una
   copia de prueba (staging) —una segunda versión publicada donde mirar los cambios antes que la gente—; y
   si un cambio puede tocar datos reales. Lo que la persona no sepa se escribe `ninguno — no lo sé`,
   que también es una respuesta. Con la app en vivo, el trabajo nunca se hace en la rama que
   despliega (LAW 9) y un cambio de datos pide respaldo y vuelta atrás (8.0).
8. **Confirmar el stack detectado** — el paso 5 lo dedujo; una deducción no es una decisión.

🔵 **¿El stack detectado es el correcto?**

- **A)** Sí, es ése — *(recomendado si el paso 5 encontró un manifiesto y no una carpeta vacía)*
- **B)** No, es otro — [decime cuál]. Un stack mal detectado se paga en cada gate que después
  elige el runner equivocado.

Esperando tu respuesta antes de continuar.
9. **Capability matrix gate** — antes de despachar roles, verificá la matriz nativa de permisos:
   ```bash
   node .vibe/ia-stack-runtime/scripts/verify-capability-matrix.mjs check .vibe/ia-stack-runtime/contracts/capability-matrix.json
   ```
   Rechaza una matriz con roles duplicados, herramientas desconocidas, un escritor que también
   aprueba la misma superficie o un rol de sólo lectura con `Write`/`Edit`. Es un contrato de
   separación revisable, no un sandbox: una herramienta externa puede ignorarlo.
10. **SCAVENGE — mirá el código, no lo cuentes** (gate: `verify-scavenge.mjs`). Enumerá los
   archivos que hay que **entender o verificar** para decidir con seguridad (archivo a cambiar +
   sus tests, callers/callees/config o contrato directo; no sólo el tamaño del diff), registralos en
   `SESSION.md`, **y abrilos**. Lo que encontrás va a `docs/scavenge/<feature-slug>.json` desde
   `templates/scavenge.json`, con cuatro listas que responden cuatro preguntas distintas:

   - **`reusable`** — qué YA existe acá que sirva, cada uno con su `archivo:línea`. Es la única
     comprobable, y el gate **abre el archivo y verifica que esa línea exista**.
   - **`missing`** — qué falta. Sin locator a propósito: no se puede apuntar a una línea de algo
     que no está.
   - **`breaks`** — qué se va a romper. El locator es opcional: a veces se sabe qué y todavía no dónde.
   - **`unknowns`** — qué queda sin saber, **y cómo se contesta**. Una duda sin forma de resolverla
     es una duda anotada, no un plan para sacarla.

   **El tamaño lo pone el trabajo, no una regla**: `scope: corto` para un cambio chico son cinco
   líneas; `scope: completo` para algo grande es un documento. Lo que no cambia es que haya que
   mirar.

   ```bash
   node .vibe/ia-stack-runtime/scripts/verify-scavenge.mjs check docs/scavenge/<feature-slug>.json
   ```

   Sin archivo el gate escribe `VACÍO:` y sale `0` — un ciclo que todavía no arrancó no incumple
   nada. Pero **un scavenge con las cuatro listas vacías RECHAZA**: eso no es «miré y no había
   nada», es no haber mirado, y aceptarlo convertiría el paso en un archivo que se crea para
   destrabar el gate.

   **Por qué existe este paso.** Medido sobre este mismo documento el 2026-09-15: **ningún paso
   previo a la spec leía el código**. Se olfateaba el stack con un `ls`, se leía la memoria del
   protocolo, y se contaban archivos para enrutar — un número que ningún gate validaba y ningún
   script leía. Todo el encontrar huecos y revisar lógica ocurría después: el escaneo de
   clarificaciones en la fase 3, los conflictos de plan en la 4, y `verify-scope-diff` **después del
   GREEN**. Los huecos aparecían con el código ya escrito, que es el momento más caro para verlos.

   **Límite honesto**: el gate comprueba que cada locator resuelva a una línea real. **No comprueba
   que esa línea diga lo que la entrada afirma**, ni que alguien haya leído el código: un scavenge
   coherente e inventado pasa en verde. Y el alcance lo declara quien escribe, así que no distingue
   haber mirado poco de haber mirado mal.

   **Con el scavenge escrito, el enrutado sale de él.** Sólo 1-3 archivos de contexto requerido y
   sin ambigüedad de requisitos → se ofrece la **vía corta**. 4+ archivos, cualquier ambigüedad, o
   un pedido de artefacto durable que otro vaya a leer después → **vía completa, sin excepción**.
   Nunca se auto-decide en silencio: el menú siempre pregunta y la persona elige.

**11. La vía, elegida por la persona** (este menú cierra la fase 1).

🔵 **¿Vía corta o vía completa?**

- **A)** Vía corta — *(recomendado para 1-3 archivos sin ambigüedad)*. Scavenge + una **spec mínima
  de tres secciones**: problema, criterios de aceptación y definición de terminado. Sin Discovery,
  sin `plan.md`. Después el ciclo normal: rojo → verde → triangular → refactorizar.
- **B)** Vía completa — Scavenge + los diagnósticos de Discovery + spec completa de ocho secciones +
  `plan.md` y `tasks.json`. Para trabajo que toca arquitectura, usuarios, o que alguien más va a
  leer después.

Esperando tu respuesta antes de continuar.

> **Qué es cada cosa:** el *scavenge* es el relevamiento de lo que ya hay en el código antes de
> tocarlo; *Discovery*, la investigación de para qué sirve el cambio y quién lo usa; la *spec*, el
> documento que dice qué tiene que hacer. *Rojo → verde → triangular → refactorizar*: primero una
> prueba que falla, después el código mínimo que la pasa, después casos de borde, y al final ordenar
> sin cambiar lo que hace.

   **Lo que la vía corta NO saltea, y conviene decirlo porque antes no estaba dicho:** el test rojo,
   la triangulación, la fase 6 completa y el recibo. Lo que se acorta es **el expediente de
   producto**, nunca la verificación.

   **La spec mínima no es opcional, y ésa es la corrección de fondo.** Hasta el 2026-09-15 la vía
   corta prometía saltar la spec entera, y eso la dejaba **sin salida legal**: el test rojo exige
   una prueba por cada criterio de `docs/spec.md`, la fase 6 convierte la ausencia de spec en
   rechazo, y el recibo pide una funcionalidad que sale de ahí. Empezabas liviano y te frenaba al
   final, con el trabajo ya hecho. Los criterios de aceptación son lo que sostiene a esos tres
   gates; lo que sobraba era la ceremonia alrededor, y eso es lo que se saca.

   La vía corta **se activa declarando `scope: "corto"` en el scavenge**, no con una bandera: la
   exigencia se deriva del árbol, igual que la sección de seguridad. `templates/spec-minima.md` es
   la plantilla.

   ```bash
   node .vibe/ia-stack-runtime/scripts/verify-spec-wordcap.mjs check docs/spec.md --quality
   ```

   El verde **dice contra qué listado se comprobó** —`vía corta` o `vía completa`—, porque dos
   verdes que se leen igual y significan cosas distintas son peores que un rojo.

**12. Guarda de contexto (opcional, la cablea la persona).** `context-guard` mide los tokens de
*mensajes* de la sesión contra el tope de `contracts/model-routing.json` § contexto (120K
orquestador, 60K subsesión): calla bajo el 70 %, desde ahí pide el handoff y en el tope ordena cerrar y no seguir —commit
del estado, resumen en `.vibe/SESSION.md`, compactar o handoff—. Se cablea como hook
`UserPromptSubmit` en `.claude/settings.json` del proyecto. El rol por defecto es orquestador; una subsesión lo cambia con la variable de entorno `IA_STACK_ROL=subsesion` (o `--rol subsesion`), porque no hay un `settings.json` por subsesión:
```json
{ "hooks": { "UserPromptSubmit": [ { "hooks": [ { "type": "command",
  "command": "node .vibe/ia-stack-runtime/scripts/context-guard.mjs --rol orquestador" } ] } ] } }
```
**Límite honesto: el instalador no cablea hooks**, y esta guarda tampoco actúa sola: no commitea ni
compacta, sólo dice qué hacer. **Tampoco cubre a los subagentes** (`Agent`): no disparan `UserPromptSubmit`, así que su tope de 60K lo controla el brief (≤4K) y el reporte (≤40 líneas), no un hook. Tras compactar, el conteo reinicia en el último `compact_boundary`, y las líneas `isSidechain` no cuentan. Sale `0` siempre; si falla, lo dice por stderr y no avisa nada. Mide
con `ceil(caracteres/4)`, aproximado.

---
