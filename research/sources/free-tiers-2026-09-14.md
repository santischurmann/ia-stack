# Límites de plan gratuito — siete servicios, consultados el 2026-09-14

**Método.** Documentación oficial de precios y límites de cada proveedor, leída ese día. No se creó
ninguna cuenta ni se aprovisionó nada: todo sale de páginas públicas. Cada número de abajo tiene su
URL. Lo que no se pudo verificar está en la sección final, marcado, en vez de completado.

**Por qué esta ficha existe.** Un stack recomendado sin el costo de escalarlo es media recomendación.
Lo que importa no es el número del cupo sino **el disparador**: el evento concreto que te saca del
plan gratuito. Casi ninguno es «si crecés».

---

## 1. Vercel — Hobby

| Métrica | Valor | ¿Corta o cobra? |
|---|---|---|
| Fast Data Transfer | 100 GB/mes | Corta — pausa 30 días |
| Fast Origin Transfer | 10 GB/mes | Corta |
| Edge Requests | 1.000.000/mes | Corta |
| Invocaciones de función | 1.000.000/mes | Corta |
| Active CPU | 4 CPU-horas/mes | Corta |
| Duración máx. de función | 300 s | Corta (504) |
| Deployments | 100/día · 100 builds/hora | Corta |
| Build time | 45 min por deployment | Corta |
| Proyectos | 200 | Corta |

**En Hobby nunca te cobran: te apagan.** Textual: *"if you exceed your usage limits on the Hobby
plan, you will have to wait until 30 days have passed before you can use the feature again"*.

**Disparadores — tres, y el primero no es un número:**
1. **Uso comercial.** Definido textualmente como *"any Deployment that is used for the purpose of
   financial gain of anyone involved in any part of the production of the project, including a paid
   employee or consultant writing the code"*. Cobrar por hacer el sitio ya cuenta. Donaciones no.
2. Conectar el proyecto a un repositorio que pertenezca a una **organización** de Git.
3. Cruzar cualquier cupo mensual.

**Primer precio pago:** Pro, USD 20/mes por asiento de developer, con USD 20 de crédito mensual.

Fuentes: `vercel.com/docs/limits` (act. 2026-09-03) · `vercel.com/docs/plans/hobby` (2026-08-31) ·
`vercel.com/docs/limits/fair-use-guidelines` (2026-07-29) · `vercel.com/docs/functions/limitations`
(2026-08-24) · `vercel.com/pricing`

## 2. Neon — Free

| Métrica | Valor | ¿Corta o cobra? |
|---|---|---|
| Cómputo | 100 CU-horas por proyecto/mes | Corta — compute suspendido |
| Almacenamiento | 0,5 GB por proyecto | Corta — fallan las escrituras que crezcan |
| Branches | 10 por proyecto | Corta |
| Proyectos | 100 por organización | Corta |
| Egress | 5 GB por proyecto/mes | Corta |
| Autoscaling | hasta 2 CU (≈8 GB RAM) | tope duro |
| Scale-to-zero | 5 min de inactividad, **no desactivable** | comportamiento |

Textual: *"the project's compute is suspended until the next billing period or until you upgrade"*.
Explícito: **no se borran datos** al tocar un límite.

**Disparadores:** consumir las 100 CU-horas (≈400 h a 0,25 CU). O necesitar una de estas cuatro
cosas, que son sólo de pago: desactivar el scale-to-zero, pasar de 2 CU, más de 10 branches, o más
de 0,5 GB.

**Primer precio pago:** Launch, sin mínimo mensual. $0.106/CU-hora, $0.35/GB-mes.

Fuentes: `neon.com/docs/introduction/plans` · `neon.com/pricing` ·
`neon.com/faqs/free-plan-limits-and-quotas`

## 3. Supabase — Free

| Métrica | Valor | ¿Corta o cobra? |
|---|---|---|
| Base de datos | 500 MB por proyecto | Corta (read-only) |
| Egress | 5 GB/mes | Corta |
| File storage | 1 GB | Corta |
| Usuarios activos mensuales | 50.000 | Corta |
| Edge Functions | 500.000 inv/mes | Corta |
| Proyectos activos | 2 | Corta |
| **Pausa por inactividad** | **7 días de baja actividad** | Proyecto pausado |

**El Free nunca genera cargos por excedente.** Restricciones posibles, textual: *"Pausing projects,
Switching databases to read-only mode, Disabling new project launches/transfers, Responding with a
402 status code for all API requests"*.

**Disparadores:** 7 días sin actividad suficiente de base — *"Typically a few user requests to the
database each day over the previous week is enough"* para evitarlo. O querer un tercer proyecto.

**Primer precio pago:** Pro, USD 25/mes, con $10/mes de créditos de compute.

Fuentes: `supabase.com/pricing` · `supabase.com/docs/guides/platform/billing-on-supabase` ·
`supabase.com/docs/guides/platform/free-project-pausing` ·
`supabase.com/docs/guides/platform/billing-faq`

