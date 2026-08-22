# Fuente: diegosouzapw/OmniRoute

**URL:** https://github.com/diegosouzapw/OmniRoute
**SHA pineado:** `cbf23772ec2d9842420ff454f599b1a5a2884602`
**Estado: PARCIAL — deliberadamente, y probablemente para siempre.** 21/12445 archivos leídos
(6 ronda 1 + 15 ronda 2, 0.17%). Ronda 2 amplió dentro del territorio de calidad/gobierno ya
identificado como relevante (no intenta cubrir el 99.8% de código de producto restante — ver
razón abajo).

## Qué es

App de producción real (router/gateway LLM): monorepo Next.js/TypeScript de 12.445 archivos
(`src/`, `open-sse/`, `electron/`, `packages/`, `tests/`, docs en 40+ locales). **No es un repo de
metodología** — es un producto con su propia disciplina de calidad (linters, ratchets,
mutation-testing) que resulta ser la parte transferible a VCP.

## Por qué PARCIAL es la respuesta correcta, no un déficit a corregir

Leer 12.445 archivos de un producto de routing LLM no metodológico no serviría al objetivo (mejorar
VCP, un protocolo TDD) — sería trabajo sin retorno. La honestidad exigida acá es: declarar el
scope real (gobierno/calidad, no producto) y no reclamar "exhaustivo" sobre un repo cuyo 99.95%
es lógica de negocio de otro dominio.

## Manifiesto (ronda 1)

**Leídos (6):** `CLAUDE.md`, `AGENTS.md` (single-source-of-truth de reglas de agente),
`docs/architecture/QUALITY_GATES.md`, `eslint.complexity-ratchets.config.mjs`, `knip.json`.

**Excluido (razón):** `skills/` (30+ subdirs — confirmado por listado que son skills de producto
CLI/proxy —routing, api-keys, tunnels—, no metodología de agente como las de VCP), `docs/i18n/*`
(40+ espejos de idioma), `docs/guides/*` y resto de `docs/architecture/*` (specs de features de
producto), `stryker.conf.json` (config de mutation-testing, solo título revisado en ronda 1 —
**ronda 2 lo lee completo**), todo `src/`/`open-sse/`/`electron/`/`tests/` (12k+ archivos, código
de producto explícitamente fuera de alcance).

## Candidatos (evidencia real, verificados ronda 1)

1. **Bans de git cross-session (no stash, no tocar otros worktrees)** — `AGENTS.md:679-694`,
   Hard Rules #19/#22/#23 con fechas de incidente reales citadas. Mandato de copiar el ban textual
   a cada prompt de subagente porque los subagentes no heredan `CLAUDE.md`. **Score inicial: 8.**
2. **Auto-shrink del ratchet con verificador anti-trampa** — `docs/architecture/
   QUALITY_GATES.md:281-327`, con stats de drift medidas. Job de CI que solo baja topes
   automáticamente, verificado por un script que aborta cualquier suba o no-op disfrazado de
   ajuste. **Score inicial: 7.**
3. **Gate anti-alucinación de docs generadas por IA** — `docs/architecture/QUALITY_GATES.md:122-
   134`, `AGENTS.md:317-330`. Grep de paths/comandos/env-vars citados en docs contra el árbol
   real de fuente, falla el build si no matchea. **Score inicial: 6.**
4. **Piso de coverage + distinción de ratchet, exigencia multi-runner** — `AGENTS.md:443-460,
   665-666`. Separa piso absoluto de ratchet sobre baseline previo; exige TODOS los runners
   disjuntos en verde, no solo uno. **Score inicial: 5.**
5. **Etiquetado de "red-base heredado" en PRs contra rama base rota** — `CLAUDE.md:65-70`,
   `AGENTS.md:579-596`. **Score inicial: 4.**
6. **Ban de atribución de IA en commits/PRs** — `AGENTS.md` Hard Rule #16. **Score inicial: 1**
   (política organizacional, sin overlap metodológico real).

**Pendiente de verificación adversarial independiente** — ver workflow `wf_d9e7e4ef-67c` en curso.
