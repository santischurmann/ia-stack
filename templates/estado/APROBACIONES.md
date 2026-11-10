# Aprobaciones — registro encadenado

Sólo se agregan filas con `scripts/aprobar.mjs`; cada fila lleva un sello `chain:` y editar una línea
rompe la cadena (`node scripts/aprobar.mjs check`). Lo lee `scripts/verify-aprobacion-humana.mjs`.

| tipo | objeto | version | evidencia | mostrado | decidido | quien | estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
