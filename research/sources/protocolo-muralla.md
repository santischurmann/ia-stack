# Fuente: nahuelangeles/protocolo (Protocolo Muralla)

**URL:** https://github.com/nahuelangeles/protocolo
**SHA pineado:** `5a04aeede0c2ef47aaf76e583e50740cf18a9144` (2026-08-03)
**Cobertura:** EXHAUSTIVA — 15/15 archivos leídos íntegros (1337 líneas: README, SKILL.md, 8
fases, 2 gates + 2 test files, 2 templates, 2 JSON de config). LICENSE no revisado (no aporta a
la metodología). Nada excluido salvo `.git/`.
**Fecha de análisis:** 2026-08-20.

---

## Qué es

Metodología personal de un solo autor (Nahuel Angeles), no un framework instalado por terceros —
repo chico (1337 líneas vs. VCP ~3000+), sin comunidad, sin adopción medida (no stars declaradas
en su propio README). Tesis central: **"un gate que no puede bloquear un merge es decoración"**
(frase tomada de un comentario de CI de `gentle-ai`, otra de las 13 fuentes ya investigadas en
`research/sources/gentle-ai.md`). SDD (spec) envuelve TDD (test rojo primero), RDD (recibo)
verifica ambos.

**Nota de transparencia:** el README de esta fuente cita a `santischurmann/VibeCodeProtocols` (=
este repo) por nombre, con la afirmación textual: *"«Hard gate. No override. No exceptions.» No.
Es markdown que el modelo puede saltear"* (`README.md:22`, `hooks/rojo.mjs:4-9`). Esa crítica
describía el VCP de antes del hardening (`b198f38` y anterior, sin `scripts/verify-red.*` ni
`scripts/verify-receipt.mjs`). A fecha de este análisis (post rounds 4-6) es **parcialmente
obsoleta** — VCP ya tiene gates mecánicos con exit code real y 9 tests de regresión — pero un
punto de la crítica sigue siendo **cierto hoy**: ver punto #1 abajo.

---

## Los 50+ puntos, por categoría

### A. GAPS REALES — VCP no tiene esto hoy, adoptar

1. **PreToolUse hook real que bloquea desde el harness, no desde el modelo.**
   `hooks/rojo.mjs:132-143` + `skill/protocolo-muralla/SKILL.md:57` — el hook se registra en
   `.claude/settings.json` y Claude Code lo corre ANTES de permitir un `Write`/`Edit`; si deniega,
   la escritura no ocurre, sin que el modelo tenga que "decidir portarse bien". VCP hoy
   (`SKILL.md` completo) depende de que el propio orchestrator invoque
   `verify-red.sh`/`verify-receipt.mjs` — un modelo que no los corre (por bug, por presión de
   contexto, por instrucción de usuario mal entendida) puede escribir código de producción sin
   que nada del lado del harness lo impida. **Este es el gap real que sobrevive a la crítica
   parcialmente obsoleta del punto de arriba.** Costo: medio (nuevo archivo hook + wiring en
   `.claude/settings.json`, verificar que Claude Code soporte `PreToolUse` con `matcher`).

2. **El recibo del RED gate se ata al hash del CONTENIDO de los archivos de test, no solo a un
   git_head/tree_fingerprint global.** `hooks/rojo.mjs:78-104` — huella SHA-256 por archivo de
   test declarado; si el test cambia después del rojo (el "modo de falla clásico" donde el modelo
   afloja la aserción para pasar su propia implementación), el recibo se invalida
   específicamente. VCP's `verify-receipt.mjs` cubre esto indirectamente (cualquier cambio en el
   árbol invalida el fingerprint completo), pero no da un mensaje específico "el test cambió,
   pedí un rojo nuevo" — mezcla esa causa con cualquier otro cambio de archivo. Adoptar: mensaje
   de error diferenciado cuando el archivo que cambió es uno de los declarados como test del RED.

