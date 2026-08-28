# Retros

Log rolling. Una entrada por feature/fix shippeado. Escrito en Phase 4.8, leído en
Phase 0 Bootstrap (últimas 2 entradas) como contexto de "qué aprendimos". No es un gate —
siempre corre, nunca bloquea.

---

## [YYYY-MM-DD] <feature-name>

**Shipped:** (1 línea)
**Plan vs actual:** est. N sesiones (docs/plan.md) → actual M sesiones (o "N/A" si no
  archivaron sessions)
**Friction:** (1-2 items)
**Keep:** (1 patrón — si es nuevo, también va a PATTERNS.md)
**Change:** (1 cosa a hacer distinto la próxima)
**Open:** (qué quedó abierto, nombrando el archivo que lo causa — no un ticket que nadie relee
  seis meses después; "Ninguno" si no queda nada. Source: research/sources/protocolo-muralla.md
  point #48)

---


## [2026-08-28] verde-vacio-y-sonda

**Shipped:** cinco lotes — sello del backup atado al HEAD que lo registra, gate de decisiones por
fase, verde vacío visible en 9 caminos de 5 gates, sonda de directorio vacío como gate, y el
instalador dejando de exponer su propio runtime como superficie del proyecto del usuario.

**Plan vs actual:** no había plan datado para esta sesión; se ejecutó contra el mandato de 16
fases. Cerradas con evidencia: los arreglos concretos, el research externo, la Fase 6
(trazabilidad), la Fase 7 (inventario histórico) y la Fase 14 (instalación limpia).

**Friction:**
- La lista de "gates que dicen OK sin comparar nada" se armó **tres veces leyendo código** y quedó
  corta las tres. La versión que ejecuta encontró dos huecos más, uno grave.
- Mis propias ediciones por script rompieron cosas tres veces: un `find()` que no matcheaba y tiró
  abajo las 14 lecturas del research; un patrón con `
` que no matcheó un archivo con CRLF y
  dejó el CHANGELOG sin escribir; y un heredoc que se comió un acento y falló el anclaje.

**Keep:** **ejecutar el gate en vez de leerlo.** Una sonda de diez líneas que corre cada gate en
una carpeta vacía encontró lo que tres lecturas cuidadosas del código no vieron —incluido un
`AUDIT.md` borrado entero que pasaba como "cadena íntegra"—. Quedó como gate
(`verify-empty-probe.mjs`), no como nota, y con la regla que cierra el ciclo: un gate nuevo que no
declare qué hace sin entradas es rechazo.

**Change:** **probar desde afuera antes de declarar terminado.** El defecto del instalador era
invisible desde el repo de VCP, donde la regla de `.gitignore` sí existe. Sólo apareció instalando
en una carpeta limpia, que nunca se había hecho. La próxima vez, la instalación limpia va antes
del cierre, no después.

**Open:**
- `contracts/empty-probe.json` — `verify-vcp-coverage.mjs` está excluido con motivo (correrlo
  ejecuta la suite entera): su comportamiento sin entradas **no está probado**.
- `scripts/verify-empty-probe.mjs` — la sonda prueba **una** invocación por gate; otro subcomando
  puede tener su propio verde vacío sin que nadie lo note.
- `scripts/verify-audit-chain.mjs` — recortar las últimas líneas de una cadena con contenido, y
  recalcular la cadena entera sobre contenido falso, siguen sin detectarse. Los dos exigen un ancla
  fuera del archivo, y el research de 14 fuentes confirmó que **no existe una portable**.
- `scripts/verify-security-baseline.mjs` — aceptar un hallazgo sigue cubriendo archivo+categoría.
  El research propone identidad por símbolo; sin implementar, y hoy hay 0 aceptaciones.
