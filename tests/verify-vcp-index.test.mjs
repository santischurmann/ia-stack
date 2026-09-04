// El índice propio: el mapa del repositorio sin depender de ninguna herramienta externa.
//
// Se midió antes de construirlo: ningún script del protocolo lee el CONTENIDO del grafo que la CLI
// externa generaba. Sólo le calculaban un hash o leían su manifiesto. O sea que lo que el protocolo
// de verdad usaba era saber qué archivos cubre — y eso son 26 KB de índice, no 375 KB de grafo.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  CLASES,
  DEFAULT_PATH,
  SCHEMA,
  USAGE,
  claseDe,
  comparar,
  construirIndice,
  main,
  parseArguments,
  rutasRastreadas,
  violaciones,
} from '../scripts/verify-vcp-index.mjs';

const indiceValido = (rutas = ['scripts/a.mjs', 'README.md']) => construirIndice(rutas);

test('la clase sale de la ubicación, no del nombre: el que clasifica es el árbol', () => {
  assert.equal(claseDe('scripts/verify-x.mjs'), 'gate');
  assert.equal(claseDe('contracts/x.json'), 'contrato');
  assert.equal(claseDe('tests/x.test.mjs'), 'prueba');
  assert.equal(claseDe('templates/x.md'), 'plantilla');
  assert.equal(claseDe('skills/x.md'), 'skill');
  assert.equal(claseDe('research/x.md'), 'evidencia');
  assert.equal(claseDe('docs/x.json'), 'evidencia');
  assert.equal(claseDe('.vibe/x.md'), 'evidencia');
  assert.equal(claseDe('README.md'), 'documento');
  assert.equal(claseDe('LICENSE'), 'otro');
  // Separadores de Windows: el mismo archivo no puede cambiar de clase según quién lo nombre.
  assert.equal(claseDe('scripts\\verify-x.mjs'), 'gate');
  // Toda clase que sale de acá tiene que estar declarada.
  for (const r of ['scripts/a', 'contracts/a', 'tests/a', 'templates/a', 'skills/a', 'docs/a', 'a.md', 'a']) {
    assert.ok(CLASES.includes(claseDe(r)), `clase no declarada para ${r}`);
  }
});

test('construirIndice ordena y clasifica todo lo que git rastrea', () => {
  const i = construirIndice(['b.md', 'scripts/a.mjs']);
  assert.equal(i.schema, SCHEMA);
  assert.deepEqual(i.entries.map((e) => e.path), ['b.md', 'scripts/a.mjs']);
  assert.deepEqual(i.entries.map((e) => e.class), ['documento', 'gate']);
  assert.deepEqual(i.excluded, []);
});

test('rutasRastreadas le pregunta a git y limpia lo que devuelve', () => {
  const correr = () => 'a.md\r\n  scripts/b.mjs  \n\n';
  assert.deepEqual(rutasRastreadas('/x', correr), ['a.md', 'scripts/b.mjs']);
});

test('comparar nombra lo que falta y lo que sobra, y respeta las exclusiones', () => {
  const i = { entries: [{ path: 'a.md', class: 'documento' }], excluded: [{ path: 'c.md', why: 'motivo suficientemente largo' }] };
  const r = comparar(i, ['a.md', 'b.md', 'c.md']);
  assert.deepEqual(r.faltantes, ['b.md']);
  assert.deepEqual(r.sobrantes, []);
  assert.equal(r.comparadas, 1);
});

test('FALSIFICACIÓN · una entrada que git ya no rastrea es contabilidad rancia y se nombra', () => {
  const i = { entries: [{ path: 'a.md', class: 'documento' }, { path: 'se-fue.md', class: 'documento' }] };
  assert.deepEqual(comparar(i, ['a.md']).sobrantes, ['se-fue.md']);
});

