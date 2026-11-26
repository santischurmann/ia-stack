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
2. Tarea de clase `alto_requisito` o en área de riesgo (la clase sale de su `description` con
   `scripts/clasificar-tarea.mjs`): ronda de brainstormings del diseño y EGM sobre su plan, es decir
   su fila de `docs/plan.md`, su entrada de `docs/tasks.json` y la spec que toca (en chico, `pedido.md`)
   (`skills/brainstorm-egm.md`), registrada con `--pieza plan-<id>`. Siempre nivel fuerte; una por
   tarea, no por paso. Si el presupuesto no alcanza, la tarea pasa a «en pausa» en la cola de
   `ESTADO.md` con el motivo y las demás siguen: la ronda no se recorta.
3. Antes del primer rojo, corré `node scripts/verify-aprobacion-humana.mjs tareas docs/tasks.json
   .ia-stack/APROBACIONES.md`. Mira todas las tareas: frena si una visible no tiene pieza aprobada o si
   una de alto requisito no tiene el EGM de `plan-<id>` convergido. Si `ESTADO.md` no declara el tamaño, sumá
   `--tamano <chico|medio|grande>`. La ronda de 5 pasos no la verifica ningún script.
4. Agrupá las tareas. Cada grupo puede ir a una subsesión con un encargo (`skills/encargo.md`),
   revisado con `node scripts/verify-brief-size.mjs check <encargo.md>`.
5. Por cada tarea seguí el orden de `skills/tdd.md`: rojo, verde, bordes, limpio, alcance y commit local.
6. Si el diff real excede el tamaño fijado, frená: reclasificá con `node scripts/tamano.mjs --diff
   <base>`, subí la versión de `pedido.md`, o de `spec.md` si existe, y anotá el retrabajo con
   `node scripts/leccion.mjs anotar --tipo retrabajo --sintoma <t> --causa <t> --archivo <ruta>`.
   Si el tamaño nuevo suma fases o rondas, se hacen antes de seguir.
7. Si una prueba falla, ver Escalada en `SKILL.md`.
8. Al terminar un grupo, archivá la subsesión y actualizá `ESTADO.md`.

## Entrega
Código y pruebas en commits locales. Nada se publica todavía.

## Gate
Gate 1 (test rojo visto antes del código): `node scripts/verify-red.mjs check` y el hook
`scripts/pretooluse-red.mjs`. Gate 2 (el diff toca sólo lo de la tarea):
`node scripts/verify-scope-diff.mjs check`. Gate 3 por tarea: el paso 3. El gate 1 está protegido.

## Modelo
Medio para rojo, verde y limpio (roles `red`, `green` y `refactor`); barato sólo para edición mecánica
y documentación; fuerte en alto requisito o área de riesgo. Sube un nivel por falla.
