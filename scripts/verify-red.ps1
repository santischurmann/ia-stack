# PowerShell entrypoint for the one strict, cross-platform Node-native RED adapter.
param(
  [Parameter(Mandatory = $true)][string]$TestPattern,
  [Parameter(Mandatory = $true)][string]$TestCmd
)

$ErrorActionPreference = 'Stop'
$adapter = Join-Path $PSScriptRoot 'verify-red-node.mjs'
try {
  & node $adapter check --test $TestPattern --command $TestCmd
  exit $LASTEXITCODE
} catch {
  Write-Error "REJECTED: Node-native RED adapter could not launch: $($_.Exception.Message)"
  exit 1
}
