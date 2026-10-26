## PHASE 8 — DEPLOY

Publicar es una fase con sus propios chequeos, no el último renglón de otra. Tenerlo escondido
adentro del cierre es lo que hizo que el hallazgo 55 —el sello del backup atado al commit
equivocado— tardara en aparecer.

**8.0 Auditoría de despliegue** — antes del commit, no después. El receipt certifica que el árbol
commiteado es el revisado; **no certifica que la cosa arranque**, y hasta acá el protocolo no tenía
nada que lo hiciera.

```bash
node .vibe/ia-stack-runtime/scripts/verify-security-baseline.mjs check --base <merge-base-u-origin/main>
node .vibe/ia-stack-runtime/scripts/verify-deploy.mjs check --feature <feature-slug> --require-inputs
```

**El escáner se vuelve a correr acá, y no es ceremonia:** 6.2 corre antes de 6.3, de 6.4 y de toda
la fase 7, así que un secreto que entra en un fix de revisión o en el refactor **no lo mira nadie**.
Este es el único momento en que se escanea el estado que efectivamente se va a commitear.

El expediente `docs/deploy/<feature-slug>.json` (plantilla: `templates/deploy.json`) declara tres
cosas que no estaban en ningún lado:

- **Dependencias: se declara el inventario, no se auditan.** IA Stack no tiene SCA y ese límite está
  pineado en `contracts/honest-limits.json`; proponer uno acá sería romper la promesa o mentir. Lo
  que se exige es que quede escrito **quién auditó** — y `"ninguno — <motivo>"` es una respuesta
  válida, mientras el silencio no lo sea. Misma doctrina que `VACÍO:` ≠ `OK:`.
- **Lo que Git ignora y parece sensible se nombra, sin leerlo.** Hoy eso es un agujero **declarado**:
  `verify-scope-diff` enumera con `--exclude-standard`, y el límite dice textualmente que «un .env
  con un secreto no lo mira ningún gate del protocolo». Acá se mira, y se declara con su motivo.
- **La reversión, con la misma prohibición que la fase 9 ya tiene**: `rollback_command` no puede
  contener `rm`, `del`, `Remove-Item` ni `git clean` —la vuelta atrás mueve de vuelta, nunca
  elimina— y `rollback_tested` trae la evidencia de haberlo corrido una vez.
- **Los datos, si el cambio los toca** (`.vibe/PROJECT.md` § Producción dice que hay datos reales, o el
  cambio modifica la forma de la base —el esquema—): el expediente declara `datos` con
  `cambia_esquema`, el `respaldo` —qué copia de los datos se hizo y dónde, antes de tocarlos— y la
  `vuelta_atras` de los datos, que no es la del código: revertir un commit no devuelve una columna
  borrada. Cada uno admite `ninguno — <motivo>`, nunca el silencio. `verify-deploy` lo valida cuando
  está; un expediente anterior a la 3.4.0, sin `datos`, sigue pasando.

**Nada de esto se escribe de cero.** Sale de lo que ya está declarado y nadie volvía a leer: el
`rollback` de la tarea en `docs/tasks.json` → `deploy.rollback_command`; los gates de LAW 8 y el
recibo → lo que condiciona publicar; `prd.rollout` → el orden de promoción; `prd.rollback` → el
plazo.

> Los dos primeros salían de `implementation.json` hasta el 2026-09-15, y ése era **todo su uso
> real**: dos campos que se escribían en la fase 2 y leía una sola línea de esta fase, nunca un
> gate. El `rollback` por tarea dice lo mismo y mejor —se revierte una tarea, no un lote—, y lo que
> de verdad condiciona publicar ya lo decide LAW 8, no un texto escrito seis fases antes.

**8.0.1 Comprobación por HTTP, sólo en esta máquina.**

```bash
node .vibe/ia-stack-runtime/scripts/verify-deploy.mjs health --feature <feature-slug>
```

Tres resultados mecánicos, **calcados del gate de lint/typecheck** de 6.1, que es un patrón que este
protocolo ya tiene resuelto y probado:

- **Declarado y arranca** → gate de verdad: se piden las rutas de `service.health` y cada una tiene
  que dar el estado esperado. Exit ≠ 0 bloquea.