3. **Lista de "ruido" (RUIDO) explícita y con test por cada entrada.** `hooks/rojo.mjs:43-50` +
   `hooks/rojo.test.mjs:49,58` — 6 regex nombradas (`SyntaxError`, `Cannot find module`, `command
   not found`, Windows "is not recognized...", `ERR_MODULE_NOT_FOUND`, `collection error`), cada
   una con su propio test de falsificación. VCP's `verify-red.sh`/`.ps1` tiene lógica equivalente
   pero repartida en condicionales, no como una lista declarativa con 1 test por entrada — más
   difícil de auditar qué señales de ruido están cubiertas y cuáles no.

4. **El trinquete (ratchet) — deuda técnica declarada explícitamente y congelada, prohibido que
   suba.** `gates/ratchet.mjs:1-157` completo — mecanismo que VCP no tiene en ninguna forma. Un
   contador declarado (`protocolo.contadores.json`) mide un patrón regex sobre archivos versionados,
   se congela una vez (`--congelar`), y falla si el número sube. Evidencia real citada
   (`SKILL.md:59-68`): en un proyecto real, donde no se tocó código nuevo la corrección aguantó
   (167→0→0), donde sí se escribió superficie nueva la deuda volvió (50→0→29) porque nada la
   cubría. VCP's DEBT.md es un log narrativo, no un contador mecánico que bloquea. Esto es
   ortogonal y complementario a DEBT.md, no un reemplazo — adoptar como gate opcional de Phase
   4.1/4.3.

5. **Umbral numérico explícito para exceso de mocks: 7+ = pará, estás en la capa equivocada.**
   `fases/3-rojo.md:31-36` — regla accionable ("hasta 3 sano, 4-6 extraé función pura, 7+ pará")
   con ejemplo concreto ("15 mocks para una conversión de una línea"). VCP no tiene ningún umbral
   numérico de higiene de mocks en Phase 3 (`skills/subagent-red.md`).

6. **Lista explícita de aserciones prohibidas en RED, con test por cada una.**
   `fases/3-rojo.md:20-29`: tautologías, `toBeDefined()` solo, `toEqual([])` sin contexto,
   aserción dentro de loop que puede iterar 0 veces, aserciones sobre clases CSS, "renderiza sin
   romperse". VCP exige "1 test real por AC" pero no tiene una lista negativa de patrones de
   aserción inválidos — un test podría pasar el gate RED (falla de verdad) y aun así ser un mal
   test por alguno de estos 6 patrones.

7. **Tier de revisión decidido por evidencia de riesgo, nunca por tamaño del diff — tabla
   explícita de 3 niveles con ejemplos concretos de qué cae en cada uno.**
   `fases/0-encuadre.md:5-18` — "1.000 líneas de documentación son tier 0; 2 líneas que tocan el
   ledger son tier 2." VCP's `risk_level` (`SKILL.md:249-257`) ya hace esto (bajo/estandar/alto/
   crítico con `sensitive_path`/`simplify_ignore_touch`/`large_change`), pero `protocolo`'s
   versión es más legible con la tabla de ejemplos concretos side-by-side. Mejora menor de
   presentación, no de mecánica — VCP ya lo tiene funcionalmente.

8. **650 palabras como techo duro para la spec, con la razón explícita: 4000 palabras que nadie
   lee envenenan el contexto de todas las fases siguientes.** `fases/1-spec.md:38-43`. VCP's
   `templates/spec.md` no tiene techo de longitud declarado. Adoptar: agregar un techo (no
   necesariamente 650, pero un número) a `templates/spec.md`.

9. **Delta contra una spec canónica persistente por dominio (`specs/{dominio}/spec.md`), con
   4 operaciones tipadas: ADDED/MODIFIED/REMOVED/RENAMED, y el archivo de cambios se mergea y
   archiva con fecha al cerrar.** `fases/1-spec.md:5-26`, `fases/7-cierre.md:5-13`,
   `plantillas/spec-delta.md` completo. VCP's `spec.md` es por-feature, no hay una "spec canónica
   del sistema" persistente que se actualice por delta — alguien que llega nuevo al proyecto no
   tiene un lugar único que describa "qué hace el sistema hoy" sin leer el código. Esto es un gap
   estructural real, no cosmético — VCP's `.vibe/PROJECT.md` es lo más cercano pero no sigue el
   formato delta ADDED/MODIFIED/REMOVED/RENAMED ni se mergea mecánicamente.

