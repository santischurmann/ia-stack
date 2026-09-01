# Spec: intake-de-producto

**Fecha:** 2026-09-01 · **Estado:** en construcción
La spec anterior (`integridad-verificable`, cerrada) se recupera con `git show af55a45:docs/spec.md`.

## Problem / Problema

El protocolo no pregunta qué se quiere construir. `PHASE 1 — BOOTSTRAP` pregunta el stack y el
nivel de rigor; `PHASE 2 — RESEARCH` ya asume que hay un producto definido. Entre las dos no hay
nada que capture objetivo, usuario, problema, resultado esperado ni restricciones. Consecuencia
observable: `grep -ci "Intake"` sobre `SKILL.md` y `README.md` devuelve `0`. Un ciclo que arranca
sin eso construye lo que el agente supuso, y el supuesto no queda escrito en ningún lado, así que
nadie puede señalarlo después.

## Discovery / Investigación previa

Medido el 2026-09-01 sobre el commit `af55a45`. Las cinco capacidades que el encargo pide —CAIO,
mapa de bucle, PRD, adopción y recurrencia— aparecen **una sola vez** en todo `SKILL.md`, como
prosa en las líneas 226 a 235, sin artefacto, sin esquema, sin contrato y sin verificador. El
Intake no aparece ni como prosa. Lo que sí está gateado es el envoltorio Discovery, que comprueba
forma, cadena de hashes y reproducibilidad de la vista, nunca el contenido de la decisión.

## Target Users / Usuarios

Quien arranca un ciclo VCP sobre un producto que todavía no existe, y quien lee ese expediente
después para juzgar si lo construido responde a lo que se pidió.

## Acceptance Criteria / Criterios de aceptación

- [ ] **AC1:** GIVEN un intake con las ocho respuestas completas, WHEN corre el gate, THEN sale 0 y dice cuántas respuestas, supuestos, riesgos y preguntas registró.
- [ ] **AC2:** GIVEN un intake al que le falta una respuesta, o la trae vacía o demasiado corta para ser una respuesta, WHEN corre el gate, THEN rechaza nombrando cuál.
- [ ] **AC3:** GIVEN un intake con una pregunta abierta marcada bloqueante, WHEN corre el gate, THEN rechaza nombrándola: una decisión obligatoria pendiente detiene el ciclo.
- [ ] **AC4:** GIVEN un intake que esconde un supuesto adentro de una respuesta en vez de declararlo aparte, WHEN corre el gate, THEN el gate NO lo detecta, y esa incapacidad queda escrita como límite honesto verificado por contrato.
- [ ] **AC5:** GIVEN un proyecto sin ningún intake, WHEN corre el gate, THEN informa VACÍO y sale 0: un proyecto que todavía no arrancó no incumple nada.
- [ ] **AC6:** THE SYSTEM SHALL rechazar un archivo cuyo esquema declarado no sea el esperado, antes de mirar cualquier otro campo.

## Constraints / Restricciones

Sin dependencias nuevas: Node nativo. El gate se declara en `contracts/empty-probe.json` con su
comportamiento sobre un directorio vacío. Su límite honesto se registra en
`contracts/honest-limits.json`. El artefacto es JSON inmutable; una corrección agrega un sucesor.

## Non-Goals / No-Goals

No juzga si las respuestas son verdaderas, suficientes ni sensatas: eso es revisión humana. No
reemplaza al Discovery ni al PRD. No genera el intake por su cuenta ni sugiere respuestas. No
comprueba que una persona haya contestado: un archivo coherente e inventado pasa igual.

## Stack & Dependencies

Node nativo, `node:test`. Reusa el patrón de contrato y límite honesto de
`verify-vcp-contract.mjs`, y la disciplina de verde vacío de `verify-empty-probe.mjs`.

## Definition of Done (DoD)

Gate escrito con prueba roja previa, cobertura completa de sus funciones y ramas, fila en
`empty-probe.json`, límite honesto registrado, `SKILL.md` y `README.md` actualizados, y suite en
verde diez veces seguidas.
