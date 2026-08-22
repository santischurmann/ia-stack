# Fuente: JuliusBrussee/caveman

**URL:** https://github.com/JuliusBrussee/caveman
**SHA pineado:** `a42ef766cedef6160407418a359a52939b2d20b9`
**Estado: PARCIAL.** 19/1416 (corregido, era 1418) archivos leídos (10 ronda 1 + 9 ronda 2, ~1.3%). El 98.7% restante
es código de producto (motor Go de compresión, proxy, extensión de browser, SDKs) confirmado
fuera de alcance por metodología en ambas rondas — no queda territorio de proceso/metodología
sin explorar que valga otra ronda.

## Qué es

Monorepo enorme (~1416 (corregido, era 1418) archivos): producto de compresión/cacheo de tokens para agentes de código.
Motor Go (`engine/`, `proxy/`, `cacheengine/`) para compresión TOON/pixel-atlas y proxy de wire
protocols (OpenAI/Anthropic/Gemini/Bedrock/Azure), extensión de browser, servidor MCP, SDKs
Python/TS, CLI, benchmarks. La metodología de agentes (lo relevante para VCP) vive en una porción
chica: el plugin `cavecrew` (delegación de subagentes) y el modo `caveman` de compresión de
comunicación.

## Manifiesto (ronda 1)

**Leídos (10):** `SKILL.md` de VCP (baseline), `plugins/caveman/skills/cavecrew/SKILL.md`,
`agents/cavecrew-investigator.md`, `agents/cavecrew-builder.md`, `agents/cavecrew-reviewer.md`,
SKILL.md principal del modo `caveman` (reglas de terseness), `packages/subagent-tax/METHOD.md`,
`docs/technical/context-recovery.md`.

**Excluido explícitamente (razón):** `engine/` completo (motor Go de compresión — señal/
serialización, no metodología), `proxy/` (gateway HTTP — infra), `cacheengine/` (simulación de
cache-hit-rate), `browse/`/`extension/` (extensión Chrome + automatización CDP), `mcp/`/`mem/`
(servidores — infra), `packages/sdk/*`/`agent/*`/`cli/*`/`kit/*`/`mastra/*`/`pi-extension/*`/
`graders/*` (plumbing de SDK, no contenido TDD), fixtures binarios, lockfiles, mayoría de
`docs/technical/*.md` (referencia de arquitectura del producto de compresión).

## Candidatos (evidencia real, verificados ronda 1)

1. **Contratos de output grep-ables por rol de subagente** — `plugins/caveman/skills/cavecrew/
   SKILL.md:34-58`, `agents/cavecrew-investigator.md:18-28`, `agents/cavecrew-builder.md:28-34`,
   `agents/cavecrew-reviewer.md:23-33`. Cada subagente tiene un formato de salida obligatorio,
   parseable por grep (ej. investigator devuelve `path:line — \`symbol\` — note` + footer
   `totals:`; builder devuelve línea `verified: <re-read OK | mismatch @ path:line>` o uno de 4
   tokens de rechazo exactos). **Score inicial: 6.**
2. **Refusal duro por cantidad de archivos, con token exacto** — `agents/cavecrew-builder.md:14-
   19,38-43`. Refusal mecánico ante 3+ archivos, sin `Bash` disponible (no puede sortear la
   restricción), token terminal `too-big. split: <n tareas>.`. **Score inicial: 5.**
3. **`model:haiku` pineado en roles baratos/read-only** — `agents/cavecrew-investigator.md:9`,
   `agents/cavecrew-reviewer.md:9`. **Score inicial: 4.**
4. **Auto-verificación releída del builder, dentro de su propio flujo** — `agents/cavecrew-
   builder.md:21-26`. Re-lee el archivo tras editar, reporta pass/fail antes de devolver control.
   **Score inicial: 2** (subsumido por GREEN/REFACTOR de VCP que verifican vía suite completa).
5. **CCR — handle de recuperación de contexto comprimido** — `docs/technical/context-
   recovery.md:1-46`. **Score inicial: 0** — no aplica, VCP no comprime `.vibe/`.

## Ronda 2 — candidatos nuevos

**Leídos (9 adicionales):** `docs/technical/architecture.md`, `sdks-and-packages.md`,
`toon-and-pixel.md`, `packages/graders/AGENTS.md`, `packages/graders/CLAUDE.md`,
`packages/mastra/README.md`, y los 3 `agents/cavecrew-*.md` releídos en su ubicación real
(`plugins/caveman/agents/`, no `plugins/caveman/skills/cavecrew/agents/` como se asumió en ronda
1). Confirmado: no existe `METHOD.md`/`CONVENTIONS.md` a nivel raíz.

6. **Rama default fail-closed como invariante duro, con test por nombre** —
   `packages/graders/AGENTS.md:49` ("la rama `default` ... devuelve `fail(...)`, nunca
   `pass()`. Nunca cambiar esto"). **Score inicial: 5.** Aplicable: convención de "nunca cambiar
   esto" + comentario de por-qué para cualquier dispatch/switch en los gates de VCP.
7. **Tests de paridad cross-language vía un único fixture JSON compartido** —
   `packages/graders/AGENTS.md:11-13`. **Score inicial: 5.** Directamente aplicable: VCP ya
   mantiene `verify-red.sh`/`.ps1` como par — un fixture JSON de vectores de test compartido en
   vez de casos duplicados a mano por shell cerraría un riesgo real de drift.
8. **Etiquetado de basis de honestidad en output (medido/inferido/verificado/sin precio)** —
   `docs/technical/sdks-and-packages.md:110-112`. **Score inicial: 4.** Refuerza la convención
   `verificado:`/`leído:` ya adoptada en el receipt de VCP — candidato para extenderla a otros
   valores numéricos (`coverage_pct`, risk scores).
9. **Contador de diagnóstico para "formas no mapeadas" como señal explícita no-error** —
   `packages/mastra/README.md:81-85`. **Score inicial: 3.**
10. **Contratos de subagente con formato exacto de string de rechazo, no solo condición** —
    `plugins/caveman/agents/cavecrew-builder.md:38-43`, `cavecrew-investigator.md:34-37`.
    **Score inicial: 4** (refina el candidato #1 de ronda 1, mismo territorio).

**Pendiente de verificación adversarial independiente** (no auto-puntuación) — ver workflow
`wf_d9e7e4ef-67c`.