- **Declarado y no arranca** → **BLOQUEA**. Esto nunca es «no aplica».
- **`service.declared: false`** → no aplica, y se registra con la evidencia de la detección.

**Acá se aplica la regla que nació en la fase 5: el estado precede al contenido.** El registro
guarda `status_matched` y `body_matched` como campos separados, y **un `body_matched: true` con el
estado equivocado es rechazo**. Un 404 tiene cuerpo, y ese cuerpo tampoco trae los campos que la
comprobación dice no encontrar.

**«Nunca internet» es un chequeo, no una promesa**: el host se resuelve **antes** de abrir la
conexión y, si no da loopback, el gate rechaza. Límite propio, declarado: comprueba que el servicio
responde **en esta máquina**, nunca que un despliegue remoto esté sano.

**8.0.2 Promoción** — el 🔵 de publicar (8.1, abajo) no se ofrece hasta que 8.0 y 8.0.1 estén en
verde. Un cambio que no sabe cómo volver atrás no se promueve.

**8.1 Commit/push/merge** — gate previo, mecánico, no de lectura:
Antes de preparar el commit, cerrá el registro de elecciones de todas las fases declaradas:
```bash
node .vibe/ia-stack-runtime/scripts/verify-phase-decisions.mjs check docs/phase-decisions.json --require-complete
```
Si falta una fase, su menú o su elección, el deploy se detiene. Este flag no prueba voluntad humana;
prueba que ninguna fase declarada quedó sin registro.

```bash
node .vibe/ia-stack-runtime/scripts/verify-receipt.mjs check .vibe/receipts/<feature-slug>-<fecha>.json \
  --require-clean-worktree
```
`--require-clean-worktree` exige además que no queden paths unstaged ni untracked: el árbol
revisado y el árbol commiteado deben ser el mismo. Angosta, sin cerrarla, la ventana entre `check`
y `git commit` — nada impide una escritura en el medio. Un `check` sin la flag sigue siendo válido
para un receipt intermedio, donde atestiguar trabajo sin stagear es exactamente lo correcto.

**Preferible: validar y escribir en una sola corrida.**
```bash
node .vibe/ia-stack-runtime/scripts/verify-receipt.mjs commit .vibe/receipts/<feature-slug>-<fecha>.json \
  --message "<mensaje del commit>"
```
Valida igual que `check --require-clean-worktree`, commitea, y **después confirma** que el árbol
commiteado es el índice que validó (compara el `write-tree` de antes contra `HEAD^{tree}` de
después). Si esa confirmación falla, informa qué no coincide, **deja el commit hecho** e imprime
el comando para deshacerlo: este gate nunca reescribe historial por su cuenta. Tampoco pasa
`--no-verify`: un gate que se saltea los hooks del operador en silencio es peor que el problema
que resuelve.

**Lo que no prueba**: la ventana pasa de minutos a milisegundos, no desaparece — otro proceso
puede escribir en ese instante. La confirmación posterior demuestra que el commit contiene el
índice revisado; no demuestra que no hubo una escritura concurrente.

**Si cerraste por el camino manual** —`check --require-clean-worktree` y `git commit` a mano—,
recomprobá después que lo commiteado sea lo que el recibo certifica:
```bash
node .vibe/ia-stack-runtime/scripts/verify-receipt.mjs recheck .vibe/receipts/<feature-slug>-<fecha>.json
```
Lee el recibo y cada test del commit que lleva el recibo, no del disco. Existe porque en un proyecto
real aparecieron recibos que certificaban versiones del test que nunca se guardaron. Detalle y
límites en `skills/receipt.md`.

Exit 0 **únicamente** si `schema: ia.receipt/v3` Y `terminal_state: approved` Y **todos** los
`acceptance_criteria` son `COMPLIANT` (con hash de test vigente) Y el fingerprint matchea el
estado evaluado actual Y `evidence`/`reproduction`/`not_reviewed`/`limits`/`regressions`/`support`/
`refutation` pasan su validación de forma → proceder. Exit 1 en cualquier otro caso — receipt
ausente, stale, `schema: ia.receipt/v1` o `ia.receipt/v2` (archivísticos, nunca pasables por
`check` — ver abajo), cualquier AC no-`COMPLIANT`, hash de test desactualizado, medición `-1` sin
motivo, `not_reviewed` placeholder, una regresión `accepted_by_user` cuyo `user_decision_ref` no
resuelve, un campo de `support` sin declarar, un conteo de `refutation` que no cierra, o
`terminal_state: escalated` (**siempre**, tenga o no `override_note`) → frenar acá, reportar al
usuario, no commitear (LAW 8). El script imprime la razón exacta del rechazo.

