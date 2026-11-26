# Cambios

## [3.4.6] - 26-11-2026

Correcciones de la ronda 10 de EGM y de diez pasadas de lector sin contexto (13-11-2026), y novedades de Claude Code (26-11-2026). Sin etiqueta en git todavía.

- `verify-egm-convergencia.mjs`: cada registro exige `lectores`, `altos`, `medios` y `bajos` enteros de 0 o más (`registro inválido: <campo>`); el régimen simple rechaza `lectores` no entero; un BOM inicial en `metricas.jsonl` no rompe la lectura.
- `context-guard.mjs`: un contrato sin `contexto.handoff` o con `ventana_max` inválida ya no apaga el guard; avisa que no hay handoff también cuando falla por otra causa.
- `handoff.mjs`: un BOM inicial no esconde `## Objetivo` ni cuenta como carácter; una línea `## ` sin texto es un encabezado de más. Declara que no interpreta Markdown.
- `ventana.mjs`: `leerVentana` responde `contrato sin contexto.ventana_max` ante un contrato ausente o que no es JSON, y exige una ventana no menor que los topes de relevo; un `settings.local.json` ilegible es `INVALIDO`; un hook cuenta sólo si es `type: command` con el comando exacto; `mismaCarpeta` recibe la plataforma.
- `contracts/model-routing.json` § `contexto.por_que`: aclara que el techo rige donde el host recibe la variable y que el respaldo es el guard, que mide sobre mensajes.
- Pruebas nuevas para cada caso; la de `mismaCarpeta` usa rutas neutras.
- Esfuerzo `medium` único: campo raíz `esfuerzo` en `contracts/model-routing.json`, que leen `esfuerzoPermitido` y `ventana.mjs`; `low`, `high`, `xhigh` y `max` no se usan. Con poco cupo baja el nivel, nunca el esfuerzo; `presupuesto.revisar_si` da el umbral.
- `ventana.mjs`: deja `"effortLevel": "medium"` en `.claude/settings.local.json` (uno distinto se reemplaza); `check` y `arranque.mjs` lo exigen; avisa si `CLAUDE_CODE_EFFORT_LEVEL` difiere. `--sin-ventana` / `-SinVentana` lo saltea con la ventana y los hooks. Codex: `model_reasoning_effort = "medium"`.
- Fuera las reglas por recursos: RAM, disco y «un proceso pesado a la vez». Suites a la vez sólo con puerto y base de prueba propios (`encargo.suites_en_paralelo`).
- Fase 8: el revisor abre la rama en otra sesión, sin la conversación del constructor, y si el host lo tiene corre `/code-review medium <rama>` sin `--fix`. `/ship` y `/steward` no se usan.
- `skills/encargo.md` § «Si el host lo tiene»: `model`, `effort`, `maxTurns`, `isolation: worktree`, workflows y Code Mode con su condición; advisor y skills desde MCP, no.
- Prueba nueva `tests/protocolo-host.test.mjs`; el caso con sabor a dominio de `clasificar-tarea.test.mjs` pasa a uno neutro.
- EGM del protocolo, ronda 1: la fase 7 pone la ronda de alto requisito antes del gate que la exige y dice que el gate verifica el EGM, no los 5 pasos; la fase 8 corre el EGM antes del recibo, guarda la salida de las suites fuera del árbol, frena si falla el push de corrección y consume la orden de producción antes de desplegar.
- Rol del build en nivel medio (rojo, verde y limpio); barato sólo para lo mecánico. Los lectores de `preview` también van en nivel fuerte.
- Contexto: relevo al 70 % del tope (120K y 60K sobre mensajes); el handoff a 180K y la ventana de 300K quedan como respaldo, en `SKILL.md` e `INSTALL.md`.
- Ritmo de cupo descripto como lo calcula `ritmoPresupuesto` (14 % por día corrido, 20 % por hora de la ventana); `presupuesto.si_va_encima` ya no baja de barato. Sale `escalada.tercer_intento`, que ningún script leía.
- `INSTALL.md`: bash obligatorio para los hooks, la skill es un puntero, rutas globales por defecto; `SKILL.md` dice cómo correr `node scripts/<script>.mjs` en un proyecto instalado.
- EGM del protocolo, ronda 2: la fase 8 aclara que lo que está con `git add` no ensucia el árbol (`.ia-stack/` se agrega antes del recibo, que va en `.ia-stack/receipts/`), cómo volver tras un cambio del EGM, la rama a otro host por `git bundle` y qué hacer con `.ia-stack/` después del push.
- Revisor unificado en todos los textos: una sesión de nivel fuerte distinta de la que construyó, que puede ser el mismo modelo.
- `INSTALL.md`: el instalador escribe tres cosas (también el runtime global) y lista las reglas de `.gitignore` que agrega; sección «Hooks a mano» con el JSON del hook de aprobaciones y del `PreToolUse` del gate 1, que el instalador no deja.
- Fase 7: qué leen los lectores de `plan-<id>`, cuándo pasar `--tamano` y la tarea sin presupuesto queda «en pausa». EGM: una pieza de más de 3 rutas se lee en grupos de hasta 3. `leccion.mjs anotar` con sus campos obligatorios.
- EGM del protocolo, ronda 3: el recibo se commitea con `verify-receipt.mjs commit` (paso nuevo en `skills/recibo-y-seguridad.md`, que además nombra los campos de `refutation`); la fase 8 cierra el bucle de revisión y la tarea «en pausa»; el worktree pasa el gate 2 antes del merge; el reporte del encargo tiene un solo formato.
- `INSTALL.md` y README: el hook de aprobaciones va dentro del `UserPromptSubmit` existente, el del gate 1 no tiene reemplazo, desinstalar también limpia el proyecto y el boceto del chico se aprueba en la fase 1.
- EGM del protocolo, ronda 4: la tarea «en pausa» sale de `docs/tasks.json` hasta retomarla, para no frenar el gate 3 de las demás; la orden de producción va con el sha del último commit pusheado con el CI en verde; la ronda de la fase 7 también corre en área de riesgo y la arma el nivel fuerte; el README suma los hooks a mano al paso 3; el recibo nombra los campos de cada medición.
- EGM del protocolo, ronda 5: la tarea «en pausa» que se retoma vuelve a pasar el gate 3 antes de su rojo; `INSTALL.md` pone los hooks a mano antes de reiniciar, como el README; la plantilla del encargo pega el formato del reporte; el recibo dice que `measured: false` exige `-1` y `reason`; los lectores de chico cuentan `protocolo` en lugar de `publicar`.

