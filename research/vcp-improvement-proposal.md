# VCP Improvement Proposal — adversarial verification + phase-by-phase brainstorm

Solo propuesta, no implementación — cero cambios a archivos VCP core en este documento. Base:
las 13 fuentes investigadas (`research/source-matrix.md` + `research/sources/*.md`, en curso,
8 aún PARCIAL). Estructura: por cada candidato, refutación adversarial (¿el hallazgo realmente
sostiene lo que dice?) → si sobrevive, se ofrece como opción en el multiple-choice de la fase
que le corresponde. Ningún candidato se recomienda sin decir de qué fuente sale y con qué
evidencia (file:line real, no narrado).

**Regla ya vigente en VCP, verificada esta pasada**: cada una de las 5 fases de `SKILL.md`
(Phase 0-4) ya tiene su propio menú 🔵 CONFIG + 🔵 CONTENT (20 instancias de `🔵` en el archivo,
una por decisión). Esta propuesta sigue ese mismo patrón — no introduce una fase sin
multiple-choice.

---

## Refutación adversarial de candidatos NO adoptados (de los 26 hallazgos consolidados)

### Candidato 1 — Risk Score numérico (cyber-neo: `min(100, critical×25+high×10+medium×3+low×1)`)
**Claim:** una fórmula fija convierte severidad en un número auditable, más objetivo que
`risk_level` bajo/estandar/alto/critico de VCP.
**Refutación:** cyber-neo aplica esto a *hallazgos de seguridad* (Phase 4.3), no al cambio en sí
(Phase 4.2). VCP ya tiene ambos separados — mezclar los dos números perdería la distinción entre
"qué tan riesgoso es el cambio" (4.2, mecánico por evidencia de código) y "qué tan grave es un
hallazgo de seguridad" (4.3, severidad CWE/OWASP). **La fórmula sobrevive la refutación SOLO
para 4.3** (ya tiene severidad ahí, security-baseline.md), no para 4.2. Aplicarla a 4.2
degradaría la lógica actual (evidencia binaria: ¿toca simplify-ignore? ¿sensitive_path?) a un
score continuo que no tiene la misma justificación mecánica.
**Veredicto:** parcialmente válido, acotado a Phase 4.3 únicamente.

### Candidato 2 — Capability-tiering (claude-seo-ai: Tier 0/1/2 según herramientas disponibles)
**Claim:** declarar explícitamente qué nivel de chequeo es posible según herramientas
instaladas, marcar `needs_api`/`needs_tool` en vez de fallar silenciosamente.
**Refutación:** VCP YA implementó una versión de esto — el gate de lint/typecheck de Phase 4.1
(3 salidas: real-gate / BLOCK / N/A-con-evidencia) es funcionalmente un capability-tier de 2
niveles aplicado a UN caso. claude-seo-ai lo generaliza a cualquier chequeo del pipeline.
**Sobrevive la refutación**: el patrón es real y ya demostró valor en un caso; generalizarlo a
Phase 4.3 (Security) y Phase 4.4 (Adversarial) tiene sentido — hoy security-baseline.md es
binario (presente/ausente), no tiene un tercer estado "presente pero degradado" (ej. un linter
de seguridad instalado pero sin reglas configuradas).
**Veredicto:** válido, candidato real para Phase 4.

### Candidato 3 — Quality-gate numérico bloqueante en Spec/Plan (gstack: bloquea spec <7/10)
**Claim:** puntaje de un segundo modelo/reviewer bloquea Phase 1→2 si la spec es floja.
**Refutación:** VCP ya tiene Forcing Questions (Phase 1) como gate cualitativo — 6 preguntas,
escape hatch contable a las 2 repreguntas sin respuesta. Un score numérico de un segundo
reviewer AGREGA una capa distinta (calidad de la spec ya escrita, no de las respuestas del
usuario). No son redundantes — Forcing Questions valida que el usuario dio información real;
quality-gate validaría que el spec.md generado a partir de esas respuestas quedó bien escrito.
**Sobrevive la refutación**, con una objeción real: gstack usa un SEGUNDO modelo (Codex) para
esto — VCP es explícitamente self-contained, no puede depender de un segundo LLM externo. La
versión VCP-compatible sería un self-review checklist mecánico (¿tiene los 6 campos del
template? ¿ACs son testeables, con GIVEN/WHEN/THEN real?), no un score de otro modelo.
**Veredicto:** válido pero requiere adaptación — sin segundo modelo, checklist mecánico en su lugar.

