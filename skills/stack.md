# Elegir stack — la matriz por tipo de producto

**Qué es.** La respuesta a la novena pregunta del Intake (`tipo_de_producto`, enum `A`–`H`) no
sirve de nada si nadie la lee. Este archivo es el paso que la lee: entra un código de tipo, sale
**un stack recomendado, de qué fuente sale, de qué fecha es, y qué cuesta crecer**.

**Dónde vive el dato.** La canónica que leen los gates es `contracts/stack-matrix.json`; los
límites de cada plan gratuito están en `contracts/free-tier-limits.json`. Los dos viajan con el
runtime porque el instalador copia `contracts/`. En un proyecto donde el protocolo está instalado
los dos viven bajo `.vibe/ia-stack-runtime/`, así que la ruta completa es
`.vibe/ia-stack-runtime/contracts/stack-matrix.json`. **Este archivo es la copia legible para
personas**, y `tests/stack-matriz-pareada.test.mjs` comprueba que diga lo mismo que la canónica:
si editás uno solo de los dos, la suite sale roja. La tabla de abajo está *renderizada* desde el
JSON, no tipeada — si tenés que cambiar un dato, cambialo en el JSON.

**De cuándo es.** Captura del **2026-09-14**. Sale de estas fuentes pineadas:

- `research/sources/stack-web-versiones-2026-09-14.md`
- `research/sources/free-tiers-2026-09-14.md`
- `research/sources/python-y-escritorio-2026-09-14.md`
- `research/sources/adaptadores-red-2026-09-14.md`

**Cuándo vence.** `contracts/free-tier-limits.json` declara su propio período en `max_age_days`
(hoy **90 días**, revalidado el **2026-09-14**). Pasado ese plazo
`verify-stack-matrix.mjs` sale rojo y pide revalidar contra la documentación oficial. **Un número
de plan gratuito vencido se lee igual que uno cierto**, y por eso no se deja pasar con un aviso.

---

## Cómo se usa, fase por fase

### Fase 1.5 — INTAKE

Después de que `verify-intake.mjs` acepte el expediente, **contestá la novena pregunta con datos,
no de memoria**:

1. Buscá en la tabla la fila del código que la persona eligió.
2. Presentá el **recomendado**, y las **alternativas con su cuándo** — nunca el recomendado solo:
   una recomendación sin alternativa es una orden disfrazada.
3. Por cada plan gratuito que la fila referencia, abrí `contracts/free-tier-limits.json` y decí
   **qué evento concreto saca del plan gratuito** (`upgrade_trigger`) y **desde cuánto se paga**
   (`paid_from`, y la lista `escalation`). Esto es el «qué cuesta crecer», y es obligatorio.
4. Citá la **fecha de captura**. Si el dato venció, decilo antes de recomendar.
5. Cerrá con 🔵: adoptar el recomendado, adoptar una alternativa, o investigar el caso.

**Si la fila no referencia ningún plan gratuito**, la tabla dice por qué en su última columna. No
es un hueco: es un tipo de producto que no corre en un servicio alojado.

### Fase 2 — RESEARCH

El tipo de producto acota qué hay que investigar, no lo reemplaza. Si el ciclo elige un stack que
la matriz no tiene, **el research tiene que dejar la fuente pineada y fechada** en
`research/sources/`, y recién entonces se agrega la fila al JSON con su evidencia.

### Fase 3 — SPEC

La spec **congela** el stack elegido y el motivo. El código de tipo y el stack adoptado entran en
las restricciones, para que la fase 5 no lo vuelva a discutir tarea por tarea.

---

## La matriz

