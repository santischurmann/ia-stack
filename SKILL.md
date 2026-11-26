---
name: ia-stack
description: "Método de trabajo para construir software con un agente LLM gastando lo mínimo. Primero pregunta qué querés crear, diagnostica qué conviene programar, investiga, define marca y spec, y muestra un preview navegable; recién con tu aprobación construye con tests. Usa el modelo más barato que resuelva, cuida el cupo de tu plan (frena al 85 % si el host informa el cupo) y retoma desde ESTADO.md. Usalo al empezar o retomar un proyecto, al pedir una funcionalidad o un arreglo, o antes de publicar."
---

# IA Stack

**Versión:** 3.4.7 · 26-11-2026 · etiquetada como `v3.4.7` en git.

Un método en 10 fases para construir software con un agente. Este archivo es el núcleo: se lee
siempre; de las fases, **sólo la que está en curso**. En un proyecto instalado, `scripts/`, `skills/`,
`templates/`, `contracts/` y `phases/` cuelgan de `.ia-stack/runtime/`: `node scripts/<script>.mjs`
se corre como `node .ia-stack/runtime/scripts/<script>.mjs` desde la raíz del proyecto.

## Principios
1. **Menos IA.** Primero un script. Si no alcanza, el modelo más barato que resuelva.
2. **Preguntar antes que suponer.** Una tanda de preguntas por fase, con opciones y la recomendada primero.
3. **El cupo de la persona manda.** Se lee al arrancar y el trabajo se acomoda a lo que queda.
4. **El contexto no se pierde.** Una sesión nueva retoma leyendo `.ia-stack/ESTADO.md`.
5. **Nada visible se construye sin preview o boceto aprobado. Sin test rojo no hay código.**
6. **Sin residuos.** Al cerrar no quedan temporales ni sesiones abiertas.

## Glosario
- **CAIO:** diagnóstico de procesos para decidir qué automatizar con código.
- **EGM:** lectores sin contexto que revisan un documento; la ronda de brainstormings + EGM es siempre Opus (`skills/brainstorm-egm.md`).
- **Recibo:** evidencia de comandos reales de una tarea (`skills/recibo-y-seguridad.md`).
- **sha:** identificador del commit.

## Recorrido
`node scripts/tamano.mjs` calcula el tamaño (`contracts/tamano.json`). Ante la duda, el mayor.
Plata, seguridad, autenticación y migraciones de datos nunca son «chico».

| Tamaño | Qué es | Fases |
|---|---|---|
| chico | hasta 3 archivos, sin pantalla nueva, sin área de riesgo | 0 1 7 8 9 |
| medio | funcionalidad sobre un proyecto que ya existe | 0 1 3 5 6 7 8 9 |
| grande | proyecto o módulo nuevo | 0 a 9 |

Un chico con cambio visible aprueba un boceto en la fase 1 (`apruebo boceto v1`) y su tarea lo declara en el campo
`preview` de `docs/tasks.json`. La fase 2 es sólo de tamaño grande.

| Fase | Archivo | Entrega | Modelo | Aprueba la persona |
|---|---|---|---|---|
| 0 Arranque | `phases/00-arranque.md` | 5 líneas de estado | script | — |
| 1 Qué querés crear | `phases/01-pedido.md` | `docs/pedido.md` | sesión principal | aprobación 1: `apruebo pedido v1` |
| 2 Diagnóstico CAIO | `phases/02-caio.md` | `docs/caio.md` | medio | — (se aprueba en la 3) |
| 3 Research | `phases/03-research.md` | `docs/research.md` | script + barato | aprobación 2: `apruebo research v1` |
| 4 Mini marca | `phases/04-marca.md` | `docs/marca.md` | fuerte | aprobación 3: `apruebo marca v1` |
| 5 Spec | `phases/05-spec.md` | `docs/spec.md` | fuerte | — |
| 6 Preview | `phases/06-preview.md` | preview navegable | medio | aprobación 4: `apruebo preview v1`; congela spec y preview |
| 7 Build | `phases/07-build.md` | código y tests | medio (barato si es mecánico) | — |
| 8 Verificar y publicar | `phases/08-publicar.md` | recibo y push | script + fuerte | orden: `apruebo produccion <sha>` |
| 9 Cierre | `phases/09-cierre.md` | 1 línea de métricas | script | — |

## Modelos
Fuente única: `contracts/model-routing.json`. Esfuerzo `medium` siempre: con poco cupo baja el nivel
donde se pueda o se espera, nunca el esfuerzo. Modelo y esfuerzo nunca se le preguntan a la persona.

