# Fuente: ayghri/i-have-adhd

**URL:** https://github.com/ayghri/i-have-adhd
**SHA pineado:** `e7555fcaf612dfa1739dc86610ea926a906db614`
**Estado: PARCIAL — corregido.** El repo tiene **57 archivos reales** (no 52 — error de conteo
en ronda 1, corregido acá vía `find` directo sobre el clone). ~45/57 leídos entre ronda 1+2
(con solape entre rondas en al menos SKILL.md/rubric.md/run_evals.py/CONTRIBUTING.md, no
deduplicado con precisión de archivo por archivo). **12 archivos genuinamente sin leer:**
`.github/install/INSTALL.{ja,ko,pt-BR,vi,zh-CN}.md` (5, traducciones del INSTALL.md ya leído),
`.github/readme/README.{ja,ko,pt-BR,vi,zh-CN}.md` (5, traducciones del README.md ya leído),
`LICENSE`, `.gitignore`. De estos, la justificación de exclusión es sólida para las 10
traducciones (mismo contenido que el original ya leído, otro idioma) y para `.gitignore`
(boilerplate), pero **`LICENSE` no fue leído y no está justificado** — corrección: no se puede
declarar EXHAUSTIVA sin revisar LICENSE cuando se reclama cobertura cercana al 100% (regla ya
establecida en el corpus de 13 fuentes originales de este mismo repo). Solo `logo.png` es
binario. **Reclasificado a PARCIAL** — reconciliado con `multi-repo-2026-08-21.md`, que ya tenía
el estado correcto.

## Qué es

Skill orientada a workflow/productividad para ADHD — chico (57 archivos, corregido). Incluye un harness de
evaluación propio (`evals/`) y un `CONTRIBUTING.md` con modelo de disclosure de autoría.

## Manifiesto (ronda 1)

**Leídos (10):** `SKILL.md` de VCP (baseline), `evals/rubric.md`, `evals/cases.jsonl`,
`scripts/run_evals.py`, `CONTRIBUTING.md`, y otros archivos de skill/config sin detalle
granular capturado en esta ronda (agente reportó "See above" en exclusion_reasoning — **defecto
de reporte, no de lectura**; corregir en próxima pasada pidiendo lista explícita).

**Leídos (37, ronda 2):** `skills/i-have-adhd/SKILL.md`, `AGENTS.md`, `CONTRIBUTING.md`,
`GEMINI.md`, `INSTALL.md`, `README.md`, `hooks/hooks.json`, `hooks/always-on.{mjs,ps1,sh}`,
manifiestos de 7 plugins cross-runtime (`.claude-plugin/`, `.agents/`, `.codex-plugin/`,
`gemini-extension.json`, `qwen-extension.json`, `kimi.plugin.json`, `opencode.json`),
`package.json`, `extensions/*.ts`, `.opencode/plugins/*.mjs`, `.opencode/command/*.md`,
`skills/i-have-adhd/agents/{gemini.toml,openai.yaml}`, `.cursor/skills/i-have-adhd/SKILL.md`,
`scripts/{check_context_compat.ts,check_pi_extension.py,run_evals.py}`, `evals/{README.md,
rubric.md,runners.example.json}`, `.github/pull_request_template.md`, 4 workflows de CI, y 5
archivos de test (`test_always_on_hooks.py`, `test_omp_package.py`, `test_opencode_plugin.py`,
`test_run_evals.py`, `opencode_plugin_driver.mjs`). Confirmado: repo de formato de output, no de
orquestación TDD — la mayoría es boilerplate de integración multi-plataforma.

## Candidatos (evidencia real, verificados ronda 1)

1. **Harness de eval ciego pareado con rúbrica pesada y gate numérico de release** —
   `evals/rubric.md:1-21`, `evals/cases.jsonl` (14 casos con id/category/prompt/risk/criteria),
   `scripts/run_evals.py:17-79` (dict `WEIGHTS`, `validate_cases`, tracking de condición
   baseline/candidate/comparator). 14 prompts fijos, juicio ciego (A/B/C, condición oculta),
   5 dimensiones pesadas (correctness 35%, autonomy 25%, actionability 20%, safety 10%,
   concision 10%), gate de release: cero hallazgos bloqueantes + safety/correctness dentro de
   0.1 del baseline + score pesado supera al baseline. **Score inicial: 5.**
2. **Disclosure de autoría/proveniencia explícito en cada contribución** —
   `CONTRIBUTING.md:5-15` (categorías Human-authored / Autonomous agent-authored / Hybrid,
   disclosure de agente+modelo, "no llamar humano-autoreado a trabajo que solo fue revisado por
   el mismo agente que lo produjo"). **Score inicial: 3.**

3. **Suite de tests de paridad conductual cross-platform para un archivo canónico** —
   `tests/test_always_on_hooks.py:23-134` (corre implementaciones node/sh/powershell del mismo
   hook, asserta output normalizado idéntico), `.github/workflows/cursor-skill-sync.yml` (gate
   de byte-diff entre canónica y copia espejo). **Score inicial: 5.** Directamente aplicable: VCP
   mantiene `verify-red.sh` vs `.ps1` como par — este patrón (gate de CI que hace byte-diff +
   tests con fixture compartida) sería una forma concreta de garantizar que ambos scripts se
   mantengan idénticos en comportamiento, en vez de confiar en sync manual.
4. **Edge case de parseo de frontmatter tratado como test de primera clase** —
   `hooks/always-on.sh:21-34`, `tests/test_always_on_hooks.py:116-134` (fence sin cerrar tratado
   deliberadamente como "no es frontmatter", no trunca contenido). **Score inicial: 3.**
5. **Re-inyección de estado a prueba de compactación vía re-escaneo de contexto, no memoria** —
   `extensions/i-have-adhd.ts:90-153`. En vez de confiar en un flag en memoria, re-deriva el
   estado escaneando los mensajes reales de la sesión. **Score inicial: 6.** Paralelo directo a
   la IRON LAW de VCP ("trust what's derived, not narrated") — técnica concreta de implementación
   de ese principio aplicada a estado post-compactación, que el protocolo de resume de VCP
   (basado en SESSION.md) podría adoptar.

**Pendiente de verificación adversarial independiente** — ver workflow `wf_d9e7e4ef-67c`.
