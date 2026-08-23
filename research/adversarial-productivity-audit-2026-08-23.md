# Auditoría adversarial de productividad — 2026-08-23

## Base de evidencia

Esta auditoría no usa “intuiciones de agentes” como evidencia. Cruzó el código y tests actuales,
el grafo local, el ledger de research y sesiones directamente vinculadas a VCP:

- Claude: `<home>\.claude\projects\C--Users-Santi-Desktop-Claude-VibeCodeProtocols\8d69523c-56e9-4520-82b9-a88818e0c44f.jsonl` (4.743 eventos, 14–21 Ago).
- Codex: 21 sesiones con `cwd` exactamente VCP (73 MB totales revisados por el auditor).
- Graphify previo: `graphify-out/GRAPH_REPORT.md`, construido sobre `4df2a302` mientras el
  baseline de esta auditoría era `ad29447`.
- Research: `research/source-matrix.md` y `research/sources/multi-repo-2026-08-21.md`.

Límite: el research anterior es honesto sobre su cobertura. La ronda de 10 repos tuvo 78
candidatos con veredicto; sólo 24 están `VALIDADO`. No se declara que 50 ideas externas fueron
validadas de forma independiente.

## Las 50 mejoras encontradas

Estado: **HECHO** = implementado y falsificado en esta rama; **SIGUIENTE** = evidencia suficiente
pero requiere un cambio independiente; **NO AUTOMATIZAR** = sería prosa, infraestructura externa
o ampliación de alcance sin una garantía mecánica nueva.

