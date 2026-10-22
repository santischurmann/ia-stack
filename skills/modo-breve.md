---
name: ia-stack-modo-breve
description: |
  ES: Modo breve, el caveman interno de IA Stack. Cómo se escribe entre agentes para no pagar dos veces cada palabra. Sin plugins ni repositorios externos.
  EN: Terse mode, IA Stack's built-in caveman. How agents write to each other so every word isn't paid twice. No external plugin or repository.
---

# Modo breve (caveman interno)

**Por qué existe.** Todo lo que un agente escribe vuelve a pagarse en cada mensaje siguiente,
porque viaja en el contexto. Medido entre el 12 y el 15-10-2026 en los proyectos del operador: el
75 % del consumo venía de mensajes con más de 300.000 tokens de contexto, y la mitad de los
mensajes eran avisos de menos de 150 tokens que no decían nada nuevo. El estilo telegráfico lo daba
un plugin externo; ahora es parte del protocolo y no se instala nada.

**No hay que leer este archivo para usarlo.** Las dos reglas que importan van adentro de la
plantilla de cada subagente (`skills/orchestrator-opus.md` § DELEGATION PATTERN, bloque
`## MODO BREVE`). Esto es la referencia completa.

## Dónde rige, siempre

- Reportes de subagente al orquestador.
- Handoffs (`.vibe/handoffs/`) y líneas de `.vibe/SESSION.md` y `.vibe/AUDIT.md`.
- Notas internas y encargos de un agente a otro.

## Cómo

- Sin relleno: nada de saludos, «claro», «básicamente», «como pediste», ni repetir el encargo.
- Fragmentos, sí. Primero el resultado, después el porqué si no es obvio.
- Nombres técnicos exactos, rutas con `archivo:línea`, errores citados tal cual.
- Patrón: `[cosa] [qué pasó] [por qué]. [próximo paso].`
- `NOTES` del reporte: hasta 80 palabras.
- `EVIDENCE`, `NOT_REVIEWED` y una falla **nunca** se comprimen: van enteros. Si pasan de 4.096
  bytes, va el final en línea y la ruta al archivo con la salida completa.

## Dónde no rige, nunca

- **Hacia la persona manda el lenguaje simple**: breve, pero cada término técnico explicado la
  primera vez que aparece. El estilo breve nunca recorta una explicación.
- Menús de decisión, advertencias de seguridad y confirmaciones de algo que no se puede deshacer:
  ahí una frase cortada se puede leer al revés.
- Código, mensajes de commit y documentación que va a leer otra persona.

## Límite honesto

Esto fija cómo se escribe, no cuánto se piensa: un agente breve puede estar igual de equivocado. Lo
comprueba `tests/protocolo-economico.test.mjs`, que mira que la plantilla traiga el bloque y que
ningún documento vivo invoque un plugin externo; no puede ver si el agente lo cumplió.
