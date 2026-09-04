# Changelog

All notable changes to VibeCodeProtocols are documented here.
Format: [Keep a Changelog](https://keepachangelog.com) — Semantic Versioning.

---

## [Unreleased]

- **Los identificadores de commit anteriores a la reescritura ya no resuelven.** Este registro nombra
  commits con el identificador que tenían cuando se escribió cada entrada, y la reescritura de
  historia se los cambió a todos. Son **doce** referencias en este archivo y en `SKILL.md`. No se
  corrigen a propósito: reescribirlas falsearía lo que se registró entonces. **El README sí se
  corrigió**, porque es documentación operativa —quien la lee corre lo que dice— y una prueba nueva
  comprueba que todo commit que el README nombra exista de verdad.

- **Se le pidió a GitHub que purgue los objetos huérfanos: ticket #4726900, abierto.** Antes de pedir
  nada se comprobó si hacía falta, y hacía falta: **siete commits previos a la reescritura siguen
  servidos**, y su contenido sigue recuperable por identificador. El force-push cambió lo que se ve
  por defecto, **no lo que se puede pedir**.
  - No existe endpoint de API para soporte, así que el pedido va por el formulario autenticado.
  - **La propia herramienta de GitHub confirmó el diagnóstico** antes de dejar abrir el ticket:
    reescribir la historia y forzar el push **no alcanza** si los commits viejos siguen accesibles
    por identificador directo, vistas cacheadas o refs de pull request.
  - El pedido lleva los datos que la documentación exige: **cero pull requests** afectados —así que
    no hay refs de PR reteniendo los commits viejos— y **cero objetos LFS huérfanos**, los dos
    verificados; más las puntas previa y actual, sin forks, sin releases y un solo colaborador.
  - **Límite:** que Soporte lo ejecute no depende de este repositorio. Hasta entonces el contenido
    sigue recuperable por identificador. Es seguible, no cerrable desde acá.

- **El verificador de la reescritura daba verde sin haber corrido.** Al borrar el respaldo se hizo un
  último barrido y aparecieron **dos revisiones** que la reescritura no había tocado. Dos fallas
  encadenadas, las dos de la familia que este repositorio se pasó el día arreglando.
  - **En las reglas:** un identificador sin su extensión no matcheaba ninguna regla, y el patrón de
    palabra completa tampoco, porque no hay borde de palabra en medio de un nombre compuesto.
    **Una lista sólo encuentra lo que ya pensó quien la escribió** — tercera vez en el día.
  - **En el verificador, y es la grave:** uno de sus patrones contenía una barra. Git Bash convierte
    las barras al pasar el argumento, git recibió una barra invertida final, lo rechazó con
    `fatal: Trailing backslash` y **salida 128**. El `2>/dev/null` tapó el error y el `| wc -l`
    contó cero líneas. **Cero líneas se leyó como cero rastros:** el comando nunca corrió, y el
    barrido dijo «historia limpia» tres veces seguidas.
  - **El arreglo que importa no es el patrón, es el criterio.** El verificador ahora mira el
    **estado de salida** de cada búsqueda y distingue los tres casos que git devuelve —hubo
    coincidencias, no hubo, o falló—, y si algo falla sale con error diciendo **«no se pudo
    verificar»** en vez de imprimir un total. **Un comando que no corrió no es un verde.**
  - Tercera pasada sobre las 162 revisiones y verificación con el verificador arreglado: cero
    rastros en contenido, en mensajes de commit y en nombres de archivo.
- **El respaldo con la historia vieja se borró**, junto con las otras **49 copias** que quedaban en
  el directorio temporal de la sesión —incluido el registro sin redactar completo—, borradas una por
  una y nombradas, nunca con un borrado recursivo sobre un directorio. Antes de sacar la red se
  verificó que el repositorio estuviera completo: 162 commits, cero objetos rotos, árbol limpio y
  sincronizado con el remoto.

- **La historia de git fue reescrita, con autorización explícita, y lo que quedaba expuesto ya no
  está.** Las tres superficies que la redacción de la punta no podía alcanzar —el blob sin redactar,
  los cuerpos de los mensajes de commit y las líneas de `AUDIT.md`— se limpiaron de raíz.
  - **160 commits reescritos** sobre todas las refs, en dos pasadas, con las **mismas reglas** para
    el contenido y para los mensajes: un mensaje que reconstruye la fuga y nombra el commit donde
    mirarla es tan público como el archivo.
  - **Qué se sacó:** nombres de producto y versión, rutas internas de otro árbol, el mapa de dónde
    vive la validación y la generación de licencias y los pagos, la cita de un hallazgo de seguridad
    con archivo, líneas y mecanismo, las rutas absolutas con el usuario del sistema, y la coordenada
    que un mensaje daba para ir a buscar el texto sin redactar.
  - **Verificado después, no supuesto:** **cero rastros** en contenido, en mensajes de commit y en
    nombres de archivo, en las 160 revisiones de todas las refs. El barrido busca por patrón, no por
    la lista con la que se limpió — la lección que este repositorio ya había pagado una vez.
  - **La única mención que sobrevive** es la de un asistente ficticio de cine, en la transcripción de un video
    estudiado. No es del autor y se excluyó a propósito.
- **La cadena de auditoría se re-selló, y lo que eso cuesta está escrito dentro de ella.** La cadena
  encadena por hash el **texto** de cada línea, así que reescribir siete líneas invalidó sus sellos y
  los siguientes. Se recalcularon con la misma función que usa el gate, **sin borrar ni reordenar
  una sola línea**; la traza vuelve a cerrar sobre 109.
  - **El sello ya no prueba que el texto anterior sea el original**, sólo que nadie lo tocó después
    de la reescritura. Esa garantía se rompió a propósito y con autorización, y por eso queda
    declarada **adentro** de la cadena y no afuera.
  - `verify-audit-chain history` rechaza el par de commits donde ocurrió el re-sellado, porque exige
    crecimiento sólo-agregado. Es correcto que lo rechace: pasó exactamente eso.
- **Lo que no depende de este repositorio:** GitHub puede conservar los objetos viejos accesibles por
  su hash aunque el force-push los deje sin referencia. Sacarlos del todo requiere pedírselo a
  GitHub. La copia completa de la historia previa quedó en un bundle local, fuera del repositorio.

- **El README tenía una afirmación falsa sobre su propia herramienta y un mapa incompleto.**
  - **Falsa:** decía que la medición de cobertura «usa un worker por defecto» y que
    `VCP_TEST_CONCURRENCY` servía para subirlo. La constante del script se llama
    `DEFAULT_TEST_CONCURRENCY = '32'`, y la variable existe para **bajarlo** en una máquina con menos
    núcleos. El propio README lo decía bien treinta líneas más abajo: se contradecía consigo mismo.
  - **Vencida:** describía el empaquetador como «usa una allowlist… nunca incluye `.git`, `.env`,
    `node_modules` ni backups locales». Eso dejó de ser cierto en cuanto se supo que la allowlist
    sólo acota el nivel de arriba. Ahora dice lo que hace: arma el paquete desde `git ls-files`,
    archivo por archivo, y falla cerrado fuera de un repositorio.
  - **Incompleto:** la tabla de gates listaba **19 de 36**. Fue quedando atrás a medida que el
    protocolo crecía. Un mapa incompleto no miente en lo que dice, pero **omite en silencio**: nadie
    se entera de que existe un gate que nadie describió. Agregados los 17 que faltaban, cada uno con
    el límite que el propio gate declara en su cabecera; donde no había bloque declarado, con lo que
    su salida dice que comprueba.
  - **Una prueba lo mantiene sincronizado en las dos direcciones:** la tabla no puede omitir un gate
    que existe, y tampoco nombrar uno que ya no existe.

- **El empaquetador del release entregaba directorios y confiaba en que la lista blanca alcanzara.**
  La lista blanca acota el nivel de arriba y nada más: adentro de `scripts/`, `contracts/`,
  `tests/`, `skills/`, `templates/` y `examples/`, `zip -r` se lleva **todo lo que haya en disco**,
  versionado o no. Que hoy estuvieran limpios era una propiedad accidental, no un gate — la misma
  clase de defecto que este repositorio se pasó el día arreglando.
  - **El paquete se arma ahora desde `git ls-files`**, archivo por archivo, nunca un directorio
    suelto. Si el árbol no es un repositorio, **falla cerrado**: publicar sin poder distinguir lo
    versionado de lo local es peor que no publicar.
  - **La prueba vieja afirmaba «never local state or the full tree»** mirando sólo esa lista blanca,
    que no dice nada de lo que hay adentro de cada directorio. Renombrada a lo que de verdad
    comprueba, y acompañada de dos falsificaciones nuevas: un archivo **ignorado** plantado dentro de
    un directorio empaquetado no viaja, y el rechazo sin git ocurre **por el chequeo de git** y no
    por una herramienta ausente — un rojo por el motivo equivocado es una prueba hueca.
- **Los artefactos de investigación estaban ignorados uno por uno, con la fecha adentro del nombre.**
  Pesan cientos de megas y llevan código verbatim de catorce repositorios ajenos. El generado mañana
  no quedaba cubierto, y un `git add -A` lo publicaba. Ahora se ignoran **por patrón**, con una
  prueba que comprueba fechas futuras y una falsificación que verifica que ningún archivo versionado
  de `research/` cayó en la regla nueva.
- **Dos pruebas fallaron primero por `ReferenceError`** —`spawnSync` y `execFileSync` sin importar—,
  que es el rojo que el propio protocolo prohíbe porque no prueba nada. Corregidas antes de seguir.

- **Tres tags publicados seguían sirviendo el mapa que la redacción decía haber quitado.** Un
  crítico de completitud —cuya única pregunta era «qué quedó sin mirar»— encontró que las cinco
  lentes habían barrido **el contenido de los archivos en la punta**, y eso deja afuera todo lo que
  git publica sin ser un archivo del árbol actual.
  - `v1.2.0`, `v1.3.0` y `v1.4.0` servían `templates/vibe/PROJECT.md` con las rutas de licencia,
    generación de licencias, pagos y guard de riesgo de otro proyecto. **Un tag es una referencia
    independiente: arreglar la punta no lo toca, y reescribir la historia de `main` tampoco.**
    GitHub los ofrecía como `.zip` descargable.
  - **Borrados de `origin` y del repositorio local**, con autorización explícita. Verificado contra
    la API: quedan `v1.0.0` y `v1.1.0`, los dos limpios. Los commits a los que apuntaban siguen
    alcanzables desde `main`: se quitó la referencia, no el contenido.
- **La configuración local de Claude estaba protegida sólo por ignores de esta máquina.**
  `.claude/settings.local.json` —allowlists de permisos, rutas locales, configuración de MCP— caía
  bajo `~/.config/git/ignore`, y `.claude/worktrees/` bajo `.git/info/exclude`. **Ninguno de los
  dos viaja con el repositorio:** en un clon de otra persona, o acá mismo si se pierde ese archivo,
  un `git add -A` la publicaba. La regla ahora vive en el `.gitignore` versionado, con una prueba
  que comprueba **quién** ignora cada ruta, no sólo que esté ignorada — falsificada quitando la
  regla y viéndola caer.
- **Lo que queda expuesto, dicho y no tapado.** La historia de git conserva el registro sin redactar,
  y el cuerpo del commit de la redacción reconstruye la fuga y nombra el commit donde buscarla. La
  línea 123 de `.vibe/AUDIT.md` describe la clase de vulnerabilidad, el mecanismo y la coordenada.
  Las tres se arreglan sólo reescribiendo la historia, que **rompe la cadena de auditoría** —sus
  líneas están encadenadas por hash, y reescribirlas destruye justo la garantía que existe para
  dar—. Es una decisión aparte y sigue abierta. Hoy el repositorio tiene **0 forks y 0 releases**,
  así que es lo más barato que va a ser.

- **La redacción se dejó una referencia adentro, y la guarda que escribí para verificarla no la
  vio.** Después de redactar el registro se comprobó el resultado con una guarda construida a partir
  de **la misma lista de nombres** que la redacción. Por construcción sólo podía encontrar lo que la
  redacción ya había pensado, así que una referencia a un archivo de otro producto con
  rango de líneas y una regla de negocio concreta al lado— siguió publicada en un repositorio
  público hasta hoy. **Una lista sólo encuentra lo que ya pensó quien la escribió.**
  - Lo encontró una auditoría de **cinco lentes ciegas** —otro-proyecto, seguridad, datos
    personales, otra área, credenciales—, cada hallazgo verificado por tres escépticos con la
    instrucción de refutar. 179 agentes, 67 lecturas de archivo, 54 sospechosos, **7 confirmados**.
  - **El arreglo es de forma, no de lista.** Una prueba nueva rechaza **toda** referencia
    `archivo.ext:línea` dentro del registro, sin conocer un solo nombre de producto, y su
    falsificación usa el texto real que sobrevivió para que no se afloje. Se demostró en rojo
    contra el registro sin redactar antes de aplicarla.
  - **El detector de plantillas ya no nombra lo que prohíbe nombrar.** Listaba los productos que
    buscaba, así que el propio detector era la mención que decía impedir. Ahora busca la firma de
    una ruta que apunta afuera: una referencia con **una extensión que este proyecto no tiene**
    —lo versionado es `.mjs`, `.json`, `.md`, `.sh`, `.ps1`, `.html`, `.txt`— o una ruta absoluta
    con el home de un usuario. Acotarlo por extensión ajena es deliberado: las plantillas enseñan el
    formato con ejemplos legítimos como `auth.js:42`, y una guarda que los acusa se apaga al segundo
    día.
  - **La regla de PHASE 9 nombraba el producto que prohíbe nombrar.** Corregida.
  - **18 rutas con el nombre de usuario del sistema** salieron de 9 documentos de investigación,
    reemplazadas por `<home>`. Una de ellas era la ruta completa de una transcripción de sesión con
    su identificador.
  - **Límite honesto nuevo (79):** la comprobación por forma no entiende de nombres. Un producto
    ajeno nombrado **sin** ruta ni línea no lo ve ningún chequeo, y en las plantillas una referencia
    escrita en `.js`, `.ts` o `.html` pasa, porque esas extensiones sí son de este proyecto.
- **Cerrado el par de nodos que había quedado sin juzgar.** En la barrida de duplicados, los tres
  escépticos de un par murieron por límite de sesión y el par se resolvió a mano. Rejuzgado ahora
  con los mismos tres ángulos: **0 de 3 a favor de fusionar**, por la misma razón que los otros diez
  —un nodo es el encabezado del archivo con su línea, el otro es el concepto; cero vecinos en común—.
  El juicio manual queda confirmado por votos.

- **Un chequeo que no llegó a terminar decía que había fallado.** La suite fallaba de forma
  intermitente bajo `--test-concurrency=32` —**3 rojas de 6 corridas**— y la causa no estaba en el
  test sino en el gate que ese test ejercita.
  - `runSelfTest` lanzaba un `node --test` anidado con un techo fijo de **30 segundos** y devolvía
    `!result.error && result.status === 0`. Ese booleano **colapsaba tres desenlaces en dos**: pasó,
    falló, y «lo maté al cruzar el techo». El tercero salía idéntico al segundo.
  - **Medido, no supuesto:** el test que lo invoca corre `main(check --completed-phase I1)` sin
    inyectar el registry, así que lanza dos suites anidadas de verdad. En aislamiento tarda **5,3 s**;
    bajo la concurrencia que este mismo protocolo recomienda tardó **18,5 s cuando pasó** y
    **34,8 / 35,9 / 36,5 s las tres veces que falló**. Cruzaba el techo.
  - **El techo pasa a 300 s y es configurable** con `VCP_SELFTEST_TIMEOUT_MS`. Un techo tiene que
    existir —un proceso colgado no puede colgar el gate— pero no puede estar tan cerca del tiempo
    normal de la tarea que la carga lo cruce.
  - **Lo que no se pudo verificar ya no se reporta como verificado-y-en-rojo:** `runSelfTest` lanza
    `DISCOVERY_SELFTEST_UNFINISHED` con el techo que cruzó y cómo subirlo. **Acusar lo que no se pudo
    comprobar es la misma falta que pintar de verde lo que no se comprobó:** en las dos el veredicto
    no se ganó. Cubre las dos formas en que un proceso muere: con `error` y sólo con `signal`.
  - **El mismo defecto vivía una función más abajo.** `createPreviousPhasesChecker` atrapaba
    **todo** en un `catch` vacío y devolvía `false`, así que un «no pude verificar» salía como «la
    fase anterior no cerró» —un rojo con la explicación equivocada—. Ahora hay un conjunto
    `UNVERIFIABLE` que ninguna capa puede tragar: una fase que de verdad no cerró sigue siendo un
    `false` legítimo, y lo que no se pudo comprobar sube.
  - **Verificación:** **cinco corridas completas seguidas en verde**, 1073 pruebas cada una, contra
    las 3 rojas de 6 de antes. Cobertura 38/38 en líneas, ramas y funciones.
  - **Método, dicho porque se rompió una vez hoy:** las cinco corridas se hicieron sobre el código
    **final**, sin tocar `scripts/` mientras medían. Las dos mediciones anteriores se descartaron
    por editar el árbol mientras corrían — que es exactamente LESSON-3 aplicada al propio trabajo.

- **SEGURIDAD — se redactó contenido de otro proyecto que este repositorio había publicado.** Este
  repositorio es **público**, y el commit `6db8595` había subido dos cosas que no son de acá:
  - **Una vulnerabilidad concreta de otro producto del autor, con archivo y línea**, transcrita
    literal dentro de la evidencia de `docs/ablation.json`: un un hallazgo de seguridad con la ruta del
    archivo, las dos líneas y la explicación del escaper que falla. Reemplazada por el **resultado**
    de la medición —18 clases de vulnerabilidad contra 15 de la línea base, que es lo único que la
    ablación necesita— sin la referencia. Lo que el método requiere es el número, no la ubicación.
  - **Un mapa de dónde vive lo sensible en ese otro árbol** —validación de licencia, generación de
    licencias, pagos y el guard de riesgo— en `templates/vibe/PROJECT.md`, que es una **plantilla
    que el instalador copia a cada proyecto** donde se instala VCP. Reemplazado por las *categorías*
    que van en esa sección, más una advertencia explícita de no poner ahí rutas de otro proyecto:
    en un repositorio público, una lista de "dónde vive lo sensible" es un mapa para cualquiera.
  - También se sacaron los nombres de producto, versiones y rutas internas del set de 8 tareas de
    `docs/ablation.json` y de los fixtures de `tests/verify-ablation.test.mjs`. **Las tareas siguen
    siendo las reales** —eso es lo que PHASE 9 exige— descritas sin nombrar el producto.
  - **Lo que esto NO hace:** el contenido estuvo publicado y sigue en la historia de git. Sacarlo de
    la punta no lo despublica. Reescribir la historia es una decisión aparte, destructiva, y no se
    tomó acá. La vulnerabilidad conviene arreglarla en su propio repositorio, que este protocolo no
    toca.
  - **La causa:** PHASE 9 pide que el set de pruebas sean tareas **tuyas reales**, y eso es correcto
    —un set inventado se elige para que dé bien—. Lo que faltaba era la otra mitad de la regla: un
    registro real se publica **redactado**. El protocolo pedía realismo y no decía nada sobre qué
    pasa cuando el registro se commitea a un repositorio público.

- **CORRECCIÓN — el nodo duplicado que se publicó en el sello anterior no existe.** La afirmación
  era propia y estaba escrita con número: «queda UN duplicado real en 2807 nodos, PHASE 6 bajo dos
  ids». Es falsa.
  - **Cómo se cayó:** un barrido de cuatro lentes ciegas entre sí —etiqueta, identificador,
    vecindario, significado— sobre los 400 nodos de `SKILL.md` y `CHANGELOG.md` propuso once pares
    sospechosos, y la verificación adversarial —tres escépticos por par, con la instrucción de
    refutar y de refutar por omisión ante la duda— **rechazó los once por mayoría**.
  - **Comprobado después ejecutando, no por opinión de agente:** los dos nodos del par señalado
    tienen **cero vecinos en común**; uno es `file_type: concept`, `_origin: semantic`, sin línea;
    el otro es `file_type: document`, `_origin: ast`, en la línea 759 del archivo.
  - **Lo que hay en realidad son dos capas deliberadas:** 44 nodos `ast` que son el esqueleto de
    encabezados del archivo con su número de línea, y 356 nodos semánticos que son la red de
    conceptos. **Cero ids compartidos entre las dos.** Fusionar el par habría roto el índice del
    documento —ese nodo `ast` es lo único que hace la fase 6 alcanzable desde la raíz de
    `SKILL.md`— y como el patrón se repite en nueve pares más, el mismo criterio habría borrado
    del índice a las fases 1.5, 2, 5, 5.5 y 6. Nadie lo habría notado hasta preguntar qué secciones
    tiene el archivo.
  - Un par quedó sin votos por límite de sesión y se juzgó a mano con la misma prueba mecánica:
    `ast` en la línea 1539 contra semántico, cero vecinos en común. **Cero fusiones aplicadas.**
- **`graphify label` no se pudo correr, y la causa está medida:** el backend `claude-cli` lanza
  `claude -p`, y ese CLI devuelve `Failed to authenticate: OAuth session expired and could not be
  refreshed`. Los tres lotes fallaron con salida 1. **No se tocaron credenciales.** Se comprobó que
  el fallback no dañó nada: 229 etiquetas, cero marcadores, los mismos 208 nombres antes y después.
  - Las comunidades se nombraron por otra vía —diez agentes en paralelo sobre lotes de 23, con los
    miembros ordenados por grado—: **229 de 229**, cero marcadores, un nombre repetido desambiguado
    a mano. Aplicadas **sin re-agrupar**, usando las comunidades que ya estaban en el grafo, y el
    sidecar firmado con `community_member_sigs`, la función del propio graphify. Sidecar y firma
    con las mismas 229 claves.
  - **Para volver a correr `graphify label` hay que reautenticar el CLI `claude` a mano.** Eso no
    lo hace el protocolo y no lo hace el agente.

- **Cinco hallazgos más de la auditoría, cerrados. Tres eran defectos de los gates nuevos, y los
  tres los encontró aplicarlos a datos reales — no los casos de laboratorio.**
  - **Una ruta de home escrita al estilo de Windows se reportaba como borrado.** `normalizePath` ya
    la resolvía bien, pero los dos lectores —el de disco y el de git— comparaban `~/` literal, así
    que `~\.claude\...` caía al else y se buscaba adentro del proyecto. Un archivado correcto
    salía acusado de borrar, y el falso rojo caía justo sobre la comprobación de la regla de oro.
    Ahora las barras se normalizan **antes** de mirar el `~`.
  - **La línea de espera aceptaba una sola redacción.** Era un substring exacto y sensible a
    mayúsculas, así que un menú cerrado con «Quedo esperando tu respuesta» se rechazaba por la
    `e` minúscula —obligada por estar a mitad de frase—. Ahora acepta las formas en que se
    escribe de verdad, y la falsificación comprueba que un menú **sin** ninguna forma de espera
    sigue cayendo.
  - **El protocolo no podía citar el anti-patrón para enseñarlo:** citarlo rechazaba el documento
    entero. Se agregó una salida explícita, `<!-- menu-shape: ejemplo -->`, acotada al bloque
    siguiente y a uno solo. **La primera versión de esa salida tenía el defecto que decía evitar**:
    un `includes` suelto hacía que el párrafo que *habla* de la marca apagara el menú siguiente.
    Lo agarró CONTR-2 sobre el `SKILL.md` real, no una prueba de laboratorio. Ahora el comentario
    tiene que estar solo al principio de la línea.
- **El emoji `🔵` queda declarado reservado para las decisiones.** El gate rechaza un `🔵` que no
  sea un menú, y eso sólo es correcto si el documento dice que el emoji es exclusivo: si
  significara dos cosas, el gate no podría distinguir un aviso legítimo de un menú roto.
- **PHASE 9 nombra ahora cada campo que el gate exige**, con una tabla de qué guarda cada uno, los
  tres veredictos —incluido `REESCRIBIR`— y `why_representative`. Antes el gate exigía doce campos
  exactos que la fase no mencionaba: quien siguiera el protocolo al pie de la letra escribía un
  registro incompleto y se enteraba recién cuando el gate lo rechazaba. **Un requisito que sólo
  vive en el código no es un protocolo.** Una prueba lo mantiene sincronizado: compara la lista real
  `RECORD_KEYS` contra el texto de la fase.
- **Se corrigieron cuatro frases que prometían más de lo que el gate comprueba** (`SKILL.md`,
  `CHANGELOG.md`), y una prueba nueva las vigila: toda promesa de la forma «rechaza todo bloque
  `🔵`» tiene que nombrar su excepción a menos de seis líneas.
- **Límite honesto nuevo (78):** el gate **no juzga si el bloque marcado como ejemplo es de verdad
  un ejemplo**. Es indecidible sin leer la intención. La mitigación es que la marca sea literal y
  buscable: `grep -rn "menu-shape: ejemplo"` lista todas las excepciones de un repo en una línea.

- **La vuelta atrás está probada, y el registro de la limpieza existe.** Se ejercitó PHASE 9 contra
  una limpieza **real** —la del 2026-09-02 sobre `~/.claude`— en vez de contra un caso de
  laboratorio, y el registro quedó en `docs/ablation.json`, reconstruido desde la evidencia
  primaria que quedó en el archivo y desde el historial de git. Nada se completó de memoria.
  - **La vuelta atrás:** se restauró `skills/design-loop/SKILL.md` desde el commit `3bd5bf4b8481`,
    se verificó que el contenido fuera byte a byte idéntico al objeto de git —1066 palabras,
    sha256 `dde8078b969e`— y se volvió a limpiar. El árbol quedó **idéntico**: mismo HEAD, mismo
    árbol, la misma lista de 16 cambios pendientes.
  - **La medición:** las cinco tareas del set que nunca se habían re-medido se corrieron hoy en
    modo **sólo lectura**, y T6 aparte. **Ocho de ocho pasan.** Una que fallaba en la línea base
    ahora pasa. Ningún agente escribió, editó ni borró nada.
  - **La hipótesis central de esa limpieza era la skill de seguridad archivada**, y la respuesta es
    que no hacía falta: **18 clases distintas de vulnerabilidad contra 15 de la línea base**, cada
    una con su referencia `archivo:línea`.
- **Aplicar el chequeo a datos reales encontró tres defectos que los casos de prueba no
  encontraron, y los tres eran del chequeo:**
  - Exigía que el origen desapareciera, cuando el contrato dice que `CLAUDE.md` se archiva **por
    líneas**. Modo `lines`: el origen se queda, recortado, con el rango declarado.
  - Exigía una copia en disco, cuando el procedimiento prescribe **git** como archivo. Modo `git`:
    repositorio más sha completo, y el gate **le pregunta a git** si el objeto está ahí. Un sha
    corto o un `HEAD~1` no valen: una referencia que se mueve no es un archivo.
  - Mecanizaba el filtro de las tres R como un AND que bloqueaba decisiones correctas. Ahora es lo
    que el prompt define: un **juicio** con las tres respuestas a la vista, y archivar algo que
    aprobó una de ellas pide un motivo más largo, porque hay que decir por qué el juicio va en
    contra de la respuesta.
- **Otro defecto propio, encontrado por la prueba de instalación limpia:** una prueba nueva leía
  `README.md` con `readFileSync` directo, y **el instalador no copia `README.md` al runtime**. En un
  proyecto recién instalado explotaba. Es el mismo error que este repo ya había cometido una vez:
  verificar desde el repositorio de origen en vez de desde el destino.
- **Respaldo en Obsidian**, que la limpieza original nunca había hecho: 2598 notas más el
  `graph.canvas`, verificado por su gate.
- **Límite honesto nuevo (77):** el filtro de las tres R es un juicio; el gate comprueba que las
  tres estén respondidas y que el motivo sea proporcionado, **no adjudica** si el juicio es correcto.

- **El protocolo se lee sin saber jerga.** Las nueve fases estaban escritas mitad en inglés técnico:
  **165 de 998 líneas de prosa (17%) no tenían una sola palabra en castellano**. Quedó **una**, que
  es una cita textual y se conserva a propósito. Se tradujeron PHASE 1, 3, 5, 6, 7 y 8, el contrato
  de orquestación, las leyes, la rúbrica 4R y la tabla de memoria. Los nombres técnicos, comandos,
  rutas y los identificadores de papel —Test-Engineer, Builder, Triangulator, Refactor-Engineer—
  siguen en inglés: son nombres, no prosa.
- **Dos defectos encontrados al traducir, que no se veían leyendo el texto en inglés:**
  - Un **párrafo duplicado** en PHASE 1: la misma explicación del gate de identidad escrita dos
    veces, una en línea larga y otra partida en tres.
  - **Dos menús de PHASE 1 en el formato viejo** —dentro de un bloque de código y con el `🔵` sin
    negrita—. El gate de menús **no los veía siquiera como menús**, así que no los contaba ni los
    acusaba: el verde más peligroso, porque un menú que desaparece del barrido no aparece en ningún
    conteo. Convertidos a la forma canónica.
- **Punto ciego del gate cerrado:** un `🔵` al principio de línea sin negrita ahora se registra y se
  acusa por nombre, en vez de quedar invisible. Con su falsificación.

- **La regla de oro dejó de ser una frase del encabezado.** `rollback_command` era texto libre: un
  comando de vuelta atrás que decía `rm -rf ~/.claude/skills` **pasaba en verde**, en el gate cuyo
  propio encabezado dice «acá no existe rm». Ahora se rechaza `rm`, `rmdir`, `del`, `erase`,
  `Remove-Item`, `unlink`, `shred` y `git clean`: la vuelta atrás mueve de vuelta, nunca elimina.
- **`in_scope` y `golden_rule` dejaron de ser decorativos.** Estaban declarados en el contrato y
  **ningún código los leía** — un campo decorativo en un contrato de seguridad es peor que no
  tenerlo, porque se lee como si algo lo hiciera cumplir. Ahora archivar algo fuera del alcance
  declarado se rechaza, y un contrato que no declara la regla de oro no carga.
- **Lo archivado ya no se commitea.** `.claude-archive/` entra al `.gitignore` del repo y los dos
  instaladores lo agregan al del proyecto destino. Es configuración con rutas y datos propios: si
  queda con seguimiento, el primer commit del usuario se la lleva adentro.
- **El disparador de los 7 días existe de verdad.** Antes la fase decía «cada 7 días» y **nada podía
  calcularlo**: ningún campo guardaba la fecha de la última limpieza. Ahora `run_id` es una fecha
  real validada por round-trip UTC, y `verify-ablation.mjs due` responde si toca, cuántos días
  pasaron, o que nunca se limpió.
- **El respaldo dejó de ser una promesa.** El registro lleva `backup.graphify` y `backup.obsidian`
  con evidencia escrita, y sin los dos la fase no cierra. Es lo que hace que «no se pierde nada» sea
  una afirmación con respaldo y no una intención.
- **Otras cuatro contradicciones cerradas:** `outcome` era texto libre que nadie leía (ahora es
  `pass`/`fail`, y una tanda con pruebas en rojo no puede declararse igual ni mejor); seis copias de
  la misma tarea contaban como un set de seis; los totales aceptaban `"cero"` y decían que la
  limpieza había agrandado la configuración; y el destino podía aplanar la ruta de origen, con lo
  que el archivo no volvía a su lugar en el rollback.
- **El gate de menús ya no se queda ciego.** Un menú dentro de una cita `>`, dentro de un bloque de
  código, o detrás de un fence sin cerrar **desaparecía del barrido** — el verde más peligroso,
  porque el gate contaba menos menús y decía OK. Ahora se acusan por nombre, junto con las letras
  repetidas dentro de una misma pregunta y las opciones que dicen lo mismo. Y una nota legítima que
  nombra sus propias letras («A) y B) publican; C) no») dejó de tumbar el documento entero.
