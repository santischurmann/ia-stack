# Fuente: obra/superpowers

**URL:** https://github.com/obra/superpowers
**SHA pineado:** `b36e0829c6d0140e93cfef2ca599b1b07d4a7797`
**Estado: PARCIAL.** 55/195 archivos leídos (18 ronda 1 + 9 ronda 2 + 28 ronda 3, ~28%). Ronda 3
cerró la totalidad de `docs/superpowers/plans/`+`specs/` (34 archivos, 28 pendientes leídos
completos). Confirmado por lectura real (no supuesto): el resto son ~40 archivos de tests de la
herramienta propia + manifiestos de plugin cross-runtime, sin overlap metodológico esperado —
territorio agotado para candidatos nuevos de valor.

## Qué es

Framework de skills real para Claude Code (no un producto adyacente como caveman/OmniRoute) —
el más denso en overlap metodológico de los 9 repos de esta ronda. Cubre desarrollo dirigido por
subagentes, debugging sistemático, TDD, revisión de código, escritura de planes, git worktrees,
brainstorming, y meta-guía de cómo escribir skills.

## Manifiesto (ronda 1)

**Leídos (18):** `SKILL.md` de VCP (baseline), `subagent-driven-development/SKILL.md`,
`systematic-debugging/SKILL.md` + 3 sub-docs de técnica, `verification-before-completion/
SKILL.md`, `test-driven-development/SKILL.md`, `requesting-code-review/SKILL.md`,
`receiving-code-review/SKILL.md`, `writing-plans/SKILL.md`, `using-git-worktrees/SKILL.md`,
`finishing-a-development-branch/SKILL.md`, `dispatching-parallel-agents/SKILL.md`,
`brainstorming/SKILL.md`, `writing-skills/SKILL.md`, `using-superpowers/SKILL.md`.

**Excluido (razón):** manifiestos de plugin cross-runtime (`.codex-plugin`, `.cursor-plugin`,
`.devin-plugin`, `.hermes-plugin`, `.kimi-plugin`, `.opencode/`, `.pi/`, `gemini-extension.json` —
mecánica de distribución multi-harness, irrelevante a la metodología TDD de un solo harness de
VCP), ~40 archivos bajo `tests/` (tests de la herramienta propia, no metodología), ~20
`docs/superpowers/plans/`+`specs/` (artefactos históricos de este repo, solo título skimmeado —
**pendiente lectura real en ronda 2**), scripts de implementación (`server.cjs`, `helper.js`,
`task-brief`, etc. — comportamiento ya descrito en el SKILL.md leído), boilerplate/legal.

## Candidatos (evidencia real, verificados ronda 1)

1. **Scan de conflictos pre-vuelo sobre todo el plan** — `subagent-driven-development/
   SKILL.md:162-182`. Tabla explícita de overlap archivo/interfaz entre pares de tareas antes de
   dispatch de la Task 1. **Score inicial: 7.**
2. **Loop de fix con tope de 5 rondas + escalación + adjudicación obligatoria** —
   `subagent-driven-development/SKILL.md:354-429`. Escalación de modelo en rondas 4-5,
   adjudicación terminal obligatoria al llegar al tope. **Score inicial: 7.**
3. **Ledger de resume atado a rango de commit SHA** — `subagent-driven-development/
   SKILL.md:131-154`. **Score inicial: 6.**
4. **Guía "receta positiva vs. lista de prohibiciones" con evidencia A/B medida** —
   `writing-skills/SKILL.md:459-480`. **Score inicial: 6.**
5. **Triage Bounded/Architectural/Spike con ratchet de una sola dirección + gate universal** —
   `brainstorming/SKILL.md:22-73`. **Score inicial: 6.**
6. **Batchear tareas mecánicas del mismo tipo en un solo dispatch** —
   `subagent-driven-development/SKILL.md:223-229`. **Score inicial: 5.**
