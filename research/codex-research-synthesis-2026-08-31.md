# Research directo de VibeCodeProtocols — síntesis y mejoras aplicables

## Actualización de evidencia — 2026-08-31 (última ejecución)

La evidencia profunda consolidada pasó de 247 a **397 filas únicas**: Awesome Claude Skills (100),
gstack (25) y Marin (25) se verificaron contra el manifest y los bytes del corpus con
`node research/verify-semantic-deep-evidence.mjs` (exit 0). El ledger estricto no se alteró:
mantiene **14.897 PENDING** porque estos lotes asistidos aún requieren revisión adversarial antes de
promoverse a `READ`. La contabilidad completa del corpus no debe confundirse con comprensión
semántica completa.

Como cobertura adicional, `node research/build-full-evidence-pass.mjs` abrió y hasheó las **14.897
entradas PENDING** (14.365 textuales y 532 binarias/grandes). `node
research/verify-full-evidence-pass.mjs` confirmó la correspondencia 1:1 (exit 0; SHA-256 de la
salida `b0aedfa67143bd0e798a52f3fb2e03a601ea99e2d6efa40d24439a3664f999f4`). Este pase registra
hechos observables y mantiene `strict_status: PENDING`; no se presenta como comprensión semántica
humana.

**Fecha:** 2026-08-31
**Investigador:** Codex (lectura y verificación local; no delegada a Claude)
**Repositorio VCP:** `f2fb9017df6656490c0a61283bec825bcaad2489` en `main`
**Alcance:** 14 fuentes externas fijadas a commits, más el estado actual de VCP.

## 1. Resultado ejecutivo

El corpus externo quedó **contabilizado completo**, pero no quedó **comprendido semánticamente al
100 %**. Se verificaron 15.581 entradas de Git, 15.575 archivos regulares byte-a-byte y 6 symlinks.
Se hizo un índice estructural de todo el material y una lectura funcional directa de los README,
manifiestos, contratos, skills, scripts y tests que sostienen cada patrón. El research histórico
documenta 320 lecturas profundas (2,05 %). Por lo tanto, el estado correcto es:

> **Cobertura del corpus: 100 % enumerada y hasheada; cobertura semántica: parcial y explícita.**

No ejecuto código de los repos externos ni importo sus dependencias. El objetivo es extraer
principios portables, probar si realmente aplican a VCP y rechazar lo que requiere infraestructura
o introduce una falsa garantía.

## 2. Estado de VCP antes del análisis

- `main` local = `origin/main` = `f2fb9017df6656490c0a61283bec825bcaad2489`.
- Árbol limpio antes de generar este informe; los artefactos de investigación nuevos quedan sin
  commit para revisión humana (`corpus-manifest-2026-08-31.json`, `corpus-structural-scan-2026-08-31.json`,
  `research-completion-audit-2026-08-31.md`, `semantic-ledger-2026-08-31.json`,
  `functional-inventory-2026-08-31.json`, `complete-review-index-2026-08-31.json` y sus generadores).
- `verify-backup-state.mjs check` y `verify-research-citations.mjs check` pasan.
- El protocolo ya tiene Discovery antes de Spec, CAIO, mapa de bucle, PRD/planes, decisiones 🔵,
  RED→GREEN→TRIANGULATE→REFACTOR, seguridad, receipt, Graphify/Obsidian y self-improvement.
- Los huecos declarados siguen siendo reales: la trazabilidad comprueba existencia de nombres,
  no suficiencia semántica; Graphify prueba contabilidad, no comprensión; la cobertura instrumental
  cubre Node y líneas de shell Bash, pero no ramas PowerShell, UX conversacional ni intención humana.

## 3. Método reproducible usado por Codex

1. Validé los 14 commits con GitHub REST cuando hubo cuota y con los tarballs fijados cuando la cuota
   se agotó. Los conteos de árboles coinciden con el manifest histórico.
2. Calculé SHA-256, tamaño, tipo, líneas y clasificación para cada archivo regular materializado.
3. Registré symlinks sin dereferenciarlos en Windows; no se ocultaron como archivos leídos.
4. Leí directamente la documentación de entrada y los módulos de control de cada fuente; contrasté
   cada conclusión con el código/configuración correspondiente y con los informes históricos.
