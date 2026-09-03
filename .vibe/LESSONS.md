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

## [2026-09-01] LESSON-6 Un resumen puede ser coherente consigo mismo y falso — status: active

**Project/phase/run:** vibecodeprotocols/bloque-c/repineado-research-2026-09-01
**What happened:** al revalidar los 14 commits pineados del research, el resumen dijo
`IGUAL: 0  DERIVO: 14`. Era falso: el contrato guarda commits de 8 caracteres y yo los comparaba
contra los 40 del HEAD remoto, así que ninguno podía coincidir nunca. El error se vio sólo porque
miré las filas: la primera decía `pineado=ad67087c  head=ad67087cad22`, que es el mismo commit.
Con la comparación por prefijo el resultado real fue 5 iguales y 9 movidas.
**Why (root cause):** el resumen se calcula a partir de las mismas filas que contiene, así que un
error en el criterio de comparación se propaga a los dos por igual y quedan de acuerdo. La
coherencia interna no es evidencia: un contador que cuenta mal cuenta mal en las dos columnas.
**How to avoid:** antes de publicar un agregado, mirar al menos una fila cruda y comprobarla a
mano contra lo que el agregado afirma sobre ella. Una sola alcanza para detectar un criterio roto.
**Detection signal:** un total redondo o extremo —todos, ninguno, 0 %, 100 %— sobre una comparación
que uno mismo escribió esa misma corrida. También: un resumen que se reproduce idéntico al
repetirlo, porque el determinismo no distingue «correcto» de «consistentemente equivocado».
**Confidence:** high

**Nota de dedup:** adyacente a `LESSON-3` («una medición sobre código que se mueve no es una
medición»), pero no la misma: la señal de LESSON-3 es un resultado que **no** se reproduce, y éste
se reproduce perfecto todas las veces. LESSON-3 no lo habría marcado. Anotada, no fusionada.

## [2026-09-01] LESSON-7 Una guardia sin prueba que la haga fallar puede estar ciega — status: active

**Project/phase/run:** vibecodeprotocols/bloque-a/spawn-budget-2026-09-01
**What happened:** escribí una guardia que debía acusar presupuestos de tiempo escritos a ojo en
los archivos de prueba. Barrió 63 archivos y devolvió cero violaciones, y había dos. El escáner
construía su expresión regular con un template literal, donde `\s` degrada a `s`: el patrón quedó
`timeout_msss*:...` y no podía coincidir con nada. Lo delataron sus propias pruebas de
FALSIFICACIÓN, que le pasaban entrada sintética con violaciones conocidas y exigían que las
acusara. Sin ellas habría publicado un verde que no miraba nada.
**Why (root cause):** «no encontré nada» y «no puedo encontrar nada» producen exactamente la misma
salida. Una guardia probada sólo contra entrada limpia confirma la primera lectura y nunca examina
la segunda, y cuanto más limpia esté la base, más convincente se ve el verde vacío.
**How to avoid:** toda guardia, escáner o comprobación llega con al menos una prueba que le pasa
entrada sintética que **sí** viola la regla y exige que la acuse por nombre. Se escribe junto con
la guardia, no después: es lo único que distingue el cero real del cero ciego.
**Detection signal:** una función que devuelve una lista de hallazgos y cuyas pruebas sólo la
corren sobre casos válidos esperando `[]`. También: un barrido nuevo que sale limpio en su primera
corrida sobre una base que nadie había barrido antes.
**Confidence:** high

**Nota de dedup:** `[overlaps with: LESSON-1]` — «Enumerar defectos leyendo código no alcanza»,
cuyo run se llama `verde-vacio`. Se mantiene separada: LESSON-1 gobierna la lista armada leyendo,
sin programa que la reproduzca, y su remedio es escribir la sonda. Acá la sonda existía y era
ciega, así que LESSON-1 no la habría marcado. Anotada, no fusionada.
**Nota de pre-chequeo:** barrido de contenido sensible sobre las dos entradas: cero coincidencias.

## [2026-09-01] LESSON-8 Un identificador que resuelve no es un identificador correcto — status: active

