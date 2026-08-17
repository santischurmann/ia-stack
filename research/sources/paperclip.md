# Paperclip — investigación trazable, todavía parcial

## Snapshot fijo y manifiesto reproducible

- **Repositorio:** `paperclipai/paperclip`.
- **Snapshot revisado:** `dc6fcd1ff1eaa52df7685c8d12257b650dbf611c` (no `main` móvil).
- **Árbol Git:** `gh api repos/paperclipai/paperclip/git/trees/dc6fcd1ff1eaa52df7685c8d12257b650dbf611c?recursive=1` → exit `0`, `truncated:false`, 5.069 entradas: **4.559 blobs** y 510 árboles.
- **Archivo independiente del mismo snapshot:** `https://codeload.github.com/paperclipai/paperclip/zip/dc6fcd1ff1eaa52df7685c8d12257b650dbf611c` → exit `0`; 30.357.554 bytes comprimidos, SHA-256 del archivo `D9E8F2E9B7D824FF38A67EBFAFF6BC3F0BA238715A41733F3AF98358876E6DA8`.

El ZIP contiene 4.559 entradas de archivo, 100.497.412 bytes sin comprimir y el prefijo
`paperclip-dc6fcd1ff1eaa52df7685c8d12257b650dbf611c/`. Su conjunto de paths coincide
exactamente con los 4.559 blobs del árbol Git: 0 faltantes y 0 extras.

Para hacer el inventario repetible se calculó además este digest de metadatos de árbol:

```text
SHA-256(UTF-8 de cada "<mode>\\t<type>\\t<git-blob-sha>\\t<path>\\n", ordenado por path)
= 7D4B81E8B403E9C8907180C2673D2E6B1137A7315D3B3E25D92C6DE0085CD5C1
```

Los hashes de blob reportados por GitHub tienen 40 hexadecimales (objetos Git SHA-1 en este
snapshot). El digest anterior detecta cambios de path, modo o blob; el SHA-256 del ZIP identifica
el artefacto descargado. **Ninguno de los dos equivale a comprensión semántica**, ni se afirma
que se haya recalculado el SHA Git de cada contenido descomprimido.

| Modo Git | Blobs |
|---|---:|
| `100644` | 4.515 |
| `100755` | 42 |
| `120000` (symlink) | 2 |

Tipos dominantes del snapshot: TypeScript `.ts` 2.459 archivos / 30.501.204 bytes; `.tsx` 830 /
12.502.354; Markdown 414 / 4.180.181; JSON 234 / 34.276.722; SQL 220 / 533.962; MJS 119 /
723.434; PNG 91 / 14.703.539. Los binarios están inventariados, no ocultos como “no aplicables”.

## Cobertura semántica real

La pasada previa leyó una muestra documental/skill de alto valor (README, GOAL/PRODUCT,
execution semantics, protocolo de heartbeats, costes, organigrama y PARA memory). Esta pasada
agrega evidencia de implementación, no sólo de documentación:

- Leídos íntegros: `server/src/services/issue-change-receipt.ts`,
  `server/src/services/agent-start-lock.ts`, `packages/db/src/schema/issues.ts`,
  `packages/db/src/schema/heartbeat_runs.ts`, `packages/db/src/schema/budget_policies.ts`,
  `packages/db/src/schema/budget_incidents.ts`,
  `server/src/__tests__/effective-run-config-fingerprints.test.ts`,
  `server/src/__tests__/heartbeat-start-lock.test.ts` y
  `server/src/__tests__/heartbeat-cost-accounting.test.ts`.
- Leídos por secciones funcionales concretas, no íntegramente: `server/src/services/budgets.ts`
  (líneas 150-190, 650-715 y 740-860) y
  `server/src/services/effective-run-config-fingerprints.ts` (220-400, 437-491).
- **No se ejecutó Paperclip ni sus tests**: este repositorio no fue instalado, no se crearon
  dependencias y no se infiere comportamiento de runtime más allá del código y tests leídos.

Esto sigue siendo una revisión semántica de una muestra pequeña frente a 4.559 blobs. El
inventario de bytes/hash está completo; la revisión semántica completa no.

## Hallazgos comprobados en código y tests

1. **El presupuesto es una política ejecutable, no una tabla de documentación.**
   `packages/db/src/schema/budget_policies.ts:6-40` persiste alcance (`company`, `agent` o
   `project`), métrica, ventana, importe, `warnPercent`, `hardStopEnabled` y `notifyEnabled`.
   En `server/src/services/budgets.ts:650-715`, al cruzar el umbral soft crea un incidente y al
   cruzar el hard-stop pausa/cancela el alcance. Antes de iniciar trabajo, el mismo servicio
   bloquea compañía/agente/proyecto excedidos (`:740-855`). El cálculo usa suma de eventos de
   coste dentro de la ventana UTC (`:150-165`).

2. **Las claims de checkout realmente descansan en modelo de datos, pero no toda la exclusión es
   una única primitiva universal.** `packages/db/src/schema/issues.ts:18-63` guarda
   `assigneeAgentId`, `checkoutRunId`, `executionRunId` y campos de monitor. También contiene
   índices únicos parciales para deduplicar ejecuciones de rutina e incidentes de liveness
   (`:93-148`). Por separado, `server/src/services/agent-start-lock.ts:3-33` usa un `Map` de
   memoria por agente con vencimiento de 30 s; su test (`heartbeat-start-lock.test.ts:7-27`)
   prueba que un lock colgado no congele el siguiente start. Por tanto, no debe resumirse todo
   Paperclip como “un lock DB mágico”: hay capas de estado SQL y locks efímeros de proceso.

3. **Los fingerprints de configuración son versionados, deterministas y no exponen secretos
   crudos.** `effective-run-config-fingerprints.ts:227-239` ordena claves; `:266-295` hashea
   env plain y sustituye secretos por metadatos; `:363-381` emite
   `v1:sha256:<digest>` junto a JSON canónico; `:437-491` separa `session`, `workspace` y
   `lease`, y devuelve qué categoría cambió. Su test prueba orden estable, diff por categoría,
   que una rotación de versión de secreto cambia el fingerprint sin retener el valor, y que el
   cambio de un env plain se detecta sin guardar su texto
   (`effective-run-config-fingerprints.test.ts:7-197`).

4. **La trazabilidad de una corrida conserva integridad de log, no sólo su estado.**
   `packages/db/src/schema/heartbeat_runs.ts:11-65` incluye `logBytes`, `logSha256`, compresión,
   excerpts, salida, liveness, razón y `contextSnapshot`. La contabilidad distingue uso con coste
   reportado de uso sin precio, y prioriza coste ajustado por caché cuando está disponible
   (`heartbeat-cost-accounting.test.ts:8-65`).

5. **El “receipt” de Paperclip que fue leído no es un clon del receipt Git de VCP.**
   `issue-change-receipt.ts:5-41` construye deltas de campos de issue, omite `updatedAt`, trunca
   texto largo a 200 caracteres y canoniza arrays de relaciones. Es un recibo de auditoría de
   mutaciones del control-plane, no una prueba de bytes de un árbol Git.

## Relación exacta con VibeCodeProtocols

Las adopciones existentes siguen siendo honestas:

- La tabla 80%/100% de VCP en
  [`templates/vibe/COMPANY.md`](../../templates/vibe/COMPANY.md) líneas 37-47 es la versión
  manual y de una sola sesión del patrón que el código Paperclip aplica sobre costes y alcances.
  No se debe elevar esa tabla a “auto-pause” o “enforced runtime”: VCP declara explícitamente
  que no tiene esa infraestructura.
- `owner`/`locked` de
  [`templates/tasks.json`](../../templates/tasks.json) líneas 18-19 y el protocolo de
  [`skills/orchestrator-opus.md`](../../skills/orchestrator-opus.md) líneas 123-128 son
  bookkeeping de orquestador. No son equivalentes a los campos persistidos ni a los índices de
  Paperclip; el propio VCP ya advierte que la recuperación re-deriva evidencia
  (`templates/vibe/COMPANY.md:85-92`).
- El receipt de VCP sí prueba el estado Git separado HEAD→index e index→worktree; ver
  [`scripts/verify-receipt.mjs`](../../scripts/verify-receipt.mjs) líneas 16-52 y 178-186. No
  hay evidencia para sustituirlo por el receipt de cambios de issue de Paperclip.

### Único candidato útil, no aplicado

Paperclip prefija sus fingerprints con versión y algoritmo, además de conservar una forma
canónica para diagnosticar diferencias. VCP ya tiene versión global de receipt
`"schema": "vcp.receipt/v1"` (`SKILL.md:327`) y declara SHA-256 para
`tree_fingerprint` (`SKILL.md:337`), por lo que **no hay bug demostrado**. Si en el futuro se
rompe compatibilidad de la huella, un cambio deliberado —con fixtures de compatibilidad— podría
agregar un campo explícito de formato/algoritmo al receipt. No se recomienda hacerlo ahora sólo
por analogía: el contrato actual ya es suficiente y este informe no implementa nada fuera de
`research/`.

## Plan de cobertura atómica por paquetes

Cada fila es una unidad reproducible para una futura revisión semántica. El digest de scope es
SHA-256 de las tuplas Git `<mode>\\t<type>\\t<blob-sha>\\t<path>\\n` de ese paquete, ordenadas por
path. Sirve para detectar cambio de alcance; no certifica lectura semántica. `P03` tiene sólo
las cuatro piezas de schema indicadas arriba revisadas, no sus 461 blobs.