## [3.4.5] - 13-11-2026

- Regla fija «ronda de brainstormings + EGM» (`skills/brainstorm-egm.md`, `contracts/model-routing.json` § rondas): 5 pasos en orden, EGM de 5 a 10 rondas, siempre Opus; excepción al modelo más barato.
- Las rondas se aplican en las fases 2, 4, 5, 7 (por tarea de alto requisito) y 8 (`rondas.fases`); chico no corre.
- El instalador sella también el runtime global (`INSTALADO.json`), en bash y PowerShell.
- Ventana de contexto de 300K como máximo en toda sesión, orquestador o anidada (`contexto.ventana_max`); llena, se compacta. `context-guard.mjs` lo ordena e `INSTALL.md` dice cómo fijarla en Claude Code y Codex.
- **Cambio de contrato** en `verify-egm-convergencia.mjs`: `spec`, `plan-*`, `publicar` y `protocolo` pasan al régimen de ronda (5 a 10 rondas, la última limpia, o la décima con `decide_persona`); `preview` conserva el régimen de 3.4.4; una pieza fuera de las listas de `rondas.egm` falla.
- **Cambio de contrato** en `verify-aprobacion-humana.mjs tareas`: cada tarea lleva `id` único y `description`, y una de alto requisito exige su ronda EGM convergida en la pieza `plan-<id>` (`--metricas`, `--tamano`).
- Handoff antes de compactar: a los 180.000 tokens de mensajes `context-guard.mjs` ordena escribir `.ia-stack/handoffs/ULTIMO.md` (plantilla `templates/estado/HANDOFF.md`, hasta 40 líneas); `scripts/handoff.mjs check|mostrar` lo valida y lo devuelve al contexto después de compactar.
- `scripts/ventana.mjs check|aplicar`: el instalador deja en `.claude/settings.local.json` la variable de compactación en 300000 y los dos hooks; `--sin-ventana` / `-SinVentana` lo saltea y `arranque.mjs` avisa si falta.
- `siguienteNivel` en `clasificar-tarea.mjs` y plantilla de falla en `skills/encargo.md`.
- Enrutamiento por falla explícito en `escalada.por_falla`: barato pasa a medio y medio a fuerte, con la falla exacta.

## [3.4.4] - 10-11-2026

Protocolo rehecho de cero: más corto, con menos IA y con el cupo de la persona al mando.

- 4 etapas y 10 fases (0 a 9), un archivo de hasta 60 líneas por fase. `SKILL.md` queda en 120 líneas.
- En contexto viajan sólo `SKILL.md`, `.ia-stack/ESTADO.md` y la fase en curso: unos 6.000 tokens, antes unos 40.000.
- 8 gates en `contracts/gates.json`; el 1, el 3, el 4 y el 5 están protegidos.
- 4 niveles de modelo (barato, medio, fuerte, orquestador), siempre con esfuerzo `low`. Fable sólo para el orquestador.
- Lee el plan y el cupo al arrancar (`contracts/planes.json`); frena al 85 % de la ventana de 5 horas.
- Tamaños chico, medio y grande, calculados por `scripts/tamano.mjs`, que acortan el recorrido.
- Nuevas fases de diagnóstico CAIO, mini marca y preview navegable antes de construir.
- Brainstorming y EGM incorporados al método (`skills/brainstorm-egm.md`), sin depender de plugins.
- Estado en `.ia-stack/` (`ESTADO.md`, `APROBACIONES.md`, `metricas.jsonl`, `LECCIONES.md`); `scripts/migrar.mjs` convierte proyectos de versiones anteriores.
- Se quitaron 51 gates, las 13 fases viejas y 10 skills; quedan 6 skills de hasta 80 líneas.
- Aprobaciones con frase exacta por chat (`apruebo pedido v1`, `apruebo produccion <sha>`); `scripts/contraste.mjs` calcula el contraste WCAG; `leccion.mjs` acepta `barato|medio|fuerte`.
