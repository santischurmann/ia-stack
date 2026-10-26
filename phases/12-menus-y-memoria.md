## CONFIG MENU PROTOCOL

**La linea de exito de un gate se cita sola, asi que su limite tiene que viajar con ella.**
Un verde se pega en `.vibe/SESSION.md`, en un recibo o en un informe; el README no viaja con el. Si
el gate afirma algo que no prueba, esa afirmacion sobrevive sin su descargo. Por eso
`verify-phase-decisions.mjs` y `verify-receipt.mjs custody` imprimen su limite junto al OK, y
cualquier gate nuevo que afirme algo sobre personas tiene que hacer lo mismo.


Once per phase, before content decisions. **Lista, nunca bloque de código**: medido en CommonMark
estricto y en GFM, las líneas sueltas `A)` / `B)` dentro de un fence colapsan a un solo párrafo, y
un fence renderiza como caja de código. La letra va **adentro** del ítem, no como lista ordenada
nativa, porque `A)` es el token con el que la persona contesta y una `<ol>` lo borra.

🔵 **[FASE] CONFIG**

- **A)** [opción] — *(recomendado)*
- **B)** [opción]

Esperando tu respuesta antes de continuar.

**Registrar la decisión EN EL MOMENTO, no después.** Apenas la persona responde, se agrega la
entrada a `docs/phase-decisions.json` con el menú textual que se le mostró, la recomendación, la
opción que eligió, su motivo, y las dos marcas de hora reales: `shown_at` cuando se mostró el menú
y `timestamp` cuando respondió.

No es burocracia, es la única ventana en que el dato existe. Reproducido el 2026-08-29: ocho
decisiones de una sesión anterior quedaron registradas en `SESSION.md` como una tabla
«Decisión | Elegido», sin menú y sin hora. **Reconstruirlas después habría exigido inventar ocho
menús y dieciséis timestamps dentro del archivo que respalda la afirmación de consentimiento del
protocolo** — y este gate declara explícitamente que no puede detectar eso. Se decidió no
reconstruirlas (`.vibe/DECISIONS.md`), así que el registro de esa sesión se perdió para siempre.

El hueco no fue de las personas: el protocolo pedía **mostrar** el menú y no obligaba a
**escribirlo** en ninguna parte. Una decisión que no se registra mientras ocurre no se puede
registrar honestamente nunca más.

**El formato del menú lo verifica un gate, no la buena memoria.** Un menú escrito como bloque de
código colapsa a un solo párrafo: la plantilla que este mismo archivo prescribía lo hacía así, y
ningún gate se enteraba.

```bash
node .vibe/ia-stack-runtime/scripts/verify-menu-shape.mjs check SKILL.md
```

Rechaza todo bloque `🔵` que no sea una lista de al menos dos opciones `- **A)** texto`, con marca
de recomendación explícita y línea de espera al final, **salvo** uno precedido por la marca
`<!-- menu-shape: ejemplo -->`, que el gate saltea para que el protocolo pueda citar el
anti-patrón y explicarlo. La marca tiene que ser el comentario solo, al principio de la línea, y
vale para un solo bloque: si valiera para el resto del archivo, una marca suelta arriba de todo
apagaría el gate entero.

**El gate no juzga si el bloque marcado es de verdad un ejemplo** — quien escribe la marca se hace
cargo. La mitigación es que sea literal y buscable: `grep -rn "menu-shape: ejemplo"` lista todas
las excepciones de un repo en una línea.

**El emoji `🔵` queda reservado para las decisiones.** No es decoración: es la única señal por la
que el gate encuentra un menú. Un aviso, una nota o un encabezado que lo use se rechaza, y así
tiene que ser — si el emoji significara dos cosas, el gate no podría distinguir un aviso correcto
de un menú roto. Para destacar algo que no es una decisión: negrita, cita o `**Nota:**`.

