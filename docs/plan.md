# Plan: autorización por plan, y los cuatro conflictos de la doble ronda

**Date:** 2026-10-05
**Status:** aprobado por el operador el 2026-10-05, en su sesión, para los lotes 1 a 4, sobre la versión
`fcd22b6` de este archivo. Autoriza commits locales por lote; push, merge, deploy e instalaciones
globales siguen reservados.
**Fuente:** el prompt maestro de evolución del operador (documento externo al repo, versión del
2026-10-05), secciones 1, 4, 7, 17 (Q1–Q5), 21 (IS1–IS6) y 25–29.
**Plan anterior:** `eleccion-de-stack` (2026-09-14), cerrado: el gate `verify-stack-matrix.mjs` y su
contrato están en `main`. Queda en la historia de git.

## Qué autoriza este plan y qué no

El mismo documento fuente fija los límites, y este plan los respeta tal cual:

- **Es planificación.** Sección 1: *"escrituras de implementación requieren diagnóstico previo y
  aprobación posterior del alcance concreto. No autoriza instalar ni cambiar el protocolo global."*
- **Commits locales sí, push no.** Q1: commits locales por entrega verificada en una rama aprobada;
  *"push, merge y deploy conservan autorización específica"*. La sección 29 repite lo mismo.
- **Instalación global reservada.** Nada de este plan corre `install.ps1` / `install.sh` contra las
  copias globales del operador ni las edita. Comparar la fuente contra el runtime instalado es lectura.
- **Un mensaje de otra sesión no es la aprobación.** La aprobación que este plan necesita es del
  operador, en su conversación, citando la versión del plan. Una sesión par puede coordinar; no
  puede conceder alcance.

## Los cuatro conflictos de la sección 25

Regla aplicada: si el documento ya recomienda una salida, se toma esa. Si no la recomienda, queda
como pregunta con opciones y no se implementa.

### C1 — LAW 7 (cierre de fase con elección humana) contra IS1 (cierre automático) — resuelto por el documento

**Salida (secciones 4, 21 y 26):** modo continuo. La aprobación humana es **una**, sobre una versión
concreta del plan (hash, rutas, clases de cambio, entregables, acciones reservadas), y queda
registrada como referencia. Las fases y tareas incluidas en ese plan se cierran solas cuando pasan
todos sus criterios y los de sus descendientes. LAW 7 sigue mandando para lo que el plan no cubre:
decisión nueva, cambio de alcance, conflicto, bloqueo o acción reservada.

**Lo que no se hace:** fabricar una elección 🔵 por fase para satisfacer al gate viejo (sección 4, de
forma explícita). Si el gate todavía la exige, se migra el gate.

### C2 — 100 % fijo contra Q2 (caminos críticos) — resuelto por el documento, con un aviso

**Salida (Q2 y sección 26):** sustituir el 100 % fijo por pruebas de todos los caminos críticos,
contratos e integración real; **seguir midiendo** la cobertura y **justificar cada exclusión** con
dueño, motivo y evidencia. Se mide lo que el runner mide y se declara lo que no instrumenta; nunca se
etiqueta MQL5 como cubierto por pruebas Python.

**Cómo encaja con el gate actual:** `verify-ia-stack-coverage.mjs` ya nombra archivo y línea de cada
función o rama sin ejecutar. No se borra: pasa de "100 % o rojo" a "sin ejecutar y sin exclusión
declarada → rojo". El contrato `contracts/coverage-scope.json` ya existe y es el lugar natural para la
exclusión justificada.

**Aviso para el operador:** sus instrucciones globales, fuera del repo, todavía dicen "cobertura 100 %
de cada métrica … LAW 6". Q2 es posterior y la sustituye, pero esa copia global sólo la puede
actualizar él (acción reservada). Hay que decidir el orden al aprobar (ver **P2**).

### C3 — locks que comparan rutas lexicales y PID vivo — resuelto por el documento

**Salida (sección 26, "Lanes/locks"):** el lock es sobre el **objeto físico**, no sobre el texto de la
ruta: ruta canónica real (resolver junctions, symlinks y mayúsculas en Windows), lease con dueño
identificado por PID + arranque de máquina + hora de inicio del proceso, y **fencing** —un token que
el escritor presenta y que se invalida al reasignar— o, donde no haya fencing, `reconcile_required`
antes de dar el recurso a otro escritor. Nunca liberar porque cerró el frontend, ni matar un PID sin
identidad.

