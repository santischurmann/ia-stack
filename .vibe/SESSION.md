# Session — 2026-09-14




---

## 2026-09-22 — tres hallazgos de un proyecto instalado, medidos antes de tocar

**Estado**: 2162 pruebas / 0 fallas / 2 salteadas · cobertura 100% sobre 65 scripts · 123 limites
honestos.

Un proyecto que usa el protocolo reporto tres cosas. Se midieron las tres contra la fuente antes de
tocar nada, y **ninguna era exactamente como vino**:

| # | Lo reportado | Lo medido |
|---|---|---|
| 1 | El hash de cada criterio lee bytes crudos | **Real, y arreglado en `fdca26d`**. Con autocrlf el mismo test daba «the test changed». Este repositorio ya se habia comido esta clase el 2026-09-01 y la arreglo con un `.gitattributes`... para si mismo |
| 2 | Recibos con hashes que no son de ningun commit | **Real, pero no es un defecto de `commit`**: la prueba que se proponia ya existe y esta verde (AC9). Entra por el camino manual que el protocolo publica como valido: `check --require-clean-worktree` y despues `git commit` a mano |
| 3 | El instalador copia y no poda | **Real en los dos instaladores**: `cp -R` y `Copy-Item -Force` copian encima, y un gate retirado sobrevive a la reinstalacion |

**DECIDIDO el mismo dia por el operador, y hecho en `e87f961`:**

1. **`verify-receipt.mjs recheck`** recomprueba un recibo guardado contra el commit que lo lleva.
   Se eligio esto y NO volver obligatorio `commit`.
2. **El instalador aparta lo que sobra y sella el runtime del proyecto** (`INSTALADO.json`). Mueve,
   no borra. La copia global no se poda ni se sella, y queda declarado.

**DESPUES, el mismo dia:**

- **La poda de PowerShell vacio el runtime entero en el CI** (`80068e4`): en el runner el temporal
  usa un nombre corto 8.3, y la ruta relativa salia de restar dos formas distintas de la misma
  ruta. Arreglado con `-Name`, y con una red de seguridad en los dos instaladores: si la poda fuera
  a mover mas de la mitad del runtime, no mueve nada.
- **Finales de linea mezclados, rechazados antes de sellar** (`cf63e29`), por decision del operador.
  El limite que decia «es raro» aparecio ese mismo dia en un proyecto real.

**DONDE RETOMAR**

- La cobertura de shell de `install.sh` quedo en 69% contra un piso de 65, con escenarios de verdad.
  Las ramas que faltan (paquete sin git, un `mv` que falla) no se pueden fabricar desde el arnes.
- La copia global del runtime aparece como carpeta sin trackear en el repositorio de configuracion
  de la maquina del autor. Ya pasaba antes de hoy; es decision del operador si se ignora ahi.

**DECISIONES DEL OPERADOR QUE SIGUEN ABIERTAS**

1. El zip de release se sigue llamando con el nombre anterior del protocolo. Es el nombre del
   archivo que la gente descarga, asi que renombrarlo es una decision de producto.
2. La filtracion del checkpoint sigue en el historial de `2afcd1a`, ya publicado. Sacarla es
   reescribir historia de un repositorio publico.
3. Que el runtime global se ignore o no en el repositorio de configuracion de quien instala.

**FUERA DE GIT, y que un reinicio NO se lleva** (son archivos en disco, o estan publicados):

- La pagina publicada del protocolo, en su version 5, armada sobre la v4 de la otra sesion. Vive
  en el servidor, no en esta maquina.
- `.vibe/ia-stack-runtime/` (306 archivos) y `graphify-out/` (4359): los dos ignorados por git y
  los dos regenerables -- reinstalar y volver a correr el grafo --.
- `.vibe/ia-stack-archive/` NO existe: la poda nueva no tuvo nada que apartar en este repositorio.
- Lo unico que se pierde con un reinicio es el contexto de la conversacion. Todo lo que hace falta
  para retomar esta en este archivo y en git.

---

## 2026-09-17 (segunda tanda) — el resto del rename, y una filtracion que el CI no podia ver

**Estado**: 2155 pruebas / 0 fallas / 2 salteadas · cobertura 100% sobre 65 scripts · 122 limites
honestos · CI verde en las dos plataformas.

**EL RESTO DEL RENAME.** Por dentro se habia hecho el 2026-09-15; la prosa quedo. 82 sitios en 53
archivos de codigo: banners de los instaladores, el limite de verify-deploy, el rechazo de
verify-runtime-sync, y el motivo de salteo copiado a mano en 35 archivos de prueba. Nadie lo vio
porque un rename se revisa por su diff y esas cadenas no estaban en el diff de nada; lo encontro una
salida real.

La lista **se deriva** en `tests/nombre-anterior.test.mjs`, y lo que NO se toca vive en
`contracts/nombre-anterior.json` con que se rompe si alguien lo «completa». **Cai en esa misma trampa
mientras la describia**: el barrido cambio el valor de `SKILL_ALIAS` en los dos instaladores y dejo
de escribirse el archivo que sostiene el comando de barra anterior. Lo cazo una prueba que ya
existia. Las dos lineas quedan declaradas textuales.

**LA FILTRACION, y es lo mas importante de esta tanda.** El checkpoint anterior nombraba al operador
y tres de sus repositorios privados. Lo escribi yo y lo pushee sin correr `verify-repo-clean`
**despues** de editar el archivo. Y el CI no podia verlo: ese gate detecta la identidad de LA MAQUINA
QUE LO CORRE, y en el runner el usuario se llama `runner`. **Un CI verde no reemplaza correr ese gate
aca.** La cadena sigue en el historial de 2afcd1a, que ya esta publicado: sacarla es reescribir
historia de un repositorio publico y es decision del operador.

**UN LIMITE HONESTO NUEVO**: `verify-runtime-sync` necesita el checkout fuente al lado. Quien solo
tiene su proyecto no puede responder si su runtime quedo viejo, y la copia vieja del gate que vive
adentro de ese runtime tampoco: un runtime desactualizado no puede detectar que lo esta.

