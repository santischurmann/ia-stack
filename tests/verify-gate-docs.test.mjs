// Un gate que nadie puede correr desde el documento es un gate que no existe.
//
// MEDIDO el 2026-09-15 sobre los 54 scripts de `scripts/` y los 20 documentos del protocolo:
// **ocho no tenían un solo comando copiable en ninguna parte**. Seis de ellos ni siquiera aparecen
// en `SKILL.md` — están nombrados únicamente en la tabla de `skills/gates.md`, que dice qué hacen y
// nunca cómo se corren. Quien lee el protocolo no puede ejecutarlos; quien los escribió, sí.
//
// LA REGLA YA ESTABA A MEDIAS. `tests/verify-ablation.test.mjs` exige desde hace meses que la tabla
// de `skills/gates.md` nombre a todos los gates que existen, y eso funcionó: los 54 están nombrados.
// Nombrar no es alcanzar. Lo que faltaba es el otro tramo: que **se pueda correr**.
//
// LOS DOS ESTADOS SON DISTINTOS, Y ÉSA ES TODA LA GRACIA. Un gate sin ejemplo puede ser un olvido —
// y entonces hay que escribirlo— o puede ser correcto, porque no se invoca a mano: `verify-red.mjs`
// despacha a `verify-red-pytest.mjs` y a `verify-red-vitest.mjs`, y `ratchet.mjs` es una biblioteca
// de rutas seguras con un CLI mínimo. Darle un ejemplo a un adaptador sería enseñar a saltear el
// despachador, o sea a elegir a mano el adaptador equivocado. Lo que este gate impide no es que
// falte el ejemplo: es que **no se sepa cuál de los dos casos es**.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-gate-docs.mjs');
const {
  DOCUMENTOS, EMPTY, USAGE, comandosDe, main, validar,
} = await import(pathToFileURL(script).href);

/** Un árbol de mentira con los gates y los documentos que se le pidan. */
function arbol({ gates = [], docs = {}, contrato = undefined } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-gate-docs-'));
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'skills'), { recursive: true });
  mkdirSync(join(root, 'contracts'), { recursive: true });
  for (const g of gates) writeFileSync(join(root, 'scripts', g), '// un gate\n', 'utf8');
  for (const [nombre, texto] of Object.entries(docs)) {
    mkdirSync(dirname(join(root, nombre)), { recursive: true });
    writeFileSync(join(root, nombre), texto, 'utf8');
  }
  if (contrato !== undefined) {
    writeFileSync(join(root, 'contracts', 'gate-docs.json'), JSON.stringify(contrato), 'utf8');
  }
  return root;
}

const conComando = (g) => ['# Doc', '', '```bash', `node .vibe/ia-stack-runtime/scripts/${g} check algo`, '```', ''].join('\n');

const contratoVacio = { schema: 'ia.gate-docs/1', why: 'x', not_invoked_directly: [] };

test('un uso inválido sale 2 y no se confunde con un rechazo', () => {
  const errores = [];
  for (const args of [[], ['otra'], ['check', 'de más']]) {
    errores.length = 0;
    const code = main(args, { write: () => {}, writeError: (l) => errores.push(l) });
    assert.equal(code, 2, JSON.stringify(args));
    assert.ok(errores.some((l) => l === USAGE), errores.join('\n'));
  }
});

