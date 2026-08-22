# Fuente: mattpocock/skills

**URL:** https://github.com/mattpocock/skills
**SHA pineado:** `0ab1b63a410a03d3627979a109c8695de27af954`
**Estado: PARCIAL — pero cerca de exhaustiva para lo que importa.** 104/159 archivos leídos
(~65%). El workflow original falló acá con error `StructuredOutput retry cap exceeded` —
reintentado con un agente aparte sin schema JSON estricto (formato de texto plano), que sí
completó.

## Qué es

Colección curada personal de ~24 skills "prompt-only" para Claude Code/Codex (sin runtime propio,
sin harness de test) — cubre un flujo de ingeniería idea-a-ship (grill→spec→tickets→implement/
tdd→code-review) más herramientas standalone (diagnóstico de bugs, resolución de merge conflicts,
revisión de arquitectura, wayfinding para esfuerzos grandes) y un bucket de productividad
(entrevistas, handoff, enseñanza).

## Manifiesto

**Leídos (104):** 18 skills de `skills/engineering/` (ask-matt, code-review, codebase-design,
diagnosing-bugs, domain-modeling, grill-with-docs, implement, improve-codebase-architecture,
prototype [parcial], research, resolving-merge-conflicts, setup-matt-pocock-skills, tdd,
to-spec, to-tickets, triage, wayfinder, wizard), 7 de `skills/productivity/` (grill-me, grilling,
handoff, teach [parcial], to-questionnaire, wait-what, writing-for-agents), 4 de `skills/misc/`
(git-guardrails, migrate-to-shoehorn, scaffold-exercises, setup-pre-commit), gobierno del repo
(`.agents/`, `.changeset/`, `.out-of-scope/`, `.claude-plugin/`, `CLAUDE.md`, `CONTEXT.md`,
`AGENTS.md`, `README.md`/`CHANGELOG.md` parcial).

**Excluido (razón):** 48 páginas en `docs/` (casi-duplicados de cada SKILL.md, escritos para un
sitio web humano, no para consumo de agente), 14 archivos en `skills/in-progress/*` (beta/
inconcluso explícito), `package.json`/lockfiles/scripts de release de plugin, `prototype/UI.md`.

## Candidatos (evidencia real, auto-puntuados con la misma rúbrica 0-10)

1. **Árbol de decisión de frontera-de-fase (Continue/clear/handoff/subagente/compact)** —
   `skills/engineering/ask-matt/PHASE-BOUNDARIES.md:1-82`. 5 preguntas ordenadas para decidir en
   el límite entre chunks de trabajo, en torno a pérdida de información primaria vs. secundaria.
   **Score inicial: 6.**
2. **Disciplina de glosario de dominio (CONTEXT.md + gate de 3 condiciones simultáneas para ADR)**
   — `skills/engineering/domain-modeling/SKILL.md:1-59`, `ADR-FORMAT.md:1-27`, `CONTEXT-
   FORMAT.md:1-40`. **Score inicial: 6.**
3. **"Design It Twice" — generación paralela de interfaces radicalmente distintas** —
   `skills/engineering/codebase-design/DESIGN-IT-TWICE.md:1-52`, `DEEPENING.md:1-50`. 3+
   subagentes en paralelo, cada uno forzado a producir una interfaz de módulo maximalmente
   distinta bajo una restricción propia. **Score inicial: 6.**
4. **Disciplina "loop de feedback ajustado primero" para diagnosticar bugs, con barra de
   completitud explícita** — `skills/engineering/diagnosing-bugs/SKILL.md` (Fase 1 + checklist
   de completitud: repro red-capable/determinístico/rápido/corrible sin supervisión). **Score
   inicial: 5.**
5. **Generación de hipótesis falsables rankeadas, mostradas al usuario antes de instrumentar** —
   `skills/engineering/diagnosing-bugs/SKILL.md` (Fase 3, 3-5 hipótesis "si X entonces Y").
   **Score inicial: 4.**
6. **Redacción obligatoria de secretos en output/artefactos mostrados** —
   `skills/engineering/diagnosing-bugs/SKILL.md` (sección Redact). **Score inicial: 5.**
   Aplicable directo: el `evidence` del receipt de VCP cita output de comando verbatim en un
   JSON committeado — sin regla de redacción, un secreto en un output de debug se commitea vía
   4.5/4.6.
7. **Meta-disciplina de escritura para agentes (jerarquía de info, "leading words", test de poda
   de no-ops)** — `skills/productivity/writing-for-agents/SKILL.md:1-307`. **Score inicial: 5.**
   Aplicable a cómo VCP audita su propio SKILL.md (~620 líneas siempre cargadas).
8. **Revisión de código en 2 ejes (Standards vs. Spec) en paralelo, reportados sin mergear** —
   `skills/engineering/code-review/SKILL.md`. **Score inicial: 2** — subsumido en gran parte por
   el 4R de VCP (Risk/Readability/Reliability/Resilience) + `spec_coverage` por AC.
9. **Wayfinder — tickets de decisión / mapa de "niebla de guerra" para esfuerzos multi-sesión
   enormes** — `skills/engineering/wayfinder/SKILL.md:1-120`. **Score inicial: 4.**

**Pendiente de verificación adversarial independiente** — ver workflow `wf_d9e7e4ef-67c`.
