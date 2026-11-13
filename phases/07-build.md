# Fase 7 · Construir

## Para qué
Convertir la spec en código que funciona, de a una tarea, siempre con la prueba roja primero.

## Entra
- `docs/spec.md` congelada, o `docs/pedido.md` en tamaño chico.
- Preview o boceto aprobado, si hay pantallas.

## Pasos
1. Escribí `docs/plan.md` con `templates/plan.md`: una tarea por fila, con su prueba y el nivel de
   modelo. Los archivos de cada tarea van en `docs/tasks.json` (`templates/tasks.json`); el campo
   `preview` de cada una dice la pieza aprobada (`preview`, `boceto`) o «no-aplica: <motivo>».
2. Antes del primer rojo, corré `node scripts/verify-aprobacion-humana.mjs tareas docs/tasks.json
   .ia-stack/APROBACIONES.md`. Si una tarea visible no tiene pieza aprobada, frena.
3. Agrupá las tareas. Cada grupo puede ir a una subsesión con un encargo (`skills/encargo.md`),
   revisado con `node scripts/verify-brief-size.mjs check <encargo.md>`.
4. Por cada tarea seguí el orden de `skills/tdd.md`: rojo, verde, bordes, limpio, alcance y commit local.
5. Antes de una suite o un build, medí la RAM y el disco libres.
6. Si el diff real excede el tamaño fijado, frená: reclasificá con `node scripts/tamano.mjs --diff
   <base>`, subí la versión de `pedido.md`, o de `spec.md` si existe, y anotá el retrabajo con
   `node scripts/leccion.mjs anotar --tipo retrabajo ...`.
7. Si una prueba falla, ver Escalada en `SKILL.md`.
8. Al terminar un grupo, archivá la subsesión y actualizá `ESTADO.md`.
9. Tarea de clase `alto_requisito` o en área de riesgo: ronda de brainstormings del diseño y EGM sobre su plan, antes del rojo (`skills/brainstorm-egm.md`). Siempre Opus; una por tarea, no por paso.

## Entrega
Código y pruebas en commits locales. Nada se publica todavía.

## Gate
Gate 1 (test rojo visto antes del código): `node scripts/verify-red.mjs check` y el hook
`scripts/pretooluse-red.mjs`. Gate 2 (el diff toca sólo lo de la tarea):
`node scripts/verify-scope-diff.mjs check`. Gate 3 por tarea: el paso 2. El gate 1 está protegido.

## Modelo
Nivel barato por defecto, medio para pruebas y pantallas. Sube un nivel por falla.
