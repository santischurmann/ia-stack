# Session — (date)

**Feature slug:** (set before first gate; lowercase kebab-case, e.g. `billing-fix`)
**Goal:** (what we're doing today)
**Status:** in progress

---

(phases appended here as work progresses)

<!--
Tres secciones opcionales. Un SESSION.md sin ninguna de ellas es un estado normal y pasa
`verify-session-state.mjs check --session .vibe/SESSION.md`. Aparecen sólo cuando aplican, con
el encabezado exacto de abajo — el gate las lee por título y no adivina.

## Intentos fallidos

Un `### <problema>` por problema, y debajo sus intentos numerados corridos desde 1. Cada intento
declara las dos mitades separadas por `→`: qué se probó y por qué falló. Al TERCER intento fallido
sobre el mismo problema el protocolo frena y consulta al humano; la respuesta se anota como
`- decisión humana: ...` y libera el problema. Sin esa línea, el tercer intento es exit 1.

### El gate de límites honestos rechaza la frase nueva

- intento 1: copiar la frase tal cual del README → cruza un salto de línea y el include literal no coincide
- intento 2: recortarla a media oración → el fragmento tampoco entra entero en un renglón
- intento 3: reformatear el párrafo → el renglón se vuelve a partir al guardar
- decisión humana: mover la frase a la tabla de gates, donde cada fila es un solo renglón

## Interrumpido en

Se escribe cuando el trabajo se corta —cuota agotada, sesión caída, lo que sea— y exige los tres
campos: dónde estabas y qué queda. Declarar la interrupción sin punto de retome es exit 1: es
exactamente el estado que costó reconstruir a mano la primera vez.

- Fase: 3 — Build
- Tarea: T09 — gate de estado de sesión
- Falta: cablear el gate en SKILL.md y volver a correr la suite completa

## No verificado

Toda comprobación que NO se pudo hacer —red caída, comando ausente, checkout fuente en otra
máquina— va acá con la marca literal `no verificado` y su motivo. Una entrada de esta sección sin
la marca se lee como comprobación realizada sin evidencia que la respalde: exit 1.

- **`git fetch origin/main`:** no verificado — timeout de red, el remoto no se pudo consultar
-->
