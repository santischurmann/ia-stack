# verify-red.ps1 — VibeCodeProtocols RED Gate verifier (Windows PowerShell)
# Usage: .\verify-red.ps1 -TestPattern "<pattern>" -TestCmd "<command>"
# Example: .\verify-red.ps1 -TestPattern "src/__tests__/auth.test.ts" -TestCmd "npx vitest run"
#
# Mirrors scripts/verify-red.sh exactly: same rejection rules, same exit-code contract
# (0 = RED pass, 1 = RED fail/blocked). A RED gate PASS requires the command to have actually
# run the test suite AND the output to show a real test failure (assertion failure, a local
# missing-module error, or a runtime error proven to come from the SUT of an assertion test) — a nonzero exit
# code alone is NOT sufficient.

param(
  [Parameter(Mandatory = $true)][string]$TestPattern,
  [Parameter(Mandatory = $true)][string]$TestCmd
)

Write-Host "=== RED GATE VERIFICATION ===" -ForegroundColor Cyan
Write-Host "Pattern: $TestPattern"
Write-Host "Command: $TestCmd $TestPattern"
Write-Host ""

$cmdParts = $TestCmd -split '\s+'
$exe = $cmdParts[0]
$exeArgs = @()
if ($cmdParts.Length -gt 1) { $exeArgs = $cmdParts[1..($cmdParts.Length - 1)] }
$exeArgs = $exeArgs + $TestPattern

$output = ""
$exitCode = 1
try {
  $output = & $exe @exeArgs 2>&1 | Out-String
  $exitCode = $LASTEXITCODE
  if ($null -eq $exitCode) { $exitCode = 0 }
} catch {
  # Command not found / failed to launch — PowerShell throws a terminating error for this,
  # unlike bash's "command not found" text on stderr. Capture it the same way.
  $output = "command not found / failed to launch: $($_.Exception.Message)"
  $exitCode = 127
}

($output -split "`n" | Select-Object -First 80) -join "`n" | Write-Host
Write-Host ""

function Reject($reason) {
  Write-Host "RED GATE: FAIL" -ForegroundColor Red
  Write-Host ""
  Write-Host "Reason: $reason"
  Write-Host ""
  Write-Host "Action: Fix the test command/file. Do NOT proceed to GREEN -- this is not a valid RED state."
  exit 1
}

# 1. Tests passed outright.
if ($exitCode -eq 0) {
  Reject "tests PASSED (exit 0) -- this should not happen before implementation. Possible causes: implementation already exists, test imports a mock returning the correct value, wrong test file path, or tests are empty/skipped (.todo()/.skip())."
}

# 2. Runner/command broken or missing -- never a valid RED reason.
if ($output -match "(?i)command not found|is not recognized as an internal or external command|no such file or directory.*(node|python|pytest|npx|npm|go|cargo|mvn)|ENOENT.*spawn|failed to launch") {
  Reject "the test command/runner itself could not run (command not found / missing binary) -- not a test failure."
}

# 3. No tests collected/found -- an empty suite is not a failing test.
if ($output -match "(?i)no tests found|no test files|0 tests? (found|collected|ran)|collected 0 items?|0 passing, 0 failing") {
  Reject "no tests were found/collected -- an empty suite cannot satisfy the RED gate."
}

# 4. Syntax/parse/collection error in the test file itself -- the suite never actually ran.
if ($output -match "(?i)SyntaxError|ParseError|Unexpected token|collection error|ERROR collecting|IndentationError") {
  Reject "the test file failed to parse/load (syntax/collection error) -- fix the test file, this is not evidence of a real test failure."
}

