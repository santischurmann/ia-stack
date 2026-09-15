// Cobertura de los caminos degradados del gate de scavenge: las caídas y los rechazos que las
// pruebas de comportamiento no tocan.
//
// POR QUÉ UN ARCHIVO APARTE. Las pruebas de comportamiento describen lo que el gate hace cuando el
// documento tiene sentido. Estas describen qué pasa cuando NO lo tiene: una lista con algo que no es
// un objeto, una entrada sin id, un archivo corrupto, un fuente que no se deja leer. Ese es el
// código que corre el día que algo sale mal, y es justo el que nadie ejercita hasta que sale mal.

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-scavenge.mjs');
const { SCHEMA, locatoresDe, main, validarScavenge } = await import(pathToFileURL(script).href);

const texto = (base) => `${base}, con texto suficiente para no ser relleno.`;

const base = (over = {}) => ({
  schema: SCHEMA,
  feature: 'una-funcionalidad',
  date: '2026-09-15',
  scope: 'corto',
  reusable: [],
  missing: [{ id: 'M1', what: texto('Falta algo concreto que se puede describir') }],
  breaks: [],
  unknowns: [],
  ...over,
});

const silencio = { write: () => {}, writeError: () => {} };

function proyecto() {
  const d = mkdtempSync(join(tmpdir(), 'vcp-scav-cob-'));
  mkdirSync(join(d, 'scripts'), { recursive: true });
  writeFileSync(join(d, 'scripts', 'existe.mjs'), 'una\ndos\n', 'utf8');
  return d;
}

test('una fecha ausente se nombra igual que una mal formada', () => {
  for (const fecha of [undefined, null, '', 'ayer']) {
    const v = validarScavenge(base({ date: fecha }));
    assert.ok(v.some((x) => /date/u.test(x)), `${JSON.stringify(fecha)}: ${v.join(' | ')}`);
  }
});

test('una entrada que no es un objeto se rechaza sin romper el gate', () => {
  for (const basura of [null, 'una cadena', 42, ['lista']]) {
    const v = validarScavenge(base({ missing: [basura] }));
    assert.ok(v.some((x) => /missing\[0\]/u.test(x)), `${JSON.stringify(basura)}: ${v.join(' | ')}`);
  }
});

test('una entrada con claves de más o de menos se rechaza entera', () => {
  assert.ok(validarScavenge(base({ missing: [{ id: 'M1' }] })).some((v) => /missing\[0\]/u.test(v)));
  assert.ok(validarScavenge(base({ missing: [{ id: 'M1', what: texto('algo suficiente'), extra: 1 }] }))
    .some((v) => /missing\[0\]/u.test(v)));
  // `locator` sólo se admite donde tiene sentido: en `missing` no, porque lo que falta no está.
  assert.ok(validarScavenge(base({ missing: [{ id: 'M1', what: texto('algo suficiente'), locator: 'a.mjs:1' }] }))
    .some((v) => /missing\[0\]/u.test(v)));
});

test('una entrada sin id se nombra por su posición, no por un id que no tiene', () => {
  const v = validarScavenge(base({ missing: [{ id: '', what: texto('algo suficientemente largo') }] }));
  assert.ok(v.some((x) => /missing\[0\]\.id/u.test(x)), v.join(' | '));

  // Y si además el texto es corto, el mensaje no puede decir «undefined».
  const w = validarScavenge(base({ missing: [{ id: '', what: 'corto' }] }));
  assert.ok(w.some((x) => /sin id/u.test(x)), w.join(' | '));
});

test('una pregunta abierta sin pregunta se rechaza, no sólo sin respuesta', () => {
  const v = validarScavenge(base({
    unknowns: [{ id: 'U1', question: 'corta', how_to_answer: texto('Una forma concreta de contestarla') }],
  }));
  assert.ok(v.some((x) => /question/u.test(x)), v.join(' | '));
});

test('un locator mal formado se rechaza en las dos listas que lo admiten', () => {
  for (const lista of ['reusable', 'breaks']) {
    const entrada = lista === 'reusable'
      ? { id: 'X1', what: texto('Algo que dice existir'), locator: 'sin-linea.mjs' }
      : { id: 'X1', what: texto('Algo que se rompe'), locator: 'sin-linea.mjs' };
    const v = validarScavenge(base({ [lista]: [entrada] }));
    assert.ok(v.some((x) => /locator/u.test(x)), `${lista}: ${v.join(' | ')}`);
  }
});

test('el mensaje de `breaks` dice que su locator es opcional, y el de las otras listas no', () => {
  // La asimetría tiene que estar en el TEXTO del rechazo, no sólo en la regla: quien lo lee necesita
  // saber si le falta un campo o si puede omitirlo.
  const enBreaks = validarScavenge(base({ breaks: [{ id: 'B1' }] }));
  assert.ok(enBreaks.some((v) => /breaks\[0\]/u.test(v) && /opcional/u.test(v)), enBreaks.join(' | '));

  const enMissing = validarScavenge(base({ missing: [{ id: 'M1' }] }));
  assert.ok(enMissing.some((v) => /missing\[0\]/u.test(v) && !/opcional/u.test(v)), enMissing.join(' | '));
});

