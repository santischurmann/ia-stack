# Fase 6 · Preview

## Para qué
Que la persona vea y toque el producto antes de que exista. Nada visible se construye sin esta
aprobación.

## Entra
- `docs/spec.md` en borrador.
- `docs/marca.md` y sus tokens, o los tokens del proyecto en tamaño medio.

## Pasos
1. Armá una maqueta navegable: pantallas conectadas entre sí, con la marca aplicada y datos de
   ejemplo. Sin lógica real ni base de datos. Si no hay pantallas, el preview es el contrato: la
   API, el esquema de datos o una salida de ejemplo.
2. Abrila, recorré cada pantalla y anotá en `.ia-stack/ESTADO.md` cuáles recorriste.
3. Mostrásela a la persona y pedí cambios por pantalla, no en general.
4. Aplicá los cambios. Máximo 3 rondas de preview. En la tercera, ofrecé estas salidas:
   - aprobar con pendientes anotados;
   - volver a la fase 5 o a la 1;
   - cortar el proyecto.
5. En tamaño grande, corré el panel EGM sobre el preview (`skills/brainstorm-egm.md`) y
   registrá cada ronda con `node scripts/metricas.mjs egm --pieza preview ...`.
6. Cada ronda extra de preview es retrabajo: `node scripts/leccion.mjs anotar
   --tipo retrabajo --sintoma <t> --causa <t> --archivo <ruta>` la anota.
7. Pedí la aprobación 4: que la persona escriba **«apruebo preview v1»** (v2 si hubo otra versión).
   El hook `node scripts/aprobar.mjs hook` la registra. Sin hook: `node scripts/aprobar.mjs registrar
   --tipo preview --ref v1 --texto "<lo que escribió>"`.
8. Congelá la spec: marcala como aprobada y anotá la versión del preview en `ESTADO.md`.

## Entrega
Preview aprobado y spec congelada. Si más tarde cambia el tamaño, la spec sube de versión y se
reaprueban sólo las pantallas afectadas.

## Gate
Gate 3 (preview aprobado): `node scripts/verify-aprobacion-humana.mjs preview
.ia-stack/APROBACIONES.md --pieza preview --version <vN>`. En tamaño grande, además:
`node scripts/verify-egm-convergencia.mjs check --pieza preview --tamano grande`. Gate protegido.

## Modelo
Nivel medio.
