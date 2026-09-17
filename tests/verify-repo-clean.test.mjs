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
  ? { skip: 'runtime instalado: self-check del repositorio de IA Stack, no del proyecto de quien instala' }
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
    leerBlob: () => '',
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
    leerBlob: () => `El plan quedó en ${IDENTIDAD.home}\\Desktop\\plan.md y ahí sigue.\n`,
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
    leerBlob: () => `const firmante = '${IDENTIDAD.usuario} <s@t>';\n`,
  });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /tests\/algo\.test\.mjs/u.test(l)), errores.join('\n'));
});

test('el mensaje de rechazo NO reimprime la identidad que encontró', () => {
  // Un gate que grita el dato que protege lo filtra a los registros de CI, que suelen ser públicos.
  const { errores } = correr(['check'], {
    trackedFiles: () => ['docs/notas.md'],
    leerBlob: () => `ruta: ${IDENTIDAD.home}\\Desktop\n`,
  });
  const todo = errores.join('\n');
  assert.ok(!todo.includes(IDENTIDAD.usuario), `el rechazo reimprimió la identidad: ${todo}`);
  assert.ok(/línea 1/u.test(todo) || /:1/u.test(todo), `el rechazo tiene que ubicar el hallazgo: ${todo}`);
});

test('encuentra rutas personales de OTRA máquina, que la comprobación de identidad no ve', () => {
  for (const ajena of [`${WIN}otrapersona/Desktop`, `${NIX}otrapersona/proyecto`, `${MAC}otrapersona/Documents`]) {
    const { code, errores } = correr(['check'], {
      trackedFiles: () => ['README.md'],
      leerBlob: () => `copiado de ${ajena}\n`,
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
    leerBlob: () => 'texto sin nada personal\n',
  });
  assert.equal(code, 0);
  assert.ok(salida.some((l) => /LIMITE|LÍMITE/u.test(l) && /usuario/u.test(l)),
    `el gate tiene que declarar que apagó una comprobación: ${salida.join('\n')}`);
});

// UN NOMBRE DE USUARIO QUE ES UNA PALABRA DEL DOMINIO NO IDENTIFICA A NADIE.
//
// Encontrado el 2026-09-14 al preparar la integración continua, antes de que rompiera nada: en un
// runner de GitHub Actions la cuenta se llama literalmente `runner`, y este repositorio menciona
// «runner» en 72 de sus 393 archivos versionados, porque el despachador de test rojo habla de
// runners todo el tiempo. La comprobación de identidad habría producido 72 hallazgos falsos y el CI
// habría salido rojo en cada corrida — y un gate que grita siempre se termina apagando, que es la
// forma más común de perder un gate.
//
// LA SEÑAL ES LA FRECUENCIA, y se mide en vez de suponerse. Una identidad filtrada aparece en un
// puñado de archivos: el caso real de este repositorio eran 3 de 393, un 0,8%. Una palabra del
// dominio aparece por todos lados: 72 de 393, un 18%. La separación es de veinte veces, no de un
// pelo. Cuando la frecuencia dice «palabra», esa mitad se apaga DICIENDOLO —nunca en silencio— y la
// comprobación de rutas, que no tiene este problema, sigue corriendo.
test('un nombre de usuario que aparece por todo el repositorio se trata como palabra, no como identidad', () => {
  const muchos = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`doc${i}.md`, 'esto habla de un runner declarado']));
  const { code, salida } = correr(['check'], {
    homedir: () => join('D:', 'Usuarios', 'runner'),
    trackedFiles: () => Object.keys(muchos),
    leerBlob: (r) => muchos[String(r)],
  });

  assert.equal(code, 0, 'veinte de veinte archivos: es vocabulario del proyecto, no una filtración');
  assert.ok(salida.some((l) => /LIMITE|LÍMITE/u.test(l) && /palabra/u.test(l)),
    `tiene que decir que apagó la comprobación y por qué: ${salida.join('\n')}`);
});

