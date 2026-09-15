// AC9 de docs/spec.md · Lo versionado no lleva la identidad de quien lo escribió.
//
// EL PROBLEMA QUE RESUELVE, medido sobre este mismo repositorio. Un protocolo publicado para que
// otros lo usen no puede venir con los datos de su autor adentro: quien lo instala tiene que
// aprender sobre SUS proyectos, no sobre los ajenos. Durante el ciclo del 2026-09-14 se encontraron
// cuatro filtraciones introducidas sin querer —un nombre de usuario en fixtures, una subcarpeta
// personal en otro test, una ruta absoluta en el cuaderno de sesión, y una línea de auditoría
// nombrando proyectos privados— y la cuarta resultó **irreparable**, porque `.vibe/AUDIT.md` es
// append-only y sellado: LAW 5 prohíbe editarla. Una filtración detectada tarde no se puede deshacer.
// Por eso el gate corre ANTES de que la traza se selle.
//
// LAS DOS COMPROBACIONES, y por qué son dos. La de FORMA busca rutas con pinta de directorio
// personal (`C:\\Users\\<alguien>`, `/home/<alguien>`, `/Users/<alguien>`) y agarra también las de
// otra máquina, copiadas de un pantallazo o de un log ajeno. La de IDENTIDAD busca la ruta del
// directorio personal de quien corre el gate y su nombre de usuario, resueltos en el momento: no
// hay ninguna lista de nombres escrita en ningún lado, así que **el gate no guarda el dato que
// protege**. Escribir el nombre del autor adentro del detector sería la misma filtración con otra
// forma.

import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-repo-clean.mjs');
const {
  MIN_MOTIVO, MIN_USUARIO, SCHEMA, USAGE, buscarEnTexto, esBinario, main, validarContrato,
} = await import(pathToFileURL(script).href);

import { esRuntimeInstalado } from './_entorno.mjs';

const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};

const motivo = (base) => `${base}, y por eso queda declarado en vez de borrado.`;
const contrato = (over = {}) => ({ schema: SCHEMA, why: motivo('Las excepciones se declaran una por una'), allowed: [], ...over });

// Una identidad de laboratorio: nunca la de quien corre las pruebas. El directorio dice `Usuarios`
// y no `Users`, asi que no coincide con ningun patron de forma: lo que se prueba aca es la
// comprobacion de IDENTIDAD, y mezclarla con la de forma haria que una prueba pasara por el motivo
// equivocado.
const IDENTIDAD = { home: join('D:', 'Usuarios', 'personaimaginaria'), usuario: 'personaimaginaria' };

// LOS FIXTURES SE ARMAN, NO SE ESCRIBEN.
//
// Una ruta personal escrita literal adentro de este archivo obligaria a declararla en
// `contracts/repo-clean.json`, y cada excepcion declarada es una comprobacion que se apaga para ese
// archivo — justo el archivo donde viven las pruebas del detector. Concatenando, el fuente no
// contiene ningun literal que el detector reconozca y la prueba igual le pasa la ruta entera: el
// dato bajo prueba es identico y la lista de excepciones se queda corta, que es el estado estricto.
const WIN = 'C:/Users/';
const NIX = '/home/';
const MAC = '/Users/';
const rutaWin = (nombre) => `${WIN}${nombre}/`;

function correr(args, over = {}) {
  const salida = [];
  const errores = [];
  const code = main(args, {
    root: repoRoot,
    homedir: () => IDENTIDAD.home,
    trackedFiles: () => [],
    read: () => '',
    readContract: () => contrato(),
    write: (l) => salida.push(l),
    writeError: (l) => errores.push(l),
    ...over,
  });
  return { code, salida, errores };
}

test('un uso inválido sale 2 y no se confunde con un rechazo', () => {
  for (const args of [[], ['otra'], ['check', 'de', 'mas']]) {
    const { code, errores } = correr(args);
    assert.equal(code, 2, JSON.stringify(args));
    assert.ok(errores.some((l) => l === USAGE), errores.join('\n'));
  }
});

test('sin archivos rastreados escribe VACÍO y sale 0, sin decir OK', () => {
  const { code, salida } = correr(['check'], { trackedFiles: () => [] });
  assert.equal(code, 0);
  assert.ok(/^VACÍO: /u.test(salida.at(-1)), salida.join('\n'));
  assert.ok(!salida.some((l) => /^OK: /u.test(l)), 'una carpeta sin archivos no compra un OK de limpieza');
});

test('eleccion-de-stack · AC9 · encuentra la ruta del directorio personal de quien corre el gate', () => {
  const { code, errores } = correr(['check'], {
    trackedFiles: () => ['docs/notas.md'],
    read: () => `El plan quedó en ${IDENTIDAD.home}\\Desktop\\plan.md y ahí sigue.\n`,
  });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /docs\/notas\.md/u.test(l)), errores.join('\n'));
  assert.ok(errores.every((l) => /^REJECTED: /u.test(l)), errores.join('\n'));
});