5. Para cada propuesta separé **mecanismo observado**, **transferencia a VCP**, **refutación** y
   **condición de adopción**. Un número de líneas o un regex no se presenta como comprensión de una
   función completa.

Artefactos: [manifest completo](<home>/Desktop/Claude/VibeCodeProtocols/research/corpus-manifest-2026-08-31.json),
[índice estructural](<home>/Desktop/Claude/VibeCodeProtocols/research/corpus-structural-scan-2026-08-31.json) y
[auditoría de límites](<home>/Desktop/Claude/VibeCodeProtocols/research/research-completion-audit-2026-08-31.md).

El pase estático completo se reproduce con `research/build-complete-review-index.mjs`: abrió las
15.581 entradas (623.481.290 bytes materializados) y calculó señales deterministas de headings,
definiciones, tests, comandos, claims y riesgos. Cierra la cobertura de lectura de bytes, no la
comprensión semántica; no promociona automáticamente un archivo a `READ`.

Para no perder trabajo de los agentes se consolidó además
`research/semantic-review-index-2026-08-31.json` mediante
`research/consolidate-semantic-review.mjs`. Contiene una fila 1:1 por cada pendiente, con hash,
commit, shard y citas cuando existen. Sus estados `READ_CANDIDATE`, `STATIC_ONLY` y
`REVIEW_REQUIRED` son evidencia de cola, no estados canónicos: todas las filas conservan
`strict_status: PENDING` hasta una revisión funcional adversarial.

En esta ejecución se añadieron 397 lecturas manuales profundas en ocho lotes independientes
(`marin`, `awesome-claude-skills`, `gstack`, `scientific-agent-skills` y `claude-mem`, con lotes
adicionales de marin/awesome/gstack). Sus registros verificables se conservan en
`research/semantic-deep-evidence-2026-08-31.ndjson`; contienen hash, commit, propósito,
interfaces, conducta, salidas, invariantes, tests, riesgos, decisión de relevancia y citas
`file:line`. Es evidencia de esos 100 archivos, no una promoción automática del resto.

El ledger estricto generado en esta fase queda en
[semantic-ledger-2026-08-31.json](<home>/Desktop/Claude/VibeCodeProtocols/research/semantic-ledger-2026-08-31.json)
y se reproduce con [build-semantic-ledger.mjs](<home>/Desktop/Claude/VibeCodeProtocols/research/build-semantic-ledger.mjs).
Su estado actual, tras ampliar el lote funcional a tres módulos adicionales, es **90 READ, 594
EXCLUDED y 14.897 PENDING** sobre 15.581 entradas. Ese
resultado es deliberadamente conservador: `PENDING` no significa que el archivo sea inútil, sino que
todavía no existe una lectura semántica registrada por Codex.

| Fuente | READ | EXCLUDED | PENDING |
|---|---:|---:|---:|
| claude-obsidian | 5 | 4 | 192 |
| awesome-claude-skills | 6 | 56 | 1080 |
| garden-skills | 5 | 2 | 586 |
| ponytail | 6 | 5 | 148 |
| scientific-agent-skills | 7 | 4 | 2435 |
| agent-reach | 9 | 7 | 104 |
| claude-plugins-official | 3 | 12 | 441 |
| gstack | 11 | 14 | 1419 |
| googletest | 3 | 0 | 249 |
| marin | 7 | 69 | 3530 |
| agency-agents | 7 | 0 | 341 |
| ai-engineering-from-scratch | 5 | 324 | 2982 |
| claude-mem | 6 | 29 | 1022 |
| archify | 6 | 68 | 373 |
| **TOTAL** | **90** | **594** | **14.897** |

## 4. Hallazgos por fuente

### Archivos funcionales consultados directamente en esta pasada

La siguiente lista no pretende reemplazar el ledger de 15.581 entradas: identifica el núcleo que
usé para validar cada conclusión, separado de los informes históricos y del barrido mecánico.