**Los receipts `ia.receipt/v1` y `ia.receipt/v2` son archivo, no evidencia viva.** Un proyecto con
receipts de antes de este schema los conserva sin migración automática — nadie los borra ni los
reescribe. Un receipt no se parchea nunca: si hace falta uno vigente, se genera uno nuevo sobre el
estado real. Para leer los viejos sin intentar aprobarlos:
```bash
node .vibe/ia-stack-runtime/scripts/verify-receipt.mjs inspect-legacy .vibe/receipts/<archivo-viejo>.json
```
Comando de solo lectura: informa que es evidencia archivística de un schema anterior, no
modifica nada, y **nunca** habilita un commit/publish — `check` sigue siendo la única puerta, y
`check` rechaza todo receipt `v1` y `v2` sin excepción.

**Qué NO se declara cerrado** (source: `research/sources/protocolo-muralla.md` point #45) —
ninguno de estos permite un 🔵 de cierre, aunque el receipt mecánico pase:
- Una ronda de fixes cuya última tanda no se volvió a revisar (6.3 corrió antes del último fix,
  no después).
- Un gate propio del target-project (no de IA Stack) escrito pero nunca falsificado a propósito
  (ver el ritual en Phase 6.1 arriba).
Decirlo en el reporte de cierre cuesta menos que el usuario descubriéndolo después. (Un AC
`UNTESTED`/`PARTIAL`/`FAILING` ya no es "una señal a mostrar antes de cerrar" — con el schema v2,
directamente bloquea `check`, no llega a esta lista.)

**El mensaje de commit cuenta qué cambió y por qué, con los números medidos** (point #44) — no
"arreglé el bug", sino la evidencia del receipt: "antes: X, después: Y" cuando hay una métrica
real; si algo quedó abierto, va nombrado en el cuerpo del commit, no solo en `DEBT.md`.

**Ausente vs corrupto — 2 categorías, no cambia el script, solo aclara qué hacer con cada
mensaje:**
- **Ausente (reparable regenerando):** "receipt no encontrado" / archivo no existe todavía →
  volver al final de 6.4, generar el receipt real (no hubo error, solo faltó el paso).
- **Corrupto/stale (siempre requiere receipt NUEVO, nunca editar el viejo):** fingerprint no
  matchea el estado actual, `terminal_state` no es `approved`, `evidence` vacío, o
  `terminal_state: escalated` → el estado evaluado cambió o nunca fue aprobado. Nunca parchear el
  receipt existente a mano — regenerar desde cero (pasos 6.4 de nuevo) sobre el estado real
  actual.
```bash
git add -- <cada ruta que la tarea declaró>
git commit -F "$(git rev-parse --git-path IA_COMMIT_MSG)"
```
**Rutas con nombre, nunca el árbol entero**: un `add` de todo mete en el commit el trabajo de otra
sesión que comparte la carpeta. **El mensaje va por archivo** (`-F`), escrito con la herramienta de
edición en la ruta que imprime `git rev-parse --git-path IA_COMMIT_MSG`: en un shell, unas comillas
invertidas dentro de `-m "..."` se ejecutan —en Windows una corrió `label.exe` el 08-10-2026—, y
un archivo no se interpreta. Vive adentro de `.git` a propósito: en el árbol sería un archivo sin
seguimiento y `--require-clean-worktree` rechazaría.

El commit es reversible: se hace. **El push y el merge no: se muestra el comando exacto y se pide confirmación con un menú antes.** Nunca automático, nunca `--force`, nunca salteando hooks.
Y se piden **una sola vez, al cerrar el plan entero** (LAW 9). Antes del menú se muestra cuántos
commits locales esperan y qué queda del plan:
```bash
git rev-list --count @{u}..HEAD   # sin upstream todavía: escribir «N/A — rama sin publicar»
```

🔵 **¿Publico?**

- **A)** `git push origin <branch>` — *(recomendado cuando el plan entero cerró y los gates están en verde)*
- **B)** `git push` y además abrir un PR — sólo con el plan entero cerrado
- **C)** Todavía no — dejarlo local — *(recomendado mientras el plan tenga fases o lotes pendientes)*

