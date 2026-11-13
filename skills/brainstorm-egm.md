# Brainstorming y EGM

Rondas de pensamiento que el método trae incorporadas. Son nativas: no dependen de ningún plugin;
las hace un subagente genérico con los encargos de abajo.

## Brainstorming simple: abrir antes de elegir

Lo hace la sesión principal, sin subagentes, cuando hay al menos dos opciones razonables: fase 1
(enfoques del pedido), fase 2 (qué automatizar), fase 5 (alternativas de tecnología). Si la decisión
es obvia, se dice en una línea y se sigue.
1. Tres alternativas que difieran de verdad: **mínima**, **equilibrada** y **ambiciosa**.
2. Cada una con costo (tiempo y cupo), riesgo y qué deja afuera.
3. Se marca la recomendada y por qué, en una línea. La persona elige; va a `docs/pedido.md` o a la spec.

## Ronda de brainstormings: 5 pasos fijos

Regla fija. Siempre nivel fuerte (Opus, `low`): es la excepción al «modelo más barato que resuelva
bien» (`contracts/model-routing.json` § rondas, rol `ronda_brainstorm_egm`).

**Cuándo:** sola, en las fases de `rondas.fases` del contrato (2, 4, 5, 7 por cada tarea de alto
requisito, 8) y al cambiar el propio protocolo; además, cuando la persona la pide. Chico no la corre,
salvo la de una tarea de alto requisito.

**Cómo:** un subagente por paso, en este orden y sin saltear. Cada paso recibe la salida del
anterior. Los pasos 2 y 4 atacan y no elogian. Se aplica lo hallado; no se resume.

```
paso: 1 brainstorming
paso: 2 adversarial
paso: 3 brainstorming
paso: 4 adversarial
paso: 5 brainstorming final
```

**Encargo de cada paso** (se copia y se completa):

```
paso: <n y nombre, de la lista de arriba>
entrada: <ruta del documento, o la salida del paso anterior pegada entera>
entrega: <brainstorming: propuesta completa y corregida | adversarial: fallas, una por línea,
         con severidad, lugar y arreglo concreto; sin elogios>
```

## EGM: que lo lea alguien que no sabe nada

Elephant Goldfish Model. El autor (elefante) recuerda todo el contexto y no ve lo que falta en el
papel. Los lectores (goldfish) reciben **sólo el documento**, ya corregido por la ronda anterior.

**Lectores por ronda:** medio 2 (comprensión y alcance; implementación y diseño); grande 4 (uno por
rol); una tarea de alto requisito, 2 como mínimo aun en chico. Siempre nuevos en cada ronda.
- **Comprensión:** términos sin explicar, pasos donde no sabría qué hacer, cifras que no cierran.
- **Alcance:** qué sobra, qué se puede fusionar, qué promete de más.
- **Implementación:** decisiones sin definir, criterios que no se pueden medir, dependencias dudosas.
- **Diseño:** contradicciones, huecos donde algo falla sin salida, riesgos de lo que se saca.

**Encargo a cada lector** (se copia tal cual, cambiando rol y ruta):

> Leé sólo `<ruta>`. No leas otros archivos. Sos el lector de `<rol>`. Reportá en 25 líneas o
> menos, una por hallazgo: severidad (alta, media, baja), sección, problema y arreglo concreto.
> Sin elogios. Si no hay nada que corregir, decí «LIMPIA».

**Qué hace el autor:** resuelve cada hallazgo. Lo aplica, o lo descarta con el motivo en una línea.

**Cuándo termina**, según la pieza (`rondas.egm` del contrato):

| Pieza | Lectores | Rondas | Converge |
|---|---|---|---|
| `spec`, `plan-<id>`, `publicar`, `protocolo` | nivel fuerte | 5 a 10 | una ronda limpia: ningún hallazgo aplicado |
| piezas simples (`preview`, sólo en grande) | barato y medio | hasta 2 | una ronda sin hallazgos altos |

Mínimo 5 rondas: si la quinta trae algo, se sigue hasta una limpia. Si la décima (o la segunda, en las piezas
simples) no converge, decide la persona.

**Registro:** por ronda, `node scripts/metricas.mjs egm --pieza <nombre> --lectores <n> --ronda <n>
--altos <n> --medios <n> --bajos <n>`, contando sólo los hallazgos aplicados. Si decide la persona,
sumá `--decide-persona`. Una pieza rehecha vuelve a empezar en `--ronda 1`.

**Comprobación:** `node scripts/verify-egm-convergencia.mjs check --pieza <nombre> --tamano
<chico|medio|grande>` lee ese registro; no sabe si el lector leyó el documento ni qué modelo era.
