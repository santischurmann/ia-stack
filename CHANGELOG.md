# Cambios

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