**Verifica las plantillas, no la conversación**: no puede saber qué mensaje escribió el agente ni
cómo lo pintó la terminal, y nada verifica eso de forma portable.

**La marca de recomendación puede vivir en cualquier línea del menú**, no necesariamente sobre una
opción. No es un descuido del gate: hay menús cuya recomendación **no puede** estar escrita de
antemano, porque depende de lo que la persona acaba de contestar — el de tipo de producto de la
fase 1.5 es el caso, y ahí la plantilla dice dónde va la marca en vez de traerla puesta. El costo de
esa tolerancia es que una frase suelta que mencione la marca satisface el gate sin que ninguna
opción esté recomendada de verdad. Se acepta a propósito: la alternativa es prohibir los menús
derivados, que son justo aquellos donde recomendar sin escuchar sería el error.

## EL MENÚ CLICKEABLE ES UN UPGRADE POR HOST, NO EL PROTOCOLO

**Medido, no supuesto.** No existe forma portable de que un menú sea clickeable. En Claude Code hay
una herramienta nativa de selección. En Codex el cliente MCP declara la capacidad `elicitation` y
parsea correctamente un menú con etiquetas —verificado con una traza real— pero **nadie observó
todavía uno renderizado**: en tres intentos el servidor declinó al instante y el formulario nunca
llegó a una persona. En un agente genérico que sólo lee Markdown no hay mecanismo alguno.

El piso común en toda IA es Markdown. Por eso **el canon es la lista Markdown**, y "clickeable" es
una capa de presentación que se dibuja sobre las **mismas** `options[]` cuando el host la tiene. Un
menú Markdown no es una versión degradada del clickeable: es la forma completa.

**Regla de integración, y va escrita antes de usar cualquier selector nativo.** Un selector nativo
puede ofrecerle a la persona una salida que el menú no tenía —en Claude Code la UI agrega siempre
una opción "Other" de texto libre, y no se puede desactivar—. Entonces:

1. `options[]` se registra con las etiquetas **tal como se mostraron**. La herramienta devuelve la
   etiqueta, no un identificador: si el registro guarda otra cosa, guarda una ficción.
2. **El texto de "Other" NUNCA se escribe como `selected_option`.** Reproducido: hacerlo hace que
   `verify-phase-decisions.mjs` rechace la fase entera con `PHASE_DECISION_OPTION_UNKNOWN`.
3. Si la persona responde por fuera del menú, hay dos caminos honestos y ninguno más: **volver a
   preguntar** con un menú que ya incluya esa opción, o marcar la decisión anterior como
   `superseded` y abrir una nueva. Nunca reescribir el menú viejo para que la respuesta encaje —
   eso rompe el hash de esa decisión y toda la cadena hacia adelante, que es exactamente para lo
   que el sello existe.

**Límite honesto.** Esto mejora cómo se ve la decisión y hace verificable su FORMA. **No hace
verificable la voluntad**: un registro coherente e inventado sigue pasando en verde, y ningún
mecanismo de acá acerca a probar que una persona vio un menú. `verify-phase-decisions.mjs` ya lo
dice en su propio texto y nada de esto lo mueve.

## CONTENT DECISION PROTOCOL (unchanged)

🔵 **[TEMA DE LA DECISIÓN]**

[Contexto: por qué importa, en una línea]

- **A)** [opción] — [trade-off] — *(recomendado)*
- **B)** [opción] — [trade-off]

Esperando tu respuesta antes de continuar.

Respondido el 🔵 que cierra una fase, la decisión se registra en `docs/phase-decisions.json`
(plantilla: `templates/phase-decisions.json`) antes de abrir la fase siguiente. Cada entrada lleva
`phase_id`, `phase_name`, el `options[]` completo **tal como se mostró**, `recommendation`,
`selected_option`, `reason`, `timestamp`, `input_hash`, `previous_hash`, `current_hash` y `status`
(`decided` | `superseded`). El sello usa el mismo encadenado que `verify-audit-chain.mjs`
—`sha256(cadena anterior + LF + contenido)`— sobre los nueve campos de contenido, `options` y
`selected_option` incluidos: editar el menú de una decisión pasada para que la opción elegida
parezca haber estado ahí rompe el hash de esa decisión y la cadena hacia adelante. El gate no
escribe: el sello se calcula con `hashDecision(previous_hash, decision)` del propio módulo.

