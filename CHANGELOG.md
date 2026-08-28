# Changelog

All notable changes to VibeCodeProtocols are documented here.
Format: [Keep a Changelog](https://keepachangelog.com) — Semantic Versioning.

---

## [Unreleased]

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
