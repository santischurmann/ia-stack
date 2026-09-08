# Session — 2026-09-04

**Feature slug:** lanzamiento-ia-stack
**Goal:** dejar el protocolo instalable y entendible para alguien que no es su autor: cero fallos en
una instalación ajena, cero datos cruzados, README con diagramas, tablero local y bucle de mejora
**Status:** las nueve etapas del plan, cerradas y publicadas

## Dónde quedó todo

Las 38.320 palabras de historia de esta sesión y las anteriores están en
`.vibe/sessions/2026-09-04-lanzamiento-ia-stack.md`. Se archivaron porque el paso 9 del protocolo lo
manda y nunca se había corrido: `.vibe/sessions/` no existía, y Bootstrap leía el archivo entero en
cada arranque.

## Estado verificado al cerrar

- Suite completa en verde, cobertura total de líneas, ramas y funciones en `scripts/`.
- Instalación en un proyecto ajeno desde un clon del estado publicado: cero fallos, y la huella de
  la configuración global del sistema queda idéntica antes y después.
- Cadena de auditoría intacta contra la historia de git, con sus cortes declarados.

## Intentos fallidos

### Ver el HTML que se arma del lado de Node

- intento 1: marcar toda interpolación dentro de un template con marcado HTML → 43 hallazgos, todos falsos positivos
- intento 2: exigir además que los tags estén balanceados → baja a 26, siguen siendo todos falsos
- intento 3: atribuir el escape a la declaración que lo contiene → se apaga con un comentario que diga que falta escapar
- decisión humana: se pidió cerrar esta propuesta. La política de declarar el límite antes que publicar un gate que grita en falso ya está escrita en el repositorio; la elección concreta la tomó el agente bajo esa política, con el dato de cero verdaderos positivos en 210 archivos y 191 commits. Queda a la vista para revisarla.

### Detectar a quién le pregunta una prueba, no sólo qué archivos lee

- intento 1: marcar toda prueba que pasa la raíz a cualquier función → sobre-dispara, es legítimo al leer un archivo copiado
- intento 2: acotarlo a git con una ventana de líneas → junta un `git` y una raíz que no tienen relación
- intento 3: exigir que el literal `git` y la raíz estén en la misma llamada → no sobre-dispara, pero marca 5 archivos que ya tienen guarda y es ciego al caso que motivó la guarda
- decisión humana: misma política y mismo pedido. Se declara el límite en `tests/self-checks.test.mjs`; lo que cubre esa mitad no es una regla sino la medición de punta a punta. La elección la tomó el agente, no se consultó intento por intento.

### Importar prácticas de un compendio de arquitectura externo

- intento 1: leer las 91.093 palabras enteras con 13 agentes y proponer → ~40 propuestas, ninguna sobrevive tres lentes adversariales
- decisión humana: se pidió estudiarlo y ver qué era implementable. La respuesta medida es que nada lo era, y el motivo es de categoría, no de calidad: ese material es arquitectura de runtime y esto es un protocolo de proceso sobre un árbol de git. Lo que sí salió fueron ocho defectos propios, encontrados al auditar el repositorio para poder refutar, y ésos se implementaron.

## Pendientes: cerrados el 2026-09-05

- **`templates/adr.md` dejó de ser huérfano.** Enganchado a la fase 4 (PLAN), y **sólo cuando
  corresponde**: una decisión que ate al proyecto por meses. Un ADR por tarea rutinaria vacía el
  artefacto. Va con gate propio (`verify-adr.mjs`, 44.º) porque engancharlo sin verificación es
  prosa que nadie cumple — el defecto que tenía la plantilla de spec.
- **La etiqueta `v1.4.0` existe y está publicada.** `SKILL.md` vuelve a afirmarla, y ahora una regla
  lo comprueba **contra git**, no contra el texto: si el documento afirma una etiqueta que no existe,
  la suite se pone roja. Antes esa afirmación era falsa y nada la miraba.
- **El README quedó en 210 líneas, no en las 150 del criterio original.** Se comprimió lo que se
  podía sin romper anclas —la nota del renombre y los dos bloques de comandos fundidos en uno— pero
  bajar de ahí exige sacar los diagramas de las once fases, de la memoria y del bucle, que se
  pidieron explícitamente después de fijar ese número, o el diccionario, que el contrato ancla.
  **Se declara, no se esconde:** el criterio quedó superado por un pedido posterior, y cumplirlo
  al pie habría sido cumplir la métrica rompiendo el producto.

## Etapa 1 del endurecimiento — cerrada el 2026-09-08

**Feature slug:** asercion-estado-antes-que-contenido

Primera de cuatro etapas de un plan que sale de aplicar VCP dos días sobre un proyecto real. Antes
de proponer nada se leyó el protocolo entero y **dos de los cinco huecos del pedido resultaron ya
estar cubiertos**: la fase 6.2 es una fase de seguridad con rol propio (`security-officer` en
`contracts/capability-matrix.json`), y el Refutador ya existe con ese nombre en `SKILL.md:957-961`
—sesgado a refutar, ciego a la conclusión del revisor—, sólo que vive en 6.3 y no cubre 6.2.