test('FALSIFICACIÓN · un índice mal formado se rechaza campo por campo', () => {
  assert.match(violaciones(null)[0], /objeto con schema/u);
  assert.match(violaciones([])[0], /objeto con schema/u);
  assert.match(violaciones({ ...indiceValido(), schema: 'otro/1' }).join(' '), /debe declarar schema/u);
  assert.match(violaciones({ ...indiceValido(), why: 'corto' }).join(' '), /`why` escrito/u);
  assert.match(violaciones({ ...indiceValido(), entries: [] }).join(' '), /ninguna entrada/u);
  assert.match(violaciones({ ...indiceValido(), entries: [{ class: 'gate' }] }).join(' '), /falta la ruta/u);
  assert.match(violaciones({ ...indiceValido(), entries: [{ path: 'a', class: 'inventada' }] }).join(' '), /no está entre las declaradas/u);
  assert.match(violaciones({ ...indiceValido(), excluded: [{ why: 'x'.repeat(30) }] }).join(' '), /falta la ruta/u);
  assert.match(violaciones({ ...indiceValido(), excluded: [{ path: 'a', why: 'corto' }] }).join(' '), /sin motivo escrito es un agujero/u);
  assert.deepEqual(violaciones(indiceValido()), []);
});

test('parseArguments acepta check y record, con ruta opcional, y rechaza el resto', () => {
  assert.deepEqual(parseArguments(['check']), { accion: 'check', ruta: DEFAULT_PATH });
  assert.deepEqual(parseArguments(['record', 'otro.json']), { accion: 'record', ruta: 'otro.json' });
  assert.equal(parseArguments([]), null);
  assert.equal(parseArguments(['otra-cosa']), null);
  assert.equal(parseArguments(['check', 'a', 'b']), null);
});

function correrMain(args, opciones = {}) {
  const salidas = [];
  const errores = [];
  const codigo = main(args, opciones.cwd ?? '.', (m) => salidas.push(m), (m) => errores.push(m), opciones.io ?? {});
  return { codigo, salidas, errores };
}

test('main sin argumentos válidos imprime el uso y sale 2', () => {
  const r = correrMain([]);
  assert.equal(r.codigo, 2);
  assert.deepEqual(r.errores, [USAGE]);
});

test('main dice VACÍO cuando git no rastrea nada: no hay con qué comparar', () => {
  const r = correrMain(['check'], { io: { correr: () => '' } });
  assert.equal(r.codigo, 0);
  assert.match(r.salidas.join(' '), /^VACÍO:/u);
});

test('main rechaza sin inventar un verde cuando no puede preguntarle a git', () => {
  const r = correrMain(['check'], { io: { correr: () => { throw new Error('not a git repository'); } } });
  assert.equal(r.codigo, 1);
  assert.match(r.errores.join(' '), /no se pudo preguntarle a git/u);
});

test('record escribe el índice y check lo acepta', () => {
  let escrito = null;
  const io = { correr: () => 'a.md\nscripts/b.mjs\n', escribir: (_, texto) => { escrito = texto; } };
  const r = correrMain(['record'], { io });
  assert.equal(r.codigo, 0);
  assert.match(r.salidas.join(' '), /inventaría 2 archivo/u);

  const leido = correrMain(['check'], { io: { ...io, read: () => escrito } });
  assert.equal(leido.codigo, 0, leido.errores.join(' '));
  assert.match(leido.salidas.join(' '), /cubre 2 archivo/u);
  assert.match(leido.salidas.join(' '), /LÍMITE:/u);
});