10. **La "trampa de MODIFIED" nombrada explícitamente: copiar el requisito ENTERO antes de
    editarlo, porque el merge reemplaza el bloque completo y lo no copiado se pierde.**
    `fases/1-spec.md:23-26`. Directamente aplicable si se adopta el punto #9 — sin delta canónico
    este punto no aplica todavía a VCP.

11. **Veredicto `UNTESTED` como categoría explícita en la tabla de cobertura de la spec** (junto a
    COMPLIANT/FAILING/PARTIAL). `fases/1-spec.md:34-36`, `plantillas/recibo.md:37-41` — un
    escenario de la spec sin test asociado se marca así, en vez de quedar implícito. VCP no tiene
    una tabla de cobertura de ACs contra tests en el receipt — el receipt tiene `evidence` como
    array de strings libres, no una tabla escenario→test→veredicto.

12. **Refutador — un agente APARTE (no un revisor más) cuyo único trabajo es atacar cada hallazgo
    de revisión y devolver `corroborado | refutado | no concluyente`, con sesgo hacia refutar; solo
    se arregla lo corroborado.** `fases/6-revision.md:24-31`. VCP's 4R Reviewer (`SKILL.md`
    Phase 4.4) evalúa Risk/Readability/Reliability/Resilience pero no tiene un rol separado de
    "abogado del diablo" que refute los hallazgos de los otros reviewers antes de que se actúe
    sobre ellos — el riesgo es ruido: hallazgos de baja confianza consumen tiempo de fix sin haber
    sido puestos a prueba. Esto SÍ está parcialmente cubierto por el research anterior
    (candidato de refutación adversarial ya usado en la metodología de research de VCP, pero
    nunca se portó al propio ciclo de review de código de VCP).

13. **Regla de precisión explícita para reviewers: "reportá un hallazgo solo si es un defecto
    real que defenderías con evidencia concreta; ante la duda, callate." Hallazgos de estilo
    prohibidos salvo que oculten un defecto.** `fases/6-revision.md:17-22`. VCP's 4R rubric no
    tiene una regla anti-ruido explícita de este tipo — implícita en "adversarial" pero no
    declarada como regla dura.

14. **Reviewers de solo lectura, separación estricta entre quien puede vetar y quien puede editar
    ("quien puede vetar no puede editar").** `fases/6-revision.md:9-11`. VCP no declara esto
    explícitamente para el 4R Reviewer — vale la pena declararlo como regla dura, ya que si el
    mismo rol revisa y arregla, pierde el valor adversarial.

15. **Registro de hallazgos con `id` rastreable entre rondas, para que un hallazgo no reaparezca
    disfrazado.** `fases/6-revision.md:32-35`. Complementario al `id` que ya se agregó a DEBT.md
    en esta sesión (ver `CHANGELOG.md` "Hardening pass 6") — ahí falta portar el mismo patrón al
    registro de hallazgos de Phase 4.4 (4R), que hoy no tiene id persistente entre rondas.

16. **Registrar también las FORTALEZAS — qué está bien y por eso no aparece en la lista de
    hallazgos, para que nadie lo reabra ni lo regresione en la próxima ronda.**
    `fases/6-revision.md:40-43`. VCP no tiene esto — cada ronda de 4R parte de cero sin memoria de
    qué ya se evaluó como correcto.

17. **"El orquestador es el único dueño del estado / único que escribe el registro — si el mismo
    agente que hizo el trabajo escribe el acta, el acta se contamina."**
    `skill/protocolo-muralla/SKILL.md:32-34`, `fases/6-revision.md:37-38`. VCP tiene esto
    implícito (LAW 4: "orchestrator codes zero features") pero no lo declara explícitamente para
    el registro/ledger — vale agregarlo como frase dura junto a LAW 5 (línea a SESSION.md/AUDIT.md).

18. **Antes de tocar archivos existentes: correr sus tests primero y anotar la línea de base
    ("N tests en verde"); si algo ya falla, PARAR y reportarlo como falla preexistente — nunca
    arreglarlo de paso dentro de otra tanda.** `fases/4-verde.md:5-11`. VCP no tiene esta regla
    explícita — un fix colado dentro de otra tarea es exactamente el tipo de scope creep que las
    reglas globales de este usuario ya prohíben en general, pero no está codificado en SKILL.md
    Phase 3 como paso mecánico.

