# Adaptadores de test rojo para pytest y vitest — medido el 2026-09-14

**Método.** Ejecución real contra **pytest 9.1.1** y **vitest 5.0.0**, ya instalados en la máquina.
No se instaló nada. Los fixtures descartables quedaron fuera del repositorio. Cada afirmación de
abajo se reprodujo con un comando; lo que no se pudo medir está marcado, no completado.

---

## El hallazgo, y por qué cambia una decisión

`verify-red-node.mjs` resiste el ataque que documenta en sus líneas 125-149 por una propiedad
concreta: **el único código del proyecto que corre es el archivo de prueba, y corre adentro del
marco TAP del harness**, que escapa todo lo que ese archivo imprime.

**pytest y vitest no tienen esa propiedad.** Los dos ejecutan **código de configuración del
proyecto** —`conftest.py`, `vitest.config.js`— con control sobre el pipeline de reporte **y sobre el
exit code**. Se falsificaron los dos: cero pruebas fallando, evidencia estructurada perfecta, exit
code distinto de cero.

**pytest** — `conftest.py` con un hookwrapper de `pytest_sessionfinish`, y una prueba que **pasa**:

```
EXIT=1
--- stdout de pytest ---
.                                                       [100%]
1 passed in 0.15s
--- XML resultante ---
<testsuite name="pytest" errors="0" failures="1" skipped="0" tests="1" ...>
  <testcase classname="test_ok" name="test_todo_bien" time="0.001">
    <failure message="assert (1 + 1) == 3">...test_ok.py:2: AssertionError</failure>
```

El `conftest` lee `session.config.option.xmlpath` —la ruta se la pasa el propio adaptador—, reescribe
el archivo después de que `LogXML` lo escribió, y fija `session.exitstatus = 1`.

**vitest** — `vitest.config.js` con un `globalSetup` cuyo teardown corre **después** del reporter:

```
EXIT=1
success= false | numFailedTests= 1 | status= failed
failureMessages[0]= "AssertionError: expected 1 to be 3 // Object.is equality\n    at t/a.test.js:2:34"
```

Con `writeFileSync(outputFile, FORJADO)` y `process.exitCode = 1`. La prueba real pasaba.

**La diferencia es categórica, no de grado.** El adaptador de Node dice honestamente «metadata con
forma de AssertionError, producida por un `test()` que corrió de verdad». En pytest y vitest **la
segunda mitad tampoco se sostiene: no se puede probar que haya corrido una prueba.**

---

## pytest

### Formato estructurado: sólo `--junit-xml`

Verificado en `pytest --help` de 9.1.1: existen `--junit-xml=path`, `--junit-prefix`, y las opciones
de ini `junit_suite_name`, `junit_logging`, `junit_log_passing_tests`, `junit_duration_report`.
**No existe `--json-report` ni `--report-log` nativos** — son plugins, descartados por la regla de
cero dependencias.

`junit_family` acepta `xunit2` (default), `xunit1` y `legacy`. Probadas las tres: la única diferencia
es que `xunit1` y `legacy` agregan `file` y `line` al `<testcase>`. **Ninguna agrega un atributo
`type` al `<failure>`**, a diferencia del reporter junit de vitest.

`-p no:cacheprovider` es higiene, no seguridad: evita que se cree `.pytest_cache/` en el proyecto.
No cambia la clasificación.

### Cada caso, con su discriminador estructural

| Caso | Elemento | Contadores | `classname` | Exit |
|---|---|---|---|---|
| Falla un assert | `<failure>` | `failures="1" errors="0"` | módulo | **1** |
| `raise` de otra excepción | `<failure>` | `failures="1" errors="0"` | módulo | **1** |
| Error de fixture o setup | `<error message="failed on setup with ...">` | `errors="1" failures="0"` | módulo | **1** |
| Error de recolección | `<error message="collection failure">` | `errors="1" failures="0"` | **vacío** | **2** |
| Cero pruebas recolectadas | `<testsuite tests="0" />` | todo en 0 | — | **5** |
| Usage error | `<testsuite tests="0" />` | todo en 0 | — | **4** |

Cuatro de los cinco discriminadores salen **estructuralmente**, sin tocar prosa. El único que no:
assert contra otra excepción.

**Discriminador de assert:** la **última línea no vacía** del cuerpo del `<failure>`, con la forma
`<archivo>:<línea>: <NombreDeExcepción>`.