| | Producto | Stack recomendado en plan gratuito | Planes gratuitos que usa | Adaptador de test rojo |
|---|---|---|---|---|
| **A** | Sitio web o landing | HTML y CSS servidos como archivos estáticos, con un generador sólo si hay más de una docena de páginas | `cloudflare-pages` · `vercel-hobby` | ninguno — un sitio sin lógica no tiene qué probar; si aparece lógica, deja de ser tipo A |
| **B** | Aplicación web | Next.js 16.3.5 con App Router · React 19.3.0 · TypeScript 6.0.3 · Tailwind 4.3.3 · Drizzle ORM 0.45.2 sobre PostgreSQL 18 en Docker local · Better Auth 1.7.4 · Vitest 5.0.0 · Playwright 1.63.0 · Node 24 LTS | `vercel-hobby` · `neon-free` · `supabase-free` · `cloudflare-workers` · `cloudflare-d1` | vitest — garantía menor que la del adaptador nativo, declarada |
| **C** | Progressive Web App | El stack de tipo B más manifest, service worker y una estrategia de caché explícita | `vercel-hobby` · `neon-free` | vitest — garantía menor que la del adaptador nativo, declarada |
| **D** | Aplicación de escritorio o híbrida | Depende de la respuesta al criterio. Si el proceso local tiene cliente en Python: Python con interfaz web local y ventana nativa. Si no hay proceso local que integrar: Tauri 2.11.5 | — Una aplicacion de escritorio corre en la maquina de quien la usa, asi que no consume ningun plan gratuito alojado. Su costo de escalar no es un cupo sino la firma de codigo, que se trata aparte porque no es un plan de nada: es un certificado que se paga desde el primer dia si hay que distribuir el instalador a terceros. | según el lenguaje elegido: pytest o vitest, los dos con garantía menor declarada |
| **E** | Sistema Python: datos, automatización, research o IA | Python 3.14 con uv 0.12.13 · NumPy 2.5.3 · SciPy 1.18.1 · pandas 3.0.5 · PyArrow 25.0.1 · pytest · ruff · mypy. Polars 1.44.2 o DuckDB 1.5.5 sólo cuando la medición los justifique | `github-actions` | pytest — garantía menor que la del adaptador nativo, declarada |
| **F** | Integración, API, backend o proceso interno | El lenguaje que ya hable con lo que se integra, con cero dependencias si el alcance lo permite. Node 24 nativo para herramientas de línea de comandos; Python 3.14 si toca el ecosistema de datos | `github-actions` | el nativo de Node si el proceso es Node — la única garantía fuerte de las tres |
| **G** | Artefacto: documento, plan, planilla, presentación, imagen o panel | La herramienta que produzca el formato final, sin construir infraestructura alrededor | — Un artefacto se entrega una vez y no se opera, asi que no corre en ningun servicio alojado: no hay plan gratuito contra el cual medir el costo de crecer, porque no hay nada que crezca. | ninguno — sin lógica que ejecutar no hay test rojo posible, y forzarlo sería decoración |
| **H** | Otro | Sin recomendación por definición. Se investiga el caso y se registra el hueco | — Todavia no se sabe que es. Sin clasificar el caso no hay stack recomendado, y sin stack no hay servicio al cual referenciar: ese es justamente el valor de este codigo. | sin determinar hasta clasificar el caso |

> La columna del adaptador importa para LAW 1. **`pytest` y `vitest` dan una garantía menor que el
> adaptador nativo de Node** y así está declarado: los dos ejecutan código de configuración del
> proyecto con control sobre el reporte y sobre el código de salida, y los dos ataques están
> reproducidos en `research/sources/adaptadores-red-2026-09-14.md`. Un verde de adaptador débil
> **no se lee igual** que uno del nativo.

---

## Cada tipo, con su criterio y sus alternativas

### A · Sitio web o landing

**Cuándo es este.** ¿El contenido cambia sin volver a publicar? Si la respuesta es no, no hace falta base de datos ni servidor propio.

**Recomendado.** HTML y CSS servidos como archivos estáticos, con un generador sólo si hay más de una docena de páginas — Una landing sin datos propios no necesita ejecución en servidor. Los assets estáticos no consumen cuota en varios planes gratuitos y no hay nada que se pueda caer.

**Alternativas.**

- **Next.js 16.3.5 en modo estático** — Cuando ya se sabe que la landing va a crecer a aplicación, y no querés migrar después
- **Astro u otro generador de sitios** — Muchas páginas de contenido con poca interactividad

### B · Aplicación web

**Cuándo es este.** ¿Hay sesión de usuario y datos que sobreviven a la visita? Si sí, hace falta base de datos y autenticación, y eso cambia todo el resto.

**Recomendado.** Next.js 16.3.5 con App Router · React 19.3.0 · TypeScript 6.0.3 · Tailwind 4.3.3 · Drizzle ORM 0.45.2 sobre PostgreSQL 18 en Docker local · Better Auth 1.7.4 · Vitest 5.0.0 · Playwright 1.63.0 · Node 24 LTS — Es el camino con más documentación oficial verificable, y todas las piezas tienen versiones compatibles entre sí hoy. La base corre local en Docker: nada de cloud hasta que haya algo que mostrar.

**Alternativas.**