Gate durante el trabajo: `node .vibe/ia-stack-runtime/scripts/verify-phase-decisions.mjs check docs/phase-decisions.json`
(sin archivo escribe `VACÍO:` y sale `0`: un proyecto que no arrancó ninguna fase no incumple nada; agregá `--require-inputs` para que esa ausencia sea rechazo).
Gate de cierre: agregá `--require-complete`. En ese modo, cada identificador de `phase_order` tiene
que tener una decisión vigente (`decided`) con su menú, recomendación, elección y motivo; una fase
omitida no puede esconderse detrás de un verde parcial. `--require-complete` implica
`--require-inputs`, por lo que un archivo ausente o vacío rechaza.

Para que el propio registro no pueda inventar su orden, copiá `templates/phase-plan.json` a
`docs/phase-plan.json` y mantené allí el plan canónico de la feature. Reemplazá `feature` y listá
**tus** fases con los números de este documento (`1`, `1.5`, `2`, `3`, `4`, `5`, `5.5`, `6`, `7`,
`8`, `9`). La plantilla viene con `["1","2","3"]` —las mismas que ejemplifica
`templates/phase-decisions.json`— para que las dos pasen el gate el día uno: hasta el 2026-09-04
traía diez slugs en inglés que no existían como fase en ningún otro lado, y la plantilla rechazaba
contra su propia compañera. En el cierre corré además:

```bash
node .vibe/ia-stack-runtime/scripts/verify-phase-menu.mjs check docs/phase-decisions.json --plan docs/phase-plan.json
```

Este segundo gate exige que el orden del registro coincida exactamente con el plan y que todas las
fases del plan tengan menú, recomendación, elección y motivo. El plan también es una decisión de
producto: el gate verifica consistencia, no que el orden elegido sea el correcto.

---

## MEMORY UPDATES

| File | When | What |
|---|---|---|
| `SESSION.md` | cada fase y cada gate | 1 línea por gate — el registro para retomar |
| Engram `mem_save` (si el tool está presente) | mismos momentos que la fila de arriba | duplicado opcional, `topic_key: vcp/<project>/<feature-slug>/gate-state` (upsert — nunca acumula), `type: config`. El prefijo de esa clave es el del nombre anterior y **se queda a propósito**: es la clave con la que ya están guardadas las memorias de cada instalación, y cambiarla las dejaría sin encontrar |
| `DECISIONS.md` | choosing between approaches | decision + reasoning |
| `PATTERNS.md` | al descubrir una convención del proyecto | patrón + ejemplo + cuándo aplica |
| `DEBT.md` | deferring cleanup, or 6.2 medium/low findings | what, where, severity, why deferred |
| `RETRO.md` | fin de la Fase 8 (8.3), siempre | entrada de 5 líneas: qué salió / plan contra realidad / fricción / qué conservar / qué cambiar |
| `LESSONS.md` | fin de la Fase 8 (8.3), después de RETRO, con confirmación | entrada con qué pasó, por qué, cómo evitarlo y su señal de detección — sólo después de que la persona confirme |
| `AUDIT.md` | cada gate, en el mismo momento que `SESSION.md` | 1 línea: papel, acción, evidencia y referencia de fase o tarea — el rastro de responsabilidad: sólo se agrega |
| `COMPANY.md` | sólo cuando la persona fija un presupuesto de sesión | se actualiza únicamente la línea `**Session budget:**` — el organigrama nunca cambia en medio de una sesión |
