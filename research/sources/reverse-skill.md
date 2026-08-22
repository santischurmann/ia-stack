# Fuente: zhaoxuya520/reverse-skill

**URL:** https://github.com/zhaoxuya520/reverse-skill
**SHA pineado:** `a3bdfffcf2e6a611a1cbdcc9a312be44527ac043`
**Estado: PARCIAL.** 29/572 archivos leídos (24 ronda 1 + 5 ronda 2, ~5%). Ronda 2 completada tras
1 reintento — el primer intento fue bloqueado por el safeguard de ciberseguridad de Claude (falso
positivo real, contenido era documentación de proceso genérica, no técnica ofensiva; reintentado
con framing explícito de scope + exclusión ampliada de subdirectorios de dominio ofensivo por
nombre, no solo los ya excluidos en ronda 1).

## Qué es

Paquete de skills de pentest/reverse-engineering (572 archivos) — mayormente material de
referencia de dominio de seguridad (cheatsheets Ghidra/IDA/radare2, referencias APK/iOS/firmware/
malware/AD, diccionarios de payload en chino bajo `src-hunter/`, árbol completo de write-ups de
competencia CTF-Sandbox-Orchestrator, extensión Burp MCP en Java). La capa de proceso/meta
(`skills/ops/*`) es la única con overlap real a VCP.

## Manifiesto (ronda 1)

**Leídos (24, ronda 1):** `SKILL.md` de VCP (baseline), docs de nivel raíz (README/RULES/AGENTS/
CLAUDE.md), `skills/ops/*.md` (IDENTITY, scope-contract, evidence-finding-path,
role-map, analysis-decision-framework, analysis-blindspot-cookbook, skill-supply-chain,
sandbox-profile, timeline-workitem), `skills/field-journal/` (anonymization.md,
CONTRIBUTE-BACK.md, _template.md).

**Leídos (5, ronda 2):** `skills/case-review/SKILL.md`, `skills/case-review/scripts/
review_case.py` (script real, no solo el contrato), `skills/digital-forensics/SKILL.md`,
`skills/docs-generator/SKILL.md`, `skills/diagram-generator/SKILL.md`. El agente de ronda 2
excluyó deliberadamente ~20 skills de dominio ofensivo (attack-chain, pwn-chain, edr-bypass-re,
etc.) por nombre, aunque no coincidieran literalmente con la lista de exclusión original — decisión
conservadora documentada, no automática.

**Excluido (razón):** ~500 archivos de técnica de dominio (Ghidra/IDA/APK/firmware/malware/AD/
wifi/OT — contenido de dominio de seguridad, no mecánica TDD/build/commit-gate), todo
`CTF-Sandbox-Orchestrator/*` (configs de competencia), `burp-mcp-full/*` (build Java/Gradle),
`kali/*` (scripts de bootstrap), `examples/`, `reports/`, `docs/reviews/` (logs de PR), la mayoría
de `skills/*/references/*.md` (checklists de dominio). Decisión explícita: no forzar overlap
metodológico sobre contenido que es sustantivamente de dominio.

## Candidatos (evidencia real, verificados ronda 1)

1. **Auditor de grafo de evidencia de solo lectura** — `skills/ops/evidence-finding-path.md:312-
   318`. Camina el grafo Evidence→Finding→Path chequeando integridad referencial y fijeza de
   hash. **Score inicial: 6.**
2. **Trigger de "deadlock" — replan obligatorio tras N acciones sin evidencia nueva** —
   `skills/ops/analysis-decision-framework.md:489-491`. **Score inicial: 6.**
3. **Barra de suficiencia de evidencia — 2 fuentes independientes para "validado"** —
   **CITA CORREGIDA en auditoría FASE 0**: la cita original (`:455-463`) era falsa — el archivo
   tiene solo 153 líneas. Ubicación real: `skills/ops/analysis-decision-framework.md:52`
   ("validated: SHOULD >=2 independent Evidence... single Evidence MUST NOT silently promote").
   **Score verificado adversarialmente: 3, veredicto PENDIENTE_DE_EVIDENCIA** en la primera
   revisión (por la cita falsa), **re-verificado con la cita correcta**: aplicable pero
   estructuralmente pesado para el ciclo TDD de VCP — el 4R de VCP ya funciona como segunda
   fuente independiente para hallazgos tier crítico.
4. **Checklist de auditoría de supply-chain de skills/MCP externos antes de mergear** —
   **CITA CORREGIDA**: original (`:673-682,698-705`) falsa, el archivo tiene 71 líneas.
   Ubicación real: `skills/ops/skill-supply-chain.md:33-42` (sección 3, "安装外部 skill 的 MUST
   清单"). **Score verificado: 5, veredicto PENDIENTE_DE_EVIDENCIA** en la revisión con cita mala,
   contenido real confirmado y sustantivamente aplicable — VCP referencia skills externos
   (`fableultracode`/`cyber-neo`) solo por chequeo de presencia, sin checklist de auditoría.
5. **Binding de content_hash + artifact_path por evidencia** —
   **CITA CORREGIDA**: original (`:293-294`) falsa, el archivo tiene 131 líneas. Ubicación real:
   `skills/ops/evidence-finding-path.md:16-17`. **Score verificado: 2, veredicto
   PENDIENTE_DE_EVIDENCIA** por la cita mala; sustantivamente **YA_CUBIERTO** una vez corregida —
   `verify-receipt.mjs` ya hace fingerprinting sha256 de árbol completo (`SKILL.md:498`), más
   fuerte que el binding por-archivo propuesto.
6. **Linter mecánico de trazabilidad para grafos spec/evidencia** — `skills/case-review/scripts/
   review_case.py:190-397` (`parse_reports`, `build_traceability`, `review_case`). Script stdlib
   puro que recorre archivos Markdown de un caso (scope, timeline, workitems, evidence, report) y
   chequea mecánicamente que cada Finding/Path/workitem/timeline referencie un registro de
   Evidence válido existente — marca referencias a evidencia desconocida, evidencia sin vincular,
   y campos requeridos faltantes como objetos `issue` estructurados (level/code/message/path).
   Sale con código distinto de cero en FAIL. **Score verificado adversarialmente: 6, veredicto
   YA_CUBIERTO** — `verify-receipt.mjs` ya gatea sobre `evidence` no vacío + fingerprint sha256
   (grano de receipt); este linter valida por-finding (grano más fino) — mejora real pero
   incremental, no gap nuevo.
7. **Modelo de estado de 3 niveles (PASS/WARN/FAIL) con escalación en modo estricto** —
   `skills/case-review/scripts/review_case.py:378-380`. Warnings no bloquean por defecto, pero un
   flag `--strict` los promueve a fallas para el pase final de handoff. **Score inicial: 4.**
8. **Verificación de fijeza atada a un par de campos específico (content_hash + artifact_path),
   con guardia de path traversal** — `skills/case-review/scripts/review_case.py:267-283,321-325`.
   **Score inicial: 3.**

**Pendiente de verificación adversarial independiente** — ver workflow `wf_d9e7e4ef-67c`.
