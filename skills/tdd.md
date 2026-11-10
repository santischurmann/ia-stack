# TDD: rojo, verde, limpio

Sin test rojo visible no hay código. Sin excepciones.

## El orden
1. **Rojo.** Escribí la prueba de un criterio de aceptación. Corrala. Tiene que fallar porque
   falta la implementación, no por un error de sintaxis ni de configuración.
2. **Verde.** Escribí el código mínimo que la pasa. Nada de más.
3. **Bordes.** Agregá los casos que el criterio implica: vacío, repetido, límite, error.
4. **Limpio.** Simplificá sin cambiar la conducta. Las pruebas siguen en verde.
5. **Commit local** de la tarea, con un mensaje en español (`feat(...)`, `fix(...)`).

Una prueba por criterio, con el id del criterio en el nombre. Un cambio de comportamiento
siempre empieza por una prueba nueva o modificada.

## Mostrar el rojo
```
node scripts/verify-red.mjs check --test <archivo-de-prueba> --command "<runner>"
```
- El gate no acepta cualquier salida distinta de cero. Rechaza: prueba que pasa, runner roto o
  ausente, errores de sintaxis, «no se encontraron pruebas» y salidas sin evidencia de un fallo real.
- Runners con adaptador: Node (`node --test`), Vitest y pytest. Los dos últimos dan una garantía
  menor que el nativo y así está declarado.
- El hook `scripts/pretooluse-red.mjs` bloquea escribir código de producción sin un rojo
  registrado para la tarea. Se emite con `node scripts/pretooluse-red.mjs emit --feature <slug>
  --task <id> --tests <a,b> --files <src/a.js> --command "node --test"`.

## Reglas
- Después del rojo, la prueba no se toca. Si hay que cambiarla, se vuelve a mostrar el rojo.
- Nunca aflojes una prueba, una compuerta ni la cobertura para que pase.
- Medí la cobertura de lo que el runner mida (líneas, ramas, funciones). Si no mide una, anotá la
  limitación real: no la declares cubierta.
- Al terminar la tarea, comprobá el alcance:
  `node scripts/verify-scope-diff.mjs check --tasks docs/tasks.json --task <id> --base HEAD`.
- Reproducir antes de diagnosticar: un bug empieza con una prueba roja que lo reproduce.

## Si falla
- Ver Escalada en `SKILL.md`. El rojo buscado del paso 1 no cuenta como falla.
- Si la sesión se corta, retomá así: leé `.ia-stack/ESTADO.md`, corré las pruebas de la tarea
  (fallan: falta el verde; pasan: falta el limpio) y revisá `git diff` de las pruebas.
