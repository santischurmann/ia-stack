# IA Stack installer. The selected project receives its own .ia-stack/runtime copy.
param(
  [string]$TargetDir = "$HOME\.claude\skills",
  [string]$RuntimeDir = "$HOME\.claude\ia-stack-runtime",
  [string]$ProjectDir,
  # Decisión de diseño: instalar en UN proyecto sin escribir nada fuera de el. Ver install.sh.
  [switch]$ProjectOnly,
  # No escribir la ventana de contexto ni los hooks en .claude\settings.local.json. Ver install.sh.
  [switch]$SinVentana
)

$ErrorActionPreference = 'Stop'
$SkillName = 'ia-stack'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PackageDir = Split-Path -Parent $ScriptDir

# Las contradicciones se rechazan ANTES de escribir nada: un modo que promete no tocar lo global no
# puede aceptar, ademas, un destino global.
if ($ProjectOnly) {
  if (-not $ProjectDir) { throw 'REJECTED: -ProjectOnly exige -ProjectDir: sin un proyecto no hay nada que instalar.' }
  if ($PSBoundParameters.ContainsKey('TargetDir')) { throw 'REJECTED: -ProjectOnly contradice -TargetDir: uno promete no escribir fuera del proyecto y el otro pide un destino global.' }
  if ($PSBoundParameters.ContainsKey('RuntimeDir')) { throw 'REJECTED: -ProjectOnly contradice -RuntimeDir: uno promete no escribir fuera del proyecto y el otro pide un destino global.' }
}

function Copy-Runtime([string]$Destination) {
  New-Item -ItemType Directory -Force -Path "$Destination\scripts", "$Destination\contracts", "$Destination\tests", "$Destination\templates", "$Destination\skills", "$Destination\.agents", "$Destination\phases" | Out-Null
  Copy-Item "$PackageDir\scripts\*" "$Destination\scripts" -Recurse -Force
  Copy-Item "$PackageDir\contracts\*" "$Destination\contracts" -Recurse -Force
  Copy-Item "$PackageDir\tests\*" "$Destination\tests" -Recurse -Force
  Copy-Item "$PackageDir\templates\*" "$Destination\templates" -Recurse -Force
  Copy-Item "$PackageDir\skills\*" "$Destination\skills" -Recurse -Force
  # Ver el comentario equivalente en install.sh: lo que el instalador lee del paquete tiene que
  # estar en lo que copia, o el runtime instalado no puede reinstalarse.
  Copy-Item "$PackageDir\.agents\*" "$Destination\.agents" -Recurse -Force
  Copy-Item "$PackageDir\phases\*" "$Destination\phases" -Recurse -Force
  Copy-Item "$PackageDir\SKILL.md" "$Destination\SKILL.md" -Force
  Copy-Item "$PackageDir\SECURITY.md" "$Destination\SECURITY.md" -Force
  Copy-Item "$PackageDir\AGENTS.md" "$Destination\AGENTS.md" -Force
}

