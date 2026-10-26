## PHASE 9 — LIMPIEZA (cada 7 días, al abrir sesión)

**9.0 El tablero** (mismo período de 7 días, misma lógica de `due`):

```bash
node .vibe/ia-stack-runtime/scripts/tablero.mjs due
node .vibe/ia-stack-runtime/scripts/tablero.mjs build
node .vibe/ia-stack-runtime/scripts/tablero-servidor.mjs serve
```

Genera una página local con proyectos, sesiones, turnos, tokens y una **banda** de horas. Se abre
con doble clic; el comando imprime la ruta y no abre nada por su cuenta.

Tres cosas que el tablero hace a propósito, y que conviene no "arreglar":

- **Escribe fuera del árbol** (`%LOCALAPPDATA%\ia-stack\` o `$XDG_STATE_HOME/ia-stack/`) y **se
  niega** a escribir adentro de un repositorio. Agrega datos de todos tus proyectos: ahí adentro los
  publicaría el próximo commit.
- **Los tokens van deduplicados por identificador de mensaje.** Sumar líneas los infla hasta 2,67×,
  medido.
- **Las horas son una banda, no un número**, con su umbral a la vista. No hay valle en la
  distribución que justifique uno: elegirlo mueve el resultado más que cualquier error de medición.

**Sin tabla de precios no muestra dinero**, y dice por qué. Escribí la tuya en `precios.json`, dentro
de esa misma carpeta, si querés la columna.

**9.0.1 El bucle de auto-mejora** (mismo período de 7 días, misma lógica de `due`):

```bash
node .vibe/ia-stack-runtime/scripts/verify-sereno.mjs due
```

Si toca, el agente mira lo que se hizo y escribe **como mucho cuatro** propuestas en
`docs/mejoras/AAAA-MM-DD.json`, copiando la forma de `templates/mejoras.json`. Después:

```bash
node .vibe/ia-stack-runtime/scripts/verify-sereno.mjs check docs/mejoras/AAAA-MM-DD.json
```

Las cuatro reglas, y por qué cada una:

- **Tope de cuatro.** Una lista de veinte no se lee, se archiva. El tope es la feature, no un límite
  técnico.
- **Cada propuesta cita archivo y texto exacto**, y el gate busca ese texto en ese archivo. Una
  propuesta sin origen verificable es una opinión con formato de hallazgo.
- **Ningún campo ejecutable.** El bucle sugiere, nunca corre. Un registro con un comando adentro
  invita a correrlo sin leerlo.
- **El agente escribe, la persona decide.** El gate no aplica ninguna mejora; aplicar, saltear o
  copiar es click humano.

**Lo que este gate NO puede hacer:** comprueba que la propuesta tenga origen, no que valga la pena. Y
que el texto citado esté ahí, no que signifique lo que la propuesta dice que significa.


**9.0.2 La autolimpieza** (mismo período de 7 días, al abrir sesión). Un proyecto acumula carpetas que
nadie ejecuta ni lee: copias viejas, temporales de corridas matadas, lo que una poda aparta. La regla es
una sola: **nada se borra de entrada**. Todo candidato se mueve primero a una cuarentena, y sólo una
purga posterior, vencida la retención, lo elimina de verdad.

```bash
node .vibe/ia-stack-runtime/scripts/autolimpieza.mjs listar contracts/autolimpieza.json
node .vibe/ia-stack-runtime/scripts/autolimpieza.mjs aplicar contracts/autolimpieza.json
node .vibe/ia-stack-runtime/scripts/autolimpieza.mjs purgar contracts/autolimpieza.json
node .vibe/ia-stack-runtime/scripts/verify-autolimpieza.mjs check contracts/autolimpieza.json
```

El agente corre `listar` y **le muestra la lista a la persona**: `aplicar` y `purgar` se piden con un menú
de opciones y nunca en silencio, salvo que el plan aprobado en modo continuo los incluya. Las reglas, y por qué:

- **Lista blanca positiva.** Sólo es candidato lo que cae en una categoría del contrato, con su raíz,
  su prefijo, su edad mínima y **cómo se regenera**. Lo demás es intocable; y lo que
  `contracts/irreplaceable-sources.json` nombra no se mueve ni se purga **nunca**, ni desde la cuarentena.
- **`aplicar` se niega si la cuarentena no está ignorada por git**: lo que se aparta puede ser cualquier
  cosa del proyecto, y el primer `git add` del árbol entero se lo llevaría.
- **Cada acción queda sellada** en `.vibe/LIMPIEZA.md` con la cadena de `verify-audit-chain.mjs`, y el
  verificador compara ese registro con lo que hay en disco.
- **Los números son del contrato**, no del protocolo: la retención y la edad mínima del contrato de este
  repositorio son **supuestos**, y se cambian ahí.

**Lo que esta fase NO puede hacer:** el verificador comprueba que el registro es consistente, no que lo
movido fuera lo correcto ni que su contenido no importara. No hay exclusión entre dos corridas
simultáneas, y una cuarentena en el mismo disco no protege de un fallo del disco.

**Qué es, en una línea.** Cada skill, cada regla y cada hook que tenés configurado se le carga al
modelo **antes** de que escribas la primera letra. Lo que ya no sirve no es neutral: ocupa lugar y
compite con lo que sí importa. Esta fase saca lo que sobra **sin perder nada**.

**Cuándo.** Al abrir sesión, si pasaron 7 días desde la última limpieza. Eso **se calcula, no se
recuerda** — la fecha de la última corrida vive en `docs/ablation.json`:

```bash
node .vibe/ia-stack-runtime/scripts/verify-ablation.mjs due docs/ablation.json
```

Si nunca se limpió, dice que toca. IA Stack te lo ofrece con un menú y **nunca mueve un archivo sin tu
click**.

**Cuando lo archivado volvió a su lugar, el gate lo distingue — y cómo.** Hasta el 2026-09-08 un
archivo que reaparecía en su origen era un rechazo fijo, sin importar por qué: el gate leía el disco
y tenía razón sobre el disco, y estaba equivocado sobre lo que había pasado. Pasó de verdad con una
skill reinstalada a propósito y dejó este repositorio con **un rojo ajeno durante dos etapas
enteras**. Un rojo correcto y engañoso a la vez es lo peor que le puede pasar a un chequeo: quien lo
lee concluye que la limpieza no se hizo.

Ahora, en esa celda, **dos sondas le preguntan al árbol y nunca al registro**:

- **La huella.** El objeto que quedó archivado en ese commit contra la huella que git le daría hoy
  al archivo que está en el origen. Si difieren, lo que volvió **no es** lo que se archivó.
- **La historia.** ¿Hay un commit que borró esa ruta entre el archivado y HEAD? Un renombrado se
  descarta: un `git mv` se lee como borrado sobre la ruta vieja, y sin ese acote una reorganización
  de carpetas encendería la sonda sola.

Cualquiera de las dos que conteste convierte el rechazo en un **aviso** con la evidencia impresa, y
el chequeo sigue en verde. **Las dos calladas dejan el rechazo exactamente como estaba**: una sonda
que falla —commit inalcanzable, archivo ilegible, repositorio ausente— es *sin evidencia*, nunca una
prueba. Ninguna sonda puede inventar un verde.

**Lo que sigue sin poder probar**, y hay que decirlo. Primero:
**una restauración byte a byte idéntica y sin rastro en la historia sigue en rojo**,
porque en el disco es indistinguible de un archivado que nunca ocurrió. Segundo, el aviso
**dice que esto no es un archivado que no ocurrió, nunca por qué el archivo volvió**,
y eso lo sabe una persona y no un chequeo. Y tercero, **fecha el archivado, no el regreso**: la
historia guarda cuándo el archivo salió del árbol, no cuándo alguien lo puso de vuelta.

**El orden importa y es siempre el mismo:**

1. **Actualizar** — el grafo de conocimiento se pone al día con lo que se hizo.
2. **Compactar** — `.vibe/SESSION.md` y `.vibe/RETRO.md` se resumen: lo largo se vuelve corto sin
   perder el hecho. **Es un paso a mano y no hay ningún comando que lo haga**, así que ningún gate
   lo verifica: se hace, se anota en `AUDIT.md` y ahí termina la garantía. Lo que **no** se compacta
   nunca es `AUDIT.md` ni `LESSONS.md` — están en la lista de intocables por eso mismo.
3. **Limpiar** — recién acá se archiva, por tandas y midiendo.
4. **Respaldar** — todo lo archivado entra al grafo y a Obsidian, para poder consultarlo después
   sin restaurarlo.

Por eso no se pierde nada: cuando algo se saca de en medio, su contenido ya está en dos lugares.
El respaldo **no es una promesa**: el registro lleva un campo `backup` con la evidencia de los dos
pasos, y sin él la fase no cierra. Plantilla del registro: `templates/ablation.json`. Grafo y
Obsidian son opcionales (`skills/integracion-graphify.md`): un destino que el proyecto no usa se
declara con `done: false` y `evidence: "ninguno — <motivo>"`, nunca se calla. Si los dos son
`ninguno`, lo archivado vive sólo en la cuarentena y en git: es válido, y el reporte de la fase lo
dice con esas palabras.

### La regla de oro

**Acá no existe `rm`.** Nada se borra. Todo se **mueve** a `.claude-archive/<fecha>/` conservando la
ruta, y la vuelta atrás es un solo comando. Si en algún momento parece que la única salida es
borrar, se para y se pregunta. Los patrones intocables viven en `contracts/ablation-scope.json` —
entre ellos los fuentes que el repositorio no versiona, cuya pérdida sería irreversible.

**El archivo puede ser git, y muchas veces conviene que lo sea.** Si la configuración está bajo
git —y el primer paso de la limpieza es justamente `git init` + commit si no lo está—, sacar un
archivo del árbol no lo pierde: queda en el commit anterior. Eso se declara con `mode: "git"`, el
repositorio y el **sha completo**, y el gate **le pregunta a git** si el objeto está ahí. Un sha
corto o un `HEAD~1` no valen: una referencia que se mueve no es un archivo.

**Un archivo sale entero o sale por líneas.** `CLAUDE.md` es el caso típico del segundo: la parte
de datos que el modelo no puede adivinar —tus rutas, tu tono, tus reglas— se queda, y la que le dice
cómo razonar se va. Eso se declara con `mode: "lines"` y el rango, y ahí el archivo **sigue en su
lugar**, recortado. Sin ese modo, el gate exige que el origen haya desaparecido.

**El comando de vuelta atrás no puede borrar.** Si contiene `rm`, `del`, `Remove-Item` o
`git clean`, el gate lo rechaza: la vuelta atrás mueve de vuelta, nunca elimina. Y el destino
conserva la ruta de origen, porque el rollback mueve el árbol entero y un archivo aplanado no vuelve
al lugar del que salió. La carpeta del archivo va al `.gitignore`: lo archivado es configuración con
datos propios y no se commitea nunca.

### El filtro de las tres R

Para cada archivo se responden tres preguntas de sí o no. **Alcanza que una diga que sí para que
se quede:**

- **¿Repetible?** ¿Es una tarea que hacés exactamente igual más de tres veces por mes?
- **¿Requisito?** ¿Tiene un dato que el modelo no puede adivinar — tu tono, tus rutas, tus reglas?
- **¿Repartible?** ¿Se lo pasarías a otra persona para que le funcione igual que a vos?

**El filtro de las tres R es un juicio con las tres respuestas a la vista, no una cuenta
mecánica.** Lo que no aprueba ninguna se archiva sin discusión. Lo que aprueba alguna **puede**
archivarse igual, pero entonces hay que escribir por qué el juicio va en contra de esa respuesta —
y el gate exige un motivo más largo justamente ahí. Ejemplo real: una skill genérica aprueba
"repartible" porque cualquiera podría usarla, y esa misma generalidad es lo que la hace
prescindible acá. Y hay una señal aparte que conviene mirar primero: lo que son
**instrucciones de cómo pensar** en vez de datos o límites. Eso es lo primero que sobra, porque le
saca al modelo su mejor camino en vez de darle información.

### Medir, no suponer

Archivar sin medir es borrar con buena letra. Antes de mover el primer archivo se acuerdan **entre
6 y 8 tareas tuyas reales** y se corre la línea base. Después se archiva **de a cinco como máximo**
y se vuelve a correr el mismo set. Si algo empeora, se devuelven **las líneas mínimas** que arreglan
la regresión — no el archivo entero — y se mide otra vez. De a cinco, porque con una tanda más
grande sabés que algo empeoró pero no cuál.

```bash
node .vibe/ia-stack-runtime/scripts/verify-ablation.mjs check docs/ablation.json
```

### El registro se publica redactado

Las tareas tienen que ser reales, y el registro se **commitea**. Eso son dos exigencias que
chocan, y hay que resolverlas a mano porque **ningún gate puede hacerlo**: distinguir un nombre de
producto de un nombre de módulo requiere saber de qué proyecto se trata.

Antes de commitear el registro, se le sacan **las cuatro cosas que no son de este proyecto**:

1. **Nombres de producto y versiones.** «el expert advisor», no el nombre y el número de versión.
2. **Rutas internas de otro árbol.** «el módulo de optimización», no la ruta con su archivo y su
   línea. **Ninguna referencia `archivo.ext:línea` sobrevive a la redacción**, y hay una prueba que
   lo comprueba por la forma y no por una lista de nombres: una lista sólo encuentra lo que ya
   pensó quien la escribió, y así fue como la primera redacción se dejó una adentro.
3. **El modelo de negocio.** Quién paga, quién descarga, cómo se licencia.
4. **Todo hallazgo de seguridad con archivo y línea.** Queda el **número** —«18 clases de
   vulnerabilidad contra 15 de la línea base»—, que es lo único que la ablación necesita. **La
   ubicación no se transcribe nunca.**

Lo que sobrevive a la redacción sigue siendo la tarea real, descrita sin nombrar el producto, y la
medición no cambia: se midió lo mismo.

**Por qué está escrito acá y no es una obviedad.** Esta regla existe porque faltó. El registro del
2026-09-02 de este mismo repositorio —que es **público**— se commiteó con el nombre de otro
producto del autor, sus rutas internas y **un un hallazgo de seguridad con archivo, línea y la explicación del escaper
que falla**. La fase pedía realismo y no decía nada sobre publicar. Y una vez publicado, sacarlo
de la punta **no lo despublica**: queda en la historia.

**Lo mismo vale para `PROJECT.md`.** La sección de rutas sensibles es, por definición, una lista de
dónde vive lo que importa proteger. En un repositorio público eso es un mapa. Va con los nombres de
**tu** árbol, nunca con los de otro proyecto tuyo.

### Qué lleva el registro

El registro es el único lugar donde queda lo que pasó, así que el gate exige **exactamente** estos
doce campos — ni uno menos, ni uno de más. La plantilla `templates/ablation.json` ya los trae
vacíos; esto es qué significa cada uno:

| Campo | Qué guarda |
| --- | --- |
| `schema` | La versión del formato, para que un registro viejo no se lea como uno nuevo. |
| `run_id` | La fecha de esta limpieza. De acá sale la cuenta de los 7 días. |
| `archive_dir` | La carpeta a donde se movió todo. Todo lo archivado tiene que caer adentro. |
| `rollback_command` | El comando exacto que devuelve todo a su lugar. **No puede contener `rm`.** |
| `rollback_tested` | La prueba de que ese comando se corrió de verdad una vez, con su evidencia. |
| `test_set` | Las 6 a 8 tareas tuyas reales. Cada una con `test_id`, `task` y `why_representative`. |
| `baseline` | Cómo salió cada tarea **antes** de tocar nada. |
| `inventory` | Todo lo que había, con su tamaño. Sin esto no se puede decir cuánto se sacó. |
| `batches` | Las tandas: qué se archivó, por qué, y cómo salió la medición después. |
| `survivors` | Cada archivo que quedó, con una frase de por qué. |
| `totals` | El antes y el después en palabras. Es el número que se puede mostrar. |
| `backup` | La evidencia de los dos respaldos —grafo y Obsidian—, o `ninguno — <motivo>` para el que el proyecto no usa. Sin esto la fase no cierra. |

**`why_representative` es el campo que más se salta y el más importante**: dice por qué esa tarea
representa tu trabajo. Sin él, el set se elige para que dé bien.

Cada archivo del inventario lleva uno de tres veredictos: **`QUEDA`** (se queda entero),
**`ARCHIVAR`** (sale entero) o **`REESCRIBIR`** (se queda recortado, que es lo que pasa cuando se
sacan líneas de un archivo que sobrevive, como `CLAUDE.md`).

### La fase no cierra hasta que se cumplen las cuatro

1. El set de pruebas sale igual o mejor que la línea base, y se puede mostrar.
2. Todo lo archivado tiene una razón escrita.
3. La vuelta atrás se probó una vez de verdad: restaurar, verificar, volver a limpiar.
4. Se puede decir en una frase por qué sobrevive cada archivo que quedó.

Si falta alguna, no se cierra: se dice cuál falta y qué hace falta de tu parte.

### El menú

🔵 **Pasaron 7 días desde la última limpieza**

- **A)** Limpiar ahora — acordamos el set de pruebas, mido, y archivo de a cinco — *(recomendado)*
- **B)** Mostrarme primero qué se archivaría — inventario y veredictos, sin mover nada
- **C)** Posponer una semana
- **D)** No preguntarme más — se apaga el recordatorio

Esperando tu respuesta antes de continuar.

**La lista de intocables protege de más, nunca de menos.** Un patrón se compara contra la ruta
normalizada —sin `./`, sin `..`, sin letra de unidad, sin `~/`— y contra **cada uno de sus
sufijos**, sin distinguir mayúsculas. Eso quiere decir que `src/**` protege también un `src/`
anidado en cualquier lado, y un patrón de extensión protege también su variante en mayúsculas —en
Windows son el **mismo archivo**—. Es a propósito: cuando lo que está en
juego es mover un archivo que no está en git, proteger de más cuesta una molestia y proteger de
menos cuesta el archivo. Medido antes de esto: la extensión en mayúsculas, la carpeta a secas, el
prefijo `./` y la ruta absoluta esquivaban las cuatro la protección.

**Límite honesto.** El gate verifica el **registro** de la limpieza, no la limpieza: no corre tus
pruebas, no juzga si son representativas y no sabe si un resultado que dice «igual» era igual. Un
registro coherente e inventado pasa en verde. Lo que sí comprueba contra el disco es la regla de
oro: cada archivo archivado tiene que estar en el archivo y ya no en su lugar.
