# IA Stack installer. The selected project receives its own .vibe/ia-stack-runtime copy.
param(
  [string]$TargetDir = "$HOME\.claude\skills",
  [string]$RuntimeDir = "$HOME\.claude\ia-stack-runtime",
  [string]$ProjectDir,
  # Decidido por el operador el 2026-10-05: instalar en UN proyecto sin escribir nada fuera de el. Ver install.sh.
  [switch]$ProjectOnly
)

$ErrorActionPreference = 'Stop'
$SkillName = 'ia-stack'
# EL NOMBRE ANTERIOR SIGUE ANDANDO: esta escrito en cada proyecto que ya lo instalo.
$SkillAlias = 'VibeCodeProtocols'
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
  New-Item -ItemType Directory -Force -Path "$Destination\scripts", "$Destination\contracts", "$Destination\tests", "$Destination\templates", "$Destination\skills", "$Destination\.agents" | Out-Null
  Copy-Item "$PackageDir\scripts\*" "$Destination\scripts" -Recurse -Force
  Copy-Item "$PackageDir\contracts\*" "$Destination\contracts" -Recurse -Force
  Copy-Item "$PackageDir\tests\*" "$Destination\tests" -Recurse -Force
  Copy-Item "$PackageDir\templates\*" "$Destination\templates" -Recurse -Force
  Copy-Item "$PackageDir\skills\*" "$Destination\skills" -Recurse -Force
  # Ver el comentario equivalente en install.sh: lo que el instalador lee del paquete tiene que
  # estar en lo que copia, o el runtime instalado no puede reinstalarse.
  Copy-Item "$PackageDir\.agents\*" "$Destination\.agents" -Recurse -Force
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
# el 2026-09-22 vacio el runtime entero en el CI: en el runner el nombre de usuario del temporal es `RUNNER~1`,
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
  foreach ($dir in @('scripts', 'contracts', 'tests', 'templates', 'skills', '.agents')) {
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
# ultimo byte; aca faltaba. Lo encontro la cuarta revision del 2026-09-27.
function Add-ReglaIgnorada([string]$Archivo, [string]$Comentario, [string]$Regla) {
  if (Test-Path -LiteralPath $Archivo) {
    $texto = Get-Content -LiteralPath $Archivo -Raw
    if ($texto -and -not $texto.EndsWith("`n")) { Add-Content -LiteralPath $Archivo -Value '' }
  }
  Add-Content -LiteralPath $Archivo -Value $Comentario
  Add-Content -LiteralPath $Archivo -Value $Regla
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

  New-Item -ItemType Directory -Force -Path $TargetDir, "$TargetDir\ia-stack-skills" | Out-Null
  Copy-Item "$PackageDir\SKILL.md" "$TargetDir\$SkillName.md" -Force
  Copy-Item "$PackageDir\SKILL.md" "$TargetDir\$SkillAlias.md" -Force
  Copy-Item "$PackageDir\skills\*" "$TargetDir\ia-stack-skills" -Recurse -Force
  Copy-Runtime $RuntimeDir
  Write-Host 'OK: skill, sub-skills, and self-contained runtime installed.' -ForegroundColor Green
}

if ($ProjectDir) {
  if (-not (Test-Path -LiteralPath $ProjectDir -PathType Container)) {
    throw "REJECTED: project directory does not exist: $ProjectDir"
  }
  $ProjectDir = (Resolve-Path -LiteralPath $ProjectDir).Path
  $VibeDir = Join-Path $ProjectDir '.vibe'
  if (-not (Test-Path -LiteralPath $VibeDir)) {
    New-Item -ItemType Directory -Force -Path "$VibeDir\sessions", "$VibeDir\receipts", "$VibeDir\handoffs" | Out-Null
    Copy-Item "$PackageDir\templates\vibe\*" $VibeDir -Force
    New-Item -ItemType File -Force -Path "$VibeDir\AUDIT.md" | Out-Null
    $projectName = Split-Path -Leaf $ProjectDir
    $today = Get-Date -Format 'yyyy-MM-dd'
    (Get-Content "$VibeDir\PROJECT.md") -replace '\(fill in\)', $projectName -replace 'YYYY-MM-DD', $today | Set-Content "$VibeDir\PROJECT.md"
  }
  Copy-Runtime "$VibeDir\ia-stack-runtime"
  # El runtime es una copia de esta herramienta, no codigo del proyecto. Sin esta regla queda como
  # archivo sin seguimiento, y entonces: se commitea sin querer junto al trabajo del usuario, y el
  # gate de seguridad lo trata como superficie viva -- un hallazgo dentro del runtime bloquearia el
  # proyecto con un CRITICAL que el usuario no escribio y no puede arreglar editando su codigo.
  # PHASE 9 archiva configuracion en .claude-archive/. Puede traer rutas, tokens o datos propios:
  # si queda con seguimiento, el primer commit del usuario se lleva todo eso adentro.
  $IgnoreFile = Join-Path $ProjectDir '.gitignore'
  $ArchiveRule = '.claude-archive/'
  if (-not (Test-Path -LiteralPath $IgnoreFile) -or -not ((Get-Content -LiteralPath $IgnoreFile) -contains $ArchiveRule)) {
    Add-Content -LiteralPath $IgnoreFile -Value "`n# IA Stack PHASE 9: lo que la limpieza archiva, nunca se commitea`n$ArchiveRule"
    Write-Output "OK: $ArchiveRule agregado a .gitignore"
  }
  $ignoreFile = Join-Path $ProjectDir '.gitignore'
  # Lo que la poda mueve es una copia del runtime, igual que el runtime: tampoco se versiona.
  $runtimeArchiveRule = '.vibe/ia-stack-archive/'
  if (-not ((Test-Path $ignoreFile) -and ((Get-Content $ignoreFile) -contains $runtimeArchiveRule))) {
    Add-ReglaIgnorada $ignoreFile '# IA Stack: lo que el instalador poda del runtime viejo, tampoco es codigo del proyecto' $runtimeArchiveRule
    Write-Host "OK: $runtimeArchiveRule agregado a .gitignore" -ForegroundColor Green
  }
  $ignoreRule = '.vibe/ia-stack-runtime/'
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
  if ((Resolve-Path -LiteralPath $CodexSkillSrc).Path -ne $CodexSkillDst) {
    Copy-Item $CodexSkillSrc $CodexSkillDir -Force
  }
  $ProjectAgents = Join-Path $ProjectDir 'AGENTS.md'
  if (-not (Test-Path -LiteralPath $ProjectAgents)) {
    Copy-Item "$PackageDir\AGENTS.md" $ProjectAgents -Force
    Write-Output "OK: AGENTS.md creado -> Codex ya ve el protocolo"
  } else {
    Write-Output "NOTE: $ProjectAgents ya existe y no se toca. Agregale a mano un puntero a .vibe/ia-stack-runtime/SKILL.md."
    # El que escribio el instalador viejo apunta a la carpeta del nombre anterior: ver install.sh.
    if (Select-String -LiteralPath $ProjectAgents -Pattern 'vcp-runtime' -SimpleMatch -Quiet) {
      Write-Output "AVISO: $ProjectAgents apunta a .vibe/vcp-runtime/SKILL.md, la carpeta del nombre anterior. No se toca: cambia esa ruta a mano por .vibe/ia-stack-runtime/SKILL.md."
    }
  }
    # LA CARPETA CAMBIO DE NOMBRE el 2026-09-15. Hasta entonces el instalador copiaba y nunca podaba,
  # asi que una instalacion anterior quedaba con las dos y la vieja era una copia de los gates que
  # alguien podia ejecutar sin darse cuenta. Avisar no alcanzaba: el aviso se lee una vez.
  #
  # AHORA SE PODA MOVIENDO, que es la regla de oro del propio protocolo: en una limpieza no existe
  # rm. La carpeta vieja va al lado, con fecha y hora, y vuelve con un Move-Item si algo se rompio.
  #
  # UN SOLO SELLO, CON FECHA Y HORA, para todo lo que esta corrida aparta: ver install.sh. Y la carpeta
  # vieja se pregunta como CARPETA y se mueve sin -Force: un archivo con ese nombre no es el runtime,
  # y -Force podia pisar lo que ya hubiera en el destino. Lo encontro la revision del 2026-09-27.
  $archivoDir = Join-Path $VibeDir ("ia-stack-archive\" + (Get-Date -Format "yyyy-MM-dd'T'HHmmss"))
  if (Test-Path -LiteralPath "$VibeDir\vcp-runtime" -PathType Container) {
    # Un proyecto de la semana del 2026-08-23 al 08-28 puede tenerla commiteada: ver install.sh.
    $runtimeVersionado = Test-Versionado $ProjectDir "$VibeDir\vcp-runtime"
    New-Item -ItemType Directory -Force -Path $archivoDir | Out-Null
    try {
      Move-Item -LiteralPath "$VibeDir\vcp-runtime" -Destination (Join-Path $archivoDir 'vcp-runtime') -ErrorAction Stop
      Write-Output "PODADO: $VibeDir\vcp-runtime era del nombre anterior y ya no se actualizaba."
      Write-Output "        Se MOVIO a $archivoDir\vcp-runtime. No se borro nada: si algo se rompe, vuelve con Move-Item."
      if ($runtimeVersionado) { Write-Output "AVISO: $VibeDir\vcp-runtime estaba versionada en el proyecto: moverla deja un borrado en su git. Commitealo." }
    } catch {
      Write-Output "AVISO: no se pudo mover $VibeDir\vcp-runtime. Sacala a mano: es una copia vieja de los gates."
    }
  }
  # EL PUNTERO DE CODEX DEL NOMBRE ANTERIOR, tambien: ver install.sh. Moverlo a una carpeta que ya
  # existe lo deja adentro de ella, con su nombre.
  $punteroAnterior = Join-Path $ProjectDir '.agents\skills\vibecodeprotocols'
  if (Test-Path -LiteralPath $punteroAnterior -PathType Container) {
    # Si el proyecto lo tenia commiteado, moverlo deja un borrado en su git: se pregunta ANTES.
    $versionado = Test-Versionado $ProjectDir $punteroAnterior
    $destinoPuntero = Join-Path $archivoDir '.agents\skills'
    New-Item -ItemType Directory -Force -Path $destinoPuntero | Out-Null
    try {
      Move-Item -LiteralPath $punteroAnterior -Destination $destinoPuntero -ErrorAction Stop
      Write-Output "PODADO: $punteroAnterior era el puntero de Codex del nombre anterior, y apuntaba a una carpeta que ya no esta."
      Write-Output "        Se MOVIO a $destinoPuntero. Codex ve una sola skill del protocolo."
      if ($versionado) { Write-Output "AVISO: ese puntero estaba versionado en el proyecto: moverlo deja un borrado en su git. Commitealo." }
    } catch {
      Write-Output "AVISO: no se pudo mover $punteroAnterior. Sacalo a mano: Codex ve dos skills del protocolo, y esa apunta a una carpeta que ya no esta."
    }
  }
  # Despues de copiar y despues de ignorar el archivo: lo apartado cae donde git ya no mira. Las
  # excepciones son la carpeta del runtime viejo y su puntero de Codex, si estaban commiteados: ahi
  # el borrado es real, y se avisa.
  Move-Sobrantes "$VibeDir\ia-stack-runtime" (Join-Path $archivoDir 'ia-stack-runtime')
  Set-Sello "$VibeDir\ia-stack-runtime"
  Write-Host "OK: project runtime -> $VibeDir\ia-stack-runtime" -ForegroundColor Green
} else {
  Write-Host 'NOTE: no project initialized. Re-run with -ProjectDir <project-root>.' -ForegroundColor Yellow
}

if ($ProjectOnly) {
  Write-Host '-ProjectOnly: no se instalo la skill global ni el runtime global, asi que /ia-stack no existe en Claude Code hasta instalarlos; Codex si ve el puntero del proyecto.'
} else {
  Write-Host 'Next: restart Claude Code, open the project, then invoke /ia-stack (/VibeCodeProtocols sigue andando).'
}