**Decidido: no se agrega una fase de seguridad.** LAW 7 obliga a un 🔵 por fase y
`verify-phase-decisions --require-complete` exige una decisión por cada fase declarada, así que una
fase nueva le cobraría un menú a cada cambio de tres archivos, en cada corrida, para siempre. Van
tres inserciones en fases existentes, y el puente es que el artefacto de seguridad produzca
criterios de aceptación: de ahí el aparato que ya existe lo arrastra solo.

- **Gate 46, `verify-assert-order.mjs`**: el sexto ítem de «formas de aserción prohibidas», y el
  primero de esa lista con detector. La lista tenía cinco y el propio documento admitía que ninguno
  fallaba mecánicamente.
- **Nace en modo aviso, con criterio de promoción escrito de antemano** (cero falsos positivos
  medidos). El motivo está medido en este repo: cinco detectores de seguridad dieron 43, 26, 6, 5 y
  3 hallazgos, **todos falsos** (`docs/mejoras/2026-09-04.json`).
- **La prueba destapó un defecto real del detector.** La primera versión sólo veía nombres de
  variable en inglés, y el caso real que motivó todo usaba una variable en castellano: no lo
  agarraba. Ahora rastrea la variable que sale de la respuesta.
- **Un octavo lugar de registro que la lista del plan no nombraba**: el fixture sintético de
  `tests/verify-vcp-contract.test.mjs`. Agregar una fila a `REQUIREMENTS` sin tocarlo pone la suite
  en rojo.

**Medido:** suite 1325 pruebas, 1323 en verde, 1 salteada. Cobertura del gate nuevo: 100% de
funciones y ramas con la lógica del propio `verify-vcp-coverage.mjs`. Contrato: 119 promesas, 90
límites honestos. `empty-probe` 46 gates; `vcp-index` 328 archivos; Graphify 324 cubiertos.

## No verificado

- **Estabilidad de `verify-test-bindings.mjs` bajo carga:** no verificado — su prueba de tope de tiempo midió 178 s
  para `verify-receipt-gate.test.mjs` en una corrida de la suite completa a concurrencia 32, contra
  un tope de 120 s, y **pasó en verde corrida aislada**. Mide reloj de pared adentro de una suite que
  compite consigo misma. No se tocó: es un defecto del repositorio, ajeno a esta etapa.

## El único rojo que quedaba: resuelto moviendo, no borrando

`tests/verify-ablation.test.mjs` rechazaba porque `cyber-neo/SKILL.md` había vuelto a
`~/.claude` después de la limpieza del 2026-09-02 que lo archivó. El gate leía el disco y tenía
razón.

**Antes de tocar nada apareció un dato que cambiaba la decisión:** la copia instalada hoy **no era
la misma que se archivó** —los 14 archivos del commit difieren—, así que resolver el rojo no era
restaurar un estado anterior sino sacar de la configuración una versión **más nueva** que la
archivada. Con ese dato a la vista, decisión humana registrada: moverla igual.

Se movió, no se borró: `~/.claude/skills/cyber-neo` (17 archivos) a
`~/.claude-archive/2026-09-08/skills/cyber-neo`, conservando la ruta. La vuelta atrás es un solo
`mv` y quedó impresa.

**El hueco que esto destapó sigue abierto y no se tocó:** `verify-ablation` **no distingue «nunca
se archivó» de «se archivó y después se restauró queriendo»**, así que un registro de limpieza queda
en rojo permanente en cuanto alguien reinstala a propósito algo que archivó. Candidato del bucle de
auto-mejora, no de esta ronda.

## La cobertura global dejó de estar pendiente

En la etapa 1 quedó sin medir porque `verify-vcp-coverage.mjs` corre la suite y aborta con el rojo
preexistente. En la etapa 2 se midió: **46/46 scripts ejecutaron todas sus funciones y todas sus
ramas**, con `listMjsScripts`, `collectScriptCoverage` y `evaluateCoverage` **del propio gate**
sobre una corrida instrumentada de la suite entera — misma lógica, sin el aborto.

## Estado del respaldo al cerrar la 2.0.0

- **Grafo:** reindexado despues del commit y sellado contra el HEAD real, en el orden que manda el
  protocolo (commit, graphify, record, check). Verde.
- **Vault de Obsidian:** regenerado con `graphify export obsidian` sobre el grafo del commit,
  3448 notas y su `graph.canvas` al dia. El gate que lo mira comprueba destino y forma, nunca
  frescura: que salga verde no dice que refleje el arbol de hoy, y por eso la fecha del canvas es
  lo que hay que mirar.
## Etapa 2 del endurecimiento — cerrada el 2026-09-08

**Feature slug:** receipt-v3-limite-regresion-soporte