test('un nombre de usuario que aparece en pocos archivos SIGUE siendo una filtración', () => {
  // El caso real que motivó el gate: el nombre del autor en tres archivos de 393.
  const archivos = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`doc${i}.md`, 'texto limpio']));
  archivos['tests/fixture.test.mjs'] = "const firmante = 'unapersona <s@t>';";
  const { code, errores } = correr(['check'], {
    homedir: () => join('D:', 'Usuarios', 'unapersona'),
    trackedFiles: () => Object.keys(archivos),
    leerBlob: (r) => archivos[String(r)],
  });

  assert.equal(code, 1, 'uno de veintiuno es una filtración, no vocabulario');
  assert.ok(errores.some((l) => /fixture/u.test(l)), errores.join('\n'));
});

test('la ruta del directorio personal se sigue buscando aunque el nombre sea una palabra', () => {
  // Apagar la mitad ruidosa no puede apagar la otra: una ruta de directorio personal en lo versionado sigue
  // siendo una ruta de máquina publicada, se llame como se llame la cuenta.
  const home = join('D:', 'Usuarios', 'runner');
  const archivos = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`doc${i}.md`, 'un runner declarado']));
  archivos['notas.md'] = `el plan quedó en ${home}\\Desktop`;
  const { code, errores } = correr(['check'], {
    homedir: () => home,
    trackedFiles: () => Object.keys(archivos),
    leerBlob: (r) => archivos[String(r)],
  });

  assert.equal(code, 1);
  assert.ok(errores.some((l) => /notas\.md/u.test(l)), errores.join('\n'));
});

test('una excepción declarada con motivo real suprime el hallazgo de ese archivo', () => {
  const { code, salida } = correr(['check'], {
    trackedFiles: () => ['tests/tablero.test.mjs'],
    leerBlob: () => `const ruta = "${rutaWin('otrapersona')}Desktop/proyectos/MiProyecto";\n`,
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
    leerBlob: () => `const ruta = "${rutaWin('otrapersona')}Desktop";\n`,
    readContract: () => contrato({ allowed: [permiso] }),
  });
  assert.equal(otroArchivo.code, 1, 'la excepción se escapó a otro archivo');

  const otroPatron = correr(['check'], {
    trackedFiles: () => ['tests/tablero.test.mjs'],
    leerBlob: () => `const ruta = "${rutaWin('distinto')}Desktop";\n`,
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
    leerBlob: () => Buffer.from([0x00, 0x01, 0x02]),
  });
  assert.equal(code, 0);
});

// ESTA PRUEBA CAMBIO DE VEREDICTO A PROPOSITO, el 2026-09-14.
//
// Antes decia que un archivo rastreado que no se puede leer «se informa y no rompe el gate», y
// devolvia 0. Eso era FALLAR ABIERTO, y fue el defecto de fondo: un archivo que el repositorio
// PUBLICA y que el gate no pudo revisar no es un archivo limpio, es uno que nadie miro. Ademas ya
// no aplica el motivo que lo justificaba —«esta borrado del arbol de trabajo»— porque el gate pasó a
// leer el blob del indice, que existe aunque el archivo no este en el disco.
test('FALLA CERRADO · un archivo rastreado cuyo contenido publicado no se puede leer rechaza', () => {
  const { code, errores } = correr(['check'], {
    trackedFiles: () => ['docs/opaco.md'],
    leerBlob: () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); },
  });
  assert.equal(code, 1, errores.join('\n'));
  assert.ok(errores.some((l) => /nadie miró/u.test(l)), errores.join('\n'));
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
    leerBlob: () => `ruta: ${IDENTIDAD.home}\\Desktop\n`,
    readContract: () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); },
  });
  assert.equal(code, 1, 'sin contrato tiene que seguir detectando, no rendirse');
  assert.ok(errores.some((l) => /notas/u.test(l)), errores.join('\n'));
});

test('FALSIFICACIÓN · un contrato ilegible rechaza, y no se confunde con uno ausente', () => {
  const { code, errores } = correr(['check'], {
    trackedFiles: () => ['docs/notas.md'],
    leerBlob: () => 'limpio\n',
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
    leerBlob: () => 'limpio',
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
    leerBlob: (r) => { leidos.push(String(r)); return 'limpio\n'; },
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
    leerBlob: () => 'texto sin nada personal\n',
  });
  assert.equal(code, 0);
  assert.ok(salida.some((l) => /LIMITE|LÍMITE/u.test(l) && /usuario/u.test(l)), salida.join('\n'));
});