### Candidato 4 — 5 gates fijos de RDD (gentle-ai: post-apply/pre-commit/pre-push/pre-pr/release)
**Claim:** VCP solo tiene 1 gate de receipt (Phase 4.6); gentle-ai valida en 5 puntos distintos
del ciclo de vida de un cambio.
**Refutación:** VCP es un flujo de UNA sesión hasta el commit — no tiene el concepto de "pre-push"
o "release" como eventos separados en el tiempo (el usuario decide push manualmente en el mismo
turno, Phase 4.6 opción B/C). Los 5 gates de gentle-ai tienen sentido en un sistema con CI/CD
real donde push y release ocurren en momentos distintos, potencialmente por personas distintas.
**No sobrevive completo** — pero el subconjunto "pre-push" SÍ aplica: hoy VCP valida el receipt
antes del commit (4.6), pero si el usuario elige "B) git push + open PR" no hay una revalidación
del fingerprint entre el commit y el push (en teoría nada cambia en ese lapso, pero no está
verificado mecánicamente).
**Veredicto:** parcialmente válido — un gate adicional pre-push sería redundante en la práctica
(mismo commit, no debería cambiar) pero cerraría una hipótesis no probada.

### Candidato 5 — Learnings con decay automático (gstack: -1pt/30d, confirmado en esta pasada)
**Claim:** lecciones viejas pierden peso automáticamente, VCP solo tiene un flag manual a 90 días.
**Refutación:** gstack decae un SCORE numérico de aplicabilidad; VCP's LESSONS.md no tiene score,
tiene estado binario active/retired. Decaer algo que no es numérico no tiene un mapeo directo.
**Sobrevive parcialmente**: el *concepto* (algo sin uso reciente pierde prioridad) es válido y
VCP ya lo tiene como flag manual — automatizarlo requeriría trackear "última vez que esta lección
fue relevante" (¿cuándo su Detection signal hizo match?), dato que VCP no está registrando hoy.
**Veredicto:** válido como candidato, pero requiere agregar un campo de tracking nuevo a
LESSONS.md antes de poder automatizar el decay — no es un cambio de una línea.

---

## Brainstorm — candidatos adicionales encontrados en pasadas de chunk más profundas

- **the-architect**: "verify parity sweep" — un chequeo final que compara cada archivo que el
  plan dijo que iba a crear/modificar contra lo que realmente existe en disco, antes de cerrar
  la tarea. VCP no tiene esto explícitamente — Phase 3 confía en que `files_to_create`/
  `files_to_modify` del task se cumplió, pero nadie lo verifica mecánicamente al final.
- **the-architect**: subagentes sin `context: fork` / `disable-model-invocation` en frontmatter
  (hallazgo de claude-anatomy también) — VCP despacha manualmente vía Agent/Task tool en vez de
  declarar aislamiento en el frontmatter del skill file. Esto es una brecha arquitectónica real,
  no solo una idea "nice to have".
- **cyber-neo**: iron-law de constraints repetidos en CADA prompt de subagente (no solo en el
  prompt del orchestrator) — VCP ya hace esto parcialmente (SUBAGENT OUTPUT SCHEMA se repite),
  pero las LAWS del `SKILL.md` no se inyectan literalmente en cada prompt de Task-Engineer/
  Builder/etc.

---

## Presentación fase por fase — multiple choice + recomendación

Como pediste: NADA de esto se implementa sin que elijas. Una decisión por fase.

### Cross-cutting (todas las fases) — hallazgo nuevo, convergencia de 2 fuentes independientes

