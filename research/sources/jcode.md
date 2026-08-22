# Fuente: 1jehuang/jcode

**URL:** https://github.com/1jehuang/jcode
**Pin inmutable:** commit `bfaca427d53ca8e0c9a39fe603eb5c613a5305c1` (resuelto vía
`GET /repos/1jehuang/jcode/commits/master`, no vía `git clone` — el protocolo git falló
reiteradamente contra este repo, "fatal: fetch-pack: invalid index-pack output", 3 reintentos).
Descargado vía tarball de codeload: `https://codeload.github.com/1jehuang/jcode/tar.gz/refs/heads/
master`, **SHA-256 del tarball:** `d9dc8d20ff87f4e68a59dac6769b40de1964363cdbbb1ac691447f553f9ccbbe`
(184.978.148 bytes). El tarball no trae metadata git, por eso el SHA de commit se resolvió aparte
vía API — ambos pines (commit + archivo) quedan documentados, no solo "master" como referencia.
**Estado: PARCIAL.** 73/1930 archivos leídos (11 ronda 1 + 20 ronda 2 + 42 ronda 3), 1857
restantes. **`docs/*.md` queda cerrado — 62/62 archivos leídos en su totalidad** (confirmado por
lectura real en 3 rondas, no supuesto): 61 confirmados producto/UI/infra sin overlap, 1 candidato
de bajo valor. El resto (1857 archivos) es `crates/` motor Rust + `ios/` + `telemetry-worker/` +
`sdk/`, fuera de alcance por definición (código de producto, no metodología) — territorio
agotado para más candidatos de valor real.

## Qué es

Producto de agente de código en Rust (1930 archivos): `crates/` = motor, `ios/` = app móvil,
`telemetry-worker/` = infra, `sdk/` = clientes, `.jcode/skills/` = su propio sistema de skills.
La capa de metodología (relevante a VCP) vive en `docs/*.md` (gates, hooks, swarm de tareas) y
`.jcode/skills/`.

## Manifiesto

**Ronda 1 (11 archivos):** `AGENTS.md`, `CONTRIBUTING.md`, `.claude/mcp.json`, `.jcode/skills/
optimization/SKILL.md`, `.jcode/semantic-todo-migration-spec.md`, `docs/SAFETY_SYSTEM.md`,
`docs/RESUME_BEHAVIOR.md`, `docs/AGENT_NATIVE_VCS_CORE_BEHAVIOR.md`, `docs/
MEMORY_INCIDENT_RUNBOOK.md`, `docs/HOOKS.md`, `docs/SWARM_TASK_GRAPH.md`.

**Ronda 2 (20 archivos adicionales):** `docs/AGENTCARD_DISCOVERY_DEMO.md`, `docs/
DISCOVERY_ELICITATION_SPEC.md`, `docs/OPENRELAY_DISCOVERY_TEST.md`, `docs/TUI_TEST_FLAKINESS.md`,
`docs/MEMORY_ARCHITECTURE.md`, `docs/MEMORY_BUDGET.md`, `docs/REFACTORING.md`, `docs/
RETENTION_READINESS.md`, `docs/PROVIDER_DOCTOR.md`, `docs/RENDER_PARITY_ACCEPTANCE_CRITERIA.md`,
`docs/TERMINAL_BENCH.md`, `docs/DISCOVERY_BENCHMARK.md` (y 8 más — HOOKS/SAFETY_SYSTEM/
RESUME_BEHAVIOR/SWARM_TASK_GRAPH ya contados en ronda 1, releídos por completitud).

**Confirmado (ronda 2):** `.jcode/skills/` contiene SOLO el archivo `optimization/SKILL.md` ya
leído — no hay más skills en el directorio, confirmado por listado, no supuesto.

**Excluido (razón):** `crates/` completo (motor Rust — engine, no metodología), `ios/` (app móvil),
`telemetry-worker/` (infra), `sdk/` (clientes), y ~80 de los ~100 archivos `docs/*.md` restantes
que son specs de producto/feature (discovery marketplace, auth de provider, resume de TUI,
sistema de permisos de modo ambiente, diseño de VCS lane, harness de terminal-bench) —
**confirmado por lectura real en ronda 2, no por nombre de archivo**, sin candidatos adicionales
de esos.