19. **Después de GREEN: `git diff --stat` contra los archivos declarados en la tarea, para
    confirmar que no se tocó nada fuera de lo declarado.** `fases/4-verde.md:41-42`. VCP no tiene
    este chequeo mecánico explícito en Phase 3 — el scope-check queda a criterio del modelo.

20. **Recibo con campo `verificado` vs `leído` separados explícitamente por hallazgo, "mezclarlos
    es cómo nace un falso verde."** `fases/5-recibo.md:27-28`. VCP's receipt schema
    (`SKILL.md:343-353`) tiene `evidence` como array libre, sin distinguir qué evidencia fue
    verificada activamente (comando corrido) vs. leída (código inspeccionado sin ejecutar). Gap
    real, aplicable directo al schema de `.vibe/receipts/*.json`.

21. **"Un gate se declara verificado SOLO después de romper la producción a propósito y confirmar
    que se pone rojo. Antes de eso está escrito, no verificado."** `fases/5-recibo.md:30-36`,
    reforzado con receta explícita en `plantillas/recibo.md:29-35` (tabla "Gates falsificados": qué
    se saboteó, qué resultado dio). VCP tiene tests de regresión reales para sus 2 gates
    (`tests/verify-*.test.mjs`) que ya hacen esto en la práctica, pero no exige el mismo ritual
    para gates que un usuario de VCP escriba en SU PROPIO proyecto al usar el protocolo — Phase
    4.1 no pide falsificar el propio lint/CI antes de confiar en él.

22. **Regla meta sobre cómo escribir una regla nueva: "que traiga su detector — no 'no hagas
    over-engineering' sino 'over-engineering → git diff --stat contra los archivos declarados'.
    Una regla sin método de verificación es decorativa."**
    `skill/protocolo-muralla/SKILL.md:123-127`. Aplicable directamente a cómo VCP mismo evoluciona
    — cualquier LAW nueva que se agregue a `SKILL.md` debería venir con su propio mecanismo de
    chequeo, no solo texto. Meta-mejora al propio proceso de research/adopción de VCP.

23. **Regla meta sobre comentarios en gates: "el comentario cuenta la herida, con el número de
    veces que pasó. Un gate que nace de una buena práctica se borra; uno que nace de una cicatriz
    se respeta."** `skill/protocolo-muralla/SKILL.md:109-113` — y en la práctica, cada gate real
    (`ratchet.mjs:1-14`, `rojo.mjs:1-18`) tiene ese comentario de origen. VCP's
    `verify-receipt.mjs`/`verify-red.sh` ya tienen comentarios explicando el "por qué" (agregados
    en el hardening de esta sesión), pero no siempre citan el número de veces que el bug pasó —
    mejora menor de disciplina de comentarios.

24. **Nivel de rigor por proyecto declarado UNA vez al arrancar: Vidriera / Herramienta / Producto
    con plata — "la rigurosidad se paga y solo se paga cuando hay algo que perder."**
    `skill/protocolo-muralla/SKILL.md:49-52`. VCP's `risk_level` se calcula por-cambio
    (`SKILL.md:249-257`), no hay un nivel de proyecto declarado una sola vez al bootstrap que
    sirva de piso/contexto para todos los risk_level subsiguientes — un proyecto "vidriera" hoy en
    VCP puede terminar con el mismo aparato completo que un proyecto con dinero real si un cambio
    puntual toca `sensitive_path`.

25. **Regla dura: "Git con remoto desde el día uno, sin excepciones — sin remoto el CI no corre
    nunca, y sin CI todo gate es un procedimiento manual disfrazado."**
    `skill/protocolo-muralla/SKILL.md:53-54`. VCP's Phase 0 Bootstrap no exige remoto — el
    protocolo funciona íntegro en un repo local sin push nunca, lo cual es intencional (este mismo
    usuario trabaja así en varias sesiones sin push hasta pedirlo explícitamente), así que esto
    NO aplica igual — nota, no adopción.

