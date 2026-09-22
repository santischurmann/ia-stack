// La rama PowerShell del instalador. La de bash vive en `install-runtime.test.mjs`.
//
// Las dos comparten `_install-fixture.mjs`, y en particular `assertRuntime`, que es lo que hace que
// las dos ramas tengan que producir el MISMO runtime. Están en archivos separados porque juntas
// rozaban el tope de TAP —96 a 111 s contra 120, corriendo solas—, y porque si una se rompe la otra
// tiene que seguir contando.

import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import test from 'node:test';

import { soloEnWindows } from './_entorno.mjs';
import { assertApartado, assertRuntime, assertSellado, fixture, installPs, plantarSobrante, run } from './_install-fixture.mjs';

test('fresh PowerShell installation produces the same project-local runtime', soloEnWindows('el instalador de PowerShell no se comprueba: install.ps1 queda sin correr, y con él la rama de instalación que usa la mitad de los usuarios del protocolo'), () => {
  const { root, project, target, runtime } = fixture();
  try {
    const result = run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', installPs, '-TargetDir', target, '-RuntimeDir', runtime, '-ProjectDir', project]);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /project runtime/);
    plantarSobrante(project);
    const repeat = run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', installPs, '-TargetDir', target, '-RuntimeDir', runtime, '-ProjectDir', project]);
    assert.equal(repeat.status, 0, repeat.output);
    assertRuntime(project, target, runtime);
    assertApartado(project);
    assertSellado(project);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
