# Fase 4 · Marca

## Para qué
Definir cómo se ve y cómo suena el producto antes de dibujar pantallas, para no rehacerlas.

## Entra
- `docs/pedido.md` y `docs/research.md` aprobados.
- Sólo si el producto tiene pantallas. Sin pantallas, esta fase no corre.
- En tamaño medio no corre: la marca se lee de los tokens de diseño que el proyecto ya tiene.

## Pasos
1. Pedí a la persona un logo, una imagen o una referencia que le guste. Si no tiene, ofrecé tres
   referencias del research y que elija.
2. Definí tres atributos (por ejemplo: cercana, precisa, sobria) y la paleta con el uso de cada
   color. Por cada par texto y fondo corré `node scripts/contraste.mjs <hex> <hex>`: la relación
   tiene que ser ≥ 4,5:1 (el script sale 1 si no llega).
3. Elegí tipografías: una para títulos y una para texto, con su licencia.
4. Logo mejorado: mejorá el que hay sin cambiar su idea; si no hay, proponé uno simple.
5. Tono de voz: cómo habla el producto, con tres frases de ejemplo.
6. Convertí todo en tokens de diseño (colores, tipografías, espaciados, radios), escribí
   `docs/marca.md` con `templates/marca.md`, armá una hoja de marca que se abra en el navegador,
   mostrala y aceptá una sola ronda de cambios.

## Entrega
`docs/marca.md` y la hoja de marca, con los tokens listos para usar en el preview.

## Gate
Aprobación 3: que la persona escriba **«apruebo marca v1»** (sin hook: `node scripts/aprobar.mjs
registrar --tipo marca --ref v1 --texto "<lo que escribió>"`). No hay otro script que frene acá.

## Modelo
Nivel fuerte. La marca se decide una vez y condiciona todo lo que sigue.