```
assert 1+1==3                 →  test_assert.py:2: AssertionError
assert x > 10, "msg"          →  test_v.py:4: AssertionError
raise ValueError("...")       →  test_raise.py:2: ValueError
pytest.fail("...")            →  test_v.py:10: Failed
pytest.raises que no lanza    →  test_v.py:13: Failed
```

**No usar el atributo `message`: no es uniforme.** Para `assert 1+1==3` da `message="assert (1 + 1)
== 3"`, porque pytest le saca el prefijo cuando el mensaje empieza con `assert`; para
`assert x, "msg"` da `message="AssertionError: msg\nassert 1 > 10"`. Dos formas distintas para el
mismo caso.

Ojo: `pytest.fail()` y `pytest.raises` producen `Failed`, **no** `AssertionError`. Aceptarlos o no es
una decisión explícita; el default coherente con el gate de Node es rechazarlos.

### Exit codes

`0` OK · `1` tests fallaron · `2` interrumpido · `3` error interno · `4` usage error · `5` ninguna
prueba recolectada · `6` demasiados warnings.

**Discrepancia medida:** la documentación describe el `2` como «interrumpido por el usuario», pero
**un error de recolección también sale 2** (pytest imprime `!!!! Interrupted: 1 error during
collection !!!!`). O sea que el `2` mezcla dos cosas, y el gate no puede apoyarse sólo en el exit
code: tiene que anclar el rechazo en el `<error message="collection failure">` del XML, que sí es
explícito.

### El comando, con cada pieza justificada

```
python -m pytest --junit-xml=<ruta-fuera-del-proyecto> -p no:cacheprovider -o addopts= -q <test-file>
```

- **`-o addopts=` es obligatorio.** Sin él, un `pytest.ini` del proyecto con
  `addopts = -p no:junitxml` hace que **el XML no se escriba nunca**. Verificado en los dos sentidos.
- **Limpiar `PYTEST_ADDOPTS` del entorno.** Verificado que inyecta opciones: se le metió `--co` y
  pytest sólo recolectó. Es el equivalente exacto de lo que `redTestEnvironment` hace con
  `NODE_OPTIONS`.
- `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` apaga plugins por entry-point, pero **no** apaga `conftest.py`.
- **`--confcutdir` NO sirve:** se probó contra el ataque y pasó igual.
- **`--noconftest` sí lo bloquea** (medido: exit 0 y XML honesto), pero rompe cualquier proyecto con
  fixtures en conftest. No sirve como default; a lo sumo como modo estricto opcional.

**Portabilidad, un problema real:** `python` tampoco está en la lista blanca del protocolo, así que
el adaptador es un `.mjs` que lo lanza por dentro. Pero no hay equivalente de `process.execPath`: hay
que resolver el PATH. En la máquina de medición `python` funciona y `python3` es el stub de la
Microsoft Store. El adaptador tiene que sondear `python -c "import pytest"` antes de correr y
rechazar con un mensaje claro si no resuelve.

### El endurecimiento que sí agrega algo

Después de clasificar el XML, el adaptador **lee el archivo fuente él mismo** —el mismo cuyo hash el
protocolo ya sella— en vez de creerle al reporte: comprueba que la ruta esté contenida en el
proyecto, que la línea exista, y que contenga un `assert`.

Eso cierra el ataque «el conftest inventa un fallo para una prueba que no existe». **No cierra** un
`raise AssertionError` escrito literalmente en esa línea. Y tiene un límite medido: cuando el assert
vive en un helper, la línea reportada apunta al helper y no a la prueba, así que el chequeo tiene que
aceptar cualquier archivo contenido en el proyecto, no sólo el archivo de prueba.

---

## vitest

### `--reporter=json` sigue siendo el formato, con un cambio que importa

La versión actual es **5.0.0**. Reporters incorporados: `default, agent, minimal, blob, verbose, dot,
json, tap, tap-flat, junit, tree, hanging-process, github-actions`.

**El cambio (llegó en v4, verificado en v5): el reporter `json` ya no escribe a stdout.** Sin
`--outputFile` escribe a `.vitest/json/output.json` y por stdout sólo sale `JSON report written to
<ruta>`. Se puede forzar stdout con la opción `stdout: true` del reporter — **no hay que hacerlo**:
en la misma corrida se comprobó que un `process.stdout.write()` desde dentro de una prueba llega
crudo a stdout, así que mezclar el JSON con stdout reabre la falsificación por intercalado.
**`--outputFile` siempre.**

