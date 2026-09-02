# Spec: triangulate-como-fase

**Fecha:** 2026-09-01 · **Estado:** en construcción
La spec anterior (`intake-de-producto`, implementada) se recupera con `git show a492b3d:docs/spec.md`.

## Problem / Problema

TRIANGULATE existe en el protocolo pero no es una fase: aparece dentro del bucle de Build como una
instrucción de prosa, y no deja rastro. Consecuencia observable: quien refactoriza decide solo qué
vectores buscó, y nadie puede leer después cuáles miró y cuáles no. Sin una lista fija se revisa lo
que uno ya sabe buscar, que es exactamente lo que no encuentra nada nuevo. Medido en esta misma
sesión: la lista de gates con verde vacío se armó tres veces leyendo código y quedó corta las tres.

## Discovery / Investigación previa

El protocolo ya tiene la disciplina en otros lados y funciona: `contracts/empty-probe.json` obliga
a declarar cómo se comporta cada gate sobre un directorio vacío, y `contracts/coverage-scope.json`
obliga a declarar qué directorios se miden y cuáles no. Los dos convierten un silencio en una fila
escrita. Falta el equivalente para los vectores de triangulación, que hoy son 26 en el encargo y
cero en el repositorio.

## Target Users / Usuarios

Quien va a refactorizar y necesita saber qué falta mirar, y quien revisa ese trabajo después y
necesita distinguir «lo miré y no aplica» de «no lo miré».

## Acceptance Criteria / Criterios de aceptación

- [ ] **AC1:** GIVEN un expediente que declara los 26 vectores con estado, WHEN corre el gate, THEN sale 0 y dice cuántos cubiertos, cuántos no aplican y cuántos quedan pendientes.
- [ ] **AC2:** GIVEN un expediente al que le falta un vector del contrato, o que declara uno que el contrato no tiene, WHEN corre el gate, THEN rechaza nombrándolo.
- [ ] **AC3:** GIVEN un vector declarado `covered`, WHEN no nombra la prueba que lo cubre, THEN el gate rechaza: cubierto sin prueba es una afirmación sin respaldo.
- [ ] **AC4:** GIVEN un vector declarado `not_applicable` o `pending` sin motivo escrito, WHEN corre el gate, THEN rechaza: un vector descartado sin razón es un vector no mirado.
- [ ] **AC5:** GIVEN un expediente con vectores `pending`, WHEN corre el gate con `--require-complete`, THEN rechaza nombrándolos; sin la bandera informa cuántos quedan y sale 0.
- [ ] **AC6:** THE SYSTEM SHALL informar VACÍO y salir 0 cuando no hay ningún expediente, y rechazar un esquema ajeno antes de mirar cualquier otro campo.

## Constraints / Restricciones

Sin dependencias nuevas: Node nativo. El gate se declara en `contracts/empty-probe.json`. Su límite
honesto se registra en `contracts/honest-limits.json`. La lista de vectores vive en un contrato
propio, no adentro del gate: cambiar la lista no debe exigir tocar código.

## Non-Goals / No-Goals

No comprueba que la prueba nombrada ejercite el vector que dice cubrir. No juzga si un motivo de
`not_applicable` es bueno. No descubre vectores nuevos: la lista es fija y su completitud es una
decisión humana. No reemplaza a la cobertura ni a la suite.

## Stack & Dependencies

Node nativo, `node:test`. Reusa la disciplina de `verify-empty-probe.mjs` para el verde vacío y el
patrón de `--require-complete` que ya usan `verify-evidence-runner.mjs` y `verify-phase-decisions.mjs`.

## Definition of Done (DoD)

Gate escrito con prueba roja previa, cobertura completa de sus funciones y ramas, fila en
`empty-probe.json`, límite honesto registrado, `SKILL.md` y `README.md` actualizados, y suite en
verde diez veces seguidas.
