# Discovery — integridad-verificable

Run canónico: `runs/run-001/`. Las decisiones y el snapshot de claims son los JSON inmutables;
este documento es el razonamiento humano que los acompaña y no sustituye a ninguno.

## 1. Research verificable

Cuatro claims con locator y hash en `runs/run-001/packets/d002.json`, todos `SUPPORTED` contra
archivos de este repositorio. Ninguna fuente externa se leyó para esta decisión, así que no hay
claims `INFERRED` ni `INSUFFICIENT_EVIDENCE`: el problema es enteramente interno y observable.

## 2. CAIO

| Categoría | Estado | Evidencia |
|---|---|---|
| Proceso roto | **Observado** | Cuatro reglas del protocolo existen sólo como texto: la ventana entre `check` y `commit` (`SKILL.md:693`), el carácter append-only de `AUDIT.md` (`skills/vibe-memory.md:99`), la distinción deuda-vieja/hallazgo-nuevo (ausente en `verify-security-baseline.mjs:314`) y las frases de límite honesto (cobertura parcial en `verify-vcp-contract.mjs`). El propio protocolo declara que una regla sin detector es decorativa. |
| Pérdida de información | **Observado** | `AUDIT.md` es la traza de accountability y nada detecta la reescritura de una línea pasada. Una sesión puede alterar su propio historial sin dejar rastro. |
| Retrabajo | **Hipótesis** | No se recolectó evidencia de retrabajo real causado por estos huecos. No se presenta como diagnóstico. |
| Bucle abierto | **Observado** | `verify-receipt.mjs:421` documenta explícitamente una ventana que no cierra. Está declarada honestamente pero nunca se cerró. |

## 3. Mapa de bucle

**Actual:** entrada = un gate mecánico verde → medida = exit code → decide = orquestador →
acción = commit/push → control = ninguno entre validación y escritura → aprendizaje = ninguno,
porque una violación en esa ventana no deja evidencia.

**Objetivo:** entrada = gate verde **y** estado de árbol re-verificado en el momento de escribir →
medida = exit code + hash del árbol re-computado → decide = orquestador → acción = commit atómico →
control = hash-chain en `AUDIT.md` que detecta reescritura posterior → feedback = un baseline de
findings distingue deuda aceptada de regresión nueva → aprendizaje = cada frase de límite honesto
queda fijada por un microtest, así una degradación futura falla en CI en vez de pasar inadvertida.

Primer bucle a cerrar: **#27 hash-chain de `AUDIT.md`**. Dueño: el orquestador de cada sesión.
Métrica: porcentaje de líneas de audit con hash de predecesor válido. Cadencia: por gate, es decir
cada vez que se escribe una línea.

## 4. PRD

- **Problema:** cuatro invariantes del protocolo dependen de que nadie las viole por convención.
- **Usuario:** el orquestador de la próxima sesión (humano o IA) y quien audita el repo después.
- **Resultado operativo:** una violación de cualquiera de las cuatro falla un comando con exit 1
  y un mensaje que nombra el archivo exacto, en vez de pasar inadvertida.
- **Tecnología:** Node nativo, cero dependencias nuevas. Ningún servicio externo, ninguna red.
- **Funciones:** 4 gates (`verify-audit-chain`, baseline en `verify-security-baseline`,
  commit atómico en `verify-receipt`, microtests de wording en `verify-vcp-contract`).
- **Dependencias:** Git ya requerido; `node:crypto` ya en uso.
- **Accesos:** ninguno nuevo. Todo local, sin credenciales.
- **Orden y validaciones:** cada tarea entra con test rojo visible primero; 100% de líneas, ramas
  y funciones antes de considerarse hecha; el contrato documental se actualiza en la misma tarea.

**No-goals declarados:** no se cierra criptográficamente la ventana TOCTOU (imposible sin un lock
del filesystem o firma externa: sólo se angosta y se documenta el residuo). El hash-chain de audit
detecta reescritura accidental o protocolar, no resiste a un actor con control del mismo
filesystem que recalcule toda la cadena. Ningún gate prueba suficiencia semántica.

## 5. Adopción y recurrencia

- **Responsable interno:** operador único (Santi). Modo single-operator: no hay sponsor separado
  de owner operativo, y eso queda declarado en vez de inventar una estructura de equipo.
- **Cambio de hábito:** el paso 4.6 pasa a invocar el commit atómico en lugar de `check` seguido
  de `git commit` a mano.
- **Señal de uso:** aparición de líneas con `prev_hash` en `.vibe/AUDIT.md` de sesiones futuras.
- **Mantenimiento:** los 4 gates entran en la suite existente; no agregan proceso aparte.
- **Siguiente proceso candidato:** los items del backlog que hoy requieren una decisión de política
  (#25/#26 locks, #34/#35 provider_paused, #38 presupuesto por fase), que este trabajo no toca.