- **Faltaban las tres cosas que hacían usable la fase:** `templates/ablation.json`, la sección de
  PHASE 9 en el README con sus dos filas en la tabla de gates, y el runtime del propio repo, que
  estaba viejo — el comando que PHASE 9 documenta daba `MODULE_NOT_FOUND`. Los instaladores además
  toleran ahora instalar VCP dentro de su propio repositorio, que es justo lo que se hace para
  refrescarlo.
- **Límites honestos nuevos (76):** la lista de intocables protege de más y nunca de menos; y el
  respaldo se comprueba **declarado**, no hecho: el gate no abre el grafo ni mira las notas.
- **CORRECCIÓN de una afirmación de este mismo CHANGELOG.** Se había anotado que con concurrencia
  32 la suite era más lenta e inestable que con 8 (242s contra 180s). **No reproduce.** Con tres
  muestras por nivel: 32 da 67,0 / 64,9 / 58,7 s y 8 da 75,8 / 63,1 / 60,8 s, **las seis con cero
  fallos**. La media favorece a 32 (63,5 s contra 66,6 s). Las corridas anteriores estaban
  contendidas con otro trabajo corriendo en paralelo, así que no eran una medición: es LESSON-3
  —una medición sobre algo que se mueve no es una medición— aplicada a mí mismo. El valor por
  defecto se queda en 32, ahora por evidencia y no por inercia.

- **La protección de los archivos intocables era evadible de cuatro formas, y la encontró una
  auditoría adversarial contra el gate publicado media hora antes.** Seis defectos confirmados
  ejecutando, todos arreglados acá con su falsificación escrita primero:
  - **Mayúsculas.** `**/*.mq5` no matcheaba `EA.MQ5` porque la expresión se compilaba sin el flag
    de insensibilidad. En Windows el filesystem no distingue caja: `EA.MQ5` y `EA.mq5` son **el
    mismo archivo real**, el que la regla dura prohíbe mover y que no está en git. El mismo agujero
    alcanzaba a `.EX5`, `.ENV`, `.KEY`, `.PEM` y `.GIT/`.
  - **La carpeta a secas.** `.git/**` exigía algo después de la barra, así que un registro que
    archivaba `.git` **entero** —"el único backup real que existe", según el propio contrato— pasaba
    en verde. Con él se iba el camino de vuelta que la limpieza promete. Idem `_audit_scratch`.
  - **El prefijo `./` y la ruta absoluta.** `./src/main.py` y `C:/repo/.git/config` pasaban libres.
  - **La grafía sin `~/`.** `.claude/settings.json` esquivaba el patrón **y** redirigía la única
    comprobación contra disco a un archivo distinto del que se movió.
  - **El inventario como lista de rutas.** Una entrada que no fuera objeto se salteaba en silencio,
    y con eso desaparecía el criterio de cierre que exige una frase por cada sobreviviente.
  - **El destino sin validar.** `archive_dir` vacío o `../fuera-del-proyecto` pasaban, y dos
    orígenes distintos podían declarar el mismo destino: en disco el segundo pisa al primero.
- **Contradicción cerrada:** una tanda con `comparison: "peor"` cerraba si había algo en `restored`,
  contra el criterio 1 de PHASE 9 —el set sale igual o mejor que la línea base—. `comparison` es
  ahora la comparación **final**, después de devolver lo que haga falta: si sigue diciendo «peor»,
  no cerró. La prueba que fijaba la conducta vieja fue reemplazada, no borrada en silencio.
- **Límite honesto nuevo (75):** la lista de intocables **protege de más, nunca de menos** — el
  patrón se compara contra cada sufijo de la ruta. Es deliberado: proteger de más cuesta una
  molestia, proteger de menos cuesta un archivo que no está en git.

- **VCP deja de ser invisible para Codex en todo proyecto, no sólo en su propio repo.** Verificado
  ejecutando: Codex descubre skills de repositorio **sólo** en `.agents/skills/<nombre>/SKILL.md` y
  `.codex/skills/`, y sus instrucciones sólo en `AGENTS.md`; el `SKILL.md` de la raíz y los doce
  `skills/*.md` le son invisibles. Los dos instaladores crean ahora esos punteros en el proyecto
  destino. Probado de punta a punta sobre un proyecto limpio: `AGENTS.md`,
  `.agents/skills/vibecodeprotocols/SKILL.md` y el destino al que apuntan existen los tres.
- **Los punteros nombran los dos lugares posibles del protocolo**, porque no es el mismo: `SKILL.md`
  en la raíz cuando se trabaja sobre el repo de VCP, y `.vibe/vcp-runtime/SKILL.md` cuando VCP está
  instalado como herramienta. Un puntero que apunta a un archivo inexistente es peor que no tenerlo:
  promete un documento y no lo entrega.
