# Lecciones

Una entrada por escalada o retrabajo, escrita con `scripts/leccion.mjs anotar`. Nunca se borra una
lección. Formato validado por `scripts/verify-lessons.mjs`: un encabezado por lección con la fecha
y el tipo, y cuatro campos (síntoma, causa, archivo, cómo evitarlo). Si la misma causa aparece 2
veces en 30 días, `scripts/arranque.mjs` lo avisa.