test('FALSIFICACIÓN · check rechaza un índice ilegible, uno mal formado y uno desactualizado', () => {
  const correr = () => 'a.md\nb.md\n';
  const ilegible = correrMain(['check'], { io: { correr, read: () => { throw new Error('ENOENT'); } } });
  assert.equal(ilegible.codigo, 1);
  assert.match(ilegible.errores.join(' '), /generalo con/u);

  const roto = correrMain(['check'], { io: { correr, read: () => '{"schema":"otro/1"}' } });
  assert.equal(roto.codigo, 1);
  assert.match(roto.errores.join(' '), /debe declarar schema/u);

  const viejo = correrMain(['check'], { io: { correr, read: () => JSON.stringify(construirIndice(['a.md'])) } });
  assert.equal(viejo.codigo, 1);
  assert.match(viejo.errores.join(' '), /no declara ni excluye: b\.md/u);

  const sobra = correrMain(['check'], { io: { correr: () => 'a.md\n', read: () => JSON.stringify(construirIndice(['a.md', 'se-fue.md'])) } });
  assert.equal(sobra.codigo, 1);
  assert.match(sobra.errores.join(' '), /git ya no rastrea: se-fue\.md/u);
});

test('el mensaje recorta la lista larga y dice cuántas quedaron afuera', () => {
  // El índice tiene que ser VÁLIDO para llegar a la comparación: uno vacío se rechaza antes, por
  // forma, y la rama del recorte nunca se ejecutaría.
  const muchas = ['base.md', ...Array.from({ length: 14 }, (_, i) => `f${String(i).padStart(2, '0')}.md`)];
  const r = correrMain(['check'], { io: { correr: () => muchas.join('\n'), read: () => JSON.stringify(construirIndice(['base.md'])) } });
  assert.equal(r.codigo, 1);
  assert.match(r.errores.join(' '), /\(\+4\)/u);
});

test('comparar tolera un índice sin entradas y uno sin exclusiones', () => {
  // Las dos ramas del `??`: `entries` ausente y `excluded` ausente. Un índice sin `entries` lo
  // rechaza `violaciones` antes, pero `comparar` es una función pura y tiene que aguantarlo sola.
  assert.deepEqual(comparar({}, ['a.md']).faltantes, ['a.md']);
  assert.deepEqual(comparar({}, []).sobrantes, []);
});

test('comparar tolera un índice sin lista de exclusiones', () => {
  // `excluded` es opcional: un índice recién generado no tiene ninguna, y pedirla obligaría a
  // escribir una lista vacía en cada proyecto para nada.
  const r = comparar({ entries: [{ path: 'a.md', class: 'documento' }] }, ['a.md', 'b.md']);
  assert.deepEqual(r.faltantes, ['b.md']);
});

test('la lista de sobrantes también se recorta y dice cuántas quedaron', () => {
  const indice = construirIndice(['vive.md', ...Array.from({ length: 13 }, (_, i) => `fue${i}.md`)]);
  const salidas = [];
  const errores = [];
  const codigo = main(['check'], '.', (m) => salidas.push(m), (m) => errores.push(m), {
    correr: () => 'vive.md\n',
    read: () => JSON.stringify(indice),
  });
  assert.equal(codigo, 1);
  assert.match(errores.join(' '), /git ya no rastrea/u);
  assert.match(errores.join(' '), /\(\+3\)/u);
});

test('sin io inyectado usa el disco real: record escribe y check lo lee', () => {
  // Cubre los lectores y escritores por defecto, que las demás pruebas reemplazan. Corre sobre un
  // repositorio de juguete, nunca sobre el checkout real.
  const raiz = mkdtempSync(join(tmpdir(), 'vcp-index-'));
  try {
    const git = (...args) => execFileSync('git', args, { cwd: raiz, encoding: 'utf8' });
    git('init', '-q');
    git('config', 'user.email', 't@t');
    git('config', 'user.name', 't');
    writeFileSync(join(raiz, 'a.md'), 'hola\n');
    git('add', '-A');
    git('commit', '-qm', 'inicial');
    mkdirSync(join(raiz, 'contracts'), { recursive: true });

    const salidas = [];
    assert.equal(main(['record'], raiz, (m) => salidas.push(m), () => {}), 0);
    assert.equal(main(['check'], raiz, (m) => salidas.push(m), (m) => salidas.push(m)), 0, salidas.join(' | '));
    assert.match(salidas.join(' '), /cubre 1 archivo/u);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});
