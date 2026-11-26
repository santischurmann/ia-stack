# Instalar IA Stack

Necesitás Claude Code (o Codex), Git, Node 20 o más y bash (Git Bash en Windows), que corre los
hooks. Para el instalador y las entradas del gate rojo sirve bash o PowerShell.

## Instalación en un proyecto

```bash
git clone https://github.com/<tu-usuario>/ia-stack.git
cd ia-stack
./scripts/install.sh --project /ruta/a/mi-proyecto
```

Windows PowerShell:

```powershell
git clone https://github.com/<tu-usuario>/ia-stack.git
cd ia-stack
.\scripts\install.ps1 -ProjectDir C:\ruta\a\mi-proyecto
```

El instalador escribe tres cosas:

1. La skill, un `SKILL.md` puntero (no una copia del protocolo) en `~/.claude/skills/ia-stack/` (salvo con `--project-only`), y
   el mismo puntero en `<proyecto>/.claude/skills/ia-stack/` y `<proyecto>/.agents/skills/ia-stack/` (Codex).
2. Un runtime global en `~/.claude/ia-stack-runtime/` (salvo con `--project-only`).
3. Un runtime autocontenido en `<proyecto>/.ia-stack/runtime/`, con `SKILL.md`, `phases/`,
   `skills/`, `contracts/`, `scripts/` y `templates/`.

Además crea `.ia-stack/` con los archivos de estado (`ESTADO.md` y las plantillas de
`templates/estado/`) y agrega `.ia-stack/runtime/`, `.ia-stack/archivo/` y `.claude-archive/` al
`.gitignore` del proyecto. El resto de `.ia-stack/` se versiona.

## Después

1. Agregá los dos hooks a mano (§ Hooks a mano). Sin el de aprobaciones, registrá cada una con
   `aprobar.mjs registrar`; el del gate 1 no tiene reemplazo.
2. Reiniciá Claude Code.
3. Abrí el proyecto.
4. Invocá `/ia-stack`. Arranca la fase 0.

Si el proyecto tiene un `CLAUDE.md` que no importa `@AGENTS.md`, el instalador avisa: con la
configuración predeterminada, Claude Code no lee `AGENTS.md` cuando hay un `CLAUDE.md`. No lo
reescribe, porque es tuyo.

Los comandos se ejecutan desde el proyecto:

```bash
node .ia-stack/runtime/scripts/arranque.mjs
```

## Ventana de 300K y hooks de contexto

Toda sesión abierta en un proyecto instalado (una anidada, sólo si el host le pasa `CLAUDE_CODE_AUTO_COMPACT_WINDOW`)
trabaja con una ventana de 300.000 tokens como máximo y compacta apenas se llena
(`contracts/model-routing.json` § contexto). Al instalar en un proyecto, el instalador corre `node .ia-stack/runtime/scripts/ventana.mjs aplicar` y deja en
`.claude/settings.local.json` (el local, no el compartido):
- `"env": { "CLAUDE_CODE_AUTO_COMPACT_WINDOW": "300000" }`: Claude Code compacta ahí. Un valor
  válido más chico (desde 100000) se respeta.
- Un hook `UserPromptSubmit` con `context-guard.mjs`: avisa el relevo al 70 % del tope (orquestador
  120K, subsesión 60K, sobre mensajes) y ordena cerrar al llegar. De respaldo, a los 180.000 tokens
  de mensajes ordena escribir el handoff en `.ia-stack/handoffs/ULTIMO.md`
  (plantilla `templates/estado/HANDOFF.md`, hasta 40 líneas). Una subsesión fija `IA_STACK_ROL=subsesion`.
- Un hook `SessionStart` con matcher `compact` y `handoff.mjs mostrar`: después de compactar, el
  handoff vuelve al contexto.
- `"effortLevel": "medium"` (`contracts/model-routing.json` § esfuerzo): es un setting, no la variable
  `CLAUDE_CODE_EFFORT_LEVEL`, así que `/effort` sigue mandando en la sesión. Un `effortLevel` distinto
  se reemplaza; si esa variable está puesta y difiere, `ventana.mjs` avisa.

`--sin-ventana` (bash) o `-SinVentana` (PowerShell) saltea las cuatro cosas, esfuerzo incluido. Si el archivo no es JSON
estricto, el instalador avisa `ventana no aplicada` y sigue. `ventana.mjs check` dice qué falta.