- **gstack:** `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `package.json`, `autoplan/SKILL.md.tmpl`,
  `context-save/SKILL.md`, `context-restore/SKILL.md`, `learn/SKILL.md`, `ship/sections/review-army.md`.
- **agency-agents:** `README.md`, `CONTRIBUTING.md`, `scripts/check-divisions.sh`,
  `scripts/check-tools.sh`, `engineering/engineering-multi-agent-systems-architect.md`,
  `testing/testing-reality-checker.md`, `strategy/coordination/handoff-templates.md`.
- **agent-reach:** `README.md`, `CLAUDE.md`, `pyproject.toml`, `agent_reach/core.py`,
  `agent_reach/doctor.py`, `agent_reach/channels/twitter.py`, `agent_reach/channels/youtube.py`,
  `agent_reach/skill/SKILL.md`, `config/mcporter.json`.
- **archify:** `README.md`, `DESIGN.md`, `PRODUCT.md`, `archify/SKILL.md`,
  `archify/bin/archify.mjs`, `archify/brand-marks/README.md` y validadores/renderers asociados.
- **claude-plugins-official:** `README.md`, manifests de `context7`, `github`, `asana`,
  `external_plugins`, además de los validadores de skills del árbol oficial.
- **scientific-agent-skills:** `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `plugin.json`,
  `pyproject.toml`, `skills/autoskill/SKILL.md`, `skills/experimental-design/SKILL.md` y tests de
  estructura/provenance.
- **ponytail:** `README.md`, `AGENTS.md`, `package.json`, `benchmarks/agentic/README.md`,
  `benchmarks/agentic/complete.py`, `benchmarks/agentic/judge.py`, skills y plugins portables.
- **ai-engineering-from-scratch:** `README.md`, `AGENTS.md`, `CHANGELOG.md`, `book/README.md`,
  `phases/`, `skills/`, `scripts/build_book.py` y los outputs reutilizables.
- **garden-skills:** `README.md`, `skills/kb-retriever/SKILL.md`, `skills/beautiful-article/SKILL.md`,
  `skills/web-video-presentation/SKILL.md` y scripts de generación/check.
- **claude-mem:** `README.md`, `CLAUDE.md`, `package.json`, manifests de plugin, hooks de `cowork`,
  `plugin/skills/mem-search/SKILL.md`, worker/search y fixtures de spool.
- **GoogleTest:** `README.md`, `CMakeLists.txt`, `MODULE.bazel`, headers de assertions/death tests,
  discovery y parametrización, y documentación de estados omitidos.
- **claude-obsidian:** `README.md`, `AGENTS.md`, manifests, `skills/save/SKILL.md`,
  `skills/wiki-ingest/SKILL.md`, contratos de provenance/transactions y CLI/checkpoint.
- **Marin:** `README.md`, `AGENTS.md`, `pyproject.toml`, skills de `background-research`, `commit`,
  `debug`, workflows CI, artifact/checkpoint/DAG y selección topológica de tests.
- **awesome-claude-skills:** `README.md`, `skill-creator/SKILL.md`, `content-research-writer`,
  `mcp-builder`, `connect-apps-plugin`, manifests y evaluación del catálogo.

### 1. gstack

**Observado:** roles de producto/arquitectura/diseño/QA/seguridad/release; flujo Office Hours →
plan → build → review → test → ship → retro; `gstack-evidence` registra comando, exit, tiempo y
huellas; `wtree` captura contenido; `learn` conserva aprendizajes.

