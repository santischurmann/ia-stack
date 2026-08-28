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
- `tests/protocolo-e2e.test.mjs`: instala VCP en un proyecto nuevo y corre los gates en orden.
  Comprueba que ninguno escribe `OK:` sobre un proyecto donde no hay nada, y que recortar la traza
  pasa `check` y cae en `history`. Lo que **no** cubre está escrito en la cabecera del archivo.

## No verificado

- Comportamiento de `verify-vcp-coverage.mjs` sin entradas: **no verificado**, excluido de la
  sonda por costo (correrlo ejecuta la suite entera).
- Subcomandos distintos al declarado en `contracts/empty-probe.json`: **no verificado**, la sonda
  prueba una invocación por gate.
- Las citas `archivo:línea` del research: **no verificado** por mí; las verificó cada agente
  lector contra su clone pineado, y el sintetizador declara que no las revalidó.
