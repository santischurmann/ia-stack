// SCAVENGE · Leer el código ANTES de decidir, y dejarlo escrito.
//
// EL HUECO QUE CIERRA, medido sobre las 2207 líneas de SKILL.md el 2026-09-15: **ningún paso previo
// a la spec lee ni razona sobre el código del proyecto**. El inventario completo de lo que tocaba el
// repo era `ls package.json pyproject.toml …` para olfatear el stack, leer `.vibe/*.md` que es
// memoria del protocolo, y enumerar archivos de contexto — cuya salida era **un número para
// enrutar**, que ningún gate validaba y ningún script leía.
//
// Consecuencia: todo el «encontrar huecos y revisar la lógica» ocurría DESPUÉS. El escaneo de
// `[NEEDS CLARIFICATION:` en la fase 3, `verify-plan-conflicts` en la 4, y `verify-scope-diff`
// **después del GREEN** en la 5. Los huecos del plan se descubrían con el código ya escrito, que es
// el momento más caro posible.
//
// POR QUÉ EL LOCATOR SE ABRE Y NO SÓLO SE MIRA. El gate hermano `verify-research-candidates.mjs`
// valida que un locator tenga la FORMA `archivo:línea`, pero nunca abre el archivo. Para research
// alcanza: la fuente vive en otro repositorio. Acá no: la afirmación es «esto ya existe en TU
// código y se puede reusar», así que el gate abre el archivo y comprueba que esa línea exista. Una
// afirmación de reuso que apunta a una línea inexistente es exactamente el modo de falla que este
// paso viene a impedir.
//
// LÍMITE HONESTO, declarado desde el primer día: comprueba que el locator resuelva a una línea real.
// NO comprueba que esa línea diga lo que la entrada afirma, ni que alguien haya leído el código de
// verdad. Un scavenge coherente e inventado que apunte a líneas que existen pasa en verde.

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-scavenge.mjs');
const {
  ALCANCES, FORMA_LOCATOR, MIN_TEXTO, SCHEMA, USAGE, main, validarScavenge,
} = await import(pathToFileURL(script).href);

const texto = (base) => `${base}, con texto suficiente para no ser relleno.`;

const scavenge = (over = {}) => ({
  schema: SCHEMA,
  feature: 'mi-funcionalidad',
  date: '2026-09-15',
  scope: 'corto',
  reusable: [{ id: 'R1', what: texto('Ya existe un validador de rutas contenidas que sirve igual'), locator: 'scripts/existe.mjs:2' }],
  missing: [{ id: 'M1', what: texto('No hay ningún lugar donde se declare el período de vencimiento') }],
  breaks: [{ id: 'B1', what: texto('Cambiar la firma rompe a quien la llama desde el despachador'), locator: 'scripts/existe.mjs:3' }],
  unknowns: [{ id: 'U1', question: texto('No se sabe si el despachador tolera un adaptador ausente'), how_to_answer: texto('Correrlo contra un contrato sin esa fila y mirar el código de salida') }],
  ...over,
});

/** Un proyecto descartable con un archivo real de tres líneas, para que los locators resuelvan. */
function proyecto(extra = {}) {
  const d = mkdtempSync(join(tmpdir(), 'vcp-scavenge-'));
  mkdirSync(join(d, 'scripts'), { recursive: true });
  writeFileSync(join(d, 'scripts', 'existe.mjs'), 'linea uno\nlinea dos\nlinea tres\n', 'utf8');
  for (const [nombre, contenido] of Object.entries(extra)) {
    mkdirSync(dirname(join(d, nombre)), { recursive: true });
    writeFileSync(join(d, nombre), contenido, 'utf8');
  }
  return d;
}

function correr(args, over = {}) {
  const salida = [];
  const errores = [];
  const code = main(args, {
    cwd: over.cwd ?? '.',
    leer: () => scavenge(),
    write: (l) => salida.push(l),
    writeError: (l) => errores.push(l),
    ...over,
  });
  return { code, salida, errores };
}

