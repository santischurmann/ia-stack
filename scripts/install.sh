#!/usr/bin/env bash
# IA Stack installer. It installs a co-located runtime into each chosen project so
# every command in SKILL.md resolves from that project, not from the package clone.
set -euo pipefail

SKILL_NAME="ia-stack"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
TARGET_DIR="$HOME/.claude/skills"
RUNTIME_DIR="$HOME/.claude/ia-stack-runtime"
PROJECT_DIR=""
# `--project-only` (Decisión de diseño): instalar en UN proyecto sin escribir nada
# fuera de el. Antes, `--project` igual copiaba la skill y el runtime GLOBALES a ~/.claude, asi que
# probar el instalador en una carpeta no era aislamiento. El comportamiento por defecto no cambia.
PROJECT_ONLY=0
# `--sin-ventana`: no escribir la ventana de contexto ni los hooks en .claude/settings.local.json.
SIN_VENTANA=0
TARGET_EXPLICIT=0
RUNTIME_EXPLICIT=0

usage() {
  echo "Usage: install.sh [--target-dir <dir>] [--runtime-dir <dir>] [--project <project-root>] [--project-only] [--sin-ventana]" >&2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target-dir) TARGET_DIR="${2:?--target-dir needs a path}"; TARGET_EXPLICIT=1; shift 2 ;;
    --runtime-dir) RUNTIME_DIR="${2:?--runtime-dir needs a path}"; RUNTIME_EXPLICIT=1; shift 2 ;;
    --project) PROJECT_DIR="${2:?--project needs a path}"; shift 2 ;;
    --project-only) PROJECT_ONLY=1; shift ;;
    --sin-ventana) SIN_VENTANA=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

# Las contradicciones se rechazan ANTES de escribir nada: un modo que promete no tocar lo global no
# puede aceptar, ademas, un destino global.
if [ "$PROJECT_ONLY" -eq 1 ]; then
  if [ -z "$PROJECT_DIR" ]; then
    echo "REJECTED: --project-only exige --project: sin un proyecto no hay nada que instalar." >&2
    exit 2
  fi
  if [ "$TARGET_EXPLICIT" -eq 1 ]; then
    echo "REJECTED: --project-only contradice --target-dir: uno promete no escribir fuera del proyecto y el otro pide un destino global." >&2
    exit 2
  fi
  if [ "$RUNTIME_EXPLICIT" -eq 1 ]; then
    echo "REJECTED: --project-only contradice --runtime-dir: uno promete no escribir fuera del proyecto y el otro pide un destino global." >&2
    exit 2
  fi
fi

copy_runtime() {
  local destination="$1"
  mkdir -p "$destination/scripts" "$destination/contracts" "$destination/tests" "$destination/templates" "$destination/skills" "$destination/.agents" "$destination/phases"
  cp -R "$PACKAGE_DIR/scripts/." "$destination/scripts/"
  cp -R "$PACKAGE_DIR/contracts/." "$destination/contracts/"
  cp -R "$PACKAGE_DIR/tests/." "$destination/tests/"
  cp -R "$PACKAGE_DIR/templates/." "$destination/templates/"
  cp -R "$PACKAGE_DIR/skills/." "$destination/skills/"
  # .agents y AGENTS.md se copian porque el propio instalador los LEE del paquete mas abajo, para
  # dejarle a Codex sus punteros. Sin ellos, un runtime instalado no podia reinstalarse: `cp` fallaba
  # con "cannot stat" y se llevaba puestas diez pruebas. Todo lo que el instalador lee del paquete
  # tiene que estar en lo que el instalador copia -- es un punto fijo, y hay una prueba que lo exige.
  cp -R "$PACKAGE_DIR/.agents/." "$destination/.agents/"
  cp -R "$PACKAGE_DIR/phases/." "$destination/phases/"
  cp "$PACKAGE_DIR/SKILL.md" "$destination/SKILL.md"
  cp "$PACKAGE_DIR/SECURITY.md" "$destination/SECURITY.md"
  cp "$PACKAGE_DIR/AGENTS.md" "$destination/AGENTS.md"
}