test('encuentra el nombre de usuario a secas, que es la filtración que no parece una ruta', () => {
  // El primer caso real fue exactamente este: un fixture de prueba con el nombre adentro, sin
  // ninguna barra alrededor. Buscar sólo rutas lo habría dejado pasar.
  const { code, errores } = correr(['check'], {
    trackedFiles: () => ['tests/algo.test.mjs'],
    read: () => `const firmante = '${IDENTIDAD.usuario} <s@t>';\n`,
  });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /tests\/algo\.test\.mjs/u.test(l)), errores.join('\n'));
});

test('el mensaje de rechazo NO reimprime la identidad que encontró', () => {
  // Un gate que grita el dato que protege lo filtra a los registros de CI, que suelen ser públicos.
  const { errores } = correr(['check'], {
    trackedFiles: () => ['docs/notas.md'],
    read: () => `ruta: ${IDENTIDAD.home}\\Desktop\n`,
  });
  const todo = errores.join('\n');
  assert.ok(!todo.includes(IDENTIDAD.usuario), `el rechazo reimprimió la identidad: ${todo}`);
  assert.ok(/línea 1/u.test(todo) || /:1/u.test(todo), `el rechazo tiene que ubicar el hallazgo: ${todo}`);
});

test('encuentra rutas personales de OTRA máquina, que la comprobación de identidad no ve', () => {
  for (const ajena of [`${WIN}otrapersona/Desktop`, `${NIX}otrapersona/proyecto`, `${MAC}otrapersona/Documents`]) {
    const { code, errores } = correr(['check'], {
      trackedFiles: () => ['README.md'],
      read: () => `copiado de ${ajena}\n`,
    });
    assert.equal(code, 1, ajena);
    assert.ok(errores.some((l) => /README\.md/u.test(l)), ajena);
  }
});

test('un nombre de usuario demasiado corto apaga esa comprobación y LO DICE', () => {
  // Un usuario de dos letras haría coincidir media biblioteca. Apagarlo en silencio convertiría el
  // gate en decoración justo para quien más lo necesita.
  const { code, salida } = correr(['check'], {
    homedir: () => join('D:', 'u'),
    trackedFiles: () => ['README.md'],
    read: () => 'texto sin nada personal\n',
  });
  assert.equal(code, 0);
  assert.ok(salida.some((l) => /LIMITE|LÍMITE/u.test(l) && /usuario/u.test(l)),
    `el gate tiene que declarar que apagó una comprobación: ${salida.join('\n')}`);
});

test('una excepción declarada con motivo real suprime el hallazgo de ese archivo', () => {
  const { code, salida } = correr(['check'], {
    trackedFiles: () => ['tests/tablero.test.mjs'],
    read: () => `const ruta = "${rutaWin('otrapersona')}Desktop/proyectos/MiProyecto";\n`,
    readContract: () => contrato({
      allowed: [{
        path: 'tests/tablero.test.mjs',
        pattern: rutaWin('otrapersona'),
        reason: motivo('El fixture necesita una ruta con forma de ruta y usa un nombre inventado'),
      }],
    }),
  });
  assert.equal(code, 0, salida.join('\n'));
  assert.ok(salida.some((l) => /^OK: /u.test(l)), salida.join('\n'));
});

test('la excepción sólo vale para el archivo y el patrón que declara', () => {
  const permiso = {
    path: 'tests/tablero.test.mjs',
    pattern: rutaWin('otrapersona'),
    reason: motivo('El fixture necesita una ruta con forma de ruta y usa un nombre inventado'),
  };

  const otroArchivo = correr(['check'], {
    trackedFiles: () => ['tests/otro.test.mjs'],
    read: () => `const ruta = "${rutaWin('otrapersona')}Desktop";\n`,
    readContract: () => contrato({ allowed: [permiso] }),
  });
  assert.equal(otroArchivo.code, 1, 'la excepción se escapó a otro archivo');

  const otroPatron = correr(['check'], {
    trackedFiles: () => ['tests/tablero.test.mjs'],
    read: () => `const ruta = "${rutaWin('distinto')}Desktop";\n`,
    readContract: () => contrato({ allowed: [permiso] }),
  });
  assert.equal(otroPatron.code, 1, 'la excepción tapó un hallazgo que no declaraba');
});

test('FALSIFICACIÓN · una excepción sin motivo real se rechaza, en vez de aceptarse', () => {
  for (const reason of ['', 'tbd', 'placeholder', 'x'.repeat(MIN_MOTIVO - 1)]) {
    const violaciones = validarContrato(contrato({
      allowed: [{ path: 'a.md', pattern: rutaWin('x'), reason }],
    }));
    assert.ok(violaciones.some((v) => /reason|motivo/u.test(v)), `${JSON.stringify(reason)}: ${violaciones.join(' | ')}`);
  }
});