**DONDE RETOMAR**

1. **Sello de version en el runtime instalado** — evaluado, NO implementado, esperando decision. La
   idea: que el instalador deje en el runtime desde que commit y en que fecha se instalo, para que un
   proyecto vea que quedo viejo sin tener la fuente al lado. Cierra la mitad util del problema. Tres
   cosas a resolver antes: hay que escribirlo en los DOS instaladores; `verify-runtime-sync` compara
   byte a byte contra el checkout y un archivo que existe solo en el runtime le da rojo, asi que hay
   que excluirlo con motivo escrito; y desde un zip de release no hay commit del que sacar el sello.
   Y no dice «estoy viejo», dice «me instale tal dia»: la conclusion la saca un humano.
2. **La ablacion** — investigacion sobre repositorios del operador ajenos a este protocolo, por eso
   no se nombran. T4 espera que el operador corra su prompt en solo-lectura; T6 sin armar; el resto
   espera a que se libere el repositorio donde corren.
3. **Un gate de artefactos publicados contra su arbol de fuentes**, en otro repositorio del operador.

---

## 2026-09-17 — el tope de TAP tenia una regla que nadie comprobaba, y el CI encontro el resto

**Estado**: 2151 pruebas / 0 fallas / 2 salteadas · cobertura 100% sobre **65** scripts · publicado
en `ffbf4c5`. Cuatro commits: `e452f07`, `d3233a6`, `9a0a711`, `ffbf4c5`.

**LA CADENA, y cada eslabon lo destapo el anterior.**

| # | Que se encontro | Como |
|---|---|---|
| 1 | La duracion se media DESDE ADENTRO de la suite, asi que medía contencion | 96 s solo contra 224 s desde adentro, factor 2,3x |
| 2 | `install-runtime` oscilaba entre 96 y 111 s contra un tope de 120 | Lo dijo el gate nuevo en su primera corrida. Partido en dos, una prueba por instalador |
| 3 | **`TAP_TIMEOUT_MS` se escribio con su regla al lado y la regla vivia en un comentario** | «deja mas del triple sobre el mas lento», con el mas lento en 40 s el 2026-09-05. El 2026-09-17 ese archivo medía 101 s contra el mismo tope de 120: por debajo del tope, con la regla rota por 2,5, y nada en rojo |
| 4 | Esta maquina no puede medir: el mismo archivo dio 54, 89, 101, 112, 116 y 247 s en una tarde | La CPU al 100% con procesos ajenos al repositorio. Tercer estado `RECONCILIAR` |
| 5 | **Diez pruebas se salteaban en Ubuntu y CORRIAN en Windows sin declararlo** | Lo dijo `verify-platform-scope simetria` en su primera corrida sobre la matriz. NUEVE eran defectos: comparaban `existsSync` contra una ruta de Git Bash de Windows |
| 6 | **`verify-red.sh` y `vibe-memory.sh` versionados en 100644** | Lo dijo el CI de Ubuntu cuando esas nueve dejaron de saltearse: `permission denied` sobre el gate de LAW 1, publicado como comando en `skills/caveman-tdd.md` |
| 7 | El guarda de ese bit YA EXISTIA y era angosto | `tracked-modes.test.mjs` reconocia `./scripts/x.sh` y no `.vibe/<runtime>/scripts/x.sh`, que es la forma mas publicada. Nueve dias en verde con el defecto adentro |

**Lo que cambio de fondo**: el gate de duracion juzga **la regla** (tope ≥ 3 × el mas lento) y no el
numero; el tope paso a 600_000; y hay un tercer estado para cuando la maquina no deja medir. **El
arbitro es el runner, no la maquina de trabajo.**

**Un error mio, dicho**: el script que partio `verify-receipt-gate` escribio
`tests/verify-receipt-v3.test.mjs` sin mirar si existia, y existia — 25 pruebas. Estaba en git y se
restituyo intacto; la mitad partida se llama `verify-receipt-check-v3.test.mjs`. Se vio porque la
suite paso de 2150 a 2126 y esos 25 no se dejaron pasar.

**DONDE RETOMAR**

1. **El numero del runner.** `contracts/slowest-test.json` declara 32 s medidos en esta maquina. El
   que manda es el del CI y todavia no se leyo: mirar la corrida de `ffbf4c5` y, si difiere mas de
   1,5 veces, actualizar el contrato con SU numero. El gate ya escribe `RECONCILIAR` en ese caso.
2. **La ablacion.** Es una investigacion sobre repositorios del operador ajenos a este protocolo, y
   por eso no se nombran aca: T4 espera que el operador corra su prompt en solo-lectura, T6 quedo
   sin armar, y el resto espera a que se libere el repositorio donde corren.
3. **Un gate de artefactos publicados contra su arbol de fuentes**, en otro repositorio del
   operador. Sin empezar.

**NO queda pendiente** el hueco del gate de plataforma: los diez salteos se resolvieron en `9a0a711`
— nueve eran defectos y se arreglaron, uno era de plataforma de verdad y quedo declarado.

---

## 2026-09-16 — tres límites honestos cerrados, y el gate que castigaba el arreglo

**Estado**: 2047 pruebas / 0 fallas · cobertura 100% sobre **63** scripts (eran 59) · 131 promesas +
121 límites honestos · publicado en `8219ac5`.

**Lo que se cerró, y con qué quedó en su lugar.** Un límite honesto no se borra cuando se paga: se
reemplaza por el que queda, o el gate queda en verde sobre algo que sigue sin poder probar.

