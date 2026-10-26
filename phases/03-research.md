## PHASE 2 — RESEARCH (antes de Spec)

Para un cambio que excede Direct Build, Discovery es entrada obligatoria de la spec: no se entrega
como una narración retrospectiva. El objetivo es decidir qué producto/proceso conviene construir
antes de comprometer tareas de implementación.

1. **Research verificable:** inventariar fuentes, versión/fecha/locator, alcance realmente leído y
   claims. Separar `SUPPORTED`, `CONTRADICTED`, `INFERRED`, `INSUFFICIENT_EVIDENCE` y
   `NOT_APPLICABLE`; nunca convertir una fuente no leída en una recomendación.
1b. **Candidatos, no puntajes.** Una tabla de «señales de adopción» es un filtro lexical: cuenta
   palabras, no entiende nada. Para proponer adoptar algo de una fuente externa se escribe un
   candidato en `research/candidates.json` con catorce campos —fuente, commit pineado, archivo,
   línea, función, problema que resuelve, evidencia, **contraejemplo**, costo, riesgo,
   compatibilidad, decisión y test necesario—:
   ```bash
   node .vibe/ia-stack-runtime/scripts/verify-research-candidates.mjs check research/candidates.json
   ```
   La evidencia tiene que citar `archivo:línea` **del archivo que el candidato declara**, y el
   contraejemplo no puede ser esa cita repetida. Un `adopt` sin test declarado rechaza.
   **Escribir un candidato obliga a leer la línea citada en el commit pineado**: no se puede
   producir desde la tabla de puntajes, y ése es exactamente el punto.
   El gate verifica forma y procedencia, **nunca que la línea citada diga lo que el candidato
   afirma**: no abre el archivo ni sale a la red.
2. **CAIO:** el diagnóstico mira **doce** dimensiones, no cuatro: proceso roto, información
   perdida, trabajo repetido, bucles abiertos, decisiones sin dueño, estados no medidos,
   handoffs defectuosos, errores que se repiten, ausencia de aprendizaje, costos ocultos,
   riesgos de seguridad y dependencia de memoria conversacional. Cada hallazgo se clasifica en
   una de **cuatro** clases, y cada etiqueta obliga a cargar lo suyo: `observed` no vale sin
   evidencia; `hypothesis` exige el motivo por el que todavía no es un hecho; `inference` exige
   `derived_from` con hallazgos que existan en el documento —una inferencia sin origen es una
   hipótesis con mejor nombre—; y `missing_data` exige qué falta **y cómo conseguirlo**.
   Una dimensión sin hallazgos no se deja en blanco: declara en `coverage` si se examinó y no
   había nada, o si no se examinó y por qué. Sin eso, ocho silencios se leen igual que ocho
   dimensiones sanas.
3. **Mapa de bucle actual→objetivo:** cada flujo declara **trece** campos: entrada,
   transformación, actor, decisión, quién decide, acción, métrica, control, evidencia,
   aprendizaje, siguiente iteración, condición de salida y condición de bloqueo. `decision` es
   **qué** se decide y `decision_owner` es **quién**: un bucle al que le falta una de las dos no
   se puede auditar —o no se sabe qué se resolvió, o no se sabe a quién preguntarle—.
   Entre los dos flujos va un `delta` **exacto**: cada cambio declarado tiene que corresponderse
   con una diferencia real entre `current` y `target`, y cada diferencia real tiene que estar
   declarada, con su `from`, su `to` y su motivo. Es lo único del mapa que el gate puede
   verificar contra el propio documento; el resto es prosa que no puede juzgar.
   El primer bucle a cerrar declara además **rollback** y **señales de fallo**: uno sin rollback
   es un cambio de una sola dirección, y uno sin señales de fallo se abandona en silencio.
4. **PRD + implementación:** el PRD declara **veintiuna secciones**, no un subconjunto: problema,
   usuarios, jobs-to-be-done, resultado, no-objetivos, alcance, fuera de alcance, requisitos
   funcionales, requisitos no funcionales, seguridad, privacidad, observabilidad, integraciones,
   datos, arquitectura, tecnología, criterios de aceptación, métricas, riesgos, rollout y
   rollback. Seguridad, privacidad y observabilidad son campos propios y no notas al pie de la
   tecnología: una sección que no existe no se puede dejar sin contestar por olvido.
   **Cada criterio de aceptación trae seis partes además del id**: evento, precondición, acción,
   resultado observable, test y evidencia esperada. Un `statement` en prosa no alcanza —no deja
   comprobar nada, y sobre todo no deja ver cuál de las seis partes falta—. El `test` se exige
   escrito, no resuelto: que la prueba exista y nombre al criterio lo comprueba
   `verify-evidence-trace.mjs criteria`, que es otro gate y otro momento.
   Una métrica sin línea de base no dice si mejoró, y un requisito no funcional sin medida es un
   deseo: «rápido» no se comprueba. La adopción y la recurrencia no van acá: tienen artefacto
   propio.