```
🔵 Candidato: hook PreToolUse que bloquea Write/Edit a paths protegidos ANTES de ejecutar
   (denylist mecánica: .git/, .env*, keys, lockfiles, .ssh/, .aws/, secrets*)
   Hallado independientemente en claude-seo-ai (hooks/hooks.json + guard-write.mjs) Y en
   gstack (investigate/SKILL.md, scope-boundary hook) — dos fuentes no relacionadas llegaron
   al mismo patrón. VCP hoy solo detecta esto DESPUÉS del hecho (security-baseline.md
   categoría 6, diff-grep post-write) — un rol con Write legítimo (Builder/Triangulator)
   podría escribir a un path protegido si una tarea lo lleva ahí, sin bloqueo mecánico previo.
A) Sí, implementar como hook real (si el entorno de ejecución soporta PreToolUse) —
   RECOMENDADO, es el único hallazgo de esta ronda confirmado por 2 fuentes independientes,
   y cierra una brecha real (detección post-hoc vs. prevención)
B) No, mantener solo detección post-hoc — más simple, VCP ya bloquea/revierte si el gate de
   4.3 encuentra el problema
C) Verificar primero si el entorno (Claude Code) expone hooks PreToolUse reales antes de
   comprometerse — si no los expone, esto queda como roadmap bloqueado por plataforma, no por diseño
```

### Phase 1 — SPEC

```
🔵 Candidato: checklist mecánico de calidad de spec (adaptación sin-segundo-modelo de gstack)
A) Sí, agregar checklist post-generación (6 campos presentes + ACs testeables GIVEN/WHEN/THEN) — RECOMENDADO, cierra un gap real sin dependencia externa
B) No, Forcing Questions ya es suficiente gate para Phase 1
C) Más adelante — anotar como candidato en DEBT.md, no ahora
```

### Phase 3 — BUILD

```
🔵 Candidato: "verify parity sweep" al cierre de cada task (the-architect)
A) Sí, agregar step final en subagent-refactor.md o DOCS que compare files_to_create/modify vs disco — RECOMENDADO, gap real detectado en 2 fuentes independientes (the-architect + claude-anatomy señalan aislamiento/verificación débil)
B) No, confiar en TRIANGULATE/REFACTOR ya cubre esto indirectamente
C) Solo para tareas risk_level alto/critico
```

```
🔵 Candidato: declarar context:fork/disable-model-invocation en frontmatter de subagent-*.md
A) Sí, adoptar la taxonomía de claude-anatomy — mejora aislamiento real de contexto
B) No, VCP despacha manualmente vía Agent tool y funciona — cambio de bajo valor marginal
C) Investigar primero si el entorno de ejecución respeta esos frontmatter flags — RECOMENDADO, no asumir compatibilidad sin verificar
```

### Phase 4.1 — VERIFY

```
🔵 Candidato: generalizar el capability-tiering de lint/typecheck a Security (4.3) y Adversarial (4.4)
A) Sí, mismo patrón de 3 salidas (real-gate/BLOCK/N/A-con-evidencia) para cyber-neo y para el 4R reviewer — RECOMENDADO, patrón ya validado con 2 fixtures reales
B) No, Security/Adversarial ya tienen su propio manejo de ausencia (fallback a baseline / nunca 0 reviewers)
C) Solo para Security (4.3), Adversarial (4.4) ya está bien resuelto
```

### Phase 4.2 — RISK CLASSIFICATION

```
🔵 Candidato: Risk Score numérico de cyber-neo aplicado a hallazgos de 4.3 (no al risk_level de 4.2)
A) Sí, agregar `security_score` calculado a partir de los findings de 4.3, además de (no en vez de) risk_level — RECOMENDADO
B) No, Critical/High ya bloquea, un score no cambia la decisión binaria
C) Solo registrar el score en el receipt como metadata, sin que gatee nada
```

### Phase 4.2/4.3 — nuevo: baseline-diff acceptance gate (paperclip P01-P05)