El esquema compatible con jest sobrevivió de v3 a v5: `numTotalTestSuites`, `numTotalTests`,
`numPassedTests`, `numFailedTests`, `success`, `testResults[]`. En v5 cada `assertionResult` trae
además `meta`, `tags` y `benchmarks`.

### Cada caso

| Caso | `assertionResults` | `numTotalTests` | `testResults[].message` | Prefijo de `failureMessages[0]` | Exit |
|---|---|---|---|---|---|
| Falla un assert | `[{status:"failed"}]` | 1 | `""` | `AssertionError: ` | 1 |
| `throw` de otra cosa | `[{status:"failed"}]` | 1 | `""` | `TypeError: ` | 1 |
| Error de hook | `[{status:"failed"}]` | 1 | `""` | `Error: ` + frame `at runHook` | 1 |
| Error de import | **`[]`** | **0** | **`"Cannot find module ..."`** | — | 1 |
| Archivo sin suite | **`[]`** | **0** | **`"No test suite found in file ..."`** | — | 1 |
| Cero archivos | `testResults: []` | 0 | — | — | 1 |

**El discriminador de error de carga es estructural:** `assertionResults.length === 0` **junto con**
`testResults[f].message !== ""`. En un fallo genuino `message` es exactamente `""`.

**Cero pruebas recolectadas tiene dos formas y las dos salen exit 1** — vitest no tiene el
equivalente del exit 5 de pytest, así que esto se detecta en el JSON y nunca por exit code.

**Lo que el JSON NO distingue:** un error de hook de un fallo de aserción. Los dos quedan como un
`assertionResult` con `status:"failed"`, y sólo el prefijo del string los separa. El JSON de vitest
**no tiene** la separación `failures` contra `errors` que sí tiene el JUnit de pytest.

El reporter `junit` de vitest sí trae un atributo `type` tomado de `error.name`, que es más limpio
que el prefijo. **Pero** para el error de import y el archivo vacío sintetiza un `<testcase>` falso
con `tests="1"`, o sea **miente sobre cuántas pruebas corrieron**. Por eso: JSON como fuente
primaria, y el `type` del junit sólo como cruce opcional. Los dos salen de `error.name`, que es
escribible.

### El comando

```
node <vitest-bin> run --root <proyecto> --reporter=json --outputFile=<ruta-fuera-del-proyecto> <test-file>
```

- `run` es obligatorio: sin él entra en modo watch.
- **`--config <archivo-neutral-fuera-del-proyecto>` bloquea el ataque de `globalSetup`.** Medido: con
  él, la corrida forjada devuelve `success=true`, `numTotalTests=1` y exit 0, o sea la verdad.
  **Pero** el proyecto pierde sus alias, `setupFiles`, `environment: 'jsdom'` y plugins de Vite, así
  que la mayoría de los proyectos reales no pueden correr sus pruebas así. Modo estricto opcional,
  igual que `--noconftest`, no un default.
- No existe un `--no-config`.

---

## Los dos límites honestos, redactados

### pytest

> Prueba que **pytest, corriendo en este proyecto, escribió un JUnit XML donde un `<failure>` de fase
> de llamada informa `AssertionError` en una línea del proyecto que contiene un `assert`**. No prueba
> que haya corrido una prueba, y menos que la aserción sea genuina. A diferencia de `node --test`,
> pytest **ejecuta código de configuración del proyecto** (`conftest.py`) como plugin, con acceso a
> `session.config.option.xmlpath` y a `session.exitstatus`. Falsificado: un hookwrapper de
> `pytest_sessionfinish` reescribe el XML después de `LogXML` y fuerza el exit code, con una única
> prueba que **pasa**. El stdout tampoco sirve de contraprueba: la salida capturada de la prueba se
> reimprime textual y sin escapar bajo `Captured stdout call`. `--noconftest` cierra el vector pero
> rompe cualquier proyecto con fixtures, así que **este gate es estructuralmente más débil que el de
> Node, y esa brecha es de protocolo y revisión, no técnica.**

### vitest

