// El bucle de auto-mejora y su gate.
//
// El script NO genera las propuestas: las escribe el agente, que es el único que leyó la sesión.
// Esto verifica el REGISTRO, igual que `verify-ablation` verifica el registro de una ablación y no
// la ablación. La diferencia importa: un gate que generara las propuestas estaría juzgando su
// propio trabajo.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';
import {
  CAMPOS_EJECUTABLES,
  MAX_PROPUESTAS,
  SCHEMA,
  USAGE,
  diasEntre,
  main,
  parseArguments,
  ultimoRegistro,
  violaciones,
} from '../scripts/verify-sereno.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};

const ARCHIVO = 'origen.md';
const TEXTO = 'la frase exacta que respalda esta propuesta';
const leer = (ruta) => (ruta === ARCHIVO ? `bla bla ${TEXTO} bla bla` : (() => { throw new Error('ENOENT'); })());

const propuesta = (over = {}) => ({
  titulo: 'Un título suficientemente largo',
  por_que: 'Un motivo escrito de más de treinta caracteres, que es el mínimo.',
  cita: { archivo: ARCHIVO, texto_literal: TEXTO },
  ...over,
});
const registro = (over = {}) => ({ schema: SCHEMA, run_id: '2026-09-04', propuestas: [propuesta()], ...over });

test('un registro bien formado, con su cita resuelta, pasa', () => {
  assert.deepEqual(violaciones(registro(), leer, '2026-09-10'), []);
});

test('FALSIFICACIÓN · más de cuatro propuestas se rechaza: el tope ES la feature', () => {
  // Una lista de veinte no se lee, se archiva. Que sean pocas es lo que las hace accionables.
  const muchas = registro({ propuestas: Array.from({ length: MAX_PROPUESTAS + 1 }, () => propuesta()) });
  assert.match(violaciones(muchas, leer, '2026-09-10').join(' '), new RegExp(`el tope es ${MAX_PROPUESTAS}`, 'u'));
  // Justo en el tope pasa.
  assert.deepEqual(violaciones(registro({ propuestas: Array.from({ length: MAX_PROPUESTAS }, () => propuesta()) }), leer, '2026-09-10'), []);
});

test('FALSIFICACIÓN · una cita que no resuelve es peor que ninguna, y se rechaza', () => {
  const inventada = registro({ propuestas: [propuesta({ cita: { archivo: ARCHIVO, texto_literal: 'esto no está en el archivo' } })] });
  assert.match(violaciones(inventada, leer, '2026-09-10').join(' '), /no está en origen\.md/u);

  const archivoAusente = registro({ propuestas: [propuesta({ cita: { archivo: 'no-existe.md', texto_literal: TEXTO } })] });
  assert.match(violaciones(archivoAusente, leer, '2026-09-10').join(' '), /no se pudo leer/u);
});

test('FALSIFICACIÓN · cualquier campo ejecutable se rechaza: el bucle sugiere, nunca corre', () => {
  for (const campo of CAMPOS_EJECUTABLES) {
    const con = registro({ propuestas: [propuesta({ [campo]: 'rm -rf algo' })] });
    assert.match(violaciones(con, leer, '2026-09-10').join(' '), new RegExp(`trae un campo .${campo}`, 'u'), `${campo} tiene que rechazar`);
  }
});

test('FALSIFICACIÓN · una propuesta sin origen, sin título o sin motivo se rechaza', () => {
  assert.match(violaciones(registro({ propuestas: [propuesta({ cita: undefined })] }), leer, '2026-09-10').join(' '), /sin cita no hay origen/u);
  assert.match(violaciones(registro({ propuestas: [propuesta({ cita: { texto_literal: TEXTO } })] }), leer, '2026-09-10').join(' '), /no dice de qué archivo/u);
  assert.match(violaciones(registro({ propuestas: [propuesta({ cita: { archivo: ARCHIVO, texto_literal: 'corto' } })] }), leer, '2026-09-10').join(' '), /el texto literal/u);
  assert.match(violaciones(registro({ propuestas: [propuesta({ titulo: 'ah' })] }), leer, '2026-09-10').join(' '), /título escrito/u);
  assert.match(violaciones(registro({ propuestas: [propuesta({ por_que: 'poco' })] }), leer, '2026-09-10').join(' '), /por qué/u);
});

