# Instalar IA Stack

Necesitás Claude Code (o Codex), Git y Node 20 o más. Bash o PowerShell se usan sólo para el
instalador y las entradas del gate rojo.

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

El instalador hace dos copias:

1. La skill, en `~/.claude/skills/ia-stack/SKILL.md`, y el mismo puntero en
   `<proyecto>/.claude/skills/ia-stack/` y `<proyecto>/.agents/skills/ia-stack/` (Codex).
2. Un runtime autocontenido en `<proyecto>/.ia-stack/runtime/`, con `SKILL.md`, `phases/`,
   `skills/`, `contracts/`, `scripts/` y `templates/`.

Además crea `.ia-stack/` con los archivos de estado (`ESTADO.md` y las plantillas de
`templates/estado/`) y agrega `.ia-stack/runtime/` al `.gitignore` del proyecto.

## Después

1. Reiniciá Claude Code.
2. Abrí el proyecto.
3. Invocá `/ia-stack`. Arranca la fase 0.

Si el proyecto tiene un `CLAUDE.md` que no importa `@AGENTS.md`, el instalador avisa: con la
configuración predeterminada, Claude Code no lee `AGENTS.md` cuando hay un `CLAUDE.md`. No lo
reescribe, porque es tuyo.

Los comandos se ejecutan desde el proyecto:

```bash
node .ia-stack/runtime/scripts/arranque.mjs
```

## Hook de contexto

El instalador no toca hooks. Para recibir el aviso de relevo al 70 % del contexto, agregá a mano en
tu `settings.json` un hook `UserPromptSubmit` con
`node .ia-stack/runtime/scripts/context-guard.mjs --rol orquestador`. Una subsesión fija
`IA_STACK_ROL=subsesion`. El script sale siempre con 0 y no cierra la sesión solo.

## Hook de aprobaciones

Para que tus frases `apruebo pedido v1`, `apruebo preview v1`, etc. queden registradas, agregá a
mano otro hook `UserPromptSubmit` (evento de mensaje del usuario) con
`node .ia-stack/runtime/scripts/aprobar.mjs hook`. Sin hooks, `aprobar.mjs registrar` lo hace a mano.

## Opciones

```bash
./scripts/install.sh --target-dir /ruta/a/skills --runtime-dir /ruta/a/runtime-global --project /ruta/a/proyecto
./scripts/install.sh --project-only --project /ruta/a/proyecto   # no escribe fuera del proyecto
```

En PowerShell: `-TargetDir`, `-RuntimeDir`, `-ProjectDir` y `-ProjectOnly`. `--project-only`
exige `--project` y rechaza combinarse con `--target-dir` o `--runtime-dir`. En ese modo la skill
global no se instala: `/ia-stack` anda sólo en ese proyecto.

## Reinstalar

Reinstalar actualiza el runtime. Un archivo que el protocolo ya no tiene se **mueve** a
`.ia-stack/archivo/<fecha-y-hora>/runtime/` conservando su ruta; no se borra. Esa carpeta queda
fuera de git. El sello `.ia-stack/runtime/INSTALADO.json` dice cuándo y desde qué commit se instaló.

## Migrar un proyecto de una versión anterior

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
