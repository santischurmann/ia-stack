// AC6 de docs/spec.md · Un runner no declarado se rechaza nombrándolo, sin adivinar adaptador.
//
// EL PROBLEMA. Hasta hoy `verify-red-node.mjs` era el único adaptador y rechazaba cualquier comando
// que no fuera exactamente `node --test`. Eso dejaba a un proyecto Python **sin forma de pasar LAW
// 1**: no hay test rojo verificable, así que no hay implementación permitida. Abrir la puerta a más
// runners es necesario, y es justo donde aparece la tentación de adivinar — ver `pytest` en el
// comando y suponer el adaptador. Adivinar acá significa clasificar un rojo con un parser que no
// corresponde, y un rojo mal clasificado es un verde disfrazado.
//
// POR ESO EL DESPACHADOR NO INFIERE NADA. Resuelve el comando contra `contracts/red-adapters.json`
// por igualdad exacta. Lo que no está declarado se rechaza NOMBRÁNDOLO y listando lo que sí existe,
// para que la persona sepa qué escribir en vez de adivinar ella.
//
// Y CADA ADAPTADOR DECLARA SU GARANTÍA. El nativo de Node es `fuerte`; pytest y vitest son `menor`,
// porque los dos ejecutan código de configuración del proyecto con control sobre el reporte y sobre
// el código de salida — falsificado y medido en `research/sources/adaptadores-red-2026-09-14.md`.
// El despachador **dice cuál corrió y con qué garantía**, para que un verde débil no se lea igual
// que uno fuerte. Es la mitad de AC8 que vive acá; la otra mitad la exige el receipt.

import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-red.mjs');
const {
  GARANTIAS, SCHEMA, USAGE, main, resolverAdaptador, validarContrato,
} = await import(pathToFileURL(script).href);

const motivo = (base) => `${base}, con texto suficiente para no ser relleno.`;

const adaptador = (over = {}) => ({
  command: 'node --test',
  script: 'verify-red-node.mjs',
  guarantee: 'fuerte',
  why: motivo('El único código del proyecto que corre es el archivo de prueba, adentro del marco TAP'),
  limit: motivo('No prueba que la aserción sea genuina, sólo que una prueba real falló con su forma'),
  ...over,
});

const contrato = (over = {}) => ({
  schema: SCHEMA,
  why: motivo('Los runners se declaran uno por uno para que el despachador no tenga que adivinar'),
  adapters: [adaptador()],
  ...over,
});

function correr(args, over = {}) {
  const salida = [];
  const errores = [];
  const code = main(args, {
    root: repoRoot,
    runtimeRoot: repoRoot,
    readContract: () => contrato(),
    run: () => ({ status: 0, stdout: 'OK: el adaptador dijo que si\n', stderr: '' }),
    write: (l) => salida.push(l),
    writeError: (l) => errores.push(l),
    ...over,
  });
  return { code, salida, errores };
}

test('un uso inválido sale 2 y no se confunde con un rechazo', () => {
  for (const args of [[], ['check'], ['check', '--test', 'a.test.mjs'], ['otra', '--test', 'a', '--command', 'b']]) {
    const { code, errores } = correr(args);
    assert.equal(code, 2, JSON.stringify(args));
    assert.ok(errores.some((l) => l === USAGE), errores.join('\n'));
  }
});

test('eleccion-de-stack · AC6 · un runner no declarado sale 1, lo nombra, y NO adivina adaptador', () => {
  const corridas = [];
  const { code, errores } = correr(['check', '--test', 'tests/a.test.mjs', '--command', 'pytest -q --tb=short'], {
    run: (...a) => { corridas.push(a); return { status: 0, stdout: '', stderr: '' }; },
  });

  assert.equal(code, 1);
  assert.deepEqual(corridas, [], 'corrió un adaptador igual, que es exactamente adivinar');
  const todo = errores.join('\n');
  assert.ok(/pytest -q --tb=short/u.test(todo), `tiene que NOMBRAR el comando recibido: ${todo}`);
  assert.ok(/node --test/u.test(todo), `tiene que listar los declarados para que se sepa qué escribir: ${todo}`);
});

test('AC6 · un comando que sólo se PARECE a uno declarado tampoco se adivina', () => {
  // `pytest` declarado no habilita `pytest -q`: las opciones cambian el reporte, y el adaptador
  // depende de la forma del reporte. La coincidencia es exacta o no es.
  for (const parecido of ['node --test --watch', 'NODE --TEST', ' node --test', 'node  --test']) {
    const { code, errores } = correr(['check', '--test', 'tests/a.test.mjs', '--command', parecido]);
    assert.equal(code, 1, parecido);
    assert.ok(errores.some((l) => /no está declarado|no esta declarado/u.test(l)), `${parecido}: ${errores.join('\n')}`);
  }
});

test('un runner declarado delega en su adaptador, con los mismos argumentos', () => {
  const corridas = [];
  const { code, salida } = correr(['check', '--test', 'tests/a.test.mjs', '--command', 'node --test'], {
    run: (bin, args, opciones) => { corridas.push({ bin, args, opciones }); return { status: 0, stdout: 'OK: paso\n', stderr: '' }; },
  });

  assert.equal(code, 0, salida.join('\n'));
  assert.equal(corridas.length, 1);
  assert.ok(corridas[0].args.some((a) => a.endsWith('verify-red-node.mjs')), JSON.stringify(corridas[0].args));
  assert.deepEqual(corridas[0].args.slice(-5), ['check', '--test', 'tests/a.test.mjs', '--command', 'node --test']);
});