26. **Anti-convergencia en diseño visual: fuentes sobreexpuestas y patrones prohibidos nombrados
    explícitamente (Inter/Roboto/Arial/degradados violeta/grillas de 3 columnas con íconos
    circulares/todo centrado).** `fases/2-diseno.md:33-44`. VCP no tiene fase de diseño visual en
    absoluto — fuera de alcance del protocolo actual (VCP es TDD de backend/lógica, no UI/UX). No
    aplica salvo que VCP decida cubrir diseño visual en el futuro.

27. **SAFE/RISK — toda propuesta de diseño se parte en 2-3 decisiones seguras + mínimo 2 riesgos
    deliberados nombrados con costo/beneficio explícito.** `fases/2-diseno.md:9-24`. Mismo caso
    que #26 — no aplica hoy, VCP no tiene fase de diseño visual.

### B. YA CUBIERTO EN VCP — mencionado para que quede la comparación explícita, sin acción

28. **Config vs Content menu, una vez por fase / por decisión.**
    `skill/protocolo-muralla/SKILL.md:42-43` vs VCP `SKILL.md` LAW 7 — funcionalmente idéntico,
    ambos protocolos llegaron a la misma solución independientemente.

29. **Ruta Directo/Delegado/Con-spec por evidencia de archivos, nunca por tamaño.**
    `fases/0-encuadre.md:19-29` vs VCP's auto-routing triage (`SKILL.md:65-77`) — mismo mecanismo,
    mismo umbral conceptual (VCP usa 1-3 archivos, protocolo usa "1-3 directo, 4+ delegado").

30. **RFC 2119 (MUST/SHALL/SHOULD/MAY) + GIVEN/WHEN/THEN en la spec.** `fases/1-spec.md:32-34` vs
    `research/vcp-implementation-spec.md` y `templates/spec.md` — mismo estándar, ya adoptado en
    VCP desde el hardening round anterior (E2E controlado, ver `CHANGELOG.md` "Hardening pass 5").

31. **Triangulación obligatoria: segundo caso con inputs distintos que rompa el hardcode.**
    `fases/4-verde.md:17-23` vs VCP's rol Triangulator (`SKILL.md` §3.3,
    `skills/subagent-triangulate.md`) — mismo concepto, mismo nombre de fase incluso.

32. **Boy Scout Rule en refactor, tests en verde después de cada paso, sin features nuevas.**
    `fases/4-verde.md:25-28` vs VCP's Refactor-Engineer role — idéntico.

