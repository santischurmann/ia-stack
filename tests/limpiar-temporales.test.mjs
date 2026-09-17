// Las carpetas temporales que una corrida interrumpida deja tiradas.
//
// EL PROBLEMA, medido el 2026-09-15: 198 carpetas `vcp-discovery-core-*` en el temporal del sistema,
// todas del mismo día, más 280 en total sobre 105 prefijos distintos. **No falta ningún `rmSync`** —
// se revisó archivo por archivo: los 50 que usan `mkdtempSync` tienen al menos uno por cada uno, y
// el delta de una suite COMPLETA es **cero**. Salen de corridas matadas: un proceso que muere nunca
// ejecuta su `finally`, y este repositorio corre su suite en segundo plano todo el tiempo.
//
// EL `finally` NO PUEDE CUBRIR ESE CASO, por construcción. Lo que falta es lo de después.
//
// POR QUÉ LISTA POR DEFECTO Y SÓLO BORRA SI SE LO PIDEN. Esta es la única herramienta del protocolo
// que borra, y borrar de más en el temporal del sistema es borrar el trabajo de otro programa. La
// regla de este repositorio para limpiar es explícita: listar primero, y sacar sólo lo nombrado.
// Así que el modo por defecto es `listar`, y `--borrar` es una decisión que alguien toma mirando.
//
// LAS TRES DEFENSAS, y cada una cierra un modo de falla distinto:
//   1. Los prefijos SE DERIVAN de `tests/`, nunca de una lista escrita a mano que se desactualiza.
//   2. El nombre tiene que ser prefijo + los SEIS caracteres exactos que `mkdtempSync` agrega. Sin
//      comodines: `vcp-` a secas barrería la carpeta de trabajo de cualquier otra cosa.
//   3. Una carpeta con un fuente del usuario adentro NO se toca, y se nombra. Es la regla dura.

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'limpiar-temporales.mjs');

/**
 * Lo intocable, para las pruebas que ejercen la regla dura. Se declara acá porque ahora sale de un
 * contrato y no del código: una prueba que usa una extensión de proyecto tiene que declararla, igual
 * que la declararía un proyecto de verdad. `.fuente` y `.binario` son inventadas a propósito — el
 * protocolo público no conoce el stack de nadie.
 */
const INTOCABLES_DE_PRUEBA = /\.(?:fuente|binario|env|key|pem)$|(?:^|[\\/])\.(?:fuente|binario|env|key|pem)$/iu;

// Self-check del repositorio: lee contracts/ de la raiz del checkout. Adentro de un runtime
// instalado no aplica, y se saltea diciendolo.
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de IA Stack, no del proyecto de quien instala' }
  : {};
const {
  HORAS_MINIMAS, SUFIJO_MKDTEMP, USAGE, candidatas, intocablesDe, leerIntocables, main, prefijosDe,
} = await import(pathToFileURL(script).href);

/** Un temporal de mentira con las carpetas que se le pidan, envejecidas a gusto. */
function temporal(carpetas) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-limpieza-'));
  for (const [nombre, opciones = {}] of Object.entries(carpetas)) {
    const d = join(root, nombre);
    mkdirSync(d, { recursive: true });
    if (opciones.contiene) writeFileSync(join(d, opciones.contiene), 'x', 'utf8');
    const horas = opciones.horas ?? 48;
    const cuando = new Date(Date.now() - horas * 3600 * 1000);
    utimesSync(d, cuando, cuando);
  }
  return root;
}

const PREFIJOS = ['vcp-discovery-core-', 'vcp-task-shape-'];

test('un uso inválido sale 2 y no se confunde con un rechazo', () => {
  const errores = [];
  for (const args of [['borrar'], ['listar', 'de más'], ['--borrar', 'x']]) {
    errores.length = 0;
    assert.equal(main(args, { write: () => {}, writeError: (l) => errores.push(l) }), 2, JSON.stringify(args));
    assert.ok(errores.some((l) => l === USAGE), errores.join('\n'));
  }
});

test('LOS PREFIJOS SALEN DEL ÁRBOL, no de una lista escrita a mano', () => {
  // Es la misma lección que el gate de alcance: una lista que alguien tiene que acordarse de ampliar
  // deja afuera lo que se agregue después, y nadie se entera.
  const p = prefijosDe(repoRoot);
  assert.ok(p.length > 50, `sólo ${p.length} prefijos: se esperaba que saliera de los ~50 archivos con mkdtempSync`);
  assert.ok(p.includes('vcp-discovery-core-'), 'el prefijo que más carpetas dejó tiene que estar');
  assert.ok(p.every((x) => /^[A-Za-z0-9][A-Za-z0-9-]*-$/u.test(x)), `un prefijo con forma rara: ${JSON.stringify(p.filter((x) => !/^[A-Za-z0-9][A-Za-z0-9-]*-$/u.test(x)))}`);
});