```
🔵 Candidato: separar findings NUEVOS de findings previamente aceptados-con-razón (versionado)
   Hoy el gate de 4.3 es binario: fix-or-log-to-DEBT.md. paperclip's check-migration-safety.ts
   mantiene un baseline de findings aceptados (id/rule/reason) y solo bloquea lo que no está
   en ese baseline, además marca entradas de baseline que quedaron obsoletas.
A) Sí, agregar un `.vibe/SECURITY-BASELINE.json` versionado que registre id/rule/reason por
   finding aceptado, gate solo bloquea findings NO presentes ahí
B) No, el contrato actual (nunca aceptar sin fix o log) es más estricto a propósito — no está
   demostrado que sea un problema real todavía — RECOMENDADO, mantener por ahora
C) Reevaluar si `.vibe/DEBT.md` empieza a acumular findings repetidos entre sesiones (señal de
   que el binario actual genera fricción real)
```

### Phase 4.5/4.6 — RECEIPT / COMMIT

```
🔵 Candidato: re-verificación del fingerprint inmediatamente antes de push (no solo antes de commit)
A) Sí, agregar `verify-receipt.mjs check` también en el momento del push — cierra la hipótesis no probada de gentle-ai
B) No, el mismo commit no debería cambiar entre 4.6 y el push — redundante en la práctica
C) Solo si pasó más de N minutos entre commit y push (heurística de "sesión larga")
```

### Phase 4.3/4.4 — REVISADO tras pasada final de decisión: `slop-diff.ts` es más débil de lo que parecía

```
Refutación final (pasada de decisión, evidencia exacta obtenida): el fingerprint de slop-diff
NO es un hash, es `ruleId|filePath|stripLineNum(evidence)` — solo le saca el número de línea al
string de evidencia con un regex. No es insensible al contexto real: si el código alrededor de
un finding cambia pero el string de evidencia queda byte-idéntico, sigue contando como
"preexistente" — la corrección depende enteramente de que un scanner externo (`slop-scan`, que
VCP no tiene) emita evidencia estable. Además usa un `git worktree` temporal para el diff —
costo operacional no trivial.
🔵 Candidato REVISADO: no portar el mecanismo (frágil, depende de scanner externo que VCP no
   tiene). El PRINCIPIO (no re-litigar hallazgos ya aceptados) sigue siendo válido, pero solo
   vale la pena implementarlo el día que VCP tenga un scanner propio con evidencia estable
   (ej. cyber-neo con IDs de finding estables, no security-baseline.md que es grep ad-hoc).
A) No implementar ahora — RECOMENDADO, el mecanismo real no es tan simple como parecía y la
   base actual de VCP (`security-baseline.md`, grep) no genera evidencia lo bastante estable
B) Implementar una versión mínima igual, aceptando que puede tener falsos negativos/positivos
C) Reevaluar si VCP alguna vez adopta cyber-neo como dependencia permanente (IDs de finding
   estables ya existen ahí: `CN-001` etc.)
```

### Phase 4.3/4.4 — ✅ IMPLEMENTADO (2026-08-17): lista explícita de racionalizaciones prohibidas (gstack IRON LAW, texto verbatim obtenido)

**Estado: elegido A), aplicado.** Ver `SKILL.md` — bloque "IRON LAW — sin claims de completitud
sin evidencia fresca" insertado después de LAW 8, antes del `---` que sigue.

```
Texto exacto de gstack `ship/SKILL.md` Step 16 (pasada final confirmó el verbatim):
"IRON LAW: NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE."
- "Should work now" → RUN IT.
- "I'm confident" → Confidence is not evidence.
- "I already tested earlier" → Code changed since then.
- "It's a trivial change" → Trivial changes break production.
Cierre: "Claiming work is complete without verification is dishonesty, not efficiency."

🔵 Candidato: portar esta lista de 4 frases (traducida/adaptada) junto a "trust what's derived,
   not narrated" en SKILL.md — texto puro, sin lógica nueva, sin dependencias.
A) Sí, agregar la lista — RECOMENDADO, confirmado en 2 pasadas de investigación (hallazgo +
   verificación exacta), costo de implementación mínimo (agregar texto a SKILL.md)
B) No, el principio actual ya es suficientemente claro
C) Agregar la lista solo como guía para el orchestrator, no como gate mecánico (no hay forma de
   detectar automáticamente si el modelo "racionalizó" en su razonamiento interno — esto es
   una convención de comunicación, no un check de código)
```

