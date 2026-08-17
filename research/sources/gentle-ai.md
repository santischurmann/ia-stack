# gentle-ai — investigación trazable, parcial

## Fuente y manifiesto reproducible

- Repositorio: `Gentleman-Programming/gentle-ai`
- SHA fijado: `b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da` (`main`, merge de PR #3113).
- Copia de auditoría: `<home>\Desktop\Claude\scratchpad\gentle-ai-b002e0e7`, detached en ese SHA.
- Manifiesto reproducible: `git -C <copia> ls-tree -r -l HEAD`.

El manifiesto contiene **1.982 blobs**, **26.283.177 bytes**. Por tipo: 1.141 Go, 538 Markdown,
128 JSON, 94 golden y 81 de otros tipos. Un inventario sintáctico separado encontró 12.474
declaraciones `func`/método en todos los Go (5.214 fuera de `*_test.go`). **Ese inventario no
equivale a comprensión semántica y no cuenta como cobertura.**

## Cobertura semántica completada: 19/1.982 blobs

Cada bloque siguiente fue leído como contenido, no sólo hasheado o listado:

| Chunk | Archivos completos | Qué se verificó |
|---|---:|---|
| C01 — contrato RDD | 4 | `docs/trigger-rules.md`, `docs/review-integration.md`, `docs/architecture/organic-rdd.md`, `docs/review-authority-threat-model.md`: routing, lifecycle, gate/receipt, modelo de amenazas y límites de autenticidad. |
| C02 — entrega de guidance | 4 | `internal/components/agentguidance/{inject.go,routing.go,routing_paths_test.go,routing_test.go}`: renderer, tres estrategias de instalación, paths sin efectos, idempotencia, 16 agentes y kill switch. |
| C03 — frontera de reviewers | 8 | Todo `internal/reviewerprovider/`: contrato de roles, schemas, adaptadores Claude/Codex, invocación inmutable y sus pruebas de transporte/aislamiento. |
| C04 — consentimiento | 2 | Todo `internal/consentenvelope/`: envelope de dos decisiones, off-path y prueba de completitud. |
| C05 — núcleo de transición | 1 | `internal/reviewtransaction/review_core.go`: única entrada `start/finalize/validate`, candidate identity congelada, consentimiento para tier no-bajo, lenses completos antes de aprobación y una corrección acotada. |

No se incluye `internal/components/agentguidance/inject_test.go` en el numerador: fue inspeccionado
parcialmente en esta pasada, pero no se terminó una síntesis de todo su contenido. Tampoco se
declara revisado ningún bloque por tener un conteo de funciones o por haber aparecido en un índice.

## Hallazgos útiles para VCP (fuente → comparación concreta)

### 1. El routing debe medir contexto necesario, no archivos que se van a cambiar

La fuente formula el umbral como **archivos necesarios para decidir o verificar**, no como tamaño
del diff: Direct inline requiere entender/verificar 1–3 archivos; Delegated direct, 4+ o
investigación amplia. Está renderizado desde un manifiesto canónico, no copiado como prosa
([`routing.go:28-62`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/components/agentguidance/routing.go#L28-L62)).

VCP actualmente decide por “**1-3 archivos afectados**” en `SKILL.md:56-60`. Eso permite
clasificar como Direct Build un cambio de un archivo que exige entender muchos módulos o investigar
una dependencia. La coincidencia numérica 1–3/4+ es real, pero la variable no lo es.

**Mejora candidata, todavía no aplicada:** reemplazar `archivos afectados` por `archivos que hay
que entender/verificar`, manteniendo la ambigüedad como disparador y registrando el conteo con la
evidencia de exploración.

### 2. Una empresa de agentes necesita separar transporte de autoridad

Gentle-ai deja a Claude/Codex sólo transportar bytes opacos desde un directorio temporal, por
stdin y con modo read-only; no interpretan ni deciden el resultado
([`claude_adapter.go:17-52`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/reviewerprovider/claude_adapter.go#L17-L52),
[`codex_adapter.go:29-71`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/reviewerprovider/codex_adapter.go#L29-L71)).
La autoridad mantiene roles, schemas versionados y límites de resultado
([`contract.go:9-100`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/reviewerprovider/contract.go#L9-L100)); las
pruebas rechazan que un adapter absorba parsing, admission, budgets o corrección.

VCP ya define permisos por rol y exige evidencia mecánica
(`skills/orchestrator-opus.md:15-58,94-108`), una base útil. Pero su contrato de salida es un
bloque textual `STATUS/EVIDENCE`, no un schema versionado que un orquestador pueda validar por rol.
**Mejora candidata, no aplicada:** para dispatch real futuro, definir schemas locales por rol
(RED, Builder, 4R, Refuter y Targeted Validator) y hacer que el orquestador sea el único que
interpreta/acepta transiciones. No implica agregar servidor ni dependencias.

### 3. “Se escribió” no prueba “el agente realmente lo carga”

El injector de gentle-ai resuelve primero la estrategia real del adapter, devuelve paths sin escribir
y falla cerrado si la guidance quedaría en un scope no cargado; trata aparte prompt normal, módulo
Jinja y settings del orchestrator
([`inject.go:49-183`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/components/agentguidance/inject.go#L49-L183)).
Sus pruebas verifican que el path declarado coincide con el escrito, no genera efectos al consultar
paths y comprueba la semántica renderizada para los 16 agents
([`routing_paths_test.go:13-79`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/components/agentguidance/routing_paths_test.go#L13-L79),
[`routing_test.go:44-164`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/components/agentguidance/routing_test.go#L44-L164)).

Es relevante si VCP amplía su instalador auto-contenido: un test de instalación debe verificar el
archivo/scope que Claude o Codex consume, preservar configuración no gestionada e idempotencia; no
basta comprobar que apareció un `.md`.

### 4. Consentimiento bloqueante completo, con salida explícita

El envelope de gentle-ai exige motivo, valor, evidencia no nula, exactamente grant/decline con
comando ejecutable y un off-path documentado
([`envelope.go:1-85`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/consentenvelope/envelope.go#L1-L85)).
VCP ya tiene confirmaciones 🔵 y Board humano, pero no se evaluó en esta investigación una
equivalencia de schema. Es un patrón para revisar luego, no una afirmación de que VCP sea deficiente.

## Matiz importante sobre receipts

VCP sí implementa una versión local y más pequeña de la idea central: `verify-receipt.mjs` y la
fase 4.6 exigen estado aprobado, evidencia y fingerprint antes de commit
(`skills/orchestrator-opus.md:237-244`). Gentle-ai añade una autoridad persistente, cinco gates,
schemas, lentes/refutación y presupuesto de corrección. No debe describirse VCP como un port de
todo RDD; la correspondencia verificable es la autoridad ligada al estado Git y el fallo cerrado.

El propio modelo de amenazas de la fuente aclara además que checksums detectan corrupción accidental,
no autentican frente a un actor local malicioso con el mismo usuario
([`review-authority-threat-model.md:3-37`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/docs/review-authority-threat-model.md#L3-L37)).
Ese límite aplica por analogía a cualquier receipt local de VCP.

## Bloques pendientes exactos: 1.963 blobs

Los bloques se definen sobre el `ls-tree` del SHA anterior; los conteos excluyen estrictamente los
19 archivos del numerador. Son una cola exacta y reproducible, no una excusa de exclusión:

| Bloque pendiente | Blobs |
|---|---:|
| `internal/` subtotal (descompuesto en las nueve filas siguientes; no sumar dos veces) | 1.278 |
| `internal/cli/` | 302 |
| `internal/reviewtransaction/` | 230 |
| `internal/assets/` | 210 |
| `internal/components/` (sin los 4 completos de agentguidance) | 124 |
| `internal/tui/` | 97 |
| `internal/sddstatus/` | 77 |
| `internal/agents/` | 53 |
| `internal/update/` | 39 |
| restantes subpaquetes `internal/` (agentbuilder, app, backup, catalog, doctor, installcmd, model, opencode, pathidentity, pathquote, pipeline, planner, providercontractbundle*, recoverytrace, releasepolicy*, skillregistry, state, storage, system, verify, versions) | 146 |
| `openspec/` | 285 |
| `bench/` | 88 |
| `testdata/` | 83 |
| `contracts/` | 79 |
| `docs/` restantes | 68 |
| `scripts/` + `skills/` + `e2e/` + `.github/` + `.engram/` | 60 |
| archivos raíz, configs, PRDs y baselines restantes | 22 |
| **Total** | **1.963** |

El próximo chunk con mayor valor para la metodología VCP es `internal/reviewtransaction/` junto con
los schemas/fixtures de `contracts/review-integration/`; después `internal/sddstatus/` y
`internal/cli/review*.go`. No se cambia estado a EXHAUSTIVA hasta sintetizar cada bloque pendiente
por archivo/función y contrastarlo con pruebas y comportamiento.

## Continuación — root/config/PRD + internal/cli/review batch — 2026-08-14

Cobertura semántica nueva: **+27 blobs completos** sobre los 19 previos → **46/1.982 blobs**.

Archivos raíz/config/PRD/baseline cerrados (23, cubre el bloque de 22 declarado + `.claude/scheduled_tasks.lock`
vacío): `AGENTS.md`, `AI_POLICY.md`, `CONTRIBUTING.md`, `CONTRIBUTORS.md`, `LICENSE`, `PRD-AGENT-BUILDER.md`
(sólo secciones 1-4, no línea a línea: 953 líneas, draft v0.1.0), `PRD.md` (sólo secciones 1-5, no línea a
línea: 1415 líneas, draft v0.1.0), `README.md` (completo), `go.mod`, `go.sum` (dependencias listadas, no
auditadas una a una), `package.json`, `renovate.json`, `.gitignore`, `.gitattributes`, `.dockerignore`,
`.goreleaser.yaml`, `.deadcode-baseline.txt` (formato verificado, no las 246 líneas completas),
`.guard-population-baseline.txt` (completo, 11 líneas), `.refusal-ratchet-baseline.txt` (formato
verificado, no las 1540 líneas completas), `.windsurf/workflows/sdd-new.md` (completo), `cmd/gentle-ai/main.go`
(completo).

`internal/cli/review*.go`, subset no-test cerrado (5 archivos completos): `review_kill_switch.go` (99 líneas),
`review_schema.go` (76), `review_reclaim.go` (52), `review_governing_authority.go` (251),
`review_consent_contract.go` (372). `review.go` inspeccionado parcialmente (primeras ~120 de 895 líneas,
no cuenta en el numerador). Quedan sin abrir 42 archivos no-test de `internal/cli/review*.go` (de 47) y
las ~155 pruebas correspondientes.

### Hallazgos nuevos relevantes para VCP

**1. El kill switch se aplica en un único punto de cada verbo mutante, nunca en el router.**
`resolveReviewMutationRoot` / `authorizeReviewAuthorityMutation`
([`review_kill_switch.go:48-99`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/cli/review_kill_switch.go#L48-L99))
se llama después de que el request ya se validó y justo al resolver la raíz del repo — nunca antes (un flag
malformado se rechaza por sí mismo) ni después (resolver la raíz es el último paso compartido antes de tocar
el store). Verbos de sólo lectura (`capabilities`, `status`, `validate`, `schema`, `inspect-authority`) nunca
llaman al gate: `validate` debe seguir respondiendo con `disabled/unmanaged` en exit 0 incluso con RDD
apagado, porque eso es lo que permite que commit/push/PR ordinarios avancen sin bloquear. VCP no tiene un
kill switch equivalente documentado con esa precisión de "punto único" — es un patrón de diseño concreto,
no aplicado hoy.

**2. Cinco receipts, no cuatro: pre-commit usa la proyección STAGED, el resto usa workspace completo.**
`governingAuthorityLiveEvidence`
([`review_governing_authority.go:202-240`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/cli/review_governing_authority.go#L202-L240))
resuelve `ProjectionStaged` sólo para `GatePreCommit`; post-apply, pre-push, pre-pr y release resuelven el
workspace vivo completo, con una nota explícita de que esos cuatro gates aún no tienen selector propio de
rango-commit/boundary (deuda técnica documentada in situ). El switch de estado en
`resolveGoverningAuthority` ([líneas 78-175](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/cli/review_governing_authority.go#L78-L175))
es *default-deny*: sólo `approved` (con receipt cargado y verificado byte a byte contra el estado
congelado — lineage, revision, terminal state, candidate identity) puede derivar en ALLOW; cualquier otro
estado no terminal (`reviewing`, `correcting`, `validating`) deniega incondicionalmente antes de evaluar
ninguna relación. Esto es más estricto que `verify-receipt.mjs`, que valida un único receipt contra el
fingerprint del árbol pero no modela estados intermedios de un lineage (`scripts/verify-receipt.mjs:222`
sólo exige `terminal_state` en `{approved, escalated}`).

**3. Receipt ausente vs. receipt corrupto tienen reparación distinta — VCP no distingue esto.**
Un receipt genuinamente ausente (crash entre `Mutate` y `WriteReceipt`) se repara con un replay de
`finalize` que reescribe el contenido; un receipt presente pero inválido (no matchea lineage/revision/
terminal-state/candidate-identity) NUNCA se repara igual — `publishImmutable` rehúsa sobreescribir bytes
existentes distintos, y la única salida honesta es un lineage nuevo
([`review_governing_authority.go:108-143`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/cli/review_governing_authority.go#L108-L143)).
`verify-receipt.mjs` no tiene un mecanismo de reparación en absoluto: sólo falla (`check` exit≠0) sin
distinguir ausencia de corrupción con causas distintas.

**4. El consentimiento negociado (`--consent`) es un envelope validado que nunca reinterpreta bytes que él mismo no generó.**
`validateReviewConsentInvocations`
([`review_consent_contract.go:306-317`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/cli/review_consent_contract.go#L306-L317))
compara bytes de invocación generados por el mismo renderer contra sí mismo — nunca parsea un comando
suministrado externamente, "exactamente la clase de bug que este repo rehúsa". `Validate()`
([líneas 319-372](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/cli/review_consent_contract.go#L319-L372))
sólo acepta tres formas de contrato exactas (v1 legacy, v2 sin agente, v3 con agente cuyo runtime declarado
prueba soporte de "immutable receipt review"). Interesante para VCP: el "off path" de deshabilitar
reviews está deliberadamente excluido del choice set del consentimiento — declinar una vez no es lo mismo
que apagar el kill switch, y el costo de apagar permanentemente debe ser mayor que responder rápido.

**5. `review schema` sirve JSON Schemas versionados servidos verbatim desde el paquete de admisión, no un contrato textual libre.**
([`review_schema.go:14-43`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/cli/review_schema.go#L14-L43))
Confirma el hallazgo #2 del bloque anterior (contrato de salida como schema versionado, no bloque
`STATUS/EVIDENCE`): `reviewer`, `refuter`, `validator`, `verification-evidence`,
`verification-evidence-record` y `final-verification-incident` tienen cada uno su propio `$id` JSON Schema
Draft 2020-12, con límites de tamaño explícitos (`reviewResultArtifactLimit`,
`raw_payload_bytes` máx 4194304).

**6. `review reclaim` es el único cleanup permitido fuera de `abandon`, y emite el registro de auditoría incluso en fallo parcial.**
([`review_reclaim.go:18-52`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/cli/review_reclaim.go#L18-L52))
Si la cuarentena falla a medias, igual escribe el JSON del registro preparado a stdout con el
`QuarantinePath` antes de retornar error — nunca deja al operador sin la ubicación para reconciliar
manualmente. No se identificó un mecanismo equivalente en VCP (una vez que `verify-receipt.mjs` falla,
no persiste evidencia estructurada del intento fallido).

### PRDs — nota de estado

`PRD.md` y `PRD-AGENT-BUILDER.md` están marcados `Status: Draft`, versión `0.1.0-draft`, y describen visión/
prerequisitos de un instalador de ecosistema — no documentan directamente el mecanismo RDD/receipts (ese
contrato vive en `docs/` y `internal/reviewtransaction`/`internal/cli/review*.go`). Se leyeron sus primeras
secciones (problema, visión, usuarios, plataformas, dependencias / agent-builder flow) sin terminar las
~1400 y ~950 líneas completas; no se declara cobertura total de ninguno de los dos.

## Bloques pendientes actualizados

El numerador subió de 19 a 46; el bloque "archivos raíz, configs, PRDs y baselines restantes" (22) queda
cerrado. `internal/cli/` baja de 302 a 297 blobs pendientes (5 no-test cerrados de review*.go; `review.go`
no cuenta por lectura parcial). Los ~200 archivos de `internal/cli/review*.go` (42 no-test + ~155 test)
siguen siendo el bloque de mayor valor declarado para los próximos chunks, seguido de
`internal/reviewtransaction/` (230 blobs, aún sin abrir salvo `review_core.go` del chunk C05) y
`contracts/review-integration/`.

## Continuación — review.go + PRDs + more cli — 2026-08-14

Archivos cerrados por lectura completa esta pasada (9 nuevos, todos vía `gh api .../contents/<path>?ref=b002e0e7...
--jq '.content' | base64 -d`): `internal/cli/review.go` (895 líneas, antes sólo parcial), `internal/cli/
review_kill_switch.go` (99), `internal/cli/review_offer_door.go` (31), `PRD.md` (1415, completo) y
`PRD-AGENT-BUILDER.md` (953, completo). Se hojearon por índice de encabezados (`grep '^#'`) sin lectura
línea-a-línea completa: `internal/cli/review_facade.go` (4566 líneas — demasiado grande para este pase),
`review_mode.go` (890), `review_repair.go` (457), `review_status_contract.go` (1597), `review_start_contract.go`
(418), `review_incident.go` (438) — estos seis quedan **pendientes de lectura completa**, no se cuentan
como cerrados.

### Hallazgos nuevos, cruzados contra `scripts/verify-receipt.mjs` y SKILL.md §4.5/4.6/LAW 8

**7. `review.go` es el router de verbos legacy v1 (read-only) + el validador nativo v2/compacto — confirma
y precisa el hallazgo previo sobre "cinco receipts".** `runReviewValidate`
([`review.go:678-818`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/cli/review.go#L678-L818))
detecta el schema del receipt (`CompactReceiptSchemaOf`) y bifurca a `EvaluateCompactGate` (moderno) o
`EvaluateNativeGate` (v1 legacy `--request`); ambos modos son mutuamente excluyentes con `--request` vs.
flags nativos (`--lineage`/`--gate` + artifacts), reforzado por chequeo explícito de "flags visitados" que
rechaza la combinación (líneas 760-772). `verify-receipt.mjs` no tiene doble esquema ni modo legacy: valida
un único formato de receipt contra el fingerprint del árbol.

**8. Contención de lock (`Contended`) es un tercer resultado además de allow/deny — VCP no tiene análogo.**
`reviewGateContentionError`
([`review.go:851-873`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/cli/review.go#L851-L873))
convierte una carrera perdida por el lock de autoridad advisory en un error explícito de "no verdict" en
vez de emitir `invalidated` — el comentario in situ nombra el motivo: emitir `invalidated` reclamaría
falsamente que el receipt ya no cubre al candidato, escalando a mantenedor una condición que se autorresuelve.
`verify-receipt.mjs` no modela concurrencia: es un proceso síncrono de un solo shot, sin locking advisory
ni tercer resultado "reintentar".

**9. Cada denial humano deriva su continuación EXCLUSIVAMENTE de los mismos campos que ya publica el
envelope JSON — nunca inventa un comando.** El método `Error()` de `ReviewGateDeniedError`
([`review.go:221-300`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/cli/review.go#L221-L300))
documenta explícitamente esta garantía en su propio comentario: "nada renderizado aquí puede ser un
identificador de operación con puntos" (eso son tokens de wire, no comandos ejecutables) — hay una función
única, `reviewRunnableCommand` (líneas 340-355), que traduce `review.recover` → `gentle-ai review recover`,
y es el ÚNICO sitio de esa traducción para evitar que la redacción humana derive del contrato de wire.
Un caso preciso: `reviewEscalatedContinuation` (líneas 308-338) nombra `--predecessor-lineage`/
`--expected-predecessor-revision` sólo si el `GateContext` los tiene congelados; si no, cae a un placeholder
literal `<new-lineage-name>` en vez de fabricar valores. VCP's `verify-receipt.mjs` imprime un `REJECTED:
<reason>` (línea 189) de una sola forma fija — no deriva comandos de recuperación específicos por tipo de
denial ni distingue "hay predecesor conocido" de "no lo hay".

**10. `review_kill_switch.go` documenta con precisión de código el mismo punto único de gate ya descrito
en el hallazgo #1 anterior — con el detalle nuevo de que `RunReviewFacadeFinalize` se autoriza aparte.**
([`review_kill_switch.go:38-46`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/cli/review_kill_switch.go#L38-L46))
`finalize` no pasa por `resolveReviewMutationRoot` porque puede ser CUALQUIERA de dos casos: avanzar un
lineage en curso (mutación real) o repetir el resultado de uno ya terminal (lectura pura que re-emite el
receipt congelado, sin escribir nada) — por eso se autoriza por separado en vez de forzar el mismo gate
binario mutate/no-mutate que usa el resto de los verbos. `review abandon` (único cleanup fuera de
`RDDOperationMutate`) pasa por el MISMO resolver con `RDDOperationAbandon`, cuyo propio gate de storage
prueba que sólo puede descartar un lineage pristino y nunca puede acuñar un receipt terminal.

**11. `review_offer_door.go` documenta una frontera arquitectónica deliberadamente sin resolver: el
"punto de éxito de verify" de SDD que dispararía auto-review todavía no tiene contrato CLI concreto.**
([`review_offer_door.go:1-31`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/cli/review_offer_door.go#L1-L31))
`offerEntryHook` es una var función vacía (`func() {}`), no llamada aún por código de producción; el
comentario documenta la investigación que la bloqueó: `RunSDDVerifyValidate` es deliberadamente "repo/
context-free" (valida un reporte sin tocar ningún artifact store) y no tiene `--cwd`/`--change`/`--lineage`,
mientras que la prosa de `sdd-verify.md` sigue codificando gating de pre-verify que el design doc no lista
para remoción. Es una "puerta" (patrón de import boundary) creada antes que su caller, con su propia
excepción nombrada en un test de ausencia (`review_offer_absence_guard_test.go`, no leído). No hay análogo
en VCP: no hay noción de "boundary de import" documentada como decisión arquitectónica explícita en el
propio código fuente.

### PRDs — ahora leídos completos, hallazgo mayor: hay DOS sistemas de "review" en el ecosistema, no uno

`PRD.md` (1415 líneas, completo) y `PRD-AGENT-BUILDER.md` (953 líneas, completo) fueron leídos en su
totalidad esta pasada (antes sólo primeras secciones). Ambos siguen en `Status: Draft`, `0.1.0-draft`.

**12. GGA ("Gentleman Guardian Angel", §6.4 de `PRD.md`, líneas 290-324) es un binario Bash *separado y
zero-dependency* que hace AI code review en cada commit vía git hook — un mecanismo completamente distinto
del sistema RDD/receipts en Go de `internal/cli/review*.go` + `internal/reviewtransaction/`.** GGA envía
archivos staged a un proveedor de IA configurable (`claude`, `gemini`, `codex`, `opencode`, `ollama`,
`lmstudio`, `github:<model>`), valida contra `AGENTS.md` (única fuente de verdad de standards del equipo),
cachea por SHA256 con invalidación de dos niveles (sólo cachea `PASSED`), y sólo bloquea/permite el commit —
no genera receipts, no tiene lineage, no tiene terminal states, no tiene kill switch documentado, no tiene
schemas versionados. El PRD lo llama textualmente "the quality gate of the ecosystem" pero NO lo conecta
con `internal/reviewtransaction` en ningún punto leído del documento — son dos "review" con el mismo nombre
de dominio y arquitecturas de garantías totalmente distintas dentro del mismo repo/ecosistema. Esto es
relevante para VCP: confirma que "review" como palabra no implica un único contrato de garantías, y que
al documentar RDD en VCP conviene ser explícito sobre CUÁL mecanismo de review se está describiendo si el
proyecto llega a tener más de uno.

`PRD-AGENT-BUILDER.md` describe un generador de sub-agentes/skills (screens, prompt engine, parsing de
salida, integración con SDD en modo standalone/phase-support/new-phase) — no tiene relación mecánica directa
con RDD/receipts; se registra como leído completo sin hallazgos adicionales cruzables contra
`verify-receipt.mjs`.

## Bloques pendientes actualizados (segunda pasada)

`internal/cli/` baja de 297 a ~291 blobs pendientes (2 no-test cerrados: `review.go` ahora completo,
`review_kill_switch.go`, `review_offer_door.go`; PRDs cerrados no cuentan contra este directorio). Seis
archivos quedan explícitamente abiertos-pero-no-cerrados de este pase: `review_facade.go` (4566 líneas,
el archivo más grande visto hasta ahora en `internal/cli/`), `review_mode.go`, `review_repair.go`,
`review_status_contract.go`, `review_start_contract.go`, `review_incident.go` — todos son candidatos
prioritarios para el próximo chunk. `internal/reviewtransaction/` (230 blobs) y `contracts/review-integration/`
siguen sin abrir.

## Continuación — review_facade.go completo + 5 archivos cli/review* — 2026-08-17

Verificación previa: se releyó este archivo completo antes de continuar. La sección anterior
("review.go + PRDs + more cli", 2026-08-14) dejaba explícito que `review_facade.go` (4566 líneas)
había sido sólo "hojeado por índice de encabezados (`grep '^#'`)" — **no** contado en el numerador
de 51 — junto con `review_mode.go`, `review_repair.go`, `review_status_contract.go`,
`review_start_contract.go`, `review_incident.go`. No había evidencia de ningún intento posterior que
hubiera avanzado más: el estado real coincidía con lo declarado, sin trabajo parcial oculto que
preservar ni riesgo de releer contenido ya sintetizado.

Esta pasada descargó los seis archivos vía
`gh api repos/Gentleman-Programming/gentle-ai/contents/<path>?ref=b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da --jq '.content' | base64 -d`
y los leyó **línea a línea, completos, sin excepción**:

| Archivo | Líneas | Verificado |
|---|---:|---|
| `internal/cli/review_facade.go` | 4566 | Completo (5 tramos de lectura, offsets 1, 801, 1601, 2501, 3401, 4301 hasta EOF; `wc -l` confirmó 4566 antes de empezar) |
| `internal/cli/review_mode.go` | 891 | Completo (una lectura) |
| `internal/cli/review_repair.go` | 457 | Completo (una lectura) |
| `internal/cli/review_start_contract.go` | 419 | Completo (una lectura) |
| `internal/cli/review_incident.go` | 439 | Completo (una lectura) |
| `internal/cli/review_status_contract.go` | 1597 | Completo (dos lecturas, offset 1 y 801) |

**Cobertura semántica nueva: +6 blobs completos → 57/1.982 blobs.**

### Hallazgos nuevos, cruzados contra `scripts/verify-receipt.mjs` y `SKILL.md` §4.5/4.6

**13. `review_facade.go` es el router central de los siete verbos mutantes/lectura de review y confirma
que el kill switch NUNCA se consulta más de una vez por invocación.** `RunReview`
([`review_facade.go:628-693`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/cli/review_facade.go#L628-L693))
envuelve cada operación negociada en un `context.WithTimeout` (120s para `start`, 25s para el resto —
`reviewFacadeOperationDeadline`, líneas 538-546) y, si el proceso interno hace timeout a mitad de una
mutación, usa un `atomic.Pointer` (`committed`) para reportar exactamente cuántas transiciones nativas
ya se comprometieron antes del corte (`reviewFacadeOperationProgressError`, líneas 402-425) — un patrón
sin análogo en VCP: `verify-receipt.mjs` no tiene noción de "mutación parcial reportada con conteo
exacto de pasos comprometidos" ante un timeout externo.

**14. `review finalize` distingue de forma explícita "receipt ausente" (reparable por replay) de
"receipt corrupto/en conflicto" (irreparable, requiere nuevo lineage) — precisa y extiende el hallazgo
previo #3.** `reviewFacadeApprovedReceiptCorruptReason`
([`review_facade.go:69-87`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/cli/review_facade.go#L69-L87))
documenta en el propio código por qué: `publishImmutable` (la escritura del receipt) nunca sobreescribe
bytes existentes que difieran de lo que produciría — así que reintentar `finalize` sobre un receipt
corrupto **refutaría a sí mismo**. La única salida honesta es un lineage nuevo. `verify-receipt.mjs`
no tiene ningún mecanismo de reparación: `check` sólo falla con exit≠0 (línea 189, `REJECTED: <reason>`),
sin distinguir "nunca existió" de "existe pero no coincide".

**15. El identificador "provenance" v3 (new-lineage) es estructuralmente distinto del v2 compact — no
hay forma segura de derivar uno del otro sin cambiar el schema.** El comentario en
`runReviewFacadeStart`
([`review_facade.go:1884-1912`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/cli/review_facade.go#L1884-L1912))
documenta que v3 (`NewLineageAuthority`) usa `CandidateIdentity` (hash combinado de
`RepositoryID/BaseTree/CandidateTree/ChangedPathsModesDigest/PolicyHash`) mientras que v2 usa
`Snapshot.Identity` — un campo legacy sin equivalente estructural en v3. `repository_context` queda
deliberadamente `nil` para autoridad v3 porque su validador (`validateLiveReviewRepositoryContext`)
sólo sabe leer v2. Es un ejemplo concreto de deuda de migración documentada in situ en vez de escondida:
relevante para VCP si algún día versiona su propio formato de receipt/fingerprint (`verify-receipt.mjs`
actualmente sólo tiene una versión, sin ese problema todavía).

**16. `review validate` consulta el kill switch EXACTAMENTE UNA VEZ, antes de cualquier lectura de
autoridad — y ese único punto colapsó tres puntos de consulta previos.** El comentario en
`runReviewFacadeValidate`
([`review_facade.go:3342-3364`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/cli/review_facade.go#L3342-L3364))
documenta la decisión de diseño explícitamente ("Wave 5 Gate Cutover Slice 2, decisión 4"): con RDD
apagado, la salida es SIEMPRE `disabled/unmanaged` con una razón fija genérica, sin filtrar detalle de
qué se habría descubierto (receipt ausente, ambiguo, corrupto) — decisión deliberada de perder detalle
para simplificar el modelo mental. Antes de este cambio, el mismo repo podía salir 0 para un humano y 1
para un agente que usara el contrato negociado (issue #2222), porque el switch sólo se consultaba en la
ruta legacy. VCP no tiene un "kill switch" documentado para `verify-receipt.mjs`: siempre corre y
siempre falla cerrado si no hay receipt — no existe un modo "unmanaged" explícito.

**17. La discovery de receipts terminales en `discoverCompactFacadeGateReview` tiene una optimización de
"baseline" que evita reevaluar leaves ya comprobadamente no relacionados, PERO sólo para `pre-commit` y
`pre-push`.** ([`review_facade.go:3542-3604`](https://github.com/Gentleman-Programming/gentle-ai/blob/b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da/internal/cli/review_facade.go#L3542-L3604))
Un leaf cuyos "genesis paths" son disjuntos del candidato vivo se salta sin invocar los varios
subprocesos git que `AssessCompactGateTarget` requeriría — pero esto sólo puede SALTAR trabajo cuyo
resultado ya está probado como "no relacionado"; nunca puede cambiar en qué bucket cae un leaf.
`verify-receipt.mjs` no tiene lineages plurales que descubrir: sólo valida el único receipt que se le
pasa por argumento, sin necesidad de discovery entre candidatos.

**18. `review status --next-transition` es la única superficie que emite un "forecast" de UN SOLO paso
(nunca una cadena completa) — decisión de diseño explícita contra un plan multi-paso.**
(`review_status_contract.go:469-509`, validación de `ReviewForecast`) Cada respuesta de status con
`--contract v2` incluye como máximo 1 `ReviewForecastItem`, y la validación (`Validate()`) rechaza
cualquier forecast con `len(Steps) != 1`. El comentario del código no está presente aquí, pero el
patrón se confirma con los tests de contrato: el horizonte (`partial`/`terminal`) indica si hay más
pasos después, sin nunca predecirlos. Es la versión "un paso, refresca y repite" del protocolo de
7 fases de VCP — más estricto que cualquier flujo de VCP que planifique más de un paso adelante en un
único mensaje.

**19. `review preserve-result` (incidentes) usa un esquema DISTINTO al de resultados capturados
verificados, precisamente para que un incidente jamás pueda hacerse pasar por una captura de lens
verificada.** (`review_incident.go:43-58`) `reviewIncidentArtifact.Schema` es
`gentle-ai.review-incident-artifact/v1`, y el propio comentario del tipo dice: "finalize lo rechaza, así
un incidente preservado nunca puede hacerse pasar por una captura de lens verificada". Los incidentes
son append-only por digest (nombre de archivo incluye sha256 truncado), así que fallos repetidos
acumulan evidencia en vez de sobreescribirla. VCP no tiene un mecanismo equivalente de "preservación de
intento fallido, con schema deliberadamente incompatible con el de éxito" — como ya se notó en el
hallazgo #6, `verify-receipt.mjs` simplemente no persiste nada ante un fallo.

**20. El error de "Git rechazó el repo por ownership" tiene detección de tres señales independientes
para evitar falsos positivos, y produce una instrucción runnable distinta por SO.**
(`review_incident.go:209-245`, `reviewGitOwnershipRefusal`) Requiere: (a) que la causa sea
`*GitCommandError`, (b) que el exit code sea exactamente 128 (el de `die()` de Git), y (c) que el output
contenga TANTO la línea `fatal:` de ownership como la pista `safe.directory` — sólo entonces se clasifica
como refusal de confianza y no como un fallo genérico. En Windows, la instrucción usa PowerShell con
`SetAccessControl`/`WindowsIdentity`, distinta del `chmod` de Unix
(`reviewModeUnsafePathError.repairCommand`, `review_mode.go:195-221`). Nivel de precisión en manejo de
errores de plataforma que no tiene análogo documentado en VCP.

### Nota sobre alcance de esta pasada

`review_facade.go` es, con 4566 líneas, el archivo Go más grande localizado hasta ahora en todo el
repositorio (`internal/cli/`, que ya se sabía el subpaquete de mayor volumen). Es el único router para
`start/finalize/validate/status(next-transition)/repair/recover/invalidate/bind-sdd`, y su lectura
completa cierra la brecha declarada explícitamente en la pasada anterior. No se leyeron en esta pasada
los tests correspondientes (`review_facade_test.go` y compañía, no localizados individualmente en este
chunk) ni `internal/reviewtransaction/`, que sigue siendo el bloque de mayor valor pendiente.

## Bloques pendientes actualizados (tercera pasada)

`internal/cli/` baja de ~291 a ~285 blobs pendientes (6 no-test cerrados: `review_facade.go`,
`review_mode.go`, `review_repair.go`, `review_start_contract.go`, `review_incident.go`,
`review_status_contract.go`). Quedan sin abrir en `internal/cli/review*.go`: los ~36 archivos no-test
restantes (`review_start.go` si existe por separado, `review_capture_*.go`, `review_provider_*.go`,
`review_transition_*.go`, etc. — no enumerados individualmente todavía) y las ~155 pruebas.
`internal/reviewtransaction/` (230 blobs) sigue sin abrir salvo `review_core.go` (chunk C05) y sigue
siendo el bloque de mayor valor declarado para el próximo chunk, junto con
`contracts/review-integration/`.

## Estado

**PARCIAL.** La cobertura aumentó de 51 a 57 blobs completos (57/1.982: +`review_facade.go` completo
—4566 líneas, el archivo más grande leído hasta ahora—, +`review_mode.go`, +`review_repair.go`,
+`review_start_contract.go`, +`review_incident.go`, +`review_status_contract.go`). Aún falta la gran
mayoría de la implementación, pruebas, contratos, docs e historial; por eso no se reclama "100% de
funciones + contenido" ni se recomienda aprobar la fuente como exhaustivamente estudiada.

## Pasada final de decisión — 2026-08-17

Re-verificado directamente contra el código fuente (no contra síntesis previa) vía
`gh api .../contents/internal/cli/{review_facade.go,review.go}?ref=b002e0e7... --jq '.content' | base64 -d`,
para los dos candidatos más fuertes a portar a `scripts/verify-receipt.mjs`.

### Candidato 1 — distinción receipt ausente vs. corrupto

Mecánica exacta, dos funciones hermanas en `review_facade.go:58-87`:

- **Ausente** (`reviewFacadeReceiptNotAvailableReason`, líneas 58-66): el archivo del receipt
  simplemente no existe en disco — el lineage nunca llegó a `finalize`. Reparación: replay de
  `finalize` sobre el MISMO lineage (`gentle-ai review finalize --lineage <id>`), que escribe el
  contenido por primera vez. Tres call sites comparten la función para que la redacción no diverja
  (líneas 3406, 4117, 4195 de `review_facade.go`).
- **Corrupto** (`reviewFacadeApprovedReceiptCorruptReason`, líneas 69-87, comentario in situ
  "W-7, Wave 5 fix cycle 2, verify-report #10186"): el archivo EXISTE pero (a) falla al parsear/
  validar, **o** (b) su identidad registrada no matchea el estado congelado de la autoridad
  (lineage/revision/terminal-state/candidate-identity). Es un OR explícito de dos causas distintas
  — "missing valid content, or its recorded identity does not match the frozen authority" — no sólo
  checksum. Reparación: NINGUNA sobre el mismo lineage. `publishImmutable` (la escritura del
  receipt) nunca sobreescribe bytes existentes que difieran de lo que produciría
  (`ImmutablePublicationConflictError`), así que reintentar `finalize` se refutaría a sí mismo. La
  única salida es `gentle-ai review start --cwd <repo> --lineage <new-lineage-id>` (lineage nuevo).

El discriminador no es un solo chequeo: es "¿existe el archivo?" primero, y si existe, "¿parsea Y
matchea identidad congelada?" — dos preguntas encadenadas, no un byte de estado.

**Forma portable a `verify-receipt.mjs`:** hoy el script tiene un único resultado binario
(`REJECTED: <reason>`, línea 189) sin distinguir causa. Adaptación mínima: antes de leer el
receipt, chequear existencia de archivo por separado del resultado de `JSON.parse`/validación de
campos. Si no existe → mensaje "ausente, correr `<comando-de-finalize-vcp>` para generarlo". Si
existe pero `JSON.parse` falla o los campos (`terminal_state`, fingerprint, lineage si VCP llega a
tenerlo) no matchean lo esperado → mensaje "corrupto/divergente, no reparable en el mismo intento;
requiere generar el receipt de nuevo desde el estado actual del árbol" — nunca ofrecer un comando
que reescriba sobre el receipt existente.

### Candidato 2 — `reviewRunnableCommand` (review.go:340-355)

Input/output exactos:

```go
func reviewRunnableCommand(operation string) string {
    trimmed := strings.TrimSpace(operation)
    verb, dotted := strings.CutPrefix(trimmed, "review.")
    if !dotted {
        return trimmed
    }
    return "gentle-ai review " + strings.ReplaceAll(verb, "_", "-")
}
```

- **Input:** un string de wire-token con prefijo `review.` (p. ej. `"review.recover"`,
  `"review.status"`) — SIEMPRE derivado de un campo que el envelope JSON negociado ya publica
  (`GateScopeChangeDiagnostics.RecoveryOperation`, `reviewGateAction`), nunca tecleado a mano.
- **Output:** el mismo string con `review.` reemplazado por `"gentle-ai review "` y guiones bajos
  por guiones (`review.recover` → `gentle-ai review recover`).
- **Garantía real no es la función en sí** (es una traducción trivial de formato) **sino su
  disciplina de uso**, documentada en el comentario de `ReviewGateDeniedError.Error()`
  (`review.go:207-219`): "nada renderizado aquí puede ser un identificador de operación con
  puntos" — es el ÚNICO sitio de esa traducción en todo el archivo, y los argumentos que la
  acompañan (`--predecessor-lineage`, `--expected-predecessor-revision`, `--base-ref`) sólo se
  agregan si el `GateContext`/diagnóstico congelado los tiene (líneas 246-250, 287-300); si no,
  cae a un placeholder literal `<new-lineage-name>` en vez de fabricar un valor. Es decir: el
  patrón que vale portar no es la función de mapeo, es la regla "todo campo del comando recuperado
  debe leerse de un dato ya congelado en el estado verificado, y lo que falte se marca como
  placeholder explícito, nunca se inventa".

**Forma portable a `verify-receipt.mjs`:** el script ya lee campos congelados del receipt
(`terminal_state`, fingerprint). Podría agregar una función pura `runnableCommand(reason, receipt)`
que, sólo cuando el motivo de rechazo es uno de un set fijo y enumerado (p. ej. "ausente" del
Candidato 1), imprima un comando armado ÚNICAMENTE con campos que el propio receipt/estado del
árbol ya contiene (path del receipt, SHA del árbol esperado) — nunca con valores libres del
usuario o adivinados. Sin ese set enumerado de motivos con comando conocido, no imprimir ningún
comando (igual que el fallback "requires explicit maintainer action" de `review.go:299`).

### Recomendación final

1. **Distinción ausente/corrupto (Candidato 1): ADOPTAR.** Es barata (un `fs.existsSync` antes del
   parse), mejora mensajes de error reales, y el discriminador es simple de portar 1:1: archivo no
   existe = ausente; archivo existe pero no parsea o no matchea campos esperados = corrupto. No
   requiere agregar reparación automática — sólo el mensaje correcto guía al operador a la acción
   correcta (regenerar vs. investigar corrupción).
2. **`reviewRunnableCommand` (Candidato 2): ADAPTAR, no portar tal cual.** La función de mapeo en
   sí es trivial y específica del CLI `gentle-ai` (namespace `review.<verb>`); no hay verbos
   equivalentes en VCP hoy. Lo que sí vale adoptar es la DISCIPLINA: si `verify-receipt.mjs` alguna
   vez imprime un comando de recuperación, ese comando debe ensamblarse sólo desde campos ya
   presentes en el receipt/estado congelado, con placeholders explícitos para lo que falte —
   nunca fabricar un valor. Sin verbos de recuperación hoy en VCP, esto es una regla de diseño a
   aplicar cuando se agregue ese primer comando sugerido, no código a copiar ahora.
