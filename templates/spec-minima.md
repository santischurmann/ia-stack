# Spec: <feature-slug>

<!--
LA VIA CORTA. Tres secciones en vez de ocho, para un cambio de hasta tres archivos sin
ambiguedad. NO se activa con una bandera: se activa porque el scavenge de esta funcionalidad
declaro `scope: "corto"` en docs/scavenge/<feature-slug>.json. La exigencia se deriva del arbol,
no de algo que alguien tiene que acordarse de pasar.

Lo que NO se afloja: los criterios de aceptacion tienen la misma gramatica, los mismos ids
unicos y los mismos marcadores prohibidos que en la via completa. Son lo que leen el test rojo,
la traza de evidencia y el recibo — aflojarlos es lo que dejaba al atajo sin salida legal.

Y si el proyecto declaro una superficie de ataque, hay que agregar la seccion
«## Security surface / Superficie de ataque»: la seguridad no tiene via corta.
-->

## Problem / Problema

<Que no anda hoy, en dos o tres lineas. Sin esto nadie sabe por que se hizo, ni en seis meses
ni manana.>

## Acceptance Criteria / Criterios de aceptación

- [ ] **AC1:** GIVEN <situacion>, WHEN <accion>, THEN <resultado observable>.
- [ ] **AC2:** THE SYSTEM SHALL <obligacion verificable>.

## Definition of Done (DoD)

<Que tiene que estar verde para decir que esto termino.>