7. **Heurística de tier de modelo por forma de tarea, con anti-patrón explícito** —
   `subagent-driven-development/SKILL.md:184-219`. **Score inicial: 5.**
8. **Higiene de dispatch — nunca pegar historial acumulado en el prompt del subagente** —
   `subagent-driven-development/SKILL.md:230-233,267-271`. **Score inicial: 5.**
9. **Micro-tests de wording antes de escenario completo, con control sin-guía** —
   `writing-skills/SKILL.md:575-586`. **Score inicial: 4.**
10. **Protocolo de "ruling" — subagente decide en vez de frenar, logueado para auditoría** —
    `subagent-driven-development/SKILL.md:19-31`. **Score inicial: 3 — CONFLICTO explícito con
    LAW 7 de VCP (🔵 siempre bloqueante). No recomendado adoptar la autonomía en sí; la lista de
    4 stop-conditions podría informar qué decisiones VCP ya trata como 🔵-obligatorias.**
11. **Defense-in-depth — validar en cada capa, no solo en el punto de fix** —
    `systematic-debugging/defense-in-depth.md`. **Score inicial: 3.**
12. **Separación reviewer/implementer a nivel orchestrator (no solo subagente)** —
    `subagent-driven-development/SKILL.md:408-409`. **Score inicial: 2** (extensión trivial de un
    punto ya aplicado en la ronda anterior).
13. **Espera basada en condición, anti-flaky** — `systematic-debugging/condition-based-
    waiting.md`. **Score inicial: 2.**

## Ronda 2 — candidatos nuevos

**Leídos (9 adicionales):** `skills/writing-skills/anthropic-best-practices.md`,
`persuasion-principles.md`, `testing-skills-with-subagents.md`, y 5 de
`docs/superpowers/plans/`+`specs/` (hermes-version-bump-wiring, codex-efficiency-fixes,
sdd-fix-loop-redesign-design, strict-cost-sdd-design, positive-instruction-redesign-design,
sdd-task-scoped-review-dispatch-design).

14. **Testear el propio prose/protocolo con RED-GREEN-REFACTOR (escenarios de presión)** —
    `skills/writing-skills/testing-skills-with-subagents.md:7-13,43-56`. Antes de confiar en una
    regla nueva, correr escenarios baseline SIN la regla bajo 3+ presiones combinadas (tiempo/
    costo hundido/autoridad/agotamiento), capturar racionalizaciones verbatim, escribir la regla
    para cerrar exactamente esos loopholes, re-testear. **Score inicial: 6.** Directamente
    aplicable a cómo VCP valida sus propias LAWS antes de shippearlas — método concreto más allá
    de la meta-regla ya existente "toda regla nueva trae su detector".
15. **Clasificación de principios de persuasión para el phrasing de reglas** —
    `skills/writing-skills/persuasion-principles.md:9-133`. Mapea qué principios de Cialdini
    suben medible el compliance de un LLM (33%→72% medido) y prescribe cuáles usar según el tipo
    de instrucción. **Score inicial: 5.**
16. **Doctrina de instrucción positiva vs. prohibición, clasificada empíricamente** —
    `docs/superpowers/specs/2026-06-10-positive-instruction-redesign-design.md:20-33`. Hallazgo
    medido: prohibiciones a nivel de composición empeoran vs. no dar guía; recetas positivas
    ganan con cero varianza. **Score inicial: 6** — el candidato #7 de ronda 1 ("receta positiva
    vs. prohibición") ya cubría esto en general; este agrega el dato empírico específico de que
    algunas prohibiciones SÍ funcionan bien (directivas discretas sin incentivo competidor) —
    refina, no duplica.
17. **Doctrina "abaratar mecánica, nunca criterio" con gates N=5 (no N=1) obligatorios** —
    `docs/superpowers/specs/2026-06-10-strict-cost-sdd-design.md:1-52,203-224`. Medido: revisores
    en modelo barato fallaron 0/10 defectos plantados en una sola corrida. **Score inicial: 6.**
    Aplicable directo: VCP permite bajar tier de modelo por fase sin doctrina explícita de qué
    NUNCA se puede abaratar (juicio de severidad de TRIANGULATE/4R).
