## PHASE 4 — PLAN

🔵 **PLAN CONFIG** (una vez, dos preguntas — no son dos opciones de la misma pregunta):

**1. ¿De qué tamaño son las tareas?**

- **A)** Atómicas — una función o módulo por tarea — *(recomendado)*
- **B)** Gruesas — a nivel módulo
- **C)** Híper-atómicas — partir todavía más

**2. ¿Se permite construir tareas independientes en paralelo?**

- **A)** Sí — más rápido; sólo se despachan juntas las que el preflight dejó sin conflicto de escritura — *(recomendado)*
- **B)** No — una por vez, en orden

Esperando tu respuesta antes de continuar.

Generate `docs/plan.md` + `docs/tasks.json` — template: `skills/spec-plan-templates.md`. Status lifecycle per task: `pending→red→green→triangulate→refactor→done`.

**Decisiones estructurales: un ADR, y sólo cuando corresponde.** Si el plan ata al proyecto a algo
que costaría meses deshacer —un motor de base de datos, un formato de archivo que otros van a leer,
una dependencia nueva, un límite de compatibilidad— escribí un registro en
`docs/adr/<NNNN>-<titulo>.md`, copiando `templates/adr.md`. Si el plan no toma ninguna decisión de
esas, **no escribas ninguno**: un ADR por tarea rutinaria vacía el artefacto de significado.

Lo que un ADR pide y ningún otro documento del protocolo exige: **las opciones que descartaste** y
**qué se vuelve más difícil**. `.vibe/DECISIONS.md` es la bitácora corrida de la sesión; el ADR es
el registro de una decisión que va a sobrevivir a la sesión.

```bash
node .vibe/ia-stack-runtime/scripts/verify-adr.mjs check
```

Sin carpeta escribe `VACÍO:` y sale `0` — un proyecto que no tomó decisiones estructurales no
incumple nada. **Lo que el gate NO puede hacer:** comprueba la forma, no la decisión; y no sabe si
un ADR hacía falta, así que un proyecto que toma diez decisiones estructurales y no escribe ninguna
sale igual de verde que uno que no tomó ninguna.

**Preflight de conflictos (gate mecánico, antes de pedir aprobación):**
```bash
node .vibe/ia-stack-runtime/scripts/verify-plan-conflicts.mjs check docs/tasks.json
```
El gate usa como writers los tres campos declarados por tarea: `files_to_create`,
`files_to_modify` y `test_files`. Dos tareas que declaran el mismo path sólo pasan si existe
una ruta `depends_on` directa o transitiva entre ellas; el output las marca `SERIALIZED`, por lo
que no se pueden despachar en paralelo. Cualquier overlap sin orden, id duplicado, dependencia
desconocida/cíclica, campo no-array o path fuera del proyecto devuelve exit 1: corregí el plan
(serializá o dividí las tareas) y re-ejecutá el gate. No reemplaces este chequeo con la afirmación
del orchestrator de que las tareas “parecen independientes”.

**Forma de cada tarea (gate mecánico, el mismo preflight):**
```bash
node .vibe/ia-stack-runtime/scripts/verify-task-shape.mjs check docs/tasks.json
```
Los dos gates leen el mismo archivo y miran cosas distintas: el de conflictos cruza los conjuntos de
escritura entre tareas; éste mira **adentro** de cada tarea. Exige que `approval_criteria` **nombre
un AC que `docs/spec.md` declare de verdad** —antes una tarea podía citar `AC9` sobre una spec que
llega hasta `AC5`, o describir su criterio en prosa sin nombrar ninguno—, que `verifier` sea un
comando y **nunca el nombre de un rol** —es lo que sostiene «ningún rol certifica su propio gate»—,
que `role` exista en la matriz de capacidades y cada `subagents` tenga su skill, que `access_needed`
diga qué acceso hace falta o `ninguno`, y que `done` no llegue sin una sola evidencia. Se midió el
2026-09-15 que de los 20 campos de una tarea **un gate leía 6**: los otros catorce los sostenía la
tabla de `skills/orchestrator-opus.md` § MINIMAL AI-COMPANY TASK MODEL, que los especifica desde
hace meses. **Lo que el gate NO puede hacer:** comprueba forma y coherencia, nunca que la tarea haga
lo que dice ni que la evidencia listada sea real.

🔵 **Revisión del plan**

- **A)** Aprobado — arrancar Build — *(recomendado si los gates están en verde)*
- **B)** Agregar o sacar tareas — [decime cuáles]
- **C)** Cambiar el orden
- **D)** Cancelar

Esperando tu respuesta antes de continuar.

---
