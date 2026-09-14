# Session — 2026-09-14

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
  el runtime vive en `.vibe/vcp-runtime/` y la ruta no existe. Es el caso puro de que la batería
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

**Lo que sigue sin construir de la spec**: el despachador de test rojo y los adaptadores de pytest y
vitest, o sea AC6, AC7 y AC8. Siete de los diez criterios están construidos; los tres restantes
siguen vacíos a propósito.

## No verificado

- que las diez pruebas nombradas por los criterios de la spec existan: no verificado — ninguna está
  escrita todavía, y el gate que debería detectarlo da un verde falso por solapamiento de
  identificadores. Se comprueba recién cuando el ciclo de construcción las escriba.
- qué reportarían el tablero, el sereno y la ablación: no verificado — los tres chequeos de período
  se difirieron por decisión registrada arriba, así que no se corrieron.
