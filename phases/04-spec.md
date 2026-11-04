## PHASE 3 — SPEC

**FORCING QUESTIONS** (una por vez, esperar respuesta antes de la siguiente). **Excepción nombrada
a LAW 7 y por eso sin 🔵**: son texto libre a propósito, porque son una entrevista para levantar
información, no una decisión de protocolo. Lo que LAW 7 prohíbe es cerrar una fase con una pregunta
abierta; esto no cierra nada.
```
1. Necesidad — ¿qué se rompe, cuesta tiempo o bloquea HOY sin esto? (no "estaría bueno")
2. Status quo — ¿cuál es el workaround actual y qué cuesta (tiempo/errores/horas)?
3. Slice mínimo — ¿cuál es el AC más chico que prueba que esto funciona, antes del scope completo?
4. Evidencia vs. supuesto — ¿esto sale de un bug/falla observada, o es una suposición?
5. Non-goal — ¿qué NO vas a construir en esta vuelta, a propósito?
6. Reversibilidad — si sale mal, ¿cuánto cuesta deshacerlo?
```
Respuesta vaga/genérica en 1, 3 o 4 → repreguntar UNA vez pidiendo specifics. Escape hatch
objetivo (contable, nunca "se siente impaciente"): 2 preguntas distintas quedan sin respuesta
sustantiva tras su respectiva repregunta → cortar ahí, generar spec con lo que hay, anotar
`Forcing Questions: N/6 (resto: skipped(count))` en `.vibe/SESSION.md`. Respuestas a 5 y 6
alimentan directo las secciones Non-Goals/Constraints del spec — no las repreguntes ahí.

**Pase de profundidad** (sólo con riesgo `alto` o `critico`; lo contesta el agente, no la persona).
Viene de Felix Rieseberg, «How to be more ambitious» (13-10-2026): pedirle a un modelo que actúe
como profesional cambia el vocabulario y no el método, y un trabajo hondo arranca del material
crudo y se juzga desde afuera. Antes de escribir los criterios, el agente responde dos cosas:

- **Material crudo**: ¿de qué dato sin digerir arrancaría el mejor profesional del campo? Logs,
  filas reales, el reporte de la falla, la salida del sistema, nunca un resumen. Ese material entra
  como fixture de por lo menos una prueba.
- **Juez externo**: ¿qué —que no sea el agente ni la persona— demostraría que el resultado está
  bien? Un comando, una herramienta, un dato real. Va como `Verify` de por lo menos un criterio.

Es más hondo, no más grande: lo que aparezca como trabajo nuevo va a un 🔵 como cambio de alcance y
nunca entra solo. Y si una meta parece imposible, se escribe qué faltaría para alcanzarla en vez de
rebajarla en silencio.

🔵 **SPEC CONFIG** (una vez, dos preguntas — no son dos opciones de la misma pregunta):

**1. ¿Cuánto detalle?**

- **A)** Estándar — criterios de aceptación + restricciones + non-goals — *(recomendado)*
- **B)** Mínimo — sólo criterios de aceptación
- **C)** Exhaustivo — agrega notas de riesgo

**2. ¿Incluir la sección de non-goals?**

- **A)** Sí — deja escrito qué NO se construye en esta vuelta — *(recomendado)*
- **B)** No

Esperando tu respuesta antes de continuar.

Generate `docs/spec.md` — template: `skills/spec-plan-templates.md`.

Antes de ofrecer la revisión de contenido, se busca `[NEEDS CLARIFICATION:` en el borrador.
Cualquier coincidencia bloquea la aprobación y el pase a Plan o Build: se le presenta cada pregunta
exacta a la persona, se resuelve en la spec, y se vuelve a chequear. **Nunca se traduce en silencio
una ambigüedad a un criterio de aceptación adivinado.**

