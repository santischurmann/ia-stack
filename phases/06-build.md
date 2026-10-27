## PHASE 5 — BUILD (subagentes por tarea, modelo por rol)

El modelo y el esfuerzo de cada subagente no se preguntan: salen de `contracts/model-routing.json`
(§ Reparto de modelos). Hasta la 3.2.0 este menú preguntaba el esfuerzo; ahora lo único que cambia
el resultado, y por eso lo único que se pregunta, es si una tarea puede escalar sola.

🔵 **BUILD CONFIG** (una vez, antes de la primera tarea):

**¿Una tarea que falla una vez con un diagnóstico nuevo puede subir de nivel sola, hasta N3?**

- **A)** Sí — te aviso en el reporte y vuelve a su nivel en la tarea siguiente — *(recomendado)*
- **B)** No — si una tarea falla, freno y te pregunto antes de subir

Esperando tu respuesta antes de continuar.

> **Qué es cada cosa:** los *niveles* son modelos de más barato a más capaz —N1 Haiku, N2 Sonnet, N3
> Opus—. Un *diagnóstico nuevo* es una explicación distinta de por qué falló: reintentar lo mismo no
> cuenta. N4 (Fable) nunca se usa sin que digas que sí.

Per task, topological order — full delegation pattern: `skills/orchestrator-opus.md`. Si Phase 4
permitió paralelo, sólo se despachan simultáneamente tareas que el preflight ya dejó sin conflicto
de escritura no serializado; un `SERIALIZED` conserva su orden topológico.

**Antes de lanzar cada subagente**, el brief pasa el tope de tamaño: 4000 tokens estimados
(`ceil(caracteres/4)`, aproximado; el subgrafo de `graphify query` pegado cuenta) y 3 archivos como
máximo, declarados en una línea `ARCHIVOS: a, b, c` (`ARCHIVOS: ninguno` = 0). Salida distinta de `0`:
se parte la tarea, no se lanza. El reporte que vuelve tiene 40 líneas o menos; el detalle va a
`.vibe/handoffs/detalle/<feature-slug>-<task-id>.md` (carpeta propia: no es un informe de gate y no
pasa por el tope de 40 líneas; el reporte de gate de más abajo sí).
```bash
node .vibe/ia-stack-runtime/scripts/verify-brief-size.mjs check <brief.md>
```

**Al cerrar cada subagente**, el orquestador registra lo que gastó, con el rol de
`contracts/model-routing.json` y `--escalo si` si la tarea tuvo que subir de nivel:
```bash
node .vibe/ia-stack-runtime/scripts/registrar-tokens.mjs append --tarea <id> --rol <rol> --modelo <m> --in <n> --out <n> --escalo si|no
```
Cada línea de `.vibe/tokens.jsonl` queda sellada con el mismo encadenado que `.vibe/AUDIT.md`. Un rol
desconocido o un número inválido sale distinto de `0` y no escribe nada. Registrá de a uno: dos
`append` simultáneos pueden romper la cadena. Los números los declara quien registra. El informe
semanal está en la limpieza (Phase 9, 9.0.3).

Cada subagente tiene un papel con nombre, no es "un subagente cualquiera". Eso endurece la
frontera de **quién puede certificar qué**:

- **Test-Engineer** escribe pruebas que fallan. No toca la implementación.
- **Builder** escribe la implementación. No edita la prueba que tiene que satisfacer.
- **Triangulator** deriva casos de borde, negativos, de contrato y de límite a partir de los
  criterios de aceptación reales. Escribe pruebas. No toca código de producción.
- **Refactor-Engineer** no toca el contrato de ninguno de los dos: sólo la estructura.

**Ninguno de los cuatro certifica su propio gate.** Eso lo hacen mecánicamente
`.vibe/ia-stack-runtime/scripts/verify-red.sh`/`.ps1` y el runner de pruebas. Nunca se acepta como gate
que un subagente diga que pasó: se confía en lo que se deriva, no en lo que se narra.