### Phase 4.6 — REVISADO: comando de recuperación derivado (gentle-ai, mecánica exacta obtenida)

```
Mecánica real de `reviewRunnableCommand` (gentle-ai `review.go:340-355`): es un mapeador de
strings trivial (`"review.recover"` → `"gentle-ai review recover"`). Lo valioso no es la función
en sí — es la DISCIPLINA alrededor: es el ÚNICO lugar autorizado a hacer esa traducción, todos
los argumentos vienen exclusivamente de campos ya congelados del receipt/estado, y si falta un
campo se muestra un placeholder explícito (`<new-lineage-name>`), nunca un valor inventado.
🔵 Candidato REVISADO: VCP no tiene todavía ningún "comando de recuperación sugerido" — no hay
   nada que portar hoy. Lo que sí vale adoptar es la REGLA DE DISEÑO para cuando se agregue:
   "los comandos sugeridos se ensamblan solo desde campos ya verificados del receipt/estado,
   nunca se fabrica un valor — falta el campo, se muestra un placeholder explícito".
A) Adoptar la regla de diseño como principio documentado (sin código nuevo todavía) —
   RECOMENDADO, cero costo de implementación, aplica el día que se agregue la primera feature
   de recuperación sugerida
B) Implementar YA una sugerencia de comando básica en `verify-receipt.mjs` (ej. para "stale
   receipt" sugerir el comando exacto de regeneración) — más trabajo, valor inmediato menor
C) No hacer nada — el mensaje `REJECTED: <razón>` actual ya es preciso
```

### Phase 4.6 — ✅ IMPLEMENTADO (2026-08-17): distinción missing-vs-corrupt receipt

**Estado: elegido A), aplicado.** Ver `SKILL.md` §4.6 — bloque "Ausente vs corrupto — 2
categorías" insertado justo después de "El script imprime la razón exacta del rechazo."
`scripts/verify-receipt.mjs` NO se tocó (solo documentación, per Constraints del spec).

```
gentle-ai `review_facade.go:58-87` distingue "ausente" (archivo no existe → reparable
re-generando) de "corrupto" (existe pero falla el parse O su identidad no matchea el estado
congelado → nunca reparable in-place, requiere receipt nuevo).
Verificación: `verify-receipt.mjs` YA tiene 3 mensajes de error distintos — `receipt not found`
(ausente), `receipt is not valid JSON` (corrupto tipo 1: parse falla), `stale receipt: ...
does not match` (corrupto tipo 2: identidad no matchea). Es decir, este candidato está
MAYORMENTE ya implementado — la pregunta real es si vale la pena unificar/documentar
explícitamente la distinción "ausente vs corrupto" como concepto, no agregar código nuevo.
🔵 Candidato: documentar explícitamente en SKILL.md/vibe-memory.md que estos 3 mensajes
   corresponden a 2 categorías (ausente=reparable regenerando / corrupto=nunca reparar in-place,
   siempre receipt nuevo) — clarifica el comportamiento ya existente, no lo cambia.
A) Sí, agregar 2-3 líneas de documentación aclaratoria — RECOMENDADO, costo casi cero, el
   comportamiento YA es correcto, solo falta que quede explícito para quien lea el código
B) No hace falta, el código ya funciona bien y los 3 mensajes ya son suficientemente claros
```

### `.vibe/LESSONS.md` — ✅ IMPLEMENTADO (2026-08-17): dedup por normalización exacta (engram, confirmado portable)

**Estado: elegido A), aplicado.** Ver `skills/vibe-memory.md` § LESSONS PROTOCOL, paso 3 "Dedup
before proposing" — regla de normalización (minúsculas + colapsar espacios) agregada.