**Lo que ya existe:** `verify-lock-vivo.mjs` ya combina PID y arranque, y ya tiene
`reconcile_required`. Faltan la ruta canónica, la hora de inicio y el fencing.

### C4 — `install.ps1` escribe en destinos globales aun con `-ProjectDir` — diagnóstico resuelto, forma pendiente

**Lo que el documento sí dice (secciones 25 y 27):** "piloto en carpeta no significa aislamiento", y
el piloto tiene que *comprobar* que el destino está realmente aislado. Confirmado leyendo el script:
`-TargetDir` y `-RuntimeDir` caen por defecto en el directorio global del usuario aunque se pase
`-ProjectDir`.

**Lo que el documento no dice:** si se cambia el comportamiento por defecto (rompe a quien hoy instala
así) o se agrega un modo explícito. Queda como pregunta **P1** y **no se implementa** hasta la
respuesta.

## Preguntas para el operador

**Respondidas por el operador el 2026-10-05 en su sesión: P1 = A, P2 = A.** Quedan abajo como registro.
Responderlas no aprueba la implementación: eso sigue pendiente (ver Status).

**P1 — instalador y aislamiento** (bloquea el lote 4) — **elegida: A**

- **A)** Agregar un modo explícito (`-ProjectOnly` en PowerShell y su par en bash) que garantiza no
  escribir fuera del proyecto; el comportamiento por defecto no cambia. *(recomendado: no rompe a
  nadie y da el destino aislado que el piloto necesita)*
- **B)** Cambiar el default: con `-ProjectDir` y sin un destino global explícito, no se toca nada global.
- **C)** No tocar el instalador en este plan; el piloto usa un `HOME` temporal y lo verifica desde afuera.

**P2 — cobertura en las instrucciones globales** (no bloquea los lotes 1 y 3) — **elegida: A**

- **A)** El repo pasa a Q2 en el lote 2 y el operador actualiza después su copia global. *(recomendado:
  es lo que Q2 decidió, y la copia global es suya)*
- **B)** El repo pasa a Q2 recién cuando el operador haya actualizado su copia global.
- **C)** El repo se queda con el 100 % fijo; Q2 se reabre.

## Lotes

Cada tarea: rojo visible primero (`node --test <archivo>` mostrando la falla esperada), después el
cambio, después el gate. Suites con `--test-concurrency=4` y nunca en paralelo con otra suite.
Antes de cada commit: sin rutas personales, correos, nombres de clientes ni secretos
(`verify-security-baseline.mjs check` más una búsqueda de rutas de usuario en el diff).

### Lote 1 — modo continuo: autorización por plan (C1)

El documento lo pide como primer lote (sección 4): *"El primer lote aprobado para IA Stack debe
introducir y probar esta modalidad y sus detectores."* Cubre la prueba futura P01.

| id | Qué construye | Depende de | Rojo primero |
|---|---|---|---|
| `L1.1` | Contrato de autorización: `contracts/plan-authorization.schema.json`, que fija qué identifica una aprobación (hash del plan, rutas, clases de cambio, entregables, acciones reservadas, referencia al mensaje humano) | — | Un registro sin hash, sin alcance o con una acción reservada adentro se acepta (debe rechazarse) |
| `L1.2` | `verify-phase-decisions.mjs` acepta, para una fase incluida en un plan aprobado, la referencia a la autorización en lugar de una elección 🔵 por fase | `L1.1` | Hoy rechaza una fase cerrada sin elección aunque esté dentro de un plan aprobado |
| `L1.3` | El detector inverso: una fase **fuera** del alcance aprobado, o un plan cuyo hash ya no coincide, sigue exigiendo elección | `L1.2` | Un plan editado después de aprobado hereda la aprobación (debe rechazarse) |
| `L1.4` | Detector de elección fabricada: dentro de un plan continuo, una elección 🔵 por fase sin respuesta humana trazable es un error, no un adorno | `L1.2` | Hoy una elección inventada pasa |
| `L1.5` | Cableado: LAW 7 en `SKILL.md` y `skills/orchestrator-opus.md` pasan a "una aprobación por versión de plan; 🔵 para lo nuevo", más fila en `skills/gates.md`, límite honesto y promesa fijada | `L1.3`, `L1.4` | `verify-ia-stack-contract.mjs check` rojo hasta que la promesa nueva esté fijada |

