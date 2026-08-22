import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const USAGE = 'usage: node scripts/verify-vcp-coverage.mjs';
const COVERAGE_ROW = /^\s*(?:ℹ\s+)?(.+?\.mjs)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|/u;

export function parseScriptCoverage(output) {
  return output.split(/\r?\n/u)
    .map((line) => line.match(COVERAGE_ROW))
    .filter(Boolean)
    .map((match) => ({
      file: match[1].trim(),
      lines: Number(match[2]),
      branches: Number(match[3]),
      functions: Number(match[4]),
    }));
}

export function evaluateCoverageRun(result) {
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.error) {
    return { ok: false, output, message: `Coverage command could not launch: ${result.error.message}` };
  }
  if (result.status !== 0) {
    return { ok: false, output, message: `Coverage command exited ${result.status}` };
  }

  const rows = parseScriptCoverage(output);
  if (rows.length === 0) {
    return { ok: false, output, message: 'No script coverage rows were found in Node output.' };
  }

  const belowFullCoverage = rows.filter((row) => row.lines !== 100 || row.branches !== 100 || row.functions !== 100);
  if (belowFullCoverage.length > 0) {
    const details = belowFullCoverage
      .map((row) => `${row.file}: lines ${row.lines.toFixed(2)}%, branches ${row.branches.toFixed(2)}%, functions ${row.functions.toFixed(2)}%`)
      .join('; ');
    return { ok: false, output, rows, message: `Coverage below 100%: ${details}` };
  }

  return { ok: true, output, rows, message: `All ${rows.length} VCP script(s) are at 100% lines, branches, and functions.` };
}

export function runCoverage(run = spawnSync, cwd = repoRoot) {
  return run(process.execPath, ['--experimental-test-coverage', '--test'], { cwd, encoding: 'utf8' });
}

export function main(args = process.argv.slice(2), run = runCoverage, write = console.log, writeError = console.error) {
  if (args.length !== 0) {
    writeError(USAGE);
    return 2;
  }

  const result = evaluateCoverageRun(run());
  if (!result.ok) {
    if (result.output) writeError(result.output.trim());
    writeError(result.message);
    return 1;
  }

  write(`OK: ${result.message}`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-vcp-coverage.mjs')) {
  process.exitCode = main();
}
