# VibeCodeProtocols (VCP)

VCP ayuda a una IA a cambiar código sin inventar que revisó, probó o entendió algo.

En una frase:

```text
entender -> decidir -> test rojo -> cambio chico -> casos borde -> revisión -> evidencia -> release
```

Es un protocolo autocontenido: instala un runtime local con documentación, templates y gates
ejecutables. No necesita descargar otros skills ni conectar servicios externos para aplicar su
flujo base.

## Para qué sirve

VCP organiza el trabajo de Claude Code, Codex u otro agente que pueda leer Markdown y ejecutar
Git, Node, Bash o PowerShell. Sirve para:

- evitar el patrón "código primero, tests después";
- separar planificación, implementación, revisión y publicación;
- retomar una feature sin confundirla con una sesión anterior;
- registrar decisiones, deuda, lecciones y handoffs en `.vibe/`;
- frenar un release cuando cambió el árbol, el plan se pisa, falta evidencia o aparece un riesgo
  básico de seguridad.

VCP no promete que un test verde vuelva bueno al producto. Obliga a distinguir lo que se ejecutó
de lo que todavía requiere revisión humana.

## Instalación

Desde el clone de VCP, elegí el proyecto donde querés trabajar:

```bash
./scripts/install.sh --project /ruta/a/mi-proyecto
```

En Windows PowerShell:

```powershell
.\scripts\install.ps1 -ProjectDir C:\ruta\a\mi-proyecto
```

La instalación deja el runtime completo dentro del proyecto:

```text
<proyecto>/.vibe/vcp-runtime/
```

Reiniciá tu agente, abrí ese proyecto y usá `/VibeCodeProtocols`. Desde entonces ejecutá los
comandos desde `.vibe/vcp-runtime/scripts/`, no desde el clone original de VCP.

## El flujo, simple

| Fase | Pregunta que responde | Resultado necesario |
|---|---|---|
| 0. Bootstrap | ¿Qué proyecto y feature son ésta? | Contexto, estado y feature activa claros |
| 1. Spec | ¿Qué problema resolvemos y qué no? | Criterios de aceptación y límites |
| 2. Plan | ¿Qué se toca y en qué orden? | Tareas sin escritores en conflicto |
| 3. Build | ¿La conducta está probada antes de cambiarla? | RED -> GREEN -> TRIANGULATE -> REFACTOR |
| 4. Final | ¿La evidencia coincide con lo que se libera? | Suite, seguridad, revisión, receipt y backup |

Cuando una decisión cambia alcance, costo, riesgo o publicación, VCP muestra opciones 🔵. El
agente recomienda una, explica el motivo y espera la decisión humana; no elige por silencio.

## Discovery: investigar antes de especificar

Para un cambio que no sea claramente trivial, VCP no empieza escribiendo código ni una spec a
ciegas. Primero hace una pasada de **Discovery**. Su salida es la evidencia que alimenta la spec;
no es un reporte decorativo al final.

1. **Research trazable:** fuentes, versión/fecha, límites de lectura y claims que sí o no sostienen
   una decisión.
2. **Diagnóstico CAIO:** qué proceso está roto, dónde se pierde información, qué trabajo se repite
   y qué bucle queda abierto.
3. **Mapa de bucle:** entrada, medida, responsable de decidir, acción, control y aprendizaje; se
   compara el flujo actual con el flujo objetivo.
4. **PRD y planes:** problema, usuarios, resultado operativo, dependencias, implementación,
   adopción y recurrencia del primer bucle a cerrar.

Cada decisión se guarda como JSON inmutable bajo
`docs/discovery/<feature>/runs/run-NNN/{decisions,packets}/`. Un packet completed conserva su
snapshot de research y hash; la validación nunca relee un ledger mutable para reinterpretar la
historia. Las vistas Markdown bajo `docs/discovery/<feature>/views/` son derivadas, no fuente de
verdad: se regeneran y se comparan byte a byte.

```bash
# Verifica la cadena inmutable de decisiones y snapshots.
node .vibe/vcp-runtime/scripts/verify-discovery-core.mjs check --feature <feature-slug>

# Genera y luego comprueba vistas reproducibles (sin timestamps ni paths del entorno).
node .vibe/vcp-runtime/scripts/verify-discovery-views.mjs render --feature <feature-slug>
node .vibe/vcp-runtime/scripts/verify-discovery-views.mjs check --feature <feature-slug>
```

Discovery puede terminar en `completed`, `skipped` u `overridden`, siempre con evidencia y motivo.
No prueba que una fuente sea suficiente semánticamente ni sustituye a quien decide el producto:
hace visible qué evidencia se usó, qué quedó fuera y qué decisión humana falta antes de pasar a
Spec.

