# Fase 2 · Diagnóstico CAIO

## Para qué
Decidir qué conviene programar, qué conviene resolver con IA puntual y qué conviene dejar manual.
Se hace antes de elegir tecnología.

## Entra
- `docs/pedido.md` aprobado.
- Sólo en tamaño grande. En chico y medio esta fase se saltea.

## Pasos
1. Listá los procesos que toca el pedido, uno por línea.
2. Por cada proceso respondé tres preguntas:
   - ¿Se repite?
   - ¿Tiene una regla o fórmula clara?
   - ¿Qué volumen maneja?
3. Dá un veredicto por proceso: código a medida, código con IA puntual, o queda manual.
   Si dos veredictos son razonables, usá `skills/brainstorm-egm.md`: tres alternativas y la
   persona elige.
4. Clasificá cada hallazgo en una de cuatro cajas:
   - observado: lo viste en un archivo, un dato o una prueba;
   - hipótesis: algo que creés pero no comprobaste;
   - inferencia: lo que se deduce de lo observado;
   - dato faltante: lo que hay que preguntar.
5. Los datos faltantes van en una sola tanda de preguntas a la persona.
6. Escribí `docs/caio.md` con `templates/caio.md`.

## Entrega
`docs/caio.md`: tabla de procesos con veredicto, y los hallazgos en sus cuatro cajas.

## Gate
Ninguno propio. Se aprueba junto con el research, al final de la fase 3 (aprobación 2).

## Modelo
Nivel medio.
