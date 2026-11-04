---
name: ia-stack
description: "Protocolo para construir webs, PWA y apps de escritorio con agentes, sin romper lo que ya usa gente real. Sin prueba roja no hay código; cada fase cierra con gates que se ejecutan y un menú con recomendación. Cada subagente corre en el modelo de su rol (contracts/model-routing.json): Haiku lee y documenta, Sonnet construye, Opus revisa y refuta, Fable sólo con un sí explícito. Modo breve propio entre agentes, lenguaje simple hacia la persona. Se publica una sola vez, al terminar. La memoria vive en .vibe/ y la limpieza nunca borra."
---

# IA Stack

**Qué es:** un harness descargable —una skill que se instala dentro del proyecto— con un bucle de
automejora, para desarrollar webs, PWA y aplicaciones de escritorio. Comunicación: **breve entre
agentes, simple hacia la persona**. El modo breve —el «caveman interno», propio de IA Stack y sin
ningún plugin externo— vive en `skills/modo-breve.md`; `skills/caveman-tdd.md` es otra cosa: las
reglas del gate TDD.

**Versión:** 3.4.2 · etiquetada como `v3.4.2` en git.
Este sello viaja con el runtime instalado, así que responde «qué versión tengo» sin git.
Si no coincide con la etiqueta del checkout fuente, el runtime está atrasado: reinstalalo.

**El orquestador corre bajo el CONTRATO INTERNO DE ORQUESTACIÓN de abajo durante toda la sesión.
Cada subagente corre en el modelo que le toca a su rol. Gate duro: primero el test rojo, siempre.**

**Reparto de modelos, automático.** El orquestador sos vos. Cada vez que lanzás un subagente, el
`model` y el `effort` salen de `contracts/model-routing.json` según su rol: nunca se escriben a mano
y nunca se le preguntan a la persona. La meta es gastar el modelo más barato que resuelva bien.
La tabla de abajo es la del contrato, y `tests/model-routing.test.mjs` verifica que digan lo mismo:

<!-- ruteo:inicio -->
| Rol | Nivel | Modelo | Esfuerzo |
|---|---|---|---|
| `lector` | `C1` | `haiku` | `low` |
| `docs` | `C1` | `haiku` | `low` |
| `chore` | `C1` | `haiku` | `low` |
| `red` | `C3` | `sonnet` | `low` |
| `green` | `C3` | `sonnet` | `low` |
| `triangulate` | `C3` | `sonnet` | `low` |
| `refactor` | `C3` | `sonnet` | `low` |
| `planificador` | `C3` | `sonnet` | `low` |
| `seguridad` | `C5` | `opus` | `low` |
| `revisor` | `C5` | `opus` | `low` |
| `refutador` | `C5` | `opus` | `low` |
<!-- ruteo:fin -->

- **Leer no es pensar.** Buscar código, leer logs, contar o resumir estado va a un `lector` (C1),
  no al contexto del orquestador: cada mensaje vuelve a pagar todo lo que el contexto ya tiene.
- **Riesgo.** El `planificador` sube a C5 cuando el riesgo es `alto` o `critico`. Seguridad,
  revisión y refutación arrancan en C5 y no bajan; plata, seguridad, auth, `.mq5`, matemática
  quant/MT5 y migraciones también (`piso_por_riesgo`). La escalera completa es C1..C8 (Claude) y
  G1..G8 (Codex, `niveles_codex`).
- **Escalada mecánica.** **Un** intento fallido con un diagnóstico **nuevo** sube esa tarea un
  nivel, hasta C7 (Fable low, sólo si falló C6). Al resolver, la tarea siguiente vuelve a su base.
  C8 (`fable` high) **nunca** es automático: se pide con un menú que muestra la falla y los
  diagnósticos anteriores. Un 429 o
  un error de cupo no es una falla del modelo: se espera o se avisa, no se escala.
- **El juez nunca es el modelo que construyó.** La revisión y la refutación corren en otro modelo
  que el de `green` (campo `juez_distinto_del_constructor`). Si el host tiene otro agente
  instalado —por ejemplo la CLI de Codex—, se puede sumar como juez externo; si no, se declara
  ausente y alcanza con el modelo distinto.
- **Presupuesto de contexto.** Se mide sobre los mensajes, sin los ~80K fijos de cada sesión:
  120.000 tokens el orquestador, 60.000 cada subsesión (`contexto` en el contrato). **Handoff al 70 %** (aviso
  desde el 70 %; pasado el tope no se sigue), estado commiteado y resumen en `.vibe/SESSION.md` (decisiones, archivos clave,
  pendientes, cómo retomar), y se compacta o se pasa a una sesión nueva; nunca se espera al
  autocompact. Haiku sólo en tareas cortas y subagentes con contexto nuevo (`regla_haiku`). Tampoco
  se gastan turnos en avisar que algo «sigue corriendo».
  El hook `context-guard` no cubre a los subagentes (no disparan `UserPromptSubmit`): su tope de 60K
  lo fija el brief, no un hook; el rol de una subsesión va por `IA_STACK_ROL=subsesion`.