test('FALSIFICACIÓN · el contrato se comprueba campo por campo, no por su largo', () => {
  assert.ok(validarContrato({ ...contrato(), schema: 'otro' }).some((v) => /schema/u.test(v)));
  assert.ok(validarContrato({ ...contrato(), extra: 1 }).some((v) => /exactamente/u.test(v)));
  assert.ok(validarContrato(contrato({ allowed: 'no es lista' })).some((v) => /allowed/u.test(v)));
  assert.ok(validarContrato(contrato({ why: 'corto' })).some((v) => /why/u.test(v)));
  assert.ok(validarContrato(contrato({ allowed: [{ path: 'a.md', pattern: '' , reason: motivo('algo suficientemente largo') }] }))
    .some((v) => /pattern/u.test(v)));
  assert.ok(validarContrato(contrato({ allowed: [{ path: '', pattern: 'x', reason: motivo('algo suficientemente largo') }] }))
    .some((v) => /path/u.test(v)));
  assert.deepEqual(validarContrato(contrato()), []);
});

test('un archivo binario no se escanea y no inventa hallazgos', () => {
  assert.equal(esBinario(Buffer.from([0x50, 0x4e, 0x47, 0x00, 0x01])), true);
  assert.equal(esBinario(Buffer.from('texto normal', 'utf8')), false);

  const { code } = correr(['check'], {
    trackedFiles: () => ['docs/imagen.png'],
    read: () => Buffer.from([0x00, 0x01, 0x02]),
  });
  assert.equal(code, 0);
});

test('un archivo que ya no está en disco se informa, no rompe el gate', () => {
  const { code, errores } = correr(['check'], {
    trackedFiles: () => ['docs/borrado.md'],
    read: () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); },
  });
  assert.equal(code, 0, errores.join('\n'));
});

test('buscarEnTexto ubica cada hallazgo en su línea, y encuentra todas', () => {
  const texto = ['limpio', `usa ${IDENTIDAD.usuario} aca`, 'limpio', `${NIX}alguien/x`].join('\n');
  const hallazgos = buscarEnTexto(texto, IDENTIDAD);
  assert.equal(hallazgos.length, 2, JSON.stringify(hallazgos));
  assert.deepEqual(hallazgos.map((h) => h.linea), [2, 4]);
  assert.ok(hallazgos.every((h) => typeof h.que === 'string' && h.que.length > 0));
});

test('FALSIFICACIÓN · un contrato que no es un objeto se nombra como tal, no explota', () => {
  for (const basura of [null, 'una cadena', 42, ['una', 'lista']]) {
    const violaciones = validarContrato(basura);
    assert.ok(violaciones.some((v) => /objeto/u.test(v)), `${JSON.stringify(basura)}: ${violaciones.join(' | ')}`);
  }
});

test('FALSIFICACIÓN · una excepción con campos de más o de menos se rechaza entera', () => {
  const completo = { path: 'a.md', pattern: 'x', reason: motivo('un motivo suficientemente largo para pasar') };
  for (const roto of [
    { ...completo, extra: 1 },
    { path: 'a.md', pattern: 'x' },
    { path: 'a.md', reason: completo.reason },
    'ni siquiera es un objeto',
  ]) {
    const violaciones = validarContrato(contrato({ allowed: [roto] }));
    assert.ok(violaciones.some((v) => /exactamente/u.test(v)), `${JSON.stringify(roto)}: ${violaciones.join(' | ')}`);
  }
});

test('un hallazgo repetido en la misma línea se cuenta una sola vez', () => {
  // Sin la deduplicación, una línea con la ruta del directorio personal escrita tres veces daría
  // tres rechazos idénticos, y el conteo final mentiría sobre cuántos lugares hay que arreglar.
  const linea = `${IDENTIDAD.home} y otra vez ${IDENTIDAD.home} y van tres ${IDENTIDAD.home}`;
  const hallazgos = buscarEnTexto(linea, IDENTIDAD);

  // Dos CLASES distintas, no seis hallazgos: la ruta y el nombre de usuario son cosas diferentes
  // —el nombre está adentro de la ruta, así que las dos coinciden— pero cada clase se anota una
  // sola vez por línea, por más veces que aparezca.
  assert.deepEqual([...new Set(hallazgos.map((h) => h.que))].length, hallazgos.length,
    `hay clases repetidas: ${JSON.stringify(hallazgos)}`);
  assert.equal(hallazgos.length, 2, JSON.stringify(hallazgos));
  assert.ok(hallazgos.every((h) => h.linea === 1));
});