**5.1 RED** (papel: Test-Engineer) — `skills/subagent-red.md`. Se lanza con
el `model` y el `effort` del rol `red` en `contracts/model-routing.json`. Escribe **exactamente una prueba por cada criterio de aceptación
explícito** de `docs/spec.md`. No es "al menos una": cada criterio tiene la suya, y se pueden contar
sin ejecutar nada. El gate es `.vibe/ia-stack-runtime/scripts/verify-red.sh` (bash) o
`.vibe/ia-stack-runtime/scripts/verify-red.ps1` (PowerShell), con un archivo de prueba literal y el
comando exacto del runner. Los dos envoltorios llaman al **despachador**, que resuelve el comando
contra `contracts/red-adapters.json` por **igualdad exacta** y lanza el adaptador declarado; un
runner que no esté en ese contrato se rechaza nombrándolo y listando los que sí están, **sin
adivinar nunca**. `pytest` declarado no habilita `pytest -q`: las opciones cambian la forma del
reporte, y clasificar la salida de un runner con el parser de otro convierte un rojo mal leído en un
verde.

**Los tres adaptadores NO dan la misma garantía, y eso se dice en voz alta.** `node --test` es
`fuerte`: el único código del proyecto que corre es el archivo de prueba, adentro del marco TAP del
harness. `pytest` y `vitest` son `menor`, porque los dos ejecutan código de configuración del
proyecto —`conftest.py`, `vitest.config.js`— con control sobre el reporte **y sobre el código de
salida**; los dos ataques están falsificados, medidos en entorno virgen y comprobados contra los
runners reales en `research/sources/adaptadores-red-2026-09-14.md`. Un verde de garantía menor sale
con su límite escrito al lado, y **el receipt tiene que registrar con qué adaptador se obtuvo**: si
un verde débil se lee igual que uno fuerte, es igual.

```bash
# El envoltorio, que es lo que se corre: archivo de prueba y comando EXACTO del runner.
bash .vibe/ia-stack-runtime/scripts/verify-red.sh 'tests/mi-cosa.test.mjs' 'node --test'
# PowerShell: .vibe/ia-stack-runtime/scripts/verify-red.ps1 'tests/mi-cosa.test.mjs' 'node --test'
```

Los dos envoltorios llaman al despachador, y **el despachador no se invoca a mano**: es él quien
resuelve el runner contra el contrato y elige el adaptador. Correr un adaptador directo sería
elegirlo a mano, o sea leer el reporte de un runner con el clasificador de otro. Está declarado así
en `contracts/gate-docs.json`, con quién lo invoca.

**Sólo pasa una
prueba que corrió y falló en su propia comprobación** — el gate exige un bloque de diagnóstico con
`code: 'ERR_ASSERTION'` atado a su línea `not ok`. Un error de carga (el archivo bajo prueba
todavía no existe, o no parsea) **no** pasa: fail-closed deliberado, porque un archivo de test
vacío que importa algo inexistente produciría el mismo error sin contener una sola prueba. Un
error genérico del runner y todo runner no soportado también fallan cerrado. Para sumar otro stack
hay que agregar un adaptador propio y falsificado — nunca ensanchar un regex.

**Cómo se llega a un RED válido cuando el archivo bajo prueba todavía no existe** (verificado en la
primera corrida real del protocolo, 2026-08-27: el gate rechazó un RED de 9 pruebas por
`ERR_MODULE_NOT_FOUND` mientras este párrafo afirmaba lo contrario): el Test-Engineer crea el
archivo como **esqueleto que no implementa nada** — exporta los símbolos del contrato y cada
función lanza `not implemented`. Así las pruebas corren de verdad y fallan por su propia
comprobación. Las funciones del esqueleto **lanzan**, nunca devuelven un valor vacío: una que
devolviera `0` o `{ok:true}` haría pasar por coincidencia a las pruebas de los casos vacíos, y un
RED donde algunas pruebas pasan de casualidad no prueba nada.

