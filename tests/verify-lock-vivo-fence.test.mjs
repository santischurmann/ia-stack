// Un lease no basta: si el worker que perdio el lock sigue con acceso, puede escribir despues de que
// otro tomo el recurso (seccion 26 del prompt maestro, prueba P05). El remedio es el FENCING: cada
// asignacion lleva un numero que sube, y quien escribe lo presenta. Un token mas viejo que el
// vigente es de un escritor que ya no es el dueño y se rechaza.
//
// Limite que estas pruebas no pueden cerrar y que el gate declara: el token lo consulta quien quiere,
// no el disco. Rechaza a un escritor que lo presenta; no frena a uno que no lo hace.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const gate = await import(pathToFileURL(join(repoRoot, 'scripts', 'verify-lock-vivo.mjs')).href);

const ARRANQUE = 'maquina:1000';
const lockConFence = (fence) => ({ pid: 4242, boot: ARRANQUE, start: 'ticks:1', taken_at: '2026-10-05T10:00:00.000Z', fence });

function correr(args, tareas) {
  const salida = [];
  const errores = [];
  const code = gate.main(args, { leer: () => ({ tasks: tareas }), write: (l) => salida.push(l), writeError: (l) => errores.push(l) });
  return { code, salida: salida.join('\n'), errores: errores.join('\n') };
}

const fence = (token, id = 'T01') => ['fence', 'docs/tasks.json', '--task', id, '--token', String(token)];

test('L3.3 · tomar un lock nuevo arranca el fence en 1 y reasignarlo lo sube', () => {
  const primero = gate.tomarLock({ pid: 1, arranque: ARRANQUE, inicio: () => 'ticks:1', ahora: '2026-10-05T10:00:00.000Z' });
  assert.equal(primero.fence, 1);
  assert.deepEqual(Object.keys(primero).sort(), ['boot', 'fence', 'pid', 'start', 'taken_at']);
  const segundo = gate.tomarLock({ pid: 2, arranque: ARRANQUE, inicio: () => 'ticks:2', ahora: '2026-10-05T11:00:00.000Z', anterior: primero });
  assert.equal(segundo.fence, 2, 'cada asignacion sube el numero: el escritor viejo queda con uno menor');
  assert.equal(gate.tomarLock({ pid: 3, arranque: ARRANQUE, inicio: () => null, anterior: 7 }).fence, 8, 'el anterior puede ser el numero pelado');
  assert.equal(gate.tomarLock({ pid: 3, arranque: ARRANQUE, inicio: () => null, anterior: null }).fence, 1);
  assert.equal(gate.tomarLock({ pid: 3, arranque: ARRANQUE, inicio: () => null, anterior: { pid: 9 } }).fence, 1, 'un lock anterior sin fence no inventa uno: se arranca en 1');
});

test('L3.3 · el escritor con el token vigente pasa', () => {
  const { code, salida } = correr(fence(2), [{ id: 'T01', locked: true, lock: lockConFence(2) }]);
  assert.equal(code, 0, salida);
  assert.match(salida, /^OK: .*T01.*fence 2/u);
  assert.match(salida, /LIMITE:.*no frena/u, 'el verde trae su limite: el token lo consulta quien quiere');
});

test('FALSIFICACION · L3.3 · un escritor con un token viejo es rechazado', () => {
  const { code, errores } = correr(fence(1), [{ id: 'T01', locked: true, lock: lockConFence(2) }]);
  assert.equal(code, 1);
  assert.match(errores, /REJECTED:.*T01.*FENCE_STALE.*perdi/u);
});

test('FALSIFICACION · L3.3 · un token de un lock que este plan no tiene tampoco se hereda', () => {
  const { code, errores } = correr(fence(9), [{ id: 'T01', locked: true, lock: lockConFence(2) }]);
  assert.equal(code, 1);
  assert.match(errores, /FENCE_FOREIGN/u);
});

test('FALSIFICACION · L3.3 · una tarea no tomada no tiene a nadie con derecho a escribir', () => {
  const sinLock = correr(fence(1), [{ id: 'T01', locked: false, lock: null }]);
  assert.equal(sinLock.code, 1);
  assert.match(sinLock.errores, /FENCE_NOT_LOCKED/u);
  const desconocida = correr(fence(1, 'T99'), [{ id: 'T01', locked: true, lock: lockConFence(1) }]);
  assert.equal(desconocida.code, 1);
  assert.match(desconocida.errores, /T99.*no existe/u);
});