test('un gate con su comando copiable en SKILL.md pasa', () => {
  const root = arbol({ gates: ['verify-algo.mjs'], docs: { 'SKILL.md': conComando('verify-algo.mjs') }, contrato: contratoVacio });
  try {
    const errores = [];
    assert.equal(main(['check'], { root, write: () => {}, writeError: (l) => errores.push(l) }), 0, errores.join('\n'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('el ejemplo vale en CUALQUIER documento del protocolo, no sólo en SKILL.md', () => {
  // Es la correccion de la medicion que motivo este gate: seis de los nueve «huerfanos» que se
  // contaron mirando solo SKILL.md ya tenian su ejemplo en una skill. Exigirlo en SKILL.md habria
  // mandado a duplicar documentacion que ya estaba bien puesta.
  assert.ok(DOCUMENTOS.length > 1);
  const root = arbol({
    gates: ['verify-algo.mjs'],
    docs: { 'SKILL.md': '# Nada', 'skills/gates.md': conComando('verify-algo.mjs') },
    contrato: contratoVacio,
  });
  try {
    assert.equal(main(['check'], { root, write: () => {}, writeError: () => {} }), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('NOMBRAR NO ES ALCANZAR · un gate citado en prosa, sin comando, se rechaza', () => {
  // El estado real de los ocho: la tabla de gates dice que existen y que hacen, y nunca como se
  // corren. Quien lee el protocolo no puede ejecutarlos.
  const root = arbol({
    gates: ['verify-algo.mjs'],
    docs: { 'SKILL.md': 'El gate `verify-algo.mjs` comprueba cosas importantes.\n' },
    contrato: contratoVacio,
  });
  try {
    const errores = [];
    assert.equal(main(['check'], { root, write: () => {}, writeError: (l) => errores.push(l) }), 1);
    assert.match(errores.join('\n'), /verify-algo\.mjs/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un gate que NO se invoca a mano se declara, con su motivo y con quién lo invoca', () => {
  const root = arbol({
    gates: ['verify-adaptador.mjs'],
    docs: { 'SKILL.md': '# Nada' },
    contrato: {
      schema: 'ia.gate-docs/1',
      why: 'x',
      not_invoked_directly: [{
        script: 'verify-adaptador.mjs',
        invoked_by: 'verify-despachador.mjs',
        why: 'Es un adaptador: darle un ejemplo enseñaría a saltear el despachador y elegir a mano el adaptador equivocado.',
      }],
    },
  });
  try {
    const salida = [];
    assert.equal(main(['check'], { root, write: (l) => salida.push(l), writeError: () => {} }), 0);
    assert.match(salida.join('\n'), /1 .*(declarado|sin ejemplo)/iu);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('una declaración a medias no declara nada', () => {
  for (const entrada of [
    { script: 'verify-adaptador.mjs' },
    { script: 'verify-adaptador.mjs', invoked_by: 'x' },
    { script: 'verify-adaptador.mjs', invoked_by: 'verify-d.mjs', why: 'corto' },
    { script: '', invoked_by: 'verify-d.mjs', why: 'Un motivo suficientemente largo para pasar el piso.' },
  ]) {
    const v = validar(['verify-adaptador.mjs'], new Set(), { schema: 'ia.gate-docs/1', why: 'x', not_invoked_directly: [entrada] });
    assert.ok(v.length > 0, JSON.stringify(entrada));
  }
});

test('FALSIFICACIÓN · declarar un gate que NO existe también se rechaza', () => {
  // El espejo de la regla de la tabla de gates: un contrato que nombra un script borrado deja una
  // excepcion viva para algo que ya no esta, y la proxima vez que alguien cree ese nombre nace
  // exceptuado sin que nadie lo haya decidido.
  const v = validar([], new Set(), {
    schema: 'ia.gate-docs/1',
    why: 'x',
    not_invoked_directly: [{ script: 'verify-fantasma.mjs', invoked_by: 'verify-d.mjs', why: 'Un motivo suficientemente largo para pasar el piso.' }],
  });
  assert.ok(v.some((x) => /verify-fantasma\.mjs/u.test(x)), v.join(' | '));
});

test('FALSIFICACIÓN · un gate declarado Y documentado es una contradicción, y se dice', () => {
  // Las dos cosas no pueden ser ciertas: o se corre a mano y tiene ejemplo, o no se corre a mano.
  // Dejarlo pasar convertiria al contrato en una lista que nadie revisa.
  const v = validar(['verify-algo.mjs'], new Set(['verify-algo.mjs']), {
    schema: 'ia.gate-docs/1',
    why: 'x',
    not_invoked_directly: [{ script: 'verify-algo.mjs', invoked_by: 'verify-d.mjs', why: 'Un motivo suficientemente largo para pasar el piso.' }],
  });
  assert.ok(v.some((x) => /verify-algo\.mjs/u.test(x)), v.join(' | '));
});

test('comandosDe encuentra el script sólo adentro de un bloque de código', () => {
  assert.deepEqual([...comandosDe('```bash\nnode scripts/verify-a.mjs check\n```\n')], ['verify-a.mjs']);
  assert.deepEqual([...comandosDe('El gate `verify-a.mjs` hace cosas.\n')], []);
  // Un bloque sin cerrar no convierte al resto del documento en comandos.
  assert.deepEqual([...comandosDe('```bash\nnode scripts/verify-a.mjs check\n')], []);
});

test('sin documentos no hay nada que comprobar, y eso no es un incumplimiento', () => {
  const root = arbol({ gates: ['verify-algo.mjs'], contrato: contratoVacio });
  try {
    const salida = [];
    assert.equal(main(['check'], { root, write: (l) => salida.push(l), writeError: () => {} }), 0);
    assert.ok(/^VACÍO: /u.test(salida.at(-1)), salida.join('\n'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sin el contrato el gate RECHAZA: aprobar sin la lista de excepciones sería aprobar cualquier cosa', () => {
  const root = arbol({ gates: ['verify-algo.mjs'], docs: { 'SKILL.md': conComando('verify-algo.mjs') } });
  try {
    const errores = [];
    assert.equal(main(['check'], { root, write: () => {}, writeError: (l) => errores.push(l) }), 1);
    assert.match(errores.join('\n'), /gate-docs\.json/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un contrato con el schema equivocado, o sin la lista, no es un contrato', () => {
  // Es la misma distincion que el gate hace con su ausencia: un contrato ilegible no se puede tomar
  // por una lista vacia de excepciones, porque eso aprobaria cualquier gate sin ejemplo.
  const conSchemaMalo = validar([], new Set(), { schema: 'ia.otra-cosa/9', not_invoked_directly: [] });
  assert.ok(conSchemaMalo.some((x) => /schema/u.test(x)), conSchemaMalo.join(' | '));

  for (const lista of ['no es una lista', null, undefined, 42]) {
    const v = validar([], new Set(), { schema: 'ia.gate-docs/1', why: 'x', not_invoked_directly: lista });
    assert.ok(v.some((x) => /not_invoked_directly/u.test(x)), `${JSON.stringify(lista)}: ${v.join(' | ')}`);
  }
});

test('si no se puede listar scripts/, el gate RECHAZA en vez de decir que no hay gates', () => {
  // Cero gates listados daria un verde vacio perfecto: ningun gate sin ejemplo, porque ningun gate.
  const errores = [];
  const code = main(['check'], {
    root: '/no/existe',
    listar: () => { throw new Error('ENOENT: no such directory'); },
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /scripts\//u);
});

test('ADENTRO DE UN RUNTIME INSTALADO no hay nada que verificar, y eso es VACÍO', () => {
  // Lo encontró el E2E, que es donde tenía que encontrarse. El instalador no copia `README.md` ni
  // `INSTALL.md`, que son los documentos donde viven los ejemplos de los dos instaladores: desde
  // adentro de una instalación el gate los acusaba como si faltaran, y mandaba a arreglar algo que
  // no está roto. Mismo patrón que `verify-ia-stack-contract.mjs`, y por la misma razón.
  const root = arbol({ gates: ['install.sh'], docs: { 'SKILL.md': '# Nada' }, contrato: contratoVacio });
  const instalado = join(root, '.vibe', 'ia-stack-runtime');
  mkdirSync(join(instalado, 'scripts'), { recursive: true });
  mkdirSync(join(instalado, 'skills'), { recursive: true });
  writeFileSync(join(instalado, 'scripts', 'install.sh'), '# un instalador\n', 'utf8');
  writeFileSync(join(instalado, 'SKILL.md'), '# Nada', 'utf8');
  try {
    const salida = [];
    const code = main(['check'], { root: instalado, write: (l) => salida.push(l), writeError: (l) => salida.push(l) });
    assert.equal(code, 0, salida.join('\n'));
    assert.ok(/^VACÍO: /u.test(salida[0]), salida.join('\n'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('EL PROTOCOLO REAL: cada gate se puede correr desde un documento, o está declarado', () => {
  const salida = [];
  const errores = [];
  const code = main(['check'], { root: repoRoot, write: (l) => salida.push(l), writeError: (l) => errores.push(l) });
  assert.equal(code, 0, errores.join('\n'));
  assert.ok(salida.some((l) => /^LIMITE: /u.test(l)), 'el gate tiene que declarar qué NO comprueba');
});
