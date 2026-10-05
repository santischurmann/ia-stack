// `--project-only` / `-ProjectOnly`: instalar en UN proyecto sin tocar nada fuera de el.
//
// Con `--project` el instalador igual escribia la skill y el runtime GLOBALES —por defecto en
// `~/.claude`— antes de ocuparse del proyecto, asi que "probarlo en una carpeta" no era aislamiento
// (seccion 25 del prompt maestro). Decidido por el operador el 2026-10-05 (P1, opcion A): un modo
// explicito, y el comportamiento por defecto NO cambia.
//
// TODA corrida de este archivo apunta HOME (y USERPROFILE) a un temporal: si el modo nuevo tuviera un
// defecto, lo que escribiera de mas caeria ahi, no en el perfil real de quien corre la suite.
// Cada instalacion completa cuesta decenas de segundos, asi que hay UNA por rama; el resto son
// rechazos que salen antes de copiar nada.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { soloEnWindows } from './_entorno.mjs';
import { fixture, gitBash, hayBash, installPs, installSh, run, toBash } from './_install-fixture.mjs';

const enBash = (root, args) => run(gitBash, ['-lc', `'${toBash(installSh)}' ${args}`], { env: { HOME: toBash(root) } });
const enPowerShell = (root, args) => run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', installPs, ...args], { env: { HOME: root, USERPROFILE: root } });

/** Lo unico que puede haber en el temporal despues de instalar en `project`. */
// `AppData` lo crea el propio PowerShell en un USERPROFILE nuevo (perfil, cache de modulos), no el
// instalador: se tolera solo ahi, y solo ese nombre. Cualquier otra cosa afuera del proyecto es un fallo.
const soloElProyecto = (root, tolerado = []) => assert.deepEqual(readdirSync(root).filter((nombre) => !tolerado.includes(nombre)), ['project'], 'nada fuera del proyecto: ni skill, ni runtime global, ni ~/.claude');

function assertInstaladoEnElProyecto(project, salida) {
  assert.ok(existsSync(join(project, '.vibe', 'ia-stack-runtime', 'SKILL.md')), 'el runtime tiene que quedar en el proyecto');
  assert.ok(existsSync(join(project, '.vibe', 'ia-stack-runtime', 'INSTALADO.json')), 'y sellado, como en una instalacion normal');
  assert.ok(existsSync(join(project, '.agents', 'skills', 'ia-stack', 'SKILL.md')), 'y Codex tiene que ver su puntero');
  assert.match(salida, /project-?only/iu, 'la salida dice que no se instalo lo global, en vez de dejar creer que /ia-stack ya anda');
  assert.match(salida, /\/ia-stack no existe en Claude Code/u);
}

test('--project-only instala el runtime en el proyecto y no escribe nada fuera de el', { skip: !hayBash }, () => {
  const { root, project } = fixture();
  try {
    const r = enBash(root, `--project-only --project '${toBash(project)}'`);
    assert.equal(r.status, 0, r.output);
    assertInstaladoEnElProyecto(project, r.output);
    soloElProyecto(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACION · --project-only rechaza lo que no tiene sentido, antes de escribir nada', { skip: !hayBash }, () => {
  const { root, project } = fixture();
  try {
    const sinProyecto = enBash(root, '--project-only');
    assert.equal(sinProyecto.status, 2, sinProyecto.output);
    assert.match(sinProyecto.output, /--project-only exige --project/u);

    const conTarget = enBash(root, `--project-only --project '${toBash(project)}' --target-dir '${toBash(join(root, 'skills'))}'`);
    assert.equal(conTarget.status, 2, conTarget.output);
    assert.match(conTarget.output, /--project-only.*--target-dir/u);

    const conRuntime = enBash(root, `--project-only --project '${toBash(project)}' --runtime-dir '${toBash(join(root, 'runtime'))}'`);
    assert.equal(conRuntime.status, 2, conRuntime.output);
    assert.match(conRuntime.output, /--project-only.*--runtime-dir/u);

    soloElProyecto(root);
    assert.equal(existsSync(join(project, '.vibe')), false, 'un rechazo no deja ni el .vibe del proyecto');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('el comportamiento por defecto no cambia: sin --project-only se sigue instalando lo global', { skip: !hayBash }, () => {
  const { root, project, target, runtime } = fixture();
  try {
    // Un directorio de proyecto que no existe sale antes de copiar el runtime del proyecto, pero DESPUES
    // de lo global: es la forma barata de ver que el orden de siempre sigue siendo el de siempre.
    const r = enBash(root, `--target-dir '${toBash(target)}' --runtime-dir '${toBash(runtime)}' --project '${toBash(join(root, 'no-existe'))}'`);
    assert.equal(r.status, 1, r.output);
    assert.ok(existsSync(join(target, 'ia-stack.md')), 'la skill global se instalo antes de rechazar el proyecto');
    assert.ok(existsSync(join(runtime, 'SKILL.md')), 'y el runtime global tambien');
    assert.equal(existsSync(join(project, '.vibe')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const SIN_PS = 'el instalador de PowerShell no se comprueba: install.ps1 queda sin correr, y con el el modo -ProjectOnly';

test('-ProjectOnly instala el runtime en el proyecto y no escribe nada fuera de el, tambien en PowerShell', soloEnWindows(SIN_PS), () => {
  const { root, project } = fixture();
  try {
    const r = enPowerShell(root, ['-ProjectOnly', '-ProjectDir', project]);
    assert.equal(r.status, 0, r.output);
    assertInstaladoEnElProyecto(project, r.output);
    soloElProyecto(root, ['AppData']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACION · -ProjectOnly rechaza lo que no tiene sentido, tambien en PowerShell', soloEnWindows(SIN_PS), () => {
  const { root, project } = fixture();
  try {
    const sinProyecto = enPowerShell(root, ['-ProjectOnly']);
    assert.notEqual(sinProyecto.status, 0, sinProyecto.output);
    assert.match(sinProyecto.output, /-ProjectOnly exige -ProjectDir/u);

    const conTarget = enPowerShell(root, ['-ProjectOnly', '-ProjectDir', project, '-TargetDir', join(root, 'skills')]);
    assert.notEqual(conTarget.status, 0, conTarget.output);
    assert.match(conTarget.output, /-ProjectOnly.*-TargetDir/u);

    const conRuntime = enPowerShell(root, ['-ProjectOnly', '-ProjectDir', project, '-RuntimeDir', join(root, 'runtime')]);
    assert.notEqual(conRuntime.status, 0, conRuntime.output);
    assert.match(conRuntime.output, /-ProjectOnly.*-RuntimeDir/u);

    soloElProyecto(root, ['AppData']);
    assert.equal(existsSync(join(project, '.vibe')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
