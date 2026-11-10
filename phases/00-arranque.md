# Fase 0 · Arranque

## Para qué
Saber dónde estás antes de hacer nada: en qué fase quedó el trabajo, cuánto cupo hay y qué
sesiones quedaron colgadas.

## Entra
- `.ia-stack/ESTADO.md`, si el proyecto ya corrió el método.
- Nada más. No leas las otras fases todavía.

## Pasos
1. Corré `node scripts/arranque.mjs [--ventana <pct>] [--semana <pct>]`. Lee `ESTADO.md`, el cupo
   y las sesiones huérfanas, y te devuelve 5 líneas. `--ventana` y `--semana` son el porcentaje
   usado que informa el host (`get_usage`); si no lo informa, se omiten.
2. Si no hay `.ia-stack/ESTADO.md`, es un proyecto nuevo: copiá `templates/estado/` a `.ia-stack/`.
   Si además el cupo es «desconocido» y no hay `.ia-stack/plan.json`, preguntá el plan una vez
   (`contracts/planes.json` lista las opciones) y guardalo. El cupo no se estima nunca.
3. Si el script avisa huérfanas, archivalas. Las «en pausa» no se tocan.
4. Mostrá las lecciones repetidas: `node scripts/leccion.mjs repetidas --dias 30`. Si hay,
   preguntale a la persona cuál pasa a regla y qué regla sale a cambio. Es el único lugar donde
   se muestran.
5. Anotá el bloque (`node scripts/metricas.mjs bloque --fase 0 --modelo <modelo>`) y decile a la
   persona en una línea dónde quedó el trabajo y cuál es el paso siguiente.

## Entrega
5 líneas: fase, tamaño, cupo, huérfanas y paso siguiente. No se escribe ningún documento.

## Gate
Gate 6 (cupo y contexto): `node scripts/context-guard.mjs` corre como hook del mensaje y avisa al
70 % del contexto. Al 85 % de la ventana de 5 h se frena todo lo que no sea la tarea en curso.

## Modelo
Script. Si hay que leer algo a mano, nivel barato.