| # | Mejora | Evidencia | Estado |
|---:|---|---|---|
| 1 | RED sólo con runner que pruebe el archivo pedido | falso `node -e` aprobado por regex | **HECHO** |
| 2 | Runner no soportado bloquea, no se adivina | audit de `verify-red.*` | **HECHO** (Node nativo) |
| 3 | Hook malformed fail-closed | `pretooluse-red.mjs` aceptaba stdin inválido | **HECHO** |
| 4 | RED receipt por feature/tarea/path | receipt global autorizaba T01 → T02 | **HECHO** |
| 5 | Receipt de RED vence y hashea tests | sesiones largas + assertion-loosening | **HECHO** |
| 6 | Inventory de todos los `.mjs` cubiertos | “100%” omitía scripts nuevos | **HECHO** |
| 7 | Declarar cobertura shell como funcional, no lineal | Node no instrumenta `.sh`/`.ps1` | **HECHO** |
| 8 | Security scan incluye untracked/staged/unstaged | 4.3 era antes de `git add -A` | **HECHO** |
| 9 | Redactar valores de secretos en evidencia | research `engram` + seguridad | **HECHO** |
| 10 | Runtime co-localizado en el proyecto | installer y docs usaban paths incompatibles | **HECHO** |
| 11 | E2E real de instalación Bash + PowerShell | instalación previa sólo verificaba copias; reinstalar podía anidar runtime | **HECHO** |
| 12 | Templates siempre presentes al inicializar memoria | `vibe-memory.sh` degradaba a archivos vacíos | **HECHO** |
| 13 | Archivos de sesión sin overwrite | archive repetido pisaba el primero | **HECHO** |
| 14 | Canonicalizar `src/../x` en plan | writer overlap evadible | **HECHO** |
| 15 | Case-fold conservador en plan | Windows puede colisionar por mayúsculas | **HECHO** |
| 16 | Ratchet mira código untracked | `git ls-files` omitía código nuevo | **HECHO** |
| 17 | Contrato documental testeado | README 90% contradecía la policy 100% | **HECHO** |
| 18 | Un template de plan con preflight | `templates/plan.md` y template embebido divergían | **HECHO** |
| 19 | README corto y honesto | uso real mostró confusión sobre qué es VCP | **HECHO** |
| 20 | Falsificación propia por cada gate nuevo | fallas RED/receipt previas se hallaron así | **HECHO** en cambios de esta ronda |
| 21 | Receipt schema verifica AC/evidence/4R estructurados | `verify-receipt.mjs` admite receipt mínimo | SIGUIENTE |
| 22 | Commit atómico con receipt revalidado | ventana TOCTOU entre `check` y `git commit` | SIGUIENTE |
| 23 | Receipt exige índice exacto, worktree limpio | hoy puede attestear estado unstaged | SIGUIENTE |
| 24 | Scope post-task compara diff real contra plan | plan declara writers; diff puede diferir | SIGUIENTE |
| 25 | Claim de task atómico con token/TTL | lock JSON no es atómico | SIGUIENTE |
| 26 | Reconciliación de locks muertos al resume | sesión interrumpida deja ownership ambiguo | SIGUIENTE |
| 27 | Audit log con hash chain | “append-only” es hoy una convención | SIGUIENTE |
| 28 | ZIP desde allowlist | denylist de build puede filtrar `.env` | SIGUIENTE |
| 29 | Manifest de backup Graphify post-commit | grafo local estaba en `4df2a302`, no `ad29447` | **HECHO** |
| 30 | Manifest Graphify de inclusiones/exclusiones | “100% extracted” no cubre JSON sin nodos | SIGUIENTE |
| 31 | Destino Obsidian explícito y validado | no se halló vault en rutas estándar | SIGUIENTE |
| 32 | Receipt de remote ref/fetch | hubo timeout de `git fetch origin/main` | SIGUIENTE |
| 33 | Research ledger gate (URL/SHA/cita/cobertura) | sesiones tuvieron placeholders promovidos | SIGUIENTE |
| 34 | Checkpoint completo al límite de proveedor | límites cortaron trabajo antes del cierre | SIGUIENTE |
| 35 | Estado `provider_paused` | COMPANY default es presupuesto ilimitado | SIGUIENTE |
| 36 | Context packet por agente | telemetría mostró contexto excesivo | SIGUIENTE |
| 37 | Prohibir transcript completo cuando hay resumen | misma presión de cuota | SIGUIENTE |
| 38 | Presupuesto determinista por fase/reintento | policy manual no puede detener dispatch | SIGUIENTE |
| 39 | Pressure tests de reglas Markdown | `superpowers-14`, reglas pueden degradar en prompts | SIGUIENTE |
| 40 | Microtests de wording crítico | `superpowers-9`, evita negaciones ambiguas | SIGUIENTE |
| 41 | IDs AC → test como artefacto verificable | `jcode-2`, cobertura de intención | SIGUIENTE |
| 42 | Paridad estadística Bash/PowerShell | `i-have-adhd-3`, hoy hay fixtures de paridad básicos | SIGUIENTE |
| 43 | Límite de ciclo de fix | `superpowers-2`, evita arreglos infinitos | SIGUIENTE |
| 44 | Reproducir/instrumentar antes de diagnosticar | `mattpocock-4`, baja fixes narrativos | SIGUIENTE |
| 45 | Árbol de decisión de límite de fase | `mattpocock-1`, reduce ambigüedad de orquestación | SIGUIENTE |
| 46 | Redacción canónica reutilizable | `mattpocock-6`/`gstack`, evita patrones duplicados | SIGUIENTE |
| 47 | Baseline diff de findings | `paperclip`/`gstack`, separa deuda vieja de nueva | SIGUIENTE |
| 48 | Evidence locator seguro (URL sin credenciales) | `paperclip P07/P08` | SIGUIENTE |
| 49 | Tier de modelo sólo para razonamiento difícil | `superpowers-7/8`, optimiza costo sin bajar gates | SIGUIENTE |
| 50 | No implementar runtime Paperclip ficticio | research confirma que requiere server/telemetría real | **NO AUTOMATIZAR** |
| 51 | Contención física de paths RED/hook | review independiente encontró escape por symlink tras cerrar `..` | **HECHO** |

## Orden aplicado

Se priorizó daño real y reversibilidad, no cantidad: los puntos marcados **HECHO** antes que las
ideas de proceso restantes. La razón es concreta: permitían aprobar RED falso, escribir fuera de
scope, omitir código nuevo del scan, instalar un sistema que no corría o mantener un grafo viejo.
Cada cambio aplicado trae prueba de falsificación.

Los puntos 21–49 quedan como backlog verificable, no como promesas. Antes de aplicar uno hay que
hacer el mismo ciclo: SPEC → PLAN → falsificación → implementación → revisión independiente.
