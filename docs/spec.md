# Spec: candidatos-de-research

**Fecha:** 2026-09-01 · **Estado:** en construcción
La spec anterior (`triangulate-como-fase`, implementada) se recupera con `git show f23c832:docs/spec.md`.

## Problem / Problema

La síntesis del research externo agrupa 14.897 entradas por capacidad y las llama «señales de
adopción». Esas señales son **filtros lexicales**: un puntaje que cuenta cuántas palabras de una
lista aparecen en un archivo. El propio informe lo dice, pero nada impide que alguien tome esa
tabla y adopte una idea porque salió con puntaje 22. Consecuencia observable: hoy no existe ningún
artefacto entre «una señal lexical» y «una capacidad adoptada», así que el salto no deja rastro y
no hay dónde escribir el contraejemplo.

## Discovery / Investigación previa

Medido el 2026-09-01. Los 14 commits pineados siguen alcanzables (14/14 vía la API de GitHub) y
9 de 14 fuentes movieron su HEAD desde la captura, lo cual no invalida el corpus: se leyó *en* el
commit pineado. Registrado en `research/pin-revalidation-2026-09-01.json`. El repositorio ya tiene
la disciplina de exigir contraejemplo en otros lados —`contracts/honest-limits.json` obliga a
escribir qué NO prueba cada gate— pero el research no la tenía.

## Target Users / Usuarios

Quien propone adoptar una idea de una fuente externa, y quien tiene que decidir si se adopta sin
volver a leer los 15.581 archivos del corpus.

## Acceptance Criteria / Criterios de aceptación

- [ ] **AC1:** GIVEN un candidato con sus catorce campos completos, WHEN corre el gate, THEN sale 0 y dice cuántos candidatos hay por decisión propuesta.
- [ ] **AC2:** GIVEN un candidato cuya fuente no es una de las pineadas, o cuyo commit no es el que el contrato pineó para esa fuente, WHEN corre el gate, THEN rechaza nombrándolo.
- [ ] **AC3:** GIVEN un candidato cuya evidencia no cita archivo y línea del archivo que declara, WHEN corre el gate, THEN rechaza: un puntaje lexical no es una cita.
- [ ] **AC4:** GIVEN un candidato cuyo contraejemplo repite textualmente una de sus evidencias, WHEN corre el gate, THEN rechaza: repetir la evidencia no es un contraejemplo.
- [ ] **AC5:** GIVEN un candidato con decisión `adopt` que no declara el test necesario, WHEN corre el gate, THEN rechaza: adoptar sin test es adoptar sin condición de adopción.
- [ ] **AC6:** THE SYSTEM SHALL informar VACÍO y salir 0 sin ningún expediente de candidatos, y rechazar un esquema ajeno antes de mirar cualquier candidato.

## Constraints / Restricciones

Sin dependencias nuevas: Node nativo. Las fuentes y commits válidos salen de
`contracts/research-citations.json`, que ya existe y no se toca. El gate se declara en
`contracts/empty-probe.json` y su límite honesto en `contracts/honest-limits.json`.

## Non-Goals / No-Goals

No abre el archivo citado ni comprueba que la línea diga lo que el candidato afirma: eso es
reclonar el corpus. No juzga si un contraejemplo es bueno, si un costo es realista ni si una
decisión es sensata. No adopta nada por su cuenta: la decisión sigue siendo humana y con 🔵.

## Stack & Dependencies

Node nativo, `node:test`. Reusa el patrón de verde vacío de `verify-empty-probe.mjs` y la lectura
del contrato pineado que ya hace `verify-research-citations.mjs`.

## Definition of Done (DoD)

Gate escrito con prueba roja previa, cobertura completa de sus funciones y ramas, fila en
`empty-probe.json`, límite honesto registrado, `SKILL.md` y `README.md` actualizados, y suite en
verde diez veces seguidas.
