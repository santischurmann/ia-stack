# Encargo a un subagente

Un encargo le pasa a otro agente una tarea chica con todo lo que necesita y nada más. Nunca se
manda la conversación entera.

## Topes
- Hasta 4.000 tokens y 3 archivos (`contracts/model-routing.json`, sección `encargo`).
- Comprobalo: `node scripts/verify-brief-size.mjs check <encargo.md>`. El archivo declara sus
  archivos en una sola línea `ARCHIVOS: a, b, c` (`ARCHIVOS: ninguno` si no hay).
- Si no entra, partí la tarea.
- Un dueño por tarea: antes de lanzar, mirá la cola de `.ia-stack/ESTADO.md`.

## Plantilla
Copiala y completá. Modo breve (`skills/modo-breve.md`).

```
TAREA: <una frase: qué hay que lograr>
ARCHIVOS: <hasta 3 rutas>
NO TOCAR: <rutas o áreas prohibidas>
CONTEXTO: <sólo lo necesario: criterio de aceptación, decisión tomada, fragmento del código>
VERIFICAR: <comando exacto y salida esperada>
NIVEL: barato | medio | fuerte
REPORTE: <pegá acá el bloque de «Formato del reporte» de abajo>
```

## Elegir el nivel
- Barato: leer, buscar, logs, git, edición mecánica, documentación.
- Medio: pruebas, pantallas, un patrón que ya existe en el código, y código sin señal clara.
- Fuerte: marca, spec, plan, rondas de brainstormings y de EGM, plata, seguridad, autenticación, migraciones, revisión antes de publicar.
- El orquestador reparte; no construye ni lee código.
- Si el encargo falla: subí un nivel (barato → medio → fuerte, según `escalada.por_falla` del
  contrato) y pegá la falla exacta al encargo nuevo. Si falla el fuerte, frená
  y preguntale a la persona. Un error de cupo no es una falla: se espera.

```
FALLA
comando: <el que se corrió>
salida: <hasta 20 líneas, sin recortar el error>
archivo:línea: <dónde rompe>
ya probado: <qué se intentó y por qué no alcanzó>
```

## Si el host lo tiene
- Subagente: `model` y `effort` iguales al contrato; `maxTurns` sólo con el tope que fije la persona
  (el contrato no trae uno); `isolation: worktree` si escribe en paralelo con otro (con su puerto y
  su base de prueba). Al terminar, se corre `node scripts/verify-scope-diff.mjs check` en el
  worktree; si pasa, su rama se mergea en local a la de trabajo y se quita el worktree.
- Workflows (`.claude/workflows/`): sólo si la persona lo pide; un agente por paso, en orden.
- Code Mode: sólo si la persona lo activó (`CLAUDE_CODE_EXPERIMENTAL_CODE_MODE=1`, `claude` en terminal).
- Advisor: no (factura aparte y saca a Fable del orquestador). Skills desde MCP: no (beta; el
  protocolo se instala como archivos).

## Formato del reporte
```
ESTADO: hecho | parcial | bloqueado
CAMBIOS: <archivo:línea, uno por línea>
EVIDENCIA: <comando y salida real; si pasa del tope, la salida entera va a `.ia-stack/handoffs/` y acá su ruta>
NO REVISADO: <qué no miró; nunca vacío>
SIGUE: <próximo paso o pregunta>
```
- Largo y destino: `skills/modo-breve.md`.
- Sin evidencia de un comando real, el estado no puede ser «hecho».
- Quien construyó no revisa su propio trabajo: el revisor es una sesión de nivel fuerte distinta
  de la que construyó (puede ser el mismo modelo; si no hay, revisa la persona).
