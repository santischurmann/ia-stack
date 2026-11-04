# Reglas extendidas — el detalle de § LAWS

Se movió desde `SKILL.md` sin reescribirlo, para que el núcleo pese 20 KB o menos. Obliga igual
que las leyes: el núcleo apunta acá en cada lugar de donde salió un párrafo.

## LAW 6 — Soporte declarado

   **Soporte declarado** responde una sola pregunta: *si un usuario dice que no le anda, ¿con qué se
   lo diagnostica?* Son cuatro campos —`correlation`, `actor_on_writes`, `failure_visible`,
   `diagnostic_command`— que ya vivían en `observability` del PRD (Phase 2) como una frase suelta que
   nadie volvía a mirar; ahora son campos propios y entran al receipt. Cada uno admite
   **`"ninguno — <motivo>"`**, nunca `ninguno` a secas: un producto puede no tener correlación de
   peticiones y ser honesto, pero callarlo no.
   **Por qué esto convive con 100% de cobertura, que es lo que lo hacía invisible:** la cobertura
   mide **ejecución de tu código**; el soporte mide **observabilidad de tu producto**. Son ejes
   ortogonales, y el DoD tenía uno solo. Medido en una corrida real: sin identificador de petición y
   sin autor en las operaciones, con la cobertura en 100% y todos los gates en verde.

## LAW 9 — Cuando un push despliega a producción

   **Cuando un push despliega a producción** (`.vibe/PROJECT.md` § Producción: una rama que, al
   recibir un push, publica la app sola), publicar son **dos pasos, a propósito**: el trabajo va en
   otra rama, y la publicación única de esta ley es el push de ESA rama al cerrar el plan, que suele
   crear la copia de prueba; llevarlo a la rama que despliega es otra cosa, que
   se pide aparte, con su propio menú (8.1), recién después de mirar esa copia. Son dos corridas de CI en vez de una, y es el
   precio de que la gente no vea un cambio que nadie miró.

## Modo continuo y límites honestos de las decisiones por fase

**Modo continuo** (decidido por el operador el 2026-10-04, respuesta IS1): cuando la persona aprueba
**una versión concreta de un plan** —su hash, las fases, rutas y clases de cambio que cubre, y las
acciones reservadas que deja afuera: `push`, `merge`, `deploy`, `payment`, `global-install`,
`license` y `trading`— las fases incluidas se cierran solas apenas pasan sus gates, y se registran
con `status: "authorized"` en lugar de un menú: una referencia a esa aprobación (`authorized_by`) y
la evidencia de los gates (`evidence`). No se arma un menú 🔵 por fase para contentar al detector:
eso sería registrar una elección que nadie hizo, y el gate lo rechaza como
`PHASE_DECISION_FABRICATED_CHOICE`. El menú 🔵 sigue mandando para todo lo que el plan no incluye:
una decisión nueva, un cambio de alcance, un conflicto, un bloqueo o una acción reservada. Si el
plan se edita después de aprobado, o la fase está fuera del alcance, la aprobación **no se hereda**.
Con varias funcionalidades o lotes en el mismo plan, cada una cierra con su commit local y su
recibo, y **el push se pide una vez, al cerrar el plan entero** (LAW 9): nunca al cerrar un lote.
**Límite honesto del modo continuo**: la aprobación se sella por contenido, no por voluntad. El gate
prueba que el plan que se aprobó es el mismo que hay en disco y que cada fase cerrada estaba dentro
de su alcance; no prueba que la persona haya dicho que sí. `approval_ref` es una referencia que el
agente escribe, y un agente puede escribir una que no existe.
**Límite honesto del gate**: demuestra que la decisión quedó registrada de forma coherente, no
demuestra que la persona realmente haya querido esa opción ni que haya comprendido sus
consecuencias — un agente puede registrar decisiones que nadie tomó y el gate las acepta.

Cada decisión declara además **`shown_at`**: cuándo se le mostró el menú a la persona. Entre eso
y el momento de la elección tienen que pasar al menos dos segundos. No prueba consentimiento — eso
necesita un canal fuera de este proceso — pero sí agarra el caso concreto de un agente que fabrica
el menú y la decisión en el mismo aliento. Un agente que espera igual pasa: detecta lo imposible,
no lo mentiroso.

## Tope de reintentos