Un solo bump de schema, y el corte no fue arbitrario: tres de los cinco cambios del plan agregaban
campos **requeridos** al receipt, y hacerlos por separado obligaba a tres bumps en fila.

- **`limits[]` vs `regressions[]`**, con el campo **`before`** como discriminador **mecánico, no de
  criterio**. El caso que motivó la regla —permiso correcto, un rol pierde una pantalla, docstring
  con archivo, rango y permiso— cae en `regressions` por forma. Escribirlo bien dejó de alcanzar.
- **`accepted_by_user` resuelve afuera del receipt**: `user_decision_ref` contra el `current_hash`
  de una decisión `decided`. Mismo modelo que LAW 8 usa para `escalated`.
- **LAW 6 gana `soporte declarado`**, y `prd.observability` dejó de ser una frase suelta. Rechaza
  «ninguno» pelado **en los dos idiomas**: el gate del handoff sólo conoce los rellenos en inglés y
  tiene ese hueco declarado; repetirlo acá habría dejado la puerta abierta justo para quien escribe
  estos campos en castellano.
- **El Refutador cubre 6.2 y su piso subió a `estandar`**, donde antes era el propio revisor vía su
  campo `verdict` — auto-certificación, contra la regla de que quien encuentra nunca parchea.
- **Los 15 receipts v2 pasan a archivo**, por el camino que ya tenían los v1.
- **Colateral:** el DoD de `orchestrator-opus.md` numeraba `4.1`..`4.8` lo que son las fases 6, 7 y
  8 — un quinto vocabulario de fases, en el único checklist que el orquestador lee para cerrar.

**Medido:** suite 1361 pruebas, 1359 en verde, 1 salteada. **Cobertura 46/46 scripts al 100% de
funciones y ramas.** Contrato 124 promesas, 92 límites honestos. `empty-probe` 45 gates corridos;
`vcp-index` 329 archivos; Graphify 325 cubiertos.

**Un noveno lugar de registro que ninguna lista nombraba:** el manifiesto de Graphify. Es artefacto
local e ignorado por git, pero su gate está en la suite, así que agregar un archivo rastreado la
pone en rojo hasta correr `graphify update .`. Pasó en las dos etapas.

## Etapas 3 y 4 del endurecimiento — cerradas el 2026-09-08, versión 2.0.0

**Feature slug:** superficie-de-ataque-y-despliegue

**Etapa 3 — la superficie de ataque se declara antes de construir.** `threat.json`, séptimo
artefacto de Discovery, obligatorio para todo proyecto (decisión del usuario, tomada con la contra a
la vista). Los campos son el **complemento exacto** de lo que `security-baseline.md` declara
textualmente no cubrir, así que la lista es defendible y no una elección de gusto.
`verify-threat-model.mjs` cruza cada control contra un criterio de la spec y, con `--receipt`, exige
que esté `COMPLIANT`.

**Etapa 4 — la fase 8 comprueba que la cosa arranque.** `verify-deploy.mjs` más 8.0, 8.0.1 y 8.0.2.
El host se resuelve **antes** de abrir la conexión: «nunca internet» dejó de ser una promesa en un
comentario y pasó a ser un rechazo.

**Versión 2.0.0**, mayor por ruptura de contrato hacia afuera: un receipt del schema anterior ya no
aprueba un commit, LAW 6 gana un término obligatorio, `threat.json` pasa a obligatorio y
`prd.observability` cambia de forma.

**Una rama se sacó en vez de fingirle cobertura:** `probeService` repetía el chequeo de loopback que
`validateDeploy` ya hace antes en todos los caminos. Era inalcanzable, y una rama inalcanzable es
justo lo que el gate de cobertura de este repositorio no deja pasar.

## Ronda adversarial sobre los límites declarados — 2026-09-08

**Feature slug:** cerrar-limites-declarados

Se atacaron siete límites con 22 agentes: proponer un detector, y dos escépticos por propuesta
sesgados a refutar. **Las siete cayeron 2-0.** Los siete límites se quedan, y ahora están guardados
como dato en `contracts/honest-limits.json` en vez de vivir sueltos en la cabecera de un script.

**El valor estuvo en lo que las refutaciones destaparon**, no en las propuestas: cuatro defectos
reales en gates ya publicados, uno de ellos un **falso positivo bloqueante** —el escáner de vínculos
ciego a los literales de regex, con doce declaraciones reales invisibles—.

Dos huecos se cerraron contra el árbol (sondas de ablación, inversión del manifest) y el
distribuible se destrabó declarando un segundo archivador.

**Medido:** 1480 pruebas, 1479 verdes, 1 salteada, cero fallos. Cobertura 48/48 al 100% de funciones
y ramas. 131 promesas de contrato, 105 límites honestos. Seguridad limpia.

**Dos veces la prueba encontró el defecto antes que yo**, y las dos merecen quedar escritas: el
detector del 404 no veía variables en castellano, y el descarte de renombrado de la sonda de
historia estaba mal porque con `pathspec` git muestra un `git mv` como borrado.