# LO QUE SOBRA SE APARTA, NO SE BORRA. Decisión de diseño. copy_runtime copia
# ENCIMA y nunca podaba: en un proyecto real quedaron 15 archivos de mas tras reinstalar, y uno era
# un gate retirado con el que despues se sello un indice. Un archivo que el protocolo ya no tiene es
# un gate que se sigue pudiendo ejecutar desde la copia.
#
# Se MUEVE conservando la ruta, como el resto de lo que aparta este instalador: en una limpieza de este
# protocolo no existe rm. Solo recorre las carpetas que copy_runtime copia -- nunca la raiz del
# runtime, donde vive el sello --. Y el archivo lleva fecha Y hora: con fecha sola, dos reinstalaciones
# el mismo dia harian que el segundo mv pise al primero, y pisar tambien es borrar.
#
# Y UNA RED DE SEGURIDAD: una poda que moveria MAS DE LA MITAD del runtime no es una limpieza, es un
# defecto, y no mueve nada. El  la version de PowerShell vacio el runtime entero en el CI por
# una ruta corta 8.3; aca `find` devuelve el prefijo tal cual se le pasa y ese defecto no existe, pero
# la red es la misma en los dos instaladores porque lo que protege no es una causa sino un resultado.
# Dos pasadas y no un array: con `set -u`, expandir un array vacio rompe en el bash 3.2 de macOS.
apartar_sobrantes() {
  local runtime="$1" archivo="$2" total=0 sobran=0 apartados=0 dir f rel
  for dir in scripts contracts tests templates skills .agents phases; do
    [ -d "$runtime/$dir" ] || continue
    while IFS= read -r -d '' f; do
      total=$((total + 1))
      rel="${f#"$runtime"/}"
      [ -e "$PACKAGE_DIR/$rel" ] || sobran=$((sobran + 1))
    done < <(find "$runtime/$dir" -type f -print0)
  done
  if [ $((sobran * 2)) -gt "$total" ]; then
    echo "AVISO: la poda iba a apartar $sobran de los $total archivos del runtime, mas de la mitad, y eso no es una limpieza: es un defecto. No se movio nada." >&2
    return 0
  fi
  for dir in scripts contracts tests templates skills .agents phases; do
    [ -d "$runtime/$dir" ] || continue
    while IFS= read -r -d '' f; do
      rel="${f#"$runtime"/}"
      [ -e "$PACKAGE_DIR/$rel" ] && continue
      mkdir -p "$archivo/$(dirname "$rel")"
      if mv "$f" "$archivo/$rel"; then
        apartados=$((apartados + 1))
        echo "APARTADO: $rel ya no existe en el protocolo. Se MOVIO a $archivo/$rel; vuelve con mv."
      else
        echo "AVISO: no se pudo apartar $runtime/$rel. Es una copia vieja de un gate: sacala a mano." >&2
      fi
    done < <(find "$runtime/$dir" -type f -print0)
  done
  [ "$apartados" -eq 0 ] || echo "OK: $apartados archivo(s) de una instalacion anterior apartado(s), no borrados."
}

# EL SELLO: cuando y desde que se instalo este runtime. Sin el, un proyecto no tenia forma de saber
# que su copia era vieja sin el checkout al lado -- y un proyecto real llevo dias con un runtime
# anterior al  sin que nadie se enterara --. Un paquete sin git no tiene commit que nombrar,
# y eso se dice en vez de inventarlo. Un checkout con cambios sin commitear tambien se dice: ahi el
# commit no describe la copia del todo.
sellar_runtime() {
  local runtime="$1" desde="paquete" commit="null" limpio="null" sha pendientes version
  version="$(sed -n 's/^\*\*Versi[^:]*:\*\* *\([0-9][0-9.]*\).*/\1/p' "$PACKAGE_DIR/SKILL.md" | head -1)"
  if [ -e "$PACKAGE_DIR/.git" ] && sha="$(git -C "$PACKAGE_DIR" rev-parse HEAD 2>/dev/null)"; then
    desde="checkout"
    commit="\"$sha\""
    if pendientes="$(git -C "$PACKAGE_DIR" status --porcelain 2>/dev/null)"; then
      if [ -z "$pendientes" ]; then limpio="true"; else limpio="false"; fi
    fi
  fi
  printf '{\n  "schema": "ia.runtime-instalado/1",\n  "version": "%s",\n  "instalado": "%s",\n  "desde": "%s",\n  "commit": %s,\n  "arbol_limpio": %s\n}\n' \
    "$version" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$desde" "$commit" "$limpio" > "$runtime/INSTALADO.json"
}

