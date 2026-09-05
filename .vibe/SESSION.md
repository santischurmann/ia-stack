# Session — 2026-09-04

**Feature slug:** lanzamiento-ia-stack
**Goal:** dejar el protocolo instalable y entendible para alguien que no es su autor: cero fallos en
una instalación ajena, cero datos cruzados, README con diagramas, tablero local y bucle de mejora
**Status:** las nueve etapas del plan, cerradas y publicadas

## Dónde quedó todo

Las 38.320 palabras de historia de esta sesión y las anteriores están en
`.vibe/sessions/2026-09-04-lanzamiento-ia-stack.md`. Se archivaron porque el paso 9 del protocolo lo
manda y nunca se había corrido: `.vibe/sessions/` no existía, y Bootstrap leía el archivo entero en
cada arranque.

## Estado verificado al cerrar

- Suite completa en verde, cobertura total de líneas, ramas y funciones en `scripts/`.
- Instalación en un proyecto ajeno desde un clon del estado publicado: cero fallos, y la huella de
  la configuración global del sistema queda idéntica antes y después.
- Cadena de auditoría intacta contra la historia de git, con sus cortes declarados.

## Intentos fallidos

### Ver el HTML que se arma del lado de Node

- intento 1: marcar toda interpolación dentro de un template con marcado HTML → 43 hallazgos, todos falsos positivos
- intento 2: exigir además que los tags estén balanceados → baja a 26, siguen siendo todos falsos
- intento 3: atribuir el escape a la declaración que lo contiene → se apaga con un comentario que diga que falta escapar
- decisión humana: se pidió cerrar esta propuesta. La política de declarar el límite antes que publicar un gate que grita en falso ya está escrita en el repositorio; la elección concreta la tomó el agente bajo esa política, con el dato de cero verdaderos positivos en 210 archivos y 191 commits. Queda a la vista para revisarla.

### Detectar a quién le pregunta una prueba, no sólo qué archivos lee

- intento 1: marcar toda prueba que pasa la raíz a cualquier función → sobre-dispara, es legítimo al leer un archivo copiado
- intento 2: acotarlo a git con una ventana de líneas → junta un `git` y una raíz que no tienen relación
- intento 3: exigir que el literal `git` y la raíz estén en la misma llamada → no sobre-dispara, pero marca 5 archivos que ya tienen guarda y es ciego al caso que motivó la guarda
- decisión humana: misma política y mismo pedido. Se declara el límite en `tests/self-checks.test.mjs`; lo que cubre esa mitad no es una regla sino la medición de punta a punta. La elección la tomó el agente, no se consultó intento por intento.

### Importar prácticas de un compendio de arquitectura externo

- intento 1: leer las 91.093 palabras enteras con 13 agentes y proponer → ~40 propuestas, ninguna sobrevive tres lentes adversariales
- decisión humana: se pidió estudiarlo y ver qué era implementable. La respuesta medida es que nada lo era, y el motivo es de categoría, no de calidad: ese material es arquitectura de runtime y esto es un protocolo de proceso sobre un árbol de git. Lo que sí salió fueron ocho defectos propios, encontrados al auditar el repositorio para poder refutar, y ésos se implementaron.

## Pendientes: cerrados el 2026-09-05

- **`templates/adr.md` dejó de ser huérfano.** Enganchado a la fase 4 (PLAN), y **sólo cuando
  corresponde**: una decisión que ate al proyecto por meses. Un ADR por tarea rutinaria vacía el
  artefacto. Va con gate propio (`verify-adr.mjs`, 44.º) porque engancharlo sin verificación es
  prosa que nadie cumple — el defecto que tenía la plantilla de spec.
- **La etiqueta `v1.4.0` existe y está publicada.** `SKILL.md` vuelve a afirmarla, y ahora una regla
  lo comprueba **contra git**, no contra el texto: si el documento afirma una etiqueta que no existe,
  la suite se pone roja. Antes esa afirmación era falsa y nada la miraba.
- **El README quedó en 210 líneas, no en las 150 del criterio original.** Se comprimió lo que se
  podía sin romper anclas —la nota del renombre y los dos bloques de comandos fundidos en uno— pero
  bajar de ahí exige sacar los diagramas de las once fases, de la memoria y del bucle, que se
  pidieron explícitamente después de fijar ese número, o el diccionario, que el contrato ancla.
  **Se declara, no se esconde:** el criterio quedó superado por un pedido posterior, y cumplirlo
  al pie habría sido cumplir la métrica rompiendo el producto.
