# Instalar IA Stack

Necesitás Claude Code, Git y Node. Bash o PowerShell se usan sólo para el instalador y las
entradas de RED; el runtime no instala dependencias globales.

## Instalación recomendada

Cloná VCP y apuntá al proyecto donde lo vas a usar:

```bash
git clone <repo-url> vibecodeprotocols
cd vibecodeprotocols
./scripts/install.sh --project /ruta/a/mi-proyecto
```

Windows PowerShell:

```powershell
git clone <repo-url> vibecodeprotocols
cd vibecodeprotocols
.\scripts\install.ps1 -ProjectDir C:\ruta\a\mi-proyecto
```

El instalador hace dos copias distintas:

1. El skill y sus sub-skills en `~/.claude/skills/`, para que Claude Code lo vea.
2. Un runtime autocontenido en `<proyecto>/.vibe/ia-stack-runtime/`, para que cada comando y template
   exista dentro del proyecto que lo usa.

No se inicializa `.vibe/` por accidente en el clone de IA Stack: tenés que pasar el proyecto de forma
explícita.

**Reinstalar actualiza el runtime del proyecto, y aparta lo que el protocolo ya no tiene.** Un
archivo que quedó de una instalación anterior —un gate que se retiró, por ejemplo— se **mueve** a
`.vibe/ia-stack-archive/<fecha-y-hora>/ia-stack-runtime/` conservando la ruta, y no se borra:
vuelve con un `mv` si algo se rompe. Esa carpeta queda ignorada por git, así que apartar no ensucia
tu árbol. Antes el instalador copiaba encima y nunca podaba, y un gate retirado se podía seguir
ejecutando desde la copia vieja.

Además deja un **sello** en `.vibe/ia-stack-runtime/INSTALADO.json`: cuándo se instaló y desde qué
commit, o que vino de un paquete sin git. Sin el repositorio de IA Stack al lado no se puede comparar
tu runtime contra el protocolo, pero con el sello `verify-runtime-sync` te dice por lo menos **cuántos
días tiene**. Un runtime sin sello se instaló antes del 2026-09-22.

**La copia global no se poda ni se sella.** Sólo el runtime del proyecto, que es el que usan los
gates. La copia global vive en tu directorio de configuración, que puede ser un repositorio tuyo, y
apartar ahí escribiría archivos en un repositorio que no es el del proyecto.

## Después

1. Reiniciá Claude Code.
2. Abrí el proyecto destino.
3. Invocá `/ia-stack`.

   `/VibeCodeProtocols` es el nombre anterior y **sigue andando**: el instalador deja las dos,
   con el mismo contenido, para no romper lo que ya estaba escrito en cada proyecto.

Los comandos de protocolo se ejecutan desde el proyecto:

```bash
node .vibe/ia-stack-runtime/scripts/verify-plan-conflicts.mjs check docs/tasks.json
.vibe/ia-stack-runtime/scripts/vibe-memory.sh read
```

En PowerShell usá los `.mjs` con `node`; el instalador de PowerShell crea el runtime igual que el
de Bash.

## Opciones

```bash
./scripts/install.sh \
  --target-dir /ruta/a/skills \
  --runtime-dir /ruta/a/runtime-global \
  --project /ruta/a/proyecto
```

```powershell
.\scripts\install.ps1 `
  -TargetDir C:\ruta\skills `
  -RuntimeDir C:\ruta\runtime-global `
  -ProjectDir C:\ruta\proyecto
```

`--runtime-dir`/`-RuntimeDir` guarda además una copia global de referencia. El runtime que usa el
proyecto es siempre `.vibe/ia-stack-runtime`; no depende de esa ruta global.

## Problemas comunes

- **El skill no aparece:** reiniciá Claude Code y verificá
  `~/.claude/skills/ia-stack.md`.
- **Un comando dice “file not found”:** ejecutalo desde el proyecto y usá
  `.vibe/ia-stack-runtime/scripts/...`, no `./scripts/...`.
- **RED rechaza mi comando:** el adapter incluido acepta sólo `node --test` con un archivo de
  test literal. Es intencional: otro runner necesita un adapter probado.
- **No hay `.vibe/`:** volvé a correr el instalador con `--project`/`-ProjectDir`; no copies
  archivos sueltos.

## Desinstalar

Podés borrar el skill y el runtime global. Conservá `.vibe/` del proyecto: ahí quedan sus
decisiones y evidencia.

```bash
rm ~/.claude/skills/ia-stack.md ~/.claude/skills/VibeCodeProtocols.md
rm -rf ~/.claude/skills/ia-stack-skills ~/.claude/ia-stack-runtime
```
