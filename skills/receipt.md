# El receipt — qué es, qué prueba y qué NO prueba

**Esto vivía adentro de la fase 6 y se mudó acá el 2026-09-15.** El motivo está medido: la fase 6
eran 533 líneas —el 24% del documento entero— y **170 de ellas eran el receipt**. No es una sección
de una fase: es un subsistema con su esquema, sus reglas duras, su ciclo de vida y sus límites
honestos, documentado en el medio de la fase de pruebas. Leerlo obligaba a atravesarlo aunque sólo
se quisiera saber cómo se corre la suite.

Sacarlo bajó la fase 6 de 533 a 363 líneas **sin cambiar una sola regla**. Lo que quedó allá es el
puntero y el comando; todo lo que decide qué pasa y qué no, está acá.

**Dónde encaja.** El receipt se escribe al final de la fase 6, inmediatamente antes de la 8.1, y es
lo que LAW 8 exige para publicar: sin un receipt con `terminal_state: approved` para el estado
evaluado actual, no hay push ni merge. El gate es `verify-receipt.mjs`.

```bash
node .vibe/ia-stack-runtime/scripts/verify-receipt.mjs check .vibe/receipts/<feature-slug>-<fecha>.json
```

---

**Schema `ia.receipt/v3` — el único que `verify-receipt.mjs check` puede aprobar** (los schemas
`ia.receipt/v1` y `ia.receipt/v2` son archivísticos: cualquier receipt viejo se lee con
`inspect-legacy`, nunca con `check` — ver más abajo):

```
.vibe/receipts/<feature-slug>-<fecha>.json
{
  "schema": "ia.receipt/v3",
  "feature": "<de docs/spec.md>",
  "task": "<id de la tarea; en vía completa sale de tasks.json, ej. T02; en vía corta, el nombre del cambio>",
  "scope": { "declared_paths": ["<paths tocados, autodeclarados>"] },
  "acceptance_criteria": [
    {
      "ac_id": "AC-2",
      "scenario": "<qué prueba, en una frase>",
      "test_file": "<path del test que lo prueba>",
      "test_hash_sha256": "<sha256 completo, 64 hex, del archivo de test tal como quedó>",
      "command": "<comando exacto corrido>",
      "result": "<salida real, ej. '47 passed'>",
      "verdict": "COMPLIANT|FAILING|UNTESTED|PARTIAL"
    }
  ],
  "review_4r": {
    "risk": { "level": "bajo|estandar|alto|critico", "reasons": ["<code>: <path:lineas>"] },
    "readability": { "verdict": "fixed|no_findings", "notes": "<...>" },
    "reliability": { "verdict": "fixed|no_findings", "notes": "<...>" },
    "resilience": { "verdict": "fixed|no_findings", "notes": "<...>" }
  },
  "measurements": [
    { "metric": "<nombre>", "before": <numero>, "after": <numero>, "measured": true },
    { "metric": "<nombre>", "before": -1, "after": -1, "measured": false, "reason": "<por qué no se midió>" }
  ],
  "reproduction": "<comando(s) exacto(s) para reproducir el estado verificado>",
  "not_reviewed": "<'none — <base concreta>' o los límites reales de esta revisión>",
  "limits": [
    { "id": "L1", "what": "<qué NO hace este cambio, a propósito>", "why_acceptable": "<por qué está bien que no lo haga>", "owner": "<quién>" }
  ],
  "regressions": [
    { "id": "R1", "what": "<qué dejó de andar>", "before": "<cómo andaba antes>", "after": "<cómo anda ahora>",
      "evidence": "<comando y salida>", "resolution": "fixed|reverted|accepted_by_user",
      "user_decision_ref": "<sólo con accepted_by_user: el current_hash de la decisión en docs/phase-decisions.json>" }
  ],
  "support": {
    "correlation": "<cómo se ata una petición a lo que quedó registrado, o 'ninguno — <motivo>'>",
    "actor_on_writes": "<cómo se sabe quién hizo cada operación que cambia estado, o 'ninguno — <motivo>'>",
    "failure_visible": "<cómo se ve desde afuera que falló>",
    "diagnostic_command": "<el comando que se corre cuando alguien reporta una falla>"
  },
  "refutation": { "proposed": 0, "survived": 0, "refuted": 0, "inconclusive": 0, "by_lens": {} },
  "evidence": ["<comando real corrido en 6.3/6.4, ej. 'pytest -q -> 47 passed'>"],
  "git_head": "<git rev-parse HEAD>",
  "tree_fingerprint": "<sha256 sobre HEAD + bytes-en-disco de cada path tracked cambiado (staged+unstaged) + path/contenido de cada untracked no ignorado, ver scripts/verify-receipt.mjs>",
  "terminal_state": "approved"
}
```