- **Un `AGENTS.md` que ya existe no se pisa.** El instalador lo detecta, no lo toca, y avisa por
  salida que hay que agregarle a mano el puntero. Sobrescribir el archivo de instrucciones de otro
  proyecto sería exactamente la clase de pérdida silenciosa que la regla de oro prohíbe.

- **PHASE 9 — LIMPIEZA: la configuración se poda sola cada 7 días, midiendo.** Cada skill, regla y
  hook se le carga al modelo antes de que la persona escriba la primera letra; lo que ya no sirve no
  es neutral, compite con lo que sí importa. La fase corre al abrir sesión si pasaron 7 días, y
  **nunca mueve un archivo sin un click**. El orden es fijo: **actualizar** el grafo → **compactar**
  la memoria → **limpiar** → **respaldar** en graphify y Obsidian. Por eso no se pierde nada: cuando
  algo se saca de en medio, su contenido ya está en dos lugares.
- **Regla de oro, mecánica y no declarativa: acá no existe `rm`.** Nada se borra; todo se mueve a
  `.claude-archive/<fecha>/` conservando la ruta. `contracts/ablation-scope.json` declara qué es
  intocable —`.mq5` y `.ex5` a la cabeza, que no están en git y cuya pérdida sería irreversible—,
  qué entra en alcance y por qué, y `verify-ablation.mjs` lo comprueba **contra el disco**: cada
  archivo archivado tiene que existir en el archivo y ya no en su origen. Un registro que dice haber
  archivado algo que no está en ninguno de los dos lados describe un borrado, y se rechaza.
- **Gate 38, `verify-ablation.mjs`:** exige lo que convierte una limpieza en una ablación medida —
  entre 6 y 8 tareas acordadas antes de mover nada, línea base, tandas de a cinco como máximo,
  re-medición del mismo set en cada tanda, líneas devueltas cuando algo empeora, y los cuatro
  criterios de término. El filtro de las tres R se comprueba por contradicción: archivar algo que
  aprueba **cualquiera** de las tres se rechaza por nombre.
- **Bytes de control en el propio gate, encontrados por su prueba.** La primera versión de
  `globToRegExp` —el comparador que protege los `.mq5`— daba el resultado correcto por un motivo que
  no se podía explicar: tenía bytes NUL y 0x01 literales adentro, así que sus `replaceAll('')` no
  operaban sobre cadenas vacías. Reescrita explícita, con una prueba caso por caso, y una
  falsificación nueva que barre `scripts/` y `tests/` buscando bytes de control.
- **Límite honesto nuevo (74):** el gate verifica el **registro** de la limpieza, no la limpieza. No
  corre las pruebas del set ni sabe si un resultado que dice «igual» era igual.

- **El protocolo prescribía por escrito el único formato que garantiza que un menú NO se vea como
  menú.** La plantilla canónica de `CONFIG MENU PROTOCOL` y `CONTENT DECISION PROTOCOL` escribía las
  opciones dentro de un bloque de código, con líneas sueltas `A)` / `B)`. Medido sobre motores de
  Markdown: esas líneas colapsan a **un solo párrafo**, y un fence además renderiza como caja de
  código. Por eso las decisiones llegaban como prosa. Ningún gate se enteraba: `verify-vcp-contract`
  pasaba 107 checks sin una sola regla de forma sobre los menús.
  - **Forma canónica nueva:** `- **A)** texto — *(recomendado)*`. Es el único formato que produce
    ítems separados tanto en CommonMark estricto como en GFM, y la letra va **adentro** del ítem
    porque `A)` es el token con el que la persona contesta — una lista ordenada nativa lo borraría.
  - **13 menús reescritos** en `SKILL.md`, `skills/orchestrator-opus.md`, `skills/vibe-memory.md` y
    `skills/deploy-zip.md`. No queda ningún menú dentro de un bloque de código.
- **Dos contradicciones internas que no las causaba ningún host:**
  - `FORCING QUESTIONS` llevaba 🔵 con seis preguntas de texto libre, que es justo lo que LAW 7
    prohíbe para una decisión de protocolo. Queda declarada **excepción nombrada y sin 🔵**: es una
    entrevista para levantar información, no cierra ninguna fase.
  - Los tres menús `CONFIG` de Spec, Plan y Build no eran menús: cada `A)`/`B)` era una **pregunta
    distinta** con sus propias sub-opciones. Partidos en dos preguntas con sus opciones cada una.
- **Gate 37, `verify-menu-shape.mjs`:** rechaza todo bloque `🔵` que no sea lista con al menos dos
  opciones, recomendación explícita y línea de espera, salvo uno marcado como ejemplo con
  `<!-- menu-shape: ejemplo -->`. Ataca la causa —la plantilla— y no el síntoma. Su falsificación
  cubre las dos formas que colapsan: opciones dentro de un fence y opciones como líneas sueltas.
- **`AGENTS.md` puntero en la raíz.** Verificado ejecutando: Codex sólo descubre instrucciones de
  repo por `AGENTS.md`, y skills sólo en `.agents/skills` o `.codex/skills` — el `SKILL.md` suelto de
  la raíz y los `skills/*.md` le son invisibles. VCP era literalmente invisible para Codex. Es un
  puntero y no una copia: una copia se desincroniza y no hay gate que las mantenga iguales.
- **Límite honesto nuevo (73):** el gate verifica las plantillas que el protocolo prescribe, **no**
  el mensaje que el agente escribió en la conversación ni cómo lo pintó la terminal.
- **Escrito, no simulado: no existe forma portable de que un menú sea clickeable.** Verificado
  ejecutando que el cliente MCP de Codex 0.147.0 declara la capacidad `elicitation` y parsea bien un
  menú con etiquetas, pero **en tres intentos nadie observó uno renderizado**: el servidor declinó al
  instante. Por eso no entra al repo. Condición de salida escrita: reproducir una aceptación real en
  la terminal de Codex. Hasta entonces no se menciona como capacidad. El canon es Markdown, y
  "clickeable" es una capa de presentación sobre las mismas `options[]` donde el host la tenga.
- **Regla de integración del selector nativo, escrita antes de usarlo:** la UI de Claude Code agrega
  siempre una opción "Other" de texto libre que no se puede desactivar. Ese texto **nunca** se
  escribe como `selected_option` — reproducido, hace que `verify-phase-decisions.mjs` rechace la fase
  con `PHASE_DECISION_OPTION_UNKNOWN`. Se vuelve a preguntar con un menú que incluya esa opción, o se
  marca la decisión previa como `superseded`.

- **El gate de lecciones rompía toda instalación nueva, y lo encontró una auditoría adversarial
  contra el código ya publicado.** Las dos lentes que habían muerto por límite de sesión se
  re-corrieron con `resume` —los cinco atacantes desde caché— y esta vez, además de votar los 40
  checks propuestos, auditaron `cf19a91` ejecutándolo sobre copias mutadas. 23 hallazgos
  confirmados corriendo el gate; siete arreglados acá, cada uno con su falsificación:
  - **`templates/vibe/LESSONS.md` salía rojo.** `install.sh:60` copia ese archivo a `.vibe/` en todo
    proyecto nuevo: trae la plantilla y cero lecciones, y `blocks.length < 2` lo rechazaba con exit
    1. La rama `VACÍO` sólo se alcanzaba si el archivo no existía, estado que después del
    instalador nunca ocurre, así que la sonda de vacío jamás probaba el caso real.
  - **El gate prohibía la única forma documentada de retirar una lección.**
    `skills/vibe-memory.md:250` la define como `status: retired (<date>, reason: <why>)`; el
    conjunto cerrado exigía el token pelado. La fuente que había citado en el código —la cabecera
    del propio archivo— era la equivocada.
  - **El piso de fecha `2026-08-28` era la primera lección de VCP**, y `install.sh` copia `scripts/`
    a cada proyecto: una lección importada con su fecha real salía roja en un archivo que se titula
    *cross-project error memory*. Se retiró el piso y se agregó el techo que faltaba: una lección
    fechada en el futuro ahora se rechaza.
  - **La frase `overlaps with` en prosa tumbaba el archivo**, y el mensaje culpaba a un patrón que
    estaba sano. El barrido se ancla ahora al corchete, no a la frase.
  - **Una marca colgada dentro de la plantilla pasaba verde y la línea de éxito afirmaba lo
    contrario de lo que había pasado**: decía "5 marcas que resuelven contra este mismo archivo"
    cuando una no resolvía. El barrido recorre ahora todos los bloques, incluida la plantilla.
  - **`[Overlaps with: LESSON-99]` esquivaba la comprobación entera.** Los "dos caminos
    independientes" de conteo buscaban el mismo string sensible a mayúsculas, así que degradaban
    juntos; el conteo bajaba de 4 a 3 en silencio.
  - **Un campo relleno con 15 invisibles medía 15 caracteres y pasaba el mínimo.** U+2060, U+00AD,
    U+3164 y U+2800 no estaban en la clase de normalización, y los dos últimos ni siquiera son
    caracteres de formato. Un campo tiene que traer ahora al menos una letra con caso o un dígito.
- **Prueba retirada:** la que fijaba el piso de fecha. Fijaba la conducta que la auditoría probó
  incorrecta; su intención —que una fecha fuera de rango se rechace— la mantiene la prueba de fecha
  futura.
- **Límite honesto nuevo (72):** la medida de sustancia de un campo es que traiga una letra con caso
  o un dígito, más un mínimo de longitud y la lista negra de la plantilla. Seis campos con la misma
  frase creíble repetida siguen pasando, y una escritura sin distinción de caso saldría rechazada.

- **`LESSONS.md` deja de ser el único artefacto que nadie verifica.** `verify-lessons.mjs` (gate 36)
  comprueba los seis campos de cada lección, que ninguno esté vacío ni copiado de la plantilla, que
  la fecha sea real, que el `status` esté en `{active, retired}` y que cada
  `[overlaps with: LESSON-N]` resuelva contra los números de este mismo archivo.
  El diseño salió de un ataque adversarial: cinco lentes propusieron 40 degradaciones y las
  probaron ejecutando gates de juguete contra el archivo real. Tres resultados cambiaron el diseño:
  (1) el archivo **no** separa lecciones con `---` —sólo tiene dos, y delimitan la plantilla—, así
  que un gate que parte por ahí valida un único bloque gigante y salió verde en las 9 mutaciones
  probadas, incluida borrar un campo entero; la frontera es el encabezado `## ` anclado.
  (2) Si el valor de un campo se corta al final del bloque en vez de en el próximo marcador, un
  `**Why (root cause):**` vacío se llena con el texto del campo siguiente: esa mutación salió verde
  en los seis gates de juguete probados. (3) `d{4}-d{2}-d{2}` acepta `2026-02-30` y
  `new Date` la rueda a marzo en vez de rechazarla, así que la fecha se valida por round-trip UTC.
- **Las guardias defensivas del gate traen la prueba que las hace fallar**, según LESSON-7: los dos
  conteos de encabezados y el doble barrido de marcas de dedup son inyectables, y hay una
  falsificación que fuerza cada desacuerdo. Cero marcas encontradas por un patrón roto se leería
  igual que cero referencias rotas.
- **Límite honesto nuevo (71):** el gate no verifica que la causa raíz declarada sea la causa real,
  ni que se distinga del síntoma, ni que la señal de detección detecte algo. Lo imprime en verde y
  en rojo, para que su línea de éxito no se cite sola.

- **Un vínculo de claim ya no se resuelve contra la spec equivocada.** `verify-evidence-trace
  claims` resolvía `linked_requirement_id` y `linked_ac_id` contra `docs/spec.md` fijo. Un packet
  es inmutable y pertenece a su feature, pero `docs/spec.md` rota con el feature activo: al rotar,
  un vínculo correcto se rompía y —peor— un identificador que la spec nueva reutilizara resolvía en
  verde significando otra cosa. El subcomando acepta ahora `--spec <archivo>`, igual que `criteria`,
  y el mensaje nombra el archivo contra el que resolvió. El defecto quedó fijado por una prueba de
  falsificación: el mismo vínculo que la spec activa daba por bueno sale rojo contra la spec que de
  verdad le corresponde.
- **Los cuatro claims de `integridad-verificable` enlazan el criterio que motivaron.** No se editó
  el packet sellado: se agregó la decisión `d004` como corrección de `d003` —el mismo patrón que
  `d003` usó sobre `d002`— y la spec del feature quedó archivada en
  `docs/discovery/integridad-verificable/spec.md`. `claim-audit-sin-gate` → T01/AC1,
  `claim-baseline-ausente` → T02/AC5, `claim-toctou` → T03/AC8, `claim-wording-parcial` → T04/AC10:
  cada claim es la evidencia observada que motivó ese slice. Con `--spec`, el cierre estricto de ese
  Discovery pasa de rechazo a 8 vínculos resueltos.
- **Límite honesto nuevo (70):** el gate comprueba que el identificador exista en la spec indicada,
  **no** que esa spec sea la que le corresponde al packet. Elegir el archivo es de quien lo corre.

- **Los tres gates que leen un expediente ya no abren la ruta a ciegas.** `verify-intake`,
  `verify-triangulate` y `verify-research-candidates` la resuelven con `safeProjectFile` de
  `ratchet.mjs` **antes** de leer: una ruta que escapa del proyecto, un symlink o un archivo que
  no es regular se rechazan sin abrirse, y un archivo que no existe sigue siendo `VACÍO`. La
  lectura no se reimplementa —regla #46—: el criterio es el que ya usaban `ratchet` y
  `verify-session-state`, así que el rechazo conserva su misma redacción.
  Con esto se cierran los dos vectores que el expediente de TRIANGULATE declaraba pendientes:
  `symlinks` y `paths-externos`. **Los 26 vectores quedan en 11 cubiertos, 15 no aplican y 0
  pendientes**, así que `--require-complete` ya no frena. Límite declarado: es una comprobación,
  no un sandbox.

- **Un puntaje lexical ya no puede pasar por evidencia.** La síntesis del research agrupa 14.897
  entradas y las llama «señales de adopción»: son filtros que cuentan palabras. No había ningún
  artefacto entre esa tabla y una capacidad adoptada, así que el salto no dejaba rastro ni tenía
  dónde escribir el contraejemplo. `verify-research-candidates.mjs` exige catorce campos por
  candidato, con la fuente y el commit **cruzados contra las 14 pineadas**, evidencia que cite
  `archivo:línea` del archivo declarado, y un contraejemplo que no sea esa cita repetida. Un
  `adopt` sin test declarado rechaza.
  **Consecuencia medida: no se escribió ningún candidato real.** Producir uno obliga a leer la
  línea citada en el commit pineado, y el corpus no está en el repositorio. Eso es el punto del
  gate, no una omisión: hace visible el costo del salto que antes se daba gratis.

- **Los 14 commits pineados revalidados.** 5 fuentes sin cambios y 9 con el HEAD movido, lo cual
  no invalida el corpus —se leyó *en* el commit pineado—; lo que sí lo invalidaría es que el
  commit dejara de resolverse, y los **14 siguen alcanzables**. Registrado en
  `research/pin-revalidation-2026-09-01.json`, que acompaña al contrato sin borrarlo. Límite
  escrito ahí: los commits guardados tienen 8 caracteres, que desambiguan dentro de un
  repositorio pero **no son un pin criptográfico**.

- **La adopción distingue quién sostiene el cambio de quién lo ejecuta, y la recurrencia dice
  cuándo retirar una mejora.** `owner` y `operational_owner` son dos personas: el que lo defiende
  en una reunión no es el que lo corre un martes a la mañana, y confundirlos es cómo un cambio
  queda sin nadie que lo haga. Se sumó `adoption_checklist` con ítems verificables y
  `adoption_metric` con línea de base y objetivo —una señal cualitativa dice que se usa; una
  métrica dice cuánto, desde dónde y hasta dónde—. Y la recurrencia declara `promotion_criteria`
  y `retirement_criteria`: sin criterio de retiro, una mejora que dejó de servir se sostiene por
  inercia y su costo no aparece en ningún lado. Límite: el gate exige el criterio escrito, nunca
  que alguien lo aplique.

- **TRIANGULATE es una fase con expediente, no una instrucción de prosa.** Existía adentro del
  bucle de Build y no dejaba rastro: quien refactorizaba decidía solo qué buscó. Ahora los 26
  vectores viven en `contracts/triangulate-vectors.json` y el expediente de la funcionalidad los
  declara uno por uno — `covered` nombra la prueba, `not_applicable` y `pending` traen motivo—.
  Un vector que falta rechaza, y uno que el contrato no declara también. Con `--require-complete`
  un pendiente frena el cierre, que es la regla del protocolo. **El primer expediente real es el
  del propio gate**, y declara dos pendientes: el gate abre la ruta que le pasan sin comprobar
  symlinks ni rutas externas. Límite declarado: verifica que cada vector esté declarado, nunca
  que la prueba nombrada lo ejercite.

- **El PRD declara las veintiuna secciones que el protocolo pide, y sus criterios se pueden**
  **comprobar.** Antes tenía nueve secciones de contenido; se sumaron jobs-to-be-done, no-objetivos,
  requisitos no funcionales, seguridad, privacidad, observabilidad, integraciones, datos,
  arquitectura, métricas, rollout y rollback. Seguridad, privacidad y observabilidad son campos
  propios y no notas al pie de la tecnología: una sección que no existe no se deja sin contestar
  por olvido. Y cada criterio de aceptación pasa de `{id, statement}` a seis partes más el id:
  evento, precondición, acción, resultado observable, test y evidencia esperada. Un texto libre
  decía que alguien pensó algo; esto deja ver cuál de las seis partes falta. Límite declarado: el
  campo `test` se exige escrito, nunca resuelto.

- **El mapa de bucle describe el bucle entero, y su delta se verifica.** Cada flujo pasa de seis
  campos a los trece que el protocolo pide: se sumaron transformación, actor, decisión, evidencia,
  siguiente iteración, condición de salida y condición de bloqueo. `decision` es qué se decide y
  `decision_owner` quién decide: un bucle al que le falta una de las dos no se puede auditar.
  Entre `current` y `target` ahora va un `delta` **exacto**: declarar un cambio en un campo que
  quedó idéntico rechaza, omitir uno que sí cambió rechaza, y un `from` o un `to` que no coincide
  con lo que el propio documento dice también. Es lo único del mapa que el gate puede comprobar
  contra el archivo; los otros doce campos son prosa que no puede juzgar, y así queda declarado.
  El primer bucle suma `rollback` y `failure_signals`: uno sin rollback es un cambio de una sola
  dirección, y uno sin señales de fallo se abandona en silencio.