**Project/phase/run:** vibecodeprotocols/bloque-c/vinculo-de-claim-2026-09-01
**What happened:** cuatro claims de research no enlazaban ningún criterio y el cierre estricto los
rechazaba. Al ir a enlazarlos apareció que el gate resolvía los vínculos contra `docs/spec.md`
fijo, que rota con el feature activo, mientras que el packet es inmutable y pertenece al suyo. Los
vínculos correctos eran T01/AC1, T02/AC5, T03/AC8 y T04/AC10: contra la spec activa, `AC1` y `AC5`
habrían salido **verdes** —esa spec también los declara, para otra cosa— y los otros seis rojos. El
verde no habría probado que el claim apunta a su criterio, sólo que ese string aparece en negrita
en el archivo que hoy toca.
**Why (root cause):** el gate comprobaba pertenencia a un conjunto —¿está este string declarado en
este archivo?— y la presentaba como prueba de referencia —¿este claim apunta a ese criterio?—. Con
un espacio de nombres corto y reutilizable (`AC1`, `AC2`, `T01`) y un archivo que rota, la
pertenencia se cumple por coincidencia y la referencia no.
**How to avoid:** cuando una comprobación resuelve un identificador contra un documento, el
documento es argumento explícito y queda nombrado en la salida, nunca una constante fija dentro de
la función. Un identificador de espacio corto sólo significa algo junto al documento al que
pertenece; sin decir cuál, un verde no es evidencia.
**Detection signal:** una constante de ruta fija (`SPEC_PATH`, `DEFAULT_*`) usada dentro de una
función que ya recibe el identificador de la entidad a verificar (`featureSlug`). También: dos
artefactos inmutables de features distintos que resuelven contra el mismo archivo mutable, y un
mensaje de verde que no nombra el archivo contra el que resolvió.
**Confidence:** high

**Nota de dedup:** `[overlaps with: LESSON-6]` — «un resumen puede ser coherente consigo mismo y
falso». Se mantiene separada: en LESSON-6 la comparación estaba mal hecha (8 caracteres contra 40)
y el resultado era basura; acá la comparación es exacta y correcta, y lo que falla es **contra qué**
se compara. Adyacente también a `LESSON-7` («una guardia sin prueba que la haga fallar puede estar
ciega»): allá el verde no miraba nada, acá miraba —el archivo equivocado—, así que ninguna de las
dos la habría marcado. Anotada, no fusionada.
**Nota de pre-chequeo:** barrido de contenido sensible sobre el commit `383cf4b`, entrada de esta
lección: cero coincidencias.

## [2026-09-03] LESSON-9 Un caso de prueba inventado no encuentra lo que encuentra el dato real — status: active

**Project/phase/run:** vibecodeprotocols/fase-9/gates-contra-datos-reales-2026-09-03
**What happened:** dos gates nuevos —el de la limpieza y el de la forma de los menús— salieron con
su batería completa en verde y con pruebas de falsificación. Aplicarlos después a datos que ya
existían encontró **seis defectos, los seis del gate**: exigía que el origen desapareciera cuando
el contrato manda archivar por líneas; exigía copia en disco cuando el procedimiento prescribe git;
mecanizaba como AND un filtro que el prompt define como juicio; comparaba `~/` literal, así que una
ruta de home al estilo de Windows correctamente archivada se reportaba como borrada; aceptaba una
sola redacción de la línea de espera; y era ciego a los menús escritos en el formato viejo. Ninguno
lo encontró un caso de prueba.
**Why (root cause):** los casos de prueba los escribe la misma persona que escribió el gate, en el
mismo rato y con el mismo modelo mental. Por construcción sólo pueden contener las formas que esa
persona ya tenía en la cabeza. El dato real trae las formas que nadie eligió: la ruta que la escribió
otro sistema operativo, la frase que quedó a mitad de oración, el archivo que se archivó del modo que
el procedimiento prescribe y el gate no previó. La falsificación ayuda contra el verde vacío, no
contra el punto ciego: una prueba que falsifica lo que el autor imaginó sigue estando adentro de lo
que el autor imaginó.
**How to avoid:** un gate no cierra con su batería en verde. Cierra cuando corrió contra el artefacto
real más viejo y más raro que haya en el repositorio o en el disco, y contra el que produjo otra
máquina. Si no existe un dato real todavía, decirlo como límite en vez de contarlo como cobertura.
**Detection signal:** un gate nuevo cuyas pruebas construyen **todas** sus entradas con un helper del
propio archivo de pruebas (`registro()`, `menu()`, `doc()`), sin un solo caso leído del repositorio.
También: un gate que en su primera corrida sobre datos reales acusa algo que estaba bien.
**Confidence:** high

**Nota de dedup:** `[overlaps with: LESSON-1]` — «enumerar defectos leyendo código no alcanza». Se
mantiene separada porque LESSON-1 termina donde ésta empieza: allá el salto es de **leer** a
**ejecutar**, y acá ejecutar ya se hacía —1065 pruebas verdes— y no alcanzó; el salto es de
**ejecutar contra lo que inventé** a **ejecutar contra lo que ya existe**. Adyacente también a
`[overlaps with: LESSON-2]` («probar desde afuera antes de declarar terminado»), cuya señal nombra
instaladores y destinos limpios: acá no hay instalación de por medio y el destino es el repositorio
de siempre, así que esa señal no lo habría marcado. Anotada, no fusionada.
**Nota de pre-chequeo:** barrido de contenido sensible sobre la entrada de esta lección: cero
coincidencias — no nombra rutas de usuario, tokens ni claves.
