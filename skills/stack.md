# Elegir versiones y stack

Cómo elegir tecnología con versiones estables y compatibles entre sí, con fuente y fecha, y no de memoria.
Se usa en la fase 3 (research) y se congela en la fase 5 (spec).

## De dónde sale
- La fuente es `contracts/stack-matrix.json`: por cada tipo (A a H), el stack recomendado, las
  alternativas con su «cuándo», los planes gratuitos y el adaptador de test rojo. Las versiones
  viven sólo ahí; esta página no las copia.
- Los límites de cada plan gratuito están en `contracts/free-tier-limits.json`, con su `max_age_days`.
  Vencido, `node scripts/verify-stack-matrix.mjs check contracts/stack-matrix.json` sale rojo.
- Captura del 14-09-2026. Fuentes: páginas oficiales de cada proveedor (URL en captured_from de cada plan).

## Cómo se elige
1. Ubicá el tipo de producto (A a H) en la tabla y leé su fila en el contrato.
2. Presentá el recomendado y las alternativas con su «cuándo». Nunca el recomendado solo.
3. Consultá las versiones vivas: `node scripts/radar-stack.mjs npm:<paquete> pypi:<paquete> ...`. Elegí la última
   estable y compatible con el resto del conjunto. Nunca un prerelease, y nunca una versión que otro
   paquete del conjunto todavía no acepta.
4. Por cada plan gratuito de la fila, abrí `contracts/free-tier-limits.json` y decí qué evento lo
   saca del plan y desde cuánto se paga.
5. Fijá las versiones exactas en la spec. Si el radar no responde, escribí «no verificado».
6. Si el tipo no está en la matriz, dejá la fuente y la fecha en el research antes de agregar una fila.

## Los tipos

| Tipo | Producto | Planes gratuitos |
|---|---|---|
| **A** | Sitio web o landing | `cloudflare-pages` · `vercel-hobby` |
| **B** | Aplicación web | `vercel-hobby` · `neon-free` · `supabase-free` · `cloudflare-workers` · `cloudflare-d1` |
| **C** | Progressive Web App | `vercel-hobby` · `neon-free` |
| **D** | Aplicación de escritorio o híbrida | ninguno (ver `no_free_tier_reason` en el contrato) |
| **E** | Sistema Python: datos, automatización, research o IA | `github-actions` |
| **F** | Integración, API, backend o proceso interno | `github-actions` |
| **G** | Artefacto: documento, plan, planilla, presentación, imagen o panel | ninguno (ver `no_free_tier_reason` en el contrato) |
| **H** | Otro | ninguno (ver `no_free_tier_reason` en el contrato) |

El adaptador de test rojo de cada tipo está en `red_adapter` del contrato. Importa para el gate 1:
`pytest` y `vitest` dan una garantía menor que el adaptador nativo de Node, y un verde de un
adaptador débil no se lee igual.

## Límites
- La matriz es una recomendación fechada, no una prueba de que sea la mejor para tu caso.
- `verify-stack-matrix.mjs` comprueba que cada dato esté escrito y fechado. No sale a la red y no
  sabe si el número sigue vigente.
- Clasificar mal el tipo de producto arrastra el stack equivocado, y nada lo detecta.
