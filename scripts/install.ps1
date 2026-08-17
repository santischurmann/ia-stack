# VibeCodeProtocols — Install script (Windows PowerShell)
# Usage: .\install.ps1 [-TargetDir <path>]
# Default target: $HOME\.claude\skills\

param(
  [string]$TargetDir = "$HOME\.claude\skills"
)

$ErrorActionPreference = "Stop"
$SkillName = "VibeCodeProtocols"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PackageDir = Split-Path -Parent $ScriptDir

Write-Host "=== VibeCodeProtocols Installer ===" -ForegroundColor Cyan
Write-Host "Source:  $PackageDir"
Write-Host "Target:  $TargetDir"
Write-Host ""

# Create target directory
New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

# Copy master skill
Copy-Item "$PackageDir\SKILL.md" "$TargetDir\$SkillName.md" -Force
Write-Host "OK $SkillName.md -> $TargetDir\" -ForegroundColor Green

# Copy sub-skills
$VcpSkillsDir = "$TargetDir\vcp-skills"
New-Item -ItemType Directory -Force -Path $VcpSkillsDir | Out-Null
Copy-Item "$PackageDir\skills\*" $VcpSkillsDir -Recurse -Force
Write-Host "OK skills\ -> $VcpSkillsDir\" -ForegroundColor Green

# Copy scripts
$ScriptsTarget = "$HOME\.claude\vcp-scripts"
New-Item -ItemType Directory -Force -Path $ScriptsTarget | Out-Null
Copy-Item "$PackageDir\scripts\*.sh" $ScriptsTarget -Force -ErrorAction SilentlyContinue
Copy-Item "$PackageDir\scripts\*.ps1" $ScriptsTarget -Force
Copy-Item "$PackageDir\scripts\*.mjs" $ScriptsTarget -Force -ErrorAction SilentlyContinue
Write-Host "OK scripts\ -> $ScriptsTarget\ (incl. verify-receipt.mjs, verify-red.ps1)" -ForegroundColor Green

# Initialize .vibe/ in current project
$manifestFiles = @("package.json", "pyproject.toml", "go.mod", "Cargo.toml")
$hasManifest = $manifestFiles | Where-Object { Test-Path $_ }

if ($hasManifest -and -not (Test-Path ".vibe")) {
  New-Item -ItemType Directory -Force -Path ".vibe\sessions" | Out-Null
  New-Item -ItemType Directory -Force -Path ".vibe\receipts" | Out-Null
  Copy-Item "$PackageDir\templates\vibe\*" ".vibe\" -Force
  if (-not (Test-Path ".vibe\AUDIT.md")) { New-Item -ItemType File -Path ".vibe\AUDIT.md" | Out-Null }
  $projectName = Split-Path -Leaf (Get-Location)
  $today = Get-Date -Format "yyyy-MM-dd"
  (Get-Content ".vibe\PROJECT.md") -replace '\(fill in\)', $projectName |
    Set-Content ".vibe\PROJECT.md"
  (Get-Content ".vibe\PROJECT.md") -replace 'YYYY-MM-DD', $today |
    Set-Content ".vibe\PROJECT.md"
  Write-Host "OK .vibe\ initialized in current project" -ForegroundColor Green
} elseif (Test-Path ".vibe") {
  Write-Host "   .vibe\ already exists -- skipping (not overwriting)" -ForegroundColor Yellow
} else {
  Write-Host "   No project manifest found -- run from your project root to init .vibe\" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Installation complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Restart Claude Code (or reload settings)"
Write-Host "  2. Open a project and invoke: /VibeCodeProtocols"
Write-Host "  3. Describe what you want to build"
