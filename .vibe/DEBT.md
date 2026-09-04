# Technical Debt

Managed backlog. One entry per deferred item.

---

## [YYYY-MM-DD] Debt: (first item) `id:<hash6>`

**Location:** file:line
**Severity:** low | medium | high
**Description:** (what needs to be done)
**Why deferred:** (reason)

---

## [2026-09-04] Debt: la spec `candidatos-de-research` quedó sin terminar `id:678951`

**Location:** `git show 3aac9cf:docs/spec.md`
**Severity:** medium
**Description:** La spec proponía un artefacto intermedio entre «una señal lexical» y «una capacidad
adoptada», para que nadie adopte una idea porque salió con puntaje 22 en un filtro de palabras. Se
escribió y quedó en construcción; el trabajo de lanzamiento la desplazó.
**Why deferred:** El repositorio publicaba datos de otro proyecto y toda instalación nacía en rojo.
Eso era daño activo sobre cualquiera que clonara; esto es una mejora del método propio. Se archivó
declarándolo, no borrándolo: la spec entera se recupera con el comando de arriba.

---

## [2026-09-04] Debt: `graphify update` degrada las etiquetas del grafo en cada corrida `id:dfdf42`

**Location:** `graphify-out/.graphify_labels.json`
**Severity:** low
**Description:** Cada `graphify update .` re-clusteriza y renombra por su archivo-hub las comunidades
que cambiaron: 25 la primera vez y 18 la segunda, el mismo día. Las etiquetas semánticas en
castellano se rehacen a mano. El remapeo automático por mayoría de nodos SÓLO funciona si se copia
`.graphify_labels.json` **antes** de correr el update — el backup que rota Graphify se sobrescribe
con el estado ya degradado, y entonces no hay fuente.
**Why deferred:** El grafo está fuera de lo versionado y es una integración **opcional**: la etapa 6
le dio al protocolo su propio índice (`verify-vcp-index.mjs`) justamente para no depender de esta
herramienta. Automatizarlo sería un script más que mantener, con cobertura y declaración, para una
dependencia que el protocolo ya no necesita. Mitigación mientras tanto: copiar el archivo de
etiquetas antes de cada update.

---
