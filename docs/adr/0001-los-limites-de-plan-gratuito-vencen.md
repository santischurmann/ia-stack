# ADR 0001: Los límites de plan gratuito son un dato con fecha de vencimiento

**Date:** 2026-09-14
**Status:** Accepted

---

## Context

La matriz de stacks recomienda servicios, y una recomendación sin el costo de escalarla es media
recomendación. El research del 2026-09-14 midió los límites de plan gratuito de ocho proveedores y
encontró dos cosas que obligan a decidir cómo se guarda ese dato.

La primera: el disparador que saca a un proyecto del plan gratuito casi nunca es un número. La
cláusula de uso comercial de un proveedor no tiene contador, ni alerta, ni barra de consumo — es un
evento binario y silencioso. La firma de código en Windows exige un token físico desde junio de 2023,
y la opción económica de Microsoft está limitada por región. Guardar sólo cupos numéricos dejaría
afuera justo lo que rompe a la gente.

La segunda: ese dato envejece rápido y **envejece en silencio**. En la ventana de doce meses
revisada, un proveedor recortó su ancho de banda incluido veinte veces, otro duplicó las horas de
cómputo de su plan gratuito, y un tercero reintrodujo un plan que había eliminado. Un número viejo no
se ve viejo: se lee como cierto.

Este contrato viaja al proyecto de cada persona que instala el protocolo, así que no es un archivo
interno: es un formato que otros van a leer y del que van a depender.

---

## Decision

Los límites de plan gratuito se guardan en `contracts/free-tier-limits.json` con **fecha de captura
obligatoria por servicio**, y cada servicio declara además su **disparador de escalado** —el evento
concreto que saca del plan, no una condición vaga— y su **tabla de escalado** con el primer costo
real. El gate rechaza cuando la captura supera el período declarado.

El rechazo es duro: no hay aviso blando ni excedente tolerado. Quien no quiera revalidar tiene que
sacar la fila de la matriz declarándolo, no dejarla vieja.

---

## Options Considered

**Opción A — Dato fechado, con rechazo por antigüedad**
- Pros: un número vencido nunca se lee como cierto, porque el gate frena antes. Obliga a que la
  revalidación sea un acto explícito con su fecha. El disparador de escalado como campo propio hace
  visible lo que no es un número, que es justamente lo que rompe a la gente.
- Cons: un repositorio puede ponerse rojo por el mero paso del tiempo, sin que nadie haya tocado una
  línea de código. Es un modo de falla que sorprende a quien no lo espera.

**Opción B — Dato sin fecha, revalidado cuando alguien se acuerde**
- Pros: el gate nunca frena por tiempo, así que nadie se cruza con un rojo que no entiende. Menos
  campos, menos ceremonia.
- Cons: es el estado actual del problema, no una solución. Un número de 2026 se sigue leyendo igual
  en 2028, y la única forma de descubrir que caducó es que alguien lo sufra. El research ya mostró
  que estos planes se mueven varias veces por año.

**Opción C — Consultar el límite en vivo cuando se necesite**
- Pros: siempre al día por construcción, sin fechas ni revalidación manual.
- Cons: obliga a un gate que sale a la red, lo que rompe dos propiedades del protocolo a la vez —
  cero dependencias y ningún gate que dependa de un servicio externo para dar verde. Además, los
  límites viven en páginas de marketing sin API estable, así que habría que parsear HTML ajeno y
  cada rediseño del proveedor rompería el gate.

**Opción D — Sólo enlazar a la documentación oficial, sin guardar números**
- Pros: nunca caduca, porque el enlace apunta al dato vivo.
- Cons: la recomendación deja de ser comparable. Elegir entre stacks exige poner los cupos uno al
  lado del otro, y mandar a la persona a leer ocho páginas de precios es exactamente el trabajo que
  la matriz viene a ahorrar.

**Chosen:** Opción A
**Reason:** Es la única que impide el modo de falla más caro de los cuatro, que es un número falso
leído como cierto. Las otras tres lo permiten: B lo permite por omisión, C lo cambia por una
dependencia de red que el protocolo no puede aceptar, y D lo evita al precio de no responder la
pregunta. El costo de A —un rojo por paso del tiempo— es visible, tiene un mensaje que explica qué
pasó, y se resuelve revalidando, que es el trabajo que había que hacer igual.

---

## Consequences

**Qué se vuelve más fácil.** Una recomendación de stack pasa a incluir su costo de escalar, con la
fecha en que se verificó, y eso se puede auditar sin volver a investigar. Un número que caducó deja
de ser indistinguible de uno vigente. Y el campo de disparador obliga a escribir lo que de otro modo
nadie escribe: que perder el plan gratuito casi nunca es cruzar un cupo.

**Qué se vuelve más difícil.** El repositorio adquiere un modo de falla nuevo y poco habitual: puede
ponerse rojo sin que nadie haya cambiado nada, sólo porque pasó el tiempo. Alguien que clone el
proyecto meses después se va a encontrar con ese rojo antes de entender de dónde sale, así que el
mensaje del gate tiene que decir con todas las letras que la causa es la antigüedad y no un defecto.
Y aparece una obligación de mantenimiento recurrente que antes no existía: revalidar contra
documentación oficial, que no se puede automatizar sin salir a la red.

**Deuda técnica que se introduce.** El período de vencimiento es un número que todavía no se midió:
sale del research y no de una preferencia, pero hasta que se mida queda como una constante elegida.
Está anotado como pregunta abierta del expediente de Intake. Y el gate no puede comprobar que los
números sean ciertos, sólo que estén declarados y fechados: un contrato con cifras inventadas y
fecha de hoy pasa en verde, y ese límite se declara como honesto en vez de taparse.
