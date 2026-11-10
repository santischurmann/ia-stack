# IA Stack

Un método para construir software con un agente de IA gastando lo mínimo y sin romper lo que
ya anda. Versión **3.4.4**.

## Qué es

Un protocolo de 10 fases con gates que se ejecutan. Primero pregunta qué querés crear, diagnostica
qué conviene programar, investiga, define la marca y la spec, y te muestra un preview navegable.
Recién con tu aprobación construye, siempre con la prueba roja primero.

Seis ideas lo sostienen:

1. **Menos IA.** Primero un script; si no alcanza, el modelo más barato que resuelva.
2. **Preguntar antes que suponer.** Una tanda de preguntas por fase, con opciones.
3. **Tu cupo manda.** Lee tu plan al arrancar y acomoda el trabajo a lo que queda.
4. **El contexto no se pierde.** Una sesión nueva retoma desde `.ia-stack/ESTADO.md`.
5. **Sin preview aprobado no se construye nada visible. Sin test rojo no hay código.**
6. **Sin residuos.** Al cerrar no quedan temporales ni sesiones abiertas.

## Para quién

Para quien construye con Claude Code o con otro agente que lea `AGENTS.md`, sea una persona sola o
un equipo. No hace falta saber programar para aprobar pedidos y previews; sí para leer un diff.

## Instalación en 3 pasos

1. Cloná el repositorio: `git clone https://github.com/<tu-usuario>/ia-stack.git`.
2. Instalalo en tu proyecto: `./scripts/install.sh --project /ruta/a/mi-proyecto`
   (en Windows: `.\scripts\install.ps1 -ProjectDir C:\ruta\a\mi-proyecto`).
3. Reiniciá Claude Code, abrí el proyecto e invocá `/ia-stack`.

Detalle, opciones y problemas comunes en [`INSTALL.md`](INSTALL.md).

## El recorrido

`node scripts/tamano.mjs` calcula el tamaño del pedido y con él el recorrido.

| Tamaño | Qué es | Fases |
|---|---|---|
| chico | hasta 3 archivos, sin pantalla nueva, sin área de riesgo | 0 1 7 8 9 |
| medio | funcionalidad sobre un proyecto que ya existe | 0 1 3 5 6 7 8 9 |
| grande | proyecto o módulo nuevo | 0 a 9 |

Plata, seguridad, autenticación y migraciones de datos nunca son «chico». Ante la duda, el mayor.
Un chico con cambio visible aprueba un boceto. La fase 2 (CAIO) es sólo de tamaño grande; en medio,
la fase 3 corre sólo el radar de versiones.

| Etapa | Fase | Qué pasa | Entrega |
|---|---|---|---|
| | 0 Arranque | lee estado y cupo | 5 líneas |
| Descubrir | 1 Pedido | preguntas, tres enfoques, tamaño | `docs/pedido.md` |
| Descubrir | 2 CAIO (grande) | qué programar, qué con IA, qué manual | `docs/caio.md` |
| Descubrir | 3 Research | competidores, buenas prácticas, versiones | `docs/research.md` |
| Definir | 4 Marca | atributos, paleta, tipografías, tono | `docs/marca.md` |
| Definir | 5 Spec | una página, revisada por lectores sin contexto | `docs/spec.md` |
| Definir | 6 Preview | maqueta navegable, hasta 3 rondas | preview aprobado |
| Construir | 7 Build | rojo, código, verde, commit local | código y tests |
| Entregar | 8 Publicar | suites, seguridad, revisión, recibo, un push | recibo y push |
| Entregar | 9 Cierre | limpia residuos, anota métricas y lecciones | 1 línea de métricas |

En contexto viajan `SKILL.md`, `ESTADO.md` y la fase en curso: unos 6.000 tokens.

## Cómo aprobás

Aprobás escribiendo en el chat una frase exacta; el hook `node scripts/aprobar.mjs hook` (evento de
mensaje del usuario) la registra en `.ia-stack/APROBACIONES.md`.

| Aprobación | Fase | Frase |
|---|---|---|
| 1 pedido | 1 | `apruebo pedido v1` |
| 2 research | 3 | `apruebo research v1` |
| 3 marca | 4 | `apruebo marca v1` |
| 4 preview | 6 | `apruebo preview v1` (en un chico visible: `apruebo boceto v1`) |
| orden de producción | 8 | `apruebo produccion <sha del commit>` |