- **El CAIO mira las doce dimensiones que el encargo pide, no cuatro.** Se sumaron decisiones sin
  dueño, estados no medidos, handoffs defectuosos, errores que se repiten, ausencia de aprendizaje,
  costos ocultos, riesgos de seguridad y dependencia de memoria conversacional. Y las clases pasan
  de dos a las cuatro pedidas: además de `observed` e `hypothesis` ahora existen `inference`, que
  exige `derived_from` con hallazgos **que existan en el documento** —una inferencia sin origen es
  una hipótesis con mejor nombre—, y `missing_data`, que exige qué falta y **cómo conseguirlo**.
  Cada clase declara exactamente los campos que su etiqueta obliga a cargar, ni uno más.
  Una dimensión sin hallazgos ya no se deja en blanco: `coverage` obliga a decir si se examinó y
  no había nada o si no se examinó, y por qué. Sin eso, ocho silencios se leían igual que ocho
  dimensiones sanas, que es el modo en que un diagnóstico parcial se vende como completo.
  Límite declarado: el gate no abre el locator de una evidencia, así que un observado con una cita
  inventada pasa igual.

- **Discovery ahora produce artefactos operativos verificables.** CAIO, mapa de bucle, PRD, plan de
  implementación, adopción y recurrencia tienen plantillas y un gate nativo en
  `verify-product-diagnostics.mjs`; se validan antes de Spec y sus límites semánticos quedan
  explícitos.
- **El menú por fase tiene un plan canónico.** `verify-phase-menu.mjs` compara el orden registrado
  en `docs/phase-decisions.json` contra `docs/phase-plan.json` y exige una decisión vigente para
  cada fase al cerrar. El registro sigue siendo evidencia de forma, no prueba de voluntad humana.

- **El protocolo pregunta qué se quiere construir.** `PHASE 1.5 — INTAKE` es nueva: ocho preguntas
  —qué, para quién, qué problema, qué resultado operativo, qué restricciones, qué fuentes aporta el
  usuario, si hace falta un artefacto visual, y si se pide diagnóstico o implementación— escritas en
  `docs/intake/<feature>.json` y verificadas por `verify-intake.mjs`. Los supuestos, los riesgos y
  las preguntas abiertas van en listas propias con id: lo que quede mezclado adentro de una
  respuesta no se puede señalar después. Una pregunta marcada `bloqueante` frena el ciclo. Antes de
  esto no había nada entre Bootstrap y Research que capturara el objetivo, así que el ciclo
  arrancaba sobre lo que el agente supuso; medido sobre `af55a45`, `grep -ci "Intake"` sobre
  `SKILL.md` devolvía `0`. Límite declarado: el gate verifica forma, nunca verdad, y un supuesto
  escondido adentro del texto de una respuesta le es invisible.

- **La suite dejó de ser intermitente.** `node --test --test-concurrency=32` salía rojo 2 de cada 5
  corridas, siempre en `tests/verify-evidence-runner.test.mjs`. La causa no era el runner: era un
  presupuesto de 1000 ms para una petición de evidencia que lanza un proceso real. Medición propia,
  30 muestras por tanda: sin carga el spawn tarda 34 ms de mediana y 104 ms el peor caso; con 32
  procesos compitiendo, 2631 ms en el percentil 90 y 4895 ms el peor, con el 13 % por encima de
  1000 ms. El presupuesto vive ahora en `tests/spawn-budget.mjs` con la medición al lado, y una
  guardia barre los archivos de prueba descubiertos al momento —no una lista fija— para que nadie
  vuelva a escribir un presupuesto a ojo. Diez corridas seguidas en verde.

- **Un clon limpio ya sale verde en Windows.** `.gitattributes` sólo pineaba `*.sh`, así que 215 de
  229 archivos trackeados llegaban CRLF a un clon. La cadena de decisiones de Discovery guarda el
  hash del predecesor y `verify-discovery-views` exige LF, así que el mismo commit daba distintos
  bytes: `d002.json` era `{
…` con sha256 `a3260e9f…` en el árbol del autor y `{
…` con
  `ef3d2077…` en el clon. Dos gates y dos pruebas salían en rojo para cualquiera que clonara.
  Ahora `* text=auto eol=lf` (con `*.ps1 text eol=crlf`, que PowerShell necesita), y
  `tests/tracked-bytes.test.mjs` lo fija reproduciendo un checkout con `core.autocrlf=true`
  forzado, así el defecto se detecta igual en Linux y macOS.

- **El gate de cobertura mide, ya no estima.** Leía la tabla de texto de
  `node --experimental-test-coverage`, que fusiona la medición de cientos de procesos y depende del
  orden en que se leen sus archivos. Ahora suma la cobertura cruda de V8 por proceso —sumar es
  conmutativo— y nombra archivo y línea de cada función o rama que nadie ejecutó. Con eso
  aparecieron 10 huecos que el porcentaje daba en 100 %, todos respaldos de `||` y ternarios: el
  texto que `verify-receipt.mjs` muestra cuando git no devuelve firmante, el código genérico de
  `verify-discovery-views.mjs` ante un error sin `code`, el camino que `verify-spec-wordcap.mjs`
  usa para rechazar por calidad, y la rama de contradicciones de `verify-graphify-manifest.mjs`.
  Cerrados uno por uno. Además `main` ahora mide el proyecto que se le pasa: antes ignoraba su
  propio parámetro `cwd` al lanzar la suite, así que inventariaba un árbol y medía otro, y por eso
  sus pruebas nunca pudieron ejercitarlo de punta a punta.

- **El denominador de la cobertura se declara.** `contracts/coverage-scope.json` dice qué
  directorios se miden y cuáles no, con su motivo, y `tests/coverage-scope.test.mjs` rechaza que
  aparezca un directorio con código Node que el contrato no mencione. Ahí queda escrito que cuatro
  verificadores de `research/` que el protocolo manda correr no tienen prueba propia: deuda
  declarada, no cobertura.

- **Los verificadores de research rechazan en vez de reventar.** Leen expedientes que `.gitignore`
  deja afuera a propósito. Sobre un clon limpio, tres de los cuatro salían con un stack trace de
  `node:fs` en vez de un rechazo, así que no se distinguía "falta el insumo" de "el gate está
  roto". Ahora los cuatro nombran el archivo que falta y el comando que lo regenera.

- **Dos gates dejaron de ser invisibles para `grep`.** `verify-discovery-core.mjs` y
  `verify-research-citations.mjs` tenían bytes NUL crudos en el fuente, así que git los clasificaba
  `-text` y `grep` respondía `Binary file ... matches` escondiendo la línea. Se escriben con
  `String.fromCharCode(0)` y su escape: mismo byte en ejecución, código otra vez buscable.

- **Cierre funcional reproducible del research externo.** Se agregó un ledger nativo que abre y
  hashea las 14.897 entradas que estaban `PENDING`, recorre todas las líneas textuales y registra
  interfaces, dependencias, tests, salidas, límites, riesgos y citas verificables. El verificador
  confirma 14.897/14.897 sin duplicados: 14.710 `FUNCTIONAL_SCAN`, 187 `STATIC_REVIEWED` (opacos),
  0 ilegibles. La evidencia comprimida se conserva como salida local reproducible (ignorada por Git)
  y la síntesis compacta se versiona; ninguna señal lexical se
  auto-adopta y cada capacidad vuelve al ciclo VCP con menú 🔵. El baseline estricto histórico se
  mantiene separado para no reescribir la historia.

- `verify-capability-matrix.mjs` agrega una matriz nativa de roles, herramientas y superficies:
  rechaza auto-aprobación y contradicciones entre roles de sólo lectura y `Write`/`Edit`. Es un
  contrato declarativo revisable, no un sandbox contra herramientas externas.
- `verify-spec-wordcap.mjs --quality` exige la forma mínima de una spec (secciones canónicas,
  criterios AC únicos con gramática GIVEN/WHEN/THEN o `THE SYSTEM SHALL`, y sin placeholders)
  además del tope de palabras.
- `verify-evidence-runner.mjs` ejecuta vectores argv sin shell y, cuando corre, conserva salida
  limitada, hashes, duración, exit code y HEAD. `passed`, `failed` y `skipped` son estados
  explícitos; el modo `--require-complete` sólo cierra con `passed`, y un skip no ejecuta ninguna
  sonda (`git_head: null`).
- `verify-phase-decisions.mjs` agrega `--require-complete`: el cierre final rechaza cualquier fase
  declarada en `phase_order` que no tenga una decisión vigente con menú, recomendación, elección y
  motivo. El modo normal conserva el comportamiento incremental para proyectos que todavía están
  avanzando.
- `verify-evidence-trace.mjs claims --require-links` agrega un cierre estricto: el packet no puede
  estar vacío y cada claim vigente debe enlazar al menos un `linked_requirement_id` o
  `linked_ac_id` resoluble. Implica `--require-inputs`; el Discovery inicial conserva su modo
  permisivo.
- ~~`verify-vcp-coverage.mjs` mide con un worker por defecto para evitar resultados intermitentes.~~
  **Corregido el 2026-09-01:** serializar no evitaba la intermitencia, la tapaba —y de paso escondía
  huecos de cobertura reales—. Cerrado el defecto de la suite, el default volvió a 32.

- **El research externo, revalidado contra las catorce fuentes.** Durante dos días el informe
  declaró, con todas las letras, que sus citas `archivo:línea` no las había revalidado nadie y no
  se podían verificar sin volver a clonar las catorce fuentes. Se volvieron a clonar. Las catorce
  quedaron en su commit pineado y **el conteo de archivos de cada una coincide al número con lo que
  el informe declaró**: suman 15581, y los manifests recuperados del journal eran honestos. De las
  145 citas del informe —que decía tener 60, un número estimado y nunca contado—, **142 resuelven a
  un archivo y una línea que existen**, 3 quedan declaradas ambiguas o elididas por el propio
  informe, y **ninguna está rota**. Tres checkouts fallaron primero con un error que se lee como
  «el commit ya no existe» y era el límite de 260 caracteres de las rutas de Windows.

- **Del 2,05 % leído al 100 % barrido, sin mezclar una cosa con la otra.** Seis sondas mecánicas
  sobre los 14421 archivos legibles —el 100 % de lo que se puede leer como texto, con los 1160
  excluidos contados por motivo— contestaron la pregunta que la lectura parcial había dejado
  abierta: si las soluciones que VCP derivó trabajando estaban en el corpus sin que nadie las
  viera. **No estaban.** Cobertura de shell con `PS4`: cero archivos. Firma de commit como
  custodia: veinte hits y los veinte son HMAC de webhooks. Ancla contra la historia de git:
  veintitrés hits y los veintitrés son `rev-list --count`. Consentimiento con hardware: tres hits,
  un diagrama de ejemplo y dos descripciones de rol. El 2,05 % **no subió** y el informe no dice lo
  contrario: leer y barrer son cosas distintas y quedan en filas separadas.

- **El hallazgo que vale más que todo lo anterior: 119 archivos en 8 repositorios declaran un
  registro que sólo crece y ninguno lo verifica.** De esos, 42 son código: dicen la propiedad en un
  comentario —«append-only JSONL», «never rewrites timeline.jsonl»— y confían en quien escribe. El
  más honesto lo admite en el propio comentario. Ocho proyectos, cuarenta y dos lugares, cero
  detectores: convención sin detector, que es la definición de lo que este repositorio llama
  decoración, cometida cuarenta y dos veces en el corpus que se estudió para aprender de él. Y
  explica el resultado anterior mejor que la hipótesis previa: la respuesta no faltaba por difícil,
  faltaba porque la pregunta no se hacía.

- **Gate 25: `verify-research-citations.mjs`** (9 reglas mecánicas). La revalidación cara —clonar
  un giga, resolver 145 citas— pasa una vez y queda escrita en `contracts/research-citations.json`;
  el gate compara el informe contra ese registro y frena si alguien agrega una cita sin
  revalidarla, o si deja un registro huérfano. Una cita resuelta exige repo, ruta y el sha256 del
  contenido citado; una que no resolvió exige su motivo escrito. Si el contrato trae el barrido,
  cada sonda muestra el patrón con que buscó —que tiene que compilar—, su hipótesis y conteos
  posibles: **un cero sólo es evidencia si se ve con qué se buscó y sobre cuántos archivos**. El
  gate se probó contra sí mismo: al escribir la corrección se agregaron 7 citas nuevas y rechazó
  las 7 hasta que se revalidaron.

- **De 52 a 55 límites honestos.** Los tres nuevos son del gate nuevo, y los tres separan lo que se
  midió de lo que se podría creer que se midió: compara el informe contra el registro de la
  revalidación y no contra los repositorios; una cita resuelta dice que el archivo y la línea
  existen, no que digan lo que el informe afirma; y **barrer no es leer**.

- **LESSON-4: pedir que ataquen un mecanismo autoriza a fabricarlo.** Un panel adversarial que
  evaluaba si firmar con clave FIDO prueba consentimiento verificó su hipótesis **ejecutando**
  `ssh-keygen -t ed25519-sk`, que abrió un diálogo del sistema pidiendo insertar la llave física.
  La consigna decía «intentá eludirlo concretamente» y no declaraba el modo de verificación. Queda
  la regla: toda consigna adversarial declara su modo, por defecto lectura, y un subagente no
  ejecuta comandos que generen credenciales ni toquen `~/.ssh`. La ironía cierra el caso: el panel
  concluyó que la firma es teatro porque el agente puede fabricar las claves, y para demostrarlo un
  agente empezó a fabricar una.

- **Los últimos 8, verificados uno por uno** (hallazgo 64). Siete eran reales; el octavo ya
  estaba cerrado por el arreglo del path del ancla. **Cinco arreglados**: `verify-red-node`
  rechazaba un RED genuino porque leía el pie de TAP del primer match y node prefija la salida de
  cada prueba con `# `; el sello del backup no cubría `manifest.json`, que es el archivo que dice
  qué cubre el grafo; el hard gate RED no cubría `.sh`, `.ps1`, `.c`, `.cpp`, `.h`, `.vue`,
  `.svelte`, `.tf` ni `.html` —ahora son 38 extensiones en una constante exportada, con su límite
  escrito—; una promesa de contrato fijada por el título dejaba borrar la tabla entera que la
  promesa nombra; y se eliminó una rama muerta. **Dos reproducidos y declarados sin arreglar**:
  `.git/info/exclude` da vuelta el veredicto de `scope-diff` sin dejar rastro en el repo, y una
  clave escrita a mano en el manifiesto compra cobertura — los dos son "el gate confía en un
  archivo que nadie revisa", y cerrarlos de verdad merece una decisión, no un parche.
  Con esto el ataque adversarial queda cerrado: de 41 propuestas, ninguna quedó sin mirar.

- **Los 28 que quedaban, revisados uno por uno** (hallazgo 63), reproduciendo cada propuesta a
  mano. **Seis arreglados**: `test.todo` y `test.skip` dejaron de contar como criterio cubierto;
  escanear cero archivos escribe `VACÍO:` en vez de `OK:`; dos opciones de menú que sólo difieren
  en caracteres invisibles ya no cuentan como dos; un `SESSION.md` de 0 bytes deja de satisfacer
  `--require-inputs`; `check` de la cadena informa cuántas líneas heredadas hay antes del primer
  sello, para que una línea forjada arriba se vea —detectarla sigue siendo trabajo de `history`,
  contra git—; y se eliminó un bloque duplicado y muerto que había dejado un parche anterior.
  **Cinco reproducidos y declarados sin arreglar**, cada uno con su motivo: aceptar un archivo
  demasiado grande es un punto ciego permanente; un rename que sólo cambia mayúsculas deja el
  gate de sincronización en rojo y reinstalar no lo arregla; un secreto en UTF-16LE es invisible;
  la sonda de carpeta vacía sólo enumera `verify-*.mjs`; y once de veintitrés gates no tienen
  ningún límite honesto que los nombre. **Cuatro son correctos por diseño** y **tres no se
  reprodujeron**. **Ocho siguen sin verificar**, nombrados uno por uno en el backlog.
  *(Corrección del 2026-08-29: este desglose suma 26, no los 28 que el título declara. Los 2
  restantes no están nombrados en ningún documento; el total de 41 sólo cierra si caen en el balde
  de "mismo defecto contado dos veces o ya cerradas por otro arreglo", pero eso es inferencia por
  eliminación, no dato. Registrado también en `.vibe/AUDIT.md` como `h63-fix`. Y de los cinco
  declarados sin arreglar, el de la sonda que sólo enumeraba `verify-*.mjs` quedó cerrado después,
  en `e7a31fa`. El de los límites honestos sigue abierto y hoy se lee peor de lo que parece: son
  **once de veinticuatro**, no de veintitrés — el numerador no bajó, subió el denominador. Los once
  son `discovery-core`, `discovery-requirements`, `discovery-views`, `handoff-report`,
  `plan-conflicts`, `resume-state`, `scope-diff`, `spec-wordcap`, `test-bindings`, `vcp-contract` y
  `vcp-coverage`; varios tienen su límite escrito en la tabla del README, pero **ninguno lo tiene
  declarado en `contracts/honest-limits.json`**, que es lo único que impide borrarlo sin que se
  note.)*

- **Seis huecos más, reproducidos a mano y cerrados** (hallazgo 62). El ataque adversarial dejó
  38 propuestas sin verificar; se revisaron reproduciendo cada una, sin agentes:
  1. `verify-security-baseline`: un `.env.production` con `DATABASE_PASSWORD` **sin comillas**
     pasaba en verde — el detector exigía una comilla después del signo igual, que es la forma de
     escribirlo en código, no en un `.env`. Detector nuevo de asignación sin comillas, con la
     palabra clave admitida como sufijo del identificador (`AWS_SECRET_ACCESS_KEY`).
  2. `pretooluse-red` **denegaba TODA escritura real**: Claude Code manda `file_path` absoluto y
     la normalización rechaza todo path absoluto, por diseño. Ahora se relativiza contra el
     proyecto antes de normalizar; lo que apunta afuera sigue denegado.
  3. `verify-audit-chain history` **se apagaba solo** con el path escrito con barra invertida:
     `git log` listaba los commits, `git show` fallaba en todos, y una traza fabricada de cero
     salía OK. Se normaliza el path para git, y que NINGUNA versión se pueda mostrar es un
     rechazo, no un ancla en silencio.
  4. `verify-phase-decisions`: mover una fase sin decisión al final de `phase_order` **borraba la
     detección de fase salteada sin tocar un solo hash**. Ahora entra a la preimagen el prefijo
     de `phase_order` hasta la fase de cada decisión: agregar una fase futura sigue siendo
     legítimo, reordenar rompe el sello.
  5. `verify-graphify-manifest`: un archivo versionado con acento dejaba el gate en rojo
     permanente. `git ls-files -z`, separación por NUL.
  6. `verify-empty-probe`: la clase `usage` no exigía motivo, así que declarar un gate con
     argumentos incompletos lo silenciaba y quedaba contado como probado. Ahora exige `why`.
  **Pendientes, reproducidos**: la historia de Discovery se puede recortar (misma clase que el
  truncado de la cadena, misma respuesta: el ancla de git), y el inventario de cobertura compara
  por nombre de archivo y no por ruta. **28 propuestas siguen sin verificar**: ni confirmadas ni
  refutadas, nadie las corrió.

