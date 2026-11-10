# Fase 3 · Research

## Para qué
Saber qué hay hecho, qué se considera buena práctica y qué versiones de tecnología se pueden
usar hoy sin romper nada.

## Entra
- `docs/pedido.md` y, en tamaño grande, `docs/caio.md`.
- En tamaño medio corre sólo el radar de versiones (pasos 3 a 5), y `docs/research.md` lleva sólo
  la sección «stack y versiones».

## Pasos
1. Sólo grande: buscá de 3 a 5 competidores o productos parecidos. Por cada uno: qué hace bien, qué
   le falta y la fuente con su fecha.
2. Sólo grande: buscá las mejores prácticas del tipo de producto. Cada afirmación lleva su fuente.
   Sin fuente, se marca como hipótesis.
3. Elegí el tipo de producto en `skills/stack.md` (datos en `contracts/stack-matrix.json`).
   Presentá el recomendado y las alternativas con su «cuándo».
4. Consultá las versiones: `node scripts/radar-stack.mjs npm:<paquete> pypi:<paquete> ...`. Devuelve
   la última versión estable y compatible. Si el radar no responde, anotá «no verificado»: no
   escribas una versión de memoria.
5. Si la matriz está vencida, corré `node scripts/verify-stack-matrix.mjs check
   contracts/stack-matrix.json` y avisá antes de recomendar.
6. Escribí `docs/research.md` con `templates/research.md`.
7. Pedí la aprobación 2: que la persona escriba **«apruebo research v1»**. En grande cubre
   diagnóstico, research y stack; en medio, «stack y versiones». Sin hook:
   `node scripts/aprobar.mjs registrar --tipo research --ref v1 --texto "<lo que escribió>"`.

## Entrega
`docs/research.md`: competidores, prácticas, stack con versiones fijadas y fecha del radar
(en medio, sólo el stack y las versiones).

## Gate
Gate 7 (versiones estables y compatibles): `node scripts/verify-stack-matrix.mjs check
contracts/stack-matrix.json`. Más la aprobación 2.

## Modelo
Script para el radar. Nivel barato para leer y resumir fuentes.