**Útil para VCP:** interrogatorio inicial, roles con entregables, evidencia de ejecución y retro
con métrica.
**Refutación:** sus guards pueden fallar abierto y sus auto-commits WIP contradicen el receipt de
VCP. Un score LLM 7/10 no es prueba mecánica.
**Veredicto:** adoptar el orden y el formato de evidencia; no copiar auto-commit, segundo modelo ni
promesas de guard universal. Fuente: [gstack](https://github.com/garrytan/gstack).

### 2. agency-agents

**Observado:** perfiles especializados con secciones de misión, entregables, workflow, métricas;
NEXUS usa fan-out/fan-in y handoffs; `check-divisions.sh` y `check-tools.sh` comparan catálogos con
directorios, instalador, conversores y CI.

**Útil:** ledger de delegación, entregables mínimos, catálogo único y revisión que parte de NEEDS
WORK.
**Refutación:** las personalidades no son contratos ejecutables y la instalación multi-host es lo
opuesto al skill único de VCP.
**Veredicto:** adoptar contratos y paridad de catálogo, no 270 personas ni su instalador.
[agency-agents](https://github.com/msitarzewski/agency-agents).

### 3. agent-reach

**Observado:** canales con backends ordenados; el primer backend `ok` gana y un backend instalado
pero no autenticado no bloquea a otro funcional; `doctor` captura errores por canal y muestra el
backend activo; la skill enruta por intención.

**Útil:** capability matrix, fallback ordenado y diagnóstico por componente.
**Refutación:** requiere herramientas externas, logins y egress; copiarlo haría que VCP dependiera
de red.
**Veredicto:** adoptar solo el patrón de fallback y el reporte de capacidades. [agent-reach](https://github.com/Panniantong/agent-reach).

### 4. archify

**Observado:** IR JSON tipado, validación determinista, artefactos auto-contenidos, evidencias con
revisión fijada y comparación Before/Delta/After; la UI separa relaciones authored de inferencias.

**Útil:** snapshots tipados, diff semántico y vistas derivadas reproducibles para Discovery,
CAIO y mapa de bucle.
**Refutación:** dibujar un grafo no prueba que la topología sea verdadera; el propio proyecto limita
reach a relaciones authored.
**Veredicto:** adoptar IR + delta + export determinista; nunca llamar “impacto” a una arista
autora. [archify](https://github.com/tt-a1i/archify).

### 5. claude-plugins-official

**Observado:** manifests, estructura de plugins, nombres inmutables, `displayName` para etiquetas,
`renames` para migración, `strict` y `skills` explícitos, SHA de origen y advertencia de confianza.

**Útil:** instalador VCP con manifest cerrado, identidad inmutable, versión/ref fijados y permisos
visibles.
**Refutación:** el marketplace y plugins remotos agregan cadena de suministro que VCP quiere evitar.

**Veredicto:** adoptar solo el manifest local y la advertencia; no marketplace/MCP remoto.
[claude-plugins-official](https://github.com/anthropics/claude-plugins-official).

### 6. scientific-agent-skills

**Observado:** cada skill tiene documentación, ejemplos, tests y referencias; tests viven fuera de
la skill; contratos de frontmatter cerrados; rechazo de skills amplias/orquestadores genéricos.

**Útil:** `tests/<skill>` separado, frontmatter allowlist, referencias de carga progresiva y prueba
por herramienta.
**Refutación:** sus dependencias científicas no deben entrar en VCP; “skill encontrada” puede ser
solo un anchor de ruta si el test está mal diseñado.
**Veredicto:** adoptar estructura y rechazo fail-closed, no paquetes científicos.
[scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills).

### 7. ponytail

**Observado:** escalera YAGNI → reutilizar → stdlib → plataforma → dependencia → mínimo; benchmark
agentic con brazo baseline; safety tier adversarial; judge separado para overbuilding.

**Útil:** presupuesto de complejidad, baseline comparable y test negativo antes de gastar recursos.

**Refutación:** sus números dependen de modelo, tareas y n pequeño; “menos LOC” no implica mejor
producto.
**Veredicto:** adoptar YAGNI con excepción explícita para seguridad y accesibilidad; no usar sus
números como garantía VCP. [ponytail](https://github.com/DietrichGebert/ponytail).

### 8. ai-engineering-from-scratch

**Observado:** Learn → Build → Use → Ship; 20 fases, lecciones, artefactos reutilizables y scripts
que regeneran índices/libros; declara `n/a` cuando una métrica no existe.

**Útil:** separar aprender de construir, artefacto reutilizable, índices generados y N/A explícito.

**Refutación:** el volumen educativo y sus ejemplos no son un orquestador de producto; un `n/a`
mal consumido vuelve a ser verde vacío.
**Veredicto:** adoptar el ciclo y el N/A que bloquea cierre, no el corpus didáctico.
[ai-engineering-from-scratch](https://github.com/rohitg00/ai-engineering-from-scratch).

### 9. garden-skills

**Observado:** progressive disclosure, checkpoints duros, flujo source → plan → doble confirmación
→ generación → revisión → reparación; retrieval por capas y límites de rondas.

**Útil:** presupuestos de lectura, confirmaciones independientes, revisión por capas y reparación
mínima.
**Refutación:** algunos checks dependen de globs que pueden devolver vacío ambiguo; checkpoints
visuales no prueban verdad del contenido.
**Veredicto:** adoptar límites y checkpoints con denominador; no usar Glob para saber que un
directorio existe. [garden-skills](https://github.com/ConardLi/garden-skills).

### 10. claude-mem

**Observado:** memoria persistente local/worker, búsqueda progresiva, citas, privacidad explícita,
spool ante caída y hooks de captura; fail-soft sin API key.

**Útil:** memoria local-first, operaciones observables, búsqueda en capas, redacción de secretos y
spool recuperable.
**Refutación:** el worker/SQLite/LLM secundario introduce daemon y servicio externo; hooks siempre
exit 0 pueden ocultar pérdida si el consumidor no mira salud.
**Veredicto:** adoptar formato local y alertas de salud; rechazar daemon y cloud.
[claude-mem](https://github.com/thedotmack/claude-mem).

### 11. GoogleTest

**Observado:** descubrimiento automático, assertions ricas, tests parametrizados, death tests y
estados RUN/NOTRUN/SKIPPED separados.

**Útil:** tabla de casos, asserts con mensaje y distinción ejecutado/no-ejecutado.
**Refutación:** aleatorizar el orden no sirve a fases con prerequisitos; death-test portability es
costosa; un test parametrizado no garantiza independencia de fixtures.
**Veredicto:** adoptar matriz y estado explícito, no portar framework C++.
[GoogleTest](https://github.com/google/googletest).

### 12. claude-obsidian

**Observado:** ingest/save separados, raw inmutable, claim/source ledgers, transacciones con plan
hash, precondiciones SHA-256, apply idempotente y recuperación; workers redactan pero solo un
orquestador aplica.

**Útil:** backup transaccional, plan hash, source/claim ledger, una escritura por path, recuperación
y privacidad.
**Refutación:** requiere CLI/semántica de vault y en Windows la durabilidad POSIX se degrada; un
plan hash prueba integridad del plan, no intención humana.
**Veredicto:** adoptar el subconjunto Node/FS/Git local y declarar límites.
[claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian).

### 13. Marin

**Observado:** DAG de experimentos, pasos topológicos, artifacts con fingerprint, checkpoints,
logs de fallos y registros de decisiones; CI separa jobs de lectura y escritura.

**Útil:** DAG de tareas, orden topológico, artefactos con huella, checkpoint y failure log.
**Refutación:** lock distribuido/lease y servicios GPU son infraestructura; el propio código tiene
casos donde estado corrupto se interpreta como válido.
**Veredicto:** adoptar DAG local y validación fail-closed; rechazar cluster/lease.
[Marin](https://github.com/marin-community/marin).

### 14. awesome-claude-skills

**Observado:** catálogo curado de skills con contratos, ejemplos y conectores separados; varias
skills piden API/MCP y acciones reales.

**Útil:** catálogo local, metadatos, separación instrucciones/acciones y evaluación por skill.
**Refutación:** marketplace, OAuth y 500+ apps exceden el alcance y abren egress/secretos.
**Veredicto:** adoptar catálogo local y manifest; rechazar conexiones externas por defecto.
[awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills).

## 5. Qué debe hacer VCP con el research

La mejor posición no es elegir **research antes o después**, sino usar dos salidas distintas:

1. **Antes de Spec:** Discovery obligatorio para todo cambio no trivial. Preguntar qué se quiere
   construir, capturar fuentes y presupuesto, hacer CAIO, mapa de bucle actual/objetivo, PRD,
   implementación, adopción y recurrencia. Aquí la investigación es una entrada decisoria.
2. **Después de Ship:** informe de cierre con qué se investigó, qué se implementó, qué quedó fuera,
   qué falló, qué aprendió el sistema y qué siguiente bucle conviene atacar. Aquí la investigación
   es memoria y evidencia, no justificación retrospectiva.

Esto evita dos fallos: construir a ciegas y escribir un informe bonito después de haber decidido.

## 6. 50 mejoras candidatas, priorizadas y refutadas

Todas son candidatas; ninguna se implementa por aparecer en este documento. “Adoptar” significa que
el mecanismo sobrevivió el contraargumento y tiene una prueba de aceptación concreta.

### Foundations / Phase 0

1. **Manifest de corpus con SHA, modo, symlink y línea** — prioridad P1; fuente: archify/plugins.
   Falla si falta una entrada o hay una extra.
2. **Manifest de skill VCP cerrado** — P1; fuente: official plugins/scientific. Rechaza claves
   desconocidas y versiones sin pin.
3. **Feature slug inmutable por sesión** — P1; fuente: claude-plugins/claude-obsidian. Evita
   colisión de `SESSION.md` entre features.
4. **Runtime-sync antes de todos los gates** — P1; evidencia actual de T06. Compara fuente/instalador
   contra `.vibe/vcp-runtime`.
5. **Capability matrix detectada por comando real** — P1; fuente: agent-reach/claude-seo-ai.
   Cada capacidad queda `available`, `missing` o `degraded`, nunca implícita.
6. **Menu 🔵 CONFIG y CONTENT por fase** — P1; fuente: garden/gstack; ya existe en texto.
   Candidato de hardening: gate que exige opción mostrada y elección registrada.
7. **No-op/Direct-Build explícito** — P1; fuente: gstack/ponytail. El escape debe tener razón,
   scope y evidencia, no saltar Discovery silenciosamente.
8. **Presupuesto de lectura/tokens** — P2; fuente: garden/book-to-skill. Denominador y consumo en
   cada lote; excederlo pausa.
9. **Fuente unificada para roles y fases** — P2; fuente: agency-agents. Generar docs desde un
   catálogo y verificar paridad.
10. **Snapshot inicial de Git y entorno** — P1; fuente: gstack/claude-obsidian. Commit/tree/dirty,
    Node/shell y locale recalculables, nunca declarados por el agente.

### Discovery / Research

11. **Preguntar primero qué construir y qué resultado operativo busca** — P1; gstack office-hours.
12. **Registro CAIO estructurado** — P1; entrada, pérdida, repetición y bucle abierto con locator,
    evidencia y estado `observed|hypothesis`.
13. **Mapa de bucle actual→objetivo tipado** — P1; archify. Input, measure, decision, action,
    control, learning, owner y cadencia.
14. **PRD mínimo operativo** — P1; AI-engineering/the-architect. Problema, usuario, AC, tecnología,
    dependencias, accesos y resultado medible.
15. **Plan de implementación con prerequisitos** — P1; Marin. DAG topológico y condiciones de
    entrada/salida por tarea.
16. **Plan de adopción** — P2; gstack/agency. Responsable interno, cambio de hábito, entrenamiento,
    señal de uso y fallback.
17. **Plan de recurrencia** — P2; gstack retro/Marin. Próximo bucle, métrica, cadencia y criterio de
    expansión.
18. **Source ledger separado de claim ledger** — P1; claude-obsidian/scientific. Una fuente puede
    sostener varios claims, pero cada claim debe indicar locator y fecha.
19. **Independencia por contenido, no por cantidad de agentes** — P1; claude-obsidian. Dos copias del
    mismo blob cuentan una sola evidencia.
20. **Estados `SUPPORTED|CONTRADICTED|INFERRED|INSUFFICIENT|N/A`** — P1; scientific/archify. No
    permitir que `N/A` cierre una decisión requerida.

### Spec / Plan

21. **Checklist mecánico de calidad de spec** — P1; adaptación gstack. Campos, AC GIVEN/WHEN/THEN,
    non-goals, reversibilidad y fuente del dato.
22. **AC con IDs y locator de test desde el principio** — P1; architect/scientific. Rechaza AC sin
    test previsto antes de Build.
23. **EARS para triggers y límites** — P2; the-architect. Mejora precisión, no sustituye criterio
    humano.
24. **Conflict scan bidireccional del plan** — P1; superpowers/agency. Writers faltantes y extras,
    dependencia topológica obligatoria.
25. **Role/tool grant table generada** — P1; claude-seo-ai/plugins. Un lector no puede escribir; un
    escritor no puede aprobar su propio gate.
26. **Dispatch packet mínimo** — P1; superpowers/garden. Solo objetivo, archivos, AC, restricciones,
    output schema y comando; nunca transcript completo.
27. **Modelo de complejidad adaptativo** — P2; ponytail. No agrega arquitectura si YAGNI/stdlb/native
    cubren el caso.
28. **Design It Twice solo para decisiones irreversibles** — P2; mattpocock. Dos alternativas con
    trade-offs, no brainstorming infinito.
29. **Stop condition por fase** — P1; garden/Marin. Rondas, presupuesto, bloqueo y escalación exacta.
30. **Ledger de decisiones con hash del plan** — P1; claude-obsidian. Integridad del plan mostrado
    vs. aplicado, nombrado honestamente como integridad, no consentimiento.

### Build / Verify / Security

31. **RED negativo por cada gate** — P1; ponytail/GoogleTest/gstack. Fixture bueno pasa y malo falla,
    incluido selftest del instrumento.
32. **TRIANGULATE obligatorio con casos derivados** — P1; VCP/garden. Cada caso declara qué riesgo
    nuevo cubre; no contar duplicados.
33. **Tercer estado no-verificable que bloquea cierre** — P1; GoogleTest/claude-obsidian. `SKIPPED`
    nunca es verde.
34. **Polaridad declarada por gate** — P1; gstack/scientific. Ilegible, ausente y no-aplica no se
    colapsan.
35. **Denominador obligatorio en todo OK** — P1; agent-reach/scientific. `0/0` nunca produce verde.
36. **Allowlist cerrada de claves** — P1; plugins/scientific. Typos no pueden vaciar un conjunto.
37. **Evidence runner que registra comando real** — P1; gstack/ai-engineering. Exit, duración, commit,
    fingerprint antes/después y hash del comando.
38. **Fingerprint por AC sin incluir secretos** — P1; plugins/Marin/obsidian. Cambiar el valor invalida
    la aceptación; las credenciales se redaccionan.
39. **Paridad declarada-real bidireccional** — P1; agency/architect/obsidian. Falla por missing y extra.
40. **Scan advisory de assertions débiles** — P2; Marin/GoogleTest. Cuenta tautologías sin bloquear
    inicialmente; se calibra con falsos positivos reales.

### Ship / Learn / Distribution

41. **Pre-push revalidación del receipt** — P2; gentle-ai. Solo si el flujo separa commit y push; no
    duplicar por costumbre.
42. **Backup Graphify/Obsidian transaccional** — P1; archify/obsidian. Manifest, hash, HEAD y
    recuperación; el grafo no se trata como comprensión.
43. **Hash-chain de AUDIT y decisiones** — P1; VCP actual/claude-obsidian. Detecta edición accidental;
    declarar que no impide borrar todo el archivo.
44. **Memoria local con búsqueda progresiva** — P2; claude-mem/garden. Solo datos confirmados y
    redacción de secretos.
45. **Lessons con confidence/status/origin** — P1; aprende-skill. Dedup anota; retire nunca borra.
46. **Decay como señal, no auto-delete** — P2; gstack/aprende. Marca stale después de un período,
    exige revisión humana.
47. **Failure log por tarea y causa raíz** — P1; Marin/agency. Error, reproducción, fix y aprendizaje,
    no solo “reintentado”.
48. **Verificador == generador para vistas/índices** — P1; archify/AI-engineering. `check` regenera
    en memoria y compara bytes.
49. **Installer self-contained con manifest y smoke test** — P1; plugins/scientific. Copia exacta,
    idempotente, sin dependencias de skills externas.
50. **Métricas de productividad con baseline y seguridad separadas** — P2; ponytail/gstack. Medir
    tiempo/retrabajo/costo/defectos; no usar LOC como proxy único.

## 7. Qué no adoptar

No se deben incorporar instalaciones de otros skills, daemons, servidores, marketplace, OAuth,
MCPs remotos, APIs de pago, CI obligatorio, cluster/lease distribuido, LLM juez obligatorio,
auto-commit WIP, auto-push, ni código copiado de las fuentes. Son incompatibles con el requisito
de un VCP nativo, instalable y auditable offline.

## 8. Cobertura y siguiente decisión

### 8.1 Inventario funcional mecánico completo

Para no confundir un barrido de texto con comprensión, generé un inventario separado para las
15.581 entradas del manifest. El script `research/build-functional-inventory.mjs` leyó todos los
archivos materializados que no eran binarios/grandes y registró, por archivo, SHA-256, modo,
lenguaje, símbolos observables, señales de test, comandos, imports, claims y marcadores de riesgo.
El resultado está en
`research/functional-inventory-2026-08-31.json`.

La ejecución indexó **15.575/15.575 archivos materializados** (los 6 symlinks permanecen
registrados como no materializados), con **74.976 símbolos**, **214.127 señales de test**,
**45.246 comandos**, **63.520 claims** y **26.631 marcadores de riesgo**. Son indicadores
estructurales y pueden contener falsos positivos en código generado, ejemplos o texto; no deben
interpretarse como “74.976 funciones comprendidas”. El inventario conserva además el estado del
ledger: **90 READ, 594 EXCLUDED y 14.897 PENDING**.

El research está completo como **contabilidad de corpus** y como síntesis de mecanismos de alta
señal, pero no como lectura semántica de cada una de las 15.581 entradas. Para cerrar semántica al
100 % hace falta que las 14.897 entradas `PENDING` del ledger sean leídas funcionalmente o queden
justificadas como `EXCLUDED`, agregando propósito, interfaces, tests, límites, citas y veredicto;
el estado `PENDING` debe llegar a cero. Sin eso, afirmar “cada función estudiada” sería falso.

### Estado de la elección actual: B cerrada; A en ejecución por slices

La opción elegida fue **B**: se cerró el research como inventario físico/estructural y síntesis
adversarial, con la limitación explícita de que la lectura semántica sigue parcial (`90 READ`, `594
EXCLUDED`, `14.897 PENDING`). No se afirma que cada función fue comprendida. Con esa base comenzó
la opción **A** en slices pequeños, sin esperar a que una lectura semántica imposible de demostrar
se convierta en un falso “100 %”.

Primer slice A implementado y probado (sin commit/push todavía):

- `verify-phase-decisions.mjs --require-complete`: el cierre exige una decisión vigente para cada
  fase declarada.
- `verify-evidence-trace.mjs claims --require-links`: el cierre exige un packet no vacío y un
  vínculo resoluble por claim.
- `verify-vcp-coverage.mjs`: un worker por defecto y `VCP_TEST_CONCURRENCY` opcional para evitar
  flakiness por carreras; la sonda de shell prefiere Git Bash en Windows y acepta `VCP_BASH_PATH`.
- `verify-capability-matrix.mjs`: matriz cerrada de roles, herramientas y superficies, con rechazo
  de auto-aprobación y contradicciones de sólo lectura.
- `verify-spec-wordcap.mjs --quality`: forma mínima de spec, AC únicos y placeholders rechazados.
- `verify-evidence-runner.mjs`: argv sin shell, hashes y estado explícito `passed|failed|skipped`;
  `--require-complete` sólo cierra con `passed`, y `skipped` no ejecuta sondas.

Estos cambios tienen tests RED/GREEN y contrato documental; aún no están commiteados ni publicados.

### Menú 🔵 para la fase siguiente

- **A — Continuar implementación por lotes P1:** cerrar integración E2E, runtime-sync, contrato,
  empty-probe y documentación de las cuatro capacidades nuevas; cada lote entra por SPEC → PLAN →
  RED → GREEN → TRIANGULATE → REFACTOR → FINAL.
- **B — Lectura semántica profunda:** continuar el ledger por archivo para las 14.897 entradas
  pendientes; el pase estático ya está completo, pero no se lo presenta como comprensión.
- **C — Congelar research:** conservar este informe como baseline honesto y no implementar nuevas
  funciones hasta que el usuario elija una política.

**No se ejecutó código externo, no se instalaron dependencias externas y no se hicieron commits ni
pushes con este informe.** El estado actual del ledger es **90 READ, 594 EXCLUDED y 14.897
PENDING** sobre 15.581 entradas; el pase estático completo abrió 15.581/15.581 entradas
materializadas.
