# Brainstorming y EGM

Dos rondas de pensamiento que el método trae incorporadas. No dependen de ningún plugin: si el
host tiene agentes EGM instalados se usan; si no, subagentes genéricos con el encargo de abajo.

## Brainstorming: abrir antes de elegir

Lo hace la sesión principal, sin subagentes.

**Cuándo:** sólo cuando hay al menos dos opciones razonables: fase 1 (enfoques del pedido), fase 2
(qué automatizar), fase 5 (alternativas de tecnología) y cuando se cambia el propio protocolo. Si la
decisión es obvia, se dice en una línea y se sigue.

**Cómo:**
1. Tres alternativas que difieran de verdad: **mínima**, **equilibrada** y **ambiciosa**.
2. Cada una con costo (tiempo y cupo), riesgo y qué deja afuera.
3. Se marca la recomendada y se dice por qué en una línea.
4. La persona elige una o mezcla. La elección va a `docs/pedido.md` o a la spec.

Una ronda. La segunda sólo si la persona la pide.

## EGM: que lo lea alguien que no sabe nada

Elephant Goldfish Model. El autor (elefante) recuerda todo el contexto y por eso no ve lo que
falta en el papel. Los lectores (goldfish) reciben **sólo el documento** y dicen qué no se
entiende, qué sobra y qué no se puede construir.

**Cuándo:** fase 5 sobre la spec; fase 6 sobre el preview, sólo en tamaño grande; y cada vez que
se cambia el propio protocolo.

**Panel según tamaño:**

| Tamaño | Lectores | Modelo |
|---|---|---|
| chico | no corre | — |
| medio | comprensión, alcance | barato, medio |
| grande | comprensión, alcance, implementación, diseño | barato, medio, medio, medio |

El lector de diseño sube a nivel fuerte sólo si hay un área de riesgo.

**Qué mira cada lector:**
- **Comprensión:** términos sin explicar, pasos donde no sabría qué hacer, cifras que no cierran.
- **Alcance:** qué sobra, qué se puede fusionar, qué promete de más.
- **Implementación:** decisiones sin definir, criterios que no se pueden medir, dependencias que pueden no existir.
- **Diseño:** contradicciones, huecos donde algo falla sin salida, riesgos de lo que se saca.

**Encargo a cada lector** (se copia tal cual, cambiando rol y ruta):

> Leé sólo `<ruta>`. No leas otros archivos. Sos el lector de `<rol>`. Reportá en 25 líneas o
> menos, una por hallazgo: severidad (alta, media, baja), sección, problema y arreglo concreto.
> Sin elogios. Si no hay hallazgos altos, decilo en la primera línea.

**Qué hace el autor:** resuelve cada hallazgo. Lo aplica, o lo descarta con el motivo en una línea.

**Cuándo termina:**
- Converge cuando una ronda no deja hallazgos altos.
- Máximo 2 rondas. La segunda usa lectores nuevos y sólo corre si quedaron altos.
- Si después de la segunda quedan altos, decide la persona.

**Registro:** por ronda, `node scripts/metricas.mjs egm --pieza <nombre> --lectores <n> --ronda <n>
--altos <n> --medios <n> --bajos <n>`. Si decide la persona, sumá `--decide-persona`.

**Comprobación:** `node scripts/verify-egm-convergencia.mjs check --pieza <nombre> --tamano <medio|grande>` lee ese registro; no sabe si el lector leyó el documento.