## Uso diario

1. Elegí una sola feature y completá su spec.
2. Aprobá un plan con tareas chicas y archivos escritores declarados.
3. Para cada tarea: reproducí RED, implementá GREEN, buscá un caso borde y recién después
   refactorizá.
4. Cerrá con los gates de release y un backup posterior al commit.

Ejemplo mínimo desde un proyecto ya instalado:

```bash
# Antes de construir: evita que dos tareas escriban lo mismo sin dependencia declarada.
node .vibe/vcp-runtime/scripts/verify-plan-conflicts.mjs check docs/tasks.json

# Después de GREEN: el diff real debe coincidir con los writers de la tarea.
# Elegí una base explícita (por ejemplo origin/main) y declarà sólo artefactos operativos
# que no son parte del cambio, uno por --ignore.
node .vibe/vcp-runtime/scripts/verify-scope-diff.mjs check \
  --tasks docs/tasks.json --task T01 --base origin/main \
  --ignore docs/tasks.json

# RED estricto para un test Node nativo.
.vibe/vcp-runtime/scripts/verify-red.sh test/auth.test.mjs "node --test"

# Antes de publicar: escanea el delta real contra la base elegida.
node .vibe/vcp-runtime/scripts/verify-security-baseline.mjs check --base origin/main

# Después del commit: genera y registra el backup local revisado.
graphify update .
graphify export obsidian --dir graphify-out/obsidian
node .vibe/vcp-runtime/scripts/verify-backup-state.mjs record \
  --report graphify-out/GRAPH_REPORT.md --graph graphify-out/graph.json \
  --manifest graphify-out/backup-state.json
node .vibe/vcp-runtime/scripts/verify-backup-state.mjs check graphify-out/backup-state.json
node .vibe/vcp-runtime/scripts/verify-graphify-manifest.mjs check
```

Antes del primer receipt, reemplazá el placeholder de feature en `.vibe/SESSION.md` por el slug
real. VCP no lo inventa porque una feature falsa vuelve inútil la trazabilidad.

`verify-scope-diff.mjs` compara los tres campos escritores de la tarea (`files_to_create`,
`files_to_modify`, `test_files`) con los paths trackeados y untracked que Git observa desde la
base elegida. Exit `1` si falta un writer, aparece un archivo extra o el plan es inseguro.
`--ignore` es obligatorio y explícito para cada artefacto operativo que deba quedar fuera; no hay
una exclusión global de `.vibe/`. Corré este gate después de GREEN y otra vez antes del receipt si
el working tree cambió.

## Los gates mecánicos

| Gate | Qué comprueba | Límite importante |
|---|---|---|
| `verify-red-node.mjs` | Un `node:test` produjo evidencia TAP de fallo con forma de assertion. | Sólo cubre Node nativo y no demuestra intención ni calidad del test. |
| `verify-plan-conflicts.mjs` | Dos tareas no escriben el mismo archivo sin un orden explícito. | No reemplaza una revisión del diseño. |
| `verify-receipt.mjs` | El árbol Git, modos, binarios y archivos no trackeados siguen siendo los revisados. | Un receipt es evidencia local, no una firma de procedencia. |
| `verify-security-baseline.mjs` | El delta no contiene secretos conocidos, rutas sensibles, ejecución dinámica, patrones SQL/HTML riesgosos ni configuraciones GitHub Actions básicas peligrosas. | Es un piso nativo de patrones; no es SAST, SCA, taint analysis ni una base de CVEs. |
| `verify-vcp-coverage.mjs` | Cada script Node inventariado mantiene 100% de líneas, ramas y funciones. | Bash y PowerShell tienen pruebas funcionales de paridad, no cobertura por instrumentación Node. |
| `verify-backup-state.mjs` | El reporte Graphify, el grafo y el commit local son los mismos que se registraron. | Verifica frescura e integridad local, no completitud semántica del grafo. |
| `verify-graphify-manifest.mjs` | Cada archivo rastreado está indexado o excluido con razón declarada, y el manifest no conserva entradas que Git ya no rastrea. | Prueba contabilidad, no comprensión: un archivo indexado puede haber producido cero nodos. |
| `verify-vcp-contract.mjs` (límites honestos) | Cada frase declarada en `contracts/honest-limits.json` sigue textual en su archivo. Cada límite lleva un `why` que dice qué garantía se pierde si desaparece, y el rechazo lo imprime. | Verifica que la frase esté, no que el párrafo que la rodea siga siendo cierto. Un límite que nadie declaró en el contrato tampoco se protege. |
| `verify-receipt.mjs commit` | Valida el receipt, commitea y confirma después que el árbol commiteado es el índice validado. Nunca reescribe historial por su cuenta ni saltea los hooks del operador. | La ventana entre validar y escribir pasa de minutos a milisegundos, no desaparece. La confirmación prueba que el commit contiene el índice revisado; no prueba que no hubo una escritura concurrente. |
| `verify-security-baseline.mjs --baseline` | Distingue deuda ya revisada de un hallazgo nuevo: lo aceptado no bloquea, lo nuevo sí, y una entrada que ya no corresponde a ningún hallazgo real también bloquea. Cada entrada lleva motivo, responsable y fecha. | Aceptar un hallazgo de secreto cubre el archivo y la categoría, no un valor concreto: si se reemplaza por otro secreto en el mismo archivo, sigue aceptado. Una entrada cuyo archivo quedó fuera del delta no se puede juzgar y no caduca. |
| `verify-audit-chain.mjs` | Cada línea de `.vibe/AUDIT.md` lleva el hash de la anterior: editar una línea vieja rompe la cadena y el gate nombra la línea exacta. `append` sella y se niega a escribir sobre una traza ya rota. | No detecta borrar los sufijos enteros de toda la traza, recortar sus últimas líneas, ni recalcular la cadena completa sobre contenido falso: los tres exigen un ancla fuera del archivo. |
| `verify-runtime-sync.mjs check` | El runtime instalado en `.vibe/vcp-runtime/` es, byte a byte, la superficie que copia el instalador desde este checkout: nombra los archivos que difieren, los que faltan y los que sobran (un gate borrado arriba que el proyecto sigue ejecutando). Sin runtime instalado sale `0`: un checkout fuente limpio es normal. | Detecta que la copia difiere, no que la copia sea correcta ni que el fuente lo sea: dos copias idénticas de un gate roto pasan igual. Compara contenido, no permisos —el `+x` que el instalador pone sobre `scripts/*.sh` no se verifica— y sólo puede hablar donde el checkout fuente y el runtime conviven en la misma máquina. |

