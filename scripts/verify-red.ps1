# PowerShell entrypoint for the RED gate. Dispatches to the adapter declared for the runner.
param(
  [Parameter(Mandatory = $true)][string]$TestPattern,
  [Parameter(Mandatory = $true)][string]$TestCmd
)

$ErrorActionPreference = 'Stop'
$dispatcher = Join-Path $PSScriptRoot 'verify-red.mjs'
try {
  & node $dispatcher check --test $TestPattern --command $TestCmd
  exit $LASTEXITCODE
} catch {
  Write-Error "REJECTED: the RED dispatcher could not launch: $($_.Exception.Message)"
  exit 1
}
