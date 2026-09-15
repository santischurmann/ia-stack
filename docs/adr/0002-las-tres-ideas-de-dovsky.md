# ADR 0002: Las tres ideas de dovsky, decididas una por una

**Date:** 2026-09-15
**Status:** Accepted

---

## Context

El 2026-09-14 se comparó IA Stack contra [`quant-dhawan/dovsky`](https://github.com/quant-dhawan/dovsky),
un plano de control local para correr agentes: demonio, SQLite, sandbox de bubblewrap, aceptación
humana explícita. La comparación encontró y cerró cuatro defectos —dos de seguridad— y dejó **tres
ideas medidas y no adoptadas**, con una nota que decía que eran cambios de arquitectura y no de gate,
y que **merecían una decisión aparte**. Este ADR es esa decisión.

**Los dos proyectos resuelven el mismo problema desde extremos opuestos**, y eso es lo que hace útil
la comparación. IA Stack es un protocolo que el agente sigue, y sus gates verifican artefactos sobre
el árbol que el propio agente controla. dovsky es un runtime que **aísla** al agente y sólo aplica el
delta capturado después de que los gates del anfitrión pasan. No es que uno confíe y el otro no: es
que uno pone la verificación *adentro* del perímetro del agente y el otro *afuera*.

Dejar las tres juntas en una línea de `SESSION.md` las trataba como si fueran la misma clase de cosa.
No lo son: **una era un defecto con arreglo barato, otra estaba medio hecha, y la tercera es una
arquitectura distinta.**

---

## Decision

### 1. Prueba de vida del candado — **adoptada**

`tasks.json` marca `locked: true` y `owner` con la forma `rol-fecha` antes de despachar una tarea, y lo
suelta al pasar el gate. **Si la sesión muere en el medio, el candado queda puesto para siempre**, y
`owner` no prueba nada: es un rol y una fecha. La sesión siguiente no puede distinguir «alguien está
trabajando en esto» de «esto lo dejó un proceso muerto», así que o rompe el trabajo de otro o se
queda trabada. Las dos salidas son malas, y hoy no había ningún dato con el cual elegir.

**No es hipotético: pasó acá.** El 2026-09-15 se mataron decenas de corridas de la suite en esta
misma máquina, y cada una de ésas habría dejado un candado fantasma si hubiera estado despachando.

Se adoptó el mecanismo de dovsky —PID más identificador de arranque— en `verify-lock-vivo.mjs`, con
**tres estados y no dos**:

| Estado | Qué significa | Qué hacer |
|---|---|---|
| `vivo` | el proceso existe en esta máquina y en este arranque | no se toca |
| `muerto` | otro arranque, o el proceso ya no está | el candado es un fantasma: se suelta |
| `reconcile_required` | no se puede probar ninguna de las dos | lo decide una persona |

**El tercero es el que hace que esto sirva.** Un gate de dos estados tendría que adivinar, y las dos
adivinanzas son destructivas: suponer muerto suelta el candado de alguien que está trabajando,
suponer vivo deja el repositorio trabado para siempre.

**El `boot` es lo que un PID solo no puede contestar.** Un PID se reusa: después de reiniciar, el
4242 es otro programa, y preguntar «¿existe el 4242?» diría «sí, vivo» sobre un candado de hace tres
días. Ese es exactamente el verde falso que el gate viene a impedir.

**Lo que no cubre, y por eso el tercer estado existe**: dentro del mismo arranque, un PID reusado es
indistinguible del original sin la marca de tiempo de inicio del proceso —los *start ticks* que
dovsky guarda—, que Node no expone de forma portable: en Linux sale de `/proc`, en Windows hace falta
otra herramienta, y este protocolo no agrega dependencias. Declarado como límite honesto.

### 2. Aceptación humana con el árbol revalidado — **mitad ya estaba, mitad declinada**

La idea son dos cosas distintas y conviene separarlas, porque tienen respuestas opuestas.

**El árbol revalidado contra la evidencia ya estaba, y tiene prueba.** El receipt lleva
`tree_fingerprint`, y `verify-receipt.mjs` lo compara contra el estado evaluado vivo: si algo cambió
—staged, sin stagear o sin rastrear— entre que se escribió el receipt y el momento de publicar, sale
`stale receipt: tree_fingerprint does not match current evaluated state` y LAW 8 bloquea el push. No
hay nada que traer.

**Exigir mecánicamente que una persona haya aceptado no se adopta, y la decisión es del operador.**
El registro de fase guarda el menú y la opción elegida, y su propio límite lo dice con todas las
letras: *«esto verifica el registro, no la voluntad. No demuestra que una persona haya leído ese menú
ni querido esa opción — un registro coherente e inventado pasa igual.»* Cerrar ese hueco de verdad
pide un canal fuera del alcance del agente: una firma, una llave, una interfaz que el agente no pueda
escribir. Se propuso durante esta comparación y **el operador lo rechazó con el motivo escrito**:

> *«siento que esto esta complicando mas el trabajo de lo que lo resuelve. No se como se manejarian
> las llaves, revisiones, permisos, etc. Solo quiero que se usen best practices para realmente hacer
> un mejor trabajo»*

Es una decisión defendible y no una omisión: una ceremonia de firmas que nadie sabe operar produce
**la apariencia** de aceptación humana, que es peor que un límite declarado. El hueco queda abierto y
escrito.

### 3. Aislamiento del agente con aplicación de delta — **no se adopta**

dovsky corre al agente adentro de un sandbox (bubblewrap), captura el delta que produjo, y lo aplica
al árbol real recién después de que los gates del anfitrión pasan. El agente nunca escribe sobre lo
que se va a publicar.

**Es genuinamente más fuerte que lo que IA Stack hace**, y conviene decirlo sin adornos: acá los
gates corren sobre el árbol que el propio agente controla, así que un agente que quisiera engañarlos
tiene, en principio, cómo. El protocolo ya lo declara —el hook de `PreToolUse` dice textualmente que
no es un sandbox ni un límite de confianza, y que Bash y cualquier proceso que escriba en el mismo
filesystem pueden eludirlo.

No se adopta por tres razones, en orden de peso:

1. **Es otra arquitectura, no una pieza.** Pide un demonio, un sandbox y un mecanismo de aplicación
   de deltas. IA Stack es una skill de una sesión, sin servidor, sin planificador y sin proceso
   propio; el propio documento ya declara eso como fuera de alcance.
2. **El sandbox no es portable.** bubblewrap es de Linux. Este protocolo se usa en Windows, y una
   garantía que sólo vale en un sistema operativo es una garantía que hay que explicar cada vez.
3. **Cambiaría a quién protege el protocolo.** IA Stack asume un agente que coopera y falla —que se
   apura, que afirma sin medir, que se olvida— y sus gates existen para atrapar **eso**. Aislar al
   agente protege contra uno que miente a propósito. Es un modelo de amenaza distinto, y adoptarlo a
   medias —sandbox sin demonio, delta sin captura— daría la sensación de la garantía sin la garantía.

**Si algún día se adopta, se adopta entero o no se adopta.** Media caja de arena es peor que ninguna,
porque se declara.

---

## Options Considered

La decisión de fondo no era idea por idea, sino **cómo tratarlas**. Las tres venían juntas en una
línea, y esa forma de anotarlas era parte del problema.

**Opción A — Decidir una por una, con el veredicto que a cada una le corresponda** *(elegida)*
- Pros: las tres son de clases distintas —un defecto barato, algo medio hecho, y otra arquitectura— y
  tratarlas igual obliga a un veredicto único que ninguna de las tres merece. Separarlas dejó ver que
  una ya estaba implementada y nadie lo había mirado.
- Cons: cuesta más que una línea, y produce un documento que hay que mantener.

**Opción B — Adoptarlas las tres**
- Pros: cierra los tres huecos, y el de aislamiento es el más grande que tiene el protocolo.
- Cons: el aislamiento pide un demonio y un sandbox que sólo existe en Linux, cuando este protocolo
  se usa en Windows. Y la aceptación humana mecánica ya se había propuesto en esta misma comparación
  y el operador la rechazó con su motivo. Adoptar sobre un «no» explícito no es diligencia: es no
  escuchar.

**Opción C — Dejarlas anotadas como estaban**
- Pros: cero trabajo, y la nota ya existía.
- Cons: es el estado que se venía arrastrando. Una lista de «no adoptadas» sin veredicto se relee cada
  seis meses y cuesta lo mismo cada vez, porque nadie sabe si se descartaron o si están pendientes. Y
  en este caso escondía un dato: **una de las tres ya estaba implementada**, y la nota decía que no.

---

## Consequences

- Hay un gate nuevo, `verify-lock-vivo.mjs`, y `tasks.json` gana un campo `lock` opcional. **Un plan
  viejo no se rompe**: un candado sin `lock` da `reconcile_required`, que es la respuesta honesta
  para algo escrito antes de que esto existiera.
- El protocolo sigue **sin** poder probar que una persona aceptó, y sigue diciéndolo.
- El protocolo sigue **sin** aislar al agente, y sigue diciéndolo.
- La nota de `SESSION.md` que decía «tres ideas no adoptadas» queda reemplazada por este ADR: una
  adoptada, una mitad ya estaba y mitad declinada con motivo, y una rechazada con tres razones.