18. **Loop de fix acotado con ledger de adjudicación obligatoria** —
    `docs/superpowers/specs/2026-07-15-sdd-fix-loop-redesign-design.md:12-45,82-97,130-146`.
    **Score inicial: 6** (mismo mecanismo que el candidato #3 de ronda 1, con detalle adicional:
    "silent discards are forbidden" — cada hallazgo se adjudica a uno de 3 buckets explícitos).
19. **Presupuesto de revisión acotado por diff — nunca crawlear el repo sin nombrar un riesgo
    concreto** — `docs/superpowers/specs/2026-06-09-sdd-task-scoped-review-dispatch-design.md:
    113-134`. Medido: 7/8 revisores de calidad en sesiones reales corrieron grep repo-wide sin
    necesidad. **Score inicial: 5.**

## Ronda 3 — candidatos nuevos (28/28 archivos de plans/specs restantes, completo)

20. **Presupuesto de revisión acotado por diff, con canal de veredicto "no puedo verificar desde
    el diff"** — `docs/superpowers/plans/2026-06-09-sdd-task-scoped-review-dispatch.md`. Extiende
    el candidato #19 de ronda 2 con un 3er canal de veredicto (⚠️, distinto de ✅/❌) que el
    controller resuelve con contexto cross-task que el reviewer no tiene. **Score inicial: 5**
    (mismo territorio que #19/#21 ya verificados YA_CUBIERTO — probablemente mismo veredicto).
21. **Loop de fix de 5 rondas con resume-vs-implementador-fresco + adjudicación obligatoria, nunca
    descarte silencioso** — `docs/superpowers/plans/2026-07-15-sdd-fix-loop-redesign.md`. Formaliza
    el mecanismo ya visto (candidato #3 ronda 1/#18 ronda 2): rondas 1-3 resume mismo implementador,
    rondas 4-5 implementador fresco en modelo más capaz, ronda 5 adjudicación obligatoria por
    hallazgo (aparcar con razón escrita, o parar y escalar a humano si es load-bearing). **Score
    inicial: 6** (refina, mismo territorio que candidatos ya verificados VALIDADO/parcial).
22. **Identidad estructural, no prosa, para evitar colisión de estado durable entre planes** —
    `docs/superpowers/specs/2026-07-06-sdd-plan-scoped-workspace.md`. Bug real de producción:
    ledger compartido (`.superpowers/sdd/progress.md`) colisionaba entre planes sucesivos en el
    mismo worktree (68 archivos acumulados, briefs sobreescritos en silencio). Fix: identidad
    estructural (`.superpowers/sdd/<plan-slug>/`), no depender de "confiar en el ledger" como
    instrucción de prosa. Metodología notable aparte: corrieron un RED baseline esperando que los
    agentes adoptaran ciegamente estado viejo, encontraron que los agentes se autodefendían por
    forense (25/25 rechazaron), y **reportaron eso honestamente** en vez de forzar la hipótesis de
    falla — shippearon el fix por higiene estructural, no por una tasa de error fabricada. **Score
    inicial: 6.** Aplicable directo: `.vibe/SESSION.md`/`.vibe/receipts/` de VCP son archivos
    compartidos por proyecto, no por-feature/por-plan — mismo riesgo de colisión si 2 features se
    trabajan en el mismo repo entre sesiones. Principio "la identidad debe ser estructural, no
    reforzada por prosa" es un buen candidato a LAW futura.

**Pendiente de verificación adversarial independiente** — candidatos 20-22 (ronda 3, nunca
verificados). Candidatos 1-19 (rondas 1-2): 8 verificados adversarialmente con score corregido
(#1,#2,#6 con nota de solapamiento), 11 restantes verificados en la segunda pasada (ver
`multi-repo-2026-08-21.md` tabla consolidada).