- **El mismo frontend con Supabase como base y autenticación** — Cuando querés autenticación llave en mano y la aplicación va a tener tráfico diario real; su plan gratuito pausa el proyecto tras siete días de baja actividad
- **Cloudflare Workers con D1** — Cuando el proyecto es comercial. Es el único de los siete servicios revisados cuyo plan gratuito no prohíbe uso comercial ni pausa por inactividad

### C · Progressive Web App

**Cuándo es este.** ¿Tiene que funcionar sin conexión, o instalarse en la pantalla de inicio? Si ninguna de las dos, es tipo B y no hace falta el costo de la PWA.

**Recomendado.** El stack de tipo B más manifest, service worker y una estrategia de caché explícita — La PWA es una capa sobre una aplicación web, no un stack distinto. Agregarla sin necesidad suma un service worker que hay que versionar y que puede servir contenido viejo.

**Alternativas.**

- **Aplicación web común con diseño adaptable** — Cuando el caso de uso no justifica el modo sin conexión, que es la mayoría

### D · Aplicación de escritorio o híbrida

**Cuándo es este.** ¿Necesita hablar con un proceso local de terceros, o alcanza con el sistema de archivos? Si habla con otro proceso, revisá primero si ese proceso tiene cliente en algún lenguaje: eso decide el stack más que cualquier comparación de frameworks.

**Recomendado.** Depende de la respuesta al criterio. Si el proceso local tiene cliente en Python: Python con interfaz web local y ventana nativa. Si no hay proceso local que integrar: Tauri 2.11.5 — Cuando el cliente del proceso local es un paquete de Python, tanto Tauri como Electron terminan lanzando un proceso auxiliar de Python igual, o sea que ya tenés Python en el stack más una capa de plumbing que no existiría si la aplicación fuera Python.

**Alternativas.**

- **Electron 44.3.0** — Cuando hace falta hablar por socket o named pipe desde el código de la aplicación: el módulo de red de Node lo soporta nativo y Tauri no tiene plugin oficial para eso. Costo: soporta sólo las tres últimas versiones mayores, con cadencia de ocho semanas, o sea ~6 subidas por año
- **Tauri 2.11.5** — Cuando manda el peso del instalador. Ojo: en Windows usa WebView2, que es Chromium, así que el ahorro grande de memoria es real en Linux y macOS, no necesariamente en Windows

**Sin plan gratuito.** Una aplicacion de escritorio corre en la maquina de quien la usa, asi que no consume ningun plan gratuito alojado. Su costo de escalar no es un cupo sino la firma de codigo, que se trata aparte porque no es un plan de nada: es un certificado que se paga desde el primer dia si hay que distribuir el instalador a terceros.

### E · Sistema Python: datos, automatización, research o IA

**Cuándo es este.** ¿El cómputo es el producto, o es un medio? Si el resultado del cálculo es lo que se entrega, el stack se elige por el cuello de botella medido, no por preferencia.

**Recomendado.** Python 3.14 con uv 0.12.13 · NumPy 2.5.3 · SciPy 1.18.1 · pandas 3.0.5 · PyArrow 25.0.1 · pytest · ruff · mypy. Polars 1.44.2 o DuckDB 1.5.5 sólo cuando la medición los justifique — 3.14 es el único punto donde todas las librerías del conjunto tienen paquetes compilados disponibles: NumPy y SciPy exigen 3.12 o más, y Numba no soporta 3.15 ni posterior.

**Alternativas.**

- **Python 3.13** — Si alguna librería de nicho no tiene paquete compilado para 3.14, porque en Windows eso obliga a compilar desde fuente
- **Sumar Numba, multiproceso o una extensión nativa** — Sólo con un perfilado que lo justifique. Numba no amortiza si el trabajo entero corre menos de un segundo, y la documentación oficial dice que empeora el rendimiento cuando el camino caliente es pandas

### F · Integración, API, backend o proceso interno

**Cuándo es este.** ¿Quién lo consume es una máquina o una persona? Si es una máquina, no hay interfaz que diseñar y el stack se elige por dónde corre y con qué se integra.

**Recomendado.** El lenguaje que ya hable con lo que se integra, con cero dependencias si el alcance lo permite. Node 24 nativo para herramientas de línea de comandos; Python 3.14 si toca el ecosistema de datos — Una integración se elige por el extremo con el que habla, no por gusto. Cada dependencia que se suma es superficie que hay que auditar y actualizar.

**Alternativas.**

- **Un framework de API como FastAPI o similar** — Cuando hace falta exponer HTTP con validación de esquema y documentación automática, no cuando alcanza un proceso que corre y termina