| Se cerró | Lo que queda escrito |
|---|---|
| La compatibilidad del nombre viejo no tenía vencimiento | Vence el **2027-03-15** y el gate rechaza pasada esa fecha. **La LECTURA no vence nunca**: la evidencia sellada declara el prefijo viejo y es append-only — un corte que la apagara invalidaría la historia entera. El contador sigue siendo una foto de una corrida |
| El candado no veía un PID reusado | Se lee la hora de arranque del proceso en las tres plataformas. Queda: donde el grano es de un segundo, dos procesos del mismo segundo son indistinguibles |
| Cuatro verificadores de `research/` sin una sola prueba | 132 pruebas y entraron al denominador. Queda: se prueban con datos sintéticos, así que un clon limpio prueba los gates y no puede reproducir el expediente |

**El hallazgo que no se buscaba.** El gate de sereno **castigaba arreglar lo que él mismo había hecho
encontrar**: la propuesta 4 citaba, literal, la frase que describía el defecto, y al arreglarlo la
suite se puso en rojo. Una cita deja de resolver por dos motivos opuestos — se pudrió, o se
corrigió — y tratarlos igual hacía que conviniera no arreglar el hallazgo. Se agregó la distinción,
no un parche al registro.

**Y el denominador de la cobertura salía de dos lugares**: `'scripts'` literal adentro del gate, y el
contrato declarándolo por su cuenta. Ahora el gate lee el contrato, con grano de archivo.

**Un incumplimiento de LAW 1, dicho.** En el tercer verificador de `research/` se escribió el script
antes de correr la prueba, así que **no se vio el rojo**. Se compensó por mutación — tres reglas
rotas a propósito, tres pruebas caídas, restaurado y 26/26 —, pero el orden estuvo mal y queda
anotado porque compensar no es lo mismo que cumplir.

**Abierto**: la ablación. El set ya no tiene tareas redactadas y las rutas acordadas están en
`.claude/ablation-run-scope.json` (gitignorado, no viaja). Falta lo único que esta sesión no podía
hacer: **medir la línea base en sesiones nuevas**, porque una sesión que ya tiene la configuración
cargada no puede medir si esa configuración aporta.


**Feature slug:** eleccion-de-stack
**Goal:** que el protocolo elija el stack en vez de sólo detectarlo: una novena pregunta de Intake
con el tipo de producto (A-H), una matriz con evidencia fechada, y la regla de arrancar siempre en
plan gratuito con su detector y su tabla de escalado
**Status:** in progress — fases 1.5 a 7 cerradas. Falta el receipt, que es lo que LAW 8 exige para publicar

## Alcance de este ciclo

Termina cuando `docs/spec.md` está escrita y aprobada. El build **no** entra: la spec describe los
gates nuevos, construirlos es otro ciclo con su test rojo primero. El plan aprobado vive fuera del
repositorio, en el directorio de planes de Claude Code de quien lo corrió: no se cita su ruta acá
porque este archivo se publica y esa ruta lleva el nombre de usuario de una persona.

Fuera de alcance, explícito: deploy, cualquier recurso cloud, y las etapas 5-9 de
`docs/spec-ia-stack.md` (README corto, índice propio, tablero, memoria+sereno, lanzamiento).

## Decisiones tomadas antes de abrir el expediente de fases

Se registran acá porque se respondieron durante la planificación, antes de que existiera
`docs/phase-decisions.json` para este ciclo. Las que correspondan a una fase se sellan en su cierre.

- Identidad: IA Stack v1.0.1 **evoluciona este repositorio**, no es un proyecto nuevo. La carpeta
  `Desktop\Claude\ia-stack` está vacía y no se usa.
- Versionado de dos relojes: el protocolo sigue su cuenta (próximo release 2.1.0); «IA Stack 1.0.1»
  nombra la capa nueva de elección de stack.
- Research: los cuatro ejes — web + límites reales del plan gratuito, adaptadores de test rojo,
  Python/cómputo pesado, escritorio/híbrido.
- Regla $0: gate mecánico + matriz de escalado, no sólo documento.
- Sede de la elección: **ampliar la fase 1.5 INTAKE**, no crear una fase 0. Razón mecánica
  reproducida: anteponer `"0"` a `phase_order` invalida el hash de la primera decisión sellada.
- Expediente: archivar el ciclo cerrado byte a byte y abrir uno nuevo.
- Vocabulario de fases: arreglar los tres lugares, incluido el `CLAUDE.md` global del usuario.
- Adaptadores RED: despachador + pytest + vitest, descritos en la spec, construidos después.
- Chequeos de período (tablero, sereno, ablación): **diferidos** al cierre de este ciclo.
- `.vibe/SESSION.md` de otra funcionalidad: archivar y arrancar limpia.

## Estado verificado — fase 1 (Bootstrap)

Línea base antes de tocar el árbol: 1480 pruebas, 1479 verdes, 1 salteada, 0 fallos.

- Runtime del proyecto estaba tres días atrasado: le faltaban los gates de `threat` y `deploy`.
  Resincronizado, 226 archivos. Los destinos globales fueron a un scratch para no tocar la
  configuración de Claude Code del usuario.
- Expediente cerrado archivado a `docs/cycles/research-cycle-2026-08-29/`, movido con `git mv` para
  no alterar un byte. Sello verificado después del movimiento: 2 decisiones encadenadas, verde.
- Expediente nuevo abierto: `phase_order ["1.5","2","3"]`, feature `eleccion-de-stack`, sin
  decisiones todavía. `verify-phase-decisions` escribe `VACÍO:` y sale 0, que es lo correcto.
- Vocabulario de fases unificado en los tres lugares que decían 9, 6 y 7.
- Suite al cerrar la fase: **1485 pruebas, 1484 verdes, 1 salteada, 0 fallos**.
- Gates transversales verdes: runtime-sync, vcp-contract (131 promesas, 105 límites), vcp-index
  (342 archivos), empty-probe, menu-shape, audit-chain.

## Estado verificado — fase 1.5 (Intake)

- Novena pregunta construida con su test rojo primero: `tipo_de_producto` como enum cerrado A-H más
  un motivo obligatorio para los ocho códigos, no sólo para `H`.
- `docs/intake/eleccion-de-stack.json` escrito y verde: 8 respuestas, 4 supuestos, 5 riesgos,
  3 preguntas abiertas, 0 bloqueantes.
