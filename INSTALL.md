# Instalar VibeCodeProtocols

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
2. Un runtime autocontenido en `<proyecto>/.vibe/vcp-runtime/`, para que cada comando y template
   exista dentro del proyecto que lo usa.

No se inicializa `.vibe/` por accidente en el clone de VCP: tenés que pasar el proyecto de forma
explícita.

## Después

1. Reiniciá Claude Code.
2. Abrí el proyecto destino.
3. Invocá `/VibeCodeProtocols`.

Los comandos de protocolo se ejecutan desde el proyecto:

```bash
node .vibe/vcp-runtime/scripts/verify-plan-conflicts.mjs check docs/tasks.json
.vibe/vcp-runtime/scripts/vibe-memory.sh read
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
proyecto es siempre `.vibe/vcp-runtime`; no depende de esa ruta global.

## Problemas comunes

- **El skill no aparece:** reiniciá Claude Code y verificá
  `~/.claude/skills/VibeCodeProtocols.md`.
- **Un comando dice “file not found”:** ejecutalo desde el proyecto y usá
  `.vibe/vcp-runtime/scripts/...`, no `./scripts/...`.
- **RED rechaza mi comando:** el adapter incluido acepta sólo `node --test` con un archivo de
  test literal. Es intencional: otro runner necesita un adapter probado.
- **No hay `.vibe/`:** volvé a correr el instalador con `--project`/`-ProjectDir`; no copies
  archivos sueltos.

## Desinstalar

Podés borrar el skill y el runtime global. Conservá `.vibe/` del proyecto: ahí quedan sus
decisiones y evidencia.

```bash
rm ~/.claude/skills/VibeCodeProtocols.md
rm -rf ~/.claude/skills/vcp-skills ~/.claude/vcp-runtime
```