## 4. Cloudflare — Workers / Pages / D1 / R2 Free

| Servicio | Métrica | Valor | ¿Corta? |
|---|---|---|---|
| Workers | Peticiones | 100.000/día (reset medianoche UTC) | Corta — `Error 1027` |
| Workers | **Tiempo de CPU** | **10 ms por invocación** | Corta — mata la request |
| Workers | Memoria | 128 MB por isolate | Corta |
| Pages | Builds | 500/mes | Corta |
| Pages | Assets estáticos | **gratis e ilimitados** | no cuentan |
| D1 | Filas leídas | 5.000.000/día | Corta |
| D1 | Filas escritas | 100.000/día | Corta |
| D1 | Tamaño por base | 500 MB · 5 GB por cuenta | Corta |
| R2 | Storage | 10 GB-mes | ver límites |
| R2 | **Egress a internet** | **gratis, siempre** | — |

**El único de los siete cuyo free tier no prohíbe el uso comercial ni pausa por inactividad.**

**Disparadores:** la petición 100.001 de un día UTC; **una sola request que pase de 10 ms de CPU**;
la fila 5.000.001 leída o 100.001 escrita en D1 en el día; el build 501 del mes en Pages.

**Primer precio pago:** Workers Paid, mínimo USD 5/mes — 10M requests y 30M CPU-ms incluidos, CPU
hasta 5 min por invocación.

Fuentes: `developers.cloudflare.com/workers/platform/limits/` · `.../workers/platform/pricing/` ·
`.../pages/platform/limits/` · `.../d1/platform/limits/` · `.../d1/platform/pricing/` ·
`.../r2/pricing/`

## 5. Railway — Free (reintroducido en ago-2025)

| Métrica | Trial | Free |
|---|---|---|
| Crédito | $5 por única vez, 30 días | **$1/mes, no acumulable** |
| vCPU / RAM por servicio | 2 / 1 GB | **1 / 0,5 GB** |
| Réplicas | 2 | 1 |
| Retención de logs | 7 días | 3 días |
| Volúmenes | borrados 30 días después de expirar el crédito | ídem |

**Disparador:** consumir el $1 del mes. A los precios de Railway eso son **horas**, no un mes: el
plan Free **no alcanza para un servicio always-on**.

**Primer precio pago:** Hobby, USD 5/mes, que incluye $5 de uso.

Fuentes: `railway.com/pricing` · `docs.railway.com/pricing/plans` ·
`docs.railway.com/reference/pricing/free-trial` · `blog.railway.com/p/free-plan` (2025-08-27)

## 6. Render — Hobby (recortado en abr-2026)

| Métrica | Valor | ¿Corta o cobra? |
|---|---|---|
| Free web service | 0,1 CPU / 512 MB | fijo |
| Horas de instancia | 750/mes por workspace | Corta — suspende hasta el mes siguiente |
| Spin down | 15 min sin tráfico | cold start en la próxima request |
| Ancho de banda | **5 GB/mes** | Cobra $0.15/GB con medio de pago; corta sin él |
| Minutos de build | 500/mes | ídem |
| **Postgres gratis** | 1 GB, **expira 30 días después de creada** | **destructivo** |

**Disparadores — tres, muy concretos:**
1. **Día 30 de vida de la Postgres gratis.** No se degrada: expira.
2. Pasar de 5 GB de ancho de banda en el mes.
3. Llegar a 750 horas de instancia. Un servicio always-on son ~720 h/mes: **uno entra justo, dos no**.

Fuentes: `render.com/docs/free` · `.../compute-plans` · `.../outbound-bandwidth` ·
`.../build-pipeline` · `.../new-workspace-plans` · `render.com/changelog/updated-plans-for-render-workspaces`

## 7. GitHub Actions

**Repositorio público con runners estándar: gratis e ilimitado.** Textual: *"GitHub Actions usage is
free for self-hosted runners and for public repositories that use standard GitHub-hosted runners"*.
Excepción: los *larger runners* se cobran siempre.

**Repositorio privado:**

| Plan | Minutos/mes | Artifact storage |
|---|---|---|
| Free | 2.000 | 500 MB |
| Pro | 3.000 | 1 GB |
| Team | 3.000 | 2 GB |
| Enterprise Cloud | 50.000 | 50 GB |

Sin medio de pago, textual: *"usage is blocked once you use up your quota"*. Con medio de pago, se
factura el excedente.

**Disparador:** **cambiar el repositorio de público a privado.** El mismo workflow que corría gratis
empieza a consumir cuota desde el push siguiente. Segundo disparador: elegir runner macOS — a
$0.062/min, los 2.000 minutos «gratis» valen unos 32 minutos de macOS.

Tarifas vigentes desde 2026-01-01, tras una baja de hasta 39%: Linux 2-core $0.006/min, Windows
2-core $0.010/min, macOS $0.062/min.