- Decisión de fase sellada en `docs/phase-decisions.json`: tipo **F**, integración o proceso interno.
- Suite al cerrar la fase: **1493 pruebas, 1491 verdes, 2 salteadas, 0 fallos**.
- Contrato: 131 promesas, **107** límites honestos (eran 105 al abrir el ciclo).

### Respuestas del Intake que cambian el diseño

- **Para terceros primero, no para el autor.** El usuario eligió la vara más alta de las tres: cada
  recomendación necesita fuente oficial y fecha, no criterio interno.
- **El repositorio publicado tiene que quedar limpio de datos del autor.** Los dos proyectos privados del autor se
  leen para derivar el patrón; lo que se publica es genérico y con fuente. Lo que el protocolo
  aprenda de un proyecto se queda en ese proyecto. Es el defecto rojo #3 de `docs/spec-ia-stack.md`
  convertido en regla de diseño, y está anotado como riesgo R1 del Intake porque hoy depende de
  disciplina humana y no de un detector.
- **Hace falta una tabla navegable de la matriz.** Suma alcance de construcción: se hace después del
  spec y desde el mismo dato, nunca a mano.

## Estado verificado — fases 2 (Research) y 3 (Spec)

- Cuatro ejes de research contra documentación oficial, con cuatro fichas pineadas en
  `research/sources/`. Cada afirmación lleva URL y fecha de consulta.
- Los 7 diagnósticos canónicos válidos, más un octavo artefacto nuevo: la matriz de los ocho tipos
  de producto. Es seguro agregarlo porque `verify-product-diagnostics` sólo itera su lista fija.
- Corrida de Discovery `run-001`: dos decisiones encadenadas por hash y un packet con 12 claims de
  tipo web. El gate de fuentes declara honestamente que esos 12 quedan sin verificar porque no sale
  a la red.
- `docs/spec.md` escrita: 559 de 650 palabras, forma de calidad válida, diez criterios con gramática
  canónica, y la superficie de ataque nombrada porque el árbol declara un modelo de amenaza.
- Las tres decisiones de fase selladas y encadenadas; el menú completo verifica contra el plan.
- Suite al cerrar: **1494 pruebas, 1492 verdes, 2 salteadas, 0 fallos**. Cobertura 48/48 scripts.
  Contrato: 131 promesas, **108** límites honestos (eran 105 al abrir el ciclo).

### Tres hallazgos del research que cambiaron una decisión

- **pytest y vitest se falsificaron empíricamente**, con cero pruebas fallando y salida distinta de
  cero. Los dos ejecutan configuración del proyecto con acceso al reporte y al código de salida, y
  las opciones que cierran el vector rompen cualquier proyecto real. Es una diferencia categórica
  con el adaptador nativo, no de grado. Los adaptadores se construyen igual, porque hoy un proyecto
  Python no puede pasar LAW 1 en absoluto, pero con la garantía declarada como menor y con el
  receipt registrando cuál se usó.
- **La última versión publicada no es la usable.** `typescript@latest` es 7.0.2 y
  `typescript-eslint` lo excluye por rango de pares, llegando como dependencia dura de
  `eslint-config-next`. La matriz fija versiones exactas, nunca «la última estable».
- **El costo de escalar casi nunca es un número que se pueda ver venir.** La cláusula de uso
  comercial de un proveedor no tiene contador ni alerta, y la firma de código en Windows exige token
  físico con la opción económica limitada por región.

### Un verde falso, encontrado y declarado

`verify-evidence-trace criteria` aprobó los diez criterios de la spec nueva contra títulos de
`verify-audit-chain.test.mjs`, que son criterios de otra funcionalidad. El gate empareja por
identificador literal y los identificadores no llevan el slug; como la plantilla numera desde `AC1`,
el solapamiento es la regla y no la excepción. Es más grave que el límite de suficiencia que el repo
ya declaraba: ahí la prueba al menos hablaba del mismo criterio. Declarado como límite honesto 108 y
escrito en la tabla de riesgos de la spec, con su consecuencia: ese verde **no** cuenta como
cobertura hasta que exista la prueba nombrada en cada criterio.

## Estado verificado — fases 5 a 7 (Build, Triangulate, Test, Simplify)

Se construyó el pedazo mínimo que la spec define: el gate de la matriz con su contrato de límites de
plan gratuito. Seis tareas atómicas, cada una con su test rojo visto primero. ADR 0001, el primero
del repositorio.

### Clasificación de riesgo de la fase 7.1, mecánica

- `risk_level`: **crítico**
- `risk_reasons`: `sensitive_path` (el diff toca cinco archivos de `contracts/`, que `PROJECT.md`
  lista como sensibles porque un contrato corrupto hace que los gates validen contra algo falso) y
  `large_change` (6.710 líneas, muy por encima de las 400; por sí sola nunca promueve, y acá
  acompaña).
- No aplican: `simplify_ignore_touch` —cero marcadores en el diff— ni `debt_reopened`, porque
  `DEBT.md` no registra ningún `archivo:línea`.

Lo que el Boy Scout encontró y sacó: **la regla del período estaba escrita dos veces y las dos copias
no decían lo mismo.** `validateLimits` rechazaba por encima del techo y `validateFreshness` no, así
que llamada sola aceptaba un período de diez mil años. Unificada en una sola función, con su prueba.

### La ronda adversarial, que es lo que más dejó

Tres atacantes en paralelo, ninguno autor del código. Lo que trajeron, verificado antes de aceptarlo:

- **El dato era lo peor.** Dieciséis números del contrato no existían en la ficha pineada. El patrón
  era *relleno hacia abajo*: lo que la ficha decía estaba bien copiado, y lo que no decía se
  completaba igual, justo en los campos que nadie mira hasta que llega la factura. Más un `hard:
  true` sobre exactamente lo que la ficha había declarado no verificado, una versión de vitest que
  ninguna ficha contiene, y la restricción de Numba invertida.