test('un uso inválido sale 2 y no se confunde con un rechazo', () => {
  for (const args of [[], ['otra'], ['check'], ['check', 'a', 'b']]) {
    const { code, errores } = correr(args);
    assert.equal(code, 2, JSON.stringify(args));
    assert.ok(errores.some((l) => l === USAGE), errores.join('\n'));
  }
});

test('sin archivo de scavenge escribe VACÍO y sale 0, sin decir OK', () => {
  const { code, salida } = correr(['check', 'docs/scavenge/x.json'], {
    leer: () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); },
  });
  assert.equal(code, 0);
  assert.ok(/^VACÍO: /u.test(salida.at(-1)), salida.join('\n'));
  assert.ok(!salida.some((l) => /^OK: /u.test(l)), 'un proyecto que todavía no miró su código no compra un OK');
});

test('un scavenge completo aprueba, y declara qué NO puede comprobar', () => {
  const d = proyecto();
  try {
    const { code, salida, errores } = correr(['check', 'docs/scavenge/x.json'], { cwd: d });
    assert.equal(code, 0, errores.join('\n'));
    assert.ok(salida.some((l) => /^OK: /u.test(l)), salida.join('\n'));
    const limite = salida.find((l) => /^LIMITE|^LÍMITE/u.test(l));
    assert.ok(limite, salida.join('\n'));
    assert.ok(/no comprueba|NO comprueba/u.test(limite), limite);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('EL CORAZÓN · un locator que apunta a una línea que NO existe se rechaza', () => {
  // La afirmación es «esto ya existe en tu código». Si la línea no está, la afirmación es falsa, y
  // este es exactamente el modo de falla que el paso viene a impedir.
  const d = proyecto();
  try {
    const { code, errores } = correr(['check', 'docs/scavenge/x.json'], {
      cwd: d,
      leer: () => scavenge({ reusable: [{ id: 'R1', what: texto('Algo que dice existir'), locator: 'scripts/existe.mjs:99' }] }),
    });
    assert.equal(code, 1);
    assert.ok(errores.some((l) => /99/u.test(l) && /l[íi]nea/u.test(l)), errores.join('\n'));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('un locator que apunta a un archivo que no existe se rechaza', () => {
  const d = proyecto();
  try {
    const { code, errores } = correr(['check', 'docs/scavenge/x.json'], {
      cwd: d,
      leer: () => scavenge({ reusable: [{ id: 'R1', what: texto('Algo que dice existir'), locator: 'scripts/fantasma.mjs:1' }] }),
    });
    assert.equal(code, 1);
    assert.ok(errores.some((l) => /fantasma/u.test(l)), errores.join('\n'));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('un locator que se escapa del proyecto se rechaza antes de abrir nada', () => {
  const d = proyecto();
  const abiertos = [];
  try {
    for (const fuga of ['../afuera/x.mjs:1', '/etc/passwd:1', 'scripts/../../x.mjs:1']) {
      const { code, errores } = correr(['check', 'docs/scavenge/x.json'], {
        cwd: d,
        leer: () => scavenge({ reusable: [{ id: 'R1', what: texto('Algo de afuera'), locator: fuga }] }),
        abrir: (r) => { abiertos.push(r); return 'x'; },
      });
      assert.equal(code, 1, fuga);
      assert.ok(errores.some((l) => /proyecto/u.test(l)), `${fuga}: ${errores.join('\n')}`);
    }
    assert.deepEqual(abiertos, [], 'abrió un archivo de afuera antes de rechazarlo');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('EL CASO QUE MOTIVA TODO · un scavenge con las cuatro listas vacías se rechaza', () => {
  // Cuatro listas vacías no es «miré y no había nada»: es no haber mirado. Aceptarlo convertiría el
  // paso en un archivo que se crea para destrabar el gate, que es justo lo que no puede pasar.
  const violaciones = validarScavenge(scavenge({ reusable: [], missing: [], breaks: [], unknowns: [] }));
  assert.ok(violaciones.some((v) => /vac[íi]a|no mir|al menos/u.test(v)), violaciones.join(' | '));
});

test('FALSIFICACIÓN · la forma del documento se comprueba campo por campo', () => {
  assert.deepEqual(validarScavenge(scavenge()), []);
  assert.ok(validarScavenge(null).some((v) => /objeto/u.test(v)));
  assert.ok(validarScavenge({ ...scavenge(), schema: 'otro' }).some((v) => /schema/u.test(v)));
  assert.ok(validarScavenge({ ...scavenge(), extra: 1 }).some((v) => /exactamente/u.test(v)));
  assert.ok(validarScavenge(scavenge({ feature: '' })).some((v) => /feature/u.test(v)));
  assert.ok(validarScavenge(scavenge({ date: '15-09-2026' })).some((v) => /date/u.test(v)));
  assert.ok(validarScavenge(scavenge({ scope: 'mediano' })).some((v) => /scope/u.test(v)));
  assert.ok(validarScavenge(scavenge({ reusable: 'no es lista' })).some((v) => /reusable/u.test(v)));
});

test('FALSIFICACIÓN · un texto de relleno no es un hallazgo', () => {
  for (const relleno of ['', 'tbd', 'pendiente', 'x'.repeat(MIN_TEXTO - 1)]) {
    const violaciones = validarScavenge(scavenge({
      missing: [{ id: 'M1', what: relleno }],
    }));
    assert.ok(violaciones.some((v) => /M1|what/u.test(v)), `${JSON.stringify(relleno)}: ${violaciones.join(' | ')}`);
  }
});

test('FALSIFICACIÓN · los identificadores no se repiten entre listas', () => {
  // Con ids repetidos, señalar un hallazgo en una revisión posterior deja de ser posible.
  const violaciones = validarScavenge(scavenge({
    missing: [{ id: 'R1', what: texto('Usa el mismo id que un reusable') }],
  }));
  assert.ok(violaciones.some((v) => /repetid|duplicad|R1/u.test(v)), violaciones.join(' | '));
});

test('FALSIFICACIÓN · una pregunta abierta tiene que decir CÓMO se contesta', () => {
  // Una lista de dudas sin forma de resolverlas es una lista de dudas, no un plan para sacarlas.
  const violaciones = validarScavenge(scavenge({
    unknowns: [{ id: 'U1', question: texto('Algo que no se sabe'), how_to_answer: 'tbd' }],
  }));
  assert.ok(violaciones.some((v) => /how_to_answer|c[óo]mo/u.test(v)), violaciones.join(' | '));
});

test('lo que falta y lo que se rompe pueden no tener locator, porque todavía no existen', () => {
  // Asimetría a propósito: «esto ya existe» tiene que probarse con una línea real; «esto falta» no
  // puede, porque justamente no está. Exigir un locator ahí obligaría a inventarlo.
  const d = proyecto();
  try {
    const { code, errores } = correr(['check', 'docs/scavenge/x.json'], {
      cwd: d,
      leer: () => scavenge({ breaks: [{ id: 'B1', what: texto('Algo se va a romper y todavía no sé dónde') }] }),
    });
    assert.equal(code, 0, errores.join('\n'));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('FORMA_LOCATOR acepta archivo:línea y rechaza todo lo demás', () => {
  for (const bueno of ['a.mjs:1', 'scripts/x/y.mjs:1234', 'docs/a-b_c.md:7']) {
    assert.ok(FORMA_LOCATOR.test(bueno), bueno);
  }
  for (const malo of ['a.mjs', 'a.mjs:0', 'a.mjs:-3', 'a.mjs:x', ':4', 'a.mjs:1:2']) {
    assert.ok(!FORMA_LOCATOR.test(malo), malo);
  }
});

test('los dos alcances son un conjunto cerrado', () => {
  assert.deepEqual([...ALCANCES].sort(), ['completo', 'corto']);
});
