# Versiones estables de un stack web — consultadas el 2026-09-14

**Método.** `dist-tags` del registry de npm, releases de GitHub y documentación oficial, leídos ese
día. Los rangos de `peerDependencies` salen del **manifiesto publicado**, no de artículos. Lo que no
se pudo verificar está marcado, no completado.

**El hallazgo que justifica la ficha entera:** *la última no es la usable*. `typescript@latest` es
hoy **7.0.2** y **rompe este stack**. Una matriz que recomiende «la última estable» sin mirar los
peers manda a la gente a un repositorio que no compila.

---

## Tabla principal

| Paquete | Estable actual | Publicado | Estado |
|---|---|---|---|
| next | **16.3.5** | 2026-09-11 | verificado |
| react · react-dom | **19.3.0** | 2026-09-09 | verificado |
| typescript | **7.0.2** (latest) · **6.0.3** (usable) | 2026-08-20 | **cuidado** |
| tailwindcss · @tailwindcss/postcss | **4.3.3** | 2026-07-16 | verificado, lockstep |
| drizzle-orm | **0.45.2** | — | verificado |
| drizzle-kit | **0.31.10** | — | verificado |
| pg | **8.23.0** | fecha no verificada | versión verificada |
| @types/pg | **8.23.1** | — | verificado |
| better-auth · @better-auth/drizzle-adapter | **1.7.4** | 2026-09-10 | verificado, lockstep |
| vitest · @vitest/coverage-v8 | **5.0.0** | 2026-09-03 | **cuidado** — major de 11 días |
| @playwright/test | **1.63.0** | 2026-09-04 | verificado |
| eslint | **10.10.0** | 2026-09-04 | verificado |
| eslint-config-next | **16.3.5** | 2026-09-11 | verificado, lockstep con next |
| shadcn (CLI) | **4.21.0** | 2026-09-04 | verificado |
| shadcn-ui (nombre viejo) | 0.9.5 | — | **deprecado por el autor** |

### Runtimes

| | Línea | Última | Estado |
|---|---|---|---|
| Node.js | **24.x «Krypton», Active LTS** desde 2025-10-28 | 24.21.0 | verificado |
| PostgreSQL | **18.x** — la 19 sigue en Beta 3 | 18.6 (2026-08-13) | verificado |

Node 22 «Jod» sigue viva en Maintenance LTS hasta 2027-04-30; Node 26 es Current y no es LTS hasta
octubre de 2026. Ninguna de las dos es la elección hoy.

---

## Los dos avisos que cambian una recomendación

### TypeScript: la última rompe el linter

`typescript@latest` es **7.0.2**, la reescritura nativa en Go. No trae API programática del
compilador todavía —llega en 7.1— y `typescript-eslint@8.70.0`, que `eslint-config-next` arrastra
como dependencia dura, declara en su manifiesto:

```
"peerDependencies": { "typescript": ">=4.8.4 <6.1.0" }
```

Ese rango **excluye 7.x explícitamente**. Pin recomendado: **`6.0.3`**, estable real, fijado exacto
porque no hay dist-tag activo apuntándole.

### Vitest 5: nuevo, y arrastra a su paquete de cobertura

Salió el 2026-09-03. `@vitest/coverage-v8@5.0.0` declara `"vitest": "5.0.0"` — **coincidencia
exacta, no rango**: si subís uno, subís el otro. Pide Node `^22.12.0 || ^24.0.0 || >=26.0.0`.
Las notas de release mencionan cambios que rompen (formato de inspect, concurrencia, ubicación por
defecto de reportes en `.vitest/`) y requisito de Vite ≥6.4. **Eso no se verificó contra un
manifiesto**: sale de las notas de release, y se marca como tal.

---

## Rangos de peers, textuales del manifiesto publicado

