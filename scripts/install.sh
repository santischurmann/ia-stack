#!/usr/bin/env bash
# VibeCodeProtocols installer. It installs a co-located runtime into each chosen project so
# every command in SKILL.md resolves from that project, not from the package clone.
set -euo pipefail

SKILL_NAME="ia-stack"
# EL NOMBRE ANTERIOR SIGUE ANDANDO. `/VibeCodeProtocols` esta escrito en cada proyecto que ya lo
# instalo, en notas y en costumbre: quitarlo convertiria un cambio de nombre en una rotura para
# todos los que ya lo usaban. Se instalan las dos, con el mismo contenido.
SKILL_ALIAS="VibeCodeProtocols"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
TARGET_DIR="$HOME/.claude/skills"
RUNTIME_DIR="$HOME/.claude/ia-stack-runtime"
PROJECT_DIR=""

usage() {
  echo "Usage: install.sh [--target-dir <dir>] [--runtime-dir <dir>] [--project <project-root>]" >&2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target-dir) TARGET_DIR="${2:?--target-dir needs a path}"; shift 2 ;;
    --runtime-dir) RUNTIME_DIR="${2:?--runtime-dir needs a path}"; shift 2 ;;
    --project) PROJECT_DIR="${2:?--project needs a path}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

copy_runtime() {
  local destination="$1"
  mkdir -p "$destination/scripts" "$destination/contracts" "$destination/tests" "$destination/templates" "$destination/skills" "$destination/.agents"
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
  cp "$PACKAGE_DIR/SKILL.md" "$destination/SKILL.md"
  cp "$PACKAGE_DIR/SECURITY.md" "$destination/SECURITY.md"
  cp "$PACKAGE_DIR/AGENTS.md" "$destination/AGENTS.md"
}

