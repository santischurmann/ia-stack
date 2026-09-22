// La rama PowerShell del instalador. La de bash vive en `install-runtime.test.mjs`.
//
// Las dos comparten `_install-fixture.mjs`, y en particular `assertRuntime`, que es lo que hace que
// las dos ramas tengan que producir el MISMO runtime. Están en archivos separados porque juntas
// rozaban el tope de TAP —96 a 111 s contra 120, corriendo solas—, y porque si una se rompe la otra
// tiene que seguir contando.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { soloEnWindows } from './_entorno.mjs';
import { assertApartado, assertNadaApartado, assertRuntime, assertSellado, fixture, installPs, plantarSobrante, plantarSobrantesDeMas, run } from './_install-fixture.mjs';

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

// LA RUTA CORTA 8.3, que vacio el runtime en el CI el 2026-09-22.
//
// En el runner de GitHub el usuario del temporal es `RUNNER~1`: un nombre corto de 8.3. La
// poda calculaba la ruta relativa restando el largo de la raiz a `FullName`, y medido en esta
// maquina: `Resolve-Path` CONSERVA el nombre corto y `Get-ChildItem` devuelve `FullName` con el
// nombre LARGO. La resta cortaba en otro lugar, la ruta relativa salia basura, ningun archivo
// «existia en el paquete», y la poda movio el runtime ENTERO al archivo. No se perdio nada --
// mueve, no borra, y por eso --, pero el proyecto quedo sin gates. Aca no pasaba porque este
// temporal no tiene nombres cortos. Se reproduce pidiendole a Windows el nombre corto del proyecto.
test('la poda no vacia el runtime cuando el proyecto llega por una ruta corta 8.3', soloEnWindows('la ruta corta 8.3 es de Windows'), () => {
  const { root, project, target, runtime } = fixture();
  try {
    const largo = join(root, 'proyecto-con-un-nombre-bien-largo');
    mkdirSync(largo);
    writeFileSync(join(largo, 'package.json'), '{}\n');
    const corto = spawnSync('powershell.exe', ['-NoProfile', '-Command',
      `(New-Object -ComObject Scripting.FileSystemObject).GetFolder('${largo}').ShortPath`], { encoding: 'utf8' }).stdout.trim();
    assert.notEqual(corto, largo, `la premisa es que Windows le da un nombre corto: ${corto}`);
    const instalar = () => run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', installPs, '-TargetDir', target, '-RuntimeDir', runtime, '-ProjectDir', corto]);
    assert.equal(instalar().status, 0);
    plantarSobrante(largo);
    const segunda = instalar();
    assert.equal(segunda.status, 0, segunda.output);
    assert.equal(existsSync(join(largo, '.vibe', 'ia-stack-runtime', 'scripts', 'pretooluse-red.mjs')), true,
      `la poda movio archivos que el paquete SI tiene: vacio el runtime. Salida:\n${segunda.output}`);
    assertApartado(largo);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// La misma red de seguridad que en install.sh: ver el comentario de alla.
test('una poda desproporcionada no mueve nada, tampoco en PowerShell', soloEnWindows('el instalador de PowerShell es de Windows'), () => {
  const { root, project, target, runtime } = fixture();
  try {
    const cuantos = plantarSobrantesDeMas(project);
    const r = run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', installPs, '-TargetDir', target, '-RuntimeDir', runtime, '-ProjectDir', project]);
    assert.equal(r.status, 0, r.output);
    assertNadaApartado(project, cuantos, r.output);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
