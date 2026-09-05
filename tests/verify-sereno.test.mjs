// El bucle de auto-mejora y su gate.
//
// El script NO genera las propuestas: las escribe el agente, que es el único que leyó la sesión.
// Esto verifica el REGISTRO, igual que `verify-ablation` verifica el registro de una ablación y no
// la ablación. La diferencia importa: un gate que generara las propuestas estaría juzgando su
// propio trabajo.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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
  fechaDeRegistro,
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

test('TODAS las rondas de este repositorio resuelven sus citas contra el disco', SOLO_FUENTE, () => {
  // No alcanza con que el gate funcione sobre fixtures: las rondas que este repositorio escribió
  // tienen que resolver de verdad, o sus propuestas son opiniones con formato de hallazgo.
  //
  // Se recorre la CARPETA, no un nombre escrito a mano. Antes esta prueba apuntaba sólo a
  // `2026-09-04.json`, así que toda ronda posterior quedaba sin verificar por la suite. Y no es
  // hipotético: las citas se rompieron DOS veces en dos rondas, las dos porque cerrar una propuesta
  // reescribió la línea que citaba. El gate sabía detectarlo; nadie lo corría sobre las demás.
  const carpeta = join(repoRoot, 'docs', 'mejoras');
  const rondas = readdirSync(carpeta).filter((n) => /^\d{4}-\d{2}-\d{2}(?:-\d+)?\.json$/u.test(n));
  assert.ok(rondas.length > 0, 'tiene que haber al menos una ronda, o esta prueba no mira nada');
  const rotas = [];
  for (const nombre of rondas) {
    const r = correr(['check', `docs/mejoras/${nombre}`], { hoy: new Date().toISOString().slice(0, 10) });
    if (r.codigo !== 0) rotas.push(`${nombre}: ${r.errores.join(' | ')}`);
  }
  assert.deepEqual(rotas, [], 'una cita que dejó de resolver es una propuesta que perdió su origen');
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

// --- Dos rondas el mismo día -------------------------------------------------------------------
//
// El nombre del registro ES la fecha, así que una segunda ronda en el mismo día no tenía dónde ir:
// o sobrescribía la primera, o se metía en su archivo pasando el tope de cuatro. Se encontró
// corriendo el bucle dos veces el 2026-09-05, a pedido.
//
// Se admite un sufijo `-<n>`. La fecha sigue mandando para el período —lo que cuenta es cuándo se
// escribió, no cuántas veces— y el orden entre rondas del mismo día lo da el sufijo.

test('un registro puede llevar sufijo para una segunda ronda del mismo día', () => {
  assert.equal(ultimoRegistro(['2026-09-05.json', '2026-09-05-2.json']), '2026-09-05-2.json');
  assert.equal(ultimoRegistro(['2026-09-04.json', '2026-09-05.json']), '2026-09-05.json');
  // El sufijo no altera qué día es: una ronda del 5 con sufijo sigue siendo del 5.
  assert.equal(fechaDeRegistro('2026-09-05-2.json'), '2026-09-05');
  assert.equal(fechaDeRegistro('2026-09-05.json'), '2026-09-05');
  assert.equal(fechaDeRegistro('notas.md'), null);
});

test('FALSIFICACIÓN · el sufijo no abre la puerta a un nombre cualquiera', () => {
  assert.equal(fechaDeRegistro('2026-09-05-.json'), null);
  assert.equal(fechaDeRegistro('2026-09-05-abc.json'), null);
  assert.equal(fechaDeRegistro('05-09-2026.json'), null);
  assert.deepEqual(ultimoRegistro(['2026-09-05-abc.json']), null);
});

test('due cuenta desde la FECHA de la última ronda, tenga sufijo o no', () => {
  const con = (nombres, hoy) => {
    const salidas = [];
    main(['due', '--today', hoy], '.', (m) => salidas.push(m), () => {}, { hay: () => true, listar: () => nombres });
    return salidas.join(' ');
  };
  assert.match(con(['2026-09-05-2.json'], '2026-09-06'), /^OK:/u, 'un día después de una ronda con sufijo no toca');
  assert.match(con(['2026-09-05-2.json'], '2026-09-20'), /^TOCA:/u, 'quince días después sí');
});

// --- `due` miraba la fecha, no si la ronda se atendió --------------------------------------------
//
// Comparaba la fecha del último registro contra hoy y nada más. Una ronda escrita y nunca cerrada
// hacía que `due` dijera «no toca» durante siete días, con sus propuestas abiertas: el bucle se
// quedaba callado justo cuando había trabajo pendiente. El campo `cerradas` existía y lo ignoraba.
//
// No se convierte en rechazo: `due` es un aviso y sigue saliendo `0`. Lo que cambia es que lo diga.

test('due avisa cuando la última ronda quedó sin cerrar, aunque no toque por fecha', () => {
  const con = (contenido) => {
    const salidas = [];
    main(['due', '--today', '2026-09-06'], '.', (m) => salidas.push(m), () => {}, {
      hay: () => true, listar: () => ['2026-09-05.json'], leer: () => JSON.stringify(contenido),
    });
    return salidas.join(' ');
  };
  const abierta = con({ schema: SCHEMA, run_id: '2026-09-05', propuestas: [propuesta()] });
  assert.match(abierta, /sin cerrar|sin atender/iu);

  const cerrada = con({ schema: SCHEMA, run_id: '2026-09-05', propuestas: [propuesta()], cerradas: { '2026-09-05': 'Se implementaron las cuatro el mismo día.' } });
  assert.doesNotMatch(cerrada, /sin cerrar|sin atender/iu);
  assert.match(cerrada, /^OK:/u);
});

test('FALSIFICACIÓN · un registro ilegible no convierte el aviso en un rechazo', () => {
  // `due` es un aviso, no un gate: si no puede leer el registro, lo dice y sale 0. Reventar acá
  // pondría en rojo el arranque de sesión de alguien por un archivo que ni siquiera se le pidió.
  const salidas = [];
  const codigo = main(['due', '--today', '2026-09-06'], '.', (m) => salidas.push(m), () => {}, {
    hay: () => true, listar: () => ['2026-09-05.json'], leer: () => { throw new Error('EACCES'); },
  });
  assert.equal(codigo, 0);
  assert.match(salidas.join(' '), /^OK:|^VACÍO:/u);
});
