# Modo breve

Todo lo que un agente escribe se vuelve a pagar en cada mensaje siguiente, porque viaja en el
contexto. Entre agentes se escribe corto. Hay un solo nivel.

## Dónde rige
- Reportes de un subagente al orquestador.
- Encargos de un agente a otro.
- Notas internas y líneas de `.ia-stack/ESTADO.md`, `historial.md` y `LECCIONES.md`.

## Cómo
- Sin saludos, sin relleno, sin repetir el encargo.
- Fragmentos sí. Primero el resultado, después el porqué si no es obvio.
- Nombres técnicos exactos, rutas con `archivo:línea`, errores citados tal cual.
- Patrón: `[cosa] [qué pasó] [por qué]. [próximo paso].`
- **Un solo umbral: todo reporte, hasta 40 líneas.** Lo que no entra va a
  `.ia-stack/handoffs/<tarea>.md` y se cita la ruta.
- La evidencia, lo que no se revisó y las fallas nunca se comprimen: van enteras. Si son largas,
  en el reporte va el final y la ruta al archivo con la salida completa.

## Lenguaje normal, nunca breve
- **Código:** identificadores, comentarios y mensajes de error.
- **Commits y documentación** que va a leer otra persona.
- **Seguridad:** advertencias, hallazgos y todo lo que explica un riesgo.
- **Acciones irreversibles:** borrar, publicar, pushear, gastar o sobrescribir, y los menús de decisión.

Hacia la persona: frases simples y cada término técnico explicado la primera vez.

## Límite
Esto fija cómo se escribe, no cuánto se piensa. Un agente breve puede estar igual de equivocado.