# LO QUE SOBRA SE APARTA, NO SE BORRA. Ver el comentario equivalente en install.sh: Copy-Runtime copia
# encima y nunca podaba, y un archivo que el protocolo ya no tiene es un gate que se sigue pudiendo
# ejecutar. Se mueve conservando la ruta, y solo dentro de las carpetas que Copy-Runtime copia.
#
# El elemento del bucle se llama $item y no $archivo A PROPOSITO: PowerShell no distingue mayusculas
# en los nombres de variable, asi que $archivo SERIA $Archivo, el destino, y el bucle lo pisaria.
#
# LA RUTA RELATIVA LA DA -Name, NO UNA RESTA. La primera version hacia `FullName.Substring(raiz)` y
# vacio el runtime entero en el CI: en el runner el nombre de usuario del temporal es `RUNNER~1`,
# un nombre corto 8.3, y medido aca `Resolve-Path` CONSERVA el nombre corto mientras `Get-ChildItem`
# devuelve `FullName` con el LARGO. La resta cortaba en otro lugar, ninguna ruta «existia en el
# paquete», y todo se aparto. `-Name` devuelve la ruta relativa a la carpeta recorrida: no hay dos
# formas de la misma ruta que comparar.
#
# Y UNA RED DE SEGURIDAD, que es lo que hubiera frenado eso: una poda que moveria MAS DE LA MITAD del
# runtime no es una limpieza, es un defecto. No mueve nada y lo dice. Mismo principio que el limpiador
# de temporales -- si no se puede derivar nada, no se barre --. La mitad y no «todo»: un defecto que
# rompiera solo algunas rutas pasaria por «todo». Una poda legitima es chica -- la que motivo esto
# fueron 15 archivos de unos 300 --, y un aborto falso cuesta poco: no se mueve nada y se avisa.
function Move-Sobrantes([string]$Runtime, [string]$Archivo) {
  $total = 0
  $candidatos = @()
  foreach ($dir in @('scripts', 'contracts', 'tests', 'templates', 'skills', '.agents', 'phases')) {
    $base = Join-Path $Runtime $dir
    if (-not (Test-Path -LiteralPath $base)) { continue }
    # Se junta la lista ANTES de mover: moviendo mientras se recorre, el recorrido ve una carpeta
    # que cambia debajo suyo.
    foreach ($nombre in @(Get-ChildItem -LiteralPath $base -Recurse -File -Force -Name)) {
      $total++
      $rel = Join-Path $dir $nombre
      if (-not (Test-Path -LiteralPath (Join-Path $PackageDir $rel))) { $candidatos += $rel }
    }
  }
  if ($candidatos.Count * 2 -gt $total) {
    Write-Output "AVISO: la poda iba a apartar $($candidatos.Count) de los $total archivos del runtime, mas de la mitad, y eso no es una limpieza: es un defecto. No se movio nada."
    return
  }
  $apartados = 0
  foreach ($rel in $candidatos) {
    $destino = Join-Path $Archivo $rel
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destino) | Out-Null
    try {
      Move-Item -LiteralPath (Join-Path $Runtime $rel) -Destination $destino -ErrorAction Stop
      $apartados++
      Write-Output "APARTADO: $rel ya no existe en el protocolo. Se MOVIO a $destino; vuelve con Move-Item."
    } catch {
      Write-Output "AVISO: no se pudo apartar $rel. Es una copia vieja de un gate: sacala a mano."
    }
  }
  if ($apartados -gt 0) { Write-Output "OK: $apartados archivo(s) de una instalacion anterior apartado(s), no borrados." }
}

# UNA REGLA NUEVA EN EL .gitignore DEL PROYECTO, con su comentario. Si el archivo no termina en salto
# de linea, primero se termina la ultima: Add-Content pega lo que agrega a esa linea, y con `.env` al
# final quedaba «.env# IA Stack: ...» y `.env` dejaba de ignorarse, sin aviso. install.sh ya miraba el
# ultimo byte; aca faltaba. Lo encontro la cuarta revision.
# CADA REGLA SALE CON EL FINAL DE LINEA QUE EL ARCHIVO YA USA: ver install.sh. `Add-Content` escribia
# siempre CRLF, asi que un .gitignore LF quedaba con finales mezclados. Sin BOM y sin
# depender de la configuracion regional: los bytes se escriben a mano.
function Add-ReglaIgnorada([string]$Archivo, [string]$Comentario, [string]$Regla) {
  $eol = "`n"
  if (Test-Path -LiteralPath $Archivo) {
    $texto = [System.IO.File]::ReadAllText($Archivo)
    if ($texto.Contains("`r`n")) { $eol = "`r`n" }
    if ($texto.Length -gt 0 -and -not $texto.EndsWith("`n")) { [System.IO.File]::AppendAllText($Archivo, $eol) }
  }
  [System.IO.File]::AppendAllText($Archivo, "$Comentario$eol$Regla$eol")
}

# El hash de blob de git del texto sin CR: el mismo que `tr -d '\r' < f | git hash-object --stdin`.
function Get-HashGitLf([string]$Archivo) {
  $sinCr = [byte[]]@([System.IO.File]::ReadAllBytes($Archivo) | Where-Object { $_ -ne 13 })
  $cabecera = [System.Text.Encoding]::ASCII.GetBytes("blob $($sinCr.Length)`0")
  $sha = [System.Security.Cryptography.SHA1]::Create()
  return (($sha.ComputeHash([byte[]]($cabecera + $sinCr)) | ForEach-Object { $_.ToString('x2') }) -join '')
}

