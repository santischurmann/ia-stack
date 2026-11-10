# Fase 9 · Cierre

## Para qué
Dejar el proyecto sin residuos y anotar lo que costó más de lo esperado.

## Entra
- Fase 8 terminada, o trabajo abandonado a propósito.
- `.ia-stack/ESTADO.md` con la cola de tareas.

## Pasos
1. Respaldo verificado antes de borrar nada: `git bundle create <carpeta-fuera-del-repo>/respaldo.bundle
   --all` y después `git bundle verify <carpeta-fuera-del-repo>/respaldo.bundle`.
2. Residuos de pruebas, en una sola llamada: `node scripts/limpiar-temporales.mjs listar --borrar`.
   Muestra cada carpeta y borra sólo las viejas; las que tienen un fuente adentro no se tocan.
   Capturas y builds de prueba que creaste, borralos nombrándolos uno por uno. Nunca fuentes ni
   archivos de la persona.
3. Cerrá los procesos y navegadores que abriste, por su PID.
4. Archivá las subsesiones terminadas. Las «en pausa» no se tocan. Lo pendiente vuelve a la cola.
5. Pasá a `.ia-stack/historial.md` lo que ya no hace falta en `ESTADO.md`.
6. Si hubo una escalada o un retrabajo (preview extra, push de corrección, reclasificación),
   anotalo: `node scripts/leccion.mjs anotar --tipo escalada|retrabajo --sintoma <t> --causa <t>
   --archivo <ruta>`. Acá sólo se anota; las repetidas se muestran en la fase 0.
7. Anotá el cierre: `node scripts/metricas.mjs cierre --retrabajos <n> --escaladas <n>`. Es una
   línea en `metricas.jsonl`.
8. Decile a la persona qué quedó hecho, qué quedó pendiente y dónde está cada cosa.

## Entrega
Una línea en `.ia-stack/metricas.jsonl` y `ESTADO.md` listo para que otra sesión retome.

## Gate
Ninguno propio. Si el cierre encuentra algo sin respaldo, no borra: pregunta.

## Modelo
Script. Nivel barato para redactar la lección.