### G · Artefacto: documento, plan, planilla, presentación, imagen o panel

**Cuándo es este.** ¿Se entrega una vez y no se opera? Si hay que mantenerlo, versionarlo o corregirlo en producción, no es un artefacto: es alguno de los otros siete.

**Recomendado.** La herramienta que produzca el formato final, sin construir infraestructura alrededor — Un artefacto no tiene despliegue ni operación. Montar un proyecto para generarlo es casi siempre más caro que el artefacto.

**Alternativas.**

- **Un generador propio cuando el artefacto se rehace seguido con datos nuevos** — A partir de la tercera vez que se regenera a mano. Antes de eso, generarlo a mano sale más barato

**Sin plan gratuito.** Un artefacto se entrega una vez y no se opera, asi que no corre en ningun servicio alojado: no hay plan gratuito contra el cual medir el costo de crecer, porque no hay nada que crezca.

### H · Otro

**Cuándo es este.** Ninguno de los siete alcanza. Elegir este código obliga a escribir por qué, y ese texto es el dato: si se repite entre proyectos, a la matriz le falta una fila.

**Recomendado.** Sin recomendación por definición. Se investiga el caso y se registra el hueco — Inventar una recomendación para un tipo que no se entiende es peor que no darla. Lo útil de este código es que hace visible lo que la matriz no cubre.

**Alternativas.** Ninguna: sin clasificar el caso no hay con qué comparar.

**Sin plan gratuito.** Todavia no se sabe que es. Sin clasificar el caso no hay stack recomendado, y sin stack no hay servicio al cual referenciar: ese es justamente el valor de este codigo.

---

## Qué cuesta crecer, servicio por servicio

Cada servicio declara **qué evento concreto lo saca del plan gratuito** y **desde cuánto se paga**.
Esa es la columna que convierte «es gratis» en una decisión informada.