test('el uso admite la ruta de contrato opcional, y rechaza una vacía', () => {
  const conRuta = correr(['check', 'contracts/otro.json'], {
    trackedFiles: () => ['README.md'],
    leerBlob: () => 'limpio\n',
  });
  assert.equal(conRuta.code, 0, conRuta.errores.join('\n'));

  const vacia = correr(['check', '   ']);
  assert.equal(vacia.code, 2);
  assert.ok(vacia.errores.some((l) => l === USAGE));
});

// LO QUE SE PUBLICA ES EL BLOB, NO EL ARCHIVO DEL ARBOL DE TRABAJO.
//
// Encontrado el 2026-09-14 comparando este protocolo contra otro, y reproducido: git guarda un
// enlace simbolico como un blob cuyo contenido es LA RUTA DESTINO. Si esa ruta es personal, queda
// publicada. La version anterior de este gate enumeraba con `git ls-files` y leia con `readFileSync`
// del arbol de trabajo, que **sigue el enlace**: leia el destino y nunca el texto del enlace. Un
// repositorio que publicaba `/home/<alguien>/.config/secretos` salia en VERDE.
//
// Y la segunda mitad del mismo defecto: un archivo que no se podia leer se contaba como «salteado» y
// no pasaba nada. Eso es FALLAR ABIERTO. El gate hermano `verify-security-baseline.mjs` ya hacia lo
// correcto —un archivo ilegible es un hallazgo de severidad alta, no un silencio— asi que el
// protocolo ya tenia el patron bueno y este gate no lo seguia.
test('un enlace simbólico rastreado se escanea por su TEXTO, que es lo que el repositorio publica', () => {
  const { code, errores } = correr(['check'], {
    trackedFiles: () => ['notas.md'],
    // El lector de blobs devuelve lo que git publica; el árbol de trabajo ni se mira.
    leerBlob: () => `${NIX}unapersona/.config/secretos`,
  });
  assert.equal(code, 1, 'el texto del enlace es una ruta personal y tiene que rechazar');
  assert.ok(errores.some((l) => /notas\.md/u.test(l)), errores.join('\n'));
});

test('FALLA CERRADO · un archivo rastreado que no se puede leer es un hallazgo, no un silencio', () => {
  const { code, errores } = correr(['check'], {
    trackedFiles: () => ['opaco.md'],
    leerBlob: () => { throw new Error('EACCES: permission denied'); },
  });
  assert.equal(code, 1, 'no poder mirar NO es haber mirado y no encontrar nada');
  assert.ok(errores.some((l) => /opaco\.md/u.test(l)), errores.join('\n'));
  assert.ok(errores.some((l) => /no se pudo (leer|revisar)/u.test(l)), errores.join('\n'));

  // Y lanzar algo que NO es un Error tiene que dejar un motivo legible igual: `git` puede fallar de
  // formas raras, y un rechazo que dice «undefined» no es un diagnostico.
  const crudo = correr(['check'], {
    trackedFiles: () => ['opaco.md'],
    leerBlob: () => { throw 'git se rompió de una forma rara'; },
  });
  assert.equal(crudo.code, 1);
  assert.ok(crudo.errores.some((l) => /forma rara/u.test(l)), crudo.errores.join(' | '));
});

test('el resumen cuenta los archivos revisados de verdad, y no infla con los que no pudo mirar', () => {
  const { code, salida } = correr(['check'], {
    trackedFiles: () => ['a.md', 'b.md'],
    leerBlob: () => 'contenido limpio',
  });
  assert.equal(code, 0, salida.join('\n'));
  assert.ok(/2 archivo/u.test(salida[0]), salida[0]);
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
  const { salida } = correr(['check'], { trackedFiles: () => ['README.md'], leerBlob: () => 'limpio\n' });
  const limite = salida.find((l) => /^LIMITE|^LÍMITE/u.test(l));
  assert.ok(limite, salida.join('\n'));
  assert.ok(/nombre/u.test(limite), `el límite tiene que nombrar el hueco de los nombres propios: ${limite}`);
});