| Paquete | Campo | Valor exacto |
|---|---|---|
| next@16.3.5 | `engines.node` | `>=20.9.0` |
| next@16.3.5 | `peerDependencies.react` | `^18.2.0 \|\| 19.0.0-rc-de68d2f4-20241204 \|\| ^19.0.0` |
| typescript-eslint@8.70.0 | `peerDependencies.typescript` | `>=4.8.4 <6.1.0` |
| vitest@5.0.0 | `engines.node` | `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` |
| @vitest/coverage-v8@5.0.0 | `peerDependencies.vitest` | `5.0.0` (exacto) |
| eslint@10.10.0 | `engines.node` | `^20.19.0 \|\| ^22.13.0 \|\| >=24` |
| drizzle-orm@0.45.2 | `peerDependencies.pg` | `>=8` (optional) |
| better-auth@1.7.4 | `peerDependencies.drizzle-orm` | `^0.45.2 \|\| >=1.0.0-rc.1 <2.0.0` (optional) |
| better-auth@1.7.4 | `peerDependencies.next` | `^14.0.0 \|\| ^15.0.0 \|\| ^16.0.0` (optional) |

---

## Tres preguntas de compatibilidad

**¿Tailwind 4 sigue siendo config-first en CSS?** Sí. La documentación de instalación vigente
(branding 4.3, coincide con 4.3.3) muestra `@import "tailwindcss"` en el CSS más el plugin de build,
**sin** `tailwind.config.js` en el flujo por defecto. No hay señal de v5 en dist-tags ni en GitHub.
**No verificado:** si el escape-hatch legacy con archivo JS (`@config`) sigue soportado — no estaba
en la página leída y no se completa por inferencia.

**¿Drizzle sigue en 0.x?** Sí: `latest` es 0.45.2. Las señales de 1.0 son fuertes pero no llegó —
dist-tags muestran de `beta.1` a `beta.23` y de `rc.1` a `rc.5`, con `v1.0.0-rc.4` publicado el
2026-06-27 como prerelease. **Consecuencia práctica:** en un paquete 0.x el **minor** es donde viven
los cambios que rompen. Se pinea exacto, nunca con caret.

**¿Next 16 condiciona Node o React?** Node `>=20.9.0`, React `^18.2.0 || ^19.0.0`. No fuerza una
build puntual de React ni una versión de Node más alta que la LTS activa.

---

## shadcn/ui no se versiona como paquete

No es una librería instalable: los componentes son **código que se copia** al repositorio de quien
lo usa, y a partir de ahí son suyos. Lo único versionado en npm es el **CLI** (`shadcn`, 4.21.0). El
nombre viejo `shadcn-ui` está **deprecado formalmente** por su autor, con el aviso en el manifiesto.

Esto importa para la matriz: una fila que diga «shadcn/ui vX» estaría inventando un número que no
existe. Lo correcto es nombrar la versión del CLI y decir que los componentes no se versionan.

---

## Lo que NO se pudo verificar

1. **Fecha de publicación de `pg@8.23.0`.** El repositorio de `node-postgres` no expone releases
   formales de GitHub: la consulta devolvió una lista vacía. La versión sí está verificada por el
   registry.
2. **Si `@better-auth/drizzle-adapter` y el export interno `better-auth/adapters/drizzle` son
   funcionalmente idénticos.** Se verificó que ambos existen en 1.7.4 y que la documentación oficial
   pide el paquete separado; la equivalencia no se comprobó.
3. **Los cambios que rompen de vitest 5.0.0**, que salen de las notas de release y no de un
   manifiesto.
4. **Si Tailwind 4.3 sigue aceptando el archivo de configuración legacy.**
5. **Fecha exacta del último estable de drizzle-orm**: las releases de GitHub están dominadas por los
   RC de 1.0 y el estable no aparece con fecha propia.

El contexto de por qué TypeScript 7 no trae API de compilador es de **un medio de terceros**, no del
proveedor. Se marca como tal: el dato duro y verificado es el rango de peers, que alcanza solo para
decidir.

---

**Contraejemplo de la ficha entera:** estos números valen para el 2026-09-14 y para ninguna otra
fecha. Dos de las quince filas ya tienen un aviso de «la última no es la usable», y ese aviso es
justamente lo que caduca más rápido: el día que `typescript-eslint` amplíe su rango, la recomendación
de pinear 6.0.3 pasa de prudente a vieja. Por eso lo que se publica lleva fecha de captura y regla
de antigüedad, y el gate rechaza una tabla vencida en vez de dejarla pasar como cierta.