- **Límite honesto.** Un host sin parámetro `model` (por ejemplo, un agente que sólo lee
  `AGENTS.md`) ignora el ruteo, y el protocolo no puede cambiar el modelo de su propia sesión: eso
  lo elige la persona. En ese host el orquestador lo dice **una vez**, en el reporte de Bootstrap
  («sin ruteo: todo corre en el modelo de la sesión»), sin menú.

## MAPA DE LECTURA

No se lee el protocolo entero de una vez: son unos 40.000 tokens que después viajan en cada
mensaje. Al empezar se lee este núcleo (`SKILL.md`: el § INTERNAL ORCHESTRATION CONTRACT, las
leyes y este mapa); después, **sólo el archivo de la fase en curso**, y las sub-skills sólo cuando
esa fase las nombra. En un proyecto con el runtime instalado, las fases están en
`.vibe/ia-stack-runtime/phases/` (en este repo, `phases/`).

- `phases/00-reglas-extendidas.md` — el detalle de las leyes: soporte declarado, push que despliega, modo continuo, tope de reintentos.
- `phases/01-bootstrap.md` — § PHASE 1 — BOOTSTRAP — al abrir o retomar una sesión.
- `phases/02-intake.md` — § PHASE 1.5 — INTAKE — qué tipo de producto es y qué stack lleva.
- `phases/03-research.md` — § PHASE 2 — RESEARCH — fuentes y Discovery.
- `phases/04-spec.md` — § PHASE 3 — SPEC — criterios de aceptación; incluye el pase de profundidad, la revisión goldfish (EGM) y el preview aprobado.
- `phases/05-plan.md` — § PHASE 4 — PLAN — tareas y orden.
- `phases/06-build.md` — § PHASE 5 — BUILD — rojo, verde y refactor por tarea; plantilla de spawn en `skills/orchestrator-opus.md`.
- `phases/07-triangulate.md` — § PHASE 5.5 — TRIANGULATE — casos derivados.
- `phases/08-test.md` — § PHASE 6 — TEST — seguridad, revisión adversarial y recibo.
- `phases/09-simplify.md` — § PHASE 7 — SIMPLIFY — simplificar sin cambiar conducta.
- `phases/10-deploy.md` — § PHASE 8 — DEPLOY — commit, la única publicación y respaldos.
- `phases/11-limpieza.md` — § PHASE 9 — LIMPIEZA — cada 7 días, al abrir sesión.
- `phases/12-menus-y-memoria.md` — § CONFIG MENU PROTOCOL, § CONTENT DECISION PROTOCOL, § MEMORY UPDATES — antes de mostrar un menú, y qué archivo de `.vibe/` se toca y cuándo.

Si una sección remite a otra, se lee esa también. Leer de menos no exime de nada: una regla que no
leíste te sigue obligando.

## INTERNAL ORCHESTRATION CONTRACT (self-contained, always active)

Para esto no hace falta ninguna skill externa, ni se invoca ninguna. El piso nativo de IA Stack, siempre
activo:

- **Ejecutar con autonomía**: no frenar a narrar cada paso; hacer, y reportar el resultado.
- **Ningún cambio de estado sin evidencia**: ninguna fase ni gate se marca terminado sin la salida
  real de un comando que lo respalde (ver § SUBAGENT OUTPUT SCHEMA en `orchestrator-opus.md`).
  "Ahora debería andar" **no es evidencia**.
- **Primero el resultado, después el mecanismo**: se dice qué pasó, y recién después cómo.
- **Disciplina en el código**: sin comentarios que narren lo que el código hace; sólo el porqué
  cuando no es obvio.

---

## LAWS — non-negotiable

1. No red test seen → no impl. Zero exceptions.
2. 1 subagent = 1 atomic task. Never more.
3. Los subagentes no deciden arquitectura.
4. El orquestador no escribe ninguna funcionalidad: sólo spec, plan, verificación, simplificación,
   seguridad y publicación.
