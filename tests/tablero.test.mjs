// El CLI del tablero. Todo se prueba con `io` inyectado: ninguna prueba toca el `~/.claude` real.
//
// La prueba que importa es la primera: el generador tiene que NEGARSE a escribir adentro de un
// repositorio, y dejar el directorio vacío. El primer diseño escribía su salida dentro del repo con
// datos agregados de todos los proyectos de la máquina, y el gate de seguridad daba VERDE sobre esa
// fuga. Por eso la regla es mecánica y no una convención.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';

import {
  DESTINO_EN_REPO,
  USAGE,
  construirModelo,
  destinoPorDefecto,
  diasEntre,
  leerRegistros,
  main,
  parseArguments,
  estadoDelProyecto,
  rutaDeProyecto,
  proyectosEn,
  repositorioQueContiene,
  sesionesDe,
} from '../scripts/tablero.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};

function correr(args, io = {}) {
  const salidas = [];
  const errores = [];
  const codigo = main(args, (m) => salidas.push(m), (m) => errores.push(m), io);
  return { codigo, salidas, errores };
}

const turno = (id, salida, ts) => JSON.stringify({
  type: 'assistant', timestamp: ts, message: { id, model: 'm', usage: { output_tokens: salida } },
});

test('LA NEGATIVA · el generador rechaza un destino adentro de un repositorio y no escribe nada', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'vcp-tablero-repo-'));
  try {
    mkdirSync(join(raiz, '.git'));
    const destino = join(raiz, 'sub', 'carpeta');
    let escribio = false;
    const r = correr(['build', '--out', destino], {
      escribir: () => { escribio = true; },
      crear: () => { escribio = true; },
    });
    assert.equal(r.codigo, 1);
    assert.match(r.errores.join(' '), new RegExp(DESTINO_EN_REPO, 'u'));
    assert.equal(escribio, false, 'no puede crear ni escribir un solo archivo antes de rechazar');
    assert.equal(existsSync(destino), false);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('repositorioQueContiene sube hasta la raíz y devuelve null si no hay ninguno', () => {
  const conGit = (p) => String(p).replaceAll('\\', '/').endsWith('/proy/.git');
  assert.match(repositorioQueContiene(join('C:', 'x', 'proy', 'a', 'b'), conGit).replaceAll('\\', '/'), /proy$/u);
  assert.equal(repositorioQueContiene(join('C:', 'x', 'suelto'), () => false), null);
});

test('el destino por defecto sale del sistema y nunca del proyecto', () => {
  assert.match(destinoPorDefecto({ LOCALAPPDATA: 'C:/L' }, 'C:/casa', 'win32').replaceAll('\\', '/'), /^C:\/L\/ia-stack$/u);
  assert.match(destinoPorDefecto({}, 'C:/casa', 'win32').replaceAll('\\', '/'), /AppData\/Local\/ia-stack$/u);
  assert.match(destinoPorDefecto({ XDG_STATE_HOME: '/s' }, '/casa', 'linux').replaceAll('\\', '/'), /^\/s\/ia-stack$/u);
  assert.match(destinoPorDefecto({}, '/casa', 'linux').replaceAll('\\', '/'), /\/casa\/\.local\/state\/ia-stack$/u);
});

test('parseArguments acepta build y due con sus banderas, y rechaza el resto', () => {
  assert.deepEqual(parseArguments(['build']), { accion: 'build', out: null });
  assert.deepEqual(parseArguments(['build', '--out', '/x']), { accion: 'build', out: '/x' });
  assert.deepEqual(parseArguments(['due']), { accion: 'due', hoy: null });
  assert.deepEqual(parseArguments(['due', '--today', '2026-09-04']), { accion: 'due', hoy: '2026-09-04' });
  assert.equal(parseArguments([]), null);
  assert.equal(parseArguments(['build', '--otra', 'x']), null);
  assert.equal(parseArguments(['due', 'x']), null);
  assert.equal(parseArguments(['inventado']), null);
});

test('leerRegistros tolera una línea incompleta sin perder el resto del archivo', () => {
  // Una sesión viva deja la última línea a medio escribir. Tirar el archivo entero por eso sería
  // perder todo lo anterior.
  const texto = [turno('a', 1, '2026-09-01T10:00:00.000Z'), '{"roto":', '', turno('b', 2, '2026-09-01T10:01:00.000Z')].join('\n');
  const r = leerRegistros(texto);
  assert.equal(r.length, 2);
  assert.equal(r[1].message.id, 'b');
});

test('proyectosEn y sesionesDe listan sólo lo que corresponde', () => {
  const listar = (_, opts) => (opts?.withFileTypes
    ? [{ name: 'proy-b', isDirectory: () => true }, { name: 'proy-a', isDirectory: () => true }, { name: 'suelto.txt', isDirectory: () => false }]
    : ['b.jsonl', 'a.jsonl', 'notas.md']);
  assert.deepEqual(proyectosEn('/x', { hay: () => true, listar }), ['proy-a', 'proy-b']);
  assert.deepEqual(sesionesDe('/x', { listar }), ['a.jsonl', 'b.jsonl']);
  assert.deepEqual(proyectosEn('/x', { hay: () => false, listar }), []);
});

test('construirModelo agrega por proyecto y deja afuera los que no tienen turnos', () => {
  const archivos = {
    '/p/uno/s1.jsonl': [turno('a', 100, '2026-09-01T10:00:00.000Z'), turno('a', 100, '2026-09-01T10:00:01.000Z')].join('\n'),
    '/p/dos/s1.jsonl': '{"type":"user"}',
  };
  const io = {
    hay: () => true,
    listar: (dir, opts) => (opts?.withFileTypes
      ? [{ name: 'uno', isDirectory: () => true }, { name: 'dos', isDirectory: () => true }]
      : ['s1.jsonl']),
    leer: (ruta) => archivos[String(ruta).replaceAll('\\', '/')] ?? '',
    hoy: '2026-09-04',
  };
  const m = construirModelo('/p', io);
  assert.equal(m.proyectos.length, 1, 'un proyecto sin turnos no ocupa una fila');
  assert.equal(m.proyectos[0].turnos, 1, 'dos líneas del mismo mensaje son un turno');
  assert.equal(m.proyectos[0].tokens.salida, 100);
  assert.equal(m.generadoEn, '2026-09-04');
});

test('construirModelo cuenta una sesión ilegible sin romperse', () => {
  const io = {
    hay: () => true,
    listar: (dir, opts) => (opts?.withFileTypes ? [{ name: 'uno', isDirectory: () => true }] : ['rota.jsonl', 'buena.jsonl']),
    leer: (ruta) => { if (String(ruta).includes('rota')) throw new Error('EACCES'); return turno('a', 5, '2026-09-01T10:00:00.000Z'); },
  };
  const m = construirModelo('/p', io);
  assert.equal(m.proyectos[0].sesiones, 2);
  assert.equal(m.proyectos[0].tokens.salida, 5);
});

test('main sin argumentos válidos imprime el uso y sale 2', () => {
  const r = correr([]);
  assert.equal(r.codigo, 2);
  assert.deepEqual(r.errores, [USAGE]);
});

test('build dice VACÍO cuando no hay transcripciones, en vez de inventar una página', () => {
  // `hay` tiene que decir NO al `.git` también: si no, la búsqueda de repositorio contenedor cree
  // que todo destino está adentro de uno y el rechazo tapa lo que esta prueba quiere medir.
  const r = correr(['build', '--out', join(tmpdir(), 'vcp-no-existe')], { hay: (p) => !String(p).includes('.claude') && !String(p).includes('.git'), casa: '/casa' });
  assert.equal(r.codigo, 0);
  assert.match(r.salidas.join(' '), /^VACÍO:/u);
});

test('build dice VACÍO cuando hay transcripciones pero ningún turno', () => {
  const r = correr(['build', '--out', '/salida'], {
    casa: '/casa',
    hay: (p) => !String(p).includes('.git'),
    listar: (dir, opts) => (opts?.withFileTypes ? [{ name: 'p', isDirectory: () => true }] : ['s.jsonl']),
    leer: () => '{"type":"user"}',
  });
  assert.equal(r.codigo, 0);
  assert.match(r.salidas.join(' '), /ningún turno/u);
});

test('build escribe la página y la marca de fecha, y dice dónde quedó', () => {
  const escrito = new Map();
  let creado = null;
  const r = correr(['build', '--out', '/salida'], {
    casa: '/casa',
    hay: (p) => !String(p).includes('.git') && !String(p).includes('precios.json'),
    listar: (dir, opts) => (opts?.withFileTypes ? [{ name: 'p', isDirectory: () => true }] : ['s.jsonl']),
    leer: () => turno('a', 42, '2026-09-01T10:00:00.000Z'),
    crear: (d) => { creado = d; },
    escribir: (ruta, texto) => escrito.set(String(ruta).replaceAll('\\', '/'), texto),
    hoy: '2026-09-04',
  });
  assert.equal(r.codigo, 0, r.errores.join(' '));
  assert.equal(creado, '/salida');
  assert.match([...escrito.keys()].join(' '), /tablero\.html/u);
  assert.match([...escrito.keys()].join(' '), /ultimo-build\.txt/u);
  assert.match(escrito.get('/salida/tablero.html'), /No se muestra dinero/u);
  assert.equal(escrito.get('/salida/ultimo-build.txt'), '2026-09-04\n');
  assert.match(r.salidas.join(' '), /1 proyecto/u);
});

test('build usa la tabla de precios si existe, y la ignora si está rota', () => {
  const base = {
    casa: '/casa',
    listar: (dir, opts) => (opts?.withFileTypes ? [{ name: 'p', isDirectory: () => true }] : ['s.jsonl']),
    crear: () => {},
    hoy: '2026-09-04',
  };
  const conPrecios = new Map();
  correr(['build', '--out', '/salida'], {
    ...base,
    hay: (p) => !String(p).includes('.git'),
    leer: (ruta) => (String(ruta).includes('precios.json') ? '{"salida": 15}' : turno('a', 1_000_000, '2026-09-01T10:00:00.000Z')),
    escribir: (ruta, texto) => conPrecios.set(String(ruta).replaceAll('\\', '/'), texto),
  });
  assert.match(conPrecios.get('/salida/tablero.html'), /\$15/u);

  const rota = new Map();
  correr(['build', '--out', '/salida'], {
    ...base,
    hay: (p) => !String(p).includes('.git'),
    leer: (ruta) => (String(ruta).includes('precios.json') ? 'no es json' : turno('a', 1, '2026-09-01T10:00:00.000Z')),
    escribir: (ruta, texto) => rota.set(String(ruta).replaceAll('\\', '/'), texto),
  });
  assert.match(rota.get('/salida/tablero.html'), /No se muestra dinero/u, 'una tabla ilegible no se adivina: se ignora');
});

test('diasEntre cuenta en UTC puro y devuelve null si la fecha no es una fecha', () => {
  assert.equal(diasEntre('2026-09-01', '2026-09-08'), 7);
  assert.equal(diasEntre('2026-09-01', '2026-09-01'), 0);
  assert.equal(diasEntre('ayer', '2026-09-08'), null);
  assert.equal(diasEntre('2026-09-01', 'manana'), null);
});

test('due dice si toca, sin escribir nunca nada', () => {
  const nunca = () => { throw new Error('due no puede escribir'); };
  const vacio = correr(['due', '--today', '2026-09-08'], { casa: '/casa', hay: () => false, escribir: nunca, crear: nunca });
  assert.equal(vacio.codigo, 0);
  assert.match(vacio.salidas.join(' '), /^VACÍO:/u);

  const toca = correr(['due', '--today', '2026-09-12'], { casa: '/casa', hay: () => true, leer: () => '2026-09-04\n', escribir: nunca, crear: nunca });
  assert.match(toca.salidas.join(' '), /^TOCA:/u);

  const noToca = correr(['due', '--today', '2026-09-06'], { casa: '/casa', hay: () => true, leer: () => '2026-09-04\n', escribir: nunca, crear: nunca });
  assert.match(noToca.salidas.join(' '), /^OK:/u);

  const ilegible = correr(['due'], { casa: '/casa', hay: () => true, leer: () => { throw new Error('EACCES'); }, escribir: nunca, crear: nunca });
  assert.match(ilegible.salidas.join(' '), /no se pudo leer la marca/u);

  const basura = correr(['due', '--today', '2026-09-06'], { casa: '/casa', hay: () => true, leer: () => 'ayer', escribir: nunca, crear: nunca });
  assert.match(basura.salidas.join(' '), /no es una fecha/u);
});

test('NADA DE ESTO ENTRA AL REPOSITORIO · el destino por defecto cae fuera de cualquier proyecto', () => {
  // No alcanza con que el código lo diga: se comprueba que la ruta resuelta no esté adentro del
  // checkout de VCP, que es el repositorio más a mano para equivocarse.
  const destino = destinoPorDefecto(process.env, process.env.HOME ?? 'C:/casa', process.platform);
  const repo = repositorioQueContiene(destino);
  assert.equal(repo, null, `el destino por defecto cae adentro del repositorio ${repo}`);
});

test('los proyectos salen ordenados por tokens, de mayor a menor', () => {
  // Cubre el comparador del sort, que ninguna otra prueba ejercita con dos proyectos con turnos.
  const io = {
    hay: () => true,
    listar: (dir, opts) => (opts?.withFileTypes
      ? [{ name: 'chico', isDirectory: () => true }, { name: 'grande', isDirectory: () => true }]
      : ['s.jsonl']),
    leer: (ruta) => (String(ruta).includes('grande')
      ? turno('g', 900, '2026-09-01T10:00:00.000Z')
      : turno('c', 10, '2026-09-01T10:00:00.000Z')),
  };
  const m = construirModelo('/p', io);
  assert.deepEqual(m.proyectos.map((p) => p.nombre), ['grande', 'chico']);
});

test('NINGÚN DATO DE SESIÓN ENTRA AL REPOSITORIO', SOLO_FUENTE, () => {
  // No alcanza con que el generador se niegue a escribir adentro: hay que comprobar que no haya
  // entrado nada por otra vía. Se busca por FORMA acotada —campos del esquema de transcripción y
  // el patrón de los slugs de proyecto—, no por «64 hexadecimales», porque `.vibe/AUDIT.md` tiene
  // 120 sellos sha256 legítimos y marcarlos sería un guarda que grita en falso.
  const versionados = spawnSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
    .stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  assert.ok(versionados.length > 100, 'git ls-files no devolvió el repositorio: la comprobación no midió nada');
  const HUELLAS = [
    'cache_read_input_tokens',
    'cache_creation_input_tokens',
    'C--Users-',
  ];
  const culpables = [];
  for (const ruta of versionados) {
    if (ruta.startsWith('tests/') || ruta.startsWith('scripts/')) continue; // acá se nombran a propósito
    let texto;
    try { texto = readFileSync(join(repoRoot, ruta), 'utf8'); } catch { continue; }
    for (const h of HUELLAS) if (texto.includes(h)) culpables.push(`${ruta}: ${h}`);
  }
  assert.deepEqual(culpables, [], 'entró al repositorio algo con forma de dato de sesión');
});

// --- Del slug de la carpeta a la ruta real del proyecto -----------------------------------------
//
// El agente guarda cada proyecto en una carpeta cuyo nombre es el `cwd` con los separadores
// reemplazados por guiones. Para mostrar en qué fase quedó cada uno hay que volver del slug a la
// ruta — y ahí hay una ambigüedad que NO se puede resolver adivinando: un proyecto llamado
// `ia-stack` produce el mismo slug que uno que viviera en `ia/stack`.
//
// Por eso la reconstrucción se VERIFICA contra el disco: se prueba la interpretación directa y, si
// esa carpeta no existe, se devuelve null. Un proyecto sin ruta resuelta aparece en el tablero con
// sus tokens y sus horas —que salen de la transcripción y no dependen de esto— pero sin estado de
// fases. Nunca con el estado de OTRO proyecto, que es el único error que importaría.

test('rutaDeProyecto reconstruye la ruta y la comprueba contra el disco', () => {
  const existentes = new Set(['C:/Users/Santi/Desktop/Claude/VibeCodeProtocols']);
  const hay = (r) => existentes.has(String(r).split(String.fromCharCode(92)).join('/'));
  assert.equal(rutaDeProyecto('C--Users-Santi-Desktop-Claude-VibeCodeProtocols', hay), 'C:/Users/Santi/Desktop/Claude/VibeCodeProtocols');
});

test('FALSIFICACIÓN · un slug ambiguo devuelve null en vez de la carpeta equivocada', () => {
  // `mi-proyecto` y `mi/proyecto` colapsan al mismo slug. Si la interpretación directa no existe en
  // el disco, no se inventa: null. Mostrar el estado de otro proyecto sería peor que no mostrar nada.
  assert.equal(rutaDeProyecto('C--Users-Santi-ia-stack', () => false), null);
  assert.equal(rutaDeProyecto('no-empieza-con-unidad', () => true), null);
  assert.equal(rutaDeProyecto('', () => true), null);
});

test('estadoDelProyecto lee lo que el proyecto declara, y tolera que no declare nada', () => {
  // Sin ruta resuelta no se afirma nada: ni fases, ni mejoras, ni sesión. Es el caso de un proyecto
  // cuyo slug es ambiguo, y decir "sin datos" es lo correcto frente a mostrar los de otro.
  const sinRuta = estadoDelProyecto(null);
  assert.equal(sinRuta.fases.completo, false);
  assert.equal(sinRuta.mejoras.total, 0);
  assert.deepEqual(sinRuta.sesion, { feature: null, estado: null });

  const archivos = {
    'docs/phase-decisions.json': JSON.stringify({ phase_order: ['1', '2'], decisions: [{ phase_id: '1', status: 'decided' }] }),
    'docs/mejoras/2026-09-05.json': JSON.stringify({ propuestas: [1, 2, 3] }),
    'docs/mejoras/roto.json': 'no es json',
    '.vibe/SESSION.md': '**Feature slug:** una-feature\n**Status:** en progreso\n',
  };
  const norm = (r) => String(r).split(String.fromCharCode(92)).join('/').replace('/proy/', '');
  const io = {
    hay: (r) => norm(r).endsWith('docs/mejoras'),
    listar: () => ['2026-09-05.json', 'roto.json', 'notas.md'],
    leer: (r) => { const k = norm(r); if (k in archivos) return archivos[k]; throw new Error('ENOENT'); },
  };
  const e = estadoDelProyecto('/proy', io);
  assert.equal(e.fases.ultima, '1');
  assert.deepEqual(e.fases.faltan, ['2']);
  // El JSON roto se descarta sin tumbar la lectura; `notas.md` ni siquiera se mira.
  assert.equal(e.mejoras.total, 1);
  assert.equal(e.mejoras.propuestas, 3);
  assert.deepEqual(e.sesion, { feature: 'una-feature', estado: 'en progreso' });
});

test('estadoDelProyecto sigue de largo si la carpeta de mejoras no se puede listar', () => {
  const io = {
    hay: () => true,
    listar: () => { throw new Error('EACCES'); },
    leer: () => { throw new Error('ENOENT'); },
  };
  const e = estadoDelProyecto('/proy', io);
  assert.equal(e.mejoras.total, 0, 'un permiso raro no es una ronda de mejoras');
});
