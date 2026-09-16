// verify-platform-scope.test.mjs — una prueba que no corre en una plataforma tiene que DECIRLO.
//
// EL PROBLEMA QUE RESUELVE, y apareció midiendo. El CI de este repositorio corrió por primera vez
// fuera de la máquina del autor el 2026-09-16 y nueve pruebas salieron rojas: la suite asumía
// Windows —PowerShell, el shim de WSL, junctions, rutas con letra de unidad— y el runner era Ubuntu.
// No era una regresión: era el estreno. Verde en un solo lugar, nunca probada en otro.
//
// LA SALIDA FÁCIL SERÍA UN `if` SUELTO en cada prueba, y es exactamente lo que este gate impide. Un
// salteo escrito adentro de la prueba que se saltea no lo revisa nadie: una prueba que se saltea en
// TODAS las plataformas, o que se saltea por un motivo que dejó de valer, se ve igual que una que
// corre. La declaración vive en un contrato, como los límites honestos, y acá se comprueba en los
// dos sentidos: lo declarado existe, y lo que se saltea está declarado.
//
// Y SE SALTEA COMO **VACÍO**, NUNCA COMO OK. Es el vocabulario del propio protocolo: «no había nada
// que comparar» no es «comparé y pasó». Sería incoherente que el repositorio del protocolo se lo
// aplicara al revés a sí mismo.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';
import {
  PLATAFORMAS,
  SCHEMA,
  USAGE,
  declaracionesDeclaradas,
  main,
  salteosEnElArbol,
  violaciones,
} from '../scripts/verify-platform-scope.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de IA Stack, no del proyecto de quien instala' }
  : {};

const entrada = (over = {}) => ({
  plataforma: 'win32',
  archivo: 'tests/install-runtime.test.mjs',
  prueba: 'fresh PowerShell installation produces the same project-local runtime',
  por_que: 'corre powershell.exe, que no existe fuera de Windows',
  que_queda_sin_verificar: 'el instalador de PowerShell no se comprueba en las demás plataformas',
  ...over,
});
const contrato = (solo_en = [entrada()]) => ({ schema: SCHEMA, why: 'un motivo escrito de más de treinta caracteres, que es el mínimo', solo_en });

// El árbol, tal como lo devuelve el barrido: archivo -> lista de títulos que declaran plataforma.
const arbol = (pares = [['tests/install-runtime.test.mjs', entrada().prueba]]) => pares;

// --- La forma del contrato ------------------------------------------------------------------------

test('un contrato bien formado, con su declaración presente en el árbol, pasa', () => {
  assert.deepEqual(violaciones(contrato(), arbol(), () => 'test(\'fresh PowerShell installation produces the same project-local runtime\', soloEnWindows('), []);
});

test('FALSIFICACIÓN · un contrato sin schema, sin motivo o sin lista se rechaza', () => {
  for (const roto of [{ schema: 'otra.cosa/1' }, { why: 'corto' }, { solo_en: 'no es una lista' }]) {
    const c = { ...contrato(), ...roto };
    assert.equal(violaciones(c, arbol(), () => '').length > 0, true, JSON.stringify(roto));
  }
});

test('FALSIFICACIÓN · una plataforma que no existe se rechaza', () => {
  // La lista es cerrada a proposito: «windows» o «win» pasarian como declaraciones y no
  // corresponderian a ningun `process.platform` real, asi que la prueba se saltearia en todos lados.
  assert.match(violaciones(contrato([entrada({ plataforma: 'windows' })]), arbol(), () => '').join('\n'), /plataforma/u);
  for (const p of PLATAFORMAS) {
    const c = contrato([entrada({ plataforma: p })]);
    assert.doesNotMatch(violaciones(c, arbol(), () => 'soloEnWindows(').join('\n'), /no es una plataforma/u, p);
  }
});

test('FALSIFICACIÓN · una declaración sin decir qué queda sin verificar se rechaza', () => {
  // Es la mitad que importa. «Esta prueba es de Windows» no dice nada; lo que hace falta saber es
  // QUE deja de estar comprobado en las demas plataformas, porque eso es el hueco.
  for (const roto of [{ por_que: 'corto' }, { que_queda_sin_verificar: '' }, { que_queda_sin_verificar: undefined }]) {
    assert.equal(violaciones(contrato([entrada(roto)]), arbol(), () => '').length > 0, true, JSON.stringify(roto));
  }
});

// --- Los dos sentidos: lo declarado existe, y lo que se saltea está declarado ----------------------