# 5. Require SPECIFIC evidence, not a generic "Error:"/"error"/"failed" match -- those match a
#    broken runner or a config error just as easily as a real test failure (that was the bug: a
#    stub printing "Error: config missing" and exiting nonzero used to pass). A valid RED needs
#    EITHER (a) a framework-executed signal (a test-count/pass-fail summary a real runner
#    prints) co-occurring with a REAL assertion-library marker, (b) a framework-executed signal
#    co-occurring with a missing-module error whose SPECIFIER is verifiably local, OR (c) an
#    assertion-bearing test file with a non-test local SUT stack frame. Case (c) handles a valid
#    first RED where the SUT intentionally throws before the assertion can execute.
#
#    "Missing module" is fail-closed, not pattern-matched on keywords alone. Node's own message
#    text is NOT a reliable discriminator by itself: "Cannot find package 'x'" (ESM, bare
#    specifier) is disqualified, but CommonJS require() of a missing BARE package prints
#    "Cannot find module 'x'" too -- same wording as a genuinely missing local SUT file -- this
#    was a real false positive found on review (verified live: `require('some-missing-npm-pkg')`
#    under `node --test` prints "Cannot find module 'some-missing-npm-pkg'", no "package", no
#    "node_modules", framework signal present -- the old keyword-only check accepted it).
#
#    Fix: extract the exact quoted specifier from "Cannot find module '<spec>'" /
#    "Cannot find package '<spec>'" and require it to look like a real path -- starts with
#    `./`, `../`, a Unix root `/`, or a Windows absolute path (`C:\`, `C:/`, or a UNC `\\`).
#    A bare specifier (no leading path token -- this is exactly what marks an npm package name,
#    ESM or CJS, scoped or not: `lodash`, `@scope/pkg`, `some-missing-npm-pkg`) is REJECTED.
#    "Cannot find package" is always rejected outright, mirroring the same locality logic (a
#    package name is by definition never a local path). No specifier extracted at all (message
#    text present but no quoted string matched) is also REJECTED -- fail-closed, not fail-open.
#
#    ModuleNotFoundError (Python)/ImportError are NOT accepted as module evidence at all -- we
#    have no mechanical way to attribute them to the SUT the way we can for Node's quoted
#    specifier, and no tested fixture proves it; rejecting by default rather than asserting
#    unverified cross-language support (minimal, safe change per review instruction).
#
#    NameError/ReferenceError/"is not defined"/"is not a function" are explicitly NOT accepted
#    as missing-module evidence and do NOT count as an assertion marker, even when a framework
#    signal is also present -- a test runner prints the exact same pass/fail decoration for an
#    uncaught NameError/TypeError bug IN THE TEST FILE as it does for a genuine assertion
#    failure, so that decoration alone can't tell them apart. Reject unless a real
#    assertion-library marker (AssertionError/assert./assert_/expect()) is ALSO present.
$hasFrameworkSignal = $output -match "(?i)\btests?\s+[0-9]+\b|\b(pass|fail)\s+[0-9]+\b|[0-9]+\s+(passed|failed|failing)\b|Ran [0-9]+ test|collected [0-9]+ item"
$hasAssertionSignal = $output -match "(?i)AssertionError|assert\.|assert_|expect\("
$hasTestBugSignal = $output -match "(?i)NameError|ReferenceError|is not defined|is not a function"

# A generic runtime error is valid only if the test file contains an assertion and the stack
# includes a local project frame other than the test file, node: internals, or node_modules.
# Missing/glob patterns fail closed because their source cannot be inspected mechanically.
$testBaseName = [System.IO.Path]::GetFileName($TestPattern)
$hasTestAssertionSource = $false
if (Test-Path -LiteralPath $TestPattern) {
  $hasTestAssertionSource = (Get-Content -LiteralPath $TestPattern -Raw) -match "(?i)AssertionError|assert\.|assert_|expect\("
}
$hasSutRuntimeFrame = $false
foreach ($frame in [regex]::Matches($output, '(?m)^\s+at .*').Value) {
  if ($frame -like '*node:*' -or $frame -like '*node_modules*' -or $frame -like "*${testBaseName}:*") { continue }
  if ($frame -match '\((file:|[A-Za-z]:[\\/]|\.?[\\/]).*:\d+:\d+\)') {
    $hasSutRuntimeFrame = $true
    break
  }
}
$validSutRuntimeEvidence = $hasFrameworkSignal -and $hasTestAssertionSource -and $hasSutRuntimeFrame

$moduleMatch = [regex]::Match($output, "Cannot find (module|package) '([^']*)'")
$hasModuleSignal = $moduleMatch.Success
$isLocalModuleSpec = $false
if ($hasModuleSignal -and $moduleMatch.Groups[1].Value -eq 'module') {
  $spec = $moduleMatch.Groups[2].Value
  # Local path: ./ or ../ (POSIX or Windows separator), a Unix-root leading /, or a Windows
  # absolute path (drive letter + colon, or a UNC \\server share). Anything else -- a bare
  # specifier with no leading path token -- is an npm package name, ESM or CJS, and rejected.
  if ($spec -match '^(\.\.?[\\/]|[\\/]|[A-Za-z]:[\\/]|\\\\)') {
    $isLocalModuleSpec = $true
  }
}
$hasNodeModulesRef = $output -match "(?i)node_modules"

$validModuleEvidence = $isLocalModuleSpec -and $hasFrameworkSignal -and -not $hasNodeModulesRef

if ($hasTestBugSignal -and -not $hasModuleSignal -and -not $hasAssertionSignal) {
  Reject "output shows NameError/ReferenceError/'is not defined'/'is not a function' -- this is a potential bug in the test file itself (undefined reference, wrong call), not evidence the SUT is validly absent. Fix the test, do not treat this as a valid RED."
}

if (-not $validModuleEvidence -and -not $validSutRuntimeEvidence -and -not ($hasFrameworkSignal -and $hasAssertionSignal)) {
  Reject "command exited nonzero (exit $exitCode) but the output shows no specific test-failure evidence -- needs a framework-executed signal with an assertion marker, a verifiably local missing-module error, or an assertion-bearing test plus a non-test local SUT stack frame. A generic 'Error:'/config/runner/third-party-dependency error is not sufficient."
}

$failMatches = [regex]::Matches($output, "(FAIL|FAILED|ERROR|failed|error)").Count
Write-Host "RED GATE: PASS" -ForegroundColor Green
Write-Host "Tests failing as expected (approx $failMatches failure indicators)."
Write-Host "Proceed to GREEN subagent."
exit 0