```
engram: `hashNormalized` = SHA-256(lowercase + espacios-colapsados del contenido). Confirmado en
pasada final: es una función pura, sin dependencia de DB/índice — VCP compara contra un
`LESSONS.md` de tamaño humano, así que ni siquiera necesita el hash, solo la regla de comparación.
🔵 Candidato: agregar a `skills/vibe-memory.md` § LESSONS PROTOCOL paso de dedup: "antes de
   comparar una lección candidata contra `LESSONS.md`, normalizar (minúsculas + colapsar
   espacios) tanto la candidata como las existentes antes de la comparación de similitud".
A) Sí, agregar la regla de normalización — RECOMENDADO, cambio de texto puro, cierra un gap
   real (hoy el dedup de VCP no especifica normalización, podría fallar en detectar duplicados
   con diferencias triviales de formato)
B) No, el dedup actual (comparación semántica por el orchestrator) ya maneja variaciones de
   formato sin necesidad de una regla explícita
```

### `.vibe/LESSONS.md` — ✅ IMPLEMENTADO (2026-08-17): pre-chequeo de keywords sensibles antes del 🔵 confirm-gate (engram, confirmado)

**Estado: elegido A), aplicado.** Ver `skills/vibe-memory.md` § LESSONS PROTOCOL — nuevo paso
"Sensitive-content pre-check" entre el paso 3 (dedup) y el paso 4 (confirm gate), con marca
visible `⚠ possible sensitive content` en el template del confirm-gate.

```
engram rechaza (fail-closed, no redacta) metadata de auditoría cuyas keys matchean:
["token", "authorization", "cookie", "secret", "hash", "password", "bearer"]
(verificado en el código real, ubicación exacta: `internal/cloud/cloudstore/identity.go:909-967`
— corregido de una cita anterior con ubicación errónea).
VCP ya tiene una regla equivalente en texto (`skills/vibe-memory.md` § ENGRAM GUARDRAIL: "nunca
pegar código .mq5, lógica de licencia, tokens o passwords") pero es solo una instrucción en
prosa, sin un pre-chequeo mecánico antes de mostrar la lección candidata en el 🔵 confirm-gate.
🔵 Candidato: agregar un grep de esas 7 palabras clave sobre el texto de la lección candidata,
   ANTES de mostrarla en el 🔵 confirm-gate de LESSONS — si hay match, marcar la candidata con
   una advertencia visible (⚠ contiene posible dato sensible) en vez de rechazarla en silencio
   (VCP ya tiene confirmación humana, a diferencia de engram que es fail-closed automático —
   la adaptación correcta es advertir, no bloquear, porque VCP no puede saber con certeza que
   es realmente sensible sin contexto).
A) Sí, agregar el pre-chequeo con advertencia visible — RECOMENDADO, mecánico y barato, refuerza
   una regla que ya existe en texto pero no se verifica automáticamente
B) No, confiar en que el orchestrator ya sigue la regla de texto existente
```

### `.vibe/DEBT.md` — ✅ IMPLEMENTADO (2026-08-17, parcial): schema tipo baseline-diff para findings repetidos (paperclip, schema exacto obtenido)

**Estado: elegido A) parcial — solo el campo `id` corto, no `reason` obligatorio separado (ya
existe como "Why deferred").** Ver `skills/vibe-memory.md` § WRITE FORMATS → DEBT.md entry, y
`templates/vibe/DEBT.md` — título de entrada ahora lleva `` `id:<hash6>` ``.

```
paperclip `migration-safety-baseline.ts` schema exacto de una entrada baseline:
{id: string (sha256, 16 chars), rule: string, migration: string, table: string,
 reason: string (obligatorio)}
El gate separa findings en nuevo/baseline/obsoleto — detecta cuándo una entrada de baseline ya
no corresponde a nada actual (obsoleta) y lo señala.
🔵 Candidato: adaptar el FORMATO (no el motor SQL, que VCP no tiene) — cuando 4.3 loguea un
   finding Medium/Low a `.vibe/DEBT.md`, darle un id corto derivado (hash de
   categoría+ubicación+regla) y un campo `reason` obligatorio (ya existe informalmente como
   "why deferred"). Permite en el futuro detectar cuándo un finding repetido entre sesiones es
   realmente el mismo (mismo id) vs uno nuevo.
A) Sí, agregar el campo `id` corto a las entradas de `DEBT.md` — RECOMENDADO, costo bajo
   (agregar 1 campo al formato existente), sienta la base para detección de duplicados futura
B) No, el formato actual de DEBT.md (fecha+ubicación+severidad+razón) ya es suficiente para
   identificar duplicados manualmente
C) Esperar a tener evidencia real de que DEBT.md acumula duplicados entre sesiones antes de
   cambiar el formato — ya estaba anotado como condición en un candidato anterior, sigue sin
   cumplirse (no hay evidencia de fricción real todavía)
```