| Chunk | Scope | Blobs | Bytes | Digest de scope | Estado semántico |
|---|---|---:|---:|---|---|
| P01 | `packages/adapter-utils` | 63 (corregido; 60 era subconteo) | 1.531.833 | `1577F7394E3A3870C4359C767C5DD216C445E50D44A89DB1342BCAE0168E9831` | cerrado por superficie / parcial en profundidad: 28/28 archivos `.ts` no-test descargados y su exports inventariados (21 leídos íntegros: 16 pequeños + README/package.json/index.ts/types.ts de la pasada original + billing.ts/env-bindings.ts/setup-token-transport.ts/session-compaction.ts/workspace-restore-merge.ts de esta pasada); 9 archivos grandes (acpx-engine/execute.ts 3803L, server-utils.ts 3524L, execution-target.ts 2248L, ssh.ts 1873L, sandbox-callback-bridge.ts 1323L, sandbox-managed-runtime.ts 1262L, acpx-engine/startup-timing.ts 788L, command-managed-runtime.ts 578L, local-process-sandbox.ts 509L, git-workspace-sync.ts 508L) sólo inventariados por firma `export`, no leídos línea por línea; 24 `.test.ts` + test-support/ sin leer |
| P02 | `packages/adapters` | 304 | 2.044.775 | `5074A128890EB5D5364BAF53DD12C300C69325929E9A359EE900173DD8BF954F` | parcial: `AUTHORING.md` íntegro + ~10/304 blobs con lectura real cubriendo 4 arquetipos de adapter (claude-local CLI+ACP con fallback, codex-local auth-precedence puro, cursor-cloud SDK sin proceso local completo, openclaw-gateway WebSocket con 3 timeouts); gemini-local, grok-local, hermes, hermes-gateway, opencode-local, pi-local y todos los `.test.ts` sin leer |
| P03 | `packages/db` | 461 | 35.133.399 | `7FD627C91D7CA4A3BBA47E32B4A041EA68250ECC3DAE759A88D2242EAE49EC0E` | parcial: 7 schemas de negocio + `package.json`, `check-migration-safety.ts`, `check-migration-numbering.ts`, `migration-safety-baseline.ts`, `client.ts` (864L), `backup-lib.ts` (1035L) íntegros; 27/217 migraciones SQL leídas (muestreo sistemático 0000→0217, todo el rango histórico); ~107 schemas restantes, `backup.ts`, `embedded-postgres-*.ts`, `migrate.ts`, `migration-runtime.ts`, `migration-status.ts`, `runtime-config.ts`, `seed.ts`, `table-size-estimates.ts`, `test-embedded-postgres.ts`, 190 migraciones y todos los `.test.ts` sin leer |
| P04 | `packages/google-sheets-mcp-server` | 16 | 59.006 | `BEFECC5EEAFC00617ED6ABFACE818F91A581C935906E47FBB3997DF8911BCE07` | cerrado: 16/16 archivos leídos (8 fuente + README/package.json/tsconfig/vitest.config íntegros; 4 `.test.ts` no leídos pero contabilizados) |
| P05 | `packages/kv-demo-mcp-server` | 14 | 36.508 | `7774756F75FC823BF19A48EA9925A21070EC3560BF9ADD5150BE794A4EFBE80E` | cerrado: 14/14 archivos leídos (8 fuente + README/package.json/tsconfig/vitest.config íntegros; 3 `.test.ts` no leídos pero contabilizados) |
| P06 | `packages/mcp-server` | 11 | 47.670 | `9BC156705854B85489F562F69BD87EC30A5160CE8851D381ECBFF5B60D322692` | completo (9/9 archivos no-test/config íntegros; `tools.test.ts` no leído íntegro) |
| P07 | `packages/plugins` | 299 | 2.902.136 | `97B13E9C0092BDBE2564217AFF0796AA02BEBD7B376C9014DFB68099BCA54D66` | parcial: 21/299 archivos leídos (sdk/protocol.ts, sdk/define-plugin.ts, sdk/types.ts, sdk/worker-rpc-host.ts, sdk/host-client-factory.ts, kubernetes/{sandbox-orchestrator,job-orchestrator,network-policy,secret-manager,image-allowlist,sandbox-cr-orchestrator,tenant-orchestrator}.ts, cloudflare/bridge-template/src/{routes,auth,exec}.ts, cloudflare/src/bridge-client.ts, e2b/src/plugin.ts, daytona/src/plugin.ts, plugin-llm-wiki/src/{wiki/core.ts,manifest.ts}, plugin-workspace-diff/src/{workspace-diff,contracts}.ts); resto (examples/, sdk protocol tests, otros sandbox providers modal/novita/exe-dev, plugin-fake-sandbox, create-paperclip-plugin, todos los `.test.ts`) sin leer |
| P08 | `packages/shared` | 220 | 1.411.597 | `191AC5A125BAB583223865B24EFEADC451B91A7A96CE6CE8224A186AC77034FE` | parcial: 18/220 archivos leídos (api.ts, config-schema.ts, trust-policy.ts, execution-workspace-guards.ts, issue-write-denial.ts, responsible-user-denial.ts, portability-zip.ts, agent-eligibility.ts, feature-catalog.ts, types/{agent,plugin,routine,company,decision,environment}.ts, validators/{plugin,skill-policy,trust-policy,access}.ts); resto (app-definitions/*, telemetry/*, otros types/ y validators/, todos los `.test.ts`) sin leer |
| P09 | `packages/skills-catalog` | 43 | 286.317 | `3D14A77AF48D18DB8AC8F324C6E55BB23C73F3067D65F2C80C6696BB66C03BF7` | parcial: `src/` (builder+types+index+frontmatter) íntegro; catálogo de contenido (SKILL.md x N) no leído |
| P10 | `packages/teams-catalog` | 35 | 103.316 | `EF2A844A83B408AA0EE99231FCC157B0B7A0281C37A11D78D64A69D7DEAB895C` | parcial: `src/types.ts` íntegro; `src/catalog-builder.ts` (957 líneas) no leído íntegro, sólo por analogía estructural con P09; catálogo de contenido no leído |

El resto también queda contabilizado para después de P01-P10: `server` 856 blobs /
18.164.050 bytes (851 bajo `server/src`, de los cuales `services` tiene 251 y `__tests__` 444),
`ui` 1.406 / 15.652.555, `cli` 160 / 1.482.139, `doc` 154 / 7.020.443, `docs` 117 /
9.201.085, `scripts` 129 / 933.262 y los directorios menores/root restantes. Esos grupos deben
partirse por subpaquete o módulo cohesivo antes de asignarlos; no por un límite arbitrario de
tokens que rompa interfaces y tests.

## Continuación — chunks P06-P10 — 2026-08-14

Verificado el estado previo de la tabla de chunks antes de empezar: P06-P10 seguían
"pendiente" (sin trabajo paralelo detectado). Se cierra P06 completo y se avanza P09/P10 de
forma parcial y honesta (ver tabla arriba); P07/P08 quedan pendientes por volumen (299 y 220
blobs) — no se leyeron.

Archivos leídos íntegros en esta pasada (11 total): `packages/mcp-server/{README.md,
package.json, src/client.ts, src/config.ts, src/format.ts, src/index.ts, src/stdio.ts,
src/tools.ts}` (8 de negocio; `tools.test.ts` sólo inspeccionado por estructura, no
íntegro); `packages/skills-catalog/src/{types.ts, index.ts, frontmatter.ts}` íntegros y
`src/catalog-builder.ts` (873 líneas) leído por secciones cubriendo todas sus 5 funciones
exportadas; `packages/teams-catalog/src/types.ts` íntegro.

### `packages/mcp-server` (P06) — inventario

- `src/tools.ts:237-634` exporta `createToolDefinitions(client)`, que arma 33 herramientas
  MCP (`paperclipListIssues`, `paperclipCheckoutIssue`, `paperclipApprovalDecision`,
  `paperclipControlIssueWorkspaceServices`, `paperclipApiRequest` de escape hatch genérico,
  etc.), cada una un `z.ZodObject` validado antes de llamar a la API HTTP de Paperclip.
  `paperclipApiRequest` (`:620-632`) es una válvula deliberada: cualquier ruta `/api` no
  cubierta por una tool específica, pero con guardas contra `..` y rutas no relativas.
- `src/client.ts:51-114` — `PaperclipApiClient.requestJson` agrega
  `Authorization: Bearer`, y sólo añade `X-Paperclip-Run-Id` en métodos de escritura o si se
  pide explícito (`:91`). Errores no-2xx se envuelven en `PaperclipApiError` con
  `status/method/path/body` (`:3-23`), y `formatErrorResponse`
  (`src/format.ts:18-31`) los serializa de vuelta al modelo como texto MCP en vez de
  lanzar una excepción opaca — el agente ve el motivo real del fallo HTTP.
- `src/config.ts:22-39` — `readConfigFromEnv` exige `PAPERCLIP_API_URL` y
  `PAPERCLIP_API_KEY`; `companyId`/`agentId`/`runId` son opcionales y se resuelven después
  vía `client.resolveCompanyId`/`resolveAgentId` (`client.ts:62-76`), que lanzan si ni el
  argumento de la tool ni el env están seteados. Falla explícito, no default silencioso.
- `src/index.ts:7-24` — `createPaperclipMcpServer` es la única función que instancia
  `McpServer` del SDK oficial y conecta `tools.js`; separada de `runServer` (`:26-30`), que
  además abre el transporte stdio. Esta separación es la que permite testear
  `createToolDefinitions`/`client` sin levantar un proceso MCP real (confirmado por la
  forma de `tools.test.ts`, que importa `createToolDefinitions` directo).

### `packages/skills-catalog` (P09) — inventario

- `src/types.ts:1-63` define el esquema del manifiesto de catálogo de skills: cada
  `CatalogSkill` (`:29-48`) tiene `trustLevel: "markdown_only" | "assets" |
  "scripts_executables"`, `contentHash`, lista de `files[]` con `sha256` individual por
  archivo, y un `source?: CatalogSkillGitHubSource` opcional con `owner/repo/ref/commit/
  path/url` — es decir, un skill "optional" puede vivir fuera del repo, referenciado a un
  commit Git de 40 hex ajeno.
- `src/catalog-builder.ts` exporta 5 funciones (`formatCatalogManifest:76`,
  `buildExpectedCatalogManifest:80`, `buildCatalogManifest:99`, `validateCatalog:137`,
  `writeCatalogManifest:163`). `buildCatalogManifest` descubre candidatos locales y
  "referenced" (`discoverSkillCandidates`), construye cada `CatalogSkill` y ordena por id
  (`:107-123`); `validateCatalog` (`:137-161`) recompila el manifiesto esperado y lo
  compara byte a byte contra `generated/catalog.json` en disco — detección de manifiesto
  obsoleto sin heurísticas de "parece cambiado".
- Para skills "referenced": `collectReferencedSkillFiles` (`:564-609`) llama
  `fetchGitHubTree` (`:611-630`, `GET .../git/trees/<commit>?recursive=1`) y descarga cada
  blob por `fetchReferencedFileBytes` (`:642-665`) desde una URL raw pineada al commit
  (`rawGitHubUrl`), calculando `sha256` por archivo (`:593-600`) y respetando un límite de
  tamaño `MAX_CATALOG_FILE_BYTES = 1MiB` (`:26`, `:588-591`). Sólo acepta commits de 40 hex
  (`:551`, regex `^[0-9a-f]{40}$`) — rechaza refs móviles como fuente pineada.
- `deriveTrustLevel` (`:763-767`) clasifica: cualquier archivo bajo `scripts/` sube el
  trust level a `scripts_executables`; `assets/`/otros no reconocidos a `assets`; si sólo
  hay markdown/skill/reference, queda `markdown_only`. Es una señal de riesgo de supply
  chain calculada, no declarada a mano por el autor del skill.
- `collectSkillFiles` (local, `:667-738`) además previene path traversal de symlinks
  (`isPathInside(skillRoot, realPath)`, `:691-693`), rechaza symlinks a directorios
  (`:695-698`) y exige que exista `SKILL.md` con `kind: "skill"` (`:733-735`).

### `packages/teams-catalog` (P10) — inventario parcial

- `src/types.ts:1-115` extiende el mismo patrón a equipos: `CatalogTeamTrustLevel` agrega
  un cuarto nivel, `"external_sources"` (`:3-7`), por encima de `scripts_executables` —
  reconociendo que un TEAM.md puede depender de fuentes externas aunque ninguno de sus
  archivos propios sea script. `CatalogTeamSkillRequirement` (`:34-44`) tipa 7 formas de
  requerir un skill (`catalog|local|skills_sh|github|url|local_path|agent_package`) con
  `resolved: boolean` explícito. `CatalogTeamSourceRef` (`:54-58`) trae un campo
  `pinned: boolean` por referencia — declara si esa fuente está anclada a un commit o no,
  en vez de inferirlo. `CatalogTeamEnvInputSummary` (`:46-52`) clasifica cada variable de
  entorno requerida por un equipo como `kind: "secret" | "plain"` y
  `requirement: "required" | "optional"`, atada a `agentSlug`/`projectSlug`.
- No se leyó `src/catalog-builder.ts` (957 líneas) línea por línea en esta pasada; por la
  paridad de nombres de función con P09 (`formatCatalogManifest`, `buildCatalogManifest`,
  `validateCatalog`, `writeCatalogManifest`) es razonable esperar la misma arquitectura,
  pero **esto es una inferencia por analogía, no una lectura verificada**, y no debe
  citarse como hecho comprobado hasta leerlo.

### Ideas nuevas aplicables a VCP (chunks P06-P10)

1. **Clasificación de trust level derivada, no declarada, para contenido importado.**
   `packages/skills-catalog/src/catalog-builder.ts:763-767` calcula
   `markdown_only|assets|scripts_executables` mirando qué archivos trae un skill, y
   `packages/teams-catalog/src/types.ts:3-7` añade `external_sources`. VCP no tiene hoy
   ningún mecanismo de importación de skills/equipos de terceros (todo su árbol
   `skills/*.md` es propio y versionado en el mismo repo), así que esto no es un bug de
   VCP — es una capacidad que VCP no necesita mientras no importe contenido externo. Si en
   el futuro VCP agrega un catálogo de skills instalables desde fuera del repo, este
   patrón (trust level derivado de qué carpetas trae el paquete + hash por archivo) es
   directamente portable y más verificable que confiar en metadata declarada por el autor
   del skill importado.
2. **`pinned: boolean` explícito por referencia, separado del hash.** VCP ya fija SHA de
   snapshot para este mismo research (`dc6fcd1ff...`), pero no tiene un campo estructurado
   análogo a `CatalogTeamSourceRef.pinned` (`teams-catalog/src/types.ts:54-58`) en sus
   propios templates (`templates/tasks.json`, `templates/vibe/*.md`) para cuando una tarea
   o skill declare una dependencia externa (URL, repo, doc). No hay evidencia de que VCP
   necesite esto hoy — no gestiona dependencias externas por tarea — así que se anota como
   candidato, no como hallazgo accionable inmediato.
3. **Ningún otro patrón nuevo en P06.** `packages/mcp-server` es un adaptador MCP-a-HTTP
   directo (33 tools ↔ API REST de Paperclip); no introduce ningún mecanismo de
   integridad, checkout, presupuesto o fingerprint distinto de lo ya documentado en
   `server/` en la pasada anterior. No se encontró nada aplicable a VCP en este paquete
   más allá de lo ya cubierto por el hallazgo 5 de la sección anterior (formato de
   respuesta de error, que es específico de MCP y no tiene análogo en el flujo de VCP).

### Estado de cierre de esta pasada

P06 queda completo por archivo de negocio (8/9; test suite no leída íntegra). P09 queda
con su superficie de código (`src/`) íntegra pero su contenido de catálogo (43 blobs, en
su mayoría `SKILL.md`/referencias de skills empaquetados) sin leer. P10 queda con
`types.ts` íntegro pero `catalog-builder.ts` (957 líneas) y todo su contenido de catálogo
sin leer — su fila en la tabla NO debe leerse como "completo". P07 (`packages/plugins`,
299 blobs) y P08 (`packages/shared`, 220 blobs) permanecen enteramente pendientes; no se
tocó ningún archivo de esos dos chunks en esta pasada.

## Continuación — chunks P01-P05 — 2026-08-14

Estado previo verificado antes de empezar: P01/P02/P04/P05 estaban "pendiente" y P03 "parcial:
4 schemas" (trabajo de la pasada original). Nota: mientras esta pasada corría, otra sesión
concurrente cerró P06-P10 (sección arriba); no hay solapamiento de archivos entre ambos
trabajos.

Archivos leídos íntegros en esta pasada (24 de negocio, ver detalle por chunk abajo, más
README/package.json de soporte): P04 y P05 quedan **cerrados al 100%** de sus archivos no-test
(8/8 y 8/8 respectivamente, más README/package.json/tsconfig/vitest.config); P01 y P03 avanzan
de forma parcial y explícita; P02 sólo se cubrió a nivel de contrato/estructura, sin leer
ningún archivo de implementación de adapter.

### `packages/google-sheets-mcp-server` (P04) — inventario, cerrado

- `src/config.ts:1-175` — `createGoogleSheetsMcpConfig`/`createGoogleSheetsMcpHttpConfig`
  validan la service-account con Zod (`serviceAccountSchema:4-9`), calculan
  `secretRedactions` (`:120-124`: el JSON crudo, el `private_key` y el `client_email`, cada
  uno de ≥8 chars) y exigen `GOOGLE_SHEETS_MCP_TOKEN` si el host de bind no es loopback
  (`isLoopbackBindHost:76-83`, uso en `:145-148`) — fail-closed en vez de exponer sin token
  por accidente.
- `src/google-client.ts:113-260` implementa `GoogleSheetsClient` sobre `googleapis`: 9
  métodos (`listSpreadsheets`, `getSpreadsheetInfo`, `readValues`, `searchRows`,
  `appendRows`, `updateValues`, `addSheetTab`, `clearValues`, `deleteRows`), todos
  devolviendo tipos normalizados propios, no la respuesta cruda de Google.
- `src/tools.ts:141-248` — `createToolDefinitions` registra 9 tools MCP, cada una con
  `annotationsFor(title, risk)` (`:66-74`) que marca `readOnlyHint`/`destructiveHint` según
  `"read"|"write"|"destructive"`; `assertAllowed` (`:135-139`) rechaza cualquier
  `spreadsheetId` fuera de `allowedSpreadsheetIds`, y `formatErrorResponse` (`:100-107`)
  pasa el error por `redact()` (`:93-98`, que además detecta y enmascara bloques PEM
  `-----BEGIN PRIVATE KEY-----`) antes de devolverlo al modelo — un secreto que se cuela en
  un mensaje de error nunca llega al transcript.
- `src/http.ts:1-129` — servidor HTTP `/mcp` mínimo: crea `McpServer` + `StreamableHTTPServerTransport`
  por request (stateless, `sessionIdGenerator: undefined`), exige `Authorization: Bearer
  <token>` cuando hay token configurado (`presentedToken:29-32`, chequeo en `:96-98`), y
  limita el body a 1MB (`:41`).

### `packages/kv-demo-mcp-server` (P05) — inventario, cerrado

- Paquete de demostración de referencia (no producción): `store.ts` es un `Map` en memoria
  sin persistencia (`:16-19` del docstring de clase), `tools.ts` expone 4 tools
  (`kv_set`/`kv_get`/`kv_list`/`kv_delete`) con el mismo patrón `makeTool`/`annotationsFor`
  visto en P04, y `http.ts` sirve además una UI HTML server-rendered (`render.ts`) que hace
  polling de `GET /api/state` cada 2s. Mismo modelo de auth por token opcional que P04
  (`presentedToken`, `KV_DEMO_TOKEN`).
- Valor para VCP: ambos paquetes (P04, P05) son la plantilla mínima reproducible de
  "MCP server con tools validadas + auth opcional + redacción de secretos en errores" que
  Paperclip usa para todos sus adapters MCP; confirma que el patrón `annotationsFor` +
  `assertAllowed`/allowlist + redacción de error es consistente entre ambos paquetes, no
  específico de uno.

### `packages/adapter-utils` (P01) — inventario parcial

- `src/command-redaction.ts:1-58` — `redactCommandText` combina 6 regex (opción CLI tipo
  `--api-key VALUE`, asignación `ENV=valor`, `Authorization: Bearer`, claves estilo
  `sk-...` de OpenAI, tokens `gh[pousr]_...` de GitHub, y JWT de 3-4 segmentos) detrás de
  un pre-filtro barato `maybeContainsSecretText` (`:92-95`) que evita correr las regex si
  el comando no contiene ningún hint de secreto ni un punto. Es una librería de redacción
  de comandos de shell, no de JSON estructurado.
- `src/log-redaction.ts:1-97` — `redactHomePathUserSegments` enmascara el segmento de
  usuario en rutas home (`/Users/<user>`, `/home/<user>`, `C:\Users\<user>`) a
  `<primera-letra>+asteriscos`, recursivamente sobre objetos/arrays
  (`redactHomePathUserSegmentsInValue:44-58`) y aplicado por tipo de entrada de
  transcript (`redactTranscriptEntryPaths:60-95`, switch sobre 9 variantes de `kind`).
- `src/remote-execution-env.ts:1-40` — `sanitizeRemoteExecutionEnv` quita del env que se
  manda a un runtime remoto cualquier variable "de identidad" (`PATH`, `HOME`, `USER`,
  etc., lista en `:1-16`) **sólo si su valor coincide exactamente** con el heredado del
  proceso local; si el llamador la pisó a propósito, se conserva. Evita filtrar el `HOME`
  del host que corre Paperclip al entorno del agente sin bloquear un override intencional.
- `src/exclude-patterns.ts:1-28` — `shouldExcludePath`/`excludePatternMatches` implementan
  3 formas de patrón (`*/seg/*`, `*/seg`, `seg/*`, exacto/descendiente) sin depender de una
  librería glob completa; usado (por `index.ts` y el resto de src/ss no leído) para
  excluir paths del sync de workspace.
- `packages/adapter-utils/README.md:9-33` + `packages/adapters/AUTHORING.md:1-70` (leído
  íntegro) documentan el **"no-remote-git contract"**: el cwd local de ejecución es el
  único límite de persistencia entre corridas; ningún adapter puede depender de un `git
  remote` para estado entre corridas. Un adapter que corre el agente en otro host debe usar
  `prepareWorkspaceForSshExecution`/`restoreWorkspaceFromSshExecution` (`src/ssh.ts`, no
  leído íntegro esta pasada) para llevar el cwd de ida y vuelta sin remote configurado. El
  contrato está reforzado por un chequeo estático,
  `scripts/check-no-git-push.mjs` (mencionado en `AUTHORING.md:60-68`, no leído), que falla
  el job `policy` de CI si aparece un `git push` no aprobado fuera de un comentario
  `// paperclip:allow-git-push: <reason>`.
- No leídos esta pasada (quedan pendientes para un cierre real de P01): los 9 archivos
  `.ts` grandes con lógica de ejecución/sandbox (`execute.ts` 166KB, `server-utils.ts`
  143KB, `sandbox-managed-runtime.ts` 55KB, `ssh.ts` 61KB, `execution-target.ts` 88KB,
  `command-managed-runtime.ts` 26KB, `git-workspace-sync.ts` 18KB,
  `local-process-sandbox.ts` 20KB, `sandbox-callback-bridge.ts` 53KB) y todos los
  `.test.ts` del paquete (14 archivos).

### `packages/adapters` (P02) — sin inventario de implementación

Sólo se leyó `AUTHORING.md` (íntegro) y el listado de 11 subdirectorios de adapters
(`claude-local`, `codex-local`, `cursor-cloud`, `cursor-local`, `gemini-local`,
`grok-local`, `hermes`, `hermes-gateway`, `openclaw-gateway`, `opencode-local`,
`pi-local`). El contenido documenta el mismo "no-remote-git contract" que P01 desde el
lado del autor de adapter, más un detalle nuevo: una copia de workspace transportada
*puede* llevar la URL del remote `origin` original como metadata (para que ramas creadas
por el agente sigan siendo publicables por un operador con credenciales), pasando por
`sanitizeGitRemoteUrl` (mencionado, no leído) — URLs http(s) pierden userinfo/query/
fragment, `ssh:`/`git:` pierden password/query, y cualquier otra forma (paths de
filesystem, esquemas desconocidos) se descarta en vez de arriesgar persistir un secreto
embebido. Ninguno de los 304 blobs de implementación de adapter individual fue leído; esta
fila NO debe tratarse como cobertura de código, sólo de contrato documentado.

### `packages/db` (P03) — inventario parcial adicional (además de los 4 schemas previos)

- `packages/db/src/check-migration-numbering.ts:1-77` (íntegro) — chequeo estático de CI:
  exige que los archivos `migrations/*.sql` tengan número de 4 dígitos único y
  estrictamente ordenado (`ensureNoDuplicates`/`ensureStrictlyOrdered:20-45`), y que
  `migrations/meta/_journal.json` tenga exactamente las mismas entradas en el mismo orden
  (`ensureJournalMatchesFiles:47-62`) — detecta un journal de Drizzle desincronizado de los
  archivos reales antes de aplicar cualquier migración.
- `packages/db/src/check-migration-safety.ts` (leído por secciones: imports, tipos,
  `RULE_METADATA:64-79`, normalizadores) + `packages/db/src/migration-safety-baseline.ts`
  (íntegro) — analizador estático de SQL con 4 reglas (`loop-mutation-large-table`,
  `batched-mutation-large-table-missing-index`, `full-table-mutation-large-table`,
  `large-create-index-not-concurrently`) sobre tablas conocidas como grandes
  (`isKnownLargeTable`, importado de `table-size-estimates.js`, no leído). La pieza
  distintiva es `MigrationSafetyResult` (`:36-41`): separa `newFindings` de
  `baselineFindings` contra una lista fija `MIGRATION_SAFETY_BASELINE` — cada entrada del
  baseline tiene `id` (hash), `rule`, `migration`, `table` y `reason` en texto libre (p.ej.
  "Initial schema history predates the migration-safety guard."). El chequeo falla sólo
  ante un finding **nuevo** no presente en el baseline, y separadamente reporta
  `staleBaselineIds` (entradas del baseline que ya no matchean ningún finding real) — un
  gate de deuda técnica que no re-litiga decisiones pasadas pero sí detecta cuándo el
  baseline queda obsoleto.
- `packages/db/package.json:1-46` confirma el pipeline: `generate`/`build`/`typecheck`
  corren `check:migrations` (= ambos scripts anteriores) antes de compilar o generar SQL
  nuevo vía `drizzle-kit generate`.
- No leídos esta pasada: ~100 archivos `migrations/*.sql`, `client.ts` (31KB),
  `backup-lib.ts` (38KB), `backup.ts`, `embedded-postgres-*.ts`, y los `.test.ts`
  correspondientes — la fila sigue "parcial", ahora con 3 archivos más de gobernanza de
  migraciones cubiertos además de los 4 schemas de la pasada original.

### Ideas nuevas aplicables a VCP (chunks P01-P05)

1. **Gate de "baseline diff" (nuevo vs. conocido) — candidato real, no aplicado.**
   `packages/db/src/check-migration-safety.ts:36-41` + `migration-safety-baseline.ts`
   separan hallazgos nuevos de hallazgos ya aceptados por id/hash, y detectan cuándo una
   entrada del baseline queda obsoleta (`staleBaselineIds`). VCP hoy trata
   `simplify-ignore` como bloque binario de solo-lectura (`SKILL.md:253-254`) y el gate de
   seguridad 4.3 como fix-or-log-a-DEBT.md sin concepto de "hallazgo ya aceptado con
   justificación versionada" (`SKILL.md:257-264`). No hay bug: el contrato actual de VCP es
   deliberadamente más simple (todo Critical/High se arregla, no se acepta). Si en el
   futuro VCP quisiera tolerar hallazgos preexistentes de un scan más agresivo (por
   ejemplo al subir de severidad `cyber-neo`) sin bloquear cada sesión por deuda heredada,
   este patrón —lista de excepciones con `id`/`rule`/`reason` en texto, más detección de
   entradas obsoletas— es portable y más verificable que agregar rutas a un `.security-
   ignore` sin justificación. No se recomienda implementarlo ahora sin que el usuario
   decida que quiere tolerar deuda heredada en el gate de seguridad.
2. **Redacción de secretos en dos capas (regex de shell + redacción de paths de usuario)
   ya cubre lo que un `command-redaction.ts` cubriría en VCP, pero VCP no ejecuta comandos
   de agente ni transcribe sesiones — no hay superficie de ataque análoga.** Se registra
   como comparación, no como hallazgo accionable: `packages/adapter-utils/src/command-
   redaction.ts` y `log-redaction.ts` resuelven un problema (comandos/logs de un agente
   corriendo en un sandbox remoto) que VCP no tiene, porque VCP no orquesta ejecución de
   agentes con acceso a shell fuera de la sesión de Claude Code misma.
3. **Ningún otro patrón nuevo con evidencia suficiente en P01/P02/P04/P05.** El resto de lo
   leído (contrato no-remote-git, allowlist de tools MCP, `annotationsFor` de riesgo por
   tool) ya está cubierto conceptualmente por lo que VCP hace con Git real (receipt
   `scripts/verify-receipt.mjs`) o no aplica (VCP no expone tools MCP propias).

### Estado de cierre de esta pasada (P01-P05)

P04 y P05: **cerrado** (100% de archivos no-test de negocio, ver arriba). P01: parcial,
ampliado respecto a "pendiente" pero con 9 archivos grandes y toda su suite de tests sin
leer — no debe marcarse cerrado. P02: parcial mínimo, sólo contrato documentado, 0
archivos de implementación de adapter leídos — la fila más lejos de cierre del rango
asignado. P03: parcial, ampliado con 3 archivos de gobernanza de migraciones además de los
4 schemas previos; ~100 migraciones SQL y los módulos grandes de `client.ts`/`backup-
lib.ts` siguen sin leer.

## Continuación — P02 adapters batch 2 — 2026-08-14

Estado previo verificado: P02 (`packages/adapters`, 304 blobs) seguía en "sin inventario de
implementación" — sólo `AUTHORING.md` y listado de directorios, 0 archivos de adapter leídos.
Esta pasada lee implementación real, priorizando **variedad de tipo de adapter** sobre
profundidad en uno solo, tal como se pidió.

Archivos leídos íntegros esta pasada (7, más 3 leídos parcialmente por sección — 10 total):
`packages/adapters/claude-local/src/server/index.ts` (barrel, 130 líneas, íntegro),
`packages/adapters/cursor-cloud/src/server/index.ts` (config schema, íntegro),
`packages/adapters/cursor-cloud/src/server/execute.ts` (366 líneas, íntegro),
`packages/adapters/codex-local/src/server/auth-precedence.ts` (46 líneas, íntegro); leídos por
sección (firma exportada + cuerpo relevante, no el archivo completo): `claude-local/src/server/
execute.ts` (1.271 líneas — sección `execute()` líneas 394-493), `codex-local/src/server/
execute.ts` (1.582 líneas — sólo firmas exportadas grep'eadas, cuerpo no leído),
`openclaw-gateway/src/server/execute.ts` (1.492 líneas — sección `execute()` líneas 1027-1116).
`opencode-local/src/server/execute.ts` sólo grep'eado por firma, no leído. Total P02 acumulado:
~10 de 304 blobs con lectura real (3 íntegros de negocio + 4 por sección + AUTHORING.md de la
pasada anterior); **sigue "parcial"**, ahora muy lejos de cierre pero con cobertura real de
4 tipos de adapter distintos en vez de 0.

### Tipos de adapter cubiertos (4 arquetipos distintos, no variantes del mismo)

1. **CLI local con protocolo ACP y fallback automático** (`claude-local`). `execute()`
   (`execute.ts:394-410`) intenta primero el motor ACP (`executeClaudeAcp`); si falla y el motor
   no fue forzado explícitamente (`engineSelection.explicit`), loguea la razón por `stderr` vía
   `formatClaudeAcpFallbackMessage` y sigue con el subproceso CLI clásico en vez de abortar el
   run. El barrel `index.ts` exporta 6 grupos de funciones: ejecución (`execute`,
   `runClaudeLogin`), ACP, config schema, skills, modelos con caché, capacidades de CLI
   (`claudeCommandSupportsEffortFlag`), parseo de stream-json, y todo el flujo de login
   `setup-token` (parser + runner que maneja un PTY de dos vías y libera el token minted una
   sola vez en memoria — `SETUP_TOKEN_CREDENTIAL_RELEASE_GATE`). El `sessionCodec`
   (`index.ts:73-130`) normaliza tanto `camelCase` como `snake_case` de campos de sesión
   (`sessionId`/`session_id`, `cwd`/`workdir`/`folder`) y delega a `acpxSessionCodec` si no hay
   `sessionId` — dos formatos de sesión conviven en el mismo adapter.
2. **CLI local con jerarquía de auth explícita** (`codex-local`). `auth-precedence.ts:26-46`
   —`resolveCodexAuthPrecedence`— es una función pura de 3 booleans → un
   `CodexAuthPrecedenceWinner` (`configured_api_key > host_auth_json > sandbox_auth_json > none`)
   más `sandboxLoginShadowed`/`shouldWarn`. Ningún I/O: sólo decide qué credencial gana y si debe
   advertir que el login hecho *dentro* del sandbox quedó tapado por una credencial de más
   prioridad configurada afuera. `execute.ts` (grep de firmas) confirma un flujo mucho más
   grande que Claude: `assertCodexCredentialsLaunchable`, `ensureCodexSkillsInjected`, y
   archivos dedicados a copiar credenciales de vuelta del sandbox (`codex-auth-copyback.ts`,
   `codex-auth-merge-decision.ts`/`.cjs`/`codex-auth-merge-extract.sh` — mezcla TS+shell script
   para el merge de auth.json).
3. **SDK cloud, sin proceso local** (`cursor-cloud`, `execute.ts` completo). No hay subprocess
   ni sandbox: usa `@cursor/sdk` (`Agent.create`/`Agent.resume`/`Agent.getRun`) para lanzar o
   reanudar un agente que corre enteramente en la nube de Cursor. Reintento/continuidad de
   sesión: si `sessionMatches()` confirma que el run anterior fue con el mismo `envType`/
   `envName`/`repos`, intenta primero reengancharse a un run "running" existente
   (`getAttachedRun`, con `try/catch` que retorna `null` en cualquier error — fail-soft, no
   fail-loud) antes de crear uno nuevo. Nunca acepta `PAPERCLIP_API_KEY` de la config del
   adapter (`execute.ts` — comentario explícito "the harness-minted run token is the only
   source of Paperclip API identity", con `delete env.PAPERCLIP_API_KEY` seguido de reinyectarlo
   sólo desde `ctx.authToken`). El cleanup usa `Symbol.asyncDispose` en un `finally` con su
   propio `try/catch` "best effort only" — no deja pelotudear el resultado si el dispose falla.
4. **Gateway WebSocket con auth por header/token/device** (`openclaw-gateway`, sección
   `execute()` líneas 1027-1116). No es CLI ni SDK cloud: valida que la URL de config sea
   `ws:`/`wss:` explícitamente (rechaza cualquier otro protocolo con `errorCode:
   "openclaw_gateway_url_protocol"`), separa `timeoutSec` (config del run) de
   `connectTimeoutMs` (tope de 15s para el handshake) y `waitTimeoutMs` (config independiente,
   default 30s) — tres timeouts con roles distintos en vez de uno genérico. Auth por 3 vías no
   excluyentes: header `Authorization` explícito, `password`, `deviceToken`, con
   `disableDeviceAuth` como flag de escape. Todos los errores de configuración retornan
   `errorCode` estructurado (`openclaw_gateway_url_missing`/`_invalid`/`_protocol`) en vez de
   sólo `errorMessage` de texto libre — más fácil de branchear en la UI/monitoreo que parsear el
   mensaje.

Confirmado por grep de firmas en los 4 tipos (`claude-local`, `codex-local`, `openclaw-gateway`,
`opencode-local`): todos exportan exactamente `execute(ctx: AdapterExecutionContext):
Promise<AdapterExecutionResult>` — el contrato de adapter es uniforme pese a que la
implementación interna va de "spawnea CLI + parsea stdout" a "SDK cloud sin proceso" a
"WebSocket con framing propio".

### Ideas nuevas aplicables a VCP (batch 2)

1. **Fallback de motor con degradación explícita, no silenciosa — patrón real, sin análogo hoy
   en VCP.** `claude-local/src/server/execute.ts:396-410`: intento del camino preferido (ACP),
   catch, log explícito de la razón del fallback, y sólo entonces camino B — pero *nunca* si el
   motor fue forzado a mano. VCP no tiene hoy ningún paso con dos implementaciones intercambiables
   (el protocolo de 7 fases es lineal, no A/B), así que esto no es una laguna de VCP. Se anota
   como patrón futuro si VCP alguna vez ofrece, por ejemplo, dos motores de verify-receipt (uno
   rápido/heurístico y uno exhaustivo) y quisiera degradar de forma auditable en vez de callar el
   fallback.
2. **`errorCode` estructurado además de `errorMessage` de texto libre — candidato concreto y
   pequeño.** `openclaw-gateway/src/server/execute.ts:1035,1046,1057` usa códigos estables
   (`openclaw_gateway_url_missing/_invalid/_protocol`) junto al mensaje humano. El receipt de VCP
   (`scripts/verify-receipt.mjs`) y el hard gate de `SKILL.md` hoy comunican fallos sólo como
   texto (mensajes de test rojo, líneas de gate); no hay evidencia de que esto cause un bug real
   — un humano leyendo la sesión entiende el texto — pero si en el futuro algo *automatizado*
   (un hook, un dashboard) necesitara branchear sobre el tipo de fallo del receipt sin parsear
   prosa, un campo `code` corto y estable en el JSON de receipt (además del mensaje) sería
   portable desde este patrón. No implementado: no hay consumidor automatizado del receipt hoy.
3. **Precedencia de credenciales como función pura testeable, separada del I/O que las lee.**
   `codex-local/src/server/auth-precedence.ts` no lee archivos ni env: recibe 3 booleans y
   retorna la decisión + si debe advertir. VCP no maneja credenciales de terceros (no hay
   concepto de "login" en el protocolo), así que no aplica directo; se registra sólo como
   ejemplo de diseño (lógica de decisión aislada de I/O) que ya es coherente con cómo
   `scripts/verify-receipt.mjs` separa cálculo de hash de la lectura de archivos — no es una idea
   nueva para VCP, es una confirmación de que el patrón que VCP ya usa también aparece acá.
4. **Ningún otro hallazgo con evidencia suficiente en este batch.** El resto de lo leído (barrel
   exports de `claude-local`, config schema declarativo de `cursor-cloud`, 3 timeouts separados
   de `openclaw-gateway`) es diseño de calidad de un adapter multi-proveedor — no tiene análogo
   en VCP porque VCP no orquesta múltiples motores de agente intercambiables.

### Estado de cierre de este batch

P02 sigue **parcial**, ahora con evidencia real de implementación en 4 de 11 tipos de adapter
(`claude-local`, `codex-local` parcial por firma, `cursor-cloud` completo, `openclaw-gateway`
parcial por sección) sobre ~10 de 304 blobs leídos con algún nivel de profundidad. Quedan sin
tocar del todo: `gemini-local`, `grok-local`, `hermes`, `hermes-gateway` (sólo grep de estructura
en el listado inicial, index.ts de 9 líneas no leído íntegro), `opencode-local` (sólo firma),
`pi-local`, y las suites `.test.ts`/`__fixtures__` de los 4 tipos ya tocados. No se debe citar
`codex-local` u `openclaw-gateway` como "leídos" más allá de las líneas explícitamente citadas
arriba.

## Estado y condición de cierre

**PARCIAL.** El snapshot, tamaño, modos, tipos, hash de archivo, digest del árbol y plan de
chunks son reproducibles para los 4.559 blobs. La cobertura semántica sigue siendo una muestra
documental + 9 archivos de implementación/test completos y 2 secciones de servicio.

No podrá marcarse como exhaustiva hasta que cada blob del manifiesto tenga trazabilidad de:

1. lectura semántica íntegra de código/config/test/documento, o inspección técnica explícita del
   binario/symlink;
2. funciones/entradas/efectos/tests y aplicabilidad a VCP por chunk;
3. contraste de claims importantes contra implementación y tests; y
4. suite de Paperclip ejecutada sólo si se autoriza instalar sus dependencias. Sin eso, se puede
   hablar de cobertura estática, nunca de comportamiento ejecutado.

## Continuación — P07-P08 — 2026-08-14

Se leyeron 39 archivos vía `gh api .../contents/<path>?ref=dc6fcd1ff1eaa52df7685c8d12257b650dbf611c`
(21 de P07 `packages/plugins`, 18 de P08 `packages/shared`), priorizando SDK/protocolo,
orquestación de sandbox y schemas/validadores sobre tests y ejemplos. Ver tabla de chunks
arriba para el listado exacto de archivos leídos vs pendientes por chunk (299 y 220 blobs
respectivamente; **ninguno de los dos cierra**, cobertura ~7% y ~8%).

### P07 `packages/plugins` — qué es

Monorepo de plugins de Paperclip: (1) `sdk/` — SDK de autoría de plugins (protocolo RPC
worker↔host, definición de manifest, tipos, cliente de host); (2) `sandbox-providers/` —
adaptadores de ejecución de sandboxes por proveedor (kubernetes, cloudflare, e2b, daytona,
modal, novita, exe-dev); (3) plugins de producto (`plugin-llm-wiki`, `plugin-workspace-
diff`); (4) `examples/` y `create-paperclip-plugin` (scaffolding); (5)
`paperclip-plugin-fake-sandbox` (test double).

Notable:
- `sdk/src/protocol.ts` (2253 líneas): define el protocolo JSON-RPC entre plugin worker
  (sandboxed, sin acceso directo a host) y host — mensajes tipados por método, incluye
  negociación de entorno y "postupload" hooks.
- `sandbox-providers/kubernetes/src/image-allowlist.ts:6-16` — `globMatch()`: glob simple
  donde `*` NO cruza `/` (evita que un wildcard en el allowlist de imágenes matchee rutas
  con más segmentos de los previstos); `resolveImage()` (líneas 31-46) rechaza cualquier
  `imageOverride` no listado en `imageAllowList` con `throw`.
- `kubernetes/src/network-policy.ts`, `secret-manager.ts`, `tenant-orchestrator.ts`,
  `sandbox-cr-orchestrator.ts`: aislamiento de red por Cilium NetworkPolicy, gestión de
  secretos por tenant y orquestación de sandboxes vía Custom Resources — patrón de defensa
  en profundidad para ejecución de código de agentes no confiable.
- `cloudflare/bridge-template/src/{routes,auth,exec}.ts`: bridge HTTP mínimo (auth.ts 40
  líneas, routes.ts 480, exec.ts 148) para exponer exec de sandbox vía Cloudflare Worker.
- `plugin-llm-wiki/src/wiki/core.ts` (4980 líneas): el archivo más grande leído; motor de
  mantenimiento de wiki LLM-generado (índices, síntesis, ingest) — no auditado en
  profundidad línea por línea dado el tamaño, sólo estructura de exports confirmada.

### P08 `packages/shared` — qué es

Paquete de tipos/validadores/utilidades compartidos entre server, ui, plugins y adapters:
`types/` (interfaces de dominio: agent, plugin, routine, company, decision, environment,
etc.), `validators/` (schemas Zod espejo de `types/`), más utilidades sueltas (trust-policy,
portability-zip, feature-catalog, denial guards, telemetry).

Notable — ideas con aplicabilidad directa a VCP:

1. **`trust-policy.ts:10-33`** — `LOW_TRUST_TOOL_CLASSES` (`git.read`, `github.pr.read`,
   `tests.local`) + `LowTrustBoundary`/`LowTrustReviewPresetPolicy` con
   `rawOutputDisposition: "quarantine"` (línea 8): patrón explícito de "salida de fuente no
   confiable se cuarentena hasta promoción explícita por actor `agent|user|system`" (ver
   `SourceTrustMetadata`, líneas 75-85, con `promotedByActorType`/`promotedFrom`). Esto es
   una implementación productiva de exactamente el principio que ya está en las reglas
   globales de Santi (`~/.claude/CLAUDE.md`: instrucciones válidas sólo desde el chat, todo
   lo demás es dato) y en `skills/security-baseline.md` de VCP — vale la pena citar este
   patrón (`SourceTrustDisposition = "quarantined" | "promoted"`) como referencia de diseño
   si `security-baseline.md` se expande a cubrir "cómo tratar output de sub-agentes/fuentes
   no confiables", que hoy no está explícito ahí.
2. **`validators/skill-policy.ts:30-42`** — `isSafeSourceLocator()`: rechaza URLs con
   credenciales embebidas (`user:pass@host`), o con parámetros de query/fragment que
   matcheen `/token|secret|password|api[-_]?key|authorization/i`. Aplicable directo a
   cualquier lugar de VCP que acepte URLs de fuentes externas (specs remotos, skills
   importados) — patrón reusable, no hay equivalente hoy en VCP.
3. **`validators/skill-policy.ts:97-116`** — sistema de reglas allow/deny por prioridad
   numérica para acciones sobre skills (`skills.create|import|install|edit|...`), con
   `subject` (all_agents/agents/roles) y `resources` (skillIds/skillKeys/sourceTypes/
   sourceLocators) — modelo de política declarativa más granular que el enfoque actual de
   VCP (gates binarios por fase); posible inspiración para un futuro
   `skills/security-baseline.md` v2 con reglas por-skill en vez de gate global.
4. **`portability-zip.ts`**: hashing/portabilidad de exportación de proyecto (zip) — sin
   equivalente ni necesidad clara en VCP (protocolo de texto, no de export de datos).

Ningún hallazgo contradice lo ya documentado sobre VCP; los tres primeros son ideas nuevas
para expandir `skills/security-baseline.md` (cuarentena de output no confiable, saneo de
URLs con credenciales, política declarativa por skill) — el resto (`file:line` citados
arriba) queda como candidato "ninguno aplica" fuera de esos tres puntos.

### Honestidad de cierre

P07 y P08 **no cierran**: 21/299 y 18/220 respectivamente. Quedan pendientes en P07 todos
los `.test.ts`, `examples/*`, `create-paperclip-plugin`, `paperclip-plugin-fake-sandbox`, y
los sandbox-providers `modal/novita/exe-dev` sin leer; en P08 quedan `app-definitions/*`
(11 JSON de catálogo de apps), `telemetry/*` completo, y la mayoría de `types/` y
`validators/` individuales (~35 archivos cada carpeta, se leyeron 6 y 4 respectivamente).

## Continuación — cierre honesto de P01 + avance de P03 (client.ts/backup-lib.ts + muestra de
migraciones ampliada) — 2026-08-17

Verificado el estado previo antes de empezar (evitando duplicar trabajo de las dos pasadas
previas de P01/P03 mencionadas como cortadas por límite de sesión): P01 tenía 16 archivos
pequeños + README/package.json/index.ts/types.ts íntegros, 9 archivos `.ts` grandes sin leer
y 0 `.test.ts` leídos. P03 tenía 4 schemas + 3 archivos de gobernanza de migraciones
(`check-migration-numbering.ts`, `check-migration-safety.ts`, `migration-safety-baseline.ts`)
íntegros, y `client.ts`/`backup-lib.ts` sólo listados por nombre/tamaño, sin muestra de
migraciones SQL leída.

### Corrección de inventario de `packages/adapter-utils` (P01)

El árbol Git real de `packages/adapter-utils/src/` (confirmado vía
`git/trees/...?recursive=1`) tiene **más archivos de negocio que los 9 "grandes" listados en
la pasada anterior**: la pasada previa asumía `execute.ts` en la raíz de `src/`, pero el
archivo real vive en `src/acpx-engine/execute.ts` (3.803 líneas, el más grande del paquete).
Además existen 11 archivos de negocio no mencionados antes: `billing.ts`, `env-bindings.ts`,
`remote-managed-runtime.ts`, `runtime-progress.ts`, `sandbox-install-command.ts`,
`sandbox-run-log-stream.ts`, `sandbox-shell.ts`, `session-compaction.ts`,
`setup-token-transport.ts`, `workspace-restore-merge.ts`, y el subdirectorio
`acpx-engine/{cli.ts, constants.ts, index.ts, session-codec.ts, startup-timing.ts, ui.ts}`
(6 archivos más), más `test-support/mcp-isolation-harness.ts`. El paquete tiene **63 blobs
totales** (no 60 como se cerró en la tabla original), de los cuales 24 son `.test.ts`.

Esta pasada leyó íntegros (vía `gh api .../contents/<path>`, no truncados):
`billing.ts` (20 líneas), `env-bindings.ts` (99), `setup-token-transport.ts` (146),
`session-compaction.ts` (188), `workspace-restore-merge.ts` (259). Los siguientes se
descargaron íntegros pero se inspeccionaron por estructura/exports (grep de firmas
`^export`), no línea por línea, dado su tamaño: `acpx-engine/execute.ts` (3.803 líneas),
`server-utils.ts` (3.524), `execution-target.ts` (2.248), `ssh.ts` (1.873),
`sandbox-managed-runtime.ts` (1.262), `sandbox-callback-bridge.ts` (1.323),
`acpx-engine/startup-timing.ts` (788), `local-process-sandbox.ts` (509),
`git-workspace-sync.ts` (508), `command-managed-runtime.ts` (578),
`remote-managed-runtime.ts` (239), `sandbox-run-log-stream.ts` (278),
`acpx-engine/ui.ts` (170), `runtime-progress.ts` (170), `acpx-engine/cli.ts` (121),
`sandbox-install-command.ts` (46), `acpx-engine/constants.ts` (21),
`acpx-engine/session-codec.ts` (50), `acpx-engine/index.ts` (5, barrel),
`sandbox-shell.ts` (7), `test-support/mcp-isolation-harness.ts` (92, no leído).

**Honestidad de cierre de P01**: con esta pasada, **todo archivo `.ts` no-test de
`packages/adapter-utils/src/` (28/28) fue al menos descargado y su superficie de exports
inventariada**; 5 de esos 28 fueron leídos línea por línea completos en esta pasada, sumados
a los 16+README/package.json/index.ts/types.ts de la pasada original. Los 9 archivos más
grandes (>500 líneas cada uno, sumando >11.000 líneas) **no fueron leídos línea por línea**,
sólo por firma exportada — esto es lectura estructural, no semántica profunda de cada rama de
lógica interna. Los 24 `.test.ts` del paquete y `test-support/mcp-isolation-harness.ts`
siguen sin leer. **P01 pasa de "parcial" a "cerrado por superficie" (100% de archivos de
negocio localizados y su contrato exportado conocido), pero NO "cerrado en profundidad"**
(los 9 archivos grandes de ejecución/sandbox no tienen cada rama interna auditada). Esta
distinción debe mantenerse explícita en la tabla de chunks.

Hallazgo nuevo de valor en un archivo leído íntegro: `workspace-restore-merge.ts:213-251`
(`mergeDirectoryWithBaseline`) implementa un merge de 3 vías basado en snapshot de contenido
(hash SHA-256 por archivo) — sólo toca en destino lo que cambió respecto al baseline
capturado antes de la ejecución del agente, preservando ediciones locales que el agente no
tocó. Usa el mismo patrón de lock con detección de PID muerto (`isHolderAlive:109-128`,
`process.kill(pid, 0)`) que ya se documentó para `agent-start-lock.ts` en una pasada previa —
confirma que el patrón "lock efímero con detección de holder muerto vía `kill(pid, 0)`" se
repite en al menos dos módulos independientes de Paperclip, no es una única implementación
aislada.

### `client.ts` (P03) — leído íntegro (864 líneas)

Sistema de reconciliación de historial de migraciones tolerante a desincronización entre el
journal Drizzle y la tabla `__drizzle_migrations` real:
- `inspectMigrations` (`:664-722`) distingue 3 estados: `upToDate`, `needsMigrations` con
  razón `no-migration-journal-empty-db` (bootstrap normal), `no-migration-journal-non-empty-db`
  (BD con tablas pero sin historial — **falla explícito**, `applyPendingMigrations:755-759`
  lanza en vez de migrar a ciegas) o `pending-migrations`.
- `loadAppliedMigrations` (`:487-543`) tiene una cascada de resolución de 3 niveles según qué
  columnas existen en la tabla de historial real: por `name` si existe, si no por `hash` SHA-256
  del contenido del archivo (recalculado, no confiado), si no por orden posicional del journal —
  tolera esquemas de tabla de migración de versiones distintas de Drizzle.
- `reconcilePendingMigrationHistory` (`:550-643`) + `migrationContentAlreadyApplied`
  (`:472-485`, vía `migrationStatementAlreadyApplied:440-469`) detectan si una migración
  "pendiente" en realidad ya se aplicó por otro medio (inspeccionando si la tabla/columna/índice/
  constraint que crearía ya existe) y la marca como aplicada sin re-ejecutar el DDL — evita un
  `CREATE TABLE` duplicado tras una migración manual o un restore parcial.
- Toda concatenación SQL usa `quoteIdentifier`/`quoteLiteral` (`:17-28`) con validación de
  identificador seguro (`isSafeIdentifier`, regex `^[A-Za-z_][A-Za-z0-9_]*$`) antes de interpolar
  nombres de esquema/tabla en `sql.unsafe(...)` — mitiga inyección SQL en un lugar donde el
  input (nombre de BD/esquema) puede venir de configuración de despliegue.

### `backup-lib.ts` (P03) — leído íntegro (1.035 líneas)

Backup/restore de Postgres con dos motores intercambiables:
- `runDatabaseBackup` (`:527-990`) prueba `pg_dump` primero (motor `auto`/`pg_dump`, sólo si no
  hay `excludeTables`/`nullifyColumns` — `hasBackupTransforms:253-256`), y si falla (o si hay
  transforms) cae a un dumper JavaScript propio que reconstruye DDL completo desde
  `information_schema`/`pg_catalog` (enums, extensiones, secuencias con ownership, tablas,
  constraints únicos antes que FKs, FKs, índices, datos vía `COPY ... TO STDOUT` o `INSERT`
  fila por fila cuando hay columnas a anular).
- `nullifyColumns` (`:217-233`, aplicado en `formatSqlValue:276-293`) permite excluir columnas
  sensibles reemplazándolas por `NULL` en el backup sin excluir la fila completa — útil para
  backups que se comparten fuera del entorno de producción sin borrar filas relacionadas por FK.
- Formato de archivo propio con marcador único por instalación
  (`STATEMENT_BREAKPOINT = "-- paperclip statement breakpoint 69f6f...".`, `:74`) que separa
  sentencias para poder restaurar sentencia-por-sentencia si `psql` falla
  (`runDatabaseRestore:992-1028` intenta `psql` primero, y sólo cae al replay manual vía
  `readRestoreStatements` si el archivo tiene breakpoints, es decir, si se generó con el
  dumper JS — un backup `pg_dump` sin breakpoints no tiene fallback y su error se propaga tal
  cual).
- Retención por 3 niveles (`pruneOldBackups:123-186`): diario (todo dentro de N días),
  semanal (el más nuevo por semana ISO), mensual (el más nuevo por mes calendario) — mismo
  patrón de retención escalonada que backups de bases de datos productivas suelen usar,
  implementado a mano sin librería externa.

### Muestra de migraciones ampliada (P03) — 27 archivos, todo el rango histórico

Se descargaron y leyeron íntegros 27 archivos `migrations/*.sql` (de 217 totales, muestreo
sistemático cada 8 archivos: `0000` → `0217`), cubriendo el 100% del rango temporal del
historial de schema, no sólo migraciones recientes. Contenido confirmado: el patrón dominante
es `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` y `CREATE INDEX/TABLE IF NOT EXISTS` (idempotente
por diseño, coherente con `check-migration-safety.ts` ya documentado), 2 migraciones de
backfill de datos con `INSERT ... ON CONFLICT DO NOTHING` (`0088`, migrando membership legado a
`company_memberships`) y `INSERT ... SELECT` (`0112`, renombrando una permission key
`skill:create` → `skills:create` copiando grants existentes en vez de mutar filas), y una
migración de índice único parcial condicionado a estado de negocio (`0040`,
`issues_open_routine_execution_uq` con `WHERE` sobre 4 columnas de estado). Ninguna de las 27
usa `DROP COLUMN` ni `DROP TABLE` sin `IF EXISTS`/`CASCADE` explícito — coherente con una
cultura de migraciones aditivas y reversibles observada en el resto del código.

### Ideas nuevas aplicables a VCP (esta pasada)

1. **Reconciliación de historial por triple fallback (`name` → `hash` recalculado → posición
   en journal) — patrón de robustez, no aplicable a VCP hoy.** `client.ts:487-543` tolera que
   la tabla de historial de migraciones tenga un esquema de columnas distinto al esperado sin
   fallar duro. VCP no tiene una tabla de historial de "migraciones" — su receipt
   (`scripts/verify-receipt.mjs`) es de estado de árbol Git, no de aplicación incremental de
   cambios de schema — así que no hay superficie análoga. Se registra como comparación, no
   como hallazgo accionable.
2. **Detección de "ya aplicado" antes de re-ejecutar DDL (`migrationStatementAlreadyApplied`,
   `client.ts:440-469`) — mismo principio de idempotencia que VCP ya aplica de otra forma.**
   VCP no ejecuta DDL, pero el principio ("antes de repetir una acción irreversible, verificar
   si el efecto ya existe") es el mismo que ya está implícito en el receipt de VCP (comparar
   HEAD→index→worktree antes de reportar éxito). No es una idea nueva, es una confirmación de
   que el patrón de VCP también aparece acá.
3. **`nullifyColumns` como saneamiento de export declarativo (`backup-lib.ts:217-233`) —
   ningún equivalente ni necesidad en VCP.** VCP no exporta datos de producción; no aplica.
4. **Ningún patrón nuevo con evidencia suficiente en la muestra de 27 migraciones SQL.** El
   estilo (aditivo, `IF NOT EXISTS`/`IF EXISTS` consistente, backfills explícitos vía
   `INSERT ... SELECT` en vez de `UPDATE` masivo) ya está cubierto conceptualmente por
   `check-migration-safety.ts`/`migration-safety-baseline.ts` documentados en una pasada
   previa; esta muestra confirma que la práctica real coincide con lo que el gate estático
   exige, no añade una idea nueva para VCP.

### Estado de cierre de esta pasada

**P01: cerrado por superficie (100% de archivos de negocio del paquete localizados y su
contrato de exports conocido; 28/28 no-test), pero no cerrado en profundidad** — 9 archivos
grandes (>500 líneas, acpx-engine/execute.ts el mayor con 3.803) siguen sin lectura línea por
línea de cada rama interna, y los 24 `.test.ts` + `test-support/` siguen sin leer. **P03:
avanza** — `client.ts` (864 líneas) y `backup-lib.ts` (1.035 líneas) ahora **íntegros**; la
muestra de migraciones pasa de 0 a 27/217 archivos leídos cubriendo todo el rango histórico
(no sólo un cluster). Quedan sin leer en P03: `backup.ts`, `embedded-postgres-error.ts`,
`embedded-postgres-native.ts`, `migrate.ts`, `migration-runtime.ts`, `migration-status.ts`,
`runtime-config.ts`, `seed.ts`, `table-size-estimates.ts`, `test-embedded-postgres.ts`, ~107
schemas restantes de 111 (7 leídos entre esta pasada y la anterior), 190 migraciones SQL
restantes de 217, y todos los `.test.ts`. **P03 sigue "parcial"** — no debe marcarse cerrado.

## Pasada final — decisiones para VCP (2026-08-17)

Lectura completa de `packages/db/src/check-migration-safety.ts`,
`packages/db/src/migration-safety-baseline.ts` (íntegro), y de la sección de enforcement de
`server/src/services/budgets.ts` + `doc/plans/2026-03-14-budget-policies-and-enforcement.md`.
Objetivo: decisión de adopción, no más cobertura cruda.

### 1. Baseline de seguridad de migraciones — CANDIDATO FUERTE, adaptar

Esquema exacto de una entrada de baseline (`migration-safety-baseline.ts`):

```ts
export type MigrationSafetyBaselineEntry = {
  readonly id: string;        // sha256(rule\0migration\0table\0normalizedSql).slice(0,16)
  readonly rule: string;      // ej. "large-create-index-not-concurrently"
  readonly migration: string; // nombre de archivo de la migración
  readonly table: string;
  readonly reason: string;    // por qué se acepta la excepción (texto libre, obligatorio)
};
```

El gate (`check-migration-safety.ts`) detecta 4 reglas heurísticas sobre SQL crudo (loop DO$$
sobre tabla grande sin índice de soporte, mutación batched sin índice, mutación full-table sin
WHERE selectivo, `CREATE INDEX` sin `CONCURRENTLY` en tabla grande), calcula un `findingId`
determinístico por hash, y separa `newFindings` (fallan el build) de `baselineFindings`
(swallowed pero registrados) y `staleBaselineIds` (entradas de baseline que ya no matchean —
detecta baseline podrido). También soporta ignore inline vía comentario SQL:
`-- paperclip:migration-safety-ignore <rule|all>: <reason>` (reason obligatorio, regex exige
texto no vacío tras `:`).

**Por qué importa para VCP**: el patrón "diff contra baseline con motivo obligatorio + detección
de entradas obsoletas" es exactamente la forma que le falta a `.vibe/DEBT.md`. Hoy DEBT.md es
lista libre sin ID determinístico, sin mecanismo de "esto ya no aplica, borralo", y sin gate que
falle el build ante deuda nueva no reconocida. Adaptación mínima sin motor SQL: mismo shape de
entrada (id hash, regla, ubicación, reason obligatorio) aplicado a excepciones de
`verify-red.sh`/`verify-receipt.mjs` en vez de a SQL — reason obligatorio + un check que marque
IDs de DEBT.md que ya no se detectan como stale. **Recomendación: adapt** (no adoptar el motor de
reglas SQL en sí — VCP no tiene motor de migraciones — sino el *shape* baseline-diff con
`id`/`reason` obligatorio y detección de staleness).

### 2. Budget enforcement — patrón simple, YA cubierto por VCP a nivel de diseño; NO portar código

Mecanismo real en `server/src/services/budgets.ts` (no es rate-limiting de requests, es
budget/cost-tracking):
- `computeObservedAmount()`: suma `costEvents.costCents` en la ventana (mes calendario UTC o
  lifetime) filtrando por scope (company/agent/project).
- `budgetStatusFromObserved(observed, amount, warnPercent)`: 3 estados —
  `ok` / `warning` (≥warnPercent% del budget) / `hard_stop` (≥100%). Defaults del plan:
  warn 80%, hard-stop 100%.
- Al cruzar warning: crea "incident" (dedup por scope+ventana, sin re-notificar) — no pausa.
- Al cruzar hard_stop: `pauseScopeForBudget()` pausa el scope (agent/project/company,
  `pauseReason: "budget"`) y crea una `approval` que un humano debe resolver para reanudar
  (`pauseAndCancelScopeForBudget` también cancela trabajo en curso).
- Métrica elegida deliberadamente: `billed_cents` (dólares reales), no tokens — el plan
  documenta explícitamente por qué token-budget NO debe ser el primer hard-stop (normalización
  cross-provider es un problema, dólares no).

**Cross-check con `templates/vibe/COMPANY.md`**: la sección de budget de VCP ya es
check-manual/threshold-based (no ejecuta enforcement automático — es un protocolo humano). El
patrón de paperclip es útil como *referencia de diseño* (3 estados ok/warning/hard_stop,
dedup de incidentes, pausa + approval humana para reanudar) pero implica infraestructura que VCP
no tiene ni necesita: tabla de cost_events, scopes jerárquicos, motor de pausa de agentes. No hay
"rate limiting" de requests en el sentido buscado — lo que existe es exactamente enforcement de
presupuesto monetario, ya conceptualmente cubierto por COMPANY.md. **Recomendación: skip** portar
código; **opcional** — si VCP alguna vez automatiza el budget check, tomar prestados solo los 3
nombres de estado (`ok`/`warning`/`hard_stop`) y el "approval humana requerida para reanudar" como
vocabulario/protocolo, no como código.

### Resumen de recomendaciones

| Item | Adopt/Adapt/Skip | Razón |
|---|---|---|
| Baseline-diff shape (id hash + reason obligatorio + stale detection) | **Adapt** | Llena gap real en `.vibe/DEBT.md`; no requiere motor SQL |
| Migration safety SQL rule engine | Skip | VCP no tiene motor de migraciones |
| Budget enforcement code (`budgets.ts`) | Skip | Infra que VCP no tiene (cost_events, pause engine) |
| Budget state vocabulary (ok/warning/hard_stop + pause+approval) | Adapt (opcional, futuro) | Ya cubierto conceptualmente por COMPANY.md; solo vocabulario si se automatiza |

Con esto, la investigación de paperclip para VCP se da por **cerrada a nivel de decisión**
(sigue parcial a nivel de cobertura cruda del repo, ~150/4559 blobs, pero no queda ningún
candidato de adopción de alto valor pendiente de revisar).