> Prueba que **vitest escribió un reporte JSON donde un archivo sin error de carga registró un
> `assertionResult` con `status:"failed"` cuyo error se llama `AssertionError`, en una línea del
> proyecto que contiene una aserción**. No prueba que la aserción sea genuina: `failureMessages` es
> literalmente `err.stack`, y `Error.prototype.name` es escribible — un `new Error(...)` con
> `e.name = 'AssertionError'` lanzado desde un `test()` real reproduce la forma exacta
> (falsificado). Y a diferencia de `node --test`, **vitest carga `vitest.config.js` del proyecto**,
> que es código arbitrario: un `globalSetup` cuyo teardown corre después del reporter puede
> reescribir el `--outputFile` y fijar `process.exitCode = 1` con cero pruebas fallando
> (falsificado). `--config` apuntando a un archivo neutral cierra el vector pero deja al proyecto sin
> su entorno, así que no es usable como default. **La brecha residual es de protocolo y revisión, no
> técnica.**

---

## Lo que NO se pudo verificar

1. **`pytest --junit-xml=-` hacia stdout.** No se probó. Cambiaría poco: el stdout de pytest tampoco
   es un canal cerrado.
2. ~~**Entorno no limpio.**~~ **CERRADO** — se repitió en un entorno virgen, con cero plugins. Ver
   «Remedición en entorno virgen» al final de esta ficha: todas las afirmaciones se sostienen.
3. **`pytest-xdist`** y los pools `browser`/`forks` de vitest: no probados. Los dos cambian el
   pipeline de reporte y podrían mover los contadores.
4. **Exit codes de vitest más allá de 0 y 1.** Sólo se observaron esos dos, incluido el caso de
   configuración rota. No se encontró una tabla oficial.
5. **El `2` de pytest para errores de recolección** no está documentado como tal: es un hallazgo
   empírico sobre 9.1.1, no una garantía de API.
6. **Si vitest expone el objeto de error completo a un reporter propio.** Sería la vía para un
   discriminador más rico que el prefijo, pero seguiría leyendo `error.name`, así que no cambiaría el
   límite honesto — sólo la ergonomía.

---

## Contraejemplo

La recomendación de construir estos dos adaptadores es la equivocada **si lo que se busca es la misma
garantía que da el adaptador de Node**. No la dan, y ninguna opción de línea de comandos se la puede
dar sin romper los proyectos reales que pretende servir. Lo que sí dan es un piso: obligan a que
exista un reporte estructurado coherente y a que la línea señalada contenga una aserción, que es
estrictamente más de lo que hay hoy — hoy no hay nada, y un proyecto Python no puede pasar LAW 1 en
absoluto. La decisión honesta no es «construirlos o no», sino **construirlos declarando en el mismo
acto que su garantía es menor**, y no dejar que el verde de un adaptador débil se lea igual que el
verde del fuerte.

**Fuentes:** `docs.pytest.org/en/stable/how-to/output.html` ·
`docs.pytest.org/en/stable/reference/exit-codes.html` · `vitest.dev/guide/reporters.html` ·
`vitest.dev/blog/vitest-5.html` · `vitest.dev/blog/vitest-4`

---

## Remedición en entorno virgen — 2026-09-14

La primera pasada corrió con el intérprete del sistema, que tenía **tres complementos de pytest
instalados**: `anyio`, `hypothesis` y `pytest-cov`. Quedó declarado como no verificado, con la nota
de que convenía repetirlo antes de fijar el predicado. Se repitió.

**Entorno.** Intérprete virtual recién creado con `pytest==9.1.1` y nada más; se comprobó por conteo
de puntos de entrada `pytest11`: **cero**. Misma versión que la medición original, así que las dos
comparan. Para vitest, un proyecto nuevo con `vitest@5.0.0` como única dependencia y sin
configuración previa. Los dos entornos y todos los fixtures quedaron fuera del repositorio.

**Resultado: todas las afirmaciones se sostienen. Los complementos no eran la causa de nada.**

### pytest, medido de nuevo

| Caso | Exit | Elemento | Contadores | `classname` | Última línea del cuerpo |
|---|---|---|---|---|---|
| Falla un assert | 1 | `failure` | `t=1 e=0 f=1` | módulo | `test_x.py:2: AssertionError` |
| `raise` de otra excepción | 1 | `failure` | `t=1 e=0 f=1` | módulo | `test_x.py:2: ValueError` |
| `pytest.fail()` | 1 | `failure` | `t=1 e=0 f=1` | módulo | `test_x.py:4: Failed` |
| Error de fixture | 1 | `error` | **`t=1 e=1 f=0`** | módulo | `conftest.py:5: RuntimeError` |
| Error de recolección | **2** | `error` | `t=1 e=1 f=0` | **vacío** | `ModuleNotFoundError` |
| Sintaxis rota | **2** | `error` | `t=1 e=1 f=0` | **vacío** | `SyntaxError` |
| Cero recolectados | **5** | — | `t=0` | — | — |
| Usage error | **4** | — | — | — | — |