5. **Adopción + recurrencia:** la adopción distingue **dos personas**: `owner` sostiene el
   cambio y lo defiende cuando se discute; `operational_owner` lo ejecuta todos los días.
   Confundirlos es exactamente cómo un cambio queda sin nadie que lo haga. Además del
   `success_signal` —cualitativo, dice que se usa— va una `adoption_metric` con línea de base y
   objetivo: **sin línea de base no se puede afirmar que la adopción mejoró**, sólo que alguien
   la mira. Y un `adoption_checklist` con ítems verificables, uno por línea.
   La recurrencia declara `promotion_criteria` y `retirement_criteria`. Sin criterio de retiro,
   una mejora que dejó de servir se sostiene por inercia: nadie tiene con qué argumentar que hay
   que sacarla, y el costo de mantenerla no aparece en ningún lado.

6. **Superficie de ataque:** el artefacto que faltaba, y el único momento en que se puede escribir.
   Toda la seguridad de IA Stack era **posterior al código** —6.2 escanea un delta ya escrito, la lente
   Riesgo revisa un diff ya escrito—, así que nada declaraba **qué hay que proteger** antes de
   construir. Y `skills/security-baseline.md` dice textualmente que los huecos de **authz no están
   cubiertos** por el escáner: fue lo peor que apareció en la corrida real que motivó esto.

   El modelo declara `assets` (qué vale la pena proteger), `actors` (quién le puede hablar),
   `entrypoints` (por dónde entra dato ajeno, con el tipo y a qué activos llega), `controls` (qué
   lo guarda, de qué clase, **y con qué criterio de aceptación se prueba**), `accepted` (riesgo
   aceptado a propósito, con motivo y dueño) y `coverage` (cada clase de control sin entradas
   declara si se examinó y no hacía falta, o si no se examinó y por qué).

   **La invariante que importa, y es la única de fondo que un gate puede comprobar acá:** una
   entrada que alcanza un activo tiene que tener un control **o** una aceptación escrita. Una
   superficie que toca algo que vale la pena proteger, sin nada que la guarde y sin nadie que lo
   diga, es exactamente el agujero que este artefacto existe para hacer visible.

   **Es obligatorio para todo proyecto**, y su volumen escala con la superficie: una página estática
   declara cero `entrypoints` y seis líneas de `coverage` con motivo. Seis líneas, no seis
   secciones. Lo que no se admite es el silencio.

   **El puente con el resto del protocolo, y por eso no hace falta ningún mecanismo nuevo:** cada
   `control` declara un `ac_id`. De ahí lo arrastra el aparato que ya existe — RED escribe su prueba
   (LAW 1), `verify-evidence-trace.mjs criteria` exige que exista una prueba que lo nombre, y el
   receipt exige ese AC `COMPLIANT` con hash vigente. **Un control de authz declarado y no probado
   bloquea el push con los gates que ya estaban.**

   Va en Discovery y no en la spec porque la spec tiene tope de 650 palabras y secciones canónicas
   fijas; un modelo de amenaza adentro la rompe. Lo que sí pasa a la spec es la sección
   **`## Security surface / Superficie de ataque`**, que `verify-spec-wordcap --quality` exige
   **sólo si el proyecto declaró algún modelo** — y esa exigencia se deriva del árbol, no de una
   bandera que alguien tenga que acordarse de pasar.

Los seis resultados durables de esta fase viven en
`docs/discovery/<feature-slug>/diagnostics/`: `caio.json`, `loop-map.json`, `prd.json`,
`adoption.json`, `recurrence.json` y `threat.json`. Se validan juntos antes de abrir Spec:

> **Eran siete hasta el 2026-09-15.** `implementation.json` se fue porque **decía lo mismo que
> `tasks.json` con otras palabras** —medido sobre el último ciclo real: 7 pasos contra 6 tareas, el
> mismo trabajo— y `tasks.json` es el único plan que los gates de construcción leen de verdad. Se
> escribían los dos y uno se tiraba. De sus campos propios, `access_needed` **se mudó a la tarea**,
> donde ahora lo lee `verify-task-shape.mjs`; `validation` ya lo cubrían `verifier` y `evidence`;
> `rollback` existe por tarea, que es donde sirve, porque se revierte una tarea y no un lote. El
> único que se pierde es `release_gate`, y se pierde porque **ningún gate lo leyó nunca**: lo que
> condiciona publicar es LAW 8 y el recibo.

```bash
node .vibe/ia-stack-runtime/scripts/verify-product-diagnostics.mjs check <feature-slug> --require-inputs
```

El gate exige forma, IDs únicos, dependencias, relaciones y evidencia declarada; **Los diagnósticos
comprueban forma e invariantes, nunca verdad semántica.** La lectura del negocio, la suficiencia de
las fuentes y la decisión de construir siguen siendo responsabilidad humana y se registran en el
packet de Discovery.

Guardar cada decisión en `docs/discovery/<feature-slug>/runs/run-NNN/decisions/dNNN.json` y, si
termina `completed`, su snapshot de claims en
`docs/discovery/<feature-slug>/runs/run-NNN/packets/dNNN.json`. No editar una decisión cerrada:
una corrección agrega un sucesor con hash del predecesor. Antes de Spec:

