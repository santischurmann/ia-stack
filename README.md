# VibeCodeProtocols

VCP ayuda a una IA a cambiar código sin inventar que verificó algo.

La idea simple:

```text
entender → test rojo → cambio chico → test verde → casos borde → revisión → evidencia → release
```

No es una empresa con servidor. No requiere otros skills. Es un skill autocontenido con archivos
de memoria, checks ejecutables y reglas de trabajo. Sirve para Claude Code y cualquier agente que
pueda leer Markdown y ejecutar Git, Node, Bash o PowerShell.

## Qué resuelve

- Evita “código primero, tests después”.
- Separa quién prueba, implementa, revisa y publica.
- Guarda decisiones, deuda, lecciones y handoffs en `.vibe/`.
- Detiene releases con evidencia vieja, cambios fuera de plan, secretos obvios o tests falsos.
- Permite retomar una sesión sin mezclar features.

No promete magia: un test verde no prueba que el producto sea bueno. Por eso VCP obliga a escribir
qué se ejecutó, qué se leyó y qué quedó fuera de revisión.

## Empezar

Desde el clone de VCP, instalá el skill y elegí el proyecto destino:

```bash
./scripts/install.sh --project /ruta/a/mi-proyecto
```

En Windows PowerShell:

```powershell
.\scripts\install.ps1 -ProjectDir C:\ruta\a\mi-proyecto
```

Eso deja un runtime completo en:

```text
<proyecto>/.vibe/vcp-runtime/
```

Después reiniciá Claude Code, abrí el proyecto y usá `/VibeCodeProtocols`.

No copies comandos desde el clone a tu proyecto. Desde el proyecto, los comandos siempre salen de
`.vibe/vcp-runtime/scripts/`. Así no dependen de dónde quedó descargado VCP.

## El flujo

| Fase | Hace | No permite seguir si |
|---|---|---|
| 0. Bootstrap | Detecta stack, memoria y feature activa | La sesión pertenece a otra feature |
| 1. Spec | Define necesidad, ACs, límites y no-goals | Hay una aclaración pendiente |
| 2. Plan | Declara tareas, archivos escritores y orden | Dos tareas se pisan sin dependencia |
| 3. Build | RED → GREEN → TRIANGULATE → REFACTOR | No hay RED real o un caso borde queda rojo |
| 4. Final | Suite, cobertura, seguridad, 4R, receipt y backup | La evidencia no coincide con el árbol real |

VCP mantiene opciones 🔵 en las decisiones de alcance, detalle, paralelismo y publicación. El
agente recomienda una opción, explica costo/riesgo y espera la decisión humana cuando cambia
alcance o autoridad.

## Gates que sí son código

Estos no son checklists de buena voluntad:

- `verify-red-node.mjs`: corre **exactamente** `node --test --test-reporter=tap <archivo>` y
  exige la evidencia estructural que produce el propio harness de `node:test` — un bloque TAP
  `  ---`/`  ...` real con `code: 'ERR_ASSERTION'` — no un match de texto sobre stdout/stderr
  combinados. Bash y PowerShell son entradas equivalentes. Para otro stack hay que sumar un
  adapter dedicado y falsificado; no se habilita por regex genérico. El archivo debe permanecer
  físicamente dentro del proyecto: bloquea `..`, symlinks externos y links colgantes.
  **Límite honesto:** el gate prueba que un `test()` real registrado falló con un error con forma
  de `AssertionError`. No prueba que ese error vino de `node:assert` genuino — un archivo de test
  que arma un `Error` a mano con `code:'ERR_ASSERTION'` dentro de un `test()` real produce la
  misma evidencia estructural (falsificado y documentado en
  `research/adversarial-productivity-audit-2026-08-23.md`). Eso queda como responsabilidad de
  revisión/protocolo, no de este gate técnico.
- `pretooluse-red.mjs`: guard opcional del tipo `PreToolUse` para las tools `Write`/`Edit`.
  **No es un control de integridad ni de procedencia, y no es un sandbox.** Los receipts son
  evidencia contextual y revisable — un registro de que ciertos tests hashean a determinado
  contenido y que algún `node --test` salió con error al momento declarado — no una prueba
  criptográfica de que `emit()` los produjo. En el mismo filesystem que el agente puede escribir
  con `Bash`/PowerShell, un receipt con forma válida, hash de test real y matemática de TTL
  consistente (`emitted_at + 30 minutos`) autoriza una escritura de producción sin que haya
  corrido ningún RED real — falsificado y documentado en
  `research/adversarial-productivity-audit-2026-08-23.md`. Esto es un límite esperado del modelo
  asesorado (decisión explícita: revisión humana/protocolo, no un boundary técnico), no un bug
  pendiente. Lo que el guard sí hace, como fricción útil contra error accidental: bloquea
  `Write`/`Edit` directo sobre `.vibe/red-receipts/**` (para el único canal que el hook ve),
  exige que el receipt referencie tests reales cuyo hash siga coincidiendo, y rechaza matemática
  de TTL inconsistente.
- `verify-plan-conflicts.mjs`: detecta writers compartidos, inclusive paths con `../` disfrazado.
- `verify-receipt.mjs`: hashea por separado HEAD→index, index→worktree, cambios de modo,
  binarios y untracked. Un cambio posterior invalida el receipt.