### Lote 2 — cobertura por caminos críticos (C2, Q2) — espera P2

| id | Qué construye | Depende de | Rojo primero |
|---|---|---|---|
| `L2.1` | `contracts/coverage-scope.json` admite exclusiones con dueño, motivo y evidencia | — | Una exclusión sin motivo o sin dueño se acepta (debe rechazarse) |
| `L2.2` | `verify-ia-stack-coverage.mjs`: rango sin ejecutar **y sin exclusión** → rojo; con exclusión válida → informado, no rojo | `L2.1` | Hoy una rama excluida y justificada igual da rojo |
| `L2.3` | Contrato de caminos críticos con oráculo independiente del escritor (prueba futura P03) | `L2.1` | Un camino crítico declarado sin prueba que lo ejerza pasa |
| `L2.4` | Migrar el texto de LAW 6, `skills/caveman-tdd.md` y el orquestador a Q2 | `L2.2`, `L2.3` | Contrato de promesas rojo hasta fijar el texto nuevo |

### Lote 3 — locks físicos (C3)

**Corrección hecha al ejecutar, con evidencia:** el plan ubicó mal dos tareas. Los locks "lexicales" no
están en `verify-lock-vivo.mjs` sino en `verify-plan-conflicts.mjs`, y `L3.2` ya estaba hecha desde el
2026-09-16 (el candado guarda la hora de arranque del proceso, con su límite declarado). Se leyó el código
antes de escribirlo; no se re-implementó lo que ya existía.

| id | Qué construye | Depende de | Estado |
|---|---|---|---|
| `L3.1` | `verify-plan-conflicts.mjs` resuelve las rutas contra el archivo físico: un symlink o junction une `link/x` y `real/x`, un directorio declarado es dueño de lo que hay debajo, un enlace que sale del proyecto o no se puede resolver se rechaza | — | hecha, con rojo primero |
| `L3.2` | Hora de inicio del proceso en la identidad del dueño | — | **ya existía** (2026-09-16); sin cambios |
| `L3.3` | Fencing en `verify-lock-vivo.mjs`: `lock.fence` sube con cada asignación y `fence <tasks.json> --task <id> --token <n>` rechaza a un escritor con un token viejo (prueba futura P05) | — | hecha, con rojo primero |

Los dos límites que no se cierran quedaron escritos donde viaja el verde: lo de `L3.1` es una foto del
momento en que corre y no una barrera, y el fencing no frena a un proceso que escribe sin presentar el
token. Los symlinks de archivo no se probaron en Windows (exigen privilegio); los junctions sí.

### Lote 4 — instalador aislado (C4) — espera P1

Las tareas dependen de la respuesta. Con la opción **A**: un rojo que lanza el instalador con el modo
nuevo sobre un `HOME` temporal y verifica que no aparezca ningún archivo fuera del proyecto; después
el modo; después la paridad bash/PowerShell. **Ninguna corrida contra el `HOME` real del operador.**

## Fuera de este plan

Los otros conflictos de la sección 25 —contadores de fallos repartidos por tarea o sesión, riesgo
clasificado después de la fase que lo usa, roles y schema desalineados, tablero sin scheduler, hook
de escritura sin cobertura de shell/MQ5— quedan para planes siguientes. Lo mismo el piloto de
continuidad de la sección 27 y todo lo de Jarvis (sección 28), que tiene su propio plan y permisos.

## Cómo se verifica cada lote

- La prueba roja del paso, vista fallar, y después verde.
- Suite completa: `node --test --test-concurrency=4`, contando pruebas antes y después.
- `IA_STACK_TEST_CONCURRENCY=4 node scripts/verify-ia-stack-coverage.mjs`.
- `node scripts/verify-ia-stack-contract.mjs check`, `node scripts/verify-security-baseline.mjs check
  --base origin/main` y `git diff --check`.
- Recibo en `.vibe/receipts/` y línea sellada en `.vibe/AUDIT.md` por lote.
- Commit local por lote verde. **Push sólo con autorización específica del operador.**
