#!/usr/bin/env bash
# verify-red.sh — VibeCodeProtocols RED Gate verifier
# Usage: ./verify-red.sh "<test_pattern>" "<test_command>"
# Example: ./verify-red.sh "src/__tests__/auth.test.ts" "npx vitest run"
#
# A RED gate PASS requires the command to have actually run the test suite AND the output to
# show a real test failure (an assertion failure, an unimplemented local-module error, or a
# runtime failure proven to originate in the SUT of an assertion-bearing test). A nonzero exit
# code alone is NOT sufficient — this rejects
# broken/missing runners, syntax/parse/collection errors, "no tests found", and arbitrary exit
# codes with no test evidence, none of which mean "the test failed as expected".

set -uo pipefail   # no -e: we need the runner's exit code, not a script abort on nonzero

if [ $# -lt 2 ]; then
  echo "Usage: verify-red.sh '<test_pattern>' '<test_command>'"
  echo "Example: verify-red.sh 'src/__tests__/auth.test.ts' 'npx vitest run'"
  exit 2
fi

TEST_PATTERN="$1"
TEST_CMD="$2"

echo "=== RED GATE VERIFICATION ==="
echo "Pattern: $TEST_PATTERN"
echo "Command: $TEST_CMD $TEST_PATTERN"
echo ""

output=$($TEST_CMD "$TEST_PATTERN" 2>&1)
exit_code=$?

echo "$output" | head -80
echo ""

reject() {
  echo "🚫 RED GATE: FAIL"
  echo ""
  echo "Reason: $1"
  echo ""
  echo "Action: Fix the test command/file. Do NOT proceed to GREEN — this is not a valid RED state."
  exit 1
}

# 1. Tests passed outright.
if [ "$exit_code" -eq 0 ]; then
  reject "tests PASSED (exit 0) — this should not happen before implementation. Possible causes: implementation already exists, test imports a mock returning the correct value, wrong test file path, or tests are empty/skipped (.todo()/.skip())."
fi

# 2. Runner/command broken or missing — never a valid RED reason.
if echo "$output" | grep -qiE "command not found|is not recognized as an internal or external command|no such file or directory.*(node|python|pytest|npx|npm|go|cargo|mvn)|ENOENT.*spawn"; then
  reject "the test command/runner itself could not run (command not found / missing binary) — not a test failure."
fi

# 3. No tests collected/found — an empty suite is not a failing test.
if echo "$output" | grep -qiE "no tests found|no test files|0 tests? (found|collected|ran)|collected 0 items?|0 passing, 0 failing"; then
  reject "no tests were found/collected — an empty suite cannot satisfy the RED gate."
fi

# 4. Syntax/parse/collection error in the test file itself — the suite never actually ran.
#    (Distinct from a missing-implementation-module error, which IS a valid RED reason and is
#    handled by the evidence check below — a SyntaxError here means the test file itself is
#    malformed, not that the implementation is absent.)
if echo "$output" | grep -qiE "SyntaxError|ParseError|Unexpected token|collection error|ERROR collecting|IndentationError"; then
  reject "the test file failed to parse/load (syntax/collection error) — fix the test file, this is not evidence of a real test failure."
fi

# 5. Require SPECIFIC evidence, not a generic "Error:"/"error"/"failed" grep — those match a
#    broken runner or a config error just as easily as a real test failure (that was the bug: a
#    stub printing "Error: config missing" and exiting nonzero used to pass). A valid RED needs
#    EITHER (a) a framework-executed signal (a test-count/pass-fail summary a real runner
#    prints) co-occurring with a REAL assertion-library marker, (b) a framework-executed signal
#    co-occurring with a missing-module error whose SPECIFIER is verifiably local, OR (c) a
#    framework-executed signal plus an assertion-bearing test file and a non-test local SUT
#    stack frame. Case (c) is needed for a valid first RED such as an assertion test calling an
#    intentionally unimplemented SUT that throws `Error: not implemented`: the assertion is not
#    reached, so Node does not print `AssertionError`, but the test genuinely ran and the stack
#    proves the failure came from the SUT rather than a runner/config stub.
#
#    "Missing module" is fail-closed, not pattern-matched on keywords alone. Node's own message
#    text is NOT a reliable discriminator by itself: "Cannot find package 'x'" (ESM, bare
#    specifier) is disqualified, but CommonJS require() of a missing BARE package prints
#    "Cannot find module 'x'" too — same wording as a genuinely missing local SUT file — this
#    was a real false positive found on review (verified live: `require('some-missing-npm-pkg')`
#    under `node --test` prints "Cannot find module 'some-missing-npm-pkg'", no "package", no
#    "node_modules", framework signal present — the old keyword-only check accepted it).
#
#    Fix: extract the exact quoted specifier from "Cannot find module '<spec>'" /
#    "Cannot find package '<spec>'" and require it to look like a real path — starts with
#    `./`, `../`, a Unix root `/`, or a Windows absolute path (`C:\`, `C:/`, or a UNC `\\`).
#    A bare specifier (no leading path token — this is exactly what marks an npm package name,
#    ESM or CJS, scoped or not: `lodash`, `@scope/pkg`, `some-missing-npm-pkg`) is REJECTED.
#    "Cannot find package" is always rejected outright, mirroring the same locality logic (a
#    package name is by definition never a local path). No specifier extracted at all (message
#    text present but no quoted string matched) is also REJECTED — fail-closed, not fail-open.
#
#    ModuleNotFoundError (Python)/ImportError are NOT accepted as module evidence at all — we
#    have no mechanical way to attribute them to the SUT the way we can for Node's quoted
#    specifier, and no tested fixture proves it; rejecting by default rather than asserting
#    unverified cross-language support (minimal, safe change per review instruction).
#
#    NameError/ReferenceError/"is not defined"/"is not a function" are explicitly NOT accepted
#    as missing-module evidence and do NOT count as an assertion marker, even when a framework
#    signal (✖, tests N, fail N) is also present — a test runner prints the exact same ✖/pass-
#    fail decoration for an uncaught NameError/TypeError bug IN THE TEST FILE as it does for a
#    genuine assertion failure, so that decoration alone can't tell them apart. Reject unless a
#    real assertion-library marker (AssertionError/assert./assert_/expect()) is ALSO present.
FRAMEWORK_SIGNAL='\btests?[[:space:]]+[0-9]+\b|\b(pass|fail)[[:space:]]+[0-9]+\b|[0-9]+[[:space:]]+(passed|failed|failing)\b|Ran [0-9]+ test|collected [0-9]+ item'
ASSERTION_SIGNAL='AssertionError|assert\.|assert_|expect\('
TEST_BUG_SIGNAL='NameError|ReferenceError|is not defined|is not a function'

has_framework_signal=0; echo "$output" | grep -qiE "$FRAMEWORK_SIGNAL" && has_framework_signal=1
has_assertion_signal=0; echo "$output" | grep -qiE "$ASSERTION_SIGNAL" && has_assertion_signal=1
has_test_bug_signal=0; echo "$output" | grep -qiE "$TEST_BUG_SIGNAL" && has_test_bug_signal=1

# A generic runtime error is valid only when the test file itself contains an assertion and the
# stack names a project frame that is not the test file, not node: internals, and not node_modules.
# This remains fail-closed for globs/nonexistent test files and for errors without a local frame.
test_basename=$(basename "${TEST_PATTERN//\\//}")
has_test_assertion_source=0
if [ -f "$TEST_PATTERN" ] && grep -qE "$ASSERTION_SIGNAL" "$TEST_PATTERN"; then
  has_test_assertion_source=1
fi
has_sut_runtime_frame=0
while IFS= read -r frame; do
  case "$frame" in
    *"node:"*|*"node_modules"*|*"$test_basename:"*) continue ;;
  esac
  if echo "$frame" | grep -qE '\((file:|[A-Za-z]:[\\/]|\.?[\\/]).*:[0-9]+:[0-9]+\)'; then
    has_sut_runtime_frame=1
    break
  fi
