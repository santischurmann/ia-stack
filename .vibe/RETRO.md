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

---

## [2026-09-01] bloque-a-suite-clon-y-cobertura

**Shipped:** la suite dejó de ser intermitente, un clon limpio quedó verde en Windows, y el gate de
cobertura pasó de informar un porcentaje fusionado a nombrar archivo y línea de cada rama que nadie
ejecutó — lo que destapó 10 huecos que el 100 % anterior tapaba.

**Plan vs actual:** el plan aprobado tenía cuatro ítems en el Bloque A (A1–A4). Salieron seis: F13
(CRLF), F14 (NUL crudos) y F15 (verificadores de research que reventaban) aparecieron *haciendo* el
trabajo, no leyéndolo. Ninguno estaba en el diagnóstico de Fase 0, que fue read-only.

**Friction:**
- Tres defectos serios sólo eran visibles desde afuera del checkout. Fase 0 corrió 20 gates en verde
  sobre el árbol de trabajo y no vio ninguno; el primer clon los mostró en minutos.
- El escáner de mi propia guardia salió verde vacío en el primer intento —un `\s` degradado en un
  template literal— y lo delataron sus pruebas de FALSIFICACIÓN, no yo.

**Keep:** escribir la prueba de falsificación *junto* con la guardia, no después. Fue lo único que
distinguió "no hay violaciones" de "el escáner no mira nada", y pasó dos veces en la misma sesión.

**Change:** clonar el repositorio al empezar, no al verificar. Un preflight que sólo mira el árbol de
trabajo mide la máquina del autor, no el proyecto. Los tres defectos que más costaron eran del clon.

**Open:** el resto de `research/` sigue sin prueba (declarado en `contracts/coverage-scope.json`).
Y las 6 fases nuevas del protocolo —Intake, CAIO, Mapa de Bucle, PRD, TRIANGULATE, Adopción— siguen
existiendo sólo como prosa en `SKILL.md:226-235`, que era el objetivo central del encargo.

---

## [2026-09-01] bloque-b-las-seis-fases

**Shipped:** las seis capacidades que el encargo pedía y que existían sólo como cinco bullets de
prosa en `SKILL.md:226-235` ahora tienen artefacto, contrato, gate y prueba: Intake, CAIO, mapa de
bucle, PRD, TRIANGULATE y adopción/recurrencia.

**Plan vs actual:** el plan preveía seis ciclos propios. Salieron cinco míos más uno que ya había
hecho otra sesión: `aebcc26` apareció a mitad de camino con cuatro artefactos gateados. Medir la
brecha contra el encargo antes de escribir una línea evitó construir un gate paralelo.

**Friction:**
- Los gates que construí me frenaron a mí cinco veces: la guardia de alcance de cobertura, el gate
  de conflictos de plan, el de contrato —dos veces, una por una frase partida en dos líneas— y la
  cobertura, que nombró 26 ramas de rechazo sin ejercitar repartidas en cuatro tandas.
- Una reescritura se llevó cuatro helpers del PRD por delante sin que yo lo notara.

**Keep:** dejar que la cobertura enumere las ramas en vez de buscarlas leyendo. Las 26 que encontró
eran todas caminos de rechazo, que son justo los que nadie prueba y de los que no se sabe si
rechazan.

**Change:** comparar la lista de funciones contra `HEAD` **después de cada reescritura de bloque**,
no después del susto. Lo incorporé recién en la tercera tanda.

**Open:** el Bloque C de research sin empezar. Dos pendientes declarados en el expediente de
TRIANGULATE (`symlinks`, `paths-externos`). Y ningún artefacto de producto real escrito todavía:
las plantillas validan, pero nadie llenó un PRD de 21 secciones en serio, así que el riesgo de
relleno está declarado y no medido.