## Los 8 gates

Un gate es un script que frena si algo no se cumple (`contracts/gates.json`).

1. Test rojo visto antes del código. 2. El diff toca sólo los archivos de la tarea.
3. Preview aprobado. 4. Verificación con recibo. 5. Producción atada al sha aprobado.
6. Cupo y contexto. 7. Versiones de stack estables y compatibles. 8. CI sólo en el push único.

Los gates 1, 3, 4 y 5 están protegidos: ninguna poda los saca.

## Modelos

Siempre con esfuerzo `low`. El modelo nunca se te pregunta.

| Nivel | Claude | Codex | Para qué |
|---|---|---|---|
| script | sin IA | sin IA | contar, medir, validar, limpiar, consultar versiones |
| barato | Haiku | Luna | leer, buscar, logs, git, documentación (default) |
| medio | Sonnet | Terra | tests, pantallas, patrón conocido |
| fuerte | Opus | Sol | marca, spec, áreas de riesgo, revisión |
| orquestador | Fable | Astra | sólo la sesión que reparte trabajo |

Si una prueba sigue fallando tras un intento, la tarea sube un nivel. Si falla el fuerte, se frena y
se te pregunta. Revisa un nivel fuerte distinto del que construyó (otra sesión u otro host; si no
hay, revisás vos). Fuente: `contracts/model-routing.json`.

## Tu cupo

La fase 0 lee tu plan y lo que te queda (`contracts/planes.json`). Si el host no lo informa, te
pregunta el plan una vez y deja el cupo como «desconocido»: nunca lo estima. Al 85 % de la
ventana de 5 horas frena lo que no sea la tarea en curso y te dice cuándo se reinicia.

## Qué archivos crea en tu proyecto

| Ruta | Qué es |
|---|---|
| `.ia-stack/runtime/` | copia del protocolo y sus scripts (ignorada por git) |
| `.ia-stack/ESTADO.md` | fase, tamaño, cola de tareas, cómo retomar |
| `.ia-stack/APROBACIONES.md` | tus aprobaciones, con texto literal, fecha y sha |
| `.ia-stack/metricas.jsonl` | cupo y modelo por bloque |
| `.ia-stack/LECCIONES.md` | cada escalada y cada retrabajo |
| `.ia-stack/historial.md` | lo que salió de `ESTADO.md` |
| `docs/` | pedido, caio, research, marca, spec y plan |
| `.claude/skills/ia-stack/`, `.agents/skills/ia-stack/` | punteros a la skill |

## Migrar desde una versión anterior

```bash
node scripts/migrar.mjs /ruta/a/mi-proyecto
```

Hace una copia de respaldo, pasa el estado anterior a `.ia-stack/`, arma `ESTADO.md` con el
formato nuevo y conserva tus aprobaciones vigentes con su sha. Correrlo dos veces no cambia nada.

## Estructura del repositorio

```text
SKILL.md      el núcleo: se lee siempre
phases/       10 fases, hasta 60 líneas cada una
skills/       6 apoyos: brainstorm-egm, encargo, modo-breve, recibo-y-seguridad, stack, tdd
contracts/    ruteo de modelos, gates, planes, matriz de stack
templates/    pedido, caio, research, marca, spec, plan y estado
scripts/      gates (verify-*.mjs), arranque, tamaño, métricas, instaladores
tests/        la suite de node:test
```

## Qué garantiza, y qué no

Garantiza que cada gate sea un script que se corre y frena. No garantiza que el producto sea
correcto: un gate verde dice que se cumplió lo que ese script mira, no más. El escáner de
seguridad es de patrones y no reemplaza una revisión especializada (ver [`SECURITY.md`](SECURITY.md)).

## Más

[`INSTALL.md`](INSTALL.md) · [`SECURITY.md`](SECURITY.md) · [`CHANGELOG.md`](CHANGELOG.md) ·
[`AGENTS.md`](AGENTS.md) · [`docs/spec.md`](docs/spec.md) (la spec de esta versión)

Licencia MIT, ver [`LICENSE`](LICENSE).