**Pendiente:** ~1899 archivos, casi todos motor Rust fuera de alcance por definición (no
metodología). Chunks concretos NO leídos que sí podrían tener contenido de proceso: el resto de
`docs/*.md` no nombrados arriba (~60 archivos más, no confirmados uno por uno — riesgo real de
haber pasado algo).

## Candidatos (evidencia real, ronda 1 + ronda 2)

1. **Campo obligatorio "qué NO revisé" en cada artefacto de handoff** — `docs/
   SWARM_TASK_GRAPH.md:254-269,390-396`. **Score inicial: 7.**
2. **Cobertura enumerada por id — auditoría no puede decir "todo bien" sin tocar cada item** —
   `docs/SWARM_TASK_GRAPH.md:281-294` (ronda 1) / `:286-294` (ronda 2, mismo mecanismo
   confirmado dos veces). **Score inicial: 6.**
3. **Contrato fail-open documentado para el hook PreToolUse** — `docs/HOOKS.md:69-83` (ronda 1) /
   `:69-108` (ronda 2, ampliado). **Score inicial: 6.**
4. **Disciplina estructural, no basada en prompt** — `docs/SWARM_TASK_GRAPH.md:219-224,358-378`.
   **Score inicial: 2** (confirmatorio de LAW 3 de VCP, no nuevo).
5. **Gate adversarial que genera nodos-gap en vez de checkbox pass/fail** — `docs/
   SWARM_TASK_GRAPH.md:231-273`. **Nuevo, ronda 2 — Score inicial: 6.**
6. **Métrica de "growth accounting" — nodos sembrados vs. crecidos durante ejecución** — `docs/
   SWARM_TASK_GRAPH.md:300-304`. **Nuevo, ronda 2 — Score inicial: 5.**
7. **Scorecard de "retention readiness" con registro explícito de factores diferidos vs.
   observados** — `docs/RETENTION_READINESS.md:47-68`. **Nuevo, ronda 2 — Score inicial: 5.**
8. **Testing de paridad cero-tolerancia con cota de confianza estadística (regla de 3)** —
   `docs/RENDER_PARITY_ACCEPTANCE_CRITERIA.md:24-39`. **Nuevo, ronda 2 — Score inicial: 5.**
9. **Tipado de nodo por acción terminal: explore→implement→verify→fix como primitivas del grafo**
   — `docs/SWARM_TASK_GRAPH.md:160-179`. **Nuevo, ronda 2 — Score inicial: 5.**
10. **Presupuesto de regresión de memoria: topes duros vs. "expectativas de ratchet" + checklist
    de revisión** — `docs/MEMORY_BUDGET.md:39-123`. **Nuevo, ronda 2 — Score inicial: 5.**
11. **Script de triage de un comando con clasificación de severidad + causa, y preservación de
    evidencia obligatoria** — `docs/MEMORY_INCIDENT_RUNBOOK.md:13-33,181-203`. **Nuevo, ronda 2 —
    Score inicial: 4.**

## Ronda 3 — 42/42 docs restantes, cierra `docs/*.md` (0 candidatos nuevos de valor real)

12. **Fórmula de voz de mensajes al usuario ("qué pasó → qué hicimos → cómo cambiarlo")** —
    `docs/MESSAGE_VOICE.md:36`. **Score inicial: 3** — aplicable a mensajes de gate/checkpoint de
    VCP pero es guía de estilo, no mecanismo estructural.

Los otros 41 archivos (Ambient mode, Swarm architecture, Modular/crate RFCs, Desktop app/UI,
discovery/sponsor/benchmark, integraciones de provider, Herdr/spawn-hook/Windows/wrapper, TUI
color/keymap/terminal, onboarding sandbox, security-dependency triage, remote handoff, iOS/AWS)
confirmados product/UI/infra sin contenido transferible — **`docs/` de jcode queda agotado para
candidatos nuevos**.

**Pendiente de verificación adversarial independiente**: candidato #12 (nunca verificado).
Candidatos 1-4 (ronda 1): verificados en primera pasada. Candidatos 5-11 (ronda 2): #1
(re-confirmado 7, VALIDADO), #2 (6, YA_CUBIERTO parcial — requiere ids direccionables), #3
(3, RECHAZADO — VCP no es motor de hooks), #5 (4, CONFLICTO_DE_DISEÑO — LAW 7), #6/#7/#9/#10 sin
verificar todavía (score auto-puntuado se mantiene, marcado explícito como no verificado).