test('FALSIFICACIÓN · el registro mal formado, sin fecha o en el futuro se rechaza', () => {
  assert.match(violaciones(null, leer, '2026-09-10')[0], /objeto con schema/u);
  assert.match(violaciones([], leer, '2026-09-10')[0], /objeto con schema/u);
  assert.match(violaciones(registro({ schema: 'otro/1' }), leer, '2026-09-10').join(' '), /debe declarar schema/u);
  assert.match(violaciones(registro({ run_id: 'ayer' }), leer, '2026-09-10').join(' '), /una fecha AAAA-MM-DD/u);
  assert.match(violaciones(registro({ run_id: '2026-12-01' }), leer, '2026-09-10').join(' '), /está en el futuro/u);
  assert.match(violaciones(registro({ propuestas: 'no es lista' }), leer, '2026-09-10').join(' '), /lista de propuestas/u);
  // Sin `hoy` no se juzga la fecha contra nada: no se puede verificar, así que no se acusa.
  assert.deepEqual(violaciones(registro({ run_id: '2099-01-01' }), leer), []);
});

test('parseArguments acepta check y due con sus banderas, y rechaza el resto', () => {
  assert.deepEqual(parseArguments(['check', 'x.json']), { accion: 'check', ruta: 'x.json' });
  assert.deepEqual(parseArguments(['due']), { accion: 'due', hoy: null, dir: 'docs/mejoras' });
  assert.deepEqual(parseArguments(['due', '--today', '2026-09-04']), { accion: 'due', hoy: '2026-09-04', dir: 'docs/mejoras' });
  assert.deepEqual(parseArguments(['due', '--dir', 'otra']), { accion: 'due', hoy: null, dir: 'otra' });
  assert.equal(parseArguments([]), null);
  assert.equal(parseArguments(['check']), null);
  assert.equal(parseArguments(['due', '--raro', 'x']), null);
  assert.equal(parseArguments(['inventado']), null);
});

test('ultimoRegistro ordena por fecha y descarta lo que no es una', () => {
  assert.equal(ultimoRegistro(['2026-09-04.json', '2026-08-01.json', 'notas.md']), '2026-09-04.json');
  assert.equal(ultimoRegistro(['notas.md']), null);
  assert.equal(ultimoRegistro([]), null);
});

test('diasEntre cuenta en UTC y devuelve null si no es una fecha', () => {
  assert.equal(diasEntre('2026-09-04', '2026-09-11'), 7);
  assert.equal(diasEntre('ayer', '2026-09-11'), null);
});

function correr(args, io = {}) {
  const salidas = [];
  const errores = [];
  const codigo = main(args, '.', (m) => salidas.push(m), (m) => errores.push(m), io);
  return { codigo, salidas, errores };
}

test('main sin argumentos válidos imprime el uso y sale 2', () => {
  const r = correr([]);
  assert.equal(r.codigo, 2);
  assert.deepEqual(r.errores, [USAGE]);
});

test('due dice si toca y NUNCA escribe', () => {
  const vacio = correr(['due'], { hay: () => false });
  assert.equal(vacio.codigo, 0);
  assert.match(vacio.salidas.join(' '), /^VACÍO:/u);

  const sinFechas = correr(['due'], { hay: () => true, listar: () => ['notas.md'] });
  assert.match(sinFechas.salidas.join(' '), /ningún registro con nombre de fecha/u);

  const toca = correr(['due', '--today', '2026-09-20'], { hay: () => true, listar: () => ['2026-09-04.json'] });
  assert.match(toca.salidas.join(' '), /^TOCA:/u);

  const noToca = correr(['due', '--today', '2026-09-06'], { hay: () => true, listar: () => ['2026-09-04.json'] });
  assert.match(noToca.salidas.join(' '), /^OK:/u);
});