| Servicio | Plan | Qué lo saca del plan gratuito | Desde cuánto se paga |
|---|---|---|---|
| `vercel-hobby` | Hobby | Usar el proyecto con fin comercial. La definicion oficial incluye textualmente a un empleado o consultor pago que escribe el codigo, asi que cobrar por hacer el sitio ya saca del plan. NO ES UN NUMERO: no hay contador, ni alerta, ni barra de consumo. El segundo disparador es conectar el proyecto a un repositorio que pertenezca a una organizacion de Git. El tercero, cruzar cualquier cupo, que pausa la funcion treinta dias en vez de facturarla. | USD 20 por mes y por asiento de developer, con USD 20 de credito mensual incluido |
| `neon-free` | Free | Agotar las 100 CU-horas de computo del proyecto en el mes, que suspende el computo hasta el proximo periodo. La documentacion aclara que no se borran datos. Tambien saca del plan querer cualquiera de estas cuatro cosas, que son solo de pago: desactivar el apagado automatico a los cinco minutos, pasar de 2 CU de autoescalado, tener mas de diez ramas, o guardar mas de medio gigabyte en un proyecto. | Launch, sin minimo mensual: se paga por uso |
| `supabase-free` | Free | Siete dias de baja actividad de base de datos pausan el proyecto. La documentacion precisa que alcanza con unas pocas peticiones diarias para evitarlo, asi que el disparador real es dejar la aplicacion sin trafico una semana, no crecer. El segundo disparador es querer un tercer proyecto activo. El plan gratuito nunca genera cargos por excedente: corta o pasa a solo lectura. | Pro, USD 25 por mes, con USD 10 de creditos de computo incluidos |
| `cloudflare-workers` | Workers Free | Una sola peticion que necesite mas de diez milisegundos de procesador. El limite que importa no es el que se mira: casi nadie llega a las cien mil peticiones diarias, pero un hash de contrasena o una transformacion de imagen mata una unica peticion. El segundo disparador es la peticion numero cien mil y uno de un dia UTC, que devuelve error el resto del dia. La ficha lo senala como el unico de los proveedores que reviso cuyo plan gratuito no prohibe uso comercial ni pausa por inactividad. | Workers Paid, minimo USD 5 por mes |
| `cloudflare-pages` | Pages Free | El build numero quinientos uno del mes. Las peticiones a archivos estaticos son gratis e ilimitadas y no cuentan contra ningun cupo, asi que el trafico no es el disparador: lo es la frecuencia de publicacion. | Workers Paid, minimo USD 5 por mes, que tambien cubre Pages |
| `railway-free` | Free | Consumir el credito de un dolar del mes, que a los precios del proveedor son horas y no un mes completo: el plan gratuito NO alcanza para un servicio encendido todo el tiempo. La ficha declaro NO VERIFICADO que pasa exactamente al agotarlo, si corta o si factura, y por eso ese cupo lleva hard en null. El segundo disparador es necesitar mas de un procesador virtual, medio gigabyte de memoria o una segunda replica. | Hobby, USD 5 por mes, que incluye USD 5 de uso |
| `render-hobby` | Hobby | El dia treinta de vida de la base PostgreSQL gratuita, que EXPIRA en vez de degradarse. Es el disparador mas destructivo de los revisados. El segundo es pasar de cinco gigabytes de ancho de banda en el mes, que factura si hay medio de pago y corta todos los servicios gratuitos si no lo hay. El tercero son las setecientas cincuenta horas de instancia: un servicio encendido todo el mes son unas setecientas veinte, asi que uno entra justo y dos no. Los dos cupos con hard en null lo llevan porque su comportamiento DEPENDE del medio de pago: la ficha dice que factura si hay uno y corta todos los servicios gratuitos si no lo hay, asi que ningun booleano los describe. Ese ancho de banda bajo de 100 GB a 5 en abril de 2026, un recorte de veinte veces y el unico recorte real a un plan gratuito en la ventana revisada. | Instancia Starter, cuyo precio exacto no se pudo verificar; a nivel espacio de trabajo, Pro USD 25 por mes |
| `github-actions` | Free | Cambiar el repositorio de publico a privado. El mismo flujo de trabajo que corria gratis empieza a consumir cuota desde el envio siguiente. El segundo disparador es elegir ejecutores de macOS: a su tarifa, los dos mil minutos gratuitos equivalen a unos treinta y dos minutos de esa plataforma. Sin medio de pago el uso se bloquea al agotar la cuota; con medio de pago se factura el excedente automaticamente. El cupo de minutos lleva hard en null porque su comportamiento DEPENDE del medio de pago: sin uno el uso se bloquea al agotar la cuota, con uno se factura el excedente. Ningun booleano describe las dos. | Excedente facturado por minuto sobre la cuota del plan |
| `fly-trial` | Free trial, sin plan gratuito permanente | Consumir las dos horas de maquina virtual o cumplir los siete dias, lo que pase primero: ahi las aplicaciones dejan de correr. Agregar una tarjeta TERMINA el periodo de prueba en ese instante y arranca la facturacion. No hay plan gratuito permanente: los planes con asignaciones gratuitas se discontinuaron el 2024-10-07. | USD 2.02 por mes la maquina mas barata |
| `cloudflare-d1` | D1 Free | La fila 5.000.001 leida o la 100.001 escrita en un dia. La documentacion dice textualmente que al tocar el limite diario no se pueden correr consultas y la interfaz devuelve errores al cliente. Es un corte POR DIA y no por mes, asi que un pico de un solo dia deja la aplicacion sin base hasta la medianoche. | Incluido en Workers Paid, minimo USD 5 por mes |

Los cupos numéricos de cada servicio —y de dónde salió cada número— están en
`contracts/free-tier-limits.json`, que es la canónica. Esta tabla no los repite a propósito: un
número duplicado es un número que va a divergir.

---

## Límites honestos de este paso

**Lo que la matriz NO es.** No es una verificación de que el stack recomendado sea el mejor para
tu caso. Es una recomendación fechada con su fuente, que existe para que no se elija de memoria.

**Lo que el gate NO comprueba.** `verify-stack-matrix.mjs` verifica que cada campo esté escrito,
fechado y que no sea relleno. **Nunca que el número sea cierto ni que siga vigente hoy**: no sale
a la red, lee el archivo que alguien escribió, así que una matriz con cifras inventadas y fecha de
hoy pasa en verde. Tampoco impide crear un recurso pago — no es un sandbox.

**Lo que el par NO comprueba.** `tests/stack-matriz-pareada.test.mjs` comprueba que esta copia
diga lo mismo que la canónica y que cada plan gratuito que nombra exista en el contrato. No
comprueba que la recomendación sea buena.

**Lo que la clasificación NO sabe.** `verify-intake.mjs` comprueba que el código sea uno de los
ocho y que el motivo no esté vacío. **No sabe si el producto es realmente de ese tipo** — una
clasificación coherente y equivocada pasa en verde, y arrastra el stack equivocado detrás.
