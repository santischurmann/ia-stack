# Lessons — cross-project error memory

Reflexion-schema. Confirm-gated (nunca se escribe sin 🔵 confirmación del usuario), deduped
contra entradas existentes, retire-not-delete (nunca se borra, solo `status: retired`). Full
protocol: `skills/vibe-memory.md` § LESSONS PROTOCOL. Escrito en Phase 4.8 (después de RETRO),
leído en Phase 0 Bootstrap junto al resto de `.vibe/`.

---

## [YYYY-MM-DD] LESSON-1 <title> — status: active

**Project/phase/run:** <project-slug>/<phase>/<feature-slug or session date>
**What happened:** (observado, factual)
**Why (root cause):** (no el síntoma — la causa real)
**How to avoid:** (regla concreta, chequeable)
**Detection signal:** (qué la flaguearía si se repite — grep pattern, nombre de test, string de error)
**Confidence:** high | medium | low

---


## [2026-08-28] LESSON-1 Enumerar defectos leyendo código no alcanza — status: active

**Project/phase/run:** vibecodeprotocols/fase-6/verde-vacio-2026-08-28
**What happened:** la lista de chequeos que decían `OK:` sin haber comparado nada se armó tres
veces leyendo el código y quedó corta las tres. Eran seis por lectura, siete al correr la batería
completa, y nueve con una sonda que ejecuta cada chequeo en una carpeta vacía. El más grave sólo
apareció ejecutando: un archivo de auditoría borrado entero pasaba como "cadena íntegra".
**Why (root cause):** leer código encuentra los caminos que uno ya sabe buscar. La lista se armó
con un patrón de búsqueda derivado de los casos ya conocidos, así que sólo podía reencontrarlos.
Un caso nuevo —lo abrió un chequeo agregado horas antes, esa misma noche— era invisible para ese
patrón por construcción.
**How to avoid:** para cualquier clase de defecto que se pueda provocar, escribir la sonda que la
provoca antes de escribir la lista. Si la clase no se puede provocar, decirlo en vez de listar.
**Detection signal:** una lista de casos afectados armada con `grep` o lectura, sin un programa
que la reproduzca. También: un inventario de huecos escrito antes de que dejaran de aparecer.
**Confidence:** high

## [2026-08-28] LESSON-2 Probar desde afuera antes de declarar terminado — status: active

**Project/phase/run:** vibecodeprotocols/fase-8/instalacion-limpia-2026-08-28
**What happened:** el instalador dejaba sus propios 114 archivos dentro de lo que git considera
código vivo del proyecto del usuario. Un secreto plantado ahí bloqueaba el chequeo de seguridad
de esa persona con un hallazgo crítico que no había escrito y no podía arreglar.
**Why (root cause):** el defecto era **invisible desde el repo de origen**, donde la regla de
`.gitignore` sí existe. Toda la verificación se hacía desde adentro del proyecto que ya la tenía,
así que el estado roto nunca se materializaba.
**How to avoid:** para cualquier cosa que se instale o se distribuya, la primera verificación es
en destino limpio, no en origen. Va antes del cierre, no después.
**Detection signal:** un instalador, empaquetador o exportador cuyas pruebas corren todas dentro
del repo que lo produce. Si ninguna prueba crea un destino vacío, el agujero está sin mirar.
**Confidence:** high

## [2026-08-28] LESSON-3 Una medición sobre código que se mueve no es una medición — status: active

**Project/phase/run:** vibecodeprotocols/fase-6/cobertura-2026-08-28
**What happened:** el chequeo de cobertura reportó ramas sin cubrir que no existían. Ocho corridas
seguidas: las tres hechas mientras se editaba un script inventaron ramas; las cinco con el árbol
quieto salieron limpias. Casi se persigue un fantasma en el código en vez de en la medición.
**Why (root cause):** la herramienta mapea líneas contra el archivo tal como está al terminar. Si
el archivo cambió durante la corrida, el mapa ya no corresponde a lo que se ejecutó.
**How to avoid:** toda medición que tarde y lea archivos toma una huella del contenido antes y
después. Si difieren, no publica el número: dice que no vale y pide repetir.
**Detection signal:** un resultado de cobertura, benchmark o escaneo que no se reproduce al
repetirlo sin haber cambiado nada. Especialmente si el porcentaje cae poco y en un archivo que no
se tocó.
**Confidence:** high