**Tope de palabras, mecánico y no sólo una nota en la plantilla** (el tope estaba documentado en
`templates/spec.md` since an earlier hardening round but never enforced; a spec nobody reads
envenena todas las fases que siguen; ver `research/sources/protocolo-muralla.md` punto #8):
```bash
node .vibe/ia-stack-runtime/scripts/verify-spec-wordcap.mjs check docs/spec.md
```
Sale 0 sólo si la spec tiene 650 palabras o menos, **sin contar** bloques de código ni filas de
tabla (la misma exclusión que la plantilla ya declara). Si sale 1, se recorta la narración **antes**
de la revisión de contenido, no después: un borrador que no pasa esto nunca llega al menú de abajo.

Antes de aprobar la spec, corré también el chequeo estricto de calidad de forma:
```bash
node .vibe/ia-stack-runtime/scripts/verify-spec-wordcap.mjs check docs/spec.md --quality
```
Ese modo exige las secciones canónicas, al menos un AC único con gramática
`GIVEN … WHEN … THEN` o `THE SYSTEM SHALL`, y rechaza placeholders o preguntas
`[NEEDS CLARIFICATION:]`. Verifica forma, no suficiencia semántica del producto.

**No acota el largo del documento: una spec entera en tablas o código pasa.** El tope cuenta narración, que es lo que nadie lee cuando sobra; una spec de diez mil palabras escrita toda en tablas cumple el gate.

**Antes de este menú corre § Revisión goldfish (EGM) y preview** (abajo) cuando aplica: la revisión goldfish y el preview
aprobado. La persona aprueba una spec que ya sobrevivió a lectores sin contexto, no un borrador.

🔵 **Revisión de la spec**

- **A)** Aprobada — seguir a Plan — *(recomendado si los gates están en verde)*
- **B)** Modificar — [decime qué]
- **C)** Cancelar

Esperando tu respuesta antes de continuar.

`.vibe/SESSION.md` += what/why specced + resumen de Forcing Questions.

### Revisión goldfish (EGM) y preview

Viene del Elephant-Goldfish Model de Google (EGM, Apache 2.0, instalado como plugin `egm@egm`). El
**Elefante** es esta sesión: tiene todo el contexto y redacta. Los **goldfish** son subagentes
**nuevos**, sin la conversación, que leen sólo el documento y los archivos que se les pasan, y buscan
lo que el Elefante ya no ve: supuestos sin decir, términos sin definir, decisiones que el plan le deja
al implementador. La herida: el 04-11-2026 el plan de la landing de Grobit parecía completo para la
sesión que lo escribió, y siete revisores sin contexto encontraron Blockers (testimonios inventados,
funciones que el producto no tiene presentadas como disponibles).

**Cuándo corre.** En toda spec o plan de riesgo `medio` o más, en toda funcionalidad que tome una
decisión de diseño, y en toda pieza de cara al público (landing, anuncio, mail, onboarding).
**Cuándo se saltea**: un arreglo chico con causa reproducida y una sola forma razonable de hacerlo,
un cambio de texto interno, una dependencia que sube de parche. El salteo se anota en
`.vibe/SESSION.md` con su motivo; ante la duda, corre.

**Cómo se invoca en Claude Code** (plugin `egm@egm` 0.1.0; Claude Code 2.1.271 o más nuevo, porque
`omitClaudeMd` es lo que aísla al revisor y una versión anterior no cuenta como goldfish). Las
skills del plugin traen `disable-model-invocation: true`: **las escribe la persona** al empezar el
mensaje (`/egm:egm-brainstorm`, `/egm:egm-draft`, `/egm:egm-review`), y la herramienta `Skill` las
rechaza. Cuando una skill necesita otra (`egm-review-loop` o `egm-resolve` en las etapas 7 y 9), el
Elefante lee su `SKILL.md` en `${CLAUDE_PLUGIN_ROOT}/skills/` y la sigue en el mismo hilo. Los
artefactos (`concepts_brief.md`, `design_draft.md`, los reportes) van al directorio de trabajo, o al
que diga una línea `EGM artifact directory: <ruta>` del CLAUDE.md o AGENTS.md del proyecto; nunca
al scratchpad de la sesión. Los revisores leen su persona y su estándar del caché del plugin: en
corridas sin prompts se autoriza sólo la lectura de sus carpetas `agents/`, `docs/`, `resources/` y
`skills/` (por ejemplo `Read(//c/Users/<vos>/.claude/plugins/cache/egm/egm/*/agents/**)`), nunca la
escritura ni otros plugins. Un revisor que no puede leer su persona frena: no revisó.