33. **Recibo con evidencia reproducible, número no inventado ("-1" si no se midió).**
    `fases/5-recibo.md:22-25` vs VCP's `evidence` array requerido no-vacío (`verify-receipt.mjs`) —
    concepto compartido; VCP no tiene el convenio explícito de "-1 para no-medido" — mejora menor
    de convención de datos (ver punto complementario #20).

34. **8 fases con nombre único vs VCP's 5 fases (0-4) con sub-fases numeradas (4.1-4.8).**
    Estructuralmente distintas pero cubren el mismo terreno — protocolo separa Diseño y Cierre
    como fases top-level, VCP los mete dentro de Build/Final. Es una decisión de forma, no de
    fondo; no hay pérdida de cobertura en VCP por tener menos fases top-level.

35. **No override, no exceptions en el gate de escalado.** `terminal_state: escalated` de VCP
    (LAW 8) ya es más estricto en la práctica que lo que protocolo describe para su propio recibo
    — protocolo no tiene un estado equivalente a "escalated" explícito, solo "corroborado" en
    revisión. VCP está adelante acá.

### C. NO APLICA / RECHAZAR — evaluado y descartado con razón concreta

36. **El trinquete usa regex sobre texto, no AST — "no entiende el código, para deuda que
    requiere entender intención no sirve."** `README.md:161-163`, confesado por el propio autor.
    Si se adopta el punto #4, hay que adoptarlo con esta limitación explícita, no como reemplazo
    de revisión humana de intención.

37. **Fase de Diseño (2) está incompleta a propósito, confesado por el autor** (`DESIGN.md` no
    escrito). No hay nada maduro que portar de esta fase todavía — evaluar de nuevo si el autor la
    completa en el futuro.

38. **"No hay agentes de revisión todavía. La fase 6 describe el refutador; el archivo del agente
    no está escrito."** `README.md:157-158`. El concepto del refutador (punto #12) es válido y
    adoptable, pero no hay código de referencia que copiar — solo la especificación en prosa.

39. **Cuidados específicos de React (`clearTimeout` en cleanup, efectos dentro de `setState`
    updater, `useMemo` con estado compartido).** `fases/4-verde.md:32-37`. Stack-específico
    (React), no portable a VCP como regla general — VCP es stack-agnóstico por diseño
    (`package.json`/`pyproject.toml`/`go.mod`/`Cargo.toml` auto-detect). No adoptar como regla
    general; sí válido como ejemplo de "por qué documentar gotchas de stack" en LESSONS.md si un
    proyecto VCP-target usa React.

40. **La bronca específica con barras invertidas en regex dentro de JSON** (`\b` = backspace en
    JSON, no frontera de palabra). `plantillas/protocolo.contadores.json:2`. Cierto y correcto,
    pero JavaScript-específico y del propio parser de JSON — no aplica a VCP porque VCP no tiene
    ningún mecanismo de contador basado en regex-en-JSON (hasta que se adopte el punto #4, en cuyo
    caso esta advertencia SÍ debe copiarse textual al nuevo `templates/vibe/COUNTERS.json` que
    resulte).

41. **Comparación de estrellas (0 / 126.079 / 5.348) como argumento de por qué se investigó cada
    repo.** `skill/protocolo-muralla/SKILL.md:18-25`. Es color editorial del propio autor, no una
    práctica metodológica — no hay nada que adoptar, solo la nota de transparencia ya cubierta
    arriba.

42. **MIT license, instalación de un solo `cp -r`.** `README.md:112-116,168`. Trivial, VCP ya
    tiene instalación equivalente vía `scripts/install.sh`/`.ps1` con más superficie (ambos
    árboles Admin/VPS de otros proyectos de este usuario, no aplica igual acá pero el patrón single
    -command install ya está cubierto).

### D. Puntos de proceso/meta (cuentan para el total, aplican a cómo VCP evoluciona, no a código)

43. **Regla "documentar leyendo el código, no la spec — la spec dice qué se planeó, el código dice
    qué se construyó."** `skill/protocolo-muralla/SKILL.md:30-31`. Aplicable a cómo VCP mismo
    describe su propio estado en README/CHANGELOG — ya se sigue de hecho en esta sesión (T06 de
    la ronda anterior citó file:line real post-cambio, no la spec pre-cambio), vale declararlo
    como regla explícita en `skills/vibe-memory.md`.

44. **"El commit cuenta qué cambió y por qué, con los números medidos."**
    `fases/7-cierre.md:27-30`. VCP's convención de commit (conventional commits, español, per
    `~/.claude/CLAUDE.md` del usuario) no exige explícitamente incluir números medidos en el
    cuerpo — mejora menor de convención.

45. **"Qué NO se declara cerrado": lote sin revisar en su última ronda, gate escrito pero no
    falsificado, escenario UNTESTED.** `fases/7-cierre.md:19-25`. VCP's DoD (LAW 6) ya cubre
    coverage/lint/typecheck/docs/.vibe/security/adversarial, pero no tiene una lista explícita de
    "condiciones que impiden declarar cerrado" tan concreta — vale portar como checklist negativo
    en Phase 4.6 antes del commit final.

46. **"La deuda se declara donde vive — en el encabezado del archivo que la causa, no en un
    ticket que nadie lee seis meses después."** `fases/7-cierre.md:14-18`. Tensión real con
    DEBT.md de VCP, que es centralizado. No es un gap sino una decisión de diseño distinta — VCP
    centraliza a propósito para que `.vibe/DEBT.md` sea barrible en Phase 0 Bootstrap sin tener
    que grepear todo el repo por comentarios. Nota, no adopción — ambos approaches son válidos,
    VCP ya eligió el suyo con razón (recall en bootstrap).

