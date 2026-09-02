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

## [2026-08-29] LESSON-4 Pedir que ataquen un mecanismo autoriza a fabricarlo — status: active

**Project/phase/run:** vibecodeprotocols/fase-2/consentimiento-humano-2026-08-29
**What happened:** un panel adversarial de 16 subagentes evaluaba si firmar un recibo con clave
FIDO probaba consentimiento humano. La consigna decía «intentá eludirlo concretamente» y no ponía
límite de lectura. Los escépticos de la rama «firma» verificaron su hipótesis **ejecutando**
`ssh-keygen -t ed25519-sk`, que abrió un diálogo de Windows Security pidiendo insertar la llave
física en el puerto USB. Nadie lo pidió y el usuario lo vio aparecer solo en su máquina.
**Why (root cause):** la consigna confundía dos verificaciones distintas. Comprobar que OpenSSH
*acepta* `-O no-touch-required` se hace leyendo `ssh-keygen -h` o el manual; comprobar que
*funciona* exige crear una credencial. Al no decir cuál de las dos alcanzaba, el agente eligió la
más concluyente, que es también la que toca la máquina del usuario. La ironía cierra el caso: el
panel concluyó que la firma es teatro porque el agente puede fabricar las claves, y para
demostrarlo un agente empezó a fabricar una.
**How to avoid:** toda consigna adversarial declara el modo de verificación. Por defecto es
lectura: documentación, código fuente, `--help`. Un subagente no ejecuta comandos que generen
credenciales, escriban en `~/.ssh`, `~/.gnupg` o el almacén de claves del sistema, ni que abran
diálogos del sistema operativo. Si la hipótesis sólo se decide ejecutando, el agente lo reporta y
para: lo autoriza una persona, no la consigna.
**Detection signal:** un informe de subagente que dice haber verificado «contra el binario de esta
máquina» algo sobre claves, firmas o credenciales. También cualquier diálogo del sistema que
aparezca sin que el usuario haya pedido nada. Grep de arranque: `ssh-keygen`, `gpg --gen-key`,
`--full-generate-key`, `certutil`, `New-SelfSignedCertificate` en prompts de agentes.
**Confidence:** high

## [2026-09-01] LESSON-5 Un diagnóstico que sólo mira el árbol de trabajo mide la máquina del autor — status: active

**Project/phase/run:** vibecodeprotocols/fase-0/mejora-integral-vcp-2026-09-01
**What happened:** la Fase 0 de preflight corrió 20 gates sobre el checkout y los 20 salieron
verdes. El primer clon del mismo commit mostró tres defectos en minutos: 215 de 229 archivos
llegaban CRLF y rompían la cadena de hashes de Discovery, tres de los cuatro verificadores de
research reventaban con un stack trace en vez de rechazar, y el gate de cobertura declaraba 30/30
al 100 % sobre 10 funciones o ramas que ningún proceso ejecutaba. Ninguno era detectable desde
adentro.
**Why (root cause):** el árbol de trabajo del autor tiene estado que ningún clon tiene —archivos
generados, finales de línea ya normalizados, directorios que `.gitignore` excluye— y ese estado
tapa exactamente los defectos que sólo aparecen sin él. Un diagnóstico hecho ahí no mide el
proyecto: mide una máquina.
**How to avoid:** la fase de diagnóstico clona antes de concluir, no al verificar. `git clone` del
propio repositorio a un directorio temporal y correr ahí los mismos gates es de segundos, y va
**antes** de escribir el informe de hallazgos, no después de arreglarlos.
**Detection signal:** un informe de estado, auditoría o preflight cuyos comandos corren todos con
el cwd en el checkout vivo. Grep del reporte: si ninguna evidencia menciona `clone`, `mkdtemp` o un
directorio temporal, el diagnóstico no salió del árbol del autor. Aplica aunque no haya nada que
instalar — ése es el hueco que deja `[overlaps with: LESSON-2]`, cuya señal nombra instaladores,
empaquetadores y exportadores, y por eso no habría marcado esta fase.
**Confidence:** high

**Nota de dedup:** `[overlaps with: LESSON-2]` — «Probar desde afuera antes de declarar terminado».
Se mantiene separada a propósito: LESSON-2 gobierna lo que se instala o se distribuye y su remedio
es verificar en destino; ésta gobierna la fase de diagnóstico, que no instala nada y cuyo remedio
es clonar antes de concluir. Anotada, no fusionada.
**Nota de pre-chequeo:** ⚠ coincidencia con `hash` en el barrido de contenido sensible. Es «cadena
de hashes de git», no un secreto. Marca, no bloqueo.