echo "=== IA Stack Installer ==="
echo "Source:  $PACKAGE_DIR"
if [ "$PROJECT_ONLY" -eq 1 ]; then
  echo "Skills:  (omitido: --project-only)"
  echo "Runtime: (omitido: --project-only)"
else
  echo "Skills:  $TARGET_DIR"
  echo "Runtime: $RUNTIME_DIR"

  # LA SKILL ES UNA CARPETA CON EL PUNTERO, no el protocolo suelto. Claude Code solo descubre
  # `<skills>/<nombre>/SKILL.md`.
  mkdir -p "$TARGET_DIR/$SKILL_NAME"
  cp "$PACKAGE_DIR/.agents/skills/ia-stack/SKILL.md" "$TARGET_DIR/$SKILL_NAME/SKILL.md"
  copy_runtime "$RUNTIME_DIR"
  sellar_runtime "$RUNTIME_DIR"
  chmod +x "$RUNTIME_DIR/scripts/"*.sh
  echo "OK: skill, sub-skills, and self-contained runtime installed."
fi

if [ -n "$PROJECT_DIR" ]; then
  if [ ! -d "$PROJECT_DIR" ]; then
    echo "REJECTED: project directory does not exist: $PROJECT_DIR" >&2
    exit 1
  fi
  PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"
  STATE_DIR="$PROJECT_DIR/.ia-stack"
  if [ ! -d "$STATE_DIR" ]; then
    mkdir -p "$STATE_DIR/sessions" "$STATE_DIR/receipts" "$STATE_DIR/handoffs"
    cp "$PACKAGE_DIR/templates/estado/"* "$STATE_DIR/"
  fi
  copy_runtime "$STATE_DIR/runtime"
  chmod +x "$STATE_DIR/runtime/scripts/"*.sh
  # El runtime es una copia de esta herramienta, no codigo del proyecto. Sin esta regla queda como
  # archivo sin seguimiento, y entonces: se commitea sin querer junto al trabajo del usuario, y el
  # gate de seguridad lo trata como superficie viva -- un hallazgo dentro del runtime bloquearia el
  # proyecto con un CRITICAL que el usuario no escribio y no puede arreglar editando su codigo.
  IGNORE_FILE="$PROJECT_DIR/.gitignore"
  # PHASE 9 archiva configuracion en .claude-archive/. Puede traer rutas, tokens o datos propios:
  # si queda con seguimiento, el primer commit del usuario se lleva todo eso adentro.
  # CADA REGLA SALE CON EL FINAL DE LINEA QUE EL ARCHIVO YA USA, y se busca sin el CR. Hasta el
  #  se agregaba con LF a cualquier archivo: un .gitignore CRLF quedaba con finales mezclados
  # (git avisaba en cada operacion, medido en tres proyectos de usuarios), y `grep -x` no encontraba
  # una regla ya puesta en una linea CRLF, asi que cada reinstalacion la iba a duplicar.
  agregar_regla() {
    local comentario="$1" regla="$2" eol=$'\n'
    if [ -f "$IGNORE_FILE" ] && tr -d '\r' < "$IGNORE_FILE" | grep -qxF "$regla"; then return 1; fi
    # `tr` y no `grep $'\r'`: el grep de Git Bash abre en modo texto y no ve el CR, medido.
    if [ -f "$IGNORE_FILE" ] && [ "$(tr -cd '\r' < "$IGNORE_FILE" | wc -c)" -gt 0 ]; then eol=$'\r\n'; fi
    if [ -s "$IGNORE_FILE" ] && [ -n "$(tail -c 1 "$IGNORE_FILE" | tr -d '\r')" ]; then printf '%s' "$eol" >> "$IGNORE_FILE"; fi
    printf '%s%s%s%s' "$comentario" "$eol" "$regla" "$eol" >> "$IGNORE_FILE"
  }
  ARCHIVE_RULE=".claude-archive/"
  if agregar_regla '# IA Stack PHASE 9: lo que la limpieza archiva, nunca se commitea' "$ARCHIVE_RULE"; then
    echo "OK: $ARCHIVE_RULE agregado a .gitignore"
  fi
  # Lo que la poda mueve es una copia del runtime, igual que el runtime: tampoco se versiona.
  RUNTIME_ARCHIVE_RULE=".ia-stack/archivo/"
  if agregar_regla '# IA Stack: lo que el instalador poda del runtime, tampoco es codigo del proyecto' "$RUNTIME_ARCHIVE_RULE"; then
    echo "OK: $RUNTIME_ARCHIVE_RULE agregado a .gitignore"
  fi
  IGNORE_RULE=".ia-stack/runtime/"
  if agregar_regla '# IA Stack: copia del runtime, no es codigo del proyecto' "$IGNORE_RULE"; then
    echo "OK: $IGNORE_RULE agregado a .gitignore"
  fi
  # Codex descubre skills de repositorio SOLO en .agents/skills/<nombre>/SKILL.md y en
  # .codex/skills/, y sus instrucciones solo en AGENTS.md -- verificado ejecutando: un SKILL.md
  # suelto en la raiz y los skills/*.md le son invisibles. Sin estos dos punteros, IA Stack existe en el
  # proyecto pero Codex no ve nada de el. Son punteros al runtime, no copias: una copia se
  # desincroniza y ningun gate las mantiene iguales.
  mkdir -p "$PROJECT_DIR/.agents/skills/ia-stack"
  CODEX_SKILL_SRC="$PACKAGE_DIR/.agents/skills/ia-stack/SKILL.md"
  CODEX_SKILL_DST="$PROJECT_DIR/.agents/skills/ia-stack/SKILL.md"
  # Instalar IA Stack dentro de su propio repo es el caso normal para refrescar el runtime: ahi origen y
  # destino son el mismo archivo y `cp` falla. No es un error, es que ya esta donde tiene que estar.
  if [ "$CODEX_SKILL_SRC" != "$CODEX_SKILL_DST" ]; then
    cp "$CODEX_SKILL_SRC" "$CODEX_SKILL_DST"
  fi
  # Y EL MISMO PUNTERO PARA CLAUDE CODE, que busca skills de proyecto en .claude/skills/<nombre>/ y no
  # en .agents/. Con esto `/ia-stack` anda en el proyecto aunque no se haya instalado nada global.
  mkdir -p "$PROJECT_DIR/.claude/skills/ia-stack"
  cp "$CODEX_SKILL_SRC" "$PROJECT_DIR/.claude/skills/ia-stack/SKILL.md"
  # CON UN CLAUDE.md, CLAUDE CODE NO LEE AGENTS.md con la configuracion predeterminada: lo lee solo si
  # no hay CLAUDE.md, CLAUDE.local.md ni .claude/CLAUDE.md, o si uno lo importa con `@AGENTS.md` (docs
  # oficiales, memory, ). Un CLAUDE.md es de la persona: no se reescribe, se avisa.
  for claude_md in CLAUDE.md CLAUDE.local.md .claude/CLAUDE.md; do
    [ -f "$PROJECT_DIR/$claude_md" ] || continue
    if ! grep -q '@AGENTS.md' "$PROJECT_DIR/$claude_md"; then
      echo "AVISO: $PROJECT_DIR/$claude_md existe y no importa @AGENTS.md: con la configuracion predeterminada Claude Code no lee AGENTS.md. Agregale una linea con @AGENTS.md."
    fi
  done
  # UN AGENTS.md QUE ESCRIBIO UN INSTALADOR ANTERIOR Y NADIE EDITO se reconoce por su hash de git
  # sobre el texto con LF, contra contracts/agents-publicados.json, y se actualiza. Cualquier otro es
  # de la persona y no se toca. Sin esto quedaba congelado: dos proyectos de usuarios
  # seguian mandando a leer el protocolo entero.
  AGENTS_HASH=""
  if [ -f "$PROJECT_DIR/AGENTS.md" ]; then
    AGENTS_HASH="$(tr -d '\r' < "$PROJECT_DIR/AGENTS.md" | git hash-object --stdin 2>/dev/null || true)"
  fi
  if [ ! -f "$PROJECT_DIR/AGENTS.md" ]; then
    cp "$PACKAGE_DIR/AGENTS.md" "$PROJECT_DIR/AGENTS.md"
    echo "OK: AGENTS.md creado -> Codex ya ve el protocolo"
  elif cmp -s "$PACKAGE_DIR/AGENTS.md" "$PROJECT_DIR/AGENTS.md"; then
    :
  elif [ -n "$AGENTS_HASH" ] && grep -q "\"$AGENTS_HASH\"" "$PACKAGE_DIR/contracts/agents-publicados.json"; then
    cp "$PACKAGE_DIR/AGENTS.md" "$PROJECT_DIR/AGENTS.md"
    echo "ACTUALIZADO: $PROJECT_DIR/AGENTS.md era el que escribio un instalador anterior, sin editar; ahora es el de esta version."
  else
    echo "NOTE: $PROJECT_DIR/AGENTS.md ya existe y no se toca. Agregale a mano un puntero a .ia-stack/runtime/SKILL.md."
  fi
  # UN SOLO SELLO, CON FECHA Y HORA, para todo lo que esta corrida aparta (los sobrantes del runtime).
  # Con la fecha sola, una segunda poda el mismo dia caia en una carpeta que ya existia, y `mv` anidaba adentro.
  ARCHIVO_DIR="$STATE_DIR/archivo/$(date +%Y-%m-%dT%H%M%S)"
  # Despues de copiar y despues de ignorar el archivo: lo apartado cae en una carpeta que git ya no ve,
  # asi que podar el runtime no ensucia el arbol del proyecto -- ni su `commit` con arbol limpio --.
  apartar_sobrantes "$STATE_DIR/runtime" "$ARCHIVO_DIR/runtime"
  sellar_runtime "$STATE_DIR/runtime"
  echo "OK: project runtime -> $STATE_DIR/runtime"
  # LA VENTANA DE CONTEXTO Y LOS DOS HOOKS, con el ventana.mjs del runtime recien copiado. Va al final:
  # el runtime ya esta, asi que los hooks apuntan a archivos que existen. Si no se puede (sin node, o un
  # settings.local.json que no es JSON estricto) se avisa y la instalacion sigue: no falla por esto.
  if [ "$SIN_VENTANA" -eq 0 ]; then
    if ! command -v node >/dev/null 2>&1; then
      echo "aviso: ventana no aplicada (node no esta disponible)"
    elif VENTANA_OUT="$(node "$STATE_DIR/runtime/scripts/ventana.mjs" aplicar --proyecto "$PROJECT_DIR" 2>&1)"; then
      echo "$VENTANA_OUT"
    else
      echo "aviso: ventana no aplicada ($VENTANA_OUT)"
    fi
  fi
else
  echo "NOTE: no project initialized. Run this command from the package with --project <project-root>."
fi

if [ "$PROJECT_ONLY" -eq 1 ]; then
  echo "NOTE: --project-only: no se instalo la skill global ni el runtime global. /ia-stack anda en este proyecto por su puntero de .claude/skills, y Codex ve el de .agents/skills."
else
  echo "Next: restart Claude Code, open the project, then invoke /ia-stack."
fi