test('SÓLO prefijo + los seis caracteres exactos de mkdtemp', () => {
  assert.equal(SUFIJO_MKDTEMP, 6);
  const root = temporal({
    'vcp-discovery-core-aB3xY9': {},
    'vcp-discovery-core-corta': {},
    'vcp-discovery-core-demasiado-larga': {},
    'vcp-discovery-core': {},
    'otra-cosa-aB3xY9': {},
    'mi-proyecto': {},
  });
  try {
    assert.deepEqual(candidatas(root, PREFIJOS, {}, INTOCABLES_DE_PRUEBA).map((c) => c.nombre), ['vcp-discovery-core-aB3xY9']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('UNA CORRIDA EN CURSO NO SE TOCA: sólo lo viejo entra', () => {
  // Sin el umbral, correr esto mientras la suite trabaja le borraría el piso a la corrida.
  assert.ok(HORAS_MINIMAS >= 1);
  const root = temporal({
    'vcp-task-shape-rrrrrr': { horas: 0 },
    'vcp-task-shape-vvvvvv': { horas: HORAS_MINIMAS + 1 },
  });
  try {
    assert.deepEqual(candidatas(root, PREFIJOS, {}, INTOCABLES_DE_PRUEBA).map((c) => c.nombre), ['vcp-task-shape-vvvvvv']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('LA REGLA DURA · una carpeta con un fuente del usuario adentro no se toca, y se nombra', () => {
  for (const archivo of ['estrategia.fuente', 'compilado.binario', '.env', 'clave.key', 'cert.pem']) {
    const root = temporal({ 'vcp-task-shape-aaaaaa': { contiene: archivo } });
    try {
      const [c] = candidatas(root, PREFIJOS, {}, INTOCABLES_DE_PRUEBA);
      assert.equal(c.intocable, true, archivo);
      assert.match(c.motivo, new RegExp(archivo.replace('.', '\\.'), 'u'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('POR DEFECTO LISTA Y NO BORRA NADA', () => {
  const root = temporal({ 'vcp-discovery-core-aaaaaa': {}, 'vcp-task-shape-bbbbbb': {} });
  try {
    const salida = [];
    assert.equal(main(['listar', '--temp', root, '--tests', repoRoot], { write: (l) => salida.push(l), intocables: INTOCABLES_DE_PRUEBA }), 0);
    assert.ok(existsSync(join(root, 'vcp-discovery-core-aaaaaa')), 'listar NO borra');
    assert.match(salida.join('\n'), /2 carpeta/u);
    assert.match(salida.join('\n'), /--borrar/u, 'tiene que decir cómo se borra, para que listar no sea un callejón');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CON --borrar saca las que coinciden, y SÓLO ésas', () => {
  const root = temporal({
    'vcp-discovery-core-aaaaaa': {},
    'vcp-task-shape-bbbbbb': { contiene: 'cosa.fuente' },
    'proyecto-de-otro': {},
  });
  try {
    const salida = [];
    assert.equal(main(['listar', '--temp', root, '--tests', repoRoot, '--borrar'], { write: (l) => salida.push(l), intocables: INTOCABLES_DE_PRUEBA }), 0);
    assert.equal(existsSync(join(root, 'vcp-discovery-core-aaaaaa')), false, 'la que coincide se va');
    assert.equal(existsSync(join(root, 'vcp-task-shape-bbbbbb')), true, 'la que tiene un fuente declarado se queda');
    assert.equal(existsSync(join(root, 'proyecto-de-otro')), true, 'lo que no coincide ni se mira');
    assert.match(salida.join('\n'), /1 borrada/u);
    assert.match(salida.join('\n'), /1 intocable|1 sin tocar/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sin candidatas no hay nada que limpiar, y eso no es un incumplimiento', () => {
  const root = temporal({ 'proyecto-de-otro': {} });
  try {
    const salida = [];
    assert.equal(main(['listar', '--temp', root, '--tests', repoRoot], { write: (l) => salida.push(l), intocables: INTOCABLES_DE_PRUEBA }), 0);
    assert.match(salida.at(-1) ?? '', /^VACÍO: /u, salida.join('\n'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · sin prefijos derivables NO barre nada, en vez de barrer todo', () => {
  // El modo de falla que convertiría esta herramienta en un desastre: si `tests/` no se puede leer,
  // una lista vacía de prefijos con un comodín de respaldo borraría el temporal entero.
  const root = temporal({ 'vcp-discovery-core-aaaaaa': {} });
  try {
    const errores = [];
    assert.equal(main(['listar', '--temp', root, '--tests', join(root, 'no-existe'), '--borrar'], {
      write: () => {}, writeError: (l) => errores.push(l),
    }), 1);
    assert.equal(existsSync(join(root, 'vcp-discovery-core-aaaaaa')), true, 'no se tocó una sola carpeta');
    assert.match(errores.join('\n'), /prefijo/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- LO QUE PASA CUANDO EL DISCO NO CONTESTA -----------------------------------------------------
//
// Cada una de estas es un estado en el que esta herramienta podria BORRAR algo que no debia, o
// quedarse callada. Un `catch` vacio en un barrido es la diferencia entre «no pude mirar adentro,
// no toco» y «no vi nada raro, borro».

test('un archivo de prueba ilegible no frena la derivación: se saltea y los demás siguen', () => {
  const p = prefijosDe(repoRoot, {
    listar: () => ['a.test.mjs', 'b.test.mjs'],
    leer: (ruta) => {
      if (String(ruta).endsWith('a.test.mjs')) throw new Error('EACCES');
      return "mkdtempSync(join(tmpdir(), 'vcp-desde-b-'))";
    },
  });
  assert.deepEqual(p, ['vcp-desde-b-']);
});

test('sin carpeta tests/ no hay prefijos, y eso NO es una lista vacía que autorice barrer', () => {
  assert.deepEqual(prefijosDe(repoRoot, { listar: () => { throw new Error('ENOENT'); } }), []);
});

test('UNA CARPETA QUE NO SE PUEDE MIRAR ADENTRO es intocable, no inocente', () => {
  // Fail-closed: lo que no se puede inspeccionar no se puede descartar. Al revés sería la peor
  // versión de esta herramienta -- borrar justo lo que no pudo revisar.
  const [c] = candidatas('/temp', PREFIJOS, {
    listar: (ruta) => {
      if (String(ruta) === '/temp') return [{ name: 'vcp-task-shape-aaaaaa', isDirectory: () => true }];
      throw new Error('EPERM');
    },
    stat: () => ({ mtimeMs: 0 }),
    ahora: Date.now(),
  }, INTOCABLES_DE_PRUEBA);
  assert.equal(c.intocable, true);
  assert.match(c.motivo, /no se puede leer/u);
});

test('un temporal que no se puede listar devuelve nada, en vez de romper', () => {
  assert.deepEqual(candidatas('/no-existe', PREFIJOS, { listar: () => { throw new Error('ENOENT'); } }), []);
});

test('sin prefijos no hay candidatas, aunque el temporal esté lleno', () => {
  assert.deepEqual(candidatas('/temp', [], { listar: () => { throw new Error('no debería llegar acá'); } }), []);
});

test('una entrada cuyo stat falla se saltea: no se puede fechar, no se toca', () => {
  assert.deepEqual(candidatas('/temp', PREFIJOS, {
    listar: () => [{ name: 'vcp-task-shape-aaaaaa', isDirectory: () => true }],
    stat: () => { throw new Error('EBUSY'); },
  }, INTOCABLES_DE_PRUEBA), []);
});

test('un doble que devuelve nombres sueltos en vez de Dirents se entiende igual', () => {
  // `verify-empty-probe.mjs` ya declara este caso: un doble de pruebas puede devolver cadenas, y
  // asumir Dirent haría que el barrido no viera nada y dijera que está todo limpio.
  const c = candidatas('/temp', PREFIJOS, {
    listar: (ruta) => (String(ruta) === '/temp' ? ['vcp-task-shape-aaaaaa'] : []),
    stat: () => ({ mtimeMs: 0 }),
    ahora: Date.now(),
  }, INTOCABLES_DE_PRUEBA);
  assert.deepEqual(c.map((x) => x.nombre), ['vcp-task-shape-aaaaaa']);
  assert.equal(c[0].intocable, false);
});

test('adentro de una carpeta, un doble que devuelve nombres sueltos también se entiende', () => {
  // Misma razón que arriba, un nivel más abajo: si el barrido asumiera Dirent, un fuente devuelto
  // como cadena no se vería y la carpeta se borraría con el fuente adentro.
  const [c] = candidatas('/temp', PREFIJOS, {
    listar: (ruta) => (String(ruta) === '/temp'
      ? [{ name: 'vcp-task-shape-aaaaaa', isDirectory: () => true }]
      : ['estrategia.fuente']),
    stat: () => ({ mtimeMs: 0 }),
    ahora: Date.now(),
  }, INTOCABLES_DE_PRUEBA);
  assert.equal(c.intocable, true);
  assert.match(c.motivo, /estrategia\.fuente/u);
});

test('una subcarpeta se recorre hasta el fondo buscando lo intocable', () => {
  const [c] = candidatas('/temp', PREFIJOS, {
    listar: (ruta) => {
      const s = String(ruta);
      if (s === '/temp') return [{ name: 'vcp-task-shape-aaaaaa', isDirectory: () => true }];
      if (s.endsWith('aaaaaa')) return [{ name: 'adentro', isDirectory: () => true }];
      return [{ name: 'estrategia.fuente', isDirectory: () => false }];
    },
    stat: () => ({ mtimeMs: 0 }),
    ahora: Date.now(),
  }, INTOCABLES_DE_PRUEBA);
  assert.equal(c.intocable, true, 'un fuente declarado dos niveles abajo cuenta igual');
});

test('si borrar falla, la carpeta se cuenta como intacta y el motivo viaja', () => {
  const root = temporal({ 'vcp-task-shape-aaaaaa': {} });
  try {
    const salida = [];
    assert.equal(main(['listar', '--temp', root, '--tests', repoRoot, '--borrar'], {
      write: (l) => salida.push(l),
      borrar: () => { throw new Error('EBUSY: la usa otro proceso'); },
    }), 0);
    assert.match(salida.join('\n'), /0 borrada/u);
    assert.match(salida.join('\n'), /EBUSY/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sin --temp sale del entorno, y el último recurso es /tmp', () => {
  const previo = { TMPDIR: process.env.TMPDIR, TEMP: process.env.TEMP };
  try {
    const root = temporal({});
    delete process.env.TMPDIR;
    process.env.TEMP = root;
    const salida = [];
    assert.equal(main(['listar', '--tests', repoRoot], { write: (l) => salida.push(l), intocables: INTOCABLES_DE_PRUEBA }), 0);
    assert.match(salida.join('\n'), new RegExp(root.replaceAll('\\', '\\\\').replaceAll('.', '\\.'), 'u'));

    delete process.env.TEMP;
    const sinNada = [];
    main(['listar', '--tests', repoRoot], { write: (l) => sinNada.push(l) });
    assert.match(sinNada.join('\n'), /\/tmp/u, 'el último recurso se nombra');
    rmSync(root, { recursive: true, force: true });
  } finally {
    if (previo.TMPDIR === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = previo.TMPDIR;
    if (previo.TEMP === undefined) delete process.env.TEMP; else process.env.TEMP = previo.TEMP;
  }
});

// --- Lo intocable sale de un contrato, no del codigo ---------------------------------------------

const CONTRATO = {
  schema: 'ia.irreplaceable-sources/1',
  why: 'un motivo escrito de largo suficiente para el contrato de fuentes irreemplazables',
  universales: [
    { extension: '.env', why: 'credenciales: no se borran, no se copian y no se citan en ningún reporte' },
    { extension: '.key', why: 'material criptográfico que no se puede volver a generar igual' },
    { extension: '.pem', why: 'material criptográfico' },
  ],
  del_proyecto: [],
};

const conDelProyecto = (lista) => ({ ...CONTRATO, del_proyecto: lista });

test('la lista se construye del contrato, y los universales están siempre', () => {
  const re = intocablesDe(CONTRATO);
  for (const nombre of ['secreto.key', 'cert.pem', '.env', 'sub/.env']) {
    assert.equal(re.test(nombre), true, nombre);
  }
  // Y lo que el contrato NO declara no es intocable: si lo fuera, el limpiador no limpiaría nada.
  assert.equal(re.test('salida.log'), false);
  assert.equal(re.test('cualquiera.fuente'), false, 'el protocolo público no conoce esta extensión');
});

test('un proyecto agrega las suyas y pasan a ser intocables', () => {
  // Es lo que reemplaza a tenerlas escritas a mano adentro del código.
  const re = intocablesDe(conDelProyecto([
    { extension: '.fuente', why: 'un fuente que este proyecto no versiona por diseño: borrarlo es pérdida total' },
    { extension: '.binario', why: 'el compilado del anterior, que tampoco está en git' },
  ]));
  assert.equal(re.test('estrategia.fuente'), true);
  assert.equal(re.test('estrategia.binario'), true);
  assert.equal(re.test('estrategia.FUENTE'), true, 'la extensión no distingue mayúsculas');
});

test('un nombre que sólo CONTIENE la extensión no cuenta: tiene que terminar en ella', () => {
  // `notas.fuente.txt` es un texto, no un fuente. Tratarlo como intocable dejaría basura para siempre.
  const re = intocablesDe(conDelProyecto([{ extension: '.fuente', why: 'un fuente que este proyecto no versiona por diseño' }]));
  assert.equal(re.test('notas.fuente.txt'), false);
  assert.equal(re.test('fuente'), false);
});

test('FALSIFICACIÓN · una extensión sin motivo escrito se rechaza', () => {
  // Misma disciplina que el resto: declarar algo intocable es una decisión, y va con su porqué.
  for (const mala of [{ extension: '.fuente' }, { extension: '.fuente', why: 'corto' }, { why: 'sin extensión' }, 'no es un objeto']) {
    assert.throws(() => intocablesDe(conDelProyecto([mala])), /motivo|extensión|objeto/iu, JSON.stringify(mala));
  }
});

test('FALSIFICACIÓN · una extensión mal escrita se rechaza en vez de armar una regex rota', () => {
  for (const mala of ['fuente', '.', '.fu ente', '.*', '..fuente']) {
    assert.throws(
      () => intocablesDe(conDelProyecto([{ extension: mala, why: 'un motivo escrito largo como corresponde' }])),
      /extensión/iu,
      mala,
    );
  }
});

test('FALSIFICACIÓN · un contrato sin universales, o ilegible, NO da una lista vacía: rechaza', () => {
  // Una lista vacía convertiría al limpiador en un barrido sin frenos. Es el mismo criterio que la
  // guarda de los prefijos: si no se puede construir, no se barre nada.
  for (const roto of [{ ...CONTRATO, universales: [] }, { ...CONTRATO, universales: 'no es una lista' }, null, 'texto', { schema: 'otra.cosa/1' }]) {
    assert.throws(() => intocablesDe(roto), /universal|contrato|schema/iu, JSON.stringify(roto));
  }
});

test('EL DATO: el contrato de este repositorio no nombra el stack de nadie', SOLO_FUENTE, () => {
  // Lo que se publica tiene que servirle a cualquiera sin contar a qué se dedica quien lo escribió.
  const real = JSON.parse(readFileSync(join(repoRoot, 'contracts', 'irreplaceable-sources.json'), 'utf8'));
  assert.ok(real.universales.length >= 3, 'tienen que estar los universales');
  assert.deepEqual(real.del_proyecto, [], 'el protocolo público no declara extensiones de ningún proyecto');
  const texto = JSON.stringify(real);
  for (const rastro of ['mq5', 'ex5', 'MetaTrader', 'MT5', 'SCalper']) {
    assert.doesNotMatch(texto, new RegExp(rastro, 'iu'), `el contrato público nombra ${rastro}`);
  }
});

test('un contrato sin del_proyecto, o con basura ahi, usa solo los universales', () => {
  // El campo es opcional: un proyecto que no declara nada propio es lo normal, y no puede reventar.
  for (const raro of [undefined, null, 'no es una lista', 42]) {
    const re = intocablesDe({ ...CONTRATO, del_proyecto: raro });
    assert.equal(re.test('clave.key'), true, String(raro));
    assert.equal(re.test('cualquiera.fuente'), false, String(raro));
  }
});

test('leerIntocables dice qué pasó cuando el contrato no se puede leer, en vez de reventar', () => {
  // Sin esa lista no se sabe qué no se borra, así que no se barre nada — y el mensaje tiene que
  // decir cuál archivo falta, no salir por una excepción de node:fs.
  assert.throws(
    () => leerIntocables('.', () => { throw new Error('ENOENT: no such file'); }, '/raiz/inventada'),
    /no se pudo leer .*irreplaceable-sources\.json/u,
  );
});

test('si lo que se tira no es un Error, el mensaje igual dice qué pasó', () => {
  // `throw 'texto'` es legal y no trae `message`. Sin este camino saldría «undefined», y un mensaje
  // que no dice nada es peor que la excepción cruda: parece que el gate contestó.
  assert.throws(
    () => leerIntocables('.', () => { throw 'el disco dijo que no'; }, '/raiz/inventada'),
    /el disco dijo que no/u,
  );
});

