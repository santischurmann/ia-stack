# Inventario histórico de capacidades — VibeCodeProtocols

**Fecha:** 2026-08-28 · **Alcance:** los 46 commits de `main`, todos los `scripts/*.mjs`.

## Qué se buscó

Toda exportación (`export function|const|class`) y todo subcomando de CLI que haya existido en
algún commit y **hoy no exista**. La pregunta que responde: ¿VCP perdió alguna capacidad por el
camino sin que nadie se diera cuenta?

## Números

| | |
|---|---:|
| Commits recorridos | 46 |
| Símbolos y subcomandos vistos alguna vez | 259 |
| Vivos hoy | 254 |
| Desaparecidos | 5 |
| **Regresiones (capacidad perdida)** | **0** |

## Los cinco desaparecidos, clasificados

Clasificación: **A** = removido a propósito y documentado · **B** = removido a propósito, sin
documentar · **C** = perdido por accidente (regresión) · **D** = la capacidad sobrevive con otro
nombre o forma.

| Símbolo | Archivo | Clase | Evidencia |
|---|---|:-:|---|
| `graphCommit` | `verify-backup-state.mjs` | **A** | Removido en T10 al cerrar el hallazgo 55: el sello dejó de leerse del reporte de Graphify y pasa a registrarlo el protocolo. Documentado en CHANGELOG y en el backlog. |
| `BASE_68_REQ_IDS` | `verify-discovery-requirements.mjs` | **D** | Renombrado a `BASE_REQ_IDS`, y además derivado de `PHASE_ORDER` en vez de ser una lista fija. El número 68 salió del nombre porque ahora se calcula. |
| `RECEIPT_PATH` | `pretooluse-red.mjs` | **D** | Era un archivo único (`.vibe/red-receipt.json`). Hoy es `RECEIPT_DIR` con un receipt por feature y por tarea (`.vibe/red-receipts/<feature>/<task>.json`). Capacidad ampliada, no perdida. |
| `hash16` | `pretooluse-red.mjs` | **D** | Era un hash truncado a 16 caracteres. Hoy es sha256 completo, y el verificador exige la forma `/^[0-9a-f]{64}$/`. Estrictamente más fuerte. |
| `isUnderGate` | `pretooluse-red.mjs` | **D** | El confinamiento de rutas sobrevive como `isContainedProjectPath` más una allowlist explícita (`allowed_paths`) con chequeo de extensión. Más restrictivo que la versión que reemplazó. |

## Lectura

Los cuatro **D** son la misma historia: el commit `ad29447` ("blindar gates verificables") y el
trabajo posterior reemplazaron mecanismos débiles por versiones más estrictas. Ninguna capacidad
se perdió; en los cuatro casos la que quedó es más fuerte que la que se fue. El único **A** es un
borrado deliberado que ya estaba documentado.

**No hay ningún caso C.** En 46 commits, VCP no perdió capacidades en silencio.

## Decisión: esto no se convierte en gate

La tentación era volver esto un detector permanente —"una exportación que desaparece sin motivo
escrito es un rechazo"—. **Se decide que no**, y el motivo queda acá: cuatro de los cinco casos
son renombres legítimos, así que ese gate habría gritado en cuatro refactors correctos y callado
en cero problemas reales. Un detector con esa relación señal/ruido se termina desactivando, y un
gate desactivado es peor que ninguno porque además da la sensación de que algo vigila.

Queda como **auditoría repetible**, no como gate: el guion que la produce vive en el historial de
esta sesión y se puede volver a correr cuando haga falta.

## Límite honesto de este inventario

- Sólo mira `scripts/*.mjs`. **No cubre** `install.sh`, `install.ps1`, plantillas, contratos JSON
  ni el contenido de `SKILL.md`: una promesa del protocolo que se borró de la documentación no
  aparece acá.
- Detecta símbolos que **desaparecieron**, no símbolos que **se vaciaron**. Una función que sigue
  exportada pero cuyo cuerpo pasó a ser `return true` es invisible para esta auditoría.
- La detección de subcomandos es sintáctica (comparaciones contra `args[0]`). Un CLI que despache
  de otra forma no se cuenta.