- **Tres bugs reales, cada uno en un gate escrito ese mismo día** (hallazgo 61), encontrados
  atacando los gates de forma adversarial y **reproduciendo cada uno** antes de tocar nada:
  1. `verify-audit-chain history` **rechazaba en falso a la mayoría de los usuarios de Windows**.
     git guarda LF y entrega CRLF con `core.autocrlf=true`, que es su default ahí; comparar bytes
     crudos hacía que el ancla acusara manipulación sobre un clon recién hecho. La comparación
     ahora normaliza el fin de línea de los dos lados. Es el mismo error del hallazgo 60, en
     código escrito el mismo día.
  2. `verify-phase-decisions check` sobre `{"decisions": []}` devolvía `OK: registra 0 decisión(es)
     ... cada una con su menú` — un verde afirmando haber verificado la nada, con
     `--require-inputs` incluido. Ahora escribe `VACÍO:` y con el flag es rechazo.
  3. `verify-vcp-coverage` leía **toda** la salida, así que una prueba que imprimiera una línea con
     forma de fila fabricaba una entrada de cobertura para un archivo inexistente. Ahora sólo lee
     entre las marcas que escribe node, y un reporte que no abrió o no cerró da cero filas. Obligó
     a arreglar los fixtures de sus propias pruebas, que alimentaban tablas sin esas marcas: o sea
     probaban el parser contra una salida que node nunca produce.

- **Nueva prueba de punta a punta** (`tests/protocolo-e2e.test.mjs`): instala VCP en un proyecto
  que no existía y corre los gates en el orden real. Comprueba que el runtime queda fuera de la
  superficie del proyecto, que ningún gate escribe `OK:` donde no hay nada que verificar, que los
  gates pasan de `VACÍO:` a verificar cuando aparecen spec y pruebas, y que **recortar la traza
  pasa `check` y cae en `history`** — el ancla externa demostrada de punta a punta, no afirmada.
  Habría cazado sola los hallazgos 58 y 60.

- **Lo que el ataque adversarial NO probó, declarado**: de 130 agentes, 100 murieron por límite de
  sesión. Los 6 atacantes propusieron 41 huecos y la fase de refutación se cayó casi entera. El
  workflow reportó "39 confirmados" y **eso es falso**: sin escépticos vivos, el guion contaba como
  confirmado todo lo que nadie pudo refutar — el mismo error de verde vacío, en espejo, dentro de
  la herramienta escrita para buscar verdes vacíos. Los tres arreglados son los reproducidos a
  mano; los otros 38 quedan **propuestos, sin refutar y sin verificar**.

- **Custodia: el protocolo deja de callarse sobre quién firmó** (`verify-receipt.mjs custody`).
  El límite decía "nadie firma un recibo". VCP no puede crear ni guardar claves — eso no cambió —
  pero git ya trae firma de commits, y su estado es un dato que el gate puede leer y poner en la
  salida. Informa el commit que lleva el recibo, su estado de firma y con qué clave. Una firma rota
  **siempre rechaza**: es peor que ninguna. No firmar rechaza sólo con `--require-signature`,
  porque no firmar es lo normal, no una violación. Un código de estado que git devuelva y este gate
  no conozca tampoco pasa por bueno. Un recibo sin commitear sale `VACIO:`, y correrlo fuera de un
  repo se distingue de un repo sin commits.
  **Límite, impreso en cada corrida**: si el agente puede correr `git commit -S`, firma como vos.
  Prueba que alguien con acceso a la clave firmó, no quién. Vale hasta donde la clave exija
  presencia humana — una passphrase que no esté en el disco, una llave de hardware que haya que tocar.

- **Consentimiento: se detecta el menú fabricado en el mismo aliento** (`verify-phase-decisions`).
  Probar que una persona quiso una opción necesita un canal fuera de este proceso, y eso sigue sin
  resolverse. Lo que sí se puede detectar es el modo de falla concreto: un agente que genera el menú
  y registra la elección en el mismo instante. Cada decisión declara ahora **`shown_at`** — cuándo
  se mostró el menú — y entre eso y la elección tiene que pasar un piso de **dos segundos**.
  Elegir antes de que el menú exista (delta negativo) cae en el mismo rechazo: es imposible, no
  rápido. El campo entra a la preimagen del hash, así que cambiarlo después de sellar rompe la
  cadena — el vector de hash fijado en las pruebas cambió a propósito, que es exactamente para lo
  que ese vector existe.
  **Límite**: un agente que espera dos segundos antes de inventar la decisión pasa igual. Detecta
  lo imposible, no lo mentiroso.

- **El ancla externa existía y no la estábamos usando: git** (`verify-audit-chain.mjs history`).
  El límite declarado de este gate decía que recortar la cadena o refabricarla entera exigían "un
  ancla fuera del archivo, y no hay ninguna portable". Era falso. Una traza de auditoría **sólo
  crece**, así que cada versión commiteada tiene que empezar con la anterior — y eso se verifica
  contra un registro que no vive dentro del archivo atacado, con la herramienta que el protocolo ya
  usa. Comprobado sobre este mismo repo: 22 versiones commiteadas de `.vibe/AUDIT.md`, cero
  violaciones de crecimiento.
  El subcomando nuevo detecta lo que `check` no podía: recortar las últimas líneas, refabricar la
  cadena entera sobre contenido falso, borrar el archivo aunque después reaparezca vacío, y un
  árbol de trabajo que no extiende lo último commiteado. Un repo sin commits sale `VACÍO:`, no `OK:`.
  **Lo que queda, declarado**: quien reescriba la historia publicada puede fabricar una secuencia
  coherente. Lo que cambió es que falsificar dejó de ser invisible — exige tocar el identificador
  de cada commit, y eso lo ve cualquiera con un clon previo o con el remoto.

- **La suite ahora sí está verde en un clon recién hecho** (hallazgo 60). Clonar el repo
  publicado y correr las pruebas ahí daba **dos rojas** que no se veían desde el árbol de
  trabajo: el parser del instalador PowerShell asumía finales de línea LF —y git entrega CRLF al
  hacer checkout en Windows, así que el `slice` se comía el resto del archivo—, y la prueba del
  manifiesto Graphify exigía un archivo que está en `.gitignore` y que un clon no tiene. La
  primera pasaba **sólo en la máquina donde el archivo casualmente tenía LF**.
  Los dos parsers normalizan CRLF antes de leer, y la prueba del manifiesto se declara
  **salteada con el motivo impreso** en vez de pasar en verde — saltear callado habría sido el
  mismo verde vacío que este release eliminó. Verificado clonando de nuevo desde GitHub:
  535 pasan, 0 fallan, 1 salteada con su motivo a la vista.

- **Las fases se renumeran de 1 a 8, y Discovery pasa a llamarse Research.** Antes la numeración
  arrancaba en 0 y tenía una fase 0.5, y el cierre entero vivía apretado dentro de una sola fase 4
  con ocho sub-pasos. Ahora: **1 Bootstrap · 2 Research · 3 Spec · 4 Plan · 5 Build · 6 Test ·
  7 Simplify · 8 Deploy**. Publicar deja de ser el último renglón de otra fase y pasa a ser la
  fase 8 con sus propios chequeos — tenerlo escondido adentro del cierre es lo que hizo que el
  hallazgo 55 tardara en aparecer.
  Simplify se movió físicamente: antes se simplificaba **antes** de la revisión adversarial, o sea
  se reordenaba código que todavía podía estar mal. Ahora va después de toda la fase de Test. Para
  no perder la red que daba el orden viejo, la fase 7 suma un paso nuevo, **7.2 Re-verificar**: la
  suite completa vuelve a correr sobre el estado ya simplificado, porque simplificar sin volver a
  verificar es exactamente cómo se rompe algo en silencio.
  Ocho checks de contrato nuevos, uno por fase, más uno para la re-verificación: renumerar o
  reordenar sin actualizar el contrato es un rechazo, no un protocolo con dos numeraciones a la vez.
  **El renombre es del nombre visible**: los archivos (`verify-discovery-*.mjs`), las carpetas
  (`docs/discovery/`) y los identificadores de schema (`vcp.discovery-decision/3`) quedan intactos
  a propósito, porque están grabados dentro de decisiones ya selladas por hash y cambiarlos
  obligaría a re-sellar el historial — el movimiento que este protocolo trata como falsificación.
  Y **no se tocaron los registros históricos** (`AUDIT.md`, `SESSION.md`, `RETRO.md`, `CHANGELOG`,
  `research/`): describen lo que pasó bajo la numeración vieja, y reescribirlos sería falsificarlos.

- **La cobertura ya no publica un número medido sobre código que se movió** (hallazgo 59). Una
  lectura de 98,85 % que no se reproducía resultó no ser un hueco en el código sino en la medición:
  de ocho corridas seguidas, las tres hechas mientras se editaba un script inventaron ramas sin
  cubrir, y las cinco con el árbol quieto salieron limpias. La herramienta mapea líneas contra el
  archivo tal como está al terminar; si cambió durante la corrida, el mapa no corresponde a lo que
  se ejecutó. El gate ahora toma una huella sha256 del contenido de todos los scripts antes y
  después de medir, y si difieren rechaza con `COVERAGE_SOURCE_CHANGED` **sin publicar ningún
  porcentaje**. El riesgo que cierra no es el número: es perder horas buscando en el código un
  hueco que sólo existía en la medición.
  **Límite**: la huella cubre `scripts/`, que es lo que el gate mide; un cambio en `tests/` durante
  la corrida sigue sin detectarse.

- `install.ps1` **verificado ejecutando** en PowerShell real, no sólo por inspección del texto:
  instalación en carpeta limpia, `.gitignore` escrito respetando el contenido previo, 0 archivos
  del runtime en la superficie del proyecto, y tres instalaciones seguidas dejan la regla una vez.

- **El instalador ya no deja su propio runtime como superficie del proyecto** (hallazgo 58,
  encontrado instalando VCP en una carpeta limpia por primera vez). El repo de VCP ignora
  `.vibe/vcp-runtime/` en su `.gitignore`, pero el instalador nunca escribía esa regla en el
  proyecto del usuario: los 114 archivos del runtime quedaban sin seguimiento y por lo tanto
  dentro de lo que git considera superficie viva. El usuario los commiteaba sin querer, y —lo
  grave— **un hallazgo dentro del runtime bloqueaba el gate de seguridad del proyecto con un
  CRITICAL que el usuario no escribió y no podía arreglar editando su código**. Reproducido
  plantando un secreto en el runtime instalado: el gate pasó de `OK` a `REJECTED` en un proyecto
  cuyo código no había cambiado. Ahora los dos instaladores escriben la regla de forma idempotente,
  creando el `.gitignore` si no existe y respetando lo que ya tenía. Verificado en una instalación
  limpia real: la superficie pasó de 124 archivos a 11, con 0 del runtime.
  El defecto era **invisible desde el repo de VCP**, donde la regla sí existe.

- **Sonda de directorio vacío** (T13): nuevo gate `verify-empty-probe.mjs`, que existe por un
  fallo propio reproducido tres veces. La lista de gates que decían `OK:` sin haber comparado nada
  se armó leyendo el código, y quedó corta las tres veces: eran seis, la batería completa encontró
  un séptimo —en el gate que T11 había agregado horas antes— y una sonda de diez líneas encontró
  dos más. Uno era grave: **`verify-audit-chain.mjs check` sobre un `.vibe/AUDIT.md` borrado entero
  decía "cadena íntegra"**, o sea que borrar el rastro de auditoría completo pasaba en verde. El
  otro era `verify-runtime-sync.mjs` sin runtime instalado. Los dos ahora escriben `VACÍO:` y
  aceptan `--require-inputs` (`AUDIT_CHAIN_NO_INPUTS`, `RUNTIME_SYNC_NO_INPUTS`).
  Leer el código no alcanzó; ejecutarlo sí. Por eso la sonda quedó como gate: corre cada gate en
  una carpeta vacía y compara lo que dice contra lo que declara `contracts/empty-probe.json`.
  Cinco comportamientos: `reject`, `usage`, `empty`, `self` (mira el propio checkout de VCP, no el
  proyecto) y `skip`; los dos últimos exigen motivo escrito y se cuentan en la salida, para que un
  gate que nadie prueba se vea en vez de desaparecer. **Lo que cierra el agujero de verdad**: un
  `verify-*.mjs` que no figure en el contrato es rechazo, así que agregar un gate obliga a declarar
  qué hace sin entradas — exactamente lo que faltó cuando T11 abrió el séptimo hueco.
  Tres checks de contrato nuevos (74) fijan el gate y la regla por separado.
  **Límites declarados**: prueba una sola invocación por gate, así que otro subcomando puede tener
  su propio verde vacío sin que se note; sólo prueba el caso extremo de la carpeta vacía, no un
  proyecto a medio llenar; y `self` es una declaración humana, no una comprobación — escrita sobre
  un gate que sí mira el proyecto, el verde vacío vuelve a pasar. `verify-vcp-coverage.mjs` queda
  excluido con motivo: correrlo ejecuta la suite entera, y su comportamiento sin entradas NO está
  probado por esta sonda.

- **Verde vacío visible** (T12): un gate que no encontró nada que comparar dejó de escribirse igual
  que uno que comparó y pasó. Hasta ahora `verify-evidence-trace.mjs`, `verify-session-state.mjs` y
  `verify-phase-decisions.mjs` imprimían `OK:` en siete caminos donde no habían verificado
  absolutamente nada: sin `docs/spec.md`, con una spec sin criterios declarados, sin Discovery, con
  la decisión vigente sin packet, sin identificadores contra los cuales resolver, sin
  `.vibe/SESSION.md`, y sin `docs/phase-decisions.json` — este último un hueco recién abierto por
  T11, encontrado corriendo la batería completa horas después. Un verde por ausencia de
  entradas se leía como un verde por evidencia, así que **borrar la spec compraba silencio**. Ahora
  esos caminos devuelven `vacuous: true` y el CLI escribe `VACÍO:` en vez de `OK:`, con exit `0`
  igual que antes: la ausencia de una spec sigue sin ser una violación, porque en Bootstrap todavía
  no hay spec y ahí el vacío es normal. Lo que cambia es que se ve. Y donde el protocolo **ya
  exige** que la entrada exista, el nuevo flag `--require-inputs` convierte ese vacío en rechazo
  (`EVIDENCE_TRACE_NO_INPUTS` / `SESSION_STATE_NO_INPUTS` / `PHASE_DECISION_NO_INPUTS`, exit `1`): la Fase 4 corre `criteria`
  con el flag, porque a esa altura la spec tiene que estar. Dos checks de contrato nuevos (71 en
  total) fijan que la Fase 4 lo lleve y que la distinción quede escrita, para que sacar el flag sea
  un rechazo y no un silencio. El límite honesto `evidence-trace-degrades-to-green-without-inputs`
  se reescribió en consecuencia: el costo ya no es que el vacío se disfrace de verde, sino que
  sigue siendo exit `0` en todo comando que corra sin el flag.

- Nuevo gate `verify-phase-decisions.mjs` (T11): **la regla más central de VCP ya tiene detector**.
  El protocolo exige desde su LAW 7 que cada fase cierre con un menú 🔵 —opciones explícitas,
  recomendación, y la persona elige— y **nada lo verificaba**: una fase podía cerrarse sin haber
  mostrado el menú, con una opción que no estaba en la lista, o editando las opciones después de que
  la persona eligió. Era exactamente la regla decorativa que el propio protocolo dice combatir.
  `check <decisions.json>` verifica sobre `docs/phase-decisions.json`: una decisión vigente por fase
  (sin duplicados), fases en el orden que declara el **propio archivo** en `phase_order` —sin saltos
  hacia atrás, sin reabrir una fase ya cerrada y sin omitir una fase anterior a otra que ya cerró—,
  la opción elegida presente en el menú que se mostró, recomendación y justificación no vacías,
  timestamps que no retroceden, y una cadena de hashes íntegra. Una decisión reemplazada no se
  borra: se marca `superseded` y se registra la nueva, igual que hace el inventario de requisitos.
  Sin archivo de decisiones sale `0`: un proyecto que no arrancó ninguna fase no incumple nada.
  **El encadenado no se reinventó**: importa `chainHashFor` de `verify-audit-chain.mjs`, así que
  ambos gates sellan con la misma fórmula —`sha256(cadena anterior + LF + contenido)`— y una prueba
  lo comprueba construyendo sus fixtures con la función del gate de auditoría, no con la del gate
  nuevo (SKILL.md § "Redacción reutilizable"). A la preimagen entran los **nueve campos de
  contenido**, `options` y `selected_option` incluidos: si el menú quedara afuera, agregar después la
  opción que se eligió —el ataque principal— pasaría en verde. Un vector de hash literal fija la
  serialización para que nadie la cambie sin que una prueba se ponga roja.
  **Atacando el gate con el CLI real** se encontró y cerró un defecto propio: `['A) una spec',
  'A) una spec ']` pasaba como menú de dos opciones siendo una sola para quien la lee — la unicidad
  ahora se mide sobre el texto recortado. Los ataques que sí rechaza, cada uno reproducido: agregar
  una opción al menú después de elegir, recalcular sólo el hash de esa decisión, reescribir o
  recortar el menú, reordenar el archivo, borrar la primera decisión, insertar una fase intermedia en
  `phase_order`, sacar de `phase_order` una fase que ya tiene decisión, cambiar `status` de `decided`
  a `superseded` después de cerrar, intercambiar recomendación y elección, duplicar una decisión,
  escribir el hash en mayúsculas, adelantar un timestamp y mover contenido entre campos.
  **Lo que NO detecta, reproducido y declarado** en el comentario de cabecera, en README, en SKILL y
  en `contracts/honest-limits.json`: el gate demuestra que la decisión quedó registrada de forma
  coherente, **no demuestra que la persona realmente haya querido esa opción ni que haya comprendido
  sus consecuencias** — un agente puede registrar decisiones que nadie tomó y el gate las acepta.
  Hereda además los límites de la cadena de auditoría: recortar las últimas decisiones, reescribir la
  última (que es la cabeza de la cadena, o sea la de la fase vigente) o recalcular la cadena entera
  sobre contenido falso pasan en verde, y los tres exigen un ancla fuera del archivo. `phase_order`
  no está encadenado: agregar una fase futura al final es legítimo e indetectable. Una prueba
  reproduce los cuatro para que el límite no se pueda perder en silencio.
  Plantilla nueva `templates/phase-decisions.json`, con una decisión donde la persona **no** siguió
  la recomendación —la recomendación no es la decisión— y una `superseded` con su reemplazo.
  Cableado: SKILL.md (regla + gate al cerrar fase + formato del registro), README (fila de gates con
  su límite), `verify-vcp-contract.mjs` (tres promesas nuevas, la regla y el gate fijados aparte) y
  dos límites honestos nuevos.