test('un locator presente pero nulo se rechaza como mal formado, no explota', () => {
  for (const nulo of [null, undefined]) {
    const v = validarScavenge(base({ reusable: [{ id: 'R1', what: texto('Algo que dice existir'), locator: nulo }] }));
    assert.ok(v.some((x) => /locator/u.test(x)), `${JSON.stringify(nulo)}: ${v.join(' | ')}`);
  }
});

test('un `abrir` que lanza algo que NO es un Error deja un motivo legible', () => {
  const d = proyecto();
  try {
    const errores = [];
    const code = main(['check', 'docs/scavenge/x.json'], {
      cwd: d,
      leer: () => base({ reusable: [{ id: 'R1', what: texto('Algo que dice existir'), locator: 'scripts/existe.mjs:1' }] }),
      abrir: () => { throw 'el disco se rompió de una forma rara'; },
      write: () => {},
      writeError: (l) => errores.push(l),
    });
    assert.equal(code, 1);
    assert.ok(errores.some((l) => /forma rara/u.test(l)), errores.join('\n'));
    assert.ok(!errores.some((l) => /undefined/u.test(l)), 'el rechazo dijo undefined en vez del motivo');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('locatoresDe tolera un documento al que le falta una lista', () => {
  assert.deepEqual(locatoresDe({}), []);
  assert.deepEqual(locatoresDe({ reusable: [{ id: 'R1', locator: 'a.mjs:1' }] }).map((x) => x.id), ['R1']);
  assert.deepEqual(locatoresDe({ reusable: [null, 'texto', { id: 'R2' }] }), []);
});

test('un archivo corrupto rechaza, y no se confunde con uno ausente', () => {
  const errores = [];
  const code = main(['check', 'docs/scavenge/x.json'], {
    leer: () => { throw new SyntaxError('Unexpected token } in JSON'); },
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /corrupto no es/u.test(l)), errores.join('\n'));

  // Y algo que ni siquiera es un Error tiene que dejar un motivo legible.
  const e2 = [];
  assert.equal(main(['check', 'docs/scavenge/x.json'], {
    leer: () => { throw 'se rompió de una forma rara'; },
    write: () => {},
    writeError: (l) => e2.push(l),
  }), 1);
  assert.ok(e2.some((l) => /forma rara/u.test(l)), e2.join('\n'));
});

test('un documento inválido rechaza ANTES de abrir ningún archivo', () => {
  const abiertos = [];
  const code = main(['check', 'docs/scavenge/x.json'], {
    leer: () => base({ scope: 'mediano' }),
    abrir: (r) => { abiertos.push(r); return 'x'; },
    ...silencio,
  });
  assert.equal(code, 1);
  assert.deepEqual(abiertos, [], 'abrió archivos con un documento que todavía no sabía si era válido');
});

test('un fuente que existe y no se deja leer rechaza diciendo cuál', () => {
  const d = proyecto();
  try {
    const errores = [];
    const code = main(['check', 'docs/scavenge/x.json'], {
      cwd: d,
      leer: () => base({ reusable: [{ id: 'R1', what: texto('Algo que dice existir'), locator: 'scripts/existe.mjs:1' }] }),
      abrir: () => { throw new Error('EACCES: permission denied'); },
      write: () => {},
      writeError: (l) => errores.push(l),
    });
    assert.equal(code, 1);
    assert.ok(errores.some((l) => /existe\.mjs/u.test(l) && /EACCES/u.test(l)), errores.join('\n'));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('el gate corre con TODOS sus valores por defecto contra el disco real', () => {
  const d = proyecto();
  try {
    // Sin `leer` ni `abrir` inyectados: lee del disco de verdad. El archivo no está, así que el
    // camino por defecto ejecuta y contesta VACÍO.
    const salida = [];
    const code = main(['check', 'docs/scavenge/no-esta.json'], { cwd: d, write: (l) => salida.push(l), writeError: () => {} });
    assert.equal(code, 0);
    assert.ok(/^VACÍO: /u.test(salida.at(-1)), salida.join('\n'));

    // Y ahora con un scavenge real en disco, para que `leer` y `abrir` por defecto trabajen.
    mkdirSync(join(d, 'docs', 'scavenge'), { recursive: true });
    writeFileSync(join(d, 'docs', 'scavenge', 'real.json'), JSON.stringify(base({
      reusable: [{ id: 'R1', what: texto('Algo que de verdad existe en el archivo'), locator: 'scripts/existe.mjs:2' }],
    })), 'utf8');
    const s2 = [];
    assert.equal(main(['check', 'docs/scavenge/real.json'], { cwd: d, write: (l) => s2.push(l), writeError: () => {} }), 0, s2.join('\n'));
    assert.ok(s2.some((l) => /^OK: /u.test(l)), s2.join('\n'));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('sin write inyectado usa la consola', () => {
  const original = { log: console.log, error: console.error };
  console.log = () => {};
  console.error = () => {};
  try {
    assert.equal(main([]), 2);
  } finally {
    console.log = original.log;
    console.error = original.error;
  }
});