El hook opcional `pretooluse-red.mjs` agrega fricción a `Write` y `Edit`: exige receipts
consistentes, tests reales hasheados y TTL válido. No es un sandbox ni un límite de confianza:
Bash, PowerShell y cualquier proceso que pueda escribir en el mismo filesystem pueden eludirlo.
VCP documenta ese límite para que la revisión humana no confunda fricción con una garantía.

## Seguridad nativa y límites

VCP trata todo texto generado por IA, los archivos del repositorio y la salida de herramientas
como datos no confiables. Sus gates fallan cerrados cuando no pueden inspeccionar con seguridad un
path, un link o una entrada crítica.

No instala dependencias de seguridad, no envía el código a servicios externos y no afirma detectar
todas las vulnerabilidades. Para una amenaza real, combiná este piso con revisión humana y los
controles que correspondan a tu proyecto.

Leé el [Modelo de seguridad y límites](SECURITY.md) antes de usar VCP en un entorno sensible.

## Memoria durable

`.vibe/` no es un log gigante. Cada archivo tiene un trabajo concreto:

```text
PROJECT.md    contexto estable del proyecto
SESSION.md    punto exacto para retomar la feature activa
DECISIONS.md  decisiones y motivos
PATTERNS.md   prácticas que funcionaron
DEBT.md       deuda aceptada explícitamente
LESSONS.md    aprendizajes confirmados
AUDIT.md      trail de gates y decisiones
handoffs/     qué revisó cada rol y qué no revisó
receipts/     evidencia local de release
vcp-runtime/  scripts, templates y skills instalados
```

## Verificar el propio VCP

Antes de publicar cambios en este repositorio corré:

```bash
node --test --test-concurrency=32
node scripts/verify-vcp-coverage.mjs
node scripts/verify-vcp-contract.mjs check
node scripts/verify-security-baseline.mjs check --base origin/main
git diff --check
```

El segundo comando exige 100% de líneas, ramas y funciones para los scripts Node de VCP. No
llames "100%" a una parte no instrumentada: los scripts Bash y PowerShell se validan con sus
fixtures funcionales específicos.

Para crear un paquete distribuible:

```bash
./scripts/build-zip.sh
```

El empaquetador usa una allowlist, rechaza paths inseguros y genera el SHA-256 del ZIP. Nunca
incluye `.git`, `.env`, `node_modules` ni backups locales.

## Documentación

- [Instalación](INSTALL.md)
- [Contrato completo del agente](SKILL.md)
- [Templates de spec y plan](skills/spec-plan-templates.md)
- [Memoria y lecciones](skills/vibe-memory.md)
- [Gate nativo de seguridad](skills/security-baseline.md)
- [Modelo de seguridad y límites](SECURITY.md)
- [Research y decisiones](research/)

VCP busca que el agente haga menos teatro y deje más evidencia útil.