Fuentes: `docs.github.com/en/billing/concepts/product-billing/github-actions` ·
`docs.github.com/en/actions/concepts/billing-and-usage`

## 8. Fly.io — no queda plan gratuito

Sólo un trial de **2 VM-horas totales o 7 días**, lo que pase primero; después *"your apps will stop
running"*. Agregar una tarjeta **termina el trial en ese instante**. Máquina más barata: $2.02/mes.
Los planes con allowances gratis se discontinuaron el 2024-10-07.

Fuentes: `fly.io/docs/about/pricing/` · `fly.io/docs/about/free-trial/` ·
`fly.io/docs/about/discontinued-plans/`

---

## La trampa que no es un número

**La cláusula de uso comercial de Vercel Hobby.** No hay contador que se ponga en rojo, ni alerta, ni
barra al 80%: es un evento binario y silencioso. El día que agregás un botón de pago, un script de
publicidad, o simplemente **cobrás por haber hecho el sitio** —la definición nombra textualmente a
*"a paid employee or consultant writing the code"*— ya estás fuera del plan, sin ninguna señal
técnica. Alguien que hostea el sitio de un cliente en su Hobby está fuera del ToS aunque el sitio no
procese un solo pago.

Las cuatro numéricas que le siguen, en orden de cuánta gente las cruza sin verlas:

1. **Supabase, la pausa a los 7 días.** Armás el proyecto, no lo tocás una semana, volvés y está
   pausado.
2. **Render, la Postgres que expira a los 30 días.** Y el ancho de banda que bajó a 5 GB en abril de
   2026 — quien venía del plan viejo con 100 GB se comió un recorte de veinte veces.
3. **Cloudflare, los 10 ms de CPU.** Nadie llega a las 100.000 requests diarias, pero un hash de
   contraseña o una transformación de imagen mata **una sola** request. El límite que importa no es
   el que estás mirando.
4. **Vercel, Fast Origin Transfer.** 10 GB, o sea **diez veces menos** que los 100 GB de Fast Data
   Transfer, que es el número que todo el mundo mira. Con poca cache-hit rate, éste se agota primero.

## Qué cambió entre septiembre de 2025 y septiembre de 2026

**Recortes — uno solo, y real:**
- **Render, 2026-04-23.** Rehizo los planes de workspace y bajó el ancho de banda incluido. Textual:
  *"The new Hobby and Pro plans include less bandwidth than their legacy counterparts, because legacy
  plans subsidized bandwidth usage with seat fees"*. Migración automática desde el 2026-08-01.

**Mejoras:**
- **Neon, 2025-09-19** duplicó el compute del Free: 50 → 100 CU-horas. **2025-11-03** bajó el precio
  de compute ~25%. **2026-06-05** subió el egress incluido en planes pagos de 100 GB a 500 GB.
- **Railway, 2025-08-27** **reintrodujo** el plan gratis, que había eliminado.
- **GitHub, 2026-01-01** bajó hasta 39% el precio de los runners, aclarando explícitamente que lo
  gratuito no se tocaba: *"Runner usage in public repositories will remain free"*.

**Anunciado y dado de baja:** GitHub iba a cobrar $0.002/minuto por runners self-hosted en repos
privados desde el 2026-03-01. Postergado: *"We're postponing the announced billing change for
self-hosted GitHub Actions to take time to re-evaluate our approach"*.

## Lo que NO se pudo verificar

Se declara en vez de completarse. Un número plausible es peor que un hueco declarado.

1. **Render, precio en USD de la instancia Starter.** `render.com/docs/pricing` devuelve 404 y
   `render.com/pricing` no expuso los montos. Sí verificadas sus specs (0,5 CPU / 512 MB) y los
   planes de workspace (Pro $25, Scale $499).
2. **Cloudflare R2, si al pasarte te corta o te factura.** La doc dice *"You are billed for your
   usage on a monthly basis"*, que sugiere facturación, pero no lo afirma para una cuenta sin plan
   pago.
3. **Railway Free, qué pasa exactamente al agotar el $1**, y si pide tarjeta. Lo escrito aplica al
   plan Hobby, no al Free.
4. **Neon, la fecha en que los proyectos del Free pasaron de 20 a 100.** Hoy son 100, verificado en
   dos páginas oficiales; no se encontró el anuncio del cambio.
5. **Vercel, si hubo algún cambio al Hobby en los últimos 12 meses.** No se encontró entrada de
   changelog. Los números son los vigentes hoy, no una afirmación de que no se movieron.

**Contraejemplo de la ficha entera:** estos números envejecen. La captura vale para el 2026-09-14 y
para ninguna otra fecha — por eso el contrato que los consuma lleva fecha y regla de antigüedad, y
por eso el gate rechaza una tabla vieja en vez de dejarla pasar como cierta.
