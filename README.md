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

- `verify-red-node.mjs`: corre **exactamente** `node --test <archivo>`; no acepta texto falso de
  un wrapper ni runners no soportados. Bash y PowerShell son entradas equivalentes. Para otro
  stack hay que sumar un adapter dedicado y falsificado; no se habilita por regex genérico. El
  archivo debe permanecer físicamente dentro del proyecto: bloquea `..`, symlinks externos y
  links colgantes.
- `pretooluse-red.mjs`: hook opcional. Un RED sólo habilita los paths productivos declarados para
  una feature y tarea; vence a los 30 minutos, vuelve a validar los tests y no sigue links fuera
  del proyecto.
- `verify-plan-conflicts.mjs`: detecta writers compartidos, inclusive paths con `../` disfrazado.
- `verify-receipt.mjs`: hashea por separado HEAD→index, index→worktree, cambios de modo,
  binarios y untracked. Un cambio posterior invalida el receipt.
- `verify-security-baseline.mjs`: escanea el delta de base más staged, unstaged y untracked.
  Bloquea secretos obvios, artefactos sensibles y ejecución dinámica/SQL concatenado. Es un piso
  grep, no un reemplazo de SAST.
- `verify-vcp-coverage.mjs`: exige 100% de líneas, ramas y funciones para **cada script Node
  inventariado**. Los scripts Bash/PowerShell tienen pruebas funcionales de paridad; no se los
  declara cubiertos por líneas porque Node no los instrumenta.
- `verify-backup-state.mjs`: guarda un recibo del backup de Graphify y comprueba que el reporte,
  el grafo y el commit siguen siendo exactamente los que se revisaron.

Ejemplos desde el proyecto:

```bash
# Antes de aprobar el plan
node .vibe/vcp-runtime/scripts/verify-plan-conflicts.mjs check docs/tasks.json

# RED estricto para Node nativo
.vibe/vcp-runtime/scripts/verify-red.sh test/auth.test.mjs "node --test"

# Receipt de RED opcional para el hook PreToolUse
node .vibe/vcp-runtime/scripts/pretooluse-red.mjs emit \
  --feature auth-fix --task T01 --tests test/auth.test.mjs \
  --files src/auth.mjs --command "node --test"

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