test('check acepta un registro válido y rechaza uno ilegible', () => {
  const ok = correr(['check', 'r.json'], { leer: (p) => (p === 'r.json' ? JSON.stringify(registro()) : leer(p)), hoy: '2026-09-10' });
  assert.equal(ok.codigo, 0, ok.errores.join(' '));
  assert.match(ok.salidas.join(' '), /4|1 propuesta/u);
  assert.match(ok.salidas.join(' '), /LÍMITE:/u);

  const roto = correr(['check', 'r.json'], { leer: () => { throw new Error('ENOENT'); } });
  assert.equal(roto.codigo, 1);
  assert.match(roto.errores.join(' '), /no se pudo leer el registro/u);

  const invalido = correr(['check', 'r.json'], { leer: (p) => (p === 'r.json' ? JSON.stringify(registro({ schema: 'x' })) : leer(p)), hoy: '2026-09-10' });
  assert.equal(invalido.codigo, 1);
  assert.match(invalido.errores.join(' '), /debe declarar schema/u);
});

test('la ronda real de este repositorio resuelve todas sus citas contra el disco', SOLO_FUENTE, () => {
  // No alcanza con que el gate funcione sobre fixtures: la ronda que este repositorio escribió tiene
  // que resolver de verdad, o sus propuestas son opiniones con formato de hallazgo.
  const r = correr(['check', 'docs/mejoras/2026-09-04.json'], { hoy: '2026-09-04' });
  assert.equal(r.codigo, 0, r.errores.join(' | '));
});

// --- El campo que registra el cierre de una ronda -----------------------------------------------
//
// `cerradas` nació inventado sobre la marcha al cerrar la ronda del 2026-09-04: se agregó al
// registro para anotar qué pasó con cada propuesta, y ni el gate lo validaba ni la plantilla lo
// enseñaba. Un campo que nadie comprueba es un campo que cada uno escribe distinto, y el próximo
// que abra una ronda no sabía que existía.
//
// Es OPCIONAL a propósito: una ronda recién escrita todavía no tiene cierre, y exigirlo obligaría a
// declarar el resultado antes de trabajar.

test('cerradas es opcional, y cuando está tiene que decir qué pasó', () => {
  assert.deepEqual(violaciones(registro(), leer, '2026-09-10'), [], 'sin cerradas sigue siendo válido');

  const conCierre = registro({ cerradas: { '2026-09-04': 'Dos se implementaron y dos se declararon como límite honesto porque ninguna regla sobrevivió.' } });
  assert.deepEqual(violaciones(conCierre, leer, '2026-09-10'), []);
});

test('FALSIFICACIÓN · un cierre mal formado, con fecha inventada o sin contenido, se rechaza', () => {
  const con = (v) => violaciones(registro({ cerradas: v }), leer, '2026-09-10').join(' ');
  assert.match(con('un texto suelto'), /objeto de fecha a texto/u);
  assert.match(con(['una lista']), /objeto de fecha a texto/u);
  assert.match(con(null), /objeto de fecha a texto/u);
  assert.match(con({ ayer: 'un texto suficientemente largo para pasar el mínimo' }), /no es una fecha/u);
  assert.match(con({ '2026-09-04': 'corto' }), /al menos 30/u);
  assert.match(con({ '2026-09-04': 42 }), /al menos 30/u);
});

test('la plantilla del bucle pasa su propio gate cuando se le llenan los huecos', SOLO_FUENTE, () => {
  // Mismo criterio que las plantillas de spec y de ADR: un molde que su propio gate rechaza le hace
  // perder el día a quien lo copie. Los huecos se llenan con valores mínimos; lo que se comprueba es
  // la FORMA, no que el molde venga lleno.
  const texto = readFileSync(join(repoRoot, 'templates', 'mejoras.json'), 'utf8')
    .replaceAll('AAAA-MM-DD', '2026-09-05')
    .replace('ruta/relativa/del/archivo/donde/se/vio.md', 'templates/mejoras.json');
  const molde = JSON.parse(texto);
  molde.propuestas[0].cita.texto_literal = 'Plantilla del bucle de auto-mejora';
  const leerDisco = (ruta) => readFileSync(join(repoRoot, ruta), 'utf8');
  assert.deepEqual(violaciones(molde, leerDisco, '2026-09-05'), []);
});