- **Las pruebas probaban menos de lo que parecía.** Noventa mutaciones, veintiséis huecos reales. La
  peor: la prueba que decía cubrir la distinción entre archivo corrupto y archivo ausente sobrevivía
  a que se reintrodujera la regresión exacta, porque su regex matcheaba la subcadena del nombre del
  archivo. **La prueba se aprobaba a sí misma.**
- **La lógica tenía un agujero real.** El contrato se abría con ruta cruda mientras el comentario
  prometía la garantía para los dos archivos: reproducido con un enlace de directorio, el gate leyó
  su contrato desde fuera del proyecto y aprobó.

**Y un hallazgo de diseño: una regla que obliga a mentir es peor que una que se pone roja.** La
exención de referenciar un servicio era una lista de tipos, y para que el tipo D entrara hubo que
escribirle a la firma de código un `plan_name` que no es un plan y un centinela numérico para un
valor que no es número. La exención pasó a ser un motivo escrito por fila.

## Reglas nuevas de este ciclo, cada una con su detector

- **El frontmatter de una skill no puede contradecir el conteo canónico de fases.** Detector:
  `descripcionesDeFrontmatter` en `tests/fases-canonicas.test.mjs`. Nació de una herida real: el
  puntero de Codex decía «Protocolo de 9 fases» mientras el cuerpo del mismo archivo decía «son once
  fases», y ese archivo lo copia el instalador a cada proyecto.
  **Límite honesto:** mira el frontmatter, no la prosa.
- **Una exclusión de Graphify que termina en `/` es una carpeta y cubre lo que viva abajo.**
  Detector: `compareCoverage` en `scripts/verify-graphify-manifest.mjs`, con sus tres pruebas.
  **Límite honesto:** un prefijo no hereda la regla de contradicción, porque afirma «lo que viva acá
  abajo no obliga a regenerar el grafo», no «esto no merece un nodo». Un prefijo sin ningún archivo
  rastreado abajo sigue rechazándose como exclusión muerta.
- **Un grafo viejo no es una cobertura mentida.** Si un archivo rastreado nació después del
  manifiesto, el gate escribe `DESACTUALIZADO:` con los nombres y sale 0; si ya existía cuando el
  grafo se construyó y falta, rechaza. Detector: las cuatro pruebas de fecha en
  `tests/verify-graphify-manifest.test.mjs`. **Límite honesto:** la edad se lee de la fecha de
  modificación, y `git checkout` o un clon la reescriben. El error cae del lado seguro.
- **El frontmatter de una skill dice cuántas fases son, y el gate de menús tolera la marca de
  recomendación fuera de una opción.** Los dos límites quedaron declarados (106 y 107).

### El verde falso se cerró cambiando qué IDENTIFICA a un criterio

El límite honesto 108 decía que los identificadores de criterio no llevan el nombre de la
funcionalidad, y que como la plantilla numera desde `AC1`, **dos specs cualesquiera solapan sus
identificadores desde el primero**. Medido: una spec recién escrita con diez criterios y cero
pruebas propias salía en verde contra títulos de otro archivo.

La corrección no fue endurecer el emparejamiento sino **cambiar la identidad**: un criterio es el
par `funcionalidad + id`, y la prueba tiene que nombrar los dos. **La funcionalidad sale del título
de la propia spec**, no de una bandera — quien corre el gate no puede equivocarse de funcionalidad
ni elegir la que le conviene. Y una spec con criterios y sin ese título **se rechaza**: degradar al
emparejamiento viejo habría dejado la puerta abierta a recuperar el verde falso borrando una línea.

La colisión estaba viva en el repositorio, no en teoría: `tests/verify-intake.test.mjs` tiene
títulos `AC2 ·` y `AC6 ·` que son criterios de otra funcionalidad.

**Lo que costó, y que quedó declarado como el límite residual**: todo título escrito antes de este
cambio lleva el id solo, así que correr `criteria` contra una spec vieja reporta todos sus criterios
sin cubrir. No es que falten las pruebas — es que su traza no está escrita, y migrarla es prueba por
prueba, porque decidir cuál prueba responde a cuál criterio es juicio. Elegir mal produce una traza
que miente, que es peor que no tenerla.

### Cuatro guardas más que no se podían alcanzar

Construir los tres adaptadores dejó cuatro guardas defensivas que el gate de cobertura marcó como
inalcanzables: una caída `?? 'sin detalle'` después de un `String(...).trim()`, que nunca es nulo;
dos comprobaciones de contención que repetían lo que la línea anterior ya había rechazado; y un
valor por defecto en una función privada a la que quien la llama siempre le pasa el valor.

**La respuesta a las tres primeras no fue borrarlas sino reemplazarlas por la buena.** Las dos de
contención comparaban texto, y comparar texto no ve un enlace simbólico adentro del proyecto que
apunte afuera. Ahora las dos usan `isContainedProjectPath`, la contención del protocolo, que
resuelve con `realpath`. Escribir una segunda implementación más débil al lado de una ya endurecida
es como se abren los agujeros que después nadie encuentra — y la señal de que estaba pasando fue,
literalmente, que la guarda no se podía ejecutar.

### El gate de cobertura encontró código muerto, no falta de pruebas

Dos guardas defensivas del gate nuevo eran **inalcanzables**: la deduplicación por línea —cada clase
de hallazgo tiene un único lugar que la anota, así que el `Set` nunca daba verdadero— y la caída del
índice de línea, que sale del mismo `split` que los hallazgos. La respuesta correcta no era
inventarles una prueba para tapar el rojo: era **sacarlas**. Una guarda que no se puede alcanzar es
una afirmación falsa sobre lo que el código considera posible.

### Una regla mía que el dato mostró equivocada, otra vez

