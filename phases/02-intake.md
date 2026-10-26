## PHASE 1.5 — INTAKE (antes de Research)

Lo primero que hay que preguntar, y lo que el protocolo no preguntaba. Bootstrap resuelve el
stack y el nivel de rigor; Research ya asume que hay un producto definido. Entre las dos no había
nada que capturara **qué se quiere construir**, así que el ciclo arrancaba sobre lo que el agente
supuso — y el supuesto no quedaba escrito, de modo que nadie podía señalarlo después.

Se salta sólo cuando el auto-routing ya mandó a Direct Build (Phase 1, paso 10): un cambio de tres
archivos sin ambigüedad no necesita un expediente de producto. Para todo lo demás es entrada
obligatoria de Research.

Preguntale al usuario, una por una, y **esperá la respuesta**. No las contestes vos:

1. ¿Qué querés construir?
2. ¿Para quién? ¿En qué momento de su trabajo lo va a usar?
3. ¿Qué problema resuelve? ¿Qué pasa hoy sin esto?
4. ¿Qué resultado operativo esperás — qué va a poder hacer alguien que hoy no puede?
5. ¿Qué restricciones hay? ¿Qué no se puede tocar, romper ni gastar?
6. ¿Qué fuentes querés aportar? (Si no hay ninguna, se registra así.)
7. ¿Hace falta un artefacto visual — diagrama, vista, maqueta — y para quién?
8. ¿Pedís sólo diagnóstico, o también implementación?

La novena va aparte porque no es prosa libre: es un enum cerrado, y por eso se pregunta con menú.

🔵 **¿Qué tipo de producto es?**

- **A)** Sitio web o landing
- **B)** Aplicación web
- **C)** Progressive Web App
- **D)** Aplicación de escritorio o híbrida
- **E)** Sistema Python: trading, datos, automatización, research o IA
- **F)** Integración, API, backend o proceso interno
- **G)** Artefacto: documento, plan, planilla, presentación, imagen o dashboard
- **H)** Otro — hay que escribir por qué ninguno de los siete alcanza

La marca `— *(recomendado)*` se pone sobre el código que se deduce de las respuestas 1 a 8, citando
de cuál sale. **No hay un tipo recomendado por defecto, y no puede haberlo**: recomendar antes de
escuchar sería el defecto que este expediente existe para evitar.

Esperando tu respuesta antes de continuar.

Es enum y no prosa porque la matriz de stacks se indexa por ese código, y un texto libre la volvería
incomparable entre ciclos. El **motivo es obligatorio para los ocho**, no sólo para `H`: un código
sin motivo es un clic, no una clasificación, y nadie puede revisar después si estuvo bien
clasificada. Mismo criterio que el campo `reason` de cada decisión en `docs/phase-decisions.json`.
**Límite honesto**: el gate comprueba que el código sea uno de los ocho y que el motivo no esté
vacío. **No sabe si el producto es realmente de ese tipo** — una clasificación coherente y
equivocada pasa en verde.

Escribí las respuestas en `docs/intake/<feature-slug>.json` desde `templates/intake.json`. Los
**supuestos**, los **riesgos** y las **preguntas abiertas** van en sus listas propias, cada uno con
id: lo que quede mezclado adentro de una respuesta no se puede señalar después. Una pregunta que
el ciclo no puede saltear se marca `bloqueante: true`, y entonces el gate frena hasta que se
conteste. **No inventes una respuesta para destrabar el gate**: eso convierte el expediente en
decoración, que es exactamente lo que este archivo existe para evitar.

```bash
node .vibe/ia-stack-runtime/scripts/verify-intake.mjs check docs/intake/<feature-slug>.json
```

Sin ningún intake el gate escribe `VACÍO:` y sale `0`: un proyecto que todavía no arrancó no
incumple nada. **El gate verifica forma, nunca verdad**: no sabe si una respuesta es correcta ni
si alguien la contestó de verdad, y un supuesto escondido adentro del texto de una respuesta le es
invisible. Que las respuestas digan algo sigue siendo juicio humano.

### La novena pregunta se contesta con la matriz, no de memoria

Un tipo de producto declarado y nadie que lo lea es un lazo abierto: preguntar con qué se construye
y no poder contestar es peor que no preguntar. Con el código en la mano, abrí
`contracts/stack-matrix.json` —la matriz canónica, que viaja con el runtime porque el instalador
copia `contracts/`— y contestá con **cuatro cosas, las cuatro o ninguna**:

1. **El stack recomendado** de la fila de ese código, y sus **alternativas con su cuándo**. Nunca el
   recomendado solo: una recomendación sin alternativa es una orden disfrazada.
2. **De qué fuente sale y de qué fecha es** — `sources` y `captured_at` de la matriz.
3. **Qué lo saca del plan gratuito y desde cuánto se paga**: por cada entrada de `free_tier_refs` de
   la fila, el `upgrade_trigger`, el `paid_from` y la lista `escalation` de
   `contracts/free-tier-limits.json`. Esto es el costo de crecer, y es obligatorio: «es gratis» sin
   decir qué lo rompe es la recomendación que este paso existe para impedir.
4. **Si la fila no referencia ningún plan gratuito**, su `no_free_tier_reason` dice por qué. No es un
   hueco: es un producto que no corre en un servicio alojado.

El procedimiento completo, la tabla legible por tipo y la de costo de escalar están en
`skills/stack.md`, que es la copia para personas del mismo dato —
`tests/stack-matriz-pareada.test.mjs` comprueba que las dos digan lo mismo. **El dato se lee del
JSON, nunca de la memoria del modelo**: las versiones y los cupos vencen, y el modelo no sabe cuándo.

```bash
node .vibe/ia-stack-runtime/scripts/verify-stack-matrix.mjs check .vibe/ia-stack-runtime/contracts/stack-matrix.json
```

Sin matriz ni contrato el gate escribe `VACÍO:` y sale `0`: un proyecto que todavía no eligió stack
no incumple nada. **Límite honesto**: el gate comprueba que cada campo esté escrito, fechado y que no
sea relleno, y que la captura esté dentro del período que el propio contrato declara. **Nunca que el
número sea cierto ni que siga vigente hoy** — no sale a la red, lee un archivo que alguien escribió.
Y `verify-intake.mjs` no sabe si el producto es realmente de ese tipo: una clasificación coherente y
equivocada pasa en verde, y arrastra el stack equivocado detrás.

Al cerrar, presentá 🔵 con al menos dos opciones y registrá la elección: seguir a Research, volver
a preguntar lo que quedó flojo, o parar.

---