Esperando tu respuesta antes de continuar.

> **Qué es cada cosa:** *push* es subir los commits a GitHub; un *PR* (pull request) es pedir que esa
> rama se sume a la principal, para que alguien la mire antes.

Si un push a una rama despliega a producción (LAW 9), lo de arriba publica la rama de trabajo y nada
llega todavía a la gente. Llevarlo a producción se pregunta aparte, recién cuando la copia de prueba
se miró. Es la acción reservada `deploy` del modo continuo: nunca se cierra sola.

🔵 **¿Lo llevo a producción?**

- **A)** Todavía no — la copia de prueba no se miró o algo no se vio bien — *(recomendado mientras la copia de prueba no se haya mirado)*
- **B)** Sí — sumar la rama de trabajo a `<rama que despliega>`; desde ahí la ve la gente
- **C)** No hay copia de prueba — llevarlo igual, con el riesgo dicho y anotado en `.vibe/SESSION.md`

Esperando tu respuesta antes de continuar.

**8.1.1 Ancla de la traza** — antes de publicar, la historia de git tiene que respaldar la traza:

```bash
node .vibe/ia-stack-runtime/scripts/verify-audit-chain.mjs history .vibe/AUDIT.md
```

`check` mira adentro del archivo y agarra la edición de una línea. **No agarra recortar el final ni
refabricar todo**, porque los hashes viven en el mismo archivo que protegen. `history` sí: una traza
de auditoría sólo crece, así que cada versión commiteada tiene que empezar con la anterior. Eso se
verifica contra un registro que no vive dentro del archivo atacado, y **el ancla es git, que este
protocolo ya usa** — no hace falta ningún servicio.

Límite: quien reescriba la historia publicada puede fabricar una secuencia coherente. Lo que cambió
es que falsificar dejó de ser invisible: exige tocar el identificador de cada commit, y eso lo ve
cualquiera que tenga un clon previo o el remoto.

**8.1.2 Custodia del recibo** — quién firmó el commit que lo lleva:

```bash
node .vibe/ia-stack-runtime/scripts/verify-receipt.mjs custody .vibe/receipts/<feature-slug>-<fecha>.json
```

IA Stack no puede crear ni guardar claves, pero **sí puede dejar de callarse**: git ya trae firma de
commits y este comando la lee. Una firma rota siempre rechaza — es peor que ninguna. No firmar
sólo rechaza con `--require-signature`, porque no firmar es lo normal, no una violación.

Límite, impreso en cada corrida: **si el agente puede correr `git commit -S`, firma como vos**. La
custodia vale hasta donde tu clave exija presencia humana.

**8.2 Backups**:
- Bitácora de respaldos (opcional): si tu proyecto lleva una, se deja una nota con ruta, sha256 y
  tamaño. Dónde vive esa bitácora lo decide cada proyecto — este paso no supone ninguna carpeta.
- **El índice del proyecto.** Después del commit se regenera y se comprueba el inventario propio:

  ```bash
  node .vibe/ia-stack-runtime/scripts/verify-ia-stack-index.mjs record
  node .vibe/ia-stack-runtime/scripts/verify-ia-stack-index.mjs check
  ```

  Dice qué archivos cubre el repositorio y cuáles quedan afuera con motivo escrito. No necesita
  ninguna herramienta que el protocolo no traiga: es Node y git, nada más.
  **Límite:** dice que están inventariados, no que sean correctos.

- `.vibe/SESSION.md` se archiva en `.vibe/sessions/AAAA-MM-DD-<tema>.md` y queda limpio para la sesión siguiente.
- Artefacto distribuible opcional (dist.zip + checksums): `skills/deploy-zip.md`, sólo si el proyecto entrega uno.