- `verify-security-baseline.mjs`: escanea el delta de base más staged, unstaged y untracked.
  Bloquea secretos obvios, artefactos sensibles y ejecución dinámica/SQL concatenado **cuando
  aparecen con comillas simples/dobles y concatenación con `+` en una sola línea**. Es un piso
  grep literal, no un reemplazo de SAST: no normaliza template literals (backticks), no evalúa
  contenido partido en varias líneas, y no reconoce despacho dinámico vía notación de corchetes
  (`globalThis['ev'+'al']`). Para riesgo alto, sumá un scanner real y conservá este gate como piso
  mínimo, no como cobertura completa.
- `verify-vcp-coverage.mjs`: exige 100% de líneas, ramas y funciones para **cada script Node
  inventariado**. Los scripts Bash/PowerShell tienen pruebas funcionales de paridad; no se los
  declara cubiertos por líneas porque Node no los instrumenta.
- `verify-backup-state.mjs`: guarda un recibo del backup de Graphify y comprueba que el reporte,
  el grafo y el commit siguen siendo exactamente los que se revisaron. Esto valida **integridad y
  frescura de dos archivos locales** (sus hashes no cambiaron desde que se registró el manifest, y
  el commit declarado en el reporte coincide con `HEAD`). No valida **completitud semántica**:
  no verifica que el grafo realmente contenga todos los nodos/relaciones del árbol de código, sólo
  que el `graph.json` grabado es el mismo que se referenció. `graphify-out/` está en
  `.gitignore`, así que en un clone limpio sin backup local `check` falla — esto es esperado, no
  un bug: el gate certifica el backup de *esta* máquina, no lo reconstruye.

Ejemplos desde el proyecto. Un proyecto recién instalado necesita un único paso manual antes del
primer receipt: fijar el feature slug activo en `.vibe/SESSION.md` (la instalación lo deja como
placeholder a propósito, para no inventar una feature falsa):

```bash
# Paso único, manual, antes del primer gate — reemplazá el placeholder por el slug real
# ("**Feature slug:** (set before first gate...)" -> "**Feature slug:** auth-fix")

# Antes de aprobar el plan
node .vibe/vcp-runtime/scripts/verify-plan-conflicts.mjs check docs/tasks.json

# RED estricto para Node nativo
.vibe/vcp-runtime/scripts/verify-red.sh test/auth.test.mjs "node --test"

# Receipt de RED opcional para el hook PreToolUse (requiere el feature slug del paso único de
# arriba ya seteado en .vibe/SESSION.md; --feature debe coincidir exactamente)
node .vibe/vcp-runtime/scripts/pretooluse-red.mjs emit \
  --feature auth-fix --task T01 --tests test/auth.test.mjs \
  --files src/auth.mjs --command "node --test"

# Cablear el hook (opcional, endurece Write/Edit — no cubre Bash/PowerShell, ver arriba):
# agregar a .claude/settings.json del proyecto:
#   { "hooks": { "PreToolUse": [ { "matcher": "Write|Edit",
#       "hooks": [ { "type": "command",
#         "command": "node .vibe/vcp-runtime/scripts/pretooluse-red.mjs" } ] } ] } }

# Seguridad sobre lo que realmente se va a liberar
node .vibe/vcp-runtime/scripts/verify-security-baseline.mjs check --base origin/main

# Antes del commit
node .vibe/vcp-runtime/scripts/verify-receipt.mjs check .vibe/receipts/auth-fix-2026-08-23.json

# Después del commit: backup Graphify/Obsidian que queda ligado a ese commit
graphify update .
graphify export obsidian --dir graphify-out/obsidian
node .vibe/vcp-runtime/scripts/verify-backup-state.mjs record \
  --report graphify-out/GRAPH_REPORT.md --graph graphify-out/graph.json \
  --manifest graphify-out/backup-state.json
node .vibe/vcp-runtime/scripts/verify-backup-state.mjs check graphify-out/backup-state.json
```

## Memoria durable

`.vibe/` no es un log gigante. Cada archivo tiene una función:

```text
PROJECT.md    contexto estable del proyecto
SESSION.md    punto exacto para retomar
DECISIONS.md  decisiones y por qué
PATTERNS.md   prácticas que funcionaron
DEBT.md       deuda aceptada de forma explícita
LESSONS.md    errores reutilizables, confirmados antes de guardar
AUDIT.md      trail de gates y decisiones
handoffs/     qué revisó cada rol y qué no revisó
receipts/     evidencia del release
vcp-runtime/  scripts, templates y skills usados por este proyecto
```

Archivar dos veces el mismo tema no pisa evidencia: VCP conserva ambos snapshots.

## Límites honestos

- El runtime Paperclip completo, control de costos en vivo y servidores multiagente no existen
  aquí. VCP sólo implementa el bookkeeping local que usarían.
- El fallback de seguridad no hace taint analysis, SCA ni busca CVEs. Para riesgo alto, agregá un
  scanner real y conservá este gate como mínimo.
- El RED estricto incluido hoy cubre Node nativo. Bloquear un runner no soportado es más seguro
  que llamarlo “verificado”.
- “100% coverage” se refiere únicamente a métricas que el runner expone. La evidencia debe decir
  qué queda fuera; nunca se infiere cobertura por prosa.

## Más detalle

- [Instalación](INSTALL.md)
- [Contrato completo del agente](SKILL.md)
- [Templates de spec y plan](skills/spec-plan-templates.md)
- [Memoria y lecciones](skills/vibe-memory.md)
- [Fallback de seguridad](skills/security-baseline.md)
- [Research y decisiones](research/)

## Desarrollo de VCP

```bash
node --test
node scripts/verify-vcp-coverage.mjs
git diff --check
```

El segundo comando comprueba los scripts Node de este repositorio. Al cambiar Bash o PowerShell,
sumá una falsificación real a su test funcional equivalente. Un “parece que funciona” no es
evidencia.