# SI UNA RUTA ESTA COMMITEADA EN EL PROYECTO: moverla deja un borrado en su git, y eso se avisa. Con la
# preferencia de errores en Continue, como Set-Sello: si git no esta o el proyecto no es un
# repositorio, la respuesta es «no», no una excepcion.
function Test-Versionado([string]$Proyecto, [string]$Ruta) {
  $ErrorActionPreference = 'Continue'
  try {
    & git -C $Proyecto ls-files --error-unmatch -- $Ruta 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

# EL SELLO: cuando y desde que se instalo este runtime. Ver install.sh. Dos cuidados propios de
# PowerShell 5.1: con 'Stop' cualquier linea de stderr de un comando nativo se vuelve excepcion -- un
# warning de git dejaria el sello a medias --, asi que adentro de esta funcion se baja a 'Continue';
# y el JSON se escribe SIN BOM, porque `-Encoding utf8` lo antepone y JSON.parse no lo acepta. La hora
# va con cultura invariante: el separador ':' de una cadena de formato depende de la cultura.
function Set-Sello([string]$Runtime) {
  $ErrorActionPreference = 'Continue'
  $desde = 'paquete'; $commit = $null; $limpio = $null
  $version = $null
  $m = Select-String -LiteralPath (Join-Path $PackageDir 'SKILL.md') -Pattern '^\*\*Versi[^:]*:\*\*\s*(\d[\d.]*)' | Select-Object -First 1
  if ($m) { $version = $m.Matches[0].Groups[1].Value }
  if (Test-Path -LiteralPath (Join-Path $PackageDir '.git')) {
    $sha = & git -C $PackageDir rev-parse HEAD 2>$null
    if ($LASTEXITCODE -eq 0 -and $sha) {
      $desde = 'checkout'
      $commit = "$sha".Trim()
      $pendientes = & git -C $PackageDir status --porcelain 2>$null | Out-String
      if ($LASTEXITCODE -eq 0) { $limpio = [string]::IsNullOrWhiteSpace($pendientes) }
    }
  }
  $sello = [ordered]@{
    schema       = 'ia.runtime-instalado/1'
    version      = $version
    instalado    = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd'T'HH':'mm':'ss'Z'", [System.Globalization.CultureInfo]::InvariantCulture)
    desde        = $desde
    commit       = $commit
    arbol_limpio = $limpio
  }
  $json = ($sello | ConvertTo-Json) + "`n"
  [System.IO.File]::WriteAllText((Join-Path $Runtime 'INSTALADO.json'), $json, (New-Object System.Text.UTF8Encoding $false))
}

Write-Host '=== IA Stack Installer ===' -ForegroundColor Cyan
Write-Host "Source:  $PackageDir"
if ($ProjectOnly) {
  Write-Host 'Skills:  (omitido: -ProjectOnly)'
  Write-Host 'Runtime: (omitido: -ProjectOnly)'
} else {
  Write-Host "Skills:  $TargetDir"
  Write-Host "Runtime: $RuntimeDir"

  # LA SKILL ES UNA CARPETA CON EL PUNTERO, no el protocolo suelto: ver install.sh.
  New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
  New-Item -ItemType Directory -Force -Path "$TargetDir\$SkillName" | Out-Null
  Copy-Item "$PackageDir\.agents\skills\ia-stack\SKILL.md" "$TargetDir\$SkillName\SKILL.md" -Force
  Copy-Runtime $RuntimeDir
  Set-Sello $RuntimeDir
  Write-Host 'OK: skill, sub-skills, and self-contained runtime installed.' -ForegroundColor Green
}

if ($ProjectDir) {
  if (-not (Test-Path -LiteralPath $ProjectDir -PathType Container)) {
    throw "REJECTED: project directory does not exist: $ProjectDir"
  }
  $ProjectDir = (Resolve-Path -LiteralPath $ProjectDir).Path
  $StateDir = Join-Path $ProjectDir '.ia-stack'
  if (-not (Test-Path -LiteralPath $StateDir)) {
    New-Item -ItemType Directory -Force -Path "$StateDir\sessions", "$StateDir\receipts", "$StateDir\handoffs" | Out-Null
    Copy-Item "$PackageDir\templates\estado\*" $StateDir -Force
  }
  Copy-Runtime "$StateDir\runtime"
  # El runtime es una copia de esta herramienta, no codigo del proyecto. Sin esta regla queda como
  # archivo sin seguimiento, y entonces: se commitea sin querer junto al trabajo del usuario, y el
  # gate de seguridad lo trata como superficie viva -- un hallazgo dentro del runtime bloquearia el
  # proyecto con un CRITICAL que el usuario no escribio y no puede arreglar editando su codigo.
  # PHASE 9 archiva configuracion en .claude-archive/. Puede traer rutas, tokens o datos propios:
  # si queda con seguimiento, el primer commit del usuario se lleva todo eso adentro.
  $IgnoreFile = Join-Path $ProjectDir '.gitignore'
  $ArchiveRule = '.claude-archive/'
  if (-not (Test-Path -LiteralPath $IgnoreFile) -or -not ((Get-Content -LiteralPath $IgnoreFile) -contains $ArchiveRule)) {
    Add-ReglaIgnorada $IgnoreFile '# IA Stack PHASE 9: lo que la limpieza archiva, nunca se commitea' $ArchiveRule
    Write-Output "OK: $ArchiveRule agregado a .gitignore"
  }
  $ignoreFile = Join-Path $ProjectDir '.gitignore'
  # Lo que la poda mueve es una copia del runtime, igual que el runtime: tampoco se versiona.
  $runtimeArchiveRule = '.ia-stack/archivo/'
  if (-not ((Test-Path $ignoreFile) -and ((Get-Content $ignoreFile) -contains $runtimeArchiveRule))) {
    Add-ReglaIgnorada $ignoreFile '# IA Stack: lo que el instalador poda del runtime, tampoco es codigo del proyecto' $runtimeArchiveRule
    Write-Host "OK: $runtimeArchiveRule agregado a .gitignore" -ForegroundColor Green
  }
  $ignoreRule = '.ia-stack/runtime/'
  $yaEsta = (Test-Path $ignoreFile) -and ((Get-Content $ignoreFile) -contains $ignoreRule)
  if (-not $yaEsta) {
    Add-ReglaIgnorada $ignoreFile '# IA Stack: copia del runtime, no es codigo del proyecto' $ignoreRule
    Write-Host "OK: $ignoreRule agregado a .gitignore" -ForegroundColor Green
  }
  # Codex descubre skills de repositorio SOLO en .agents/skills/<nombre>/SKILL.md y en
  # .codex/skills/, y sus instrucciones solo en AGENTS.md -- verificado ejecutando. Sin estos dos
  # punteros, IA Stack existe en el proyecto pero Codex no ve nada de el. Son punteros, no copias.
  $CodexSkillDir = Join-Path $ProjectDir '.agents\skills\ia-stack'
  New-Item -ItemType Directory -Force -Path $CodexSkillDir | Out-Null
  # Instalar IA Stack dentro de su propio repo es el caso normal para refrescar el runtime: ahi origen
  # y destino son el mismo archivo. No es un error, es que ya esta donde tiene que estar.
  $CodexSkillSrc = "$PackageDir\.agents\skills\ia-stack\SKILL.md"
  $CodexSkillDst = Join-Path $CodexSkillDir 'SKILL.md'
  # Y el mismo puntero para Claude Code, que busca skills de proyecto en .claude\skills: ver install.sh.
  $ClaudeSkillDir = Join-Path $ProjectDir '.claude\skills\ia-stack'
  New-Item -ItemType Directory -Force -Path $ClaudeSkillDir | Out-Null
  Copy-Item $CodexSkillSrc (Join-Path $ClaudeSkillDir 'SKILL.md') -Force
  # Con un CLAUDE.md, Claude Code no lee AGENTS.md con la configuracion predeterminada: ver install.sh.
  foreach ($claudeMd in @('CLAUDE.md', 'CLAUDE.local.md', '.claude\CLAUDE.md')) {
    $rutaClaudeMd = Join-Path $ProjectDir $claudeMd
    if ((Test-Path -LiteralPath $rutaClaudeMd) -and -not (Select-String -LiteralPath $rutaClaudeMd -Pattern '@AGENTS.md' -SimpleMatch -Quiet)) {
      Write-Output "AVISO: $rutaClaudeMd existe y no importa @AGENTS.md: con la configuracion predeterminada Claude Code no lee AGENTS.md. Agregale una linea con @AGENTS.md."
    }
  }
  if ((Resolve-Path -LiteralPath $CodexSkillSrc).Path -ne $CodexSkillDst) {
    Copy-Item $CodexSkillSrc $CodexSkillDir -Force
  }
  # UN AGENTS.md QUE ESCRIBIO UN INSTALADOR ANTERIOR Y NADIE EDITO se reconoce por su hash y se
  # actualiza: ver install.sh y contracts/agents-publicados.json. Cualquier otro no se toca.
  $ProjectAgents = Join-Path $ProjectDir 'AGENTS.md'
  $PackageAgents = "$PackageDir\AGENTS.md"
  $Publicados = (Get-Content -LiteralPath "$PackageDir\contracts\agents-publicados.json" -Raw | ConvertFrom-Json).blobs
  if (-not (Test-Path -LiteralPath $ProjectAgents)) {
    Copy-Item $PackageAgents $ProjectAgents -Force
    Write-Output "OK: AGENTS.md creado -> Codex ya ve el protocolo"
  } elseif ([Linq.Enumerable]::SequenceEqual([IO.File]::ReadAllBytes($PackageAgents), [IO.File]::ReadAllBytes($ProjectAgents))) {
    # Ya es el de esta version.
  } elseif ($Publicados -contains (Get-HashGitLf $ProjectAgents)) {
    Copy-Item $PackageAgents $ProjectAgents -Force
    Write-Output "ACTUALIZADO: $ProjectAgents era el que escribio un instalador anterior, sin editar; ahora es el de esta version."
  } else {
    Write-Output "NOTE: $ProjectAgents ya existe y no se toca. Agregale a mano un puntero a .ia-stack/runtime/SKILL.md."
  }
  # UN SOLO SELLO, CON FECHA Y HORA, para todo lo que esta corrida aparta: ver install.sh.
  $archivoDir = Join-Path $StateDir ("archivo\" + (Get-Date -Format "yyyy-MM-dd'T'HHmmss"))
  # Despues de copiar y despues de ignorar el archivo: lo apartado cae donde git ya no mira.
  Move-Sobrantes "$StateDir\runtime" (Join-Path $archivoDir 'runtime')
  Set-Sello "$StateDir\runtime"
  Write-Host "OK: project runtime -> $StateDir\runtime" -ForegroundColor Green
  # LA VENTANA DE CONTEXTO Y LOS DOS HOOKS: ver el comentario equivalente en install.sh.
  if (-not $SinVentana) {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
      Write-Output 'aviso: ventana no aplicada (node no esta disponible)'
    } else {
      # Con 'Stop', lo que node escribe en stderr cortaria el instalador: se baja solo para esta llamada.
      $prevEap = $ErrorActionPreference
      $ErrorActionPreference = 'Continue'
      $ventanaOut = (& node "$StateDir\runtime\scripts\ventana.mjs" aplicar --proyecto $ProjectDir 2>&1 | ForEach-Object { "$_" }) -join "`n"
      $ventanaExit = $LASTEXITCODE
      $ErrorActionPreference = $prevEap
      if ($ventanaExit -eq 0) { Write-Output $ventanaOut } else { Write-Output "aviso: ventana no aplicada ($ventanaOut)" }
    }
  }
} else {
  Write-Host 'NOTE: no project initialized. Re-run with -ProjectDir <project-root>.' -ForegroundColor Yellow
}

if ($ProjectOnly) {
  Write-Host '-ProjectOnly: no se instalo la skill global ni el runtime global. /ia-stack anda en este proyecto por su puntero de .claude/skills, y Codex ve el de .agents/skills.'
} else {
  Write-Host 'Next: restart Claude Code, open the project, then invoke /ia-stack.'
}
