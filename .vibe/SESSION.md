# Session — 2026-08-27

**Feature slug:** integridad-verificable
**Goal:** convertir en detector mecánico cuatro reglas que hoy son convención sin gate
(#22 commit atómico, #27 audit hash-chain, #47 baseline de findings, #40 wording crítico)
**Status:** in progress

---

## Phase 0 — Bootstrap

- Stack detectado: Node v24.13.1 nativo, sin manifiesto de paquetes (cero dependencias por diseño);
  `node --test` + `--experimental-test-coverage`; Bash/PowerShell sólo en instaladores. 🔵 aprobado.
- Memoria: proyecto nuevo — no existía `.vibe/`, creada desde `templates/vibe/`.
- Engram: `mem_context`/`mem_search` no están en el toolset de esta sesión. No hay recall previo;
  el estado se re-detecta por evidencia, nunca de memoria.
- Resume: sin estado previo (no había `SESSION.md` ni `tasks.json`), sesión limpia desde Spec.
- Nivel del proyecto: **C — Producto con plata** (🔵 usuario). Guardado en `PROJECT.md`.
- Triage: 4 features, muy por encima del umbral de 3 archivos de contexto → **full pipeline** (🔵 usuario).
- Contexto requerido enumerado para el triage: `scripts/verify-receipt.mjs`,
  `scripts/verify-security-baseline.mjs`, `scripts/verify-vcp-contract.mjs`, `.vibe/AUDIT.md`,
  `SKILL.md`, `README.md`, `SECURITY.md` + sus tests espejo. 7+ archivos, sin ambigüedad de
  requirements pero con artefacto durable pedido → full pipeline sin excepción.

## Phase 0.5 — Discovery

- Run `run-001`: d001 (pending/initial) → d002 (completed/activation), packet con 4 claims
  `SUPPORTED`, cada uno con locator `repo_file` y `content_identity` sha256 real.
- 4 triggers observados, cada uno cubierto por al menos un claim.
- CAIO: proceso roto y pérdida de información **observados** con evidencia; retrabajo queda como
  **hipótesis** (no se recolectó evidencia); bucle abierto observado en `verify-receipt.mjs:421`.
- Gates: `verify-discovery-core` exit 0 · `verify-discovery-views render+check` exit 0.
- No-goal declarado: la ventana TOCTOU se angosta, no se cierra. El hash-chain detecta reescritura
  accidental o protocolar, no a un actor con control del filesystem.

## Phase 0.5 — corrección (elección 🔵 "C y después A")

- **REQ-G13** (RED→GREEN): `locator.repo_file` acepta `line` como entero positivo opcional.
  Rechaza 0, negativos, decimales, strings numéricos y null; `line` sigue prohibido en un locator
  `web`. Alta `planned` y activación en commits separados, como exige el guard.
- **Corrección d003**: el run-001 pasa a 3 decisiones (d001 pending → d002 completed → d003
  correction). Los 4 claims conservan su `claim_id` (REQ-G06) y ganan `path` + `line` separados,
  con `content_identity` recapturado porque dos fuentes cambiaron desde d002.
- **Hallazgo nuevo del dogfooding**: `.vibe/vcp-runtime/` quedó desincronizado del repo fuente y
  ningún gate lo detecta. El gate de Discovery falló con `DISCOVERY_SNAPSHOT_INVALID` usando el
  runtime viejo y pasó con `scripts/` — un proyecto consumidor podría estar corriendo gates de una
  versión anterior sin enterarse. Candidato a tarea propia, no incluido en este alcance.

## Phase 1 — Spec

- Forcing Questions: **6/6** respondidas (FQ3 requirió una repregunta: la primera respuesta fue
  "no entiendo", se reformuló sin jerga y quedó resuelta como slice mínimo = T01 primero).
- `docs/spec.md`: 10 ACs sobre 4 tareas, T01 (hash-chain de AUDIT.md) declarado slice mínimo.
- Gate de word cap: **rechazó dos veces** (689 y 661 palabras) antes de pasar en 645/650. Se
  recortó narración, ningún criterio de aceptación. El gate funcionó como se diseñó.
- 0 marcadores `[NEEDS CLARIFICATION:` — no bloquea el paso a Plan.
- Non-goals declarados: nada criptográfico ni antimalicioso; la ventana TOCTOU se angosta, no se
  cierra; el hash-chain no resiste a quien controle el filesystem.

## Phase 2 — Plan

- `docs/plan.md` + `docs/tasks.json`: 4 tareas atómicas, cadena estricta T01→T02→T03→T04.
- Gate `verify-plan-conflicts`: **exit 0** — 14 writer paths declarados, 30 solapamientos, todos
  con ruta `depends_on`; ningún conflicto sin secuenciar.
- T01 marcado como slice mínimo: se valida solo antes de construir las otras tres.
- Riesgo declarado en el plan: el `AUDIT.md` de esta sesión ya tiene líneas sin hash, así que AC4
  (compatibilidad hacia atrás) no es teórico — es el estado real del archivo que hay que aceptar.

## Phase 3 — T01 (hash-chain de AUDIT.md) · DONE

- **RED**: rechazado en el primer intento. El gate exige un fallo de assertion real y el módulo no
  existía. Se resolvió con un esqueleto de valores centinela — no con funciones que lanzan, porque
  las pruebas llaman las funciones directo y un throw aborta antes del assert.
- **GREEN**: 9/9, cobertura 100%.
- **TRIANGULATE**: 14 pruebas. Reprodujo un ataque real — manglar todos los sufijos `chain:`
  degradaba el archivo a "traza heredada" y una línea con contenido falsificado pasaba con exit 0.
  Cerrado: un sufijo mal formado es manipulación, no una línea vieja.
- **Escritor (AC11)**: subcomando `append` en el mismo módulo, para que escritor y verificador
  compartan la función de sellado y no puedan divergir. 19 pruebas, 6 mutantes muertos.
- **Verificado sobre datos reales**: se falsificó una línea del `AUDIT.md` de esta misma sesión y
  el gate la detectó nombrando la línea 22.
- Gates finales: 325 tests · cobertura 100% · seguridad limpia · contrato 42 checks · scope-diff
  8 paths exactos · cadena de auditoría íntegra.
- Límites declarados y NO resueltos: borrar los sufijos enteros, recortar el final de la traza, o
  recalcular la cadena completa. Los tres exigen un ancla fuera del archivo.

## Phase 3 — T02 (baseline de findings de seguridad) · DONE

- **RED**: 12 pruebas nuevas. Bloqueado al inicio por el hallazgo 51: `verify-red-node` confunde
  ciertas frases en el *título* de una prueba con un archivo roto. Se destrabó renombrando una
  prueba existente (`collection errors` → `collection failures`), sin tocar ninguna comprobación.
- **GREEN**: 33/33. El Builder corrigió el briefing en vez de esconderlo: el chequeo de
  consistencia del `finding_id` que le ofrecí como opcional estaba prohibido por un fixture.
- **TRIANGULATE**: 42 pruebas. Cinco agujeros encontrados, reproducidos con el CLI real y cerrados.
  El peor (A1) es el gemelo del de T01: una entrada con el `finding_id` de un CRITICAL vivo pero
  descrita como otra cosa en otro archivo lo tapaba **y no caducaba nunca**. Cerrado exigiendo que
  el id sea el hash de sus propios campos.
- **Verificado contra un repo Git real**, 5 conductas + el ataque A1 reproducido antes y después.
- `contracts/security-baseline.json` NO se crea: VCP no tiene deuda aceptada. El baseline es por
  proyecto y opcional. `files_to_create` de T02 vaciado en consecuencia.
- El gate de alcance detectó un error mío en el plan: había declarado el mismo archivo en
  `files_to_modify` y en `test_files`.
- Gates finales: 346 tests · cobertura 100% · seguridad limpia · contrato 44 checks · scope 7 paths.
- Límites declarados: aceptar un secreto cubre archivo+categoría, no un valor; una entrada fuera
  del delta no caduca; `check` sin `--base` compara HEAD con HEAD y no ve lo ya commiteado.

## Phase 3 — T03 (validar y escribir en una corrida) · DONE

- **RED**: 9 pruebas nuevas. Seis verifican que **no** se commiteó mirando el `git log`, no sólo el
  código de salida: un exit 1 que igual commiteara sería el peor resultado y ninguna prueba que
  mire sólo el exit lo detectaría.
- **GREEN**: 42/42 a la primera pasada, cobertura 100%.
- La confirmación posterior compara el `write-tree` del índice validado contra `HEAD^{tree}` del
  commit resultante. Ese mismo valor detecta además el caso "nada staged".
- Dos no-comportamientos deliberados, ambos con prueba: nunca reescribe historial por su cuenta
  (si la confirmación falla, deja el commit e imprime el comando para deshacerlo), y nunca pasa
  `--no-verify`.
- El gate de alcance detectó el mismo error mío que en T02: archivo declarado dos veces. Corregido
  en T03 y T04 de una vez.
- Gates finales: 355 tests · cobertura 100% · seguridad limpia · contrato 46 checks · scope 7 paths.
- **Deuda anotada**: `commit` usa exit 2 para uso inválido y `check` usa exit 1 para lo mismo. No
  se alineó para no romper las 33 pruebas de `check`.
- **Límite declarado**: la ventana pasa de minutos a milisegundos, no desaparece. La confirmación
  prueba que el commit contiene el índice revisado, no que no hubo escritura concurrente.

## Phase 3 — T04 (límites honestos como dato revisable) · DONE

- **RED**: 10 pruebas nuevas. El Test-Engineer relevó el repo y encontró que **dos de los seis
  límites que ya existían fijaban títulos de sección, no afirmaciones**: se podía dejar el título
  y vaciar el párrafo sin que nada fallara. Es exactamente el agujero que T04 vino a tapar.
- **GREEN**: 18/18. 16 límites declarados en SECURITY.md, README.md, SKILL.md y vibe-memory.md,
  cada uno con el `why` de qué garantía se pierde si desaparece.
- **Verificado debilitando una frase real**: cambié "un receipt es evidencia local, no una firma de
  procedencia" por "evidencia sólida de procedencia" en README.md y el gate frenó imprimiendo el
  motivo completo, no sólo el nombre del test. Archivo restaurado byte a byte después.
- Gates finales: 365 tests · cobertura 100% · contrato 48 checks + 16 límites · scope 6 paths.
- Límites del propio gate: verifica que la frase esté, no que el párrafo que la rodea siga siendo
  cierto; y un límite que nadie declaró tampoco se protege.

## Hallazgos abiertos del backlog · CERRADOS

### T05 — hallazgo 51: el título de una prueba la incapacitaba

- La búsqueda de frases de parseo corría sobre la salida cruda, donde también salen los títulos.
  Dos archivos idénticos salvo el nombre daban veredictos opuestos.
- Arreglo sin agregar un solo regex: se apoya en una diferencia **medida**, no supuesta — un
  archivo que no parsea nunca ejecuta un assert, así que no puede producir un bloque de assertion.
  La búsqueda de frases pasó de ser un chequeo bloqueante a elegir la redacción del rechazo.
- El agente encontró que **un fixture existente codificaba el bug**: contenía una combinación que
  Node no puede emitir. Reemplazado por salida real capturada.
- Se revirtió el rename que el defecto había forzado: la suite queda como evidencia viva.
- **Residuo del hallazgo 50 corregido de paso**: `skills/subagent-red.md` seguía afirmando que un
  error de módulo faltante es un RED válido. La corrección de `1f847f3` nunca se propagó ahí.

### T06 — hallazgo 53: el runtime instalado se desincronizaba en silencio

- Confirmado en vivo: 11 archivos viejos y **5 ausentes**. No faltaban parches, faltaban features
  enteras — `verify-audit-chain.mjs` y `contracts/honest-limits.json` nunca llegaron al runtime.
- El gate se cablea en Phase 0, antes de cualquier otro: si la copia está vieja, todo gate
  posterior es evidencia sin valor.
- **No puede correrse desde el runtime**: compararía la copia consigo misma, verde siempre. Esa
  promesa quedó fijada en el contrato para que una edición futura no la borre.
- La lista de qué comparar no está hardcodeada: la prueba parsea los dos instaladores y se pone
  roja si empiezan a copiar algo que la lista no nombra.
- Runtime reinstalado y verificado: 98 archivos al día.
- Límite declarado: compara contenido, no permisos. El `chmod +x` del instalador no se verifica.

## T07/T08 — políticas del backlog

- **T07** (items 36/37/44/45/46): cuatro reglas de trabajo escritas en SKILL.md y fijadas en el
  contrato; dos con su motivo en los límites honestos. El gate de límites me frenó **dos veces**
  porque las frases cruzaban salto de línea — la misma trampa que el Test-Engineer había advertido
  en T04. Reformateado para que cada frase entre completa en un renglón.
- **T08** (items 41/33): `verify-evidence-trace.mjs` con dos comandos. `criteria` verifica que cada
  criterio de la spec sea nombrado por al menos una prueba; `claims` verifica que un claim del
  Discovery que cita un criterio apunte a uno que existe.
- **Hallazgo real**: `criteria` salió en rojo contra el repo, con AC8, AC9 y AC12 sin prueba que los
  nombrara. AC12 estaba probado por dos pruebas de `verify-audit-chain` pero ninguna lo mencionaba:
  nada ataba el criterio a su evidencia. Se anotaron los títulos existentes — **no** se escribieron
  pruebas nuevas para tapar el hueco.
- El agente falsificó `claims` contra una **copia** del Discovery real (verde con 0 vínculos no
  prueba nada): parcheó un claim para citar `AC99` inexistente y el gate lo bloqueó nombrándolo.
- La convención de mención se **reusó** de `verify-test-bindings.mjs`, importando su función en vez
  de reimplementarla — es la regla #46 aplicada al propio trabajo.

## T09 — estado ante interrupción · DONE

- `verify-session-state.mjs`: verifica que `SESSION.md` sea retomable. Tres reglas — máximo 3
  intentos fallidos sin decisión humana, una interrupción debe declarar dónde quedó, y una
  verificación que no se pudo hacer se marca como tal en vez de leerse como éxito.
- Falsificado sobre una **copia** del `SESSION.md` real: los 5 escenarios se detectan.
- **Error mío que el agente encontró**: mis ediciones al backlog con expresiones regulares
  reemplazaban la primera aparición de "SIGUIENTE" en el archivo en vez de la fila objetivo. Tres
  commits míos corrieron la columna de estado: descripciones de un item aparecían en la fila de
  otro. Corregido, ninguna descripción se perdió. **Ningún gate lo detectaba**: el contrato
  verifica frases en documentos vivos, no la coherencia interna de una tabla de backlog.
- Backlog: **0 items abiertos**. 8 implementados en T07-T09, 3 cerrados con motivo.

## Sesión nocturna 2026-08-28 — configuración decidida

| Decisión | Elegido |
|---|---|
| Fase -1 | **C** — investigar el orden correcto antes de reparar |
| Hallazgo 55 | **B** — sello de contenido propio ligado al HEAD, probado con fixtures |
| Alcance | arreglos concretos primero, research después |
| Autonomía | avanzar con la recomendación, dejando constancia de que fue automática |
| Publicación | commit por lote, **sin push** |
| Research | manifest completo + lectura del núcleo; cobertura declarada PARCIAL con números |
| Si algo falla | revertir ese lote, registrar la reproducción, seguir con el siguiente |
| Artifact | sí, al final |

**Corrección al diagnóstico previo del hallazgo 55**, con evidencia: el reporte **sí** se regeneró
(02:16:32, contiene los gates nuevos); lo que no se actualiza es la línea `Built from commit`. Y los
tres hashes del backup tampoco coinciden — el backup es de las 01:54, anterior al reporte. La causa
raíz es que Graphify sella el HEAD del momento de ejecución, no el contenido que produce.

## T10 — hallazgo 55 · DONE

- **Causa raíz**: Graphify sella el HEAD del momento de ejecución, y sólo regenera el reporte ante
  cambios de topología. Un commit de sólo documentación deja el sello atrasado para siempre.
- **Arreglo**: el sello lo registra el protocolo (`git rev-parse HEAD` al momento de `record`), no
  una línea que escribe una herramienta externa. El gate pasó de rojo permanente a verde.
- **Fortalecimiento no pedido**: el gate aceptaba un prefijo corto del HEAD (`head.startsWith`).
  Un sello de 7 caracteres pasaba. Ahora exige igualdad exacta.
- **Bug preexistente que destruía datos**: `record --manifest <archivo>` sobrescribía **cualquier**
  archivo regular del proyecto y devolvía `OK` con exit 0. Cinco combinaciones, no dos. Ahora sólo
  se sobrescribe un receipt que escribió esta misma herramienta; todo lo demás se rechaza antes de
  escribir un byte, con rutas comparadas por `realpath` (un `./g/graph.json` no esquiva la regla).
- **Verificado comparando el sha256 del archivo antes y después**, no el exit code: un rechazo que
  igual destruye el archivo pasaría cualquier prueba que sólo mire el código de salida.
- **Garantía cambiada, declarada**: el sello ya no prueba que el grafo fue *construido* en ese
  commit, sólo que su contenido no cambió desde el registro. La otra mitad —que el grafo cubra los
  archivos del commit— la verifica `verify-graphify-manifest`.

## T11 — gate de decisiones por fase · DONE

- `verify-phase-decisions.mjs`: una decisión por fase, en orden, con la opción elegida dentro del
  menú que se mostró, y encadenada por hash. Reusa `chainHashFor` de `verify-audit-chain.mjs`
  importándola, no reimplementándola.
- **Nueve campos entran al hash**, incluidos `options` y `selected_option`: sin ellos, agregar la
  opción elegida al menú *después* de elegir pasaba en verde. El agente lo reprodujo.
- 24 ataques probados contra el propio gate. **Uno funcionaba**: dos opciones que sólo diferían en
  espacios (`'A) una spec'` y `'A) una spec '`) contaban como menú de dos siendo una sola para quien
  lee. Cerrado midiendo la unicidad sobre el texto recortado.
- El agente descubrió que dos de sus primeros ataques eran vacíos porque la plantilla no tenía
  ninguna decisión donde la persona fuera contra la recomendación. Cambió la plantilla para que los
  ataques midieran algo real.
- **Límite de fondo, declarado textual**: demuestra que una decisión quedó registrada de forma
  coherente; **no** demuestra que la persona haya querido esa opción ni que haya comprendido sus
  consecuencias. Una decisión inventada de punta a punta pasa el gate.

## Research — falló por un bug mío, los datos se salvaron

- El workflow pedía a cada agente un `slug`; los agentes devolvieron `owner/repo` (por ejemplo
  `Panniantong/agent-reach`) y mi `FUENTES.find()` no matcheó. Las 14 lecturas de núcleo fallaron.
- **Los 14 manifests están completos**: 15.581 archivos con SHA exacto y clasificados en cinco
  baldes. Recuperados del journal del workflow.
- El sintetizador recibió una lista vacía y **se negó a escribir un informe**, diciendo que
  cualquier patrón que escribiera sería inventado. Es el comportamiento correcto y vale registrarlo.
- **Meta-hueco que señaló**: el pipeline de investigación no tiene gate propio. Un sintetizador que
  recibe cero insumos puede devolver algo con forma de conclusión. Debería fallar duro en vez de
  depender de que el modelo elija ser honesto.


## Research — relanzado y completo (PARCIAL por diseño)

- Corregido el bug del slug. 14/14 fuentes leídas, 320 archivos de 15.581 (**2,05 %**).
  Archivado en `research/external-sources-2026-08-28.md`, cada fuente declarada PARCIAL con su
  número exacto de pendientes. 168 patrones → 24 mecanismos reales.
- Se le agregó gate propio al pipeline: sin patrones de entrada, no sintetiza.
- **Convergencia independiente**: el patrón #1 del corpus ("fallo por conjunto vacío", 8 fuentes)
  es el mismo hueco que esta sesión cerró por su cuenta antes de leer el informe.

## Verde vacío (T12) y sonda (T13)

- Nueve caminos en cinco gates decían `OK:` sin haber comparado nada. Seis salieron de leer el
  código, el séptimo de correr la batería completa (lo había abierto T11 horas antes), y los dos
  últimos de una sonda que ejecuta. **El grave**: `verify-audit-chain.mjs check` sobre un
  `.vibe/AUDIT.md` borrado entero decía "cadena íntegra".
- `verify-empty-probe.mjs`: corre cada gate en una carpeta vacía contra `contracts/empty-probe.json`.
  Un `verify-*.mjs` sin declarar es rechazo. `self` y `skip` exigen motivo escrito y se cuentan.

## Fase 7 — inventario histórico

- 46 commits, 259 símbolos vistos alguna vez, 254 vivos, 5 desaparecidos, **0 regresiones**.
  Cuatro son renombres a versiones más estrictas; uno es un borrado documentado (hallazgo 55).
- Decidido **no** convertirlo en gate: habría gritado en cuatro refactors correctos y callado en
  cero problemas reales. Queda como auditoría en `research/historical-inventory-2026-08-28.md`.

## Fase 14 — instalación limpia (hallazgo 58)

- Primera instalación de VCP en carpeta limpia. El instalador **no escribía**
  `.vibe/vcp-runtime/` en el `.gitignore` del proyecto, así que los 114 archivos del runtime
  quedaban como superficie viva. Reproducido: un secreto plantado dentro del runtime bloqueaba el
  gate de seguridad del usuario con un CRITICAL que no escribió.
- Arreglado en los dos instaladores, idempotente. Superficie: 124 archivos → 11, 0 del runtime.

## Verificado desde afuera

- `install.ps1` corrido en PowerShell real sobre una carpeta limpia: `.gitignore` respetando lo
  previo, 0 archivos del runtime en la superficie, idempotente en tres corridas.
- Las citas `archivo:línea` del research, **revalidadas el 2026-08-30** reclonando las catorce
  fuentes a su commit pineado y materializando los 15581 archivos: 142 de 145 resuelven a un
  archivo y una línea que existen, 3 son defectos de formato del propio informe, 0 rotas. El
  registro queda en `contracts/research-citations.json` y `verify-research-citations.mjs` lo
  compara contra el informe, así que agregar una cita sin revalidarla rechaza.
- `tests/protocolo-e2e.test.mjs`: instala VCP en un proyecto nuevo y corre los gates en orden.
  Comprueba que ninguno escribe `OK:` sobre un proyecto donde no hay nada, y que recortar la traza
  pasa `check` y cae en `history`. Lo que **no** cubre está escrito en la cabecera del archivo.

## No verificado

- Comportamiento de `verify-vcp-coverage.mjs` sin entradas: **no verificado**, excluido de la
  sonda por costo (correrlo ejecuta la suite entera).
- Subcomandos distintos al declarado en `contracts/empty-probe.json`: **no verificado**, la sonda
  prueba una invocación por gate.
- El contenido de las 138 citas que no se leyeron a mano: **no verificado**. Están comprobadas
  en su existencia —el archivo y la línea están en el commit pineado—, no en que la línea
  sostenga lo que el informe afirma sobre ella. Cuatro sí se leyeron y confirmaron.
- La cobertura de lectura del research: **no verificado** más allá del 2,05 % original. El
  barrido mecánico tocó el 100 % de los 14421 archivos legibles, pero barrer con seis
  expresiones regulares no es leer: un cero dice que el patrón no encontró nada, no que no esté.
- Que las seis sondas del barrido alcancen: **no verificado**. Las elegí mirando las
  conclusiones que quería poner a prueba, así que una séptima que a nadie se le ocurrió puede
  estar tapando algo, y el barrido no puede decir que no.
- Las secciones 2, 3 y 4 del informe: **no verificado**. Los 24 mecanismos, los rechazos y las
  convergencias positivas siguen sin releerse buscando conclusiones falsas por el mismo motivo
  que la de la sección 5; las dos correcciones cubren esa sección y las citas, nada más.

## Sesión 2026-09-01 — mejora integral (Fase 0 + A1 + A2)

**Feature slug:** mejora-integral-vcp

- **Fase 0 (preflight, read-only) · DONE.** HEAD == origin/main == `af55a45`, árbol limpio, 20
  gates verdes. 10 hallazgos escritos en el plan aprobado. Decisión 🔵 del usuario: **opción B**,
  corregir F1 (flakiness) antes que nada; worktree residual: **inspeccionar y reportar**.
- **F1 medido, no supuesto.** 5 corridas de `node --test --test-concurrency=32`: 2 rojas, ambas en
  `tests/verify-evidence-runner.test.mjs`. Causa: presupuesto de 1000ms para un spawn real. Sonda
  propia, 30 muestras: sin carga max 103.7ms; con 32 procesos p90 2631.5ms, max 4895.4ms, 13 % por
  encima de 1000ms. El presupuesto caía dentro de la banda de ruido.
- **A1 RED · DONE.** `tests/spawn-budget.test.mjs` acusó los dos archivos por nombre y línea
  (`verify-evidence-runner.test.mjs:17`, `protocolo-e2e.test.mjs:106`). Antes de eso el escáner
  daba verde vacío por un `\s` degradado en un template literal; lo delataron sus propias pruebas
  de FALSIFICACIÓN, y se arregló con `String.raw`.
- **A1 BUILD · DONE.** Los dos archivos importan `REAL_SPAWN_TIMEOUT_MS = 30_000` de
  `tests/spawn-budget.mjs` (mismo valor que ya usaba `verify-discovery-requirements.mjs:350`).
- **A2 preservación · DONE.** El worktree `.claude/worktrees/admiring-noether-c5b71e` sigue
  intacto. Copia en `_backups/2026-09-01_worktree-cobertura-determinista_2280b8e/` con manifiesto
  sha256; los hashes de tres archivos coinciden con los `test_hash_sha256` que certifica el receipt
  aprobado `cobertura-determinista-2026-08-29.json`, que **no existe en main**.
- **F11 encontrado al pisarlo.** `node --test` descubre `**/*.test.mjs` bajo el cwd y no respeta
  `.gitignore`. Cinco archivos de prueba dentro de `_backups/` entraron a la suite publicada: 802
  tests y 4 fallas donde correspondían 777 y 0. Los directorios ocultos (`.vibe/`, `.claude/`) sí
  se saltean; `_backups/` no es oculto, y la regla del proyecto manda guardar backups de código
  justamente ahí. Mitigado en este backup empaquetándolo; **el defecto del protocolo sigue abierto**.

## No verificado (sesión 2026-09-01)

- Que los 7 huecos de cobertura que encontró el worktree sigan abiertos en main: **no verificado**.
  Los cuatro archivos de prueba del worktree difieren de los de main y son más grandes, y
  `innermostCount` nunca existió en la historia de main — eso es indicio, no medición.
- Que 10 corridas verdes demuestren determinismo: **no**. Son la ausencia de contraejemplo en diez
  intentos. Lo estructural es que el presupuesto supera 6x la latencia peor medida.
- Instalación limpia: **no verificado** en esta sesión.

## Sesión 2026-09-01 — A1 cerrado, A2 medido

- **A1 · DONE.** 10/10 corridas de `node --test --test-concurrency=32` en verde, 777/777 cada una.
  Guardia `tests/spawn-budget.test.mjs` barre los 63 archivos de `tests/` descubiertos al momento
  (no una lista fija) y acusa las regresiones reintroducidas, incluida una en un archivo que una
  lista fija no habría mirado.
- **A2 · medido, sin decidir.** El método huérfano (suma por proceso) corrido contra un clon limpio
  de `af55a45`, sin modificar el clon: **7 huecos**. Seis eran de la lista de 2026-08-29 menos
  `verify-audit-chain.mjs:206` (que main sí cerró), más uno nuevo:
  `verify-spec-wordcap.mjs:99`. El gate de main sobre el mismo árbol dice 30/30 a 100 %.
- **F13.** Un clon limpio de main publicado **no está verde en Windows**: `git ls-files` da 229
  archivos, 215 llegan CRLF (sólo `*.sh` está pineado a LF). `docs/discovery/**/*.json` entra en
  una cadena de hashes y `views/*.md` se exige en LF, así que `verify-discovery-core` y
  `verify-discovery-views` salen `DISCOVERY_PREDECESSOR_HASH_MISMATCH: d002` y
  `DISCOVERY_VIEW_FORMAT_INVALID`, y 2 pruebas de `verify-discovery-sources.test.mjs` fallan.
  Verificado byte a byte: `d002.json` es `{\n…` sha256 `a3260e9f…` en el árbol de trabajo y
  `{\r\n…` sha256 `ef3d2077…` en el clon, mismo commit. Normalizando a LF en el clon: los dos
  gates salen 0 y las 16 pruebas del archivo pasan. **No se tocó el repo por esto.**

## No verificado (A2)

- Que los 5 huecos heredados sigan siendo los mismos defectos y no otros con la misma línea:
  **no verificado**; se comparó archivo y línea, no el camino de ejecución.
- Que `verify-graphify-manifest.mjs:124` y `:141` sean huecos reales y no artefacto del clon:
  **son artefacto explicable**. Su única cobertura viene de una prueba que se saltea sin
  `graphify-out/manifest.json`, que está en `.gitignore`. En un clon nunca corren; en la máquina
  del autor sí. Eso es exactamente el AC4 del receipt huérfano, que main no incorporó.
- Que el arreglo de `.gitattributes` no rompa otra cosa: **no verificado**. Se probó normalizando
  a mano dentro del clon, no cambiando el archivo de atributos ni rehaciendo el checkout.

## Sesión 2026-09-01 — F13 cerrado

- **F13 · DONE.** Decisión 🔵 del usuario: arreglarlo antes de seguir.
  - RED: `tests/line-endings.test.mjs` — 2 pruebas rojas. La primera acusó `7/7 archivo(s)
    volvieron con CRLF`; la segunda listó los trackeados con `eol=unspecified`. La FALSIFICACIÓN
    quedó verde desde el principio: sin ella un cero no distinguiría entre «el atributo funciona»
    y «la sonda no mira nada».
  - La reproducción no depende de la plataforma: el repositorio de juguete fuerza
    `core.autocrlf=true`, así que el defecto sale igual en Linux y macOS.
  - BUILD: `.gitattributes` pasa de `*.md/*.json text=auto` a `* text=auto eol=lf`, con
    `*.ps1 text eol=crlf` después (PowerShell necesita CRLF).
  - Seguro por evidencia: `git ls-files --eol` sobre `docs/discovery` da `i/lf w/lf` en los 7
    archivos hasheados, así que los hashes guardados se calcularon sobre LF y el arreglo no rompe
    la cadena. `git status` siguió en 7 archivos: el índice ya estaba en LF, no hubo renormalización.
  - Verificado de punta a punta: repositorio real armado con los 232 archivos del árbol arreglado,
    clonado con `core.autocrlf=true`. En el clon `verify-discovery-core` y `verify-discovery-views`
    salen 0, y `verify-discovery-sources.test.mjs` pasa 16/16.
- **F14 encontrado de paso.** `scripts/verify-discovery-core.mjs` (2) y
  `scripts/verify-research-citations.mjs` (1) tienen bytes NUL crudos en el fuente, así que git los
  clasifica `-text` y `grep` los trata como binarios: `grep -n "CONTROL_CHARACTERS"
  scripts/verify-discovery-core.mjs` responde `Binary file ... matches` y esconde la línea. Es el
  mismo defecto que el receipt huérfano ya arregló en `verify-vcp-coverage.mjs` con
  `String.fromCharCode(0)`; sobrevive en estos dos. **No tocado: sin decisión.**

## No verificado (F13)

- Que 30 archivos con `w/crlf` o `w/mixed` en mi árbol de trabajo no importen: **razonado, no
  medido**. El índice está en LF y ninguno entra en un hash entre máquinas; no se probó uno por uno.
- Que el arreglo se comporte igual en Linux y macOS: **no verificado en esas plataformas**. La
  prueba fuerza `core.autocrlf=true`, que es el mecanismo, pero se corrió sólo en Windows.

## Sesión 2026-09-01 — cierre

**Publicado:** `f376bed` (Bloque A) y `a492b3d` (B1 Intake), los dos en `origin/main`.

- **Bloque A · DONE.** A1 flakiness, F13 CRLF en clon, A2 port del gate de cobertura, F14 NUL
  crudos, F15 verificadores de research que reventaban, A3 denominador declarado, A4 base de
  seguridad real. 10/10 corridas, 19 gates, clon limpio verde, instalación limpia verificada.
- **B1 Intake · DONE.** `PHASE 1.5` en `SKILL.md`, `verify-intake.mjs` con 12 pruebas,
  `templates/intake.json`, fila en `empty-probe` y límite honesto registrado. 10/10 corridas,
  823 pruebas, cobertura 31/31.
- **La guardia de alcance de cobertura frenó mi propio trabajo de B1** y la corrección la hizo más
  estricta: ahora mira trackeados **más** los sin trackear que `.gitignore` no excluye.

## Retomar acá

- **Fase:** Bloque B, ciclo 2 de 6. **Falta:** CAIO, Mapa de Bucle, PRD, TRIANGULATE como fase
  propia, Adopción y recurrencia, y el enforce de menú por fase (extender
  `verify-phase-decisions.mjs` a ≥2 opciones y una elección registrada por fase).
- **Patrón que funcionó y conviene repetir:** esqueleto permisivo → RED conductual → BUILD →
  correr `verify-vcp-coverage.mjs` para que nombre las ramas que faltan → cerrarlas → 10 corridas.
- **Bloque C sin empezar:** re-pinear los 14 commits de research, decidir con 🔵 qué hacer con las
  8 fuentes del encargo que no están en el corpus, y convertir las señales lexicales en candidatos
  con contraejemplo.

## No verificado (cierre)

- **F16, preexistente y abierto:** `verify-evidence-trace claims --require-links` sale en rojo por
  4 claims sin vínculo de la decisión `d003`. Confirmado idéntico contra un clon de `af55a45`, así
  que es anterior a este trabajo. No está en el conjunto de comandos que el README publica.
- **LESSONS.md no se tocó**: el protocolo exige confirmación humana explícita para escribir una
  lección, y no se pidió.
- Nada se probó en Linux ni macOS.