Rechazado → 🚫 bloqueado, se le informa a la persona. **Cómo se reporta**: con un error de carga el runner colapsa
TODAS las pruebas del archivo en un único fallo de archivo (verificado: 9 `test()` declarados,
import de nivel superior faltante → el runner reporta `tests 1, fail 1`, no 9) — reportar el conteo
estático de pruebas y la clasificación del error como dos hechos separados, nunca como "N pruebas
fallaron" (eso sólo es cierto cuando las pruebas efectivamente corrieron y fallaron solas).

**Formas de aserción prohibidas** (fuente: `research/sources/protocolo-muralla.md` punto #6). El
gate sólo prueba que el RED es real, **no que la prueba sea buena**:

- Tautologías: `expect(true).toBe(true)`.
- `toBeDefined()` o `assert x is not None` como única aserción.
- Una aserción adentro de un bucle que puede dar cero vueltas: si la entrada viene vacía, pasa sin
  haber probado nada.
- "renderiza sin explotar" o "no lanza" como prueba entera.
- Aserciones sobre clases CSS u otros detalles de implementación en vez de sobre la conducta.
- Una aserción sobre el **contenido** de una respuesta sin una aserción previa sobre su **estado**.
  Un test que afirma que ningún campo prohibido sale por un endpoint pasa cuando el endpoint
  devuelve 404, porque el cuerpo de un 404 tampoco los tiene. **Toda aserción sobre el contenido
  de una respuesta va precedida por una sobre su estado**, en el mismo bloque de prueba.

Las cinco primeras no fallan mecánicamente en `verify-red.sh`/`.ps1`. El Test-Engineer las evita
por regla, y TRIANGULATE y la revisión 4R las marcan si se cuelan.

La sexta sí tiene detector —es la única de la lista que lo tiene, y toda regla nueva de este
protocolo tiene que traer el suyo—:
```bash
node .vibe/ia-stack-runtime/scripts/verify-assert-order.mjs check tests
```
**Sale 0 siempre: es un aviso, todavía no un gate.** Nace así por una medición propia — cinco
diseños de detectores de seguridad de este repositorio dieron 43, 26, 6, 5 y 3 hallazgos, **todos
falsos, sin un solo verdadero positivo en 210 archivos ni en 191 commits**, y se declaró el límite
en vez de publicar un gate que grita en falso (una ronda de automejora anterior). Un gate que grita
en falso se ignora, y un gate ignorado no detecta nada. **Criterio de promoción, escrito de
antemano**: pasa a rechazar sólo cuando una corrida sobre un corpus real dé cero falsos positivos y
ese número quede registrado.

**Barrer no es leer.** Es un barrido léxico, no un análisis de flujo: una petición hecha a través
de una función auxiliar no muestra ninguna de las señales que busca y pasa sin que nadie la mire.
Tampoco juzga si la aserción de estado que encontró comprueba el estado correcto.

**Cuántos mocks son demasiados** (punto #6): hasta 3 en una prueba es sano. Entre 4 y 6, conviene
extraer una función pura. **7 o más: pará, estás probando en la capa equivocada** — necesitar esa
cantidad de mocks para cubrir unas pocas líneas de lógica significa que esas líneas quieren ser una
función pura, que se prueba con cero mocks.

**Línea base de las pruebas que ya existían** (punto #18) — antes de tocar un archivo que **ya
existe** (no uno nuevo), se corren sus pruebas actuales y se anota la línea base: "N pruebas en
verde". Si algo ya venía fallando, **se para y se informa como falla preexistente**; nunca se
arregla de paso dentro del diff de esta tarea. Un arreglo que viaja escondido adentro de los
cambios de otra tarea es un arreglo que nadie revisó como cambio propio.

**Control de alcance después del GREEN** (punto #19): se comparan los archivos que la tarea
declaró que iba a escribir contra el delta real de Git. `git diff --stat` es sólo un resumen y **no
ve los archivos sin versionar**. Se corre:
```bash
node .vibe/ia-stack-runtime/scripts/verify-scope-diff.mjs check \
  --tasks docs/tasks.json --task <task-id> --base <git-ref> \
  --ignore <explicit-operational-file-if-needed>
```
El gate compara `files_to_create`, `files_to_modify` y `test_files` exactamente contra las rutas
versionadas y sin versionar desde `<git-ref>`. Salir con `1` significa que el alcance se agrandó o
que falta un archivo declarado: se informa, se actualiza el plan **a través del menú 🔵**, y no se
sigue en silencio. Cada ruta ignorada se lista con su propio `--ignore` — no hay ninguna exclusión
implícita de `.vibe/`, y lo ignorado tiene que ser un archivo regular del proyecto. Si el árbol
cambia, se vuelve a correr antes del receipt.

**Opcional: bloqueo a nivel harness** (punto #1, `scripts/pretooluse-red.mjs`) — si
`.claude/settings.json` engancha este script como hook `PreToolUse` (el fragmento exacto está en
`README.md`, sección "Gates que sí son código"), entonces apenas `verify-red.sh`/`.ps1` confirma que
el adaptador aceptó la evidencia del RED, se corre:
```bash
node .vibe/ia-stack-runtime/scripts/pretooluse-red.mjs emit --feature <feature-slug> --task <task-id> --tests <red-test-file-1,red-test-file-2> --files <declared-production-path-1,declared-production-path-2> --command "node --test"
```
Es opcional y su ausencia no rompe nada. Cuando está, convierte "primero el rojo, después el
código" en un bloqueo del harness, en vez de algo que el modelo tiene que acordarse de comprobar.
El receipt vale para una funcionalidad, una tarea y unas rutas concretas; vence a los 30 minutos
contados desde `emitted_at` —no desde el `expires_at` que el propio receipt declara—; incluye una
prueba de RED en Node aceptada por `verify-red-node.mjs`; y se invalida solo si cambia el hash de
alguna de las pruebas que lista. Un receipt de `T01` nunca autoriza una escritura que sólo declaró
`T02`. Las rutas se comprueban de dos formas, léxica y física: un `..`, un symlink que apunta afuera
o un symlink roto se rechazan antes de que Node corra o de que el hook autorice nada.

**Hasta dónde llega, dicho exacto: es una guardia, no una frontera de confianza ni un sandbox.**
El hook sólo se dispara en llamadas a `Write` y `Edit`, y `receiptValid()` comprueba forma, hashes y
la cuenta del vencimiento — nunca de dónde vino el receipt:

- Un modelo que escribe un archivo de producción **con Bash o PowerShell** (`sed -i`, `cat > file`,
  un script, un `cp`) no se intercepta en absoluto.
- Un modelo que escribe el JSON del receipt directo al disco con Bash, en vez de con
  `pretooluse-red.mjs emit`, tampoco se intercepta: el bloqueo sobre el árbol de receipts cubre
  únicamente el canal que este hook puede ver. Un receipt escrito a mano, con el schema correcto,
  el hash de una prueba real y una cuenta de vencimiento coherente con `RECEIPT_TTL_MS`, autoriza
  después una escritura por el camino normal **sin que ningún RED haya corrido nunca**. Confirmado
  por falsificación y documentado como límite aceptado del modelo consultivo en
  `research/adversarial-productivity-audit-2026-08-23.md` y en el comentario de cabecera del propio
  `scripts/pretooluse-red.mjs`. No es un bug pendiente de arreglo.
- Incluso un receipt producido por un `emit()` genuino sólo prueba que `verify-red-node.mjs` vio un
  `test()` real fallar con metadatos con forma de `AssertionError`. Un archivo de prueba que
  construya a mano `Object.assign(new Error('x'), { code: 'ERR_ASSERTION' })` adentro de un `test()`
  de verdad es **indistinguible** de una falla real de `node:assert` para este gate: ninguna señal
  en la salida del proceso probado permite separarlos, porque el proceso bajo prueba es el mismo
  cuyo autor controla el artefacto que se está verificando.

Las tres cosas son responsabilidad del protocolo y de la revisión —control de alcance, y leer los
receipts como evidencia en vez de confiar en ellos—, no garantías que este gate técnico dé.

**5.2 GREEN** (papel: Builder) — `skills/subagent-green.md`. Se verifica que pase y que no haya
regresiones.

**5.3 TRIANGULATE** (papel: Triangulator) — `skills/subagent-triangulate.md`. Corre después del
GREEN y antes del REFACTOR. **Nunca se saltea.** Para tareas triviales se permite una versión
corta, pero el análisis de casos de borde se dice explícitamente: no se omite en silencio.

Primero lee el archivo de pruebas del RED: todo criterio que el RED ya prueba uno a uno queda
**fuera de límites** para volver a derivarlo. Deriva únicamente casos **nuevos** —de borde,
negativos, de contrato, de límite— a partir de `approval_criteria`, los criterios de la spec y el
contrato de implementación. Nunca cobertura decorativa, nunca un duplicado de algo que el RED ya
cubrió, y cada caso rastrea a un motivo real.

Un criterio que el RED se saltó es un defecto del RED: se informa hacia atrás, **nunca lo tapa
TRIANGULATE por su cuenta**. Si un caso falla, se lo pasa al Builder para el arreglo mínimo y se
vuelve a correr TRIANGULATE. No toca código de producción él mismo, y no avanza al REFACTOR hasta
que todos los casos derivados estén en verde con su evidencia registrada.

**5.4 REFACTOR** (papel: Refactor-Engineer) — `skills/subagent-refactor.md`. Se verifica que siga
en verde la suite **completa**, incluidos los casos derivados por TRIANGULATE — no sólo la prueba
del camino feliz original.

**Gate de entrega entre roles y entre fases** — un informe que recomienda el siguiente papel o la
siguiente fase **es un artefacto, no charla descartable**. Se guarda su texto exacto en
`.vibe/handoffs/<feature-slug>-<task-id>-<gate>.md` (or
`.vibe/handoffs/<feature-slug>-PHASE-<n>.md` si la entrega es de fase), y después se corre:
```bash
node .vibe/ia-stack-runtime/scripts/verify-handoff-report.mjs check .vibe/handoffs/<feature-slug>-<task-id>-<gate>.md
```
El informe declara **exactamente una** línea `NOT_REVIEWED:`: o una superficie concreta que quedó
sin mirar, o `none — <alcance revisado, específico>`. Si falta, está vacía, está duplicada o es un
relleno, falla cerrado. Con salida `0` se agrega `{gate, declaration, report_path}` a
`tasks.json[task].not_reviewed`; con salida `1` no se transiciona.

Esto deja a la vista **el borde de cada afirmación de evidencia**, sin dejar que un papel certifique
su propia sustancia: el siguiente papel y la revisión 4R siguen siendo quienes juzgan si ese borde
declarado es aceptable.

Checkpoint después de cada gate: una línea en `.vibe/SESSION.md` (`T<id> RED PASS` / `GREEN ✅` /
`TRIANGULATE N casos en verde` / `REFACTOR verde`) que incluya el resumen del `NOT_REVIEWED` y la
ruta del informe, y después se actualiza el estado en `tasks.json`. La entrega final de la Fase 5
pasa por el mismo gate antes de ofrecer la decisión de commit o push.

En paralelo: las tareas que no se pisan en `depends_on` se lanzan a la vez, si la configuración lo
permitió.

---
