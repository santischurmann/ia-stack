// La rama bash del instalador. La de PowerShell vive en `install-runtime-powershell.test.mjs`.
//
// Las dos comparten `_install-fixture.mjs`, y en particular `assertRuntime`, que es lo que hace que
// las dos ramas tengan que producir el MISMO runtime. Están en archivos separados porque juntas
// rozaban el tope de TAP —96 a 111 s contra 120, corriendo solas—, y porque si una se rompe la otra
// tiene que seguir contando.

import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import test from 'node:test';

import { assertRuntime, fixture, gitBash, installSh, run, toBash } from './_install-fixture.mjs';

test('fresh Bash installation produces a project-local runtime whose gate command resolves', { skip: !existsSync(gitBash) }, () => {
  const { root, project, target, runtime } = fixture();
  try {
    const command = `'${toBash(installSh)}' --target-dir '${toBash(target)}' --runtime-dir '${toBash(runtime)}' --project '${toBash(project)}'`;
    const result = run(gitBash, ['-lc', command], { env: { HOME: toBash(root) } });
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /project runtime/);
    const repeat = run(gitBash, ['-lc', command], { env: { HOME: toBash(root) } });
    assert.equal(repeat.status, 0, repeat.output);
    assertRuntime(project, target, runtime);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