**Regla dura sobre `acceptance_criteria`: `terminal_state: "approved"` exige TODOS los AC
`COMPLIANT`.** Un AC `UNTESTED`, `PARTIAL` o `FAILING` bloquea `check` incondicionalmente — no
hay excepción "aprobar con AC pendiente". Un receipt con AC no-`COMPLIANT` puede existir como
borrador/evidencia de trabajo en progreso, pero nunca habilita commit ni publicación. Cada AC
`COMPLIANT` exige `test_file`+`test_hash_sha256`+`command`+`result`+`scenario` no vacíos, y el
hash debe coincidir con el archivo real en disco al momento de `check` — si el test cambió
después de escribir el AC, `check` rechaza (mismo modelo que el hash de test de
`pretooluse-red.mjs`). **Los finales de línea no cuentan como cambio**: se acepta el mismo
contenido en crudo, en LF o en CRLF, porque en Windows con `core.autocrlf=true` el mismo test
tiene bytes distintos según quién lo escribió último, y el gate acusaba «el test cambió» sobre un
test idéntico. Un cambio de una sola letra sigue rechazando en las tres.
**Un test con finales de linea mezclados**, sellado así, sólo coincide consigo mismo byte a
byte: cuando pasa por git sale uniforme, y ese recibo ya no se puede recomprobar desde un clon.
`test_file` (y cada entrada de `scope.declared_paths`) debe ser project-local, un archivo regular, sin symlinks ni junctions que escapen del checkout —
`verify-receipt.mjs` lo rechaza con el mismo `safeRegularFile` que ya protege el resto del gate.

**Límite honesto — no sobreactuar lo que el schema puede probar:** `command`, `result`,
`measurements` y `reproduction` son evidencia **estructurada y revisable**, escrita por quien
generó el receipt — el gate mecánico nunca re-ejecuta el comando ni prueba criptográficamente
que corrió. Es disciplina procedural auditable (un humano puede releer y correr `reproduction`
él mismo), no una garantía de ejecución. `scope.declared_paths` sigue siendo un writer set
autodeclarado dentro del receipt; el cruce contra `tasks.json`/`plan.md` ocurre en el gate separado
`verify-scope-diff.mjs` después de GREEN, usando el diff real de Git. No llames al campo del receipt
"el scope real del plan" si no corriste ese gate con la base y el task correctos.

**`-1` sólo es válido junto con `measured: false` y un motivo no vacío** — un `-1` sin
`measured: false` explícito, o sin `reason`, es rechazado. La combinación existe para que "no se
midió" quede declarado, no inferido de un número mágico.

**`not_reviewed` no admite placeholders** (`"n/a"`, `"unknown"`, `"nothing"`, string vacío,
`"none"` sin base) — debe decir `"none — <base concreta de por qué se cubrió todo>"` o listar los
límites reales de la revisión. Mismo mecanismo que `verify-handoff-report.mjs` ya exige para
handoffs de fase, ahora también sobre el campo del receipt.

**Un límite y una regresión no son lo mismo, y `not_reviewed` no los separaba.** `not_reviewed`
dice qué superficie **no se miró**; es el alcance de la revisión. Lo otro es qué **pasó con el
producto**, y son dos listas con reglas opuestas:

- **`limits[]`** — comportamiento **intencional** que este cambio no cubre. **No bloquea.** Es
  "esto no lo hace, a propósito".
- **`regressions[]`** — comportamiento que **antes andaba y ahora no**. Se arregla (`fixed`), se
  revierte (`reverted`), o **la acepta una persona** (`accepted_by_user`).

**La regla dura**: `accepted_by_user` exige `user_decision_ref` con el `current_hash` de una
decisión `decided` de `docs/phase-decisions.json`. Si no resuelve, `terminal_state` **no puede ser
`approved`** — el mismo modelo que LAW 8 ya usa para `escalated`: la salida nunca es un campo
adentro del propio receipt, es una decisión humana registrada afuera y sellada por hash. Editar esa
decisión para que diga otra cosa rompe el hash y con él la referencia.

**El discriminador es mecánico, no de criterio: el campo `before`.** Un límite no lo tiene, porque
nunca anduvo; una regresión sí, porque había un estado anterior medible. Una entrada con `before`
en `limits[]` se rechaza y el mensaje dice a dónde va.

**De dónde sale esta regla** (regla meta: el comentario de un gate cuenta la herida). Un constructor
puso un permiso correcto, midió que eso dejaba a un rol sin una pantalla, lo escribió con precisión
en el docstring —archivo, rango y permiso— y entregó la tarea como hecha. La declaración era honesta
y detallada, **y eso es justamente lo que la hace fácil de aceptar sin mirarla**. Ese caso tiene
`before` = «el rol veía la pantalla», así que cae en `regressions` **por forma, no por criterio**, y
ahí necesita una resolución. Escribirlo bien en el docstring dejó de alcanzar.

