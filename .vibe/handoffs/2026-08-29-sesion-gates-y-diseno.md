# Handoff — sesión del 2026-08-29

**Autor del trabajo:** agente (Claude Opus 5), sesión completa del 2026-08-29
**Rol:** Constructor, con pasadas de Auditor sobre el trabajo previo
**Commits cubiertos:** `e7a31fa` … `548e3bf`

## Qué se hizo

1. **Tres gates que comparaban un nombre en vez del archivo real** (`e7a31fa`) — el inventario de
   cobertura comparaba nombres sueltos y no rutas; la sonda de directorio vacío sólo enumeraba los
   `verify-*.mjs`; una entrada vacía en el inventario del grafo compraba cobertura.
2. **Sistema de diseño verificable** (`e000f3f`, `2280b8e`) — `contracts/design-tokens.json` y
   `verify-design-tokens.mjs`, gate 24. Nueve reglas: tokens completos en los tres estados de tema,
   bloques oscuros coincidentes, pares fondo/texto, sin colores sueltos, fondo del body desde un
   token, rampa tipográfica, ritmo de espaciado y firmas de diseño genérico. El mapa del protocolo
   adoptó las convenciones: paleta en OKLCH convertida con la fórmula, 0 tamaños y 0 espaciados
   fuera de escala.
3. **Los 11 límites honestos que faltaban** (`ed2b54a`) y **los dos de fondo de Discovery**
   (`0be0d39`) — de 35 a 48 declarados; los 24 gates quedaron cubiertos.
4. **`sources`: resolver las fuentes citadas contra el árbol** (`abf3d96`) — cierra el agujero de
   las fuentes inventadas.
5. **`history`: anclar el expediente contra git** (`7ebc5cc`) — cierra el segundo agujero de fondo
   de Discovery.
6. **El flake del gate de cobertura** (`cab6ec7`) — no era el paralelismo: era una rama que el
   motor instrumentaba de forma intermitente y que ninguna prueba ejercitaba.
7. **Primera entrada real del gate de decisiones por fase** (`e9e1bc3`).

## Cómo se verificó

Suite completa en cada lote, cobertura al 100 % sobre 26 scripts, contrato con 84 checks y 50
límites, sonda sobre 25 gates, baseline de seguridad sobre el delta real. Dos lotes se verificaron
además **clonando desde GitHub y corriendo la suite ahí**. Cada arreglo se reprodujo antes de tocar
el código, y cada gate nuevo tiene pruebas con prefijo `FALSIFICACIÓN` que lo atacan.

## Errores propios encontrados durante el trabajo

Se registran porque una revisión que sólo lista aciertos no sirve para calibrar la confianza:

- Un fixture inventó la forma del expediente, así que once pruebas validaban la maqueta y no el
  código. Lo destapó correr el gate sobre datos reales, no la suite.
- Un doble de git devolvía el mismo código de error para todo, así que el caso de ancla rota quedaba
  sin probar aunque su prueba estuviera en verde.
- Se le pasaba una ruta entera a una función que espera segmentos: tres archivos que existían se
  reportaban como ausentes.
- Se afirmó que el flake de cobertura dependía del paralelismo, con una muestra de tres corridas.
  Era falso.

## Lo que este autor NO revisó

NOT_REVIEWED: el contenido semántico de los 4 claims del expediente de Discovery — se verificó que sus fuentes resuelven y que el expediente sólo creció, no que lo que cada claim afirma siga siendo cierto hoy; tres de los cuatro describen problemas que esta misma sesión resolvió. Tampoco se revisó: docs/spec.md y docs/plan.md, que siguen en estado borrador con las 13 tareas terminadas; las 9 tareas que se ejecutaron sin entrar nunca al plan; examples/example-feature, desincronizado con templates/; el research externo, con 2,05 % de cobertura declarada; ni las citas archivo:línea de ese research, que nadie revalidó de forma independiente.

## Qué debería mirar quien siga

El inventario completo de lo abierto está en la conversación de esta sesión y en `.vibe/RETRO.md`.
Lo más gordo que queda: `spec.md` y `plan.md` en borrador con el trabajo declarado terminado, y
nueve tareas que nunca pasaron por el preflight de conflictos de escritura.
