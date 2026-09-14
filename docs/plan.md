# Plan: eleccion-de-stack — pedazo mínimo

**Date:** 2026-09-14
**Spec:** [docs/spec.md](./spec.md)
**Status:** propuesto
**ADR:** [0001 — los límites de plan gratuito vencen](./adr/0001-los-limites-de-plan-gratuito-vencen.md)

## Qué entra en esta vuelta

El pedazo mínimo que la spec define: **que declarar un tipo de producto devuelva un stack con su
fuente, su fecha y su costo de escalar**. Cubre `AC2`, `AC3`, `AC4` y `AC5`.

De las cinco piezas que la spec describe, esta vuelta construye **una**: el gate de la matriz con su
contrato de límites de plan gratuito. Las otras cuatro —despachador de test rojo, adaptadores de
pytest y vitest, gate de repositorio limpio y cableado al menú de Intake— quedan para vueltas
siguientes, cada una con su propio ciclo.

El criterio para cortar acá lo fijó el propio Intake: si la matriz sola no ahorra trabajo, el resto
no la salva; y si lo ahorra, el resto es mejora sobre algo que ya sirve.

## Tareas

| id | Qué construye | Depende de | Criterios |
|---|---|---|---|
| `M1` | El contrato de datos: `contracts/free-tier-limits.json` con los ocho servicios del research, fechados | — | AC3, AC4 |
| `M2` | El validador del contrato: esquema, claves exactas, y la invariante de que todo servicio declare su disparador de escalado | `M1` | AC3 |
| `M3` | El validador de la matriz: los ocho tipos cubiertos, y cada referencia a servicio resolviendo contra el contrato | `M2` | AC2 |
| `M4` | La regla de antigüedad: rechazo cuando la captura supera el período declarado | `M2` | AC4 |
| `M5` | El comportamiento sin entrada: `VACÍO:` y salida cero, declarado en el contrato de la prueba de vacío | `M3`, `M4` | AC5 |
| `M6` | El cableado de registro: fila en la referencia de gates, límite honesto, índice y alcance de cobertura | `M5` | — |

`M1` es el único que no escribe código: es el dato que el research ya produjo, movido de la ficha de
fuente al contrato. Se hace primero porque `M2` no tiene contra qué correr sin él.

## Orden y paralelismo

`M1` abre. `M2` depende de `M1`. Desde ahí, **`M3` y `M4` son independientes entre sí** —tocan
archivos distintos y ninguna lee la salida de la otra— así que se pueden despachar juntas. `M5`
espera a las dos porque declara el comportamiento vacío de ambas. `M6` cierra.

El preflight mecánico es el que decide de verdad: dos tareas que declaren el mismo archivo sólo
pasan si hay una ruta de dependencia entre ellas, y el gate las marca serializadas.

## Qué NO se hace en esta vuelta

- Los adaptadores de test rojo. Su garantía menor ya está decidida y declarada, pero construirlos
  exige pytest y vitest corriendo, y una medición repetida en entorno virgen que todavía no se hizo.
- El gate de repositorio limpio. Es el que más importa después de éste, y va en la vuelta siguiente.
- El cableado de la matriz al menú de la fase de Intake. Sin eso la matriz es consultable pero no
  automática, que es suficiente para probar si sirve.
- La tabla navegable. Está en los Non-Goals de la spec.

## Rollback

Cada tarea agrega archivos y no reescribe ninguno existente salvo los cuatro de registro, que sólo
crecen. Volver atrás es revertir el commit: nada depende todavía del gate nuevo, ningún otro gate lo
invoca, y el contrato de datos no lo lee nadie más. No toca traza sellada ni expedientes cerrados.

## Verificación de cierre

```bash
node scripts/verify-stack-matrix.mjs check docs/discovery/eleccion-de-stack/diagnostics/stack-matrix.json
node scripts/verify-empty-probe.mjs check contracts/empty-probe.json
node scripts/verify-vcp-contract.mjs check
node scripts/verify-vcp-coverage.mjs
node --test
```
