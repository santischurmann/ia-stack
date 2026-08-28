# Project Memory

**Name:** VibeCodeProtocols
**Stack:** Node v24.13.1 nativo, cero dependencias por diseño. Tests: `node --test`.
Cobertura: `node --experimental-test-coverage`. Bash + PowerShell sólo en instaladores.
**Goals:** Protocolo autocontenido para que una IA trabaje con disciplina verificable:
entender → decidir → test rojo → cambio → casos borde → revisión → evidencia → release.
Cada regla del protocolo debe traer su propio detector mecánico.
**Started:** 2026-08-27
**Owner:** VibeCodeProtocols

---

## Nivel del proyecto

**C — Producto con plata.** VCP se distribuye e instala en otros proyectos: un gate que aprueba
código roto hace que alguien publique con confianza injustificada. El costo de la rigurosidad se
paga porque hay algo real que perder. `risk_level` por-cambio (Phase 7.1) sigue siendo ortogonal.

---

## Architecture notes

- `scripts/*.mjs` — gates mecánicos, uno por invariante. Cada uno tiene su espejo en `tests/`.
- `contracts/*.json` — datos declarativos que los gates validan; nunca comandos ejecutables.
- `SKILL.md` — orquestación de las 6 fases; `skills/*.md` — roles de subagente.
- `docs/discovery/<slug>/runs/run-NNN/` — historial inmutable de decisiones con hash-chain.
- Inyección de dependencias en cada gate (`read`, `runGit`, `stat`) para que los tests puedan
  falsificar sin tocar el filesystem real.

---

## Key conventions

- Un gate nuevo no se declara listo sin 100% de líneas, ramas y funciones en `verify-vcp-coverage`.
- Toda promesa visible al usuario en README/SKILL/SECURITY se fija en `verify-vcp-contract.mjs`,
  para que la documentación no pueda derivar en silencio.
- Los límites honestos se escriben en el header del propio script, no sólo en la documentación.
- Patrones auto-referenciales en scripts de seguridad se fragmentan con concatenación (`'a' + 'b'`)
  para que el escáner no se dispare contra su propio código fuente.

---

## Risk-sensitive paths (Phase 7.1 risk classifier)

Este repo no contiene `.mq5` ni fuentes de licencia. Los paths sensibles son los gates cuya
falla silenciosa deja pasar código no verificado:

- `scripts/verify-receipt.mjs` — autoriza commit/push; un falso OK publica trabajo no revisado.
- `scripts/verify-security-baseline.mjs` — piso de secretos/inyección.
- `scripts/pretooluse-red.mjs` — hook de fricción sobre Write/Edit.
- `scripts/verify-discovery-core.mjs` — integridad del historial inmutable de decisiones.
- `scripts/install.sh`, `scripts/install.ps1` — distribuyen el runtime a otros proyectos.
- `contracts/*.json` — si se corrompen, los gates validan contra un contrato falso.