test('un contrato ausente NO afloja nada: se sigue sin excepciones, que es lo estricto', () => {
  const { code, errores } = correr(['check'], {
    trackedFiles: () => ['docs/notas.md'],
    read: () => `ruta: ${IDENTIDAD.home}\\Desktop\n`,
    readContract: () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); },
  });
  assert.equal(code, 1, 'sin contrato tiene que seguir detectando, no rendirse');
  assert.ok(errores.some((l) => /notas/u.test(l)), errores.join('\n'));
});

test('FALSIFICACIÓN · un contrato ilegible rechaza, y no se confunde con uno ausente', () => {
  const { code, errores } = correr(['check'], {
    trackedFiles: () => ['docs/notas.md'],
    read: () => 'limpio\n',
    readContract: () => { throw new SyntaxError('Unexpected token } in JSON'); },
  });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /ilegible/u.test(l)), errores.join('\n'));
  assert.ok(errores.some((l) => /corrupto no es/u.test(l)), 'tiene que decir POR QUÉ rechaza en vez de escribir VACÍO');

  // Lanzar algo que NO es un Error tiene que rechazar con un mensaje legible igual: un getter roto o
  // un parser de terceros pueden tirar cualquier cosa, y ahí `error.message` sería undefined. Un
  // rechazo que dice «undefined» no es un diagnóstico, es una pared.
  const crudo = correr(['check'], {
    trackedFiles: () => ['docs/notas.md'],
    read: () => 'limpio',
    readContract: () => { throw 'el contrato se rompió de una forma rara'; },
  });
  assert.equal(crudo.code, 1);
  assert.ok(crudo.errores.some((l) => /forma rara/u.test(l)), crudo.errores.join(' | '));
  assert.ok(!crudo.errores.some((l) => /undefined/u.test(l)), 'el rechazo dijo undefined en vez del motivo');
});

test('FALSIFICACIÓN · un contrato mal formado rechaza antes de escanear un solo archivo', () => {
  const leidos = [];
  const { code, errores } = correr(['check'], {
    trackedFiles: () => ['docs/notas.md'],
    read: (r) => { leidos.push(String(r)); return 'limpio\n'; },
    readContract: () => contrato({ why: 'corto' }),
  });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /why/u.test(l)), errores.join('\n'));
  assert.deepEqual(leidos, [], 'escaneó igual, con un contrato que no sabe si es válido');
});

test('sin directorio personal resoluble, la comprobación de identidad se apaga y lo dice', () => {
  const { code, salida } = correr(['check'], {
    homedir: () => undefined,
    trackedFiles: () => ['README.md'],
    read: () => 'texto sin nada personal\n',
  });
  assert.equal(code, 0);
  assert.ok(salida.some((l) => /LIMITE|LÍMITE/u.test(l) && /usuario/u.test(l)), salida.join('\n'));
});

test('el uso admite la ruta de contrato opcional, y rechaza una vacía', () => {
  const conRuta = correr(['check', 'contracts/otro.json'], {
    trackedFiles: () => ['README.md'],
    read: () => 'limpio\n',
  });
  assert.equal(conRuta.code, 0, conRuta.errores.join('\n'));

  const vacia = correr(['check', '   ']);
  assert.equal(vacia.code, 2);
  assert.ok(vacia.errores.some((l) => l === USAGE));
});

test('EL REPOSITORIO REAL no publica la identidad de quien lo escribió', SOLO_FUENTE, async () => {
  // El self-check. Cuando se escribió esta regla el repositorio tenía siete apariciones del nombre
  // del autor en tres archivos versionados, ya publicadas. Esta prueba es la que obliga a limpiarlas.
  const { readFileSync } = await import('node:fs');
  const salida = [];
  const errores = [];
  const code = main(['check'], {
    root: repoRoot,
    write: (l) => salida.push(l),
    writeError: (l) => errores.push(l),
    readContract: () => JSON.parse(readFileSync(join(repoRoot, 'contracts', 'repo-clean.json'), 'utf8')),
  });
  assert.equal(code, 0, errores.join('\n'));
  assert.ok(salida.some((l) => /^OK: /u.test(l)), salida.join('\n'));
  assert.ok(salida.some((l) => /LIMITE|LÍMITE/u.test(l)), 'el gate tiene que declarar qué NO puede detectar');
});

test('el gate declara que NO detecta nombres, sólo rutas e identidad de máquina', () => {
  const { salida } = correr(['check'], { trackedFiles: () => ['README.md'], read: () => 'limpio\n' });
  const limite = salida.find((l) => /^LIMITE|^LÍMITE/u.test(l));
  assert.ok(limite, salida.join('\n'));
  assert.ok(/nombre/u.test(limite), `el límite tiene que nombrar el hueco de los nombres propios: ${limite}`);
});