# LO QUE SOBRA SE APARTA, NO SE BORRA. Decidido por el operador el 2026-09-22. copy_runtime copia
# ENCIMA y nunca podaba: en un proyecto real quedaron 15 archivos de mas tras reinstalar, y uno era
# un gate retirado con el que despues se sello un indice. Un archivo que el protocolo ya no tiene es
# un gate que se sigue pudiendo ejecutar desde la copia.
#
# Se MUEVE conservando la ruta, como la carpeta del nombre anterior mas abajo: en una limpieza de este
# protocolo no existe rm. Solo recorre las carpetas que copy_runtime copia -- nunca la raiz del
# runtime, donde vive el sello --. Y el archivo lleva fecha Y hora: con fecha sola, dos reinstalaciones
# el mismo dia harian que el segundo mv pise al primero, y pisar tambien es borrar.
apartar_sobrantes() {
  local runtime="$1" archivo="$2" apartados=0 dir f rel
  for dir in scripts contracts tests templates skills .agents; do
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
# anterior al 2026-09-15 sin que nadie se enterara --. Un paquete sin git no tiene commit que nombrar,
# y eso se dice en vez de inventarlo. Un checkout con cambios sin commitear tambien se dice: ahi el
# commit no describe la copia del todo.
sellar_runtime() {
  local runtime="$1" desde="paquete" commit="null" limpio="null" sha pendientes
  if [ -e "$PACKAGE_DIR/.git" ] && sha="$(git -C "$PACKAGE_DIR" rev-parse HEAD 2>/dev/null)"; then
    desde="checkout"
    commit="\"$sha\""
    if pendientes="$(git -C "$PACKAGE_DIR" status --porcelain 2>/dev/null)"; then
      if [ -z "$pendientes" ]; then limpio="true"; else limpio="false"; fi
    fi
  fi
  printf '{\n  "schema": "ia.runtime-instalado/1",\n  "instalado": "%s",\n  "desde": "%s",\n  "commit": %s,\n  "arbol_limpio": %s\n}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$desde" "$commit" "$limpio" > "$runtime/INSTALADO.json"
}

echo "=== IA Stack Installer ==="
echo "Source:  $PACKAGE_DIR"
echo "Skills:  $TARGET_DIR"
echo "Runtime: $RUNTIME_DIR"

mkdir -p "$TARGET_DIR" "$TARGET_DIR/vcp-skills"
cp "$PACKAGE_DIR/SKILL.md" "$TARGET_DIR/$SKILL_NAME.md"
cp "$PACKAGE_DIR/SKILL.md" "$TARGET_DIR/$SKILL_ALIAS.md"
cp -R "$PACKAGE_DIR/skills/." "$TARGET_DIR/ia-stack-skills/"
copy_runtime "$RUNTIME_DIR"
chmod +x "$RUNTIME_DIR/scripts/"*.sh
echo "OK: skill, sub-skills, and self-contained runtime installed."

if [ -n "$PROJECT_DIR" ]; then
  if [ ! -d "$PROJECT_DIR" ]; then
    echo "REJECTED: project directory does not exist: $PROJECT_DIR" >&2
    exit 1
  fi
  PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"
  VIBE_DIR="$PROJECT_DIR/.vibe"
  if [ ! -d "$VIBE_DIR" ]; then
    mkdir -p "$VIBE_DIR/sessions" "$VIBE_DIR/receipts" "$VIBE_DIR/handoffs"
    cp "$PACKAGE_DIR/templates/vibe/"* "$VIBE_DIR/"
    touch "$VIBE_DIR/AUDIT.md"
    PROJECT_NAME="$(basename "$PROJECT_DIR")"
    TODAY="$(date +%Y-%m-%d)"
    sed -i "s/(fill in)/$PROJECT_NAME/1" "$VIBE_DIR/PROJECT.md" 2>/dev/null || true
    sed -i "s/YYYY-MM-DD/$TODAY/g" "$VIBE_DIR/PROJECT.md" 2>/dev/null || true
  fi
  copy_runtime "$VIBE_DIR/ia-stack-runtime"
  chmod +x "$VIBE_DIR/ia-stack-runtime/scripts/"*.sh
  # El runtime es una copia de esta herramienta, no codigo del proyecto. Sin esta regla queda como
  # archivo sin seguimiento, y entonces: se commitea sin querer junto al trabajo del usuario, y el
  # gate de seguridad lo trata como superficie viva -- un hallazgo dentro del runtime bloquearia el
  # proyecto con un CRITICAL que el usuario no escribio y no puede arreglar editando su codigo.
  IGNORE_FILE="$PROJECT_DIR/.gitignore"
  # PHASE 9 archiva configuracion en .claude-archive/. Puede traer rutas, tokens o datos propios:
  # si queda con seguimiento, el primer commit del usuario se lleva todo eso adentro.
  ARCHIVE_RULE=".claude-archive/"
  if [ ! -f "$IGNORE_FILE" ] || ! grep -qxF "$ARCHIVE_RULE" "$IGNORE_FILE"; then
    [ -s "$IGNORE_FILE" ] && [ -n "$(tail -c 1 "$IGNORE_FILE")" ] && echo "" >> "$IGNORE_FILE"
    printf '# IA Stack PHASE 9: lo que la limpieza archiva, nunca se commitea
%s
' "$ARCHIVE_RULE" >> "$IGNORE_FILE"
    echo "OK: $ARCHIVE_RULE agregado a .gitignore"
  fi
  # Lo que la poda mueve es una copia del runtime, igual que el runtime: tampoco se versiona.
  RUNTIME_ARCHIVE_RULE=".vibe/ia-stack-archive/"
  if [ ! -f "$IGNORE_FILE" ] || ! grep -qxF "$RUNTIME_ARCHIVE_RULE" "$IGNORE_FILE"; then
    [ -s "$IGNORE_FILE" ] && [ -n "$(tail -c 1 "$IGNORE_FILE")" ] && echo "" >> "$IGNORE_FILE"
    printf '# IA Stack: lo que el instalador poda del runtime viejo, tampoco es codigo del proyecto
%s
' "$RUNTIME_ARCHIVE_RULE" >> "$IGNORE_FILE"
    echo "OK: $RUNTIME_ARCHIVE_RULE agregado a .gitignore"
  fi
  IGNORE_RULE=".vibe/ia-stack-runtime/"
  if [ ! -f "$IGNORE_FILE" ] || ! grep -qxF "$IGNORE_RULE" "$IGNORE_FILE"; then
    [ -s "$IGNORE_FILE" ] && [ -n "$(tail -c 1 "$IGNORE_FILE")" ] && echo "" >> "$IGNORE_FILE"
    printf '# IA Stack: copia del runtime, no es codigo del proyecto
%s
' "$IGNORE_RULE" >> "$IGNORE_FILE"
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
  # Instalar VCP dentro de su propio repo es el caso normal para refrescar el runtime: ahi origen y
  # destino son el mismo archivo y `cp` falla. No es un error, es que ya esta donde tiene que estar.
  if [ "$CODEX_SKILL_SRC" != "$CODEX_SKILL_DST" ]; then
    cp "$CODEX_SKILL_SRC" "$CODEX_SKILL_DST"
  fi
  if [ ! -f "$PROJECT_DIR/AGENTS.md" ]; then
    cp "$PACKAGE_DIR/AGENTS.md" "$PROJECT_DIR/AGENTS.md"
    echo "OK: AGENTS.md creado -> Codex ya ve el protocolo"
  else
    echo "NOTE: $PROJECT_DIR/AGENTS.md ya existe y no se toca. Agregale a mano un puntero a .vibe/ia-stack-runtime/SKILL.md."
  fi
  # LA CARPETA CAMBIO DE NOMBRE el 2026-09-15, cuando el protocolo paso a llamarse IA Stack. Hasta
  # entonces el instalador COPIABA Y NUNCA PODABA, asi que una instalacion anterior quedaba con las
  # dos y la vieja era una copia de los gates que alguien podia ejecutar sin darse cuenta. Avisar no
  # alcanzaba: el aviso se lee una vez y la copia se queda para siempre.
  #
  # AHORA SE PODA, Y SE PODA MOVIENDO. Es la regla de oro del propio protocolo -- en una limpieza NO
  # EXISTE rm: todo se mueve conservando la ruta -- y aca vale igual. La carpeta vieja va al lado, a
  # la vista, con fecha, y vuelve con un mv si algo se rompio.
  if [ -d "$VIBE_DIR/vcp-runtime" ]; then
    ARCHIVO_DIR="$VIBE_DIR/ia-stack-archive/$(date +%Y-%m-%d)"
    mkdir -p "$ARCHIVO_DIR"
    if mv "$VIBE_DIR/vcp-runtime" "$ARCHIVO_DIR/vcp-runtime"; then
      echo "PODADO: $VIBE_DIR/vcp-runtime era del nombre anterior y ya no se actualizaba."
      echo "        Se MOVIO a $ARCHIVO_DIR/vcp-runtime. No se borro nada: si algo se rompe, vuelve con mv."
    else
      echo "AVISO: no se pudo mover $VIBE_DIR/vcp-runtime. Sacala a mano: es una copia vieja de los gates." >&2
    fi
  fi
  # Despues de copiar y despues de ignorar el archivo: lo apartado cae en una carpeta que git ya no ve,
  # asi que podar no ensucia el arbol del proyecto -- ni su `commit` con arbol limpio --.
  apartar_sobrantes "$VIBE_DIR/ia-stack-runtime" "$VIBE_DIR/ia-stack-archive/$(date +%Y-%m-%dT%H%M%S)/ia-stack-runtime"
  sellar_runtime "$VIBE_DIR/ia-stack-runtime"
  echo "OK: project runtime -> $VIBE_DIR/ia-stack-runtime"
else
  echo "NOTE: no project initialized. Run this command from the package with --project <project-root>."
fi

echo "Next: restart Claude Code, open the project, then invoke /ia-stack (/VibeCodeProtocols sigue andando)."