test('FALSIFICACIÓN · una declaración cuyo archivo o título no existe se rechaza', () => {
  // Un contrato que nombra una prueba que ya no esta describe un mundo que no ocurre, y ademas
  // esconde el caso inverso: la prueba se renombro y su salteo dejo de estar declarado.
  const sinArchivo = violaciones(contrato([entrada({ archivo: 'tests/no-existe.test.mjs' })]), arbol(), () => { throw new Error('ENOENT'); });
  assert.match(sinArchivo.join('\n'), /no se pudo leer|no existe/u);

  const sinTitulo = violaciones(contrato([entrada({ prueba: 'un título que nadie escribió' })]), arbol(), () => 'otro contenido');
  assert.match(sinTitulo.join('\n'), /no está en/u);
});

test('FALSIFICACIÓN · una prueba que declara plataforma y NO está en el contrato se rechaza', () => {
  // El sentido que de verdad protege: sin esto, agregar un salteo es gratis y nadie lo revisa.
  const deMas = arbol([['tests/install-runtime.test.mjs', entrada().prueba], ['tests/otro.test.mjs', 'una prueba que se saltea sin declararlo']]);
  const rotos = violaciones(contrato(), deMas, () => 'soloEnWindows(');
  assert.match(rotos.join('\n'), /se saltea sin declararlo|no la declara/u, rotos.join('\n'));
});

test('FALSIFICACIÓN · dos declaraciones para la misma prueba se rechazan', () => {
  const dup = contrato([entrada(), entrada()]);
  assert.match(violaciones(dup, arbol(), () => 'soloEnWindows(').join('\n'), /dos veces|repite/u);
});

// --- El barrido del árbol ----------------------------------------------------------------------------

test('el barrido encuentra el título de cada prueba que declara plataforma', () => {
  const fuente = [
    "test('una normal', () => {});",
    "test('la de Windows', soloEnWindows('queda sin verificar el instalador'), () => {});",
    'test(`la de backticks`, soloEnWindows("otra cosa"), () => {});',
    "test(\"la de comillas dobles\", soloEnWindows('y otra'), () => {});",
  ].join('\n');
  const encontrados = salteosEnElArbol(['tests/x.test.mjs'], () => fuente);
  assert.deepEqual(encontrados.map(([, t]) => t), ['la de Windows', 'la de backticks', 'la de comillas dobles']);
  assert.equal(encontrados.every(([f]) => f === 'tests/x.test.mjs'), true);
});

test('el barrido no confunde una mención en un comentario con un salteo real', () => {
  // Un comentario que explica el mecanismo no es una prueba que se saltee, y contarlo como tal
  // obligaria a declarar en el contrato una prueba que no existe.
  const fuente = "// esto habla de soloEnWindows( y no es una prueba\ntest('normal', () => {});";
  assert.deepEqual(salteosEnElArbol(['tests/x.test.mjs'], () => fuente), []);
});

// --- El dato de este repositorio -------------------------------------------------------------------

test('EL DATO: el contrato de este repositorio cierra en los dos sentidos', SOLO_FUENTE, () => {
  const c = JSON.parse(readFileSync(join(repoRoot, 'contracts', 'platform-scope.json'), 'utf8'));
  const declaradas = declaracionesDeclaradas(c);
  assert.ok(declaradas.length > 0, 'el contrato no declara ninguna prueba con plataforma');
  const enElArbol = salteosEnElArbol(
    declaradas.map(([archivo]) => archivo),
    (ruta) => readFileSync(join(repoRoot, ruta), 'utf8'),
  );
  assert.ok(enElArbol.length > 0, 'ninguna prueba del árbol declara plataforma');
});

test('main sale 0 sobre el contrato real de este repositorio', SOLO_FUENTE, () => {
  const salida = [];
  const errores = [];
  const code = main(['check'], { cwd: repoRoot, write: (l) => salida.push(l), writeError: (l) => errores.push(l) });
  assert.equal(code, 0, errores.join('\n'));
  assert.match(salida.join('\n'), /^OK: /mu);
  assert.match(salida.join('\n'), /LÍMITE: /mu, 'el gate declara lo que no puede comprobar');
});

test('main sin contrato dice VACÍO, no OK: no hay nada que comparar', () => {
  const salida = [];
  const code = main(['check'], {
    cwd: '/no/existe',
    leer: () => { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; },
    write: (l) => salida.push(l),
    writeError: () => {},
  });
  assert.equal(code, 0);
  assert.match(salida.join('\n'), /^VACÍO: /u, salida.join('\n'));
});

