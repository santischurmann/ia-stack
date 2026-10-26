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

🔵 **Revisión de la spec**

- **A)** Aprobada — seguir a Plan — *(recomendado si los gates están en verde)*
- **B)** Modificar — [decime qué]
- **C)** Cancelar

Esperando tu respuesta antes de continuar.

`.vibe/SESSION.md` += what/why specced + resumen de Forcing Questions.

---