done < <(echo "$output" | grep -E '^[[:space:]]+at .*' || true)
valid_sut_runtime_evidence=0
if [ "$has_framework_signal" -eq 1 ] && [ "$has_test_assertion_source" -eq 1 ] && [ "$has_sut_runtime_frame" -eq 1 ]; then
  valid_sut_runtime_evidence=1
fi

# Extract "Cannot find module '<spec>'" or "Cannot find package '<spec>'" (first match only —
# one missing-module cause is enough to classify the RED, and this is Node-specific by design).
module_line=$(echo "$output" | grep -oE "Cannot find (module|package) '[^']*'" | head -1)
has_module_signal=0
is_local_module_spec=0
if [ -n "$module_line" ]; then
  has_module_signal=1
  if ! echo "$module_line" | grep -q "^Cannot find package"; then
    spec=$(echo "$module_line" | sed -E "s/^Cannot find module '(.*)'\$/\1/")
    # Local path: ./ or ../ (POSIX or Windows separator), a Unix-root leading /, or a Windows
    # absolute path (drive letter + colon, or a UNC \\server share). Anything else — a bare
    # specifier with no leading path token — is an npm package name, ESM or CJS, and rejected.
    if echo "$spec" | grep -qE '^(\.\.?[\\/]|[\\/]|[A-Za-z]:[\\/]|\\\\)'; then
      is_local_module_spec=1
    fi
  fi
fi
has_node_modules_ref=0; echo "$output" | grep -qi "node_modules" && has_node_modules_ref=1

valid_module_evidence=0
if [ "$is_local_module_spec" -eq 1 ] && [ "$has_framework_signal" -eq 1 ] && [ "$has_node_modules_ref" -eq 0 ]; then
  valid_module_evidence=1
fi

if [ "$has_test_bug_signal" -eq 1 ] && [ "$has_module_signal" -eq 0 ] && [ "$has_assertion_signal" -eq 0 ]; then
  reject "output shows NameError/ReferenceError/'is not defined'/'is not a function' — this is a potential bug in the test file itself (undefined reference, wrong call), not evidence the SUT is validly absent. Fix the test, do not treat this as a valid RED."
fi

if [ "$valid_module_evidence" -eq 0 ] && [ "$valid_sut_runtime_evidence" -eq 0 ] && ! { [ "$has_framework_signal" -eq 1 ] && [ "$has_assertion_signal" -eq 1 ]; }; then
  reject "command exited nonzero (exit $exit_code) but the output shows no specific test-failure evidence — needs a framework-executed signal with an assertion marker, a verifiably local missing-module error, or an assertion-bearing test plus a non-test local SUT stack frame. A generic 'Error:'/config/runner/third-party-dependency error is not sufficient."
fi

fail_count=$(echo "$output" | grep -cE "(FAIL|FAILED|ERROR|failed|error)" 2>/dev/null); fail_count="${fail_count:-0}"
echo "✅ RED GATE: PASS"
echo "Tests failing as expected (approx $fail_count failure indicators)."
echo "Proceed to GREEN subagent."
exit 0