test('L3.3 · un lock anterior al fencing no se finge vigente: se dice y decide una persona', () => {
  const viejo = { pid: 4242, boot: ARRANQUE, taken_at: '2026-09-01T10:00:00.000Z' };
  const { code, errores } = correr(fence(1), [{ id: 'T01', locked: true, lock: viejo }]);
  assert.equal(code, 1);
  assert.match(errores, /FENCE_UNAVAILABLE.*tomarLock/u, 'dice como reasignarlo, no solo que falla');
});

test('L3.3 · el uso invalido del subcomando sale 2 y muestra el uso', () => {
  for (const args of [['fence'], ['fence', 'docs/tasks.json'], ['fence', 'docs/tasks.json', '--task', 'T01'], ['fence', 'docs/tasks.json', '--task', 'T01', '--token', 'x'], ['fence', 'docs/tasks.json', '--token', '1', '--task', 'T01'], ['fence', 'docs/tasks.json', '--task', '', '--token', '1'], ['fence', 'docs/tasks.json', '--task', 'T01', '--token', '-1'], ['fence', 'docs/tasks.json', '--task', 'T01', '--token', '1', 'extra']]) {
    const { code, errores } = correr(args, []);
    assert.equal(code, 2, args.join(' '));
    assert.match(errores, /usage: verify-lock-vivo\.mjs/u);
  }
});

test('L3.3 · un plan ilegible o ausente se informa igual que en check', () => {
  const sinPlan = [];
  assert.equal(gate.main(fence(1), { leer: () => { throw Object.assign(new Error('no existe'), { code: 'ENOENT' }); }, write: (l) => sinPlan.push(l), writeError: () => {} }), 1);
  const roto = [];
  assert.equal(gate.main(fence(1), { leer: () => { throw new Error('JSON roto'); }, write: () => {}, writeError: (l) => roto.push(l) }), 1);
  assert.match(roto.join('\n'), /JSON roto/u);
});

test('L3.3 · check sigue funcionando con un lock que trae fence y con uno que no', () => {
  const salida = [];
  const code = gate.main(['check', 'docs/tasks.json'], {
    leer: () => ({ tasks: [{ id: 'T01', locked: true, lock: lockConFence(3) }, { id: 'T02', locked: true, lock: { pid: 4242, boot: ARRANQUE, start: 'ticks:1', taken_at: 'x' } }] }),
    arranque: ARRANQUE,
    existe: () => true,
    inicio: () => 'ticks:1',
    write: (l) => salida.push(l),
    writeError: () => {},
  });
  assert.equal(code, 0);
  assert.match(salida.join('\n'), /2 candado\(s\) vivo\(s\)/u);
});

test('L3.3 · un plan sin lista de tareas deja a cualquier escritor sin lock', () => {
  const errores = [];
  const code = gate.main(fence(1), { leer: () => ({}), write: () => {}, writeError: (l) => errores.push(l) });
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /FENCE_UNKNOWN_TASK/u);
});

test('L3.3 · un fallo de lectura que no es un Error igual se informa', () => {
  const errores = [];
  const code = gate.main(fence(1), { leer: () => { throw 'disco lleno'; }, write: () => {}, writeError: (l) => errores.push(l) });
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /disco lleno/u);
});

test('L3.3 · el CLI real lee el plan del disco y rechaza al escritor viejo', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'ia-fence-'));
  try {
    mkdirSync(join(raiz, 'docs'));
    writeFileSync(join(raiz, 'docs', 'tasks.json'), JSON.stringify({ tasks: [{ id: 'T01', locked: true, lock: lockConFence(5) }] }));
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const correrCli = (token) => spawnSync(process.execPath, [join(repoRoot, 'scripts', 'verify-lock-vivo.mjs'), ...fence(token)], { cwd: raiz, encoding: 'utf8', env });
    const vigente = correrCli(5);
    assert.equal(vigente.status, 0, vigente.stdout + vigente.stderr);
    const viejo = correrCli(4);
    assert.equal(viejo.status, 1);
    assert.match(viejo.stderr, /FENCE_STALE/u);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});
