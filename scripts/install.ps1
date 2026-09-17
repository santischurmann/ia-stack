# IA Stack installer. The selected project receives its own .vibe/ia-stack-runtime copy.
param(
  [string]$TargetDir = "$HOME\.claude\skills",
  [string]$RuntimeDir = "$HOME\.claude\ia-stack-runtime",
  [string]$ProjectDir
)

$ErrorActionPreference = 'Stop'
$SkillName = 'ia-stack'
# EL NOMBRE ANTERIOR SIGUE ANDANDO: esta escrito en cada proyecto que ya lo instalo.
$SkillAlias = 'VibeCodeProtocols'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PackageDir = Split-Path -Parent $ScriptDir

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

Write-Host '=== IA Stack Installer ===' -ForegroundColor Cyan
Write-Host "Source:  $PackageDir"
Write-Host "Skills:  $TargetDir"
Write-Host "Runtime: $RuntimeDir"

New-Item -ItemType Directory -Force -Path $TargetDir, "$TargetDir\ia-stack-skills" | Out-Null
Copy-Item "$PackageDir\SKILL.md" "$TargetDir\$SkillName.md" -Force
Copy-Item "$PackageDir\SKILL.md" "$TargetDir\$SkillAlias.md" -Force
Copy-Item "$PackageDir\skills\*" "$TargetDir\ia-stack-skills" -Recurse -Force
Copy-Runtime $RuntimeDir
Write-Host 'OK: skill, sub-skills, and self-contained runtime installed.' -ForegroundColor Green

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
    Add-Content -Path $ignoreFile -Value '# IA Stack: lo que el instalador poda del runtime viejo, tampoco es codigo del proyecto'
    Add-Content -Path $ignoreFile -Value $runtimeArchiveRule
    Write-Host "OK: $runtimeArchiveRule agregado a .gitignore" -ForegroundColor Green
  }
  $ignoreRule = '.vibe/ia-stack-runtime/'
  $yaEsta = (Test-Path $ignoreFile) -and ((Get-Content $ignoreFile) -contains $ignoreRule)
  if (-not $yaEsta) {
    Add-Content -Path $ignoreFile -Value '# IA Stack: copia del runtime, no es codigo del proyecto'
    Add-Content -Path $ignoreFile -Value $ignoreRule
    Write-Host "OK: $ignoreRule agregado a .gitignore" -ForegroundColor Green
  }
  # Codex descubre skills de repositorio SOLO en .agents/skills/<nombre>/SKILL.md y en
  # .codex/skills/, y sus instrucciones solo en AGENTS.md -- verificado ejecutando. Sin estos dos
  # punteros, VCP existe en el proyecto pero Codex no ve nada de el. Son punteros, no copias.
  $CodexSkillDir = Join-Path $ProjectDir '.agents\skills\ia-stack'
  New-Item -ItemType Directory -Force -Path $CodexSkillDir | Out-Null
  # Instalar VCP dentro de su propio repo es el caso normal para refrescar el runtime: ahi origen
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
  }
    # LA CARPETA CAMBIO DE NOMBRE el 2026-09-15. Hasta entonces el instalador copiaba y nunca podaba,
  # asi que una instalacion anterior quedaba con las dos y la vieja era una copia de los gates que
  # alguien podia ejecutar sin darse cuenta. Avisar no alcanzaba: el aviso se lee una vez.
  #
  # AHORA SE PODA MOVIENDO, que es la regla de oro del propio protocolo: en una limpieza no existe
  # rm. La carpeta vieja va al lado, con fecha, y vuelve con un Move-Item si algo se rompio.
  if (Test-Path "$VibeDir\vcp-runtime") {
    $archivoDir = Join-Path $VibeDir ("ia-stack-archive\" + (Get-Date -Format 'yyyy-MM-dd'))
    New-Item -ItemType Directory -Force -Path $archivoDir | Out-Null
    try {
      Move-Item -LiteralPath "$VibeDir\vcp-runtime" -Destination (Join-Path $archivoDir 'vcp-runtime') -Force -ErrorAction Stop
      Write-Output "PODADO: $VibeDir\vcp-runtime era del nombre anterior y ya no se actualizaba."
      Write-Output "        Se MOVIO a $archivoDir\vcp-runtime. No se borro nada: si algo se rompe, vuelve con Move-Item."
    } catch {
      Write-Output "AVISO: no se pudo mover $VibeDir\vcp-runtime. Sacala a mano: es una copia vieja de los gates."
    }
  }
  Write-Host "OK: project runtime -> $VibeDir\ia-stack-runtime" -ForegroundColor Green
} else {
  Write-Host 'NOTE: no project initialized. Re-run with -ProjectDir <project-root>.' -ForegroundColor Yellow
}

Write-Host 'Next: restart Claude Code, open the project, then invoke /ia-stack (/VibeCodeProtocols sigue andando).'