| Nivel | Claude | Para qué |
|---|---|---|
| script | sin IA | contar, medir, validar forma, limpiar, consultar versiones |
| barato | Haiku medium | leer, buscar, logs, git, edición mecánica, documentación. **Default**; código sin señal clara, medio |
| medio | Sonnet medium | tests, pantallas, funcionalidades con patrón conocido |
| fuerte | Opus medium | marca, spec, áreas de riesgo, revisión antes de publicar |
| orquestador | Fable medium | sólo la sesión que reparte trabajo a subsesiones; no construye |

- **Escalada:** si la prueba sigue fallando tras un intento, sube un nivel con el comando, la salida
  y lo ya probado; si falla el fuerte, se frena y se pregunta a la persona. Un error de cupo no es
  falla: se espera. Se anota con `node scripts/leccion.mjs anotar --tipo escalada --desde <n> --hasta
  <n> --sintoma <t> --causa <t> --archivo <ruta>`.
- **Revisor:** otra sesión de nivel fuerte (puede ser el mismo modelo), sin la conversación de quien
  construyó (fase 8 paso 4); si no hay, revisa la persona. Si el host no deja elegir modelo, se le avisa una vez a la persona.

## Cupo
- La fase 0 lee plan y cupo con la herramienta del host. Si no hay, pregunta el plan una vez
  (`.ia-stack/plan.json`) y el cupo queda «desconocido»: nunca se estima.
- Al 85 % de la ventana de 5 horas se frena lo que no sea la tarea en curso y se avisa la hora de reinicio.
- Ritmo (`ritmoPresupuesto`): va encima si lo gastado de la semana pasa de 14 % por día desde el
  reinicio semanal, o lo de la ventana de 5 h, de 20 % por hora. Encima, medio baja a barato o espera,
  barato espera y fuerte se pausa (la tarea en curso termina). Ejemplo: día 3, 45 % gastado (más de 42 %): encima.

## Estado y sesiones (todo en `.ia-stack/`)

| Archivo | Lo escribe | Qué guarda |
|---|---|---|
| `ESTADO.md` (≤60 líneas) | la sesión principal | fase, tamaño, cola de tareas con dueño, cómo retomar |
| `APROBACIONES.md` | `scripts/aprobar.mjs` | texto literal de la persona, fecha, sha, sello encadenado |
| `metricas.jsonl` | `scripts/metricas.mjs` | cupo y modelo por bloque |
| `LECCIONES.md` | `scripts/leccion.mjs` | cada escalada y cada retrabajo |

- **Relevo** al 70 % del tope de contexto (orquestador 120K, subsesión 60K, sobre mensajes) y al
  cambiar de etapa: estado guardado, sesión nueva; pasado el tope no se sigue. **Respaldo** si la sesión
  siguió igual: handoff en `.ia-stack/handoffs/ULTIMO.md` a los 180K y ventana de 300K, que llena compacta.
- **Subsesión:** nace con un grupo de tareas, reporta en modo breve y se archiva. **Encargo**
  a un subagente: hasta 4.000 tokens y 3 archivos (`skills/encargo.md`).
- **Huérfana:** su tarea está hecha o sin dueño. Se archiva, nunca se borra; lo pendiente vuelve a
  la cola. Las «en pausa» no se tocan.
- El orquestador no lee código: delega y recibe la conclusión. Entre agentes, modo breve
  (`skills/modo-breve.md`); hacia la persona y en acciones irreversibles, lenguaje normal.

## Gates
Un gate es un script que frena si algo no se cumple (lista y protegidos: `contracts/gates.json`).

- **1** Test rojo visto antes del código · **2** El diff toca sólo los archivos de la tarea
- **3** Preview aprobado · **4** Verificación con recibo: suites, seguridad base, repo limpio
- **5** Producción atada al sha aprobado · **6** Cupo y contexto
- **7** Versiones de stack estables y compatibles · **8** CI sólo en el push único o el de corrección

## Reglas fijas
- **Evidencia.** Nada se declara terminado sin la salida real de un comando. «Debería andar» no es evidencia.
- **Reproducir antes de diagnosticar.** Sin reproducción, un diagnóstico es una hipótesis.
- **Publicar una vez.** Commits locales, los que hagan falta. Push, merge o tag: uno, al terminar, con
  todo verde, más uno de corrección si falla el CI (fase 8). Suites en local; nunca CI «para probar».
- **Producción sólo con orden explícita** de la persona, atada al sha, usada una vez.
- **Respaldo verificado antes de borrar.** Nada se frena ni se mide por recursos de la máquina.

## Automejora
Cada escalada y cada retrabajo queda en `LECCIONES.md`; la fase 0 muestra las repetidas y la persona
decide cuál pasa a regla. El protocolo no crece: un test falla si este archivo pasa de 120 líneas o
una fase de 60. Para sumar una regla hay que sacar otra.