**Un refinamiento que la remedición aporta.** El error de fixture produce una última línea con la
**misma forma** que un fallo de aserción: `<archivo>:<línea>: <Excepción>`. Así que el discriminador
entre esos dos **no puede ser la última línea**: tiene que ser el par de contadores `errors` contra
`failures`. La tabla de arriba ya lo decía estructuralmente; ahora está confirmado que apoyarse sólo
en la línea sería ambiguo.

**El assert dentro de un helper** vuelve a apuntar a la línea del helper y no a la de la prueba, así
que la comprobación cruzada contra el fuente tiene que aceptar cualquier archivo contenido en el
proyecto. **La sintaxis rota** es un caso nuevo, y se comporta igual que el error de recolección:
exit 2, `<error>`, `classname` vacío.

### El ataque de pytest, reproducido en virgen

```
exit code         : 1
stdout de pytest  : .    [100%] / 1 passed in 0.04s
XML               : tests="1" errors="0" failures="1"
XML última línea  : test_ok.py:2: AssertionError
```

**Una prueba que pasa, y el gate ve un rojo.** Con `--noconftest`: exit 0 y `failures="0"`, o sea la
verdad. Con `--confcutdir`: **el ataque pasa igual**, confirmando que esa opción no sirve de defensa.

Las dos condiciones del comando también se confirman: **sin `-o addopts=`, un `pytest.ini` del
proyecto con `addopts = -p no:junitxml` hace que el XML no se escriba nunca**; y `PYTEST_ADDOPTS`
inyecta opciones — con `--co` inyectado, pytest sólo recolecta y el reporte queda en cero.

### vitest, medido de nuevo

| Caso | Exit | `success` | `numTotalTests` | Fallados | `assertionResults` | `message` | Prefijo |
|---|---|---|---|---|---|---|---|
| Falla un assert | 1 | `false` | 1 | 1 | 1 | `""` | `AssertionError: ` |
| `throw` de otra cosa | 1 | `false` | 1 | 1 | 1 | `""` | `TypeError: ` |
| Error de hook | 1 | `false` | 1 | 1 | 1 | `""` | `Error: hook roto` |
| Error de import | 1 | `false` | **0** | 0 | **0** | `"Cannot find module …"` | — |
| Archivo sin suite | 1 | `false` | **0** | 0 | **0** | `"No test suite found …"` | — |
| Cero archivos | 1 | `false` | — | — | — | — | — |

El discriminador estructural queda confirmado: **`assertionResults` vacío junto con `message` no
vacío** separa un error de carga de un fallo de prueba. Y el error de hook sigue siendo
indistinguible de un fallo de aserción salvo por el prefijo del string.

**La falsificación por nombre de error se reprodujo**: un `new Error(...)` con `e.name` reasignado a
`AssertionError`, lanzado desde un `test()` real, produce un prefijo idéntico al genuino.

### El ataque de vitest, reproducido en virgen

```
exit code      : 1
success        : false
numTotalTests  : 1   numFailedTests: 1
```

con la prueba real **pasando**. Con `--config` apuntando a un archivo neutral fuera del proyecto:
exit 0, `success=true`, cero fallados — la verdad. Y se confirma que **el reporter JSON ya no escribe
a la salida estándar**: dice `JSON report written to <ruta>` en su lugar.

### Qué cambia para el diseño del adaptador

**Nada.** Los dos límites honestos redactados arriba quedan tal como están, y ahora con la medición
hecha en el entorno que la primera pasada no podía garantizar. El hueco «no verificado #2» queda
**cerrado**.

Lo que sigue sin verificarse, y sigue declarado: `pytest-xdist`, los pools `browser` y `forks` de
vitest, los exit codes de vitest más allá de 0 y 1, y que el `2` de pytest para errores de
recolección sea una garantía de API — se observó otra vez, en dos casos distintos, pero la
documentación sigue describiendo ese código como interrupción del usuario.
