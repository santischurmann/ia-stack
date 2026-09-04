# Spec: lanzamiento-ia-stack

**Fecha:** 2026-09-04 · **Estado:** implementada
La spec anterior (`candidatos-de-research`, **quedó sin terminar**) se recupera con
`git show 3aac9cf:docs/spec.md`. Su deuda está anotada en `.vibe/DEBT.md`.

## Problem / Problema

El protocolo era riguroso adentro y estaba roto para cualquiera que no fuera su autor. Tres
defectos medidos, no supuestos: correr la suite sobrescribía la configuración global de quien
clonara; toda instalación nacía con 26 fallos sobre 1096; y el repositorio publicaba datos de otro
proyecto del autor. Encima, el README pedía ocho mil palabras para explicar once fases, y no había
forma de ver el estado del trabajo sin leer archivos sueltos.

## Discovery / Investigación previa

Dos rondas de investigación con pasada adversarial, que mató dos de cinco diseños. Lo que cambió el
plan: los 26 fallos no eran self-checks mal ubicados sino **seis causas raíz**, y tres eran
defectos operativos del producto. La medición de punta a punta —instalar en un proyecto ajeno y
correr la suite ahí— no la corría nadie, y es la única que ve lo que ve quien clona.

## Target Users / Usuarios

Quien instala el protocolo en su propio proyecto y nunca va a leer el repositorio de VCP. Todo lo
que le hable del checkout de VCP es ruido que no puede accionar.

## Acceptance Criteria / Criterios de aceptación

- [x] **AC1:** GIVEN un clon limpio instalado en un proyecto ajeno WHEN se corre la suite ahí THEN
  cero fallos, y las salteadas dicen por qué.
- [x] **AC2:** GIVEN una instalación WHEN se corre cualquier gate a mano THEN ninguno le reclama un
  archivo que sólo existe en el repositorio de VCP.
- [x] **AC3:** GIVEN una instalación en un proyecto destino WHEN termina THEN nada fuera de ese
  proyecto cambió: la huella de la configuración global queda idéntica.
- [x] **AC4:** GIVEN lo versionado WHEN un barrido por forma busca otros árboles THEN no hay ninguna
  referencia a otro proyecto del autor.
- [x] **AC5:** GIVEN alguien que nunca vio el protocolo WHEN lee el README THEN entiende las once
  fases, la memoria entre sesiones y el bucle de auto-mejora, con diagramas.
- [x] **AC6:** GIVEN siete días de trabajo WHEN se pide el tablero THEN muestra proyectos, sesiones,
  turnos, tokens deduplicados y horas como banda, fuera del repositorio.
- [x] **AC7:** GIVEN una ronda de auto-mejora WHEN el agente propone THEN escribe como mucho cuatro
  mejoras, cada una con su cita resuelta contra el archivo, y no ejecuta nada.

## Constraints / Restricciones

Node nativo, cero dependencias de npm. Sin daemons, servicios cloud ni APIs externas. Nada se
escribe fuera del árbol salvo pedido explícito con bandera. Cobertura total de líneas, ramas y
funciones en `scripts/`. Todo script nuevo se declara en `contracts/empty-probe.json`. Sin test
rojo visible no hay implementación.

## Non-Goals / No-Goals

No se promete llegar a trending: se pueden arreglar defectos y escribir mejor, que la gente mire
eso no depende del repositorio. No se toca el vocabulario de fases de las máquinas —tres gates
validan orden y un hash cubre el prefijo—, sólo el de la documentación. No se convierte el tablero
en un servidor: genera una página y termina.

## Stack & Dependencies

Node 22 o superior, `node:test`, `git`. Nada más. La integración con herramientas de grafo queda
opcional y declarada: el protocolo cierra su fase de deploy sin ellas.

## Definition of Done (DoD)

Las nueve etapas del plan cerradas y publicadas; la suite en verde con la máquina sin carga; la
cobertura completa; la cadena de auditoría intacta contra la historia de git; y la medición de
punta a punta sobre un clon del estado publicado, con cero fallos y la configuración global intacta.
