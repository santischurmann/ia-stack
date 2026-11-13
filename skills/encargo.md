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
REPORTE: conclusión, archivo:línea, salida del comando.
```

## Elegir el nivel
- Barato: leer, buscar, logs, git, edición mecánica, documentación.
- Medio: pruebas, pantallas, un patrón que ya existe en el código.
- Fuerte: marca, spec, plata, seguridad, autenticación, migraciones, revisión antes de publicar.
- El orquestador reparte; no construye ni lee código.
- Si el encargo falla: subí un nivel (barato → medio → fuerte; `siguienteNivel` de
  `scripts/clasificar-tarea.mjs`) y pegá la falla exacta al encargo nuevo. Si falla el fuerte, frená
  y preguntale a la persona. Un error de cupo no es una falla: se espera.

```
FALLA
comando: <el que se corrió>
salida: <hasta 20 líneas, sin recortar el error>
archivo:línea: <dónde rompe>
ya probado: <qué se intentó y por qué no alcanzó>
```

## Formato del reporte
```
ESTADO: hecho | parcial | bloqueado
CAMBIOS: <archivo:línea, uno por línea>
EVIDENCIA: <comando y salida real, sin recortar>
NO REVISADO: <qué no miró; nunca vacío>
SIGUE: <próximo paso o pregunta>
```
- Largo y destino: `skills/modo-breve.md`.
- Sin evidencia de un comando real, el estado no puede ser «hecho».
- Quien construyó no revisa su propio trabajo: el revisor es un nivel fuerte distinto del que
  construyó (otra sesión u otro host; si no hay, revisa la persona).