**1. Brief y draft (Elefante).** `/egm:egm-brainstorm <idea>` cuando el problema todavía no está claro:
charla con preguntas abiertas hasta un resumen de la hipótesis en 2-3 frases, revisión de la idea
y `concepts_brief.md`. Después `/egm:egm-draft`, que lee ese brief y escribe `design_draft.md`
sección por sección —problema y metas, plan técnico, alternativas, implementación detallada—, con
un resumen y un gate de una sola pregunta (aprobar o pedir cambios) después de cada sección; sin
código de producción, sólo pseudocódigo o esquemas. Ese draft, o la spec, es lo que se revisa. La
salida es siempre un archivo: nada de volcar el borrador en el chat.

**2. Revisión (goldfish).** `/egm:egm-review <doc>` corre cinco etapas **en orden**, y sólo los
revisores de una misma etapa van en paralelo: 5 `egm-zoom-out` sobre el documento entero; 6
`egm-comprehension` (sin estándar ni contexto extra: el autor tiene que ver su paráfrasis); 7
`egm-design` + `egm-structural` + `egm-style` sobre la parte de la funcionalidad; 8 `egm-zoom-out` otra
vez, mirando lo agregado; 9 `egm-implementation-readiness` + `egm-codebase-details` + `egm-style` sobre
el plan detallado. Una **ronda** del registro es una pasada entera por las cinco etapas. Cada
revisor es un `Agent` NUEVO del tipo registrado por el plugin —`egm:egm-zoom-out`, `egm:egm-design`,
etc.—, nunca un fork ni un `SendMessage` a uno anterior; ya viene de sólo lectura
(`Read`, `Grep`, `Glob`) y con `omitClaudeMd: true`. Se le pasa sólo la tarea, la ruta absoluta del
documento, las de su persona y su estándar y la lista `GoldfishContext` explícita: ni la
conversación, ni la memoria, ni otros documentos. No abre URLs: lo externo se guarda como archivo.
El `model` del `Agent` sale del rol `revisor` (`contracts/model-routing.json`), distinto del que
redactó. Los revisores de audiencia no son del plugin: se lanzan como `Agent` nuevo general con su
persona de `skills/egm-panel-audiencia.md`, en la etapa 7.

| Panel | Revisores (nombre del registro) | Cuándo |
|---|---|---|
| Diseño (los 7 de `/egm:egm-review`) | `egm-zoom-out`, `egm-comprehension`, `egm-design`, `egm-structural`, `egm-style`, `egm-implementation-readiness`, `egm-codebase-details` | toda spec y todo plan, y toda pieza pública de riesgo alto |
| Audiencia (`skills/egm-panel-audiencia.md`) | `scroller` (5 s en el celular), `esceptico`, `primerizo`, `comprador` | toda pieza de cara al público: con riesgo alto, junto a los 7 de diseño (11); con riesgo bajo o medio, sólo junto a `egm-design` y `egm-implementation-readiness` (6 por ronda, decisión del operador del 04-11-2026) |

Cada hallazgo: severidad **Blocker** (no se puede construir así), **Major** (se construiría algo
equivocado o frágil) o **Nit**; alcance (sección o línea) y recomendación. Un revisor que falla o no
devuelve informe se reintenta una vez; si repite, queda «not run» y **la ronda no es limpia**.