- `verify-backup-state.mjs`: **`record` ya no puede destruir un archivo del proyecto**. Defecto
  preexistente, encontrado atacando el gate con el CLI real: el manifest se escribía sobre cualquier
  ruta que fuera un archivo regular dentro del proyecto, así que cinco combinaciones de banderas
  **borraban un archivo y devolvían `OK` con exit 0** —`--manifest` apuntando al grafo, al reporte,
  al mismo archivo con otra escritura (`./g/graph.json`), o a un archivo cualquiera como
  `README.md`—. Un operador que se equivocaba de bandera perdía el archivo y recibía una
  confirmación de éxito, en un gate cuyo trabajo es proteger evidencia.
  Ahora, si la ruta de salida ya existe, sólo se sobrescribe cuando es un receipt que escribió esta
  misma herramienta (`schema: vcp.graphify-backup/v1`); todo lo demás se rechaza **antes de escribir
  un solo byte**. Es la regla que el propio test ya declaraba en un comentario —«an existing regular
  manifest is the only overwrite allowed»— y que el código nunca verificó. Las rutas se comparan
  resueltas por `realpath`, no como strings: `./graphify-out/graph.json` y `graphify-out/graph.json`
  son el mismo archivo, y en Windows también lo son dos escrituras que sólo difieren en mayúsculas.
  Re-registrar sobre un receipt anterior —el único overwrite legítimo— sigue funcionando.
  Además, el reporte y el grafo ahora tienen que existir, ser archivos regulares dentro del proyecto
  y **no estar vacíos**: un `--report` de cero bytes se sellaba en verde y ahora sale exit `1`. Es
  un piso mínimo, no una validación de que el archivo sea un artefacto de Graphify — el gate
  deliberadamente dejó de inspeccionar el contenido del reporte, y `--report NOTES.md` con
  contenido cualquiera se sigue registrando.
  Las pruebas comprueban el **archivo**, no sólo el exit code: comparan el sha256 antes y después de
  cada intento rechazado. Verificar únicamente el código de salida habría dejado pasar el defecto
  entero, porque el punto es que los bytes sobrevivan.
- `verify-backup-state.mjs`: **el sello del backup lo registra el protocolo, no Graphify**
  (hallazgo 55). El gate leía el `- Built from commit:` del `GRAPH_REPORT.md` y lo comparaba contra
  HEAD. Pero Graphify sólo reescribe ese reporte cuando cambia la **topología** del código: un
  commit de sólo documentación deja ese sello apuntando a un ancestro **para siempre**, aunque el
  contenido del grafo esté perfectamente al día, y no hay forma de regenerarlo —`GRAPHIFY_FORCE=1`
  no alcanza sin cambios de topología y `graphify label` exige una API key—. Resultado reproducido
  en este repositorio: `check` rechazaba un backup sano y ninguna corrida de Graphify lo arreglaba.
  Ahora `record` lee el HEAD real con `git rev-parse` y lo escribe en el receipt; `check` verifica
  que ese `git_head` siga siendo el HEAD actual y que los hashes del reporte y del grafo sigan
  coincidiendo. **Es más fuerte, no más débil**: antes se confiaba en una línea de texto escrita por
  una herramienta externa según cuándo se la corrió; ahora se verifica el contenido real de los
  archivos contra un HEAD que registra el propio protocolo. La comparación de HEAD además pasó de
  `head.startsWith(sello)` a **igualdad exacta**, así que un prefijo corto escrito a mano —que antes
  pasaba— ahora se rechaza. En un checkout sin ningún commit, `record` y `check` fallan con un
  mensaje propio en vez del ruido de git.
  **La garantía que se pierde, declarada**: ya no se prueba que el grafo haya sido *construido* en
  ese commit, sólo que su contenido no cambió desde que se registró — un grafo de otro proyecto se
  registra igual de verde. Esa otra mitad —que el grafo cubra los archivos del commit actual— la
  cubre `verify-graphify-manifest.mjs` contra `git ls-files`. Dos límites honestos nuevos en
  `contracts/honest-limits.json`: uno en README y otro en SKILL, este último para que nadie vuelva a
  cablear el gate contra la línea del reporte al ver el sello atrasado.
  **Lo que NO se aflojó**: contenido del grafo o del reporte modificado después del registro, y HEAD
  movido después del registro, siguen siendo exit `1` — cada uno con su fixture explícito.
  `graphCommit()` quedó sin ningún uso —era el único lector de esa línea— y se eliminó junto con su
  prueba. El orden **commit → graphify → record → check** quedó escrito en `SKILL.md` 4.7 y fijado
  en `verify-vcp-contract.mjs`: `record` sella el HEAD del momento, así que registrar antes de
  commitear ata el receipt al commit anterior.
- Nuevo gate `verify-session-state.mjs` (items 43, 34/35/38 y 32): lo que queda escrito cuando algo
  se interrumpe o falla. `check --session .vibe/SESSION.md` verifica tres cosas sobre el archivo
  que alguien lee para retomar, y ninguna de las tres tenía detector.
  **Reintentos** — al **tercer** intento fallido sobre el mismo problema el protocolo frena y
  consulta; tres intentos sin una `- decisión humana:` registrada son exit `1`, y el rechazo nombra
  el problema y los tres intentos con qué se probó y por qué falló cada vez. Tres alcanza para
  descartar un error tonto sin quemar la sesión en un callejón sin salida.
  **Interrupción** — declarar que la sesión se cortó obliga a declarar dónde retomar: `Fase`,
  `Tarea` y `Falta`. Una interrupción sin punto de retome es exit `1`. La cuota se agotó a mitad de
  la primera corrida real de este protocolo y retomar costó reconstruir el estado leyendo el diff.
  **Deliberadamente NO hay presupuestos ni topes por fase** (item 38, decisión del 2026-08-28): un
  tope mal calibrado frena trabajo legítimo y no hay datos históricos para calibrarlo. El gate
  registra y verifica estado; no mide consumo ni corta trabajo.
  **Verificación no realizada** — toda comprobación que no se pudo hacer (`git fetch` con timeout,
  un comando ausente, el checkout fuente en otra máquina) va a `## No verificado` con la marca
  literal y su motivo. Una entrada de esa sección afirmada como realizada es exit `1`: un fallo
  silencioso no puede quedar leyéndose como un éxito. El gate no ejecuta red ni mide cuota.
  Las tres secciones son **opcionales** y aparecen sólo cuando aplican: un `SESSION.md` sin ninguna
  es un estado normal, y sin `SESSION.md` sale `0` —un proyecto que todavía no arrancó no incumple
  nada—. Formato Markdown legible con encabezado fijo, documentado con un ejemplo de cada sección
  en `templates/vibe/SESSION.md`; los ejemplos van dentro de un bloque comentado y el gate ignora
  los comentarios HTML, porque esa plantilla se copia tal cual y si no todo proyecto nuevo
  arrancaría declarando una interrupción que nunca ocurrió.
  La lectura del archivo **no se reimplementó**: usa `safeProjectFile` de `ratchet.mjs`, que ya fija
  el criterio del repo —nada fuera del proyecto, ningún symlink, ningún archivo que no sea regular—
  y devuelve `null` cuando el archivo no existe, que acá es exactamente el caso verde. Es la regla
  #46 aplicada al propio trabajo.
  Cableado en `SKILL.md` Phase 0 paso `5b`, justo después del gate de identidad: la identidad dice
  de quién es el checkpoint, esto dice si sirve para retomar. La regla de los tres intentos quedó
  escrita como regla del protocolo en § LAWS, no sólo implícita en el gate, y las dos —regla y
  gate— están fijadas por separado en `verify-vcp-contract.mjs` para que borrar el gate no borre
  la regla.
  Falsificado sobre una **copia** del `SESSION.md` real de este repositorio (verde con cero
  secciones declaradas no prueba nada): se declararon los dos rechazos del gate de word cap que el
  archivo ya narraba en prosa, y el gate pasó en verde con dos intentos, rechazó al agregar el
  tercero sin decisión, rechazó una interrupción sin `Falta`, y rechazó `git fetch origin/main`
  afirmado como verificado dentro de `## No verificado`.
  Dos límites honestos en `contracts/honest-limits.json` (README + SKILL): verifica que lo declarado
  sea coherente, **no que sea verdad** —una sesión que miente en su propio archivo pasa—, y las tres
  secciones son opcionales, así que el silencio compra verde, no un rechazo.
- Corregida una deriva silenciosa en `research/adversarial-productivity-audit-2026-08-23.md`: la
  columna de estado estaba corrida. Tres commits (`19abb0b`, `fed0623`, `0ace5dc`) reemplazaron la
  primera aparición literal de `SIGUIENTE` en vez de la fila que querían tocar, y cada descripción
  aterrizó en el item equivocado —el 27 (hash-chain) figuraba como una regla de contexto, el 32
  (red) como "misma regla que #36"— mientras siete items ya implementados (36, 37, 40, 44, 45, 46,
  47) seguían marcados `SIGUIENTE`. Cada descripción se movió a su fila; ninguna se perdió.
- Nuevo gate `verify-evidence-trace.mjs` (hallazgos 41 y 33): las dos referencias que el protocolo
  pedía en prosa y nadie podía comprobar. `criteria --spec docs/spec.md --tests tests` verifica que
  cada `AC<n>` declarado en la spec esté nombrado por al menos una prueba real; `claims --feature
  <slug>` verifica que cada `linked_requirement_id` y `linked_ac_id` del packet de la decisión
  Discovery **vigente** resuelva contra un identificador que la spec declara —un claim que cita un
  criterio inexistente es una referencia rota, no evidencia—.
  La convención de mención **no es nueva**: se reusa la que ya fija `verify-test-bindings.mjs` —el
  id como segmento separado por `·` de una llamada literal `test()`/`it()`, y la decisión de si esa
  llamada es real la toma la propia `hasLiteralTestDeclaration()`, importada, no reimplementada—.
  Lo único que se ensancha es la posición: el id puede ser cualquier segmento, porque el protocolo
  también exige el prefijo `FALSIFICACIÓN · `, que un `startsWith` literal prohibiría. Un id en un
  comentario, en un string o en la prosa del título no cuenta como cobertura.
  Corrido contra este repositorio el día del arreglo, `criteria` salió en rojo de verdad y nombró
  **3 criterios**: `AC12` (sello mal formado) no lo nombraba ninguna prueba —las dos que sí cubren
  ese comportamiento existían desde siempre, pero nada las ataba al criterio—, y `AC8`/`AC9`
  llevaban el id en la prosa final del título (`... (AC8)`) en vez de como segmento. Los cuatro
  títulos se adaptaron a la convención; no se escribió ninguna prueba nueva para taparlo.
  Cableado en `SKILL.md`: `criteria` en 4.5, **antes de escribir el receipt** —declarar el trabajo
  terminado con un AC que nadie probó es exactamente lo que evita—, y `claims` al final de
  Phase 0.5. Las dos promesas quedaron fijadas por archivo en `verify-vcp-contract.mjs`, así que
  borrar el comando de una fase falla por su cuenta.
  Dos límites honestos declarados en `contracts/honest-limits.json` (README + SKILL): el gate
  verifica que exista una prueba que **nombre** el criterio, no que esa prueba lo compruebe —es
  trazabilidad, no suficiencia—; y sin spec, sin criterios declarados o sin Discovery sale `0`,
  o sea que borrar `docs/spec.md` compra silencio, no un rechazo.
- Nuevo gate `verify-runtime-sync.mjs` (hallazgo 53): el runtime que un proyecto **ejecuta** ya no
  puede envejecer en silencio respecto del checkout que lo instaló. `install.sh` copia
  `scripts/`, `contracts/`, `tests/`, `templates/` y `skills/` (más `SKILL.md` y `SECURITY.md`) a
  `<proyecto>/.vibe/vcp-runtime/` una sola vez; desde ahí la copia se queda vieja y nada avisa.
  Ya costó tiempo real: el gate de Discovery rechazó con `DISCOVERY_SNAPSHOT_INVALID` una evidencia
  perfectamente válida corriendo desde el runtime instalado, y la aceptó corriendo desde `scripts/`.
  El problema nunca fue la evidencia, era la copia vieja — y no había forma de saberlo.
  `node scripts/verify-runtime-sync.mjs check [--runtime <ruta>]` compara por hash de contenido y
  nombra las tres clases que importan: los archivos que **difieren**, los que **faltan** en el
  runtime y los que **sobran** —un gate borrado arriba que el proyecto sigue ejecutando es tan
  peligroso como uno viejo—. Sin runtime instalado sale `0` con un mensaje que lo dice: un checkout
  fuente limpio es normal, no un error. Un `--runtime` que no existe sí falla: un typo ahí dejaría
  el gate ciego y verde para siempre.
  La superficie comparada no se inventa, se deriva: la suite parsea `install.sh` y `install.ps1` y
  se pone roja si cualquiera de los dos empieza a copiar algo que la lista no nombra.
  Verificado además que el instalador **no transforma** ningún archivo dentro del runtime —una
  instalación fresca queda byte-idéntica en las cinco carpetas y los dos archivos—: el `sed` /
  `-replace` de `(fill in)` y `YYYY-MM-DD` toca únicamente `<proyecto>/.vibe/PROJECT.md`, que vive
  fuera de `vcp-runtime/`. No hay exclusiones.
  Cableado en `SKILL.md` Phase 0 como paso `1b`, antes de cualquier otro gate: correr el protocolo
  entero contra gates viejos invalida todo lo que venga después. Se corre **desde el checkout
  fuente**, nunca desde el runtime — compararlo consigo mismo sería verde siempre y evidencia cero;
  esa promesa quedó fijada en `verify-vcp-contract.mjs`, no librada a la próxima edición.
  Límite honesto declarado en `contracts/honest-limits.json` (README + SKILL): detecta que la copia
  difiere, no que la copia sea correcta ni que el fuente lo sea —dos copias idénticas de un gate
  roto pasan igual—, compara contenido y no permisos (el `+x` sobre `scripts/*.sh` no se verifica),
  y sólo puede hablar donde el checkout fuente y el runtime conviven en la misma máquina.
  Corrido en este repositorio el día del arreglo, el gate salió en rojo de verdad: 11 archivos
  divergentes —entre ellos la versión vieja de `verify-red-node.mjs`, con el defecto del hallazgo
  51 que ya estaba arreglado en el fuente— y 3 ausentes, incluido `contracts/honest-limits.json`.
- `verify-red-node.mjs` ya no confunde el **título** de un test con un archivo roto (hallazgo 51).
  La señal de parseo (`SYNTAX_SIGNAL`: `SyntaxError`, `Unexpected token`, `collection error`,
  `ERROR collecting`, `IndentationError`) corría sobre la salida cruda del runner, y por esa misma
  salida salen los títulos de los tests. Dos archivos idénticos salvo el nombre daban veredictos
  opuestos: el titulado `maneja un collection error del runner` era rechazado con «the test file
  failed to parse/load» —una afirmación falsa sobre un archivo que compilaba perfecto— y el mismo
  sin esa frase pasaba. Costó una tarea real: bloqueó T02 hasta renombrar un test existente
  (`source-collection errors` → `source-collection failures`) sólo para poder trabajar.
  El arreglo no agrega regex, se apoya en una diferencia estructural medida: un archivo que no
  parsea nunca llega a ejecutar un assert, así que **no puede** producir un bloque `ERR_ASSERTION`
  atado a su línea `not ok`; una prueba real sí. `SYNTAX_SIGNAL` queda como redacción solamente: se
  consulta únicamente cuando ya se decidió el rechazo por ausencia de ese bloque, para elegir el
  mensaje específico de fallo de carga en vez del genérico. Nunca provoca un rechazo por su cuenta.
  No debilita el gate: el caso que la señal protegía —un archivo que no compila— sigue rechazado en
  el mismo punto, por el chequeo de bloques de assertion que ya existía, y conserva su mensaje.
  Falsificado en las dos direcciones con procesos reales: dos archivos byte-idénticos salvo el
  título ahora pasan igual, y un archivo con `SyntaxError` real sigue dando exit 1. Se revirtió el
  rename que el defecto había forzado, como evidencia viva en la suite de que la traba ya no está.
- Reconciliación documental del hardening round 5: T01–T05 pasan de estado pendiente a
  implementado con referencias verificables a `98d2058`; el spec y la propuesta ya no describen
  un estado histórico falso. El backlog restante conserva estado explícito y no se promociona a
  completado sin un ciclo independiente de VCP.
- Nuevo gate `verify-scope-diff.mjs`: después de GREEN compara exactamente los writers declarados
  de una tarea con el delta real de Git, incluidos archivos untracked. Las excepciones operativas
  deben listarse con `--ignore` de forma explícita; no se agrega una exclusión global de `.vibe/`.
