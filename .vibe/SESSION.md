# Session — 2026-09-14

**Feature slug:** eleccion-de-stack
**Goal:** que el protocolo elija el stack en vez de sólo detectarlo: una novena pregunta de Intake
con el tipo de producto (A-H), una matriz con evidencia fechada, y la regla de arrancar siempre en
plan gratuito con su detector y su tabla de escalado
**Status:** in progress — fases 1 y 1.5 cerradas, fase 2 (Research) abierta

## Alcance de este ciclo

Termina cuando `docs/spec.md` está escrita y aprobada. El build **no** entra: la spec describe los
gates nuevos, construirlos es otro ciclo con su test rojo primero. El plan aprobado vive fuera del
repositorio, en el directorio de planes de Claude Code de quien lo corrió: no se cita su ruta acá
porque este archivo se publica y esa ruta lleva el nombre de usuario de una persona.

Fuera de alcance, explícito: deploy, cualquier recurso cloud, y las etapas 5-9 de
`docs/spec-ia-stack.md` (README corto, índice propio, tablero, memoria+sereno, lanzamiento).

## Decisiones tomadas antes de abrir el expediente de fases

Se registran acá porque se respondieron durante la planificación, antes de que existiera
`docs/phase-decisions.json` para este ciclo. Las que correspondan a una fase se sellan en su cierre.

- Identidad: IA Stack v1.0.1 **evoluciona este repositorio**, no es un proyecto nuevo. La carpeta
  `Desktop\Claude\ia-stack` está vacía y no se usa.
- Versionado de dos relojes: el protocolo sigue su cuenta (próximo release 2.1.0); «IA Stack 1.0.1»
  nombra la capa nueva de elección de stack.
- Research: los cuatro ejes — web + límites reales del plan gratuito, adaptadores de test rojo,
  Python/cómputo pesado, escritorio/híbrido.
- Regla $0: gate mecánico + matriz de escalado, no sólo documento.
- Sede de la elección: **ampliar la fase 1.5 INTAKE**, no crear una fase 0. Razón mecánica
  reproducida: anteponer `"0"` a `phase_order` invalida el hash de la primera decisión sellada.
- Expediente: archivar el ciclo cerrado byte a byte y abrir uno nuevo.
- Vocabulario de fases: arreglar los tres lugares, incluido el `CLAUDE.md` global del usuario.
- Adaptadores RED: despachador + pytest + vitest, descritos en la spec, construidos después.
- Chequeos de período (tablero, sereno, ablación): **diferidos** al cierre de este ciclo.
- `.vibe/SESSION.md` de otra funcionalidad: archivar y arrancar limpia.

## Estado verificado — fase 1 (Bootstrap)

Línea base antes de tocar el árbol: 1480 pruebas, 1479 verdes, 1 salteada, 0 fallos.

- Runtime del proyecto estaba tres días atrasado: le faltaban los gates de `threat` y `deploy`.
  Resincronizado, 226 archivos. Los destinos globales fueron a un scratch para no tocar la
  configuración de Claude Code del usuario.
- Expediente cerrado archivado a `docs/cycles/research-cycle-2026-08-29/`, movido con `git mv` para
  no alterar un byte. Sello verificado después del movimiento: 2 decisiones encadenadas, verde.
- Expediente nuevo abierto: `phase_order ["1.5","2","3"]`, feature `eleccion-de-stack`, sin
  decisiones todavía. `verify-phase-decisions` escribe `VACÍO:` y sale 0, que es lo correcto.
- Vocabulario de fases unificado en los tres lugares que decían 9, 6 y 7.
- Suite al cerrar la fase: **1485 pruebas, 1484 verdes, 1 salteada, 0 fallos**.
- Gates transversales verdes: runtime-sync, vcp-contract (131 promesas, 105 límites), vcp-index
  (342 archivos), empty-probe, menu-shape, audit-chain.

## Estado verificado — fase 1.5 (Intake)

- Novena pregunta construida con su test rojo primero: `tipo_de_producto` como enum cerrado A-H más
  un motivo obligatorio para los ocho códigos, no sólo para `H`.
- `docs/intake/eleccion-de-stack.json` escrito y verde: 8 respuestas, 4 supuestos, 5 riesgos,
  3 preguntas abiertas, 0 bloqueantes.
- Decisión de fase sellada en `docs/phase-decisions.json`: tipo **F**, integración o proceso interno.
- Suite al cerrar la fase: **1493 pruebas, 1491 verdes, 2 salteadas, 0 fallos**.
- Contrato: 131 promesas, **107** límites honestos (eran 105 al abrir el ciclo).

### Respuestas del Intake que cambian el diseño