Límites: la orden de handoff sale cuando la persona manda un mensaje; en un turno autónomo largo o
en un subagente sólo cubre la variable. Los hooks corren con bash, también en Windows. Fuera de un
proyecto instalado, la variable se fija a mano en el `settings.json` propio. Los scripts de contexto salen
siempre con 0 y no cierran la sesión solos.
- **Codex:** `model_auto_compact_token_limit = 300000` y `model_reasoning_effort = "medium"` en `config.toml`, a mano.

## Hooks a mano

El instalador no deja estos dos; van en `.claude/settings.local.json`, sumados a los que ya haya en
`"hooks"`: el objeto de aprobaciones entra en el arreglo `UserPromptSubmit` que ya dejó el
instalador, sin repetir la clave (con `--sin-ventana` no lo dejó: creá vos `"hooks"` y el arreglo).
- **Aprobaciones:** para que tus frases `apruebo pedido v1`, `apruebo preview v1`, etc. queden
  registradas, un hook `UserPromptSubmit` (evento de mensaje del usuario). Sin él,
  `aprobar.mjs registrar` lo hace a mano.
- **Gate 1:** un hook `PreToolUse` con matcher `Write|Edit`, que frena la escritura de código sin
  test rojo visto.

```json
"UserPromptSubmit": [ { "hooks": [ { "type": "command", "command": "node .ia-stack/runtime/scripts/aprobar.mjs hook" } ] } ],
"PreToolUse": [ { "matcher": "Write|Edit", "hooks": [ { "type": "command", "command": "node .ia-stack/runtime/scripts/pretooluse-red.mjs" } ] } ]
```

## Opciones

```bash
./scripts/install.sh --target-dir /ruta/a/skills --runtime-dir /ruta/a/runtime-global --project /ruta/a/proyecto
./scripts/install.sh --project-only --project /ruta/a/proyecto   # no escribe fuera del proyecto
```

Por defecto la skill va a `~/.claude/skills/` y el runtime global a `~/.claude/ia-stack-runtime/`.
En PowerShell: `-TargetDir`, `-RuntimeDir`, `-ProjectDir` y `-ProjectOnly`. `--project-only`
exige `--project` y rechaza combinarse con `--target-dir` o `--runtime-dir`. En ese modo la skill
global no se instala: `/ia-stack` anda sólo en ese proyecto.

## Reinstalar

Reinstalar actualiza el runtime. Un archivo que el protocolo ya no tiene se **mueve** a
`.ia-stack/archivo/<fecha-y-hora>/runtime/` conservando su ruta; no se borra. Esa carpeta queda
fuera de git. El sello `.ia-stack/runtime/INSTALADO.json` dice cuándo y desde qué commit se instaló.

## Migrar un proyecto de una versión anterior

Desde la carpeta del clon de ia-stack:

```bash
node scripts/migrar.mjs /ruta/a/mi-proyecto
```

Hace una copia de respaldo, pasa la carpeta de estado anterior a `.ia-stack/`, arma `ESTADO.md` en
el formato nuevo y conserva las aprobaciones vigentes con su sha. Es idempotente: si no hay nada
que migrar, lo dice y sale con 0. Si `.ia-stack/` ya existe, no pisa nada.

## Problemas comunes

- **La skill no aparece:** reiniciá Claude Code y mirá que exista `SKILL.md` dentro de
  `~/.claude/skills/ia-stack/`. Un `.md` suelto en `skills/` no se carga.
- **«file not found» al correr un comando:** ejecutalo desde el proyecto con
  `.ia-stack/runtime/scripts/...`, no `./scripts/...`.
- **El gate rojo rechaza mi comando:** acepta runners con adaptador probado (Node, Vitest,
  pytest). Otro runner necesita un adaptador propio.

## Desinstalar

Apartá la skill y el runtime global; se mueven, no se borran. Conservá `.ia-stack/` del proyecto:
ahí quedan decisiones y evidencia.

```bash
mkdir -p ~/.claude/ia-stack-archive/desinstalado
mv ~/.claude/skills/ia-stack ~/.claude/ia-stack-runtime ~/.claude/ia-stack-archive/desinstalado/
```

En cada proyecto, mové `.claude/skills/ia-stack/` y `.agents/skills/ia-stack/` a `.claude-archive/`
y sacá de `.claude/settings.local.json` los hooks que llaman a `.ia-stack/runtime/scripts/`.
