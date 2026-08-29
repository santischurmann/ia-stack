# Research — sistemas de diseño externos aplicables a VCP

**Fecha:** 2026-08-29
**Fuentes:** `shadcn-ui/ui`, `corebunch/instatic` (+ `corebunch/core-framework`)
**Cobertura declarada: PARCIAL.** Ninguno de los dos repositorios se leyó archivo por archivo. Se
leyeron su README, su documentación pública de theming/registry y de tokens, y se verificó lo
extraído contra la superficie visual real de este repositorio. **No** se auditó su código fuente,
sus tests ni su historial. Todo lo que sigue vale como "lo que estos proyectos declaran y
documentan", no como "lo que su implementación hace".

---

## 1. shadcn/ui — qué es y qué no transfiere

React + Tailwind + TypeScript + Radix, monorepo pnpm. Distribuye **código que se copia**, no un
paquete que se instala.

**No transfiere:** el stack entero. VCP declara cero dependencias y no tiene `package.json`; meter
React, Tailwind, Radix y npm rompería la premisa que el proyecto defiende en su propio contrato.
Esto se decidió explícitamente, no por omisión.

**Transfiere:**

| Idea | Cómo aterrizó en VCP |
|---|---|
| Pares `X` / `X-foreground` — cada superficie carga su color de texto | regla 4 de `verify-design-tokens.mjs`, y el mapa se reescribió para cumplirla |
| OKLCH, espacio perceptualmente uniforme | la paleta del mapa se convirtió con la fórmula de Ottosson, no a ojo; el hexadecimal de origen quedó al lado como referencia |
| Un `--radius` base del que deriva la escala | regla 1b; el mapa pasó de seis valores sueltos a uno |
| `:root` claro y el oscuro pisando **los mismos** tokens | reglas 1 y 2 |
| **`registry.json` con `$schema`: el sistema de diseño es un contrato declarado que una máquina revisa** | ésta es la idea de fondo, y es la que justifica que exista el gate: es exactamente la arquitectura que VCP ya usa para todo lo demás |

## 2. instatic + Core Framework — qué es y qué transfiere

CMS visual autohospedado en Bun/React. Su diferencial declarado es la **salida**: «plain semantic
HTML and compact CSS, with none of the editor's machinery left behind in the page. No framework
runtime, no builder attributes, no div soup», y páginas «clean enough to read in view-source».

Su motor de tokens, **Core Framework**, declara tres ideas:

1. **Un color base genera su propia escala de tintes y sombras.** No diecisiete colores elegidos a
   mano.
2. **Escala tipográfica fluida y matemática:** «una rampa que escala con el viewport, en vez de
   cuarenta tamaños elegidos a mano que hay que mantener sincronizados».
3. **Escala de espaciado** para que toda página y todo breakpoint conserven el mismo ritmo.

### Medición del mapa de VCP contra estos ejes, antes de tocar nada

| Eje | Antes | Veredicto |
|---|---|---|
| `font-size` | 17 valores distintos / 24 usos | sin rampa |
| espaciado | 35 valores distintos / 39 usos | sin ritmo |
| tipografías | 3 familias reales, ninguna de la lista genérica | sano |
| markup | 0,66 `div` por elemento semántico | sin div soup |
| `text-align: center` | 0 usos | sin la firma genérica |
| emoji en títulos | 0 | sin la firma genérica |

**Conclusión medida, no intuida:** el mapa no era genérico en sus decisiones tipográficas ni en su
markup — ahí ya estaba bien. Estaba **sin gobernar** justo en los dos ejes que Core Framework
ataca. Después del cambio: 0 tamaños y 0 espaciados fuera de escala.

### La idea #1 no se implementó

Generar la escala de tintes desde un color base **no** se adoptó. Motivo: la paleta del mapa está
afinada a mano por par fondo/texto, y derivarla mecánicamente habría cambiado colores que hoy
funcionan a cambio de una consistencia que nadie reclamó. Queda declarado como no hecho, no como
pendiente olvidado.

## 3. Anti-slop: qué se puede mecanizar y qué no

El pedido fue «anti slop, nada de diseños genéricos». La parte mecanizable son las **firmas
conocidas**: las caras a las que un generador cae por defecto, la paleta crema con terracota, el
degradado violeta-azul, el emoji abriendo títulos, el centrado total. Están declaradas como datos
en `contracts/design-tokens.json`, cada una con el motivo escrito de por qué delata una plantilla.

**Lo que no se puede mecanizar, y por eso está escrito como límite honesto:** el gate detecta la
firma declarada, **no juzga si un diseño es bueno**. Un diseño feo y original pasa; uno excelente
que use una cara de la lista, no. La lista es editable a propósito: es opinión declarada y
revisable, no criterio escondido en el código.

## 4. Lo no verificado

- El código fuente de ambos proyectos: **no leído**. Las mecánicas se tomaron de su documentación.
- Las fórmulas exactas de Core Framework para generar tintes y para el `clamp()` de la rampa
  fluida: **no obtenidas**; la documentación pública las describe sin publicarlas.
- El contraste real de la paleta del mapa: **no medido** por nadie, ni antes ni después. El gate
  declara explícitamente que no lo mide.
- El efecto visual del snapping de escalas se verificó **a ojo en los dos temas**, comparando
  estructura y texto contra la versión anterior (256 elementos, 68 reglas, 10.884 caracteres,
  idénticos). No hay comparación pixel a pixel.