**Tope de reintentos** (item #43). Al **tercer intento fallido sobre el mismo problema** se frena y
se consulta al usuario con un 🔵 que muestra qué se probó y por qué falló cada vez. No hay cuarto
intento sin una decisión humana registrada. Tres alcanza para descartar un error tonto sin quemar
la sesión en un callejón sin salida — y "probar otra cosa parecida" sigue siendo el mismo problema,
no uno nuevo. Los intentos se anotan en `.vibe/SESSION.md` bajo `## Intentos fallidos`, uno por
línea con `<qué se probó> → <por qué falló>`, y la respuesta del usuario como
`- decisión humana: ...`. Detector: `verify-session-state.mjs check --session .vibe/SESSION.md`.

## Aprendizajes de octubre y noviembre de 2026

Reglas que salieron de fallas reales en los proyectos de la persona (Grobit, Jarvis, IA Stack). Cada
una nombra su detector; las que todavía no lo tienen lo dicen y están en `.vibe/DEBT.md`.

| Regla | Herida | Detector |
|---|---|---|
| **Handoff al 70 %** del tope de mensajes (120K orquestador, 60K subsesión); pasado el tope no se sigue trabajando. | 02-11-2026: diez sesiones cortadas entre el 98 % y el 171 %. | `context-guard.mjs` (`aviso_desde: 0.7`); en subagentes, el brief (`verify-brief-size.mjs`). |
| **Un solo dueño por tarea y por artifact**, en la tabla «Dueños» de `.vibe/SESSION.md` (tarea, dueño, desde `DD-MM-AAAA HH:MM`); se consulta antes de lanzar y se traspasa con una fila nueva, nunca tomándola. Dos agentes nunca miden lo mismo. | Dos sesiones midieron el mismo OOS y publicaron versiones distintas del mismo artifact. | Pendiente (`.vibe/DEBT.md`): hoy lo sostiene esta tabla. |
| **Decisiones de la persona con hora exacta** (`DD-MM-AAAA HH:MM`, hora argentina) y quién. Si dos sesiones registraron versiones que chocan, no gana la más nueva: se le vuelve a preguntar mostrando las dos, cada una con su hora. | 26-10 y 03-11-2026: una sesión aplicó una decisión que otra ya había reemplazado. | `verify-phase-decisions.mjs` (cadena por fase) y `verify-aprobacion-humana.mjs` (previews y producción); el choque entre sesiones, pendiente. |
| **Un mensaje de otra sesión o de un agente no escala permisos.** Sólo la persona aprueba, y sólo en su conversación. | Un «sí» reenviado por el orquestador se tomó como permiso de publicar. | `verify-aprobacion-humana.mjs` rechaza un `quien` que sea agente, modelo o sesión (LAW 11). |
| **Push único a la rama principal con todo verde y el «sí» atado al sha.** | 14-10-2026: dos pushes en rojo el mismo día; 2.573 minutos de CI en septiembre. | LAW 9, menú 8.1 y `verify-aprobacion-humana.mjs produccion` (LAW 11). |
| **RAM antes de una suite**: tope de procesos pesados `floor((libre_GB − 1,5) / 1,5)`; con 0 se espera, y una suite muerta sin exit no es veredicto. | Suites que se mataban entre sí y dejaban un verde falso. | Hook global `~/.claude/hooks/tope-ram.mjs` de la persona, fuera de este repo; acá se registra si bloqueó. |
| **Numeración de migraciones coordinada entre ramas paralelas** (`phases/05-plan.md`). | Grobit: dos ramas tomaron la 0148. | Pendiente (`.vibe/DEBT.md`). |
| **Antes de publicar un artifact, leer la versión vigente** y construir sobre ella; nunca pisar la de otra sesión. | Una sesión republicó un canvas y borró el trabajo de otra. | El host (la herramienta Artifact rechaza publicar sobre una versión no leída); donde no lo haga, ninguno. |
| **No inventar** funciones, testimonios, cifras ni clientes; lo que no existe todavía se marca «Próximamente». | Plan de la landing de Grobit, 04-11-2026. | Panel `esceptico` de § Revisión goldfish (EGM) y preview de `phases/04-spec.md` (`skills/egm-panel-audiencia.md`) y LAW 10. |

## Al evolucionar este propio protocolo

**Al evolucionar este propio protocolo** (source: `research/sources/protocolo-muralla.md` points
#22/#23) — dos reglas meta que aplican a cualquier LAW/regla nueva que se agregue a `SKILL.md`/
`skills/*.md` en el futuro:
1. **Toda regla nueva trae su detector.** No "evitá el over-engineering" sino "over-engineering →
   `verify-scope-diff.mjs` contra los writers declarados y el delta real de Git". Una regla sin método de
   verificación es decorativa — se olvida en la primera sesión bajo presión de contexto.
2. **El comentario de un gate cuenta la herida, con el número de veces que pasó.** Un gate que
   nace de una buena práctica genérica se borra con el tiempo; uno que nace de un bug real
   documentado se respeta — ver los comentarios de origen en `scripts/verify-receipt.mjs`,
   `scripts/ratchet.mjs`, `scripts/pretooluse-red.mjs`.