47. **Nivel de detalle de recibo con tabla `Cobertura de la spec` (Requisito | Escenario | Test |
    Veredicto) como parte fija del template.** `plantillas/recibo.md:37-41`. Complementa el punto
    #11 (UNTESTED como veredicto) — aplicable directo a `.vibe/receipts/*.json` si VCP decide
    adoptar el veredicto explícito.

48. **"Al cerrar la fase: presentar qué se cerró, qué quedó abierto (nombrado, con el archivo que
    lo causa) y cuál es la siguiente decisión."** `fases/7-cierre.md:32-35`. VCP's Phase 4.8
    Reflect (RETRO.md) cubre esto parcialmente (shipped/friction/keep/change) pero no exige
    nombrar explícitamente el archivo que causa cada ítem abierto.

49. **Contadores del trinquete declarados con nombre + patrón + incluir/excluir por glob, en JSON
    versionado junto al código** (no en un doc separado). `plantillas/protocolo.contadores.json`
    completo. Si se adopta el punto #4, este es el formato de referencia exacto a portar/adaptar
    a `templates/vibe/`.

50. **Formato de test de falsificación con prefijo `FALSIFICACIÓN ·` en el nombre del test, para
    que sea grep-able cuántos gates tienen prueba adversarial propia vs. cuántos son solo
    happy-path.** `gates/ratchet.test.mjs`, `hooks/rojo.test.mjs` (9 de 25 tests con ese prefijo).
    VCP's `tests/verify-*.test.mjs` no usa un prefijo de nombre consistente para distinguir tests
    "prueban que funciona" vs. "prueban que se rompe cuando tiene que romperse" — mejora de
    convención de nombres, cero costo, alto valor de auditabilidad (`grep FALSIFICACIÓN` da la
    respuesta a "¿este gate está realmente probado adversarialmente?" en un comando).

51. **Reporte de qué NO tiene el repo, dicho explícitamente en el README ("Lo que este repo NO
    tiene"), en vez de dejarlo implícito.** `README.md:153-166`. VCP no tiene una sección
    equivalente — el `research/vcp-improvement-proposal.md` cumple parte de esa función
    (candidatos evaluados y rechazados) pero no hay un "esto es intencionalmente incompleto" en el
    README principal de cara a un usuario nuevo.

52. **Verificación con instrucción exacta de por qué el comando falla si se corre distinto**
    (`node --test gates/` muere antes de correr un test porque trata el directorio como módulo, hay
    que pasar los archivos explícitos). `README.md:141-146`. Detalle operacional pequeño pero real
    — vale la pena que el README de VCP tenga la misma clase de advertencia si algún comando de
    verificación tiene un footgun equivalente (ya cubierto en parte: `README.md` VCP documenta el
    comando de test explícito).

---

## Resumen ejecutivo — top 5 adopciones por costo/impacto

| # | Candidato | Costo | Impacto | Veredicto |
|---|---|---|---|---|
| 1 | PreToolUse hook real (bloqueo desde harness) | medio | **alto** — cierra el único gap real que sobrevive a la crítica del propio repo hacia VCP | **Adoptar**, requiere spec propio |
| 20 | `verificado` vs `leído` como campos separados en evidence | bajo | medio | Adoptar |
| 11 | Veredicto `UNTESTED` explícito en cobertura de receipt | bajo | medio | Adoptar |
| 50 | Prefijo `FALSIFICACIÓN ·` en nombres de test de gate | cero | medio (auditabilidad) | Adoptar |
| 4 | Trinquete de deuda (ratchet) como gate opcional | medio-alto | alto si el proyecto target tiene deuda medible | Adoptar como opt-in, no default |

**Total de puntos analizados: 52.** 27 gaps reales adoptables (A+D), 8 ya cubiertos en VCP (B),
5 evaluados y rechazados con razón concreta (C), el resto son notas de contexto/transparencia.
Ninguno de los 52 se adoptó todavía en código — este documento es investigación, no
implementación. Siguiente paso si el usuario quiere avanzar: spec formal (mismo formato que
`research/vcp-implementation-spec.md`) para los candidatos marcados "Adoptar" arriba, con 🔵
fase-por-fase como el resto de esta metodología exige.