**Límites honestos como dato revisable.** Las frases que declaran lo que un gate **no** prueba
viven en `contracts/honest-limits.json`, cada una con el `why` de qué garantía se pierde si
desaparece:
```bash
node .vibe/ia-stack-runtime/scripts/verify-ia-stack-contract.mjs check
```
Debilitar una de esas frases pone el gate en rojo y el mensaje imprime el motivo, para que quien la
tocó entienda qué está sacando. La comparación es de texto literal, nunca un patrón que alguien
pueda aflojar. Al agregar un gate nuevo, declarar su límite ahí es parte de la tarea, no un extra:
una promesa sin su límite escrito es la forma más barata de mentir. **Lo que no cubre**: verifica
que la frase esté, no que el párrafo que la rodea siga siendo cierto; y un límite que nadie declaró
en el contrato tampoco se protege.

**8.3 Reflect** — 5 líneas, siempre corre, NO es gate (no bloquea nada, sin menú approve/modify).
Append a `.vibe/RETRO.md` (crear desde `templates/vibe/RETRO.md` si no existe). Inmediatamente
después, correr el LESSONS PROTOCOL completo (`skills/vibe-memory.md` § LESSONS PROTOCOL): draft
candidates desde los `⚠ signal` de `SESSION.md`, dedup contra `LESSONS.md` existente, 🔵 confirm
gate, escribir solo lo confirmado. Esto sí requiere respuesta del usuario — a diferencia del
resto de 8.3, no es "corre siempre sin preguntar".

Una vez escrita la entrada, el archivo se verifica. Era el único artefacto del protocolo que ningún
gate miraba:

```bash
node .vibe/ia-stack-runtime/scripts/verify-lessons.mjs check .vibe/LESSONS.md
```

El archivo que el instalador escribe en un proyecto nuevo —cabecera y plantilla, cero lecciones—
pasa: registrar la primera lección es trabajo pendiente, no un incumplimiento. Retirar una lección
se escribe como lo define `skills/vibe-memory.md`, `status: retired (<date>, reason: <why>)`. No hay
piso de fecha, porque el archivo es memoria de errores entre proyectos y una lección importada trae
su fecha real; sí hay techo, porque no se aprende una lección mañana.

La frontera entre lecciones es el encabezado `## ` anclado, nunca un `---` ni una línea en blanco:
el archivo real sólo tiene dos `---` y delimitan la plantilla, así que un gate que parte por ahí
valida un solo bloque gigante y sale verde aunque falte un campo entero. El valor de un campo
termina en el próximo marcador y no al final del bloque, porque si no un campo vacío se llena con
el texto del siguiente. La plantilla se identifica por su fecha literal `YYYY-MM-DD` —nunca por
número de línea— y sus propios valores son la lista negra de relleno.
Un campo tiene que traer al menos una letra con caso o un dígito: sacar los invisibles no alcanza,
porque
U+3164 HANGUL FILLER y U+2800 BRAILLE PATTERN BLANK no son de formato y miden como contenido.

El barrido de marcas de dedup se ancla al corchete, no a la frase, y no distingue mayúsculas: toda
marca del archivo —incluidas las de la plantilla— tiene que nombrar una lección que este archivo
declare. El precio está escrito: una lección que documente la convención citando la forma genérica
sale roja, y el rechazo dice que la marca no nombra ninguna lección en vez de culpar al patrón.

El gate verifica forma, unicidad de identificadores y resolución de referencias internas.
**No verifica que la causa raíz declarada sea la causa real**, ni que se distinga del síntoma,
ni que la señal de detección detecte algo: un verde acá no es evidencia de que la lección sirva.
Por eso
imprime sus límites en verde y en rojo, para que la línea de éxito no se cite sola.

```
## [YYYY-MM-DD] <feature-name>
**Shipped:** <1 línea, qué salió>
**Plan vs actual:** est. <N sesiones de docs/plan.md> → actual <M — contar .vibe/sessions/
  archivadas; si 8.2 no archivó ninguna, "N/A (sessions no archivadas)", nunca "0">
**Friction:** <1-2 cosas que costaron más de lo esperado>
**Keep:** <1 patrón que vale repetir — si es nuevo, también a PATTERNS.md>
**Change:** <1 cosa a hacer distinto la próxima>
```

Se relee en Phase 1 Bootstrap junto con SESSION.md/DECISIONS.md (últimas 2 entradas).

---
