# VibeCodeProtocols installer. The selected project receives its own .vibe/vcp-runtime copy.
param(
  [string]$TargetDir = "$HOME\.claude\skills",
  [string]$RuntimeDir = "$HOME\.claude\vcp-runtime",
  [string]$ProjectDir
)

$ErrorActionPreference = 'Stop'
$SkillName = 'VibeCodeProtocols'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PackageDir = Split-Path -Parent $ScriptDir

function Copy-Runtime([string]$Destination) {
  New-Item -ItemType Directory -Force -Path "$Destination\scripts", "$Destination\contracts", "$Destination\tests", "$Destination\templates", "$Destination\skills" | Out-Null
  Copy-Item "$PackageDir\scripts\*" "$Destination\scripts" -Recurse -Force
  Copy-Item "$PackageDir\contracts\*" "$Destination\contracts" -Recurse -Force
  Copy-Item "$PackageDir\tests\*" "$Destination\tests" -Recurse -Force
  Copy-Item "$PackageDir\templates\*" "$Destination\templates" -Recurse -Force
  Copy-Item "$PackageDir\skills\*" "$Destination\skills" -Recurse -Force
  Copy-Item "$PackageDir\SKILL.md" "$Destination\SKILL.md" -Force
  Copy-Item "$PackageDir\SECURITY.md" "$Destination\SECURITY.md" -Force
}

Write-Host '=== VibeCodeProtocols Installer ===' -ForegroundColor Cyan
Write-Host "Source:  $PackageDir"
Write-Host "Skills:  $TargetDir"
Write-Host "Runtime: $RuntimeDir"

New-Item -ItemType Directory -Force -Path $TargetDir, "$TargetDir\vcp-skills" | Out-Null
Copy-Item "$PackageDir\SKILL.md" "$TargetDir\$SkillName.md" -Force
Copy-Item "$PackageDir\skills\*" "$TargetDir\vcp-skills" -Recurse -Force
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
  Copy-Runtime "$VibeDir\vcp-runtime"
  # El runtime es una copia de esta herramienta, no codigo del proyecto. Sin esta regla queda como
  # archivo sin seguimiento, y entonces: se commitea sin querer junto al trabajo del usuario, y el
  # gate de seguridad lo trata como superficie viva -- un hallazgo dentro del runtime bloquearia el
  # proyecto con un CRITICAL que el usuario no escribio y no puede arreglar editando su codigo.
  $ignoreFile = Join-Path $ProjectDir '.gitignore'
  $ignoreRule = '.vibe/vcp-runtime/'
  $yaEsta = (Test-Path $ignoreFile) -and ((Get-Content $ignoreFile) -contains $ignoreRule)
  if (-not $yaEsta) {
    Add-Content -Path $ignoreFile -Value '# VibeCodeProtocols: copia del runtime, no es codigo del proyecto'
    Add-Content -Path $ignoreFile -Value $ignoreRule
    Write-Host "OK: $ignoreRule agregado a .gitignore" -ForegroundColor Green
  }
  # Codex descubre skills de repositorio SOLO en .agents/skills/<nombre>/SKILL.md y en
  # .codex/skills/, y sus instrucciones solo en AGENTS.md -- verificado ejecutando. Sin estos dos
  # punteros, VCP existe en el proyecto pero Codex no ve nada de el. Son punteros, no copias.
  $CodexSkillDir = Join-Path $ProjectDir '.agents\skills\vibecodeprotocols'
  New-Item -ItemType Directory -Force -Path $CodexSkillDir | Out-Null
  Copy-Item "$PackageDir\.agents\skills\vibecodeprotocols\SKILL.md" $CodexSkillDir -Force
  $ProjectAgents = Join-Path $ProjectDir 'AGENTS.md'
  if (-not (Test-Path -LiteralPath $ProjectAgents)) {
    Copy-Item "$PackageDir\AGENTS.md" $ProjectAgents -Force
    Write-Output "OK: AGENTS.md creado -> Codex ya ve el protocolo"
  } else {
    Write-Output "NOTE: $ProjectAgents ya existe y no se toca. Agregale a mano un puntero a .vibe/vcp-runtime/SKILL.md."
  }
  Write-Host "OK: project runtime -> $VibeDir\vcp-runtime" -ForegroundColor Green
} else {
  Write-Host 'NOTE: no project initialized. Re-run with -ProjectDir <project-root>.' -ForegroundColor Yellow
}

Write-Host 'Next: restart Claude Code, open the project, then invoke /VibeCodeProtocols.'