El gate rechazaba cuando encontraba el contrato de límites sin la matriz: «una recomendación sin su
contrato no dice qué cuesta crecer», y al revés. Era correcto **mientras la matriz fuera un artefacto
por proyecto**. Desde que la matriz y el contrato viajan los dos adentro del runtime, el contrato
está presente en toda instalación desde el minuto cero, así que su presencia no dice **nada** sobre
si este proyecto eligió stack — y rechazar ahí convertía el estado normal de cualquier instalación
nueva en un incumplimiento. Lo encontró la sonda de carpeta vacía. La mitad que sí se sostiene es la
otra: una matriz sin su contrato sigue rechazando.

Misma forma que las dos anteriores del ciclo —`free_tier_refs` y `escalation`—: **la regla empujaba
al dato a decir algo falso**, y el arreglo no fue parchear el dato sino replantear la regla.

### La contención tenía la raíz equivocada, no sobraba

Primer intento del arreglo: contener el contrato contra la raíz del proyecto, como la matriz. Lo
rompió la sonda de carpeta vacía en el acto — el runtime vive **legítimamente** afuera del directorio
que se sondea. La contención no sobraba: estaba anclada donde no correspondía. Ahora cada ruta se
contiene contra su propia raíz —la matriz contra el proyecto, el contrato contra el runtime— y el
ataque original del enlace de directorio sigue cortado. El límite que eso deja abierto quedó
declarado: **el gate no comprueba cuál runtime está leyendo**, confía en la carpeta donde vive.

### La misma herida, tres veces en una sesión

Archivar un expediente, archivar una sesión y escribir el archivo de Intake dejaron el gate de
Graphify en rojo, y en ninguno de los tres casos había una cobertura falsa. La primera corrección
—exclusiones por prefijo— sólo tapaba el caso de archivo muerto. La tercera repetición mostró que
faltaba la distinción de fondo entre *viejo* y *deshonesto*, que es la que cerró el defecto.

## Mediciones que evitaron trabajo equivocado

- **La forma ancha del detector de fases se midió antes de escribirla**: agregaba 12 coincidencias
  sobre lo versionado y sólo 3 eran afirmaciones sobre este protocolo. Las otras 9 eran subconjuntos
  legítimos, fases de otras herramientas descritas en `research/sources/`, y afirmaciones viejas
  dentro de fuentes pineadas. Ensanchar habría producido ocho rojos falsos.
- **La medición de los adaptadores se repitió en un entorno virgen**, que era el hueco que el
  research había declarado sin verificar: intérprete virtual con `pytest==9.1.1` y cero puntos de
  entrada `pytest11`, y un proyecto nuevo con `vitest@5.0.0` solo. **Los tres complementos que había
  en la máquina no eran la causa de nada**: los dos ataques se reprodujeron idénticos —prueba que
  pasa, gate que ve un rojo— y los discriminadores estructurales se sostuvieron uno por uno. Dejó
  un refinamiento: el error de fixture de pytest produce una última línea con la **misma forma** que
  un fallo de aserción (`<archivo>:<línea>: <Excepción>`), así que el discriminador entre esos dos
  tiene que ser el par `errors`/`failures`, nunca la línea sola. Queda en
  `research/sources/adaptadores-red-2026-09-14.md`.
- **Correr los adaptadores contra los runners de verdad encontró un falso negativo que la batería
  no veía.** vitest informa la ruta del fallo **absoluta**; pytest la informa relativa al rootdir.
  Los fixtures se habían escrito desde la ficha de research, que cita rutas cortas, así que las 15
  pruebas del adaptador pasaban y **el rojo genuino salía RECHAZADO** contra vitest real. El
  adaptador rechazaba exactamente lo que tenía que aprobar. Ahora acepta una ruta absoluta que caiga
  adentro del proyecto, y habla siempre en rutas del proyecto — una ruta absoluta impresa lleva
  adentro el nombre de usuario, y ese mensaje termina en registros de CI.

- **El gate de repositorio limpio encontró contaminación real en su primera corrida.** Antes de
  escribirlo se midió qué había: el nombre de usuario del autor aparecía **siete veces en tres
  archivos versionados y ya publicados** —un expediente de discovery, una fuente pineada y cinco
  fixtures de firma—, más dos rutas de usuario en otro test. Ninguno de los tres estaba sellado, así
  que los siete se limpiaron. Las dos rutas eran un marcador legítimo y quedaron declaradas. Medir
  antes de diseñar dio además la forma de la regla: **buscar por forma y por identidad de máquina, y
  jamás por una lista de nombres** — una lista de nombres adentro del repositorio sería publicar
  exactamente el dato que se quiere proteger.

- **Instalar el protocolo en un proyecto ajeno encontró un defecto que las 1580 pruebas no veían.**
  Al cerrar el lazo del stack se simuló una instalación real y se corrió el gate desde ahí:
  `REJECTED: ... falta contracts/free-tier-limits.json`. La causa es que el gate abría su propio
  contrato con una ruta relativa al directorio de trabajo, y **en este repositorio la raíz del
  runtime y la del proyecto son la misma carpeta**, así que funcionaba por coincidencia. Instalado,
  el runtime vive en `.vibe/ia-stack-runtime/` y la ruta no existe. Es el caso puro de que la batería
  verde no cierra un gate y el dato real sí: ninguna prueba unitaria podía ver una coincidencia de
  rutas que sólo se rompe al mudar el código de máquina.

## Intentos fallidos

(ninguno todavía en este ciclo)

## Retomar acá

El ciclo de diseño cerró. Lo que sigue es **otro ciclo**, el de construcción, con su propio
expediente de fases: los siete pasos están en `implementation.json` del expediente de Discovery, con
su comando de validación y su dependencia. El primero es el gate de la matriz, con su test rojo
primero.

De las dos cosas que el research dejó anotadas, **una está resuelta**: la medición de los adaptadores
se repitió en un entorno virgen y todo se sostuvo, así que el predicado se puede fijar sobre lo
medido. Queda la otra: decidir cómo se cierra el solapamiento de identificadores de criterio.