**3. Resolve (Elefante + persona).** El `egm-resolve` que dispara la revisión (o `/egm:egm-resolve`), en esta misma sesión: cada hallazgo recibe una
sola categoría —`fixed` (se arregla), `contest` (se refuta con evidencia que el revisor pudo leer),
`riesgo-aceptado` (lo decide la persona), `decline` (sólo un Nit)—. Un hueco de comprensión nunca
se contesta: si un lector fresco no siguió, falta contexto en el documento. Lo que necesita una
decisión humana va como menú 🔵 (LAW 7), uno por decisión:

🔵 **Hallazgo <id> (<severidad>): <una línea>**

- **A)** Aplicar el arreglo propuesto — *(recomendado cuando el hallazgo se verificó contra el documento)*
- **B)** Aceptar el riesgo y dejarlo escrito en la spec
- **C)** Refutar con evidencia — [cuál]

Esperando tu respuesta antes de continuar.

**Convergencia.** Ronda limpia = todo el panel corrió con agentes nuevos y no queda Blocker ni Major
sin asentar (`contest` o `riesgo-aceptado`; un `fixed` lo confirma la ronda siguiente, con goldfish
nuevos y el documento re-escaneado). EGM pide **2 rondas limpias seguidas**, y es lo obligatorio con
riesgo `alto` o `critico` (plata, auth, migraciones, seguridad) y en **toda pieza pública**.
**Alcanza 1** en una spec o un plan de riesgo `bajo` o `medio`, con el motivo escrito en
`motivo_una_ronda`: una ronda de diseño son siete agentes en cinco etapas, y la segunda en un cambio acotado casi
nunca encuentra un Major nuevo (decisión del operador, 04-11-2026).
Tope: 5 rondas; pasado el tope o ante churn, un 🔵 con los abiertos (aceptar y seguir, una ronda
más, volver a redactar). Lo hace el `egm-review-loop` del plugin; las rondas quedan en `docs/egm/<pieza>.json` (schema `ia.egm-rondas/1`):
```bash
node .vibe/ia-stack-runtime/scripts/verify-egm-convergencia.mjs check docs/egm/<pieza>.json
```
**Lo que el gate NO puede hacer:** verifica el registro de las rondas, no que los revisores hayan
sido de verdad agentes sin contexto ni que hayan leído el documento.

**Sin subagentes frescos, EGM frena.** Si el host no puede lanzar un subagente nuevo (sin `Agent`,
sin cupo, o sólo puede hacer fork del contexto), no hay revisión goldfish: una revisión en el mismo
contexto no es una revisión goldfish —así lo dice el propio `egm-review`—. Tampoco cuenta un Claude Code
anterior a la 2.1.271. Se dice así en el reporte, el registro no se escribe y la fase
espera un 🔵: abrir una sesión nueva de Claude Code o Codex sólo con el documento y el brief del
revisor (es lo más cercano a un goldfish), o aceptar el riesgo de construir sin revisión, anotado.

**4. Preview aprobado (LAW 10).** Si la spec trae algo visible, antes del menú de revisión de la spec
se le muestra a la persona el preview —maqueta, artifact, captura o diagrama— y se registra su
respuesta en `.vibe/APROBACIONES.md`, una fila por decisión, sólo se agregan:
`| preview | <pieza> | v<N> | <ruta o URL> | DD-MM-AAAA HH:MM | DD-MM-AAAA HH:MM | <persona> | aprobado |`.
El preview no inventa: ni funciones que el producto no tiene (van marcadas «Próximamente»), ni
testimonios, cifras o logos sin fuente. Si se publica como artifact, el agente lee primero la
versión vigente y la actualiza; nunca pisa la de otra sesión.
```bash
node .vibe/ia-stack-runtime/scripts/verify-aprobacion-humana.mjs preview .vibe/APROBACIONES.md --pieza <pieza>
```
**Lo que el gate NO puede hacer:** verifica lo registrado; no sabe si la persona vio de verdad el
preview, ni si la fila se escribió sin preguntarle.

---
