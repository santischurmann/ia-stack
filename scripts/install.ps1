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
  New-Item -ItemType Directory -Force -Path "$Destination\scripts", "$Destination\templates", "$Destination\skills" | Out-Null
  Copy-Item "$PackageDir\scripts\*" "$Destination\scripts" -Recurse -Force
  Copy-Item "$PackageDir\templates\*" "$Destination\templates" -Recurse -Force
  Copy-Item "$PackageDir\skills\*" "$Destination\skills" -Recurse -Force
  Copy-Item "$PackageDir\SKILL.md" "$Destination\SKILL.md" -Force
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
  Write-Host "OK: project runtime -> $VibeDir\vcp-runtime" -ForegroundColor Green
} else {
  Write-Host 'NOTE: no project initialized. Re-run with -ProjectDir <project-root>.' -ForegroundColor Yellow
}

Write-Host 'Next: restart Claude Code, open the project, then invoke /VibeCodeProtocols.'