test('AC8 · la salida dice QUÉ adaptador corrió y con qué garantía', () => {
  const { salida } = correr(['check', '--test', 'tests/a.test.mjs', '--command', 'node --test']);
  const todo = salida.join('\n');
  assert.ok(/verify-red-node\.mjs/u.test(todo), `no dijo qué adaptador corrió: ${todo}`);
  assert.ok(/fuerte/iu.test(todo), `no dijo la garantía: ${todo}`);
});

test('AC8 · un verde de garantía MENOR no se lee igual que uno fuerte', () => {
  const menor = adaptador({
    command: 'pytest',
    script: 'verify-red-pytest.mjs',
    guarantee: 'menor',
    why: motivo('pytest ejecuta conftest.py del proyecto, con control sobre el reporte y el exit code'),
    limit: motivo('Un conftest puede reescribir el XML y forzar el exit code con una prueba que pasa'),
  });
  const { code, salida } = correr(['check', '--test', 'tests/test_a.py', '--command', 'pytest'], {
    readContract: () => contrato({ adapters: [adaptador(), menor] }),
  });

  assert.equal(code, 0, salida.join('\n'));
  const todo = salida.join('\n');
  assert.ok(/menor/iu.test(todo), `no marcó la garantía menor: ${todo}`);
  assert.ok(todo.includes(menor.limit), 'un verde de garantía menor tiene que venir con su límite escrito, no sólo con la etiqueta');
});

test('si el adaptador rechaza, el despachador propaga el código y no lo convierte en verde', () => {
  const { code, errores } = correr(['check', '--test', 'tests/a.test.mjs', '--command', 'node --test'], {
    run: () => ({ status: 1, stdout: '', stderr: 'REJECTED: no hubo rojo\n' }),
  });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /no hubo rojo/u.test(l)), errores.join('\n'));
});

test('un adaptador que ni siquiera arranca se distingue de uno que rechaza', () => {
  const { code, errores } = correr(['check', '--test', 'tests/a.test.mjs', '--command', 'node --test'], {
    run: () => ({ error: new Error('spawn ENOENT'), status: null, stdout: '', stderr: '' }),
  });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /no se pudo lanzar|ENOENT/u.test(l)), errores.join('\n'));
  assert.ok(!errores.some((l) => /no hubo rojo/u.test(l)), 'confundió un fallo de lanzamiento con un veredicto');
});

test('FALSIFICACIÓN · el contrato se comprueba campo por campo', () => {
  assert.deepEqual(validarContrato(contrato()), []);
  assert.ok(validarContrato({ ...contrato(), schema: 'otro' }).some((v) => /schema/u.test(v)));
  assert.ok(validarContrato({ ...contrato(), extra: 1 }).some((v) => /exactamente/u.test(v)));
  assert.ok(validarContrato(contrato({ adapters: 'no es lista' })).some((v) => /adapters/u.test(v)));
  assert.ok(validarContrato(contrato({ adapters: [] })).some((v) => /al menos un/u.test(v)));
  assert.ok(validarContrato(contrato({ adapters: [adaptador({ command: '' })] })).some((v) => /command/u.test(v)));
  assert.ok(validarContrato(contrato({ adapters: [adaptador({ script: 'otra-cosa.mjs' })] })).some((v) => /verify-red/u.test(v)));
  assert.ok(validarContrato(contrato({ adapters: [adaptador({ guarantee: 'media' })] })).some((v) => /guarantee/u.test(v)));
  assert.ok(validarContrato(contrato({ adapters: [adaptador({ why: 'corto' })] })).some((v) => /why/u.test(v)));
  assert.ok(validarContrato(contrato({ adapters: [adaptador({ limit: 'tbd' })] })).some((v) => /limit/u.test(v)));
});

test('FALSIFICACIÓN · dos adaptadores no pueden declarar el mismo comando', () => {
  // Con dos filas para el mismo comando, cuál corre depende del orden del archivo. Un empate
  // silencioso elige por accidente, y el accidente puede elegir el de garantía menor.
  const violaciones = validarContrato(contrato({
    adapters: [adaptador(), adaptador({ script: 'verify-red-vitest.mjs', guarantee: 'menor' })],
  }));
  assert.ok(violaciones.some((v) => /repetid|duplicad/u.test(v)), violaciones.join(' | '));
});

test('las garantías son un conjunto cerrado, y fuerte/menor están adentro', () => {
  assert.ok(GARANTIAS.has('fuerte'));
  assert.ok(GARANTIAS.has('menor'));
  assert.ok(!GARANTIAS.has('media'), 'una garantía intermedia invita a poner ahí lo que no se quiso medir');
});

test('resolverAdaptador devuelve la fila exacta, o nada, y nunca la más parecida', () => {
  const filas = [adaptador(), adaptador({ command: 'pytest', script: 'verify-red-pytest.mjs', guarantee: 'menor' })];
  assert.equal(resolverAdaptador(filas, 'pytest')?.script, 'verify-red-pytest.mjs');
  assert.equal(resolverAdaptador(filas, 'node --test')?.script, 'verify-red-node.mjs');
  assert.equal(resolverAdaptador(filas, 'pytest -q'), undefined);
  assert.equal(resolverAdaptador(filas, 'PYTEST'), undefined);
});

test('EL CONTRATO REAL declara el nativo, y todo script que nombra existe', async () => {
  const { existsSync, readFileSync } = await import('node:fs');
  const real = JSON.parse(readFileSync(join(repoRoot, 'contracts', 'red-adapters.json'), 'utf8'));

  assert.deepEqual(validarContrato(real), []);
  assert.ok(real.adapters.some((a) => a.command === 'node --test' && a.guarantee === 'fuerte'),
    'el nativo tiene que seguir declarado, y seguir siendo el fuerte');
  for (const a of real.adapters) {
    assert.ok(existsSync(join(repoRoot, 'scripts', a.script)), `${a.command} nombra ${a.script}, que no existe`);
  }
});