**El lazo del stack está cerrado.** La matriz se mudó de `docs/` a `contracts/stack-matrix.json` —el
instalador copia `contracts/` y no copia `docs/`, así que desde `docs/` no llegaba a nadie—, se
escribió `skills/stack.md` como copia legible con su prueba pareada, y la fase 1.5 de `SKILL.md`
ahora manda leer la matriz y contestar con stack, fuente, fecha y costo de escalar. Verificado
instalando en un proyecto limpio, no sólo con la batería.

**AC9 está construido.** `scripts/verify-repo-clean.mjs` busca dos cosas en lo versionado: rutas con
forma de directorio personal, y la identidad de la máquina que lo corre, resuelta en el momento con
`os.homedir()` para que **ninguna lista de nombres quede escrita en el repositorio**. Las excepciones
se declaran una por una en `contracts/repo-clean.json` con archivo, texto y motivo, y ningún archivo
está exento por su clase — el propio contrato se marca a sí mismo y declara su excepción. Corre en la
fase 6, antes de sellar, porque una filtración que entra a `.vibe/AUDIT.md` no se saca. Su límite
está declarado y es grande: **no detecta nombres**, y de las cuatro filtraciones reales que lo
motivaron habría encontrado dos.

**Los diez criterios están construidos Y con traza verificable.** Los casilleros de `docs/spec.md`
pasaron a `- [x]` recién ahora, cuando cada uno tiene una prueba que lo nombra con su funcionalidad
— antes el verde de `evidence-trace criteria` era falso y marcarlos habría sido firmar sobre un gate
que se sabía roto.

- **AC6** · `scripts/verify-red.mjs` es el despachador: resuelve el comando contra
  `contracts/red-adapters.json` por **igualdad exacta** y no adivina nunca. `pytest` declarado no
  habilita `pytest -q`, porque las opciones cambian la forma del reporte.
- **AC7** · `scripts/verify-red-pytest.mjs` clasifica sobre el JUnit XML por contadores, no por
  prosa ni por exit code, y comprueba contra el fuente que la línea señalada tenga un `assert`.
- **AC8** · el receipt exige `red_adapter` en todo criterio cuyo comando invoque un adaptador, y
  **la garantía se resuelve contra el contrato, no se copia**: declarar `fuerte` a mano sobre un
  adaptador que el contrato dice `menor` se rechaza. El resumen del receipt cambia de texto cuando
  hubo verdes de garantía menor.
- Además `scripts/verify-red-vitest.mjs`, que la matriz de stacks ya nombraba para los tipos B y C.

**Un proyecto Python ya puede pasar LAW 1**, que era lo que este ciclo venía a destrabar.

Los tres adaptadores se corrieron contra los runners reales, no sólo contra fixtures: nueve casos de
pytest y siete de vitest, más los dos ataques. **Los dos ataques aprueban**, y eso está declarado
como límite honesto en vez de disimulado — es la diferencia entre una garantía menor escrita y una
garantía menor escondida.

## Comparar contra otro protocolo destapó tres defectos, dos de seguridad

Se estudió `quant-dhawan/dovsky` —un plano de control local para correr agentes: demonio, SQLite,
sandbox de bubblewrap, aceptación humana explícita— contra IA Stack. Resuelven **el mismo problema
desde extremos opuestos**: IA Stack es un protocolo que el agente sigue y cuyos gates verifican
artefactos sobre el árbol que el propio agente controla; dovsky es un runtime que **aísla** al agente
y sólo aplica el delta capturado después de que los gates del anfitrión pasan. El contraste es lo
que dejó ver lo siguiente.

### 1. El gate de repositorio limpio escaneaba el árbol de trabajo, y lo que se publica es el blob

**Reproducido.** git guarda un enlace simbólico como un blob cuyo contenido es **la ruta destino**.
Un enlace rastreado a `/home/<alguien>/.config/secretos` publica esa ruta personal — y el gate leía
con `readFileSync`, que **sigue el enlace**: leía el destino y nunca el texto. Un repositorio que
publicaba una ruta personal salía en **verde**. Ahora lee el blob con `git show :<ruta>`, que es
exactamente lo que recibe un clon, y el ataque se rechaza.

### 2. El mismo gate fallaba ABIERTO, y su hermano ya fallaba cerrado

Un archivo rastreado que no se podía leer se contaba como «salteado» y no pasaba nada.
`verify-security-baseline.mjs` ya hacía lo correcto —un fuente ilegible es severidad alta— así que
**el protocolo ya tenía el patrón bueno y el gate nuevo no lo seguía**. La asimetría entre dos gates
que escanean la misma superficie era el defecto de fondo. Corregido: ahora rechaza.

### 3. La cobertura del 100% valía sólo en esta máquina

Clonar el propio repositorio en limpio mostró que `verify-ia-stack-coverage` **rechazaba**: dos ramas de
`verify-graphify-manifest.mjs` sólo se ejecutaban si existía `graphify-out/`, que está en
.gitignore. **Un verde que depende de un directorio ignorado es un verde de una carpeta, no del
repositorio**, y la frase «cobertura 100%» escrita en los mensajes de commit era local. Cubierto con
carpetas descartables; ahora vale para cualquiera.

### 4. Y el gate nuevo habría roto la integración continua antes de existir

Preparando el CI: en un runner de GitHub la cuenta se llama `runner`, palabra que este protocolo usa
en **72 de sus 393 archivos**. La comprobación de identidad habría dado 72 falsos positivos en cada
corrida, y **un gate que grita siempre se termina apagando**. Se agregó una regla de frecuencia con
el umbral sacado de la medición —la filtración real eran 3 de 393, un 0,8%, contra un 18%: veinte
veces de separación— y un piso de corpus de 20 archivos, que es donde un único archivo deja de poder
superar el umbral solo. La mitad ruidosa se apaga **diciéndolo**, y su precio quedó declarado.

### Lo que no se trajo, y por qué