**`refutation` cuenta la ronda adversarial**: cuántos hallazgos se propusieron y cuántos
sobrevivieron al Refutador (6.3). Los cuatro conteos tienen que cerrar contra `proposed` —refutar es
un hecho contable, no una impresión—. Sin este bloque nadie puede saber después si el refutador
corrió o fue teatro: en la corrida que motivó la regla, de **60 hallazgos propuestos sobrevivieron
18**, y un informe de seguridad con 70% de ruido hace que nadie lea el siguiente.

**LIFECYCLE DEL RECEIPT — orden exacto, no ambiguo:**

1. **`git add -A` ANTES de generar el fingerprint** — todo lo que va a formar parte del commit
   (incl. los archivos `.vibe/*.md` que esta misma Fase 8 fue actualizando: SESSION.md, AUDIT.md,
   DEBT.md, etc.) queda staged primero. El receipt evalúa el estado que efectivamente se va a
   commitear, no un estado intermedio a medio stagear — de lo contrario un `git add` posterior
   sin cambio de bytes invalidaría el receipt sin razón real de negocio (ver más abajo por qué
   eso SÍ debe invalidar cuando ocurre *después* del receipt).
2. **Fingerprint se genera DESPUÉS del `git add -A`**, pasándole el path exacto del receipt que
   se va a escribir (aunque ese archivo todavía no exista en disco — el flag solo importa para
   la exclusión, no requiere que el archivo ya esté ahí):
   ```bash
   node .vibe/ia-stack-runtime/scripts/verify-receipt.mjs fingerprint .vibe/receipts/<feature-slug>-<fecha>.json
   ```
3. **El receipt se escribe con ese `git_head`+`tree_fingerprint` exactos**, inmediatamente — no
   hay paso intermedio entre calcular el fingerprint y escribir el JSON que lo contiene.
4. **`git add -A` de nuevo, ahora incluyendo el receipt recién escrito** — el receipt mismo debe
   quedar staged para el commit de 8.1 (`git add -A && git commit`, el receipt es parte de lo que
   se commitea, es evidencia permanente en el repo).
5. **`node .vibe/ia-stack-runtime/scripts/verify-receipt.mjs check <receipt>` (8.1)** — vuelve a calcular el fingerprint
   del estado actual (excluyendo el mismo path del receipt) y lo compara. Si nada cambió entre
   el paso 2 y este paso, matchea → exit 0.

**Por qué el receipt se excluye SOLO de su propio fingerprint, no de todo `.vibe/receipts/`:**
el archivo que se está escribiendo/chequeando no puede incluirse en el cálculo de su propio
`tree_fingerprint` — sería una referencia circular (el hash tendría que conocerse a sí mismo
antes de existir). Esa es la ÚNICA razón de la exclusión, y por eso es una exclusión de un path
exacto, no de la carpeta entera: cualquier OTRO archivo en `.vibe/receipts/` (otro receipt de
otra feature, un archivo suelto) no tiene ese problema circular y SÍ debe invalidar el
fingerprint si aparece o cambia — de lo contrario alguien podría colar un archivo extra en esa
carpeta sin que el gate lo note.

**Modelo de hash real** (implementado en `scripts/verify-receipt.mjs`, no texto decorativo):
tres estados separados — HEAD→INDEX (staged, vía `git diff --raw --cached --no-abbrev -z`,
ambos lados son blobs reales), INDEX→WORKTREE (unstaged, mismo comando sin `--cached`; el lado
worktree usa `git hash-object` sobre los bytes reales en disco, no el placeholder de ceros que
git deja ahí), y UNTRACKED no ignorado (path + sha256 de bytes). Nunca se hashea texto de
`git diff` plano — ese texto no es content-addressed para binarios (ver hardening pass 2/3 en
CHANGELOG.md). `-z` + parsing NUL-safe maneja renames/copies (registros `R`/`C` con dos paths,
se hashea el destino). Compatible SHA-1/SHA-256 (largo de hash nunca hardcodeado).

`terminal_state` es `escalated` (no `approved`) si algún finding de 6.2/6.3 sigue sin fix que el
usuario haya aceptado explícitamente. **`escalated` bloquea siempre, sin excepción — ni
`override_note` ni ningún campo lo vuelve pasable por el gate mecánico de 8.1.** La única salida
es: 🔵 el usuario aprueba explícitamente, el orchestrator regenera un receipt **nuevo** con
`terminal_state: "approved"` (guardando `override_note` + `override_timestamp` como metadata de
auditoría en ESE receipt nuevo), y es ese receipt nuevo el que se re-evalúa en 8.1 — nunca el
`escalated` original con un campo agregado (ver LAW 8). El campo `evidence` existe para que una
relectura humana pueda chequear que 6.3 realmente corrió — es disciplina procedural auditable,
no una garantía criptográfica. Escrito inmediatamente antes de 8.1, en el mismo aliento — si el
estado evaluado cambia entre esta escritura y el commit, `tree_fingerprint` queda stale y el
validador de 8.1 lo rechaza mecánicamente (no hace falta acordarse de regenerarlo a mano).