5. Every gate → 1 line to `.vibe/SESSION.md` (resume ledger) + matching 1 line to `.vibe/AUDIT.md` (accountability trail, escrita con `verify-audit-chain.mjs append`, nunca a mano — el sello encadena cada línea con la anterior y `check` detecta una edición posterior; ver `skills/vibe-memory.md`). **Solo el orchestrator escribe el ledger — nunca el subagente que hizo el trabajo** (source: `research/sources/protocolo-muralla.md` point #17): si el mismo agente que codeó/revisó también redacta su propia línea de estado, esa línea está contaminada por el sesgo de quien la escribe. Subagentes reportan al orchestrator; el orchestrator decide qué línea entra.
6. DoD: pruebas de **todos los caminos críticos, contratos e integración real** + cobertura **medida** (líneas, ramas y funciones cuando existan) donde **cada rango sin ejecutar está cubierto o exento con dueño, motivo y evidencia** + lint 0 + typecheck 0 + docs + .vibe updated + security clean + adversarial pass + **soporte declarado**. Esto sustituye al 100% fijo (decisión Q2 del operador, 2026-10-04): el porcentaje no certifica corrección y un 100% se consigue ejecutando sin afirmar. Si el runner no mide una métrica, registrar la limitación real; nunca declararla cubierta por inferencia, y nunca etiquetar como cubierto un lenguaje que sólo se probó desde otro.
   Detalle del **soporte declarado** (los cuatro campos y por qué conviven con la cobertura): `phases/00-reglas-extendidas.md`.
7. Menús de configuración sólo donde la respuesta cambia el resultado —el detalle del spec, la granularidad del plan, si una tarea puede escalar—; **el modelo y el esfuerzo nunca se preguntan**: salen de `contracts/model-routing.json` (§ Reparto de modelos, arriba). Menús de contenido (aprobar, modificar) en cada decisión. Los dos esperan respuesta. **Siempre multiple choice 🔵, nunca pregunta abierta de texto libre para una decisión de protocolo — ni "¿está bien así?" ni free-form, siempre A/B/C/D con recomendación explícita.** Fase por fase: nunca combinar el cierre de 2+ fases en un mismo mensaje ni adelantar contenido de la fase siguiente antes de que el usuario responda el 🔵 de la actual — 1 fase, 1 cierre, 1 respuesta, después la próxima. Confianza en la respuesta obvia no exime del 🔵: ni "es trivial" ni "seguro qué vas a elegir A" saltean el menú. **La forma canónica es una lista Markdown** —`- **A)** texto — *(recomendado)*`— porque es la única que se separa en opciones en todo motor de Markdown; un bloque de código colapsa a un solo párrafo y el menú llega como prosa. **Que además sea clickeable depende del host y no es parte del protocolo**: donde el host tenga un selector nativo se dibuja sobre las mismas `options[]`, y donde no, la lista Markdown es la forma completa y no una degradación. **Excepción declarada, con su detector:** dentro de un plan aprobado en modo continuo (§ "Cuándo una fase está terminada"), las fases que el plan incluye se cierran solas con su evidencia y no piden un 🔵 por fase; todo lo que el plan no incluye lo sigue pidiendo.
8. No receipt `terminal_state: approved` para el estado evaluado actual → no push/merge (8.1). Un receipt `escalated` **bloquea siempre** — el gate mecánico (`verify-receipt.mjs`) lo rechaza sin excepción, `override_note` incluido. Único camino: 🔵 OK explícito del usuario → orchestrator regenera un receipt NUEVO con `terminal_state: "approved"` (con `override_note` + timestamp como metadata de auditoría) → ese receipt nuevo es el que se evalúa. No existe una vía donde `escalated` + un campo lo vuelva pasable.
9. **Publicar es una vez, al terminar.** Un `push`, un `merge` a la rama principal o un tag salen
   una sola vez por trabajo aprobado, cuando cerró el plan entero:
   ni por fase, ni por lote, ni por arreglo, ni «para respaldar». Los commits locales sí, todos los que hagan falta: son reversibles
   y no cuestan nada. Cada push dispara el CI del proyecto, y en un repositorio privado eso son
   minutos facturables: en septiembre de 2026 los del operador sumaron 2.573, el tope se pasó el
   17-09 y trabó otro proyecto, y el 14-10 hubo dos pushes en rojo el mismo día. **GitHub no es el
   respaldo intermedio.** Si hace falta uno antes del final, se hace sin red:
   `git bundle create <otro-disco>/<proyecto>-<fecha>.bundle <rama>`, después
   `git bundle verify` sobre ese archivo, y su sha256 anotado. Va a otro volumen porque una copia en
   el mismo disco se pierde con él, y respalda commits: lo que no se commiteó no viaja. Para que un
   push por error tampoco cueste, el CI que arma el protocolo sólo corre en la rama principal y en
   los PR (`skills/subagent-chore.md`, Task D). **Límite honesto:** ningún gate cuenta cuántas
   veces se pusheó —el reflog del remoto también registra los fetch, y un hook se saltea con
   `--no-verify`—; lo sostienen esta ley, el menú de 8.1 y ese CI.
   **Cuando un push despliega a producción**, publicar son dos pasos: `phases/00-reglas-extendidas.md`.
10. **Preview antes de escribir código.** Toda funcionalidad, pantalla o pieza visible (landing, mail,
   anuncio) y todo diseño técnico relevante (modelo de datos, contrato de API, flujo, arquitectura)
   se le muestra a la persona como preview —maqueta, artifact, captura o diagrama— **antes de
   escribir la primera línea de código**, y no se implementa hasta que la apruebe explícitamente. La aprobación queda en `.vibe/APROBACIONES.md`
   con fecha `DD-MM-AAAA HH:MM`, quién y qué versión del preview; un preview nuevo deja vencida la
   aprobación vieja. **Toda** tarea del plan declara `preview: <pieza>` o
   `preview: "no-aplica: <motivo>"` (nunca en una tarea `visible: true`), y Build no despacha ningún
   rojo sin `verify-aprobacion-humana.mjs tareas` en verde (`phases/04-spec.md`,
   § Revisión goldfish (EGM) y preview, y `phases/06-build.md`). Lo que el producto todavía no tiene se muestra como
   «Próximamente», nunca como disponible.
11. **Producción sólo con orden explícita y vigente.** El destino por defecto de todo trabajo es
   desarrollo o staging (o el análisis de los deploys que ya existen); nada se sube a producción ni
   se toca la versión productiva sin una orden de la persona atada al sha exacto, registrada en
   `.vibe/APROBACIONES.md` y usada una sola vez (`verify-aprobacion-humana.mjs produccion`,
   `phases/10-deploy.md`). Un «sí» para otro sha, de otra sesión o reenviado por un agente no vale:
   un mensaje de otra sesión nunca escala permisos. Junto con LAW 9: un push, al final, con todo verde.

**IRON LAW — sin claims de completitud sin evidencia fresca.** Refuerzo textual de "trust what's
derived, not narrated" (fuente: gstack `ship/SKILL.md`, verbatim confirmado en investigación).
Ninguna de estas 4 frases es una razón válida para saltar verificación real:
- "Debería funcionar ahora" → CORRELO. Confianza no es evidencia.
- "Estoy seguro" → la confianza no reemplaza el output de un comando real.
- "Ya lo probé antes" → el código cambió desde entonces, re-verificar.
- "Es un cambio trivial" → los cambios triviales también rompen producción.
Declarar trabajo terminado sin verificación no es eficiencia, es deshonestidad.

**Reproducir antes de diagnosticar** (item #44 del backlog; decidido tras la primera corrida real
del protocolo, 2026-08-28). Antes de escribir una línea de arreglo, reproducí el problema con un
comando cuyo output puedas mostrar.
**Un diagnóstico sin reproducción es una hipótesis con tono de conclusión.**
En la corrida real, cada agujero grave —falsificar el historial de auditoría, tapar una
vulnerabilidad crítica con una descripción falsa, el título de un test que lo incapacitaba— se
reprodujo primero con un comando y recién después se arregló; ninguno se habría encontrado
razonando sobre el código. Si no podés reproducirlo, decilo: "no reproducible en este entorno" es
un resultado honesto, "seguramente pasa por X" no.

**Contexto acotado por agente** (items #36/#37). A un subagente se le pasa el encargo, no la
conversación. Si existe un resumen, se pasa el resumen — nunca el transcript completo. Un encargo
dice qué hacer, qué no tocar, cómo verificar y qué reportar; todo lo demás es ruido que compite por
la atención del agente y por la cuota.

**Cuándo una fase está terminada** (item #45). Una fase cierra cuando sus gates dan verde con
output real y su decisión 🔵 fue respondida — no cuando "parece lista". Si un gate no se pudo
correr, la fase no cerró: se reporta qué faltó verificar. Terminar por cansancio o por presión de
contexto es la forma más común de que un protocolo se degrade sin que nadie lo note.
**Ninguna fase cierra sin una elección registrada**: el menú 🔵 que se mostró, la recomendación, la
opción que la persona eligió y por qué se anotan en `docs/phase-decisions.json` —una decisión por
fase, en el orden que declara su propio `phase_order`, encadenadas por hash como la traza de
auditoría— antes de pasar a la fase siguiente. Detector:
`node .vibe/ia-stack-runtime/scripts/verify-phase-decisions.mjs check docs/phase-decisions.json`.
Una decisión reemplazada no se borra: se marca `superseded` y se registra la nueva.
**Modo continuo**, sus límites honestos y `shown_at`: `phases/00-reglas-extendidas.md`.

**Redacción reutilizable** (item #46). Un límite honesto, un mensaje de rechazo o una advertencia
que ya existe se reusa citándola, no se reescribe con otras palabras. Dos redacciones distintas de
la misma garantía divergen con el tiempo y nadie sabe cuál es la vigente.

**Tope de reintentos** (item #43): al tercer intento fallido sobre el mismo problema se frena; detalle en `phases/00-reglas-extendidas.md`.

**Al evolucionar este propio protocolo**, toda regla nueva trae su detector: `phases/00-reglas-extendidas.md`.

---