- `contracts/honest-limits.json` (backlog #40), cuarta y última feature construida con el protocolo
  completo sobre el propio VCP. Las frases que declaran lo que un gate **no** prueba se protegían a
  mano en un array del código, sin decir por qué importaba cada una: una edición futura que
  "mejorara la redacción" podía debilitar una garantía sin que nada fallara.
  Ahora son 16 límites declarados como dato revisable, cada uno con el `why` de qué se pierde si
  desaparece. El rechazo imprime ese motivo, para que quien tocó la frase entienda qué está
  sacando. La comparación es de texto literal, nunca un patrón que alguien pueda aflojar.
  El RED encontró de paso que dos de los seis límites que existían fijaban **títulos de sección**,
  no afirmaciones: se podía dejar el título y vaciar el párrafo. Ahora la oración sustantiva de cada
  uno también está fijada.
  Límites del propio gate: verifica que la frase esté, no que el párrafo que la rodea siga siendo
  cierto; y un límite que nadie declaró tampoco se protege.
- `verify-receipt.mjs commit` (backlog #22), tercera feature construida con el protocolo completo
  sobre el propio VCP. `check` validaba el árbol y después el operador corría `git commit` a mano:
  entre esas dos cosas pasaban minutos y nada impedía una escritura. Ahora una sola corrida valida,
  commitea y **confirma después** que el árbol commiteado es el índice que validó, comparando el
  `write-tree` de antes contra `HEAD^{tree}` de después.
  Dos no-comportamientos deliberados: si la confirmación falla, deja el commit hecho e imprime el
  comando para deshacerlo — este gate nunca reescribe historial por su cuenta; y nunca pasa
  `--no-verify`, porque saltear los hooks del operador en silencio es peor que el problema que
  resuelve.
  El nombre no dice "atómico" a propósito: la ventana pasa de minutos a milisegundos, no
  desaparece. La confirmación prueba que el commit contiene el índice revisado, no que no hubo una
  escritura concurrente. Ambos límites están en el gate, en README y en SKILL.md.
- `verify-security-baseline.mjs` acepta `--baseline <archivo>` (backlog #47), segunda feature
  construida con el protocolo completo sobre el propio VCP. Antes el gate no distinguía deuda ya
  revisada de un hallazgo nuevo, así que sólo quedaban dos salidas malas: convivir con un gate que
  falla siempre por algo viejo, o mover la base y dejar de ver lo nuevo. Ahora lo aceptado no
  bloquea, lo nuevo sí, y una entrada que ya no corresponde a ningún hallazgo real **también**
  bloquea: un baseline con entradas muertas oculta cuánta deuda se está tapando.
  La identidad de un hallazgo es `sha256(categoría + path + evidencia)` — sin el número de línea,
  para que mover el código no invalide el registro.
  TRIANGULATE encontró y cerró cinco agujeros, todos reproducidos con el CLI real antes de
  escribirse como prueba. El peor: una entrada podía llevar el `finding_id` de un CRITICAL vivo y
  describirse como una tarea vieja de CI en otro archivo, tapándolo y sin caducar nunca. Cerrado
  exigiendo que el `finding_id` sea el hash de sus propios campos. También: dos acciones de CI sin
  pinear compartían identidad, un salto de línea en un campo permitía correr la frontera del hash,
  `--baseline` aceptaba rutas fuera del proyecto, y repetir la bandera elegía en silencio.
  Límites declarados: aceptar un secreto cubre archivo y categoría, no un valor concreto; una
  entrada cuyo archivo quedó fuera del delta no se puede juzgar y no caduca.
- Nuevo gate `verify-audit-chain.mjs` (backlog #27), construido con el protocolo completo sobre el
  propio VCP. `.vibe/AUDIT.md` era append-only por convención y nada lo verificaba: una línea vieja
  podía reescribirse sin dejar rastro. Ahora cada línea lleva el hash de la anterior, `append` la
  sella (escritor y verificador comparten la función de hash, así no pueden divergir) y `check`
  nombra la línea exacta donde se rompe la cadena.
  Durante TRIANGULATE se reprodujo un ataque real: manglar todos los sufijos `chain:` degradaba el
  archivo a "traza heredada" y una línea con contenido falsificado pasaba con exit 0. Cerrado: un
  sufijo mal formado es manipulación, no una línea vieja. Verificado sobre el `AUDIT.md` real de la
  sesión que lo construyó.
  Límites declarados, no resueltos: borrar los sufijos enteros de toda la traza, recortar sus
  últimas líneas o recalcular la cadena completa siguen pasando. Los tres exigen un ancla fuera del
  archivo.
- `verify-receipt.mjs check` acepta `--require-clean-worktree` (backlog #23): en 4.6 exige que no
  queden paths unstaged ni untracked, de modo que el árbol revisado sea el árbol commiteado. El
  `check` sin la flag no cambia: un receipt intermedio debe poder atestiguar trabajo sin stagear.
  La flag angosta la ventana entre `check` y `git commit`; no la cierra.
- Nuevo gate `verify-graphify-manifest.mjs`: cierra el backlog #30. Antes, "100% extracted" no
  distinguía un archivo excluido a propósito de uno perdido por accidente. Ahora cada archivo
  rastreado debe estar en el manifest del grafo o llevar una exclusión con razón en
  `contracts/graphify-exclusions.json`, y una entrada del manifest que Git ya no rastrea se
  rechaza como fantasma. El gate prueba contabilidad, no comprensión: un archivo indexado todavía
  puede haber producido cero nodos. Se eliminó `templates/vibe/COUNTERS.json`, un fantasma
  producido por un rename que sólo cambiaba mayúsculas en un filesystem case-insensitive.
- Nuevo requisito `REQ-G12`: el locator de un claim de evidencia rechaza credenciales embebidas,
  esquemas distintos de `https`, URLs no parseables, caracteres de control y paths que escapan del
  checkout. El gate registra la referencia, nunca la resuelve: no hace red ni abre el path.

### Discovery workflow (2026-08-27, evidence before specification)
- **Discovery now precedes Spec for non-trivial work.** The protocol requires traceable research,
  a CAIO diagnosis, current→target loop map, PRD, implementation/adoption/recurrence plan before
  a product spec is approved. The new section distinguishes supported evidence from hypotheses and
  makes a human decision, rather than a prose report, the boundary into Phase 1.
- **Immutable decision history is native and executable.**
  `verify-discovery-core.mjs` validates append-only run chains, hashes, transition/state payloads,
  packet snapshots, claim/trigger coverage and filesystem boundaries. It does not treat mutable
  research ledgers as historical evidence.
- **Derived Discovery views are reproducible.** `verify-discovery-views.mjs` renders only
  deterministic Markdown views from the immutable JSON history and rejects stale, malformed,
  unexpected or unsafe view artifacts. VCP ships the runtime and tests with both installers.
- **Phase closure is no longer slow or recursive.** Binding evidence now runs each shared Node TAP
  file once while still checking every exact requirement title. I0 self-validation uses a dedicated
  non-recursive selftest, and prerequisite phase closure is memoized per static validation run.

### Hardening pass 11 (2026-08-24, native security boundaries)
- **Phase 4.3 is now fully native to VCP.** The live protocol no longer requires or invokes
  external skills. Its security gate blocks known provider-token/private-key shapes, sensitive
  artifacts, dynamic execution, SQL/template/HTML injection patterns, unsafe GitHub Actions
  configuration, unsafe scanner inputs and unscannable release files.
- **Executable inputs now fail closed at the filesystem boundary.** Receipts, Graphify backup
  manifests and ratchet counters reject external paths, symbolic links/junctions and non-regular
  files rather than reading or writing outside a checkout. RED test execution strips inherited
  secrets and Node control variables unless an operator explicitly allowlists a name.
- **Distribution is allowlisted.** The ZIP builder packages only VCP runtime/docs/templates,
  validates version input, emits a per-archive checksum and excludes local `.env`, `.vibe`,
  Graphify/Obsidian and research state by construction. Its checksum detects accidental
  corruption; it is not publisher authentication.
- **Security claims are bounded and tested.** `SECURITY.md` explains the external-artifact
  trust rule and the remaining limits: no native SAST/SCA/CVE database, no sandbox, and no
  cryptographic receipt provenance. The suite includes falsifications for these native gates and
  retains 100% lines/branches/functions over every Node script.

### Hardening pass 10 (2026-08-22, full measurable coverage gate)
- **VCP now requires 100% for every coverage metric a stack can actually report.** Lines,
  branches, and functions must each be full where the runner exposes them; a missing metric is a
  documented runner limitation, never an assumed pass. The same standard is now carried through
  Phase 4, the task templates, the Chore role, examples, and the TDD protocol.
- **The VCP repository enforces its own standard mechanically.**
  `verify-vcp-coverage.mjs` runs Node's native coverage suite and rejects any `scripts/*.mjs`
  row below 100% in lines, branches, or functions. Its executable falsifications cover malformed
  reports, command failures, missing metrics, and each individual metric below threshold.

### Hardening pass 9 (2026-08-21, mechanical plan write-conflict preflight)
- **Parallel work now proves its write sets are safe before build.**
  `verify-plan-conflicts.mjs` reads `files_to_create`, `files_to_modify`, and `test_files` from
  `docs/tasks.json`; two distinct tasks claiming the same normalized project path fail closed
  unless direct or transitive `depends_on` ordering serializes them. Duplicate ids, unknown or
  cyclic dependencies, malformed writer declarations, and out-of-project paths also block Plan.
- **The parallel contract distinguishes authority from file safety.** Atomic task checkout still
  prevents two owners from claiming one task, while the new preflight prevents two independent
  tasks from racing on the same file. Executable falsification covers production and test-file
  conflicts, direct/transitive serialization, separator normalization, duplicate/unknown/cyclic
  dependencies, malformed fields, and CLI misuse.

### Hardening pass 8 (2026-08-21, explicit handoff review boundaries)
- **Every advancing handoff declares its review limit.** `verify-handoff-report.mjs` requires
  exactly one non-placeholder `NOT_REVIEWED` declaration, including a concrete basis when no
  area was omitted. The exact report is retained in `.vibe/handoffs/` and only a passing gate can
  add its `{gate, declaration, report_path}` record to `tasks.json.not_reviewed`.
- **The contract is carried by every role template.** RED, GREEN, TRIANGULATE, REFACTOR, DOCS,
  CHORE, phase-level handoffs, bootstrap memory, and the task schema now expose the same
  boundary, so a narrow review cannot be mistaken for an exhaustive one.

### Hardening pass 7 (2026-08-21, feature identity for session resume)
- **Resume state is feature-bound mechanically.** `scripts/verify-resume-state.mjs` accepts a
  resume only when `SESSION.md` declares the exact requested lowercase-kebab-case feature slug.
  Mismatched, legacy, and malformed state fails closed; Phase 0 presents user-owned archive,
  continue, retag, or inspect choices rather than silently reusing another feature's gate state.
- **Fresh and archived session templates carry the identity field.** The template, bootstrap
  instructions, and `vibe-memory.sh archive` preserve the old snapshot and reset the next session
  to an explicitly unassigned feature identity.
- **Executable regressions cover the actual failure.** The suite proves `auth-refactor` cannot
  resume as `billing-fix`, rejects missing/malformed identity and invalid requested slugs, and
  exercises the Git-Bash archive path.

### Hardening pass 6 (2026-08-17, research-derived low-risk gates)
Sourced from a 13-source real multi-agent research pass (`research/source-matrix.md`,
`research/vcp-improvement-proposal.md`), 5 candidates adopted after adversarial refutation —
full spec in `research/vcp-implementation-spec.md`.
- **IRON LAW — no completion claims without fresh evidence.** `SKILL.md` now lists 4 forbidden
  rationalizations ("should work now", "I'm confident", "already tested earlier", "trivial
  change") verbatim next to the existing "trust what's derived, not narrated" principle. Source:
  gstack `ship/SKILL.md` Step 16.
- **LESSONS dedup now specifies normalization.** `skills/vibe-memory.md` § LESSONS PROTOCOL
  requires lowercase + collapsed-whitespace comparison before matching a candidate lesson
  against `LESSONS.md`, closing a gap where trivially-reformatted duplicates could slip through.
  Source: engram `hashNormalized`.
- **LESSONS confirm-gate now flags possible sensitive content.** A pre-check greps candidate
  lesson text for `token|authorization|cookie|secret|hash|password|bearer` and marks matches
  with a visible ⚠ warning before the 🔵 confirm-gate is shown (warns, doesn't block — VCP
  already has human confirmation). Source: engram's fail-closed audit-metadata rejector, adapted.
- **Receipt rejection messages documented as 2 categories.** `SKILL.md` §4.6 clarifies that
  `verify-receipt.mjs`'s 3 existing error messages split into "ausente" (reparable by
  regenerating) and "corrupto/stale" (always requires a brand-new receipt, never patch
  in-place) — documentation only, `scripts/verify-receipt.mjs` untouched. Source: gentle-ai
  `review_facade.go:58-87`.
- **DEBT.md entries carry a short id.** Entry format in `skills/vibe-memory.md` and
  `templates/vibe/DEBT.md` adds `` `id:<hash6>` `` (hash of category+location+rule) for quick
  reference — not a uniqueness key, collisions still resolved by date+location. Source:
  paperclip `migration-safety-baseline.ts` schema (format only, no SQL engine adopted).

### Hardening pass 5 (2026-08-14, reproducible gates + spec ambiguity)
- **Valid unfinished-SUT RED no longer rejects falsely.** Both RED verifiers now accept a runtime
  failure only when three independent facts prove it: a real test-runner summary, an assertion
  marker in the named test file, and a local non-test SUT stack frame. This admits a legitimate
  `throw new Error("not implemented")` before its assertion executes while preserving rejection
  of bare runner/config errors, bare npm packages and test-code
  `ReferenceError`/`NameError`/`is not a function` failures.
- **Gate proofs are now versioned tests, not scratchpad narration.** Added dependency-free Node
  regression suites for both PowerShell/Git-Bash RED classification and receipt fingerprints:
  staged/unstaged transitions, `git add` without byte change, binaries, modes, untracked and
  sibling receipts, renamed destinations, empty/escalated receipts and SHA-256 Git all have
  executable assertions. `README.md` documents the one command to run them.
- **Spec ambiguity cannot silently enter Build.** `templates/spec.md`,
  `skills/spec-plan-templates.md` and `SKILL.md` now require observable GIVEN/WHEN/THEN or
  `THE SYSTEM SHALL` criteria and treat `[NEEDS CLARIFICATION: …]` as a hard gate before Plan
  or Build.
- **Auto-routing now counts required context, not touched paths.** Direct Build is allowed only
  when understanding and verifying the change needs 1–3 files (including tests, direct callers,
  callees, config or contract), recorded in `SESSION.md`; a one-file diff with a broad dependency
  surface now correctly receives the full pipeline.
- **Research status corrected to evidence, not labels.** `research/source-matrix.md` records
  fixed SHAs and only marks a source exhaustive after every textual/config/test blob was read
  and binary treatment was documented. Large sources remain explicitly partial with atomic
  semantic-review chunks.

### Hardening pass 4 (2026-08-14, E2E-driven protocol fixes)
- **RED vs TRIANGULATE contradiction resolved.** `skills/subagent-red.md` said "one test per
  criterion minimum" (all ACs) while `skills/subagent-triangulate.md` existed to derive edge
  cases RED didn't cover — direct overlap. Fixed: RED now writes exactly one test per explicit
  AC (hard requirement, statically countable); TRIANGULATE reads RED's file first and never
  re-derives an AC RED already covers 1:1 (`subagent-red.md`, `subagent-triangulate.md`,
  `SKILL.md` §3.1/3.3, `skills/caveman-tdd.md` checklist). Also fixed a false-claim risk found
  live: when the SUT doesn't exist yet, Node's test runner collapses ALL tests in a file into
  ONE file-level failure (verified: 6 `test()` calls, missing import → `tests 1, fail 1`, not
  6) — RED's report template now requires stating the static AC-test count and the
  missing-module classification as two separate facts, never "N tests failed".
- **Lint/typecheck gate: 3 mechanical outcomes, no more silent skip.** `SKILL.md` §4.1: (1)
  declared+tool-runs → real gate, exit 0 required; (2) declared but tool missing/fails →
  **BLOCKS**, never N/A; (3) nothing declared, no typed-language marker → N/A, backed by the
  actual detection commands' output. Tested both fixtures for real: no-config repo → N/A with
  evidence; `.eslintrc.json`+`"lint"` script but eslint not installed → `npx eslint .` exit 1 → BLOCK.
- **Receipt lifecycle documented explicitly** (`SKILL.md` §4.5): exact order — `git add -A`
  BEFORE fingerprint, fingerprint computed against the receipt's own future path (self-exclusion
  only, never the whole directory), receipt written, `git add -A` AGAIN to stage the receipt
  itself for commit, then `verify-receipt.mjs check` at 4.6. Also fixed stale doc text that still
  described the superseded `git diff HEAD`-text fingerprint approach (script itself already used
  the correct `--raw -z` model from hardening pass 3 — only the prose was out of date).
- **`research/source-matrix.md`** (new) — versioned, per-source URL/commit/date/method/content/
  applied-ideas/target-file/limitation for all 13 original sources. No source claims "estudiado"
  without a persisted commit hash + real content capture in this file.
- **Video 6ChZMEMJ8hA transcript recovered** (`research/video-6ChZMEMJ8hA.md`, new) — prior
  BLOCKED status was premature: `yt-dlp` (already locally installed, no new install) fetched
  real `es-orig` auto-captions. Content: Gentleman Programming demo of an MCP wrapping
  DataImpulse residential proxies for agent web access. Linked repo
  `Gentleman-Programming/dataimpulse-mcp` found and read (README, commit `6f1d016378`). No VCP
  application (out of domain) — documented for completeness only.
- **Real-vs-simulated agent execution mode made explicit** (`skills/orchestrator-opus.md` §
  MINIMAL AI-COMPANY TASK MODEL) — the AI-company role table was never a claim that each role
  runs as an isolated process. Added: detect `Agent`/`Task` tool availability once per session;
  real dispatch vs. single-session role simulation are different claims and must be reported as
  such, never conflated. "Blocked" is reserved for environments where `Agent`/`Task` are
  genuinely unavailable — "available but not exercised this run" is the honest status otherwise.
- E2E validation (disposable Node project, scratchpad, no commit) re-run against the fixed RED/
  TRIANGULATE split: 6 ACs → 6 tests written in RED (static count verified), TRIANGULATE derived
  exactly 3 new cases (none duplicating AC1-6, verified by grep) — 9/9 green, 0 duplicates.

### Hardening pass 3 (2026-08-13, three blockers fixed on review)
- **RED gate: generic `Error:` no longer counts as evidence.** Hardening pass 2's evidence regex
  still matched bare `Error:`/`error`/`failed` — a stub printing `Error: config missing` and
  exiting 42 passed the gate. Fixed in both `verify-red.sh`/`.ps1`: now requires EITHER (a) a
  framework-executed signal (test count/pass-fail summary) co-occurring with an assertion
  marker, OR (b) a missing-module error attributable to the SUT — a bare generic error string is
  never sufficient alone. Tested for real: fake `Error: config missing`/exit-42 stub rejects,
  `node --this-flag-does-not-exist` (real runner/config error) rejects, real assertion failure
  and real missing-module both still pass — on both bash and PowerShell.
- **Receipt fingerprint: binary-safe, not `git diff` text.** `git diff` prints a fixed "Binary
  files a/x and b/x differ" message for ANY binary change — hashing that text meant two
  different binary modifications produced the identical fingerprint (a receipt from
  modification #1 would incorrectly still validate against modification #2). Rewrote
  `verify-receipt.mjs` to get the CHANGED-PATH LIST from `git diff --name-only HEAD` but hash
  each changed file's actual on-disk BYTES (binary-safe, content-addressed) rather than diff
  text — covers staged and unstaged since both are reflected in the working-tree file. Tested
  for real: committed a binary, modified its bytes, wrote a receipt, modified the bytes AGAIN
  (different content) — `check` correctly rejects; confirmed via `git diff HEAD -- asset.bin`
  that the old approach would have shown identical diff text for both modifications.
- **Receipt exclusion narrowed to the exact receipt path, not the whole `.vibe/receipts/`
  directory.** `currentFingerprint()` now takes an optional `excludePath` (the receipt's own
  path) and excludes only that exact path from tracked/untracked enumeration — any sibling file
  in the same directory (another receipt, a stray file) is a normal entry and DOES invalidate.
  Tested for real: fresh self-consistent receipt passes; adding a stray untracked file inside
  `.vibe/receipts/` rejects; adding a second, unrelated receipt file in the same directory also
  rejects the first one's check.
- `SKILL.md` § 4.5 receipt schema doc updated to describe the byte-safe fingerprint and the
  precise (not directory-wide) exclusion rule; `fingerprint` command usage updated to pass the
  target receipt path.
- All fixes re-tested against the full original case sets (6 receipt cases, 7 RED cases across
  both shells) — zero regressions.

### Hardening pass 2 (2026-08-13, mechanical gates + TRIANGULATE + 4R)
- **Receipt fingerprint now covers untracked files.** `verify-receipt.mjs`'s `tree_fingerprint`
  was `sha256('git diff HEAD')` — blind to untracked files. Rewrote to hash `HEAD` + tracked
  diff (staged+unstaged) + sorted `path\0content-sha256` for every untracked-not-ignored file
  (`.vibe/receipts/` itself excluded — a receipt can't self-invalidate at write time). Add/
  delete/rename/modify of any untracked file now invalidates the receipt. Found and fixed a
  real self-invalidation bug during testing (see readiness report).
  **Superseded by Hardening pass 3 above**: the tracked-diff half of this was still hashing
  `git diff` TEXT, which is not content-addressed for binaries (bug found on review); and the
  untracked exclusion was directory-wide instead of exact-path. Both fixed in pass 3.
- **`escalated` receipts always block, unconditionally.** Removed the `escalated`+`override_note`
  passable branch from `verify-receipt.mjs` entirely — the script now rejects every `escalated`
  receipt, no exceptions. The only path to `approved` is a brand-new receipt written after
  explicit 🔵 user sign-off. `SKILL.md` LAW 8, § 4.5/4.6 wording aligned — no remaining text
  treats `escalated + override_note` as gate-passable.
- **RED gate rejects garbage exit codes.** `verify-red.sh`/`.ps1` no longer treat "any nonzero
  exit" as PASS. Both now mechanically classify output and reject: tests-passed (exit 0),
  broken/missing runner, syntax/parse/collection errors, "no tests found", and nonzero exits
  with no recognizable test-failure evidence (e.g. `exit 42` from a stub). Only a real assertion
  failure or a missing-module/import error attributable to not-yet-implemented code passes.
- **TRIANGULATE inserted between GREEN and REFACTOR.** New role (Triangulator) and skill
  `skills/subagent-triangulate.md`: derives edge/negative/contract/boundary cases from real ACs
  (never decorative), test-files-only, hands failing cases back to Builder and loops. Lifecycle
  is now `pending→red→green→triangulate→refactor→done` everywhere: `SKILL.md`, `orchestrator-opus.md`,
  `caveman-tdd.md`, `spec-plan-templates.md`, `templates/tasks.json`, `templates/plan.md`, `README.md`.
- **4R adversarial rubric replaces generic lenses.** Phase 4.4 now reviews
  Risk/Readability/Reliability/Resilience, each finding carrying lens/evidence/reproduction/
  impact/severity/verdict. Intensity scales with a new 4th risk tier (`critico`, added to 4.2's
  mechanical classification): bajo=1 compact pass, estandar=2 independent passes, alto=4
  independent reviewers (1/lens), critico=4 reviewers + independent reproduction of survivors.
  **Never 0 reviewers** at any tier — the old "bajo skips the adversarial pass" behavior is gone.
- **Replanning escalation gate (4.4.1), not a hard line cap.** A finding-fix crossing >200 lines
  modified / 3+ production-config files / contract-API-dependency-schema expansion beyond task
  scope now pauses (not blocks the fix) for documented scope+cause+risk+rollback and explicit
  🔵 user confirm before continuing.
- **Fixed lingering hard-dependency language** in `orchestrator-opus.md` (`runs under
  /fableultracode contract` was unconditional) — now reads as internal-contract-primary,
  fableultracode-optional-upgrade, consistent with `SKILL.md`.
- Tested (all real, temp/disposable repos, no changes to this repo's git history): receipt gate
  6/6 required cases; RED gate 7/7 cases (green-reject, broken-runner-reject, no-tests-reject,
  syntax-error-reject, arbitrary-exit-reject, assertion-pass, missing-module-pass) on **both**
  bash and PowerShell; `node --check` on all modified `.mjs` files.

### Hardening pass 1 (2026-08-13, controlled-test readiness)
- **Self-contained, no blocking external skills.** `fableultracode` and `cyber-neo` are now optional upgrades, never requirements — `SKILL.md` § INTERNAL ORCHESTRATION CONTRACT (fallback for fableultracode) and `skills/security-baseline.md` (fallback for cyber-neo, 6-category grep/pattern SAST-lite, same severity model). Removed every unconditional "Invoke Skill X" line from `SKILL.md`, `caveman-tdd.md`, `spec-plan-templates.md`. README/INSTALL/SKILL.md now describe the same (optional-upgrade) behavior.
- **Mechanical receipt gate.** Receipt schema gains `git_head` + `tree_fingerprint`. New `scripts/verify-receipt.mjs` (Node, cross-platform) rejects stale/empty-evidence receipts by exit code — Phase 4.6 runs it before commit, not a prose-only gate anymore. (Superseded by Hardening pass 2 above — fingerprint now covers untracked files, escalated always blocks.)
- **Windows/PowerShell parity.** New `scripts/verify-red.ps1`, same exit-code contract as `verify-red.sh` — executed both branches (RED pass, RED fail) for real on PowerShell 5.1, correct results both times.
- **Minimal operable AI-company task model.** `templates/tasks.json` gains `role`, `verifier` (mechanical, never the role being checked), `approval_criteria` (spec AC-id), `evidence` (array, append-only), `handoff` (mechanical next step), `blocked_reason`, `rollback` (per-task `git revert`). Documented in `orchestrator-opus.md` § MINIMAL AI-COMPANY TASK MODEL, incl. explicit "who verifies whom" and a **Roadmap** disclaimer: Paperclip-level runtime (heartbeats, server, live multi-agent budget auto-pause) is NOT implemented — this is the task-model/bookkeeping layer only.
- **Install/memory alignment.** `scripts/vibe-memory.sh` `init`/`read` now include `RETRO.md`/`LESSONS.md`/`COMPANY.md`/`AUDIT.md`; `save lesson` explicitly refused (confirm-gate can't be scripted around) with `save audit` added instead. `install.sh`/`install.ps1` create `.vibe/receipts/`, seed empty `AUDIT.md`, and copy `verify-receipt.mjs`/`verify-red.ps1` alongside the `.sh` scripts. Ran `install.ps1` against a throwaway target dir — real execution, confirmed all files land correctly (see readiness report for the `$HOME` scoping caveat found during this test).
- **Source re-verification** (per non-negotiable traceability rule): re-fetched the-architect, Agent-Reach, agency-agents via `gh api`/`curl` (previous pass returned placeholder junk for 2 of these) — real README content now in the readiness-report source matrix. YouTube video `6ChZMEMJ8hA` attempted twice (WebFetch, two different prompts) — still returns only page chrome, no transcript. Declared **BLOCKED**, not substituted with Paperclip content.

### Added
- **`.vibe/LESSONS.md`** (nuevo, cross-project error memory): schema Reflexion (what/why-root-cause/how-to-avoid/detection-signal/confidence + provenance project/phase/run), confirm-gated (nunca escribe sin 🔵), dedup contra entradas existentes antes de proponer, retire-not-delete (`status: retired`, nunca se borra), decay flag a 90 días sin match (`[stale?]`, nunca auto-borrado). Protocolo completo: `skills/vibe-memory.md` § LESSONS PROTOCOL. `templates/vibe/LESSONS.md` nuevo. Fuente: aprende-skill (Reflexion schema + confirm-gate), engram (dedup/provenance), gstack (decay).
- **Phase 0 step 9 — Auto-routing triage**: cambios ≤3 archivos sin ambigüedad ofrecen 🔵 skip a Direct Build (RED→GREEN→TRIANGULATE→REFACTOR sin Spec/Plan formal, hard-gate de red test intacto); 4+ archivos o ambigüedad → full pipeline sin excepción. Nunca decide en silencio. Fuente: gentle-ai (routing thresholds), gstack (`/autoplan`).
- **Role-persona labels** en subagentes de Phase 3/4 (Test-Engineer/Builder/Refactor-Engineer/Security-Officer/Skeptic) + tabla de permisos por rol en `orchestrator-opus.md` § ROLE / TOOL-PERMISSION TABLE — ninguno certifica su propio gate. Fuente: gstack (org-chart-as-skills), claude-seo-ai (least-privilege table), paperclip (named roles).
- **Subagent Output Schema** estructurado (`STATUS/EVIDENCE/CONFIDENCE/NOTES`) en `orchestrator-opus.md` — `STATUS: pass` sin `EVIDENCE` real se trata como `blocked`, nunca se acepta autoreporte sin prueba. Fuente: cyber-neo, claude-seo-ai (structured finding schema), gentle-ai ("trust what's derived, not narrated").
- **AI Company layer** (paperclip-style, self-contained — sin server/dependencia nueva): `.vibe/COMPANY.md` (nuevo, org chart Board→CEO→roles + budget policy), `.vibe/AUDIT.md` (nuevo, trail append-only role/action/evidence/ref), goal ancestry (`tasks.json` campo `goal`: mission→spec-AC→plan-item, inyectado en cada prompt de subagente), atomic task checkout (`tasks.json` campos `owner`/`locked`, previene doble-trabajo en Build paralelo), budget policy liviana (3 respawns sin gate pasado = hard stop, nunca reintento silencioso). `templates/vibe/COMPANY.md` nuevo. `orchestrator-opus.md` § AI COMPANY LAYER. Fuente: paperclip (org chart, goal ancestry, atomic checkout, budget-as-governance, audit log).
- **Phase 0 step 4 — Engram recall** (opcional, best-effort): si el MCP `mem_*` está presente, recall de contexto antes del resume-check; nunca lo reemplaza. Mirror opcional de gate-state en `MEMORY UPDATES` (`topic_key: vcp/<project>/<feature-slug>/gate-state`).
- **Phase 1 — Forcing Questions**: 6 preguntas obligatorias pre-spec (necesidad/status-quo/slice mínimo/evidencia/non-goal/reversibilidad), escape hatch objetivo y contable, no por "impaciencia". DoD de spec.md ahora exige `6/6` o `skipped(N)`.
- **Phase 4.2 → Risk classification + Simplify**: `risk_level` (bajo/estandar/alto) mecánico por evidencia (`simplify_ignore_touch`, `sensitive_path`, `large_change` — nunca sola —, `debt_reopened`). Fail-safe: repo con `.mq5` y `Risk-sensitive paths` vacío en `PROJECT.md` cuenta como `sensitive_path`.
- **Phase 4.4 modulada por riesgo**: bajo salta el pase adversarial, estándar corre 1 skeptic, alto sin cambios (3-5 skeptics).
- **Phase 4.5 emite receipt** (`.vibe/receipts/<feature-slug>-<fecha>.json`, schema `vcp.receipt/v1`) con `risk_level`, `evidence`, `terminal_state`.
- **LAW 8**: sin receipt `terminal_state: approved` para el HEAD actual, no hay push/merge (4.6). `escalated` requiere `override_note` + timestamp explícito del usuario para pasar a `approved`.
- **Phase 4.8 — Reflect**: 5 líneas a `.vibe/RETRO.md` al final de cada feature, siempre corre, no es gate. Releído en Phase 0 Bootstrap.
- `templates/vibe/RETRO.md` (nuevo) y `.vibe/receipts/` (nueva carpeta en el bootstrap de `.vibe/`).
- `PROJECT.md` template: sección `Risk-sensitive paths` para el clasificador de 4.2.

### Changed
- `PHASE 0` paso 3 ahora también lee `RETRO.md` (últimas 2 entradas) si existe.
- `MEMORY UPDATES`: nuevas filas para el mirror opcional de Engram y para `RETRO.md`.

---

## [1.4.0] — 2026-08-29

Sesión larga de endurecimiento. Lo que cambió, con la evidencia al lado:

- **Gate 24: el sistema de diseño pasa a ser un contrato verificable.** `contracts/design-tokens.json`
  y `verify-design-tokens.mjs`, con nueve reglas mecánicas. El mapa del protocolo adoptó las
  convenciones: 0 tamaños y 0 espaciados fuera de escala, donde antes había 17 y 35 valores sueltos.
- **Discovery deja de creerle a sus propias fuentes.** `sources` las resuelve contra el árbol —un
  expediente con fuentes inventadas salía en verde— y `history` ancla el expediente contra la
  historia de git, que es el ancla externa que le faltaba a la cadena.
- **Tres gates que comparaban un nombre en vez del archivo real**, cerrados.
- **El gate de cobertura era no determinista.** No era el paralelismo: era una rama que el motor
  instrumentaba de forma intermitente y que ninguna prueba ejercitaba.
- **De 34 a 51 límites honestos declarados.** Los 24 gates quedaron cubiertos; once no declaraban
  ninguno, y escribirlos destapó el agujero de las fuentes de Discovery.
- **Los gates sin entradas reales dejaron de estarlo:** `docs/phase-decisions.json` existe con dos
  decisiones atestiguables, y `.vibe/handoffs/` con el primer handoff real.
- **El ejemplo vuelve a estar sincronizado y bajo vigilancia**, con un conflicto de escritura real
  que tenía sin declarar.

**Etiquetas retroactivas.** Hasta hoy el repositorio no tenía ninguna: `v1.0.0`, `v1.1.0`,
`v1.2.0` y `v1.3.0` se crearon sobre los commits que declaran cada versión en su mensaje.
**1.2.0 y 1.3.0 se publicaron sin entrada en este CHANGELOG** y siguen sin ella: la etiqueta las
vuelve localizables, no suple lo que no se escribió en su momento.

---

## [1.1.0] — 2026-07-07

### Changed
- **Orchestration model**: orchestrator now runs under the `fableultracode` skill contract (invoked Phase 0, session-long) instead of a bare Opus persona — autonomy, lead-with-outcome comms, evidence-gated actions, code discipline.
- **Phase count 7→5**: Bootstrap, Spec, Plan, Build, Final. Old TEST/SIMPLIFY/DEPLOY collapsed into one `Phase 4 — Final`, fableultracode-orchestrated.
- **Build model**: Sonnet 5, effort `low` by default (config menu, overridable per-task).
- **Config menus**: new phase-start config menu (model/effort/detail/granularity) added alongside the existing per-decision content menu.
- Rewrote `SKILL.md`, `skills/orchestrator-opus.md`, `skills/spec-plan-templates.md` for the new phase structure; net -227 lines (caveman-compressed, zero information loss).
- `skills/deploy-zip.md` scoped down to an optional Phase 4.7 artifact sub-step (build/zip/checksums/changelog/tag only — verify and commit moved to 4.1/4.6, no longer duplicated).

### Added
- **Phase 4.3 Security**: `cyber-neo` skill invocation — OWASP 2025 Top 10 + CWE Top 25, 11 categories, 5 parallel subagents. Critical/High blocks the phase; Medium/Low logs to `.vibe/DEBT.md`.
- **Phase 4.4 Adversarial review**: 3-5 independent skeptics per finding/file (correctness/security/reproduces lenses), refute-majority kills survivors — fableultracode pattern.
- **Phase 4.6 Commit/push/merge**: commit is automatic (reversible); push/merge always shown as an explicit command with user confirmation, never `--force`, never skip hooks.
- **Phase 4.7 Backups**: Obsidian `07_Backups_Log/` note (if the project has one) + `graphify update .` (if `graphify-out/` exists).
- `model_effort` field on `docs/tasks.json` tasks — carries the Phase 3 config choice per task.

---

## [1.0.0] — 2026-06-19

### Added
- Master skill `VibeCodeProtocols` — Opus orchestrator with full TDD workflow
- 5 Sonnet subagents: RED, GREEN, REFACTOR, DOCS, CHORE
- `.vibe/` memory system — plain Markdown, zero dependencies
- Hard gate: test failure verification before any implementation
- Coverage gate: 90% minimum (lines + branches)
- Stack auto-detection: TypeScript, Python, Go, Rust
- `install.sh` (bash) + `install.ps1` (PowerShell) installers
- `vibe-memory.sh` helper CLI
- `verify-red.sh` standalone RED gate verifier
- `build-zip.sh` distributable package builder
- Templates: spec.md, plan.md, tasks.json, adr.md, .vibe/* 
- Example feature: JWT authentication (spec + plan)
- Bilingüe: Spanish + English in all user-facing content
- Multiple-choice protocol: user confirms every significant decision