test('main con un uso inválido sale 2 y dice cómo se usa', () => {
  const errores = [];
  assert.equal(main([], { write: () => {}, writeError: (l) => errores.push(l) }), 2);
  assert.equal(main(['inesperado'], { write: () => {}, writeError: (l) => errores.push(l) }), 2);
  assert.match(errores.join('\n'), new RegExp(USAGE.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
});

test('main rechaza con código 1 cuando el contrato no cierra', () => {
  const errores = [];
  const code = main(['check'], {
    cwd: repoRoot,
    // El doble tiene que distinguir las rutas, como las distingue el disco: uno que devolviera el
    // contrato para CUALQUIER ruta haria que el gate encontrara el titulo declarado adentro del
    // propio contrato, y la prueba afirmaria un rechazo que su doble hace imposible.
    leer: (ruta) => (String(ruta).includes('platform-scope.json')
      ? JSON.stringify(contrato([entrada({ prueba: 'un título que nadie escribió jamás' })]))
      : 'un archivo de pruebas cualquiera, sin ese título'),
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /REJECTED: /u);
});

// --- La entrada mal escrita, que es como llega un contrato hecho a mano --------------------------

test('un contrato que no es un objeto se rechaza sin reventar', () => {
  for (const basura of [null, 'una cadena', 42, ['una', 'lista']]) {
    const rotos = violaciones(basura, [], () => '');
    assert.equal(rotos.length > 0, true, JSON.stringify(basura));
    assert.match(rotos.join('\n'), /no es un objeto/u, JSON.stringify(basura));
  }
});

test('una declaración que no es un objeto se rechaza, y las demás se siguen mirando', () => {
  // Cortar en la primera basura escondería el resto de los problemas: quien arregla el contrato
  // tendría que correr el gate una vez por error en vez de ver la lista entera.
  const c = contrato([null, 42, entrada()]);
  const rotos = violaciones(c, arbol(), () => 'soloEnWindows(');
  assert.equal(rotos.filter((l) => /tiene que ser un objeto/u.test(l)).length, 2, rotos.join('\n'));
});

test('una declaración sin archivo o sin prueba se rechaza antes de ir al disco', () => {
  for (const roto of [{ archivo: '' }, { archivo: 42 }, { prueba: '' }, { prueba: undefined }]) {
    const rotos = violaciones(contrato([entrada(roto)]), [], () => { throw new Error('no debería leerse'); });
    assert.match(rotos.join('\n'), /necesita archivo y prueba/u, JSON.stringify(roto));
  }
});

test('declaracionesDeclaradas tolera un contrato roto y devuelve lo que sí sirve', () => {
  assert.deepEqual(declaracionesDeclaradas(null), []);
  assert.deepEqual(declaracionesDeclaradas({ solo_en: 'no es una lista' }), []);
  assert.deepEqual(declaracionesDeclaradas({ solo_en: [null, { archivo: 'a', prueba: 'b' }, { archivo: 42 }] }), [['a', 'b']]);
});

test('el barrido saltea un archivo que no se puede leer en vez de cortar el recorrido', () => {
  // Un archivo ilegible no puede declarar un salteo, y cortar ahí dejaría sin revisar todo lo que
  // viene después: el gate reportaría menos problemas por un motivo que no tiene que ver con ellos.
  const encontrados = salteosEnElArbol(['tests/roto.test.mjs', 'tests/bueno.test.mjs'], (ruta) => {
    if (ruta.includes('roto')) throw new Error('EACCES');
    return "test('la buena', soloEnWindows('queda sin verificar algo'), () => {});";
  });
  assert.deepEqual(encontrados, [['tests/bueno.test.mjs', 'la buena']]);
});

test('un contrato ilegible es un defecto, no una ausencia', () => {
  // ENOENT es «este proyecto no declara plataformas» y sale VACÍO. Un JSON roto o un permiso
  // denegado son otra cosa entera: el archivo está y no se puede usar.
  const errores = [];
  const code = main(['check'], {
    cwd: repoRoot,
    leer: () => { throw new SyntaxError('Unexpected token }'); },
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /no se puede leer/u);
});

test('si tests/ no se puede recorrer, se dice: sin el árbol no se sabe qué se saltea', () => {
  // Es la diferencia entre «ninguna prueba se saltea» y «no se pudo mirar». La primera sale verde.
  const errores = [];
  const code = main(['check'], {
    cwd: repoRoot,
    leer: (ruta) => (String(ruta).includes('platform-scope.json') ? JSON.stringify(contrato([])) : ''),
    listar: () => { throw new Error('EACCES: permission denied'); },
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /no se pudo recorrer tests/u);
});

test('lo que se tira sin ser un Error igual se reporta, no se traga', () => {
  // `throw 'texto'` es legal en JavaScript y no trae `message`. Sin este camino el mensaje sale
  // como «undefined», y quien lo lee no sabe ni qué pasó ni dónde.
  for (const donde of ['contrato', 'arbol']) {
    const errores = [];
    const code = main(['check'], {
      cwd: repoRoot,
      leer: () => {
        if (donde === 'contrato') throw 'algo que no es un Error';
        return JSON.stringify(contrato([]));
      },
      listar: () => { throw 'esto tampoco es un Error, y tambien tiene que salir'; },
      write: () => {},
      writeError: (l) => errores.push(l),
    });
    const dicho = errores.join('\n');
    assert.equal(code, 1, donde);
    assert.doesNotMatch(dicho, /undefined/u, dicho);
    assert.match(dicho, /es un Error/u, donde);
  }
});
