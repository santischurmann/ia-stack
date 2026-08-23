import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const conflictGate = join(repoRoot, 'scripts', 'verify-plan-conflicts.mjs');

function run(args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [conflictGate, ...args], { encoding: 'utf8', env });
  assert.equal(result.error, undefined, `plan-conflict verifier could not launch: ${result.error?.message}`);
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function withPlan(tasks, callback) {
  withRawPlan({ feature: 'test-feature', tasks }, callback);
}

function withRawPlan(contents, callback) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-plan-conflicts-'));
  const plan = join(root, 'tasks.json');
  writeFileSync(plan, JSON.stringify(contents, null, 2));
  try {
    callback(plan);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function task(id, { create = [], modify = [], tests = [], dependsOn = [] } = {}) {
  return {
    id,
    files_to_create: create,
    files_to_modify: modify,
    test_files: tests,
    depends_on: dependsOn,
  };
}

test('accepts independent tasks with disjoint write sets', () => {
  withPlan([
    task('T01', { create: ['src/auth.js'], tests: ['tests/auth.test.js'] }),
    task('T02', { create: ['src/billing.js'], tests: ['tests/billing.test.js'] }),
  ], (plan) => {
    const result = run(['check', plan]);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /OK:.*no unsequenced write conflicts/i);
  });
});

test('FALSIFICACIÓN · rejects production-file overlap without dependency ordering', () => {
  withPlan([
    task('T01', { modify: ['src/shared.js'] }),
    task('T02', { modify: ['src/shared.js'] }),
  ], (plan) => {
    const result = run(['check', plan]);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /CONFLICT: T01.*T02.*src\/shared\.js/i);
  });
});

test('FALSIFICACIÓN · canonicalizes dot segments so equivalent writer paths cannot bypass the conflict check', () => {
  withPlan([
    task('T01', { modify: ['src/../shared.js'] }),
    task('T02', { modify: ['shared.js'] }),
  ], (plan) => {
    const result = run(['check', plan]);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /CONFLICT: T01.*T02.*shared\.js/i);
  });
});

test('FALSIFICACIÓN · rejects test-file overlap without dependency ordering', () => {
  withPlan([
    task('T01', { tests: ['tests/shared.test.js'] }),
    task('T02', { tests: ['tests/shared.test.js'] }),
  ], (plan) => {
    const result = run(['check', plan]);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /CONFLICT: T01.*T02.*tests\/shared\.test\.js/i);
  });
});

test('allows a direct dependency to serialize an overlapping write', () => {
  withPlan([
    task('T01', { create: ['src/shared.js'] }),
    task('T02', { modify: ['src/shared.js'], dependsOn: ['T01'] }),
  ], (plan) => {
    const result = run(['check', plan]);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /SERIALIZED: T01.*T02.*src\/shared\.js/i);
  });
});

test('allows dependency ordering in either topological direction', () => {
  withPlan([
    task('T01', { modify: ['src/shared.js'], dependsOn: ['T02'] }),
    task('T02', { create: ['src/shared.js'] }),
  ], (plan) => {
    const result = run(['check', plan]);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /SERIALIZED: T01.*T02.*src\/shared\.js/i);
  });
});

test('allows a transitive dependency to serialize an overlapping write', () => {
  withPlan([
    task('T01', { create: ['src/shared.js'] }),
    task('T02', { create: ['src/middle.js'], dependsOn: ['T01'] }),
    task('T03', { modify: ['src/shared.js'], dependsOn: ['T02'] }),
  ], (plan) => {
    const result = run(['check', plan]);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /SERIALIZED: T01.*T03.*src\/shared\.js/i);
  });
});

test('normalizes slash direction and does not flag a task against itself', () => {
  withPlan([
    task('T01', { create: ['src\\feature.js'], tests: ['tests/feature.test.js'] }),
    task('T02', { modify: ['src/feature.js'], dependsOn: ['T01'] }),
    task('T03', { create: ['e2e/feature.test.js'], tests: ['e2e/feature.test.js'] }),
  ], (plan) => {
    assert.equal(run(['check', plan]).status, 0);
  });
});

test('FALSIFICACIÓN · rejects duplicate ids, unknown dependencies and dependency cycles', () => {
  const invalidPlans = [
    [task('T01'), task('T01')],
    [task('T01', { dependsOn: ['T99'] })],
    [task('T01', { dependsOn: ['T02'] }), task('T02', { dependsOn: ['T01'] })],
  ];

  for (const tasks of invalidPlans) {
    withPlan(tasks, (plan) => {
      const result = run(['check', plan]);
      assert.equal(result.status, 1, result.output);
      assert.match(result.output, /REJECTED:/i);
    });
  }
});

test('FALSIFICACIÓN · fails closed for invalid task, path and dependency declarations', () => {
  const invalidPlans = [
    null,
    'not an object',
    [],
    { feature: 'test-feature' },
    { tasks: [null] },
    { tasks: ['not an object'] },
    { tasks: [{}] },
    { tasks: [task('')] },
    { tasks: [task('T01', { create: [42] })] },
    { tasks: [task('T01', { create: [''] })] },
    { tasks: [task('T01', { create: ['./'] })] },
    { tasks: [task('T01', { create: ['../outside-project.js'] })] },
    { tasks: [task('T01', { create: ['/outside-project.js'] })] },
    { tasks: [task('T01', { create: ['C:/outside-project.js'] })] },
    { tasks: [task('T01', { create: ['..'] })] },
    { tasks: [{ ...task('T01'), files_to_modify: 'src/not-an-array.js' }] },
    { tasks: [{ ...task('T01'), test_files: 'tests/not-an-array.test.js' }] },
    { tasks: [{ ...task('T01'), depends_on: 'T02' }] },
    { tasks: [task('T01', { dependsOn: [null] })] },
    { tasks: [task('T01', { dependsOn: [''] })] },
    { tasks: [task('T01', { dependsOn: ['T01'] })] },
    { tasks: [task('T01', { dependsOn: ['T02', 'T02'] }), task('T02')] },
  ];

  for (const plan of invalidPlans) {
    withRawPlan(plan, (planPath) => {
      const result = run(['check', planPath]);
      assert.equal(result.status, 1, result.output);
      assert.match(result.output, /REJECTED:/i);
    });
  }
});

test('rejects malformed write declarations and CLI misuse', () => {
  withPlan([{ id: 'T01', files_to_create: 'src/not-an-array.js', files_to_modify: [], test_files: [], depends_on: [] }], (plan) => {
    assert.equal(run(['check', plan]).status, 1);
  });

  for (const args of [[], ['other'], ['check'], ['check', join(tmpdir(), 'vcp-plan-conflicts-does-not-exist.json')], ['check', 'tasks.json', 'unexpected']]) {
    const result = run(args);
    assert.equal(result.status, 2, `${args.join(' ')}\n${result.output}`);
    assert.match(result.output, /usage:/i);
  }
});
