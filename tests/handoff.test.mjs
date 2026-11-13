// handoff — antes de compactar la sesión escribe un resumen corto, y después de compactar el host
// se lo vuelve a mostrar. Compactar pierde datos: lo que no quedó en `.ia-stack/handoffs/ULTIMO.md`
// se puede perder. El archivo es chico a propósito (40 líneas, 6.000 caracteres): releerlo no gasta.
//
// LO QUE NO CUBRE: que la sesión escriba de verdad el handoff cuando el guard se lo ordena.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { ENCABEZADOS, checkHandoff, leerTopes } from '../scripts/handoff.mjs';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(raiz, 'scripts', 'handoff.mjs');
const TOPES = { archivo: '.ia-stack/handoffs/ULTIMO.md', max_lineas: 40, max_caracteres: 6000, max_horas: 24, antes_de_compactar: 0.6 };

const seccion = (titulo, cuerpo = 'algo') => `${titulo}\n${cuerpo}\n`;
const valido = (cambios = {}) => ENCABEZADOS.map((e) => seccion(e, cambios[e] ?? 'una línea')).join('\n');

function run(args, cwd = raiz) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env, cwd });
  assert.equal(r.error, undefined);
  return { status: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

function conProyecto(texto, cb) {
  const dir = mkdtempSync(join(tmpdir(), 'ia-handoff-'));
  try {
    const ruta = join(dir, '.ia-stack', 'handoffs', 'ULTIMO.md');
    mkdirSync(dirname(ruta), { recursive: true });
    if (texto !== null) writeFileSync(ruta, texto);
    cb(dir, ruta);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('el contrato trae contexto.handoff con sus cinco claves, y la plantilla pasa', () => {
  const c = JSON.parse(readFileSync(join(raiz, 'contracts', 'model-routing.json'), 'utf8')).contexto.handoff;
  assert.deepEqual(c, TOPES);
  assert.deepEqual(leerTopes(), TOPES);
  assert.deepEqual(ENCABEZADOS, ['## Objetivo', '## Decisiones', '## Archivos clave', '## Pendientes', '## Cómo retomar']);
  const plantilla = readFileSync(join(raiz, 'templates', 'estado', 'HANDOFF.md'), 'utf8');
  assert.equal(checkHandoff(plantilla, TOPES).ok, true);
});

test('leerTopes · un contrato sin contexto.handoff lanza', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ia-handoff-'));
  try {
    const ruta = join(dir, 'c.json');
    writeFileSync(ruta, JSON.stringify({ contexto: {} }));
    assert.throws(() => leerTopes(ruta), /contrato sin contexto\.handoff/u);
    writeFileSync(ruta, JSON.stringify({ contexto: { handoff: { ...TOPES, max_lineas: 'x' } } }));
    assert.throws(() => leerTopes(ruta), /contrato sin contexto\.handoff/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('check · válido pasa, también con título antes de ## Objetivo y con CRLF en 40 líneas', () => {
  assert.equal(checkHandoff(valido(), TOPES).ok, true);
  assert.equal(checkHandoff(`# Handoff\n\n${valido()}`, TOPES).ok, true);
  const cuarenta = `${valido()}${'relleno\n'.repeat(40 - valido().split('\n').length + 1)}`;
  assert.equal(cuarenta.split('\n').length - 1, 40);
  assert.equal(checkHandoff(cuarenta.replaceAll('\n', '\r\n'), TOPES).ok, true);
});

test('check · cada defecto da su motivo, en orden fijo', () => {
  assert.equal(checkHandoff(null, TOPES).reason, 'sin handoff');
  const sinPendientes = ENCABEZADOS.filter((e) => e !== '## Pendientes').map((e) => seccion(e)).join('\n');
  assert.equal(checkHandoff(sinPendientes, TOPES).reason, 'falta ## Pendientes');
  assert.equal(checkHandoff(`${valido()}\n## Extra\nx\n`, TOPES).reason, 'encabezado de más: ## Extra');
  assert.equal(checkHandoff(`${valido()}\n## Objetivo\nx\n`, TOPES).reason, 'encabezado de más: ## Objetivo');
  const desordenado = [ENCABEZADOS[1], ENCABEZADOS[0], ...ENCABEZADOS.slice(2)].map((e) => seccion(e)).join('\n');
  assert.equal(checkHandoff(desordenado, TOPES).reason, 'encabezado fuera de orden: ## Decisiones');
  assert.equal(checkHandoff(valido({ '## Decisiones': '   ' }), TOPES).reason, 'sección vacía: ## Decisiones');
  assert.equal(checkHandoff(valido({ '## Cómo retomar': '' }), TOPES).reason, 'sección vacía: ## Cómo retomar');
  const largo = `${valido()}${'relleno\n'.repeat(41 - valido().split('\n').length + 1)}`;
  assert.equal(checkHandoff(largo, TOPES).reason, '41 líneas: el máximo es 40');
  const gordo = valido({ '## Objetivo': 'x'.repeat(6001 - [...valido({ '## Objetivo': '' })].length) });
  assert.equal([...gordo].length, 6001);
  assert.equal(checkHandoff(gordo, TOPES).reason, '6001 caracteres: el máximo es 6000');
});

test('CLI check · 0 con uno válido, 1 con el motivo, 2 con mal uso', () => {
  conProyecto(valido(), (dir) => {
    const r = run(['check', '--proyecto', dir]);
    assert.equal(r.status, 0, r.output);
    assert.match(r.output, /^OK: handoff/u);
  });
  conProyecto(null, (dir) => {
    const r = run(['check', '--proyecto', dir]);
    assert.equal(r.status, 1);
    assert.match(r.output, /REJECTED: sin handoff/u);
  });
  for (const args of [[], ['otro'], ['check', '--raro'], ['check', '--proyecto']]) assert.equal(run(args).status, 2, args.join(' '));
});

test('CLI mostrar · imprime el handoff, sale 0 siempre, y encuentra el proyecto desde una subcarpeta', () => {
  conProyecto(valido(), (dir) => {
    const sub = join(dir, 'src', 'a');
    mkdirSync(sub, { recursive: true });
    const r = run(['mostrar', '--proyecto', dir], sub);
    assert.equal(r.status, 0);
    assert.ok(r.output.includes('## Cómo retomar'));
    assert.doesNotMatch(r.output, /handoff viejo/u);
    const cwd = run(['mostrar'], dir);
    assert.ok(cwd.output.includes('## Objetivo'), 'por defecto usa la carpeta actual');
  });
  conProyecto(null, (dir) => {
    const r = run(['mostrar', '--proyecto', dir]);
    assert.equal(r.status, 0);
    assert.match(r.output, /^handoff: sin handoff/u);
  });
  conProyecto('## Objetivo\nx\n', (dir) => {
    const r = run(['mostrar', '--proyecto', dir]);
    assert.equal(r.status, 0);
    assert.match(r.output, /^handoff: falta ## Decisiones/u);
  });
});

test('CLI mostrar · un handoff de hace 25 horas lleva primero el aviso de viejo', () => {
  const hace25 = new Date(Date.now() - 25 * 3600 * 1000);
  conProyecto(valido(), (dir, ruta) => {
    utimesSync(ruta, hace25, hace25);
    const r = run(['mostrar', '--proyecto', dir]);
    assert.equal(r.status, 0);
    assert.match(r.output, /^handoff viejo \(25 h\): verificalo antes de usarlo\n/u);
    assert.ok(r.output.includes('## Objetivo'));
  });
  conProyecto('roto\n', (dir, ruta) => {
    utimesSync(ruta, hace25, hace25);
    const r = run(['mostrar', '--proyecto', dir]);
    assert.equal(r.status, 0);
    assert.match(r.output, /^handoff viejo \(25 h\): verificalo antes de usarlo\nhandoff: falta ## Objetivo/u);
  });
});

test('SKILL.md nombra el archivo de handoff sin pasar de 120 líneas', () => {
  const t = readFileSync(join(raiz, 'SKILL.md'), 'utf8');
  assert.ok(t.includes('.ia-stack/handoffs/ULTIMO.md'));
  assert.ok(t.split(/\r?\n/u).length - 1 <= 120);
});
