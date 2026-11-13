# Cambios

## [Sin publicar] - 13-11-2026

- Regla fija «ronda de brainstormings + EGM» (`skills/brainstorm-egm.md`, `contracts/model-routing.json` § rondas): 5 pasos en orden, EGM de 5 a 10 rondas, siempre Opus; excepción al modelo más barato.
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