```bash
node .vibe/ia-stack-runtime/scripts/verify-discovery-core.mjs check --feature <feature-slug>
node .vibe/ia-stack-runtime/scripts/verify-discovery-views.mjs render --feature <feature-slug>
node .vibe/ia-stack-runtime/scripts/verify-discovery-views.mjs check --feature <feature-slug>
```

Un verde acá prueba que el Markdown se regenera byte a byte desde el JSON, no que la vista alcance para decidir. **La vista no muestra motivos de skip, override ni el texto de los claims.** Para juzgar una decisión hay que abrir el JSON, no el resumen.

Al evolucionar el propio IA Stack, el inventario de requisitos Discovery también se comprueba contra la
fase que se pretende cerrar; no se declara una fase active sólo porque sus tests existan:

```bash
node scripts/verify-discovery-requirements.mjs check --completed-phase I2
```

El gate sigue la cadena de reemplazos de cada requisito hasta una fila activa con su prueba verde, y ahí se detiene: **nunca juzga si una regla reescrita o reemplazada sigue exigiendo lo mismo**. Un requisito puede quedar sustituido por otro que pide bastante menos, con el gate en verde: la equivalencia de significado la revisa una persona. Y la prueba que respalda cada requisito se valida como en `verify-test-bindings.mjs`: **el test se nombra, no se comprueba: alcanza con que exista y salga ok.**

```bash
node .vibe/ia-stack-runtime/scripts/verify-test-bindings.mjs check
```

Corre cada archivo de prueba vinculado **en aislamiento** y lee el resultado del formato de salida
exacto, no de una afirmación. Sólo acepta archivos locales del proyecto.

Un claim que cita un criterio o requisito inexistente es una referencia rota, no evidencia. El
último gate de la fase resuelve cada `linked_requirement_id` y `linked_ac_id` del packet de la
**decisión vigente** contra los identificadores que `docs/spec.md` declara en negrita:

```bash
node .vibe/ia-stack-runtime/scripts/verify-evidence-trace.mjs claims --feature <feature-slug>
```

En el primer Discovery todavía no hay spec y el gate sale 0 diciéndolo; empieza a morder en la
corrección de Discovery que se hace **después** de Phase 3, que es cuando el vínculo ya se puede
resolver. Un claim sin vínculo declarado no es un error: el gate cuenta los que sí lo declaran.
En el cierre, cuando la spec y el packet ya existen, el modo estricto convierte esa omisión en
rechazo: cada claim vigente tiene que enlazar al menos un requisito o criterio declarado.

```bash
node .vibe/ia-stack-runtime/scripts/verify-evidence-trace.mjs claims --feature <feature-slug> --require-inputs --require-links
```

`--require-links` implica `--require-inputs` y sólo es válido para `claims`; no cambia el modo
permisivo del primer Discovery. El modo estricto rechaza tanto un packet sin claims como un claim
sin vínculo. El gate sigue comprobando que el identificador enlazado exista, pero no demuestra que
el texto del claim sea semánticamente suficiente: esa parte continúa siendo revisión adversarial
humana.

Sin `--spec`, los vínculos se resuelven contra `docs/spec.md`, que es la spec del feature activo.
Eso es correcto mientras el feature esté abierto, y deja de serlo en cuanto `docs/spec.md` rota: un
packet es inmutable y pertenece a su feature, así que un vínculo correcto se rompe al rotar y —peor—
un identificador que la spec nueva reutiliza resuelve en verde significando otra cosa. Para releer
un Discovery ya cerrado hay que decir contra qué spec se resuelve:

```bash
node .vibe/ia-stack-runtime/scripts/verify-evidence-trace.mjs claims --feature <feature-slug> --spec docs/discovery/<feature-slug>/spec.md --require-inputs --require-links
```

El gate comprueba que el identificador exista en la spec indicada; **no comprueba que esa spec sea
la que le corresponde al packet**: elegir el archivo correcto es responsabilidad de quien lo corre.

`views/*.md` es sólo una vista derivada y reproducible: no admite timestamps, rutas absolutas ni
datos del entorno, y jamás sustituye los JSON inmutables. Los gates prueban forma, cadena, hashes y
reproducibilidad; no prueban por sí mismos suficiencia semántica de un claim. La decisión de pasar
a Spec sigue siendo humana, y este es el menú con el que se presenta.

🔵 **Discovery cerrado — ¿se abre la Spec?**

- **A)** Sí, pasar a la Spec — *(recomendado si los seis diagnósticos están en verde y ningún claim
  quedó sin vínculo)*. Lo que Research dejó escrito se congela: la Spec se escribe **contra eso**,
  no contra lo que uno se acuerda.
- **B)** Falta evidencia — [decime qué pregunta quedó sin contestar]. Se vuelve al packet, se
  agrega el claim con su fuente, y recién ahí se cierra. Una duda que se arrastra a la Spec se
  convierte en un criterio de aceptación que nadie puede comprobar.
- **C)** El problema cambió — volver al Intake. Si lo que Research encontró corre el problema de
  lugar, seguir a la Spec es escribir bien la solución equivocada.

Esperando tu respuesta antes de continuar.

---