- **Para terceros primero, no para el autor.** El usuario eligió la vara más alta de las tres: cada
  recomendación necesita fuente oficial y fecha, no criterio interno.
- **El repositorio publicado tiene que quedar limpio de datos del autor.** Los dos proyectos privados del autor se
  leen para derivar el patrón; lo que se publica es genérico y con fuente. Lo que el protocolo
  aprenda de un proyecto se queda en ese proyecto. Es el defecto rojo #3 de `docs/spec-ia-stack.md`
  convertido en regla de diseño, y está anotado como riesgo R1 del Intake porque hoy depende de
  disciplina humana y no de un detector.
- **Hace falta una tabla navegable de la matriz.** Suma alcance de construcción: se hace después del
  spec y desde el mismo dato, nunca a mano.

## Reglas nuevas de este ciclo, cada una con su detector

- **El frontmatter de una skill no puede contradecir el conteo canónico de fases.** Detector:
  `descripcionesDeFrontmatter` en `tests/fases-canonicas.test.mjs`. Nació de una herida real: el
  puntero de Codex decía «Protocolo de 9 fases» mientras el cuerpo del mismo archivo decía «son once
  fases», y ese archivo lo copia el instalador a cada proyecto.
  **Límite honesto:** mira el frontmatter, no la prosa.
- **Una exclusión de Graphify que termina en `/` es una carpeta y cubre lo que viva abajo.**
  Detector: `compareCoverage` en `scripts/verify-graphify-manifest.mjs`, con sus tres pruebas.
  **Límite honesto:** un prefijo no hereda la regla de contradicción, porque afirma «lo que viva acá
  abajo no obliga a regenerar el grafo», no «esto no merece un nodo». Un prefijo sin ningún archivo
  rastreado abajo sigue rechazándose como exclusión muerta.
- **Un grafo viejo no es una cobertura mentida.** Si un archivo rastreado nació después del
  manifiesto, el gate escribe `DESACTUALIZADO:` con los nombres y sale 0; si ya existía cuando el
  grafo se construyó y falta, rechaza. Detector: las cuatro pruebas de fecha en
  `tests/verify-graphify-manifest.test.mjs`. **Límite honesto:** la edad se lee de la fecha de
  modificación, y `git checkout` o un clon la reescriben. El error cae del lado seguro.
- **El frontmatter de una skill dice cuántas fases son, y el gate de menús tolera la marca de
  recomendación fuera de una opción.** Los dos límites quedaron declarados (106 y 107).

### La misma herida, tres veces en una sesión

Archivar un expediente, archivar una sesión y escribir el archivo de Intake dejaron el gate de
Graphify en rojo, y en ninguno de los tres casos había una cobertura falsa. La primera corrección
—exclusiones por prefijo— sólo tapaba el caso de archivo muerto. La tercera repetición mostró que
faltaba la distinción de fondo entre *viejo* y *deshonesto*, que es la que cerró el defecto.

## Mediciones que evitaron trabajo equivocado

- **La forma ancha del detector de fases se midió antes de escribirla**: agregaba 12 coincidencias
  sobre lo versionado y sólo 3 eran afirmaciones sobre este protocolo. Las otras 9 eran subconjuntos
  legítimos, fases de otras herramientas descritas en `research/sources/`, y afirmaciones viejas
  dentro de fuentes pineadas. Ensanchar habría producido ocho rojos falsos.

## Intentos fallidos

(ninguno todavía en este ciclo)

## Retomar acá

Fase 2 RESEARCH, slug `eleccion-de-stack`. Cuatro ejes: web con límites reales de plan gratuito,
adaptadores de test rojo, Python y cómputo pesado, escritorio e híbrido. Salida: los 7 diagnósticos
canónicos en `docs/discovery/eleccion-de-stack/diagnostics/` más un octavo nuevo,
`stack-matrix.json`, que es seguro de agregar porque `verify-product-diagnostics.mjs` sólo itera su
lista fija de artefactos e ignora el resto del directorio.

Antes de escribir un diagnóstico hay que pinear las fuentes: `research/sources/` y
`contracts/research-citations.json`. Y cada candidato necesita su **contraejemplo** entre los 14
campos, que es lo que obliga a abrir la línea citada en vez de resumir de memoria.

## No verificado

- que el contenido de la spec resista su gate de calidad: no verificado — `docs/spec.md` es hoy un
  encabezado de identidad, no una spec. `verify-spec-wordcap --quality` la rechaza, y ese rechazo es
  correcto hasta que la fase 3 la escriba con el research detrás.
- qué reportarían el tablero, el sereno y la ablación: no verificado — los tres chequeos de período
  se difirieron por decisión registrada arriba, así que no se corrieron.