**Actualizado el 2026-09-15: las tres se decidieron una por una en `docs/adr/0002-las-tres-ideas-de-dovsky.md`.**
La prueba de vida del candado **se adoptó** (`verify-lock-vivo.mjs`, con tres estados y no dos); la
revalidación del árbol contra la evidencia **ya estaba implementada** y nadie lo había mirado
(`tree_fingerprint` en el receipt, con prueba); exigir mecánicamente la aceptación humana **se
declinó**, con el motivo del operador escrito; y el aislamiento del agente **no se adopta**, con sus
tres razones. Lo que sigue es la nota original, que quedó desactualizada:

De dovsky quedaron tres ideas medidas y **no adoptadas**, porque son cambios de arquitectura y no de
gate: prueba de vida del proceso (PID + boot id + *start ticks*, con un estado explícito
`reconcile_required` cuando no se puede probar); aceptación humana mecánicamente exigida, con el
árbol revalidado contra la evidencia; y aislamiento del agente con aplicación de delta en vez de
edición directa del árbol. Las tres cierran huecos que IA Stack hoy **no** cubre, y las tres
merecen una decisión aparte.

## Tres decisiones tomadas sobre los hallazgos de la comparación

**La integración continua se saca, por decisión tuya.** Se agregó, se publicó, corrió, y se retiró en
el commit siguiente. Queda anotado lo que costaba y lo que compraba: los gates vuelven a correr sólo
en la máquina de quien desarrolla, y **nadie que clone puede comprobar nada sin correrlo a mano**.
Ese hueco vuelve a estar abierto y ahora está escrito. Lo que el CI sí alcanzó a demostrar antes de
salir es que la cobertura del 100% dependía de una carpeta ignorada — ese arreglo se queda.

> **CORREGIDO EL MISMO DÍA, Y ESTO ES LO VIGENTE: el CI está adentro.** El párrafo de arriba quedó
> escrito sobre una decisión que se tomó con un dato que te di MAL — se dijo que el flujo consumía
> minutos de tu cuenta. Eso es cierto en repositorios privados y **falso en éste, que es público**:
> ahí GitHub Actions no tiene costo ni tope. Con el dato corregido revisaste la decisión y el flujo
> volvió. La historia lo muestra en tres commits: `d85bb1a` lo retira, `2b3758a` lo restituye, y hoy
> `.github/workflows/ci.yml` existe y corre.
>
> **No se borra lo que decía el párrafo de arriba, a propósito.** Un registro de sesión es lo que se
> pensó en ese momento, y reescribirlo para que cierre con el presente es la misma clase de cosa que
> editar un packet sellado. Y además el registro de que una decisión se tomó sobre un dato falso vale
> más que disimular que pasó.

**Los tres chequeos de período se corrieron, y los tres estaban sanos: vencidos, no rotos.** Dos se cerraron el 2026-09-15; la tercera sigue vencida y la columna de la derecha dice dónde quedó cada una.

| Chequeo | Qué dijo entonces | Dónde quedó |
|---|---|---|
| Sereno (auto-mejora) | TOCA: 10 días desde la última ronda, el período es 7 | **Cerrado** el 2026-09-15: cuatro propuestas, y las cuatro implementadas ese mismo día |
| Ablación (limpieza medida) | TOCA: 13 días desde la última, el período es 7 | **Sigue vencida.** Pide medir ocho tareas reales del operador en sus otros proyectos, antes y después de archivar cada tanda; un registro coherente e inventado pasa ese gate en verde, y eso es el verde falso que el protocolo existe para impedir |
| Tablero | TOCA: 10 días desde el último, el período es 7 | **Cerrado** el 2026-09-15: 18 proyectos, fuera del árbol como el propio script exige |

Ninguno estaba roto en silencio, que era la pregunta. Los tres saben responder y venían
respondiendo; nadie les preguntaba. Correrlos es trabajo aparte y sigue pendiente.

**Lo que se construye es la firma humana**, que era el más barato de los tres huecos y el que más
cambia: hoy `terminal_state: approved` lo escribe el agente y nadie más lo revisa.

## El grafo, reconstruido

La prueba de cobertura del grafo venía salteada desde que empezó el ciclo, con el motivo escrito:
*«el grafo se construyó antes que 50 archivos rastreados, así que todavía no los cubre… esto NO dice
que la cobertura esté bien: dice que no se pudo mirar»*. Se reconstruyó con `graphify update`, que es
la reextracción determinista y **no usa LLM ni sale a la red**.

**3565 nodos, 4958 aristas, 281 comunidades** sobre 389 entradas de manifiesto. El gate pasó de
`DESACTUALIZADO` a `OK: cubre 387 archivo(s) rastreado(s) con cada exclusión declarada`, y la suite
bajó de 2 salteadas a 1 — la que queda es el guard de `~/.claude`, que es opt-in por diseño.

Se comprobó que los archivos nuevos estén **en el manifiesto** y no absorbidos por una exclusión: los
trece que se miraron —los tres adaptadores, el despachador, el gate de repo limpio, los cuatro
contratos nuevos, `skills/stack.md`, dos pruebas y la ficha de research— están indexados.

**Lo que NO se hizo, y queda anotado:** el conjunto de comunidades cambió (250 etiquetas guardadas,
281 comunidades ahora; 28 renombradas por su nodo central). Refrescar esos nombres es `graphify
label`, que **sí llama a un LLM externo**, así que no se corrió. Las comunidades renombradas por hub
son descriptivas pero no curadas.

Y el aviso de la propia herramienta: **84 archivos fuente produjeron cero nodos** y están ausentes
del grafo — casi todos JSON de datos, que no tienen código que extraer. El manifiesto los cubre
igual; el grafo no los representa. Son dos cosas distintas y conviene no confundirlas.

## No verificado

- que las diez pruebas nombradas por los criterios de la spec existan: no verificado — ninguna está
  escrita todavía, y el gate que debería detectarlo da un verde falso por solapamiento de
  identificadores. Se comprueba recién cuando el ciclo de construcción las escriba.
- qué reportarían el tablero, el sereno y la ablación: no verificado — los tres chequeos de período
  se difirieron por decisión registrada arriba, así que no se corrieron.