### LESSONS.md — decay automático

```
🔵 Candidato: trackear "última vez que el Detection signal de una lección hizo match" para decay automático
A) Sí, agregar campo `last_matched` a LESSONS.md — RECOMENDADO pero requiere trabajo real (no es de una línea)
B) No, el flag manual a 90 días ya cumple el propósito
C) Evaluar después de tener más lecciones reales acumuladas (hoy LESSONS.md está vacío en la mayoría de proyectos VCP)
```

---

## Estado final de la investigación (4 rondas + 1 pasada de decisión, ~30 agentes reales)

**8/13 fuentes cerradas** (7 EXHAUSTIVA: `modo-tdah`, `claude-anatomy`, `the-architect`,
`cyber-neo`, `aprende-skill`, `claude-seo-ai`, `Agent-Reach` + 1 COMPLETO: `video-6ChZMEMJ8hA`).
**5 permanecen PARCIAL** de forma consciente y justificada, no por falta de esfuerzo:
`paperclip` (4.559 archivos), `gstack` (1.183), `gentle-ai` (1.982), `agency-agents` (343,
verdict estable "nada más que encontrar" confirmado en pasada final sobre las 4 divisiones
restantes), `engram` (178 Go, 138 restantes). Una pasada final de decisión (no de cobertura)
verificó los candidatos más fuertes de cada una con mecánica exacta, no aproximada.

**Resumen de veredictos finales por candidato** (RECOMENDADO = A en el multiple-choice
correspondiente arriba):
| Candidato | Fuente | Veredicto final |
|---|---|---|
| IRON LAW — 4 frases prohibidas | gstack | **Adoptar** — texto verbatim confirmado, costo mínimo |
| Dedup por normalización exacta | engram | **Adoptar** — función pura, portable como regla de texto |
| Pre-chequeo keywords sensibles pre-LESSONS | engram | **Adoptar** — mecánico, barato, refuerza regla ya existente |
| Missing-vs-corrupt receipt | gentle-ai | **Ya mayormente implementado** — solo falta documentar la distinción |
| Baseline-diff schema para DEBT.md | paperclip | **Adoptar formato** (id+reason), no el motor SQL |
| PreToolUse write-guard hook | claude-seo-ai + gstack | Fuerte (2 fuentes independientes) — verificar soporte de plataforma primero |
| Capability-tiering generalizado | claude-seo-ai | Válido, extender el patrón ya usado en lint/typecheck |
| Checklist mecánico de spec | gstack (adaptado) | Válido sin segundo modelo |
| Risk Score solo en 4.3 | cyber-neo | Válido, acotado |
| `slop-diff.ts` (bloquear solo findings nuevos) | gstack | **Revisado a NO implementar** — mecanismo más frágil de lo que parecía, depende de scanner externo que VCP no tiene |
| Comando de recuperación derivado | gentle-ai | Adoptar como REGLA DE DISEÑO, sin código nuevo (no hay feature actual a la que aplicarlo) |
| Budget enforcement real | paperclip | Skip — requiere infra que VCP no tiene |
| Re-verificación fingerprint pre-push | gentle-ai | Válido pero redundante en la práctica |
| Decay automático de LESSONS | gstack | Válido pero requiere campo de tracking nuevo, no es trivial |
| agency-agents (formato persona-file) | agency-agents | **Cerrado, sin acción** — verdict estable confirmado en 17/17 divisiones |

Ningún candidato de este documento se implementó todavía — todos esperan tu elección 🔵. Ver
`research/vcp-implementation-spec.md` para el spec+plan de los candidatos con veredicto
**Adoptar** (los de costo bajo/medio, listos para pasar a Phase 3 si los apruebas).
