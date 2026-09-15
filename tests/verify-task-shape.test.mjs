// Los campos de una tarea que NINGÚN gate leía, y ahora sí.
//
// MEDIDO el 2026-09-15 sobre `docs/tasks.json`, `templates/tasks.json` y los dos únicos scripts que
// abren ese archivo —`verify-plan-conflicts.mjs` y `verify-scope-diff.mjs`—: de los 20 campos de una
// tarea, **un gate leía 6** (`id`, `depends_on`, `files_to_create`, `files_to_modify`, `test_files`,
// `status`). Los otros 14 los sostenía únicamente la narrativa, y una obligación que sólo vive en
// prosa se cumple mientras alguien se acuerde.
//
// LAS REGLAS NO SON INVENTADAS ACÁ. Están escritas hace meses en `skills/orchestrator-opus.md`
// § MINIMAL AI-COMPANY TASK MODEL, con una tabla campo por campo. Lo que faltaba no era la regla:
// era que algo la leyera. Este gate no agrega doctrina, mecaniza la que ya estaba.
//
// LOS DOS VERDES FALSOS QUE CIERRA, los dos comprobados contra el plan real de este repositorio:
//
//   `approval_criteria` — la tabla dice «the spec.md AC-id this task closes, verbatim». **Dos de las
//   seis tareas del plan real no nombran ningún AC**, y una tarea podía citar AC9 sobre una spec que
//   llega hasta AC5 sin que nadie se enterara. Es el puente entre el plan y la spec, sin comprobar.
//
//   `verifier` — la tabla lo define como «the mechanical check ... **never** the role that wrote the
//   artifact being checked», y el template lo repite: «not a persona — no role certifies its own
//   gate». Esa regla vivía sólo en prosa: nada impedía escribir ahí el nombre del rol que escribió.
//
// LO QUE ESTE GATE NO INTENTA. No todos los catorce se pueden comprobar, y forzarlo empujaría
// mentiras al dato — el error que este repositorio ya cometió con la matriz de stacks. `description`,
// `goal`, `rollback` y `handoff` son texto para una persona: se exige que digan algo, nunca que digan
// la verdad. `depends_on` no se toca: ya lo valida entero `verify-plan-conflicts.mjs`, incluidas las
// referencias colgantes, y duplicar un check es duplicar el lugar donde se rompe.

import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-task-shape.mjs');
const {
  ESTADOS, MIN_TEXTO, NARRATIVOS, USAGE, main, validarTareas,
} = await import(pathToFileURL(script).href);

const texto = (base) => `${base}, con texto suficiente para no ser relleno.`;

const ROLES = ['orchestrator', 'test-engineer', 'builder', 'triangulator', 'docs', 'reviewer'];
const CRITERIOS = ['AC1', 'AC2'];
const SUBAGENTES = ['red', 'green', 'triangulate', 'refactor', 'docs', 'chore'];

const tarea = (over = {}) => ({
  id: 'T01',
  description: texto('Endurecer la función de suma para que valide sus entradas'),
  files_to_create: [],
  files_to_modify: ['scripts/util.mjs'],
  test_files: ['tests/util.test.mjs'],
  test_types: ['unit'],
  subagents: ['red', 'green'],
  depends_on: [],
  status: 'pending',
  goal: texto('Cierra AC1 de la spec, que pide que rechace lo que no es un número'),
  owner: null,
  locked: false,
  role: 'builder',
  verifier: 'node --test tests/util.test.mjs',
  approval_criteria: texto('AC1 de docs/spec.md nombrado por una prueba; una entrada de texto rechaza'),
  evidence: [],
  not_reviewed: [],
  rollback: texto('Revertir el commit de la tarea, que no toca datos'),
  handoff: texto('RED pasa y sigue el constructor con el GREEN'),
  blocked_reason: null,
  access_needed: 'ninguno',
  ...over,
});

const ctx = (over = {}) => ({ roles: ROLES, criterios: CRITERIOS, subagentes: SUBAGENTES, ...over });

test('un uso inválido sale 2 y no se confunde con un rechazo', () => {
  const errores = [];
  for (const args of [[], ['otra'], ['check'], ['check', 'a', 'b']]) {
    errores.length = 0;
    const code = main(args, { write: () => {}, writeError: (l) => errores.push(l) });
    assert.equal(code, 2, JSON.stringify(args));
    assert.ok(errores.some((l) => l === USAGE), errores.join('\n'));
  }
});

test('una tarea completa y coherente no tiene violaciones', () => {
  assert.deepEqual(validarTareas([tarea()], ctx()), []);
});

test('EL VERDE FALSO · un criterio de aprobación que la spec NO declara se rechaza', () => {
  // La tabla del modelo de tareas dice «the spec.md AC-id this task closes, verbatim». Una tarea
  // podía decir que la aprueba AC9 sobre una spec que llega hasta AC2, y nadie miraba.
  const v = validarTareas([tarea({ approval_criteria: texto('AC9 de docs/spec.md nombrado por una prueba') })], ctx());
  assert.ok(v.some((x) => /AC9/u.test(x) && /spec/u.test(x)), v.join(' | '));
});

test('EL VERDE FALSO · un criterio de aprobación que no nombra ningún AC se rechaza', () => {
  // Éste es el caso REAL: dos de las seis tareas del plan de este repositorio describían su criterio
  // en prosa sin nombrar un AC. Suena a criterio y no es trazable a nada.
  const v = validarTareas([tarea({ approval_criteria: texto('Los ocho servicios presentes, cada uno con su fecha') })], ctx());
  assert.ok(v.some((x) => /approval_criteria/u.test(x)), v.join(' | '));

  for (const vacio of ['', '   ', null, 'tbd']) {
    assert.ok(validarTareas([tarea({ approval_criteria: vacio })], ctx()).some((x) => /approval_criteria/u.test(x)),
      `${JSON.stringify(vacio)} tendría que rechazar`);
  }
});

test('sin spec legible no se puede comprobar el AC, y eso NO se convierte en aprobación', () => {
  // `criterios: null` es «no sé qué declara la spec». Se sigue exigiendo texto, y el mensaje dice
  // que la parte fuerte del check no corrió: un verde que no comprobó no puede leerse como uno que sí.
  const sinSpec = ctx({ criterios: null });
  assert.deepEqual(validarTareas([tarea({ approval_criteria: texto('Lo que sea, sin AC a la vista') })], sinSpec), []);
  assert.ok(validarTareas([tarea({ approval_criteria: '' })], sinSpec).some((x) => /approval_criteria/u.test(x)));
});

test('SEPARACIÓN · el verificador es un comando, nunca el rol que escribió', () => {
  // `skills/orchestrator-opus.md`: «the mechanical check that certifies this task's current gate —
  // never the role that wrote the artifact being checked». El template lo repite: «not a persona».
  for (const persona of ['builder', 'Builder', 'test-engineer']) {
    const v = validarTareas([tarea({ verifier: persona })], ctx());
    assert.ok(v.some((x) => /verifier/u.test(x) && /persona|rol/iu.test(x)), `${persona}: ${v.join(' | ')}`);
  }
  assert.deepEqual(validarTareas([tarea({ verifier: 'bash scripts/verify-red.sh "node --test" tests/util.test.mjs' })], ctx()), []);
  assert.ok(validarTareas([tarea({ verifier: '' })], ctx()).some((x) => /verifier/u.test(x)));
});

test('el rol tiene que existir en la matriz de capacidades, sin importar mayúsculas', () => {
  assert.deepEqual(validarTareas([tarea({ role: 'Builder' })], ctx()), []);
  assert.ok(validarTareas([tarea({ role: 'inventado' })], ctx()).some((v) => /role/u.test(v)));
});

test('cada subagente nombrado tiene que tener su skill en el árbol', () => {
  // No es un enum escrito a mano: la lista sale de `skills/subagent-*.md`. Un subagente que se
  // nombra y no existe es una instrucción a un rol que nadie definió.
  assert.deepEqual(validarTareas([tarea({ subagents: [] })], ctx()), []);
  assert.ok(validarTareas([tarea({ subagents: ['red', 'inventado'] })], ctx()).some((v) => /subagents/u.test(v)));
});

test('el estado es un conjunto cerrado, y es el ciclo de vida que el protocolo declara', () => {
  assert.deepEqual([...ESTADOS], ['pending', 'red', 'green', 'triangulate', 'refactor', 'done', 'blocked']);
  assert.ok(validarTareas([tarea({ status: 'casi' })], ctx()).some((v) => /status/u.test(v)));
});

test('una tarea bloqueada dice por qué, y una que no lo está no inventa un motivo', () => {
  assert.ok(validarTareas([tarea({ status: 'blocked', blocked_reason: null })], ctx())
    .some((v) => /blocked_reason/u.test(v)));
  assert.ok(validarTareas([tarea({ status: 'blocked', blocked_reason: '' })], ctx())
    .some((v) => /blocked_reason/u.test(v)), 'vacío es tan ausente como nulo');
  assert.deepEqual(validarTareas([tarea({
    status: 'blocked',
    blocked_reason: texto('Falta un acceso al registro y no lo tengo'),
    evidence: ['El gate rechazó tres veces por el mismo motivo, anotado en el informe'],
  })], ctx()), []);
  assert.ok(validarTareas([tarea({ status: 'pending', blocked_reason: texto('Un motivo cualquiera') })], ctx())
    .some((v) => /blocked_reason/u.test(v)));
});

test('TERMINADA SIN EVIDENCIA no es terminada', () => {
  // La única invariante con dientes sobre `evidence`: el gate no puede saber si la evidencia es
  // cierta, pero sí que una tarea declarada hecha no tenga ninguna.
  assert.ok(validarTareas([tarea({ status: 'done', evidence: [] })], ctx()).some((v) => /evidence/u.test(v)));
  assert.deepEqual(validarTareas([tarea({
    status: 'done',
    evidence: ['tests/util.test.mjs verde, corrido con node --test el 2026-09-15'],
  })], ctx()), []);
});

test('una tarea tomada tiene dueño; haber tenido dueño y estar libre es normal', () => {
  assert.ok(validarTareas([tarea({ locked: true, owner: null })], ctx()).some((v) => /owner/u.test(v)));
  assert.deepEqual(validarTareas([tarea({ locked: true, owner: 'builder-1757900000' })], ctx()), []);
  // Lo inverso NO es un incumplimiento: una tarea terminada guarda quién la hizo y ya no está tomada.
  assert.deepEqual(validarTareas([tarea({ locked: false, owner: 'Constructor' })], ctx()), []);
});

test('declarar archivos de prueba sin decir de qué tipo son, o al revés, es media declaración', () => {
  assert.deepEqual(validarTareas([tarea({ test_files: [], test_types: [] })], ctx()), []);
  assert.ok(validarTareas([tarea({ test_files: ['tests/x.test.mjs'], test_types: [] })], ctx())
    .some((v) => /test_types/u.test(v)));
  assert.ok(validarTareas([tarea({ test_files: [], test_types: ['unit'] })], ctx())
    .some((v) => /test_files/u.test(v)));
});

test('ACCESO · cada tarea dice qué acceso necesita, o «ninguno» explícito', () => {
  // Se mudó acá desde `implementation.json`, el plan duplicado de la fase 2 que se elimina. Saber
  // que una tarea necesita una credencial que no tenés te frena antes de empezar, no a la mitad.
  assert.deepEqual(validarTareas([tarea({ access_needed: 'ninguno' })], ctx()), []);
  assert.deepEqual(validarTareas([tarea({ access_needed: texto('Token de lectura del registro de paquetes') })], ctx()), []);
  for (const vacio of ['', '   ', null, 'tbd']) {
    assert.ok(validarTareas([tarea({ access_needed: vacio })], ctx()).some((v) => /access_needed/u.test(v)),
      `${JSON.stringify(vacio)} tendría que rechazar`);
  }
});

test('evidencia y límites de revisión son listas, y cada entrada dice algo', () => {
  assert.deepEqual(validarTareas([tarea({
    evidence: [{ gate: 'verify-red.sh', command: 'bash verify-red.sh a b', output_tail: 'STATUS: pass', timestamp: '2026-09-15T00:00:00Z' }],
    not_reviewed: [{ gate: 'verify-assert-order.mjs', declaration: texto('No verifica el orden real'), report_path: '.vibe/handoffs/x.md' }],
  })], ctx()), []);

  // Un objeto a medias es peor que un puntero en texto: parece estructurado y no lo está.
  assert.ok(validarTareas([tarea({ evidence: [{ gate: 'x' }] })], ctx()).some((v) => /evidence/u.test(v)));
  assert.ok(validarTareas([tarea({ not_reviewed: [{ gate: 'x', declaration: 'corto', report_path: 'p' }] })], ctx())
    .some((v) => /not_reviewed/u.test(v)));
  assert.ok(validarTareas([tarea({ evidence: 'no es una lista' })], ctx()).some((v) => /evidence/u.test(v)));
  assert.ok(validarTareas([tarea({ not_reviewed: 'no es una lista' })], ctx()).some((v) => /not_reviewed/u.test(v)));
});

test('los campos narrativos se exigen escritos, NUNCA verdaderos, y están declarados como tales', () => {
  assert.deepEqual([...NARRATIVOS].sort(), ['description', 'goal', 'handoff', 'rollback']);
  for (const campo of NARRATIVOS) {
    assert.ok(validarTareas([tarea({ [campo]: 'corto' })], ctx()).some((v) => new RegExp(campo, 'u').test(v)), campo);
  }
  assert.ok(MIN_TEXTO >= 20);
});

test('FALSIFICACIÓN · una tarea que no es un objeto, o sin id, se nombra por su posición', () => {
  assert.ok(validarTareas(['no es un objeto'], ctx()).some((v) => /tasks\[0\]/u.test(v)));
  assert.ok(validarTareas([tarea({ id: '' })], ctx()).some((v) => /id/u.test(v)));
  assert.ok(validarTareas([tarea({ id: 'T01' }), tarea({ id: 'T01' })], ctx()).some((v) => /repite/u.test(v)));
});

test('FALSIFICACIÓN · un campo que falta se nombra, y no se toma por vacío', () => {
  for (const campo of ['role', 'verifier', 'approval_criteria', 'access_needed', 'status']) {
    const t = tarea();
    delete t[campo];
    assert.ok(validarTareas([t], ctx()).some((v) => new RegExp(campo, 'u').test(v)), campo);
  }
});

test('FALSIFICACION · un campo de lista que llega como texto se rechaza, no se recorre letra por letra', () => {
  // Encontrado revisando el gate contra si mismo: `for (const n of t.subagents)` sobre la cadena
  // "red" recorre 'r', 'e', 'd' y escupe tres violaciones sin sentido. Y `test_types: "unit"` no
  // entraba en ninguna rama, asi que pasaba callado. `verify-plan-conflicts.mjs` ya exige que
  // `files_to_*` y `test_files` sean listas; estos dos campos no los mira nadie mas.
  const porSubagentes = validarTareas([tarea({ subagents: 'red' })], ctx());
  assert.ok(porSubagentes.some((v) => /subagents/u.test(v) && /lista/u.test(v)), porSubagentes.join(' | '));
  assert.equal(porSubagentes.length, 1, `una violacion, no una por letra: ${porSubagentes.join(' | ')}`);

  assert.ok(validarTareas([tarea({ test_types: 'unit' })], ctx()).some((v) => /test_types/u.test(v) && /lista/u.test(v)));
});

test('FALSIFICACION · locked tiene que ser un booleano, no algo que se le parezca', () => {
  // `locked: "yes"` no es `=== true`, asi que la tarea quedaba sin candado Y sin exigencia de dueno:
  // una cadena que parece decir que si, tratada como un no.
  assert.ok(validarTareas([tarea({ locked: 'yes' })], ctx()).some((v) => /locked/u.test(v)));
  assert.deepEqual(validarTareas([tarea({ locked: false })], ctx()), []);
});

test('sin plan no hay nada que comprobar, y eso no es un incumplimiento', () => {
  const salida = [];
  const code = main(['check', 'docs/tasks.json'], {
    leer: () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); },
    write: (l) => salida.push(l),
    writeError: () => {},
  });
  assert.equal(code, 0);
  assert.ok(/^VACÍO: /u.test(salida.at(-1)), salida.join('\n'));
});

test('un plan ilegible es un defecto, no una ausencia', () => {
  const errores = [];
  const code = main(['check', 'docs/tasks.json'], {
    leer: () => { throw new SyntaxError('Unexpected token'); },
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /REJECTED/u.test(l)), errores.join('\n'));
});

// --- LO QUE `main` HACE CUANDO SU PROPIO ENTORNO FALLA --------------------------------------------
//
// Estas pruebas existen porque la cobertura las pidio, y pedirlas tenia razon: cada una es un estado
// en el que el gate podria haber aprobado sin comprobar. Un runtime sin matriz, un runtime sin
// skills, un plan que no es un objeto, una spec ausente. Ninguno de esos es «el plan esta bien».

/** Un runtime de mentira: la matriz y las skills, que es todo lo que este gate le pide al runtime. */
function runtimeFalso(conMatriz = true, conSkills = true) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-task-shape-'));
  if (conMatriz) {
    mkdirSync(join(root, 'contracts'), { recursive: true });
    cpSync(join(repoRoot, 'contracts', 'capability-matrix.json'), join(root, 'contracts', 'capability-matrix.json'));
  }
  if (conSkills) {
    mkdirSync(join(root, 'skills'), { recursive: true });
    writeFileSync(join(root, 'skills', 'subagent-red.md'), '# red\n', 'utf8');
    writeFileSync(join(root, 'skills', 'no-es-subagente.md'), '# otro\n', 'utf8');
  }
  return root;
}

const planMinimo = (over = {}) => ({ feature: 'demo', spec: 'docs/spec.md', tasks: [tarea(over)] });

test('sin la matriz del runtime el gate RECHAZA, porque aprobar sin comprobar seria peor', () => {
  const runtime = runtimeFalso(false);
  try {
    const errores = [];
    const code = main(['check', 'docs/tasks.json'], {
      runtimeRoot: runtime,
      leer: () => planMinimo(),
      write: () => {},
      writeError: (l) => errores.push(l),
    });
    assert.equal(code, 1);
    assert.match(errores.join('\n'), /capability-matrix\.json/u);
  } finally {
    rmSync(runtime, { recursive: true, force: true });
  }
});

test('una matriz sin la clave roles es una matriz rota, y el rechazo culpa al runtime y no al plan', () => {
  const runtime = runtimeFalso();
  try {
    writeFileSync(join(runtime, 'contracts', 'capability-matrix.json'), '{"schema":"x"}', 'utf8');
    const errores = [];
    const code = main(['check', 'docs/tasks.json'], {
      runtimeRoot: runtime,
      leer: () => planMinimo(),
      write: () => {},
      writeError: (l) => errores.push(l),
    });
    assert.equal(code, 1);
    assert.match(errores.join('\n'), /capability-matrix\.json/u, 'el mensaje tiene que nombrar el archivo del runtime');
  } finally {
    rmSync(runtime, { recursive: true, force: true });
  }
});

test('sin el arbol de skills del runtime el gate RECHAZA', () => {
  const runtime = runtimeFalso(true, false);
  try {
    const errores = [];
    const code = main(['check', 'docs/tasks.json'], {
      runtimeRoot: runtime,
      leer: () => planMinimo(),
      write: () => {},
      writeError: (l) => errores.push(l),
    });
    assert.equal(code, 1);
    assert.match(errores.join('\n'), /skills/u);
  } finally {
    rmSync(runtime, { recursive: true, force: true });
  }
});

test('SIN SPEC el gate sigue comprobando lo demas, y dice con todas las letras que NO comprobo', () => {
  // La parte fuerte del check no corrio. Un verde que calle eso se lee igual que uno que si comprobo.
  const runtime = runtimeFalso();
  const proyecto = mkdtempSync(join(tmpdir(), 'vcp-task-shape-proj-'));
  try {
    const salida = [];
    const code = main(['check', 'docs/tasks.json'], {
      runtimeRoot: runtime,
      cwd: proyecto,
      leer: () => ({ feature: 'demo', tasks: [tarea({ subagents: ['red'], approval_criteria: texto('Cierra lo que la spec pida cuando exista') })] }),
      write: (l) => salida.push(l),
      writeError: () => {},
    });
    assert.equal(code, 0, salida.join('\n'));
    assert.match(salida.join('\n'), /NO se comprobó que los AC citados existan/u);
    assert.match(salida.join('\n'), /docs\/spec\.md/u, 'sin campo spec, cae en la ruta por defecto y la nombra');
  } finally {
    rmSync(runtime, { recursive: true, force: true });
    rmSync(proyecto, { recursive: true, force: true });
  }
});

test('CON spec, el verde dice contra cuantos criterios se comprobo', () => {
  const runtime = runtimeFalso();
  const proyecto = mkdtempSync(join(tmpdir(), 'vcp-task-shape-proj-'));
  try {
    mkdirSync(join(proyecto, 'docs'), { recursive: true });
    writeFileSync(join(proyecto, 'docs', 'spec.md'), [
      '# Spec: demo',
      '',
      '## Acceptance Criteria / Criterios de aceptación',
      '- [ ] **AC1:** GIVEN algo, WHEN pasa, THEN falla.',
      '',
    ].join('\n'), 'utf8');

    const salida = [];
    const errores = [];
    const code = main(['check', 'docs/tasks.json'], {
      runtimeRoot: runtime,
      cwd: proyecto,
      leer: () => planMinimo({ subagents: ['red'] }),
      write: (l) => salida.push(l),
      writeError: (l) => errores.push(l),
    });
    assert.equal(code, 0, errores.join('\n'));
    assert.match(salida.join('\n'), /1 criterio\(s\)/u);
  } finally {
    rmSync(runtime, { recursive: true, force: true });
    rmSync(proyecto, { recursive: true, force: true });
  }
});

test('un plan que no es un objeto, o sin lista tasks, se rechaza antes de mirar nada', () => {
  const runtime = runtimeFalso();
  try {
    for (const doc of ['no es un objeto', null, { feature: 'demo' }, { tasks: 'no es una lista' }]) {
      const errores = [];
      const code = main(['check', 'docs/tasks.json'], {
        runtimeRoot: runtime,
        leer: () => doc,
        write: () => {},
        writeError: (l) => errores.push(l),
      });
      assert.equal(code, 1, JSON.stringify(doc));
      assert.match(errores.join('\n'), /lista tasks/u);
    }
  } finally {
    rmSync(runtime, { recursive: true, force: true });
  }
});

test('una violacion real sale por el CLI nombrando el archivo del plan', () => {
  const runtime = runtimeFalso();
  try {
    const errores = [];
    const code = main(['check', 'docs/tasks.json'], {
      runtimeRoot: runtime,
      leer: () => planMinimo({ role: 'inventado', subagents: ['red'] }),
      write: () => {},
      writeError: (l) => errores.push(l),
    });
    assert.equal(code, 1);
    assert.match(errores.join('\n'), /^REJECTED: docs\/tasks\.json: /mu);
  } finally {
    rmSync(runtime, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · lo que no es ni texto ni objeto no es una evidencia', () => {
  for (const basura of [42, ['una lista'], null, true]) {
    assert.ok(validarTareas([tarea({ evidence: [basura] })], ctx()).some((v) => /evidence/u.test(v)),
      `${JSON.stringify(basura)} tendria que rechazar`);
  }
});

test('FALSIFICACIÓN · tasks que no es una lista se rechaza sin recorrer nada', () => {
  assert.deepEqual(validarTareas('no es una lista', ctx()), ['tasks debe ser una lista de tareas']);
});

test('FALSIFICACIÓN · un rol nulo no se confunde con un rol llamado «null»', () => {
  assert.ok(validarTareas([tarea({ role: null })], ctx()).some((v) => /role/u.test(v)));
  assert.ok(validarTareas([tarea({ role: undefined })], ctx()).some((v) => /role/u.test(v)));
});

test('una spec LEIDA que no declara ningun criterio no es lo mismo que una spec ausente', () => {
  // `[]` es «la lei y no declara ninguno»; `null` es «no la pude leer». La primera rechaza cualquier
  // cita, y el mensaje tiene que decir que la spec no declara ninguno en vez de quedar en blanco.
  const v = validarTareas([tarea()], ctx({ criterios: [] }));
  assert.ok(v.some((x) => /ninguno/u.test(x)), v.join(' | '));
});

test('un plan que rompe al leerse lanzando algo que NO es un Error igual se reporta', () => {
  // `leer` es inyectable: por ahi puede llegar cualquier cosa lanzada. Un gate que se rompiera al
  // formatear el mensaje de error convertiria un archivo corrupto en una cuelga sin explicacion.
  const errores = [];
  const code = main(['check', 'docs/tasks.json'], {
    leer: () => { throw 'el plan es una cadena rota'; },
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /el plan es una cadena rota/u);
});

test('con una spec que no declara NINGUN criterio, el rechazo lo dice en vez de quedar en blanco', () => {
  // `La spec declara ` seguido de nada se lee como un error del gate. Dice «ninguno», que es el dato.
  const v = validarTareas([tarea({ approval_criteria: texto('Que quede andando, sin nombrar criterio alguno') })], ctx({ criterios: [] }));
  assert.ok(v.some((x) => /no nombra ningún AC/u.test(x) && /ninguno/u.test(x)), v.join(' | '));
});

test('EL PLAN REAL de este repositorio pasa su propia comprobación', () => {
  const salida = [];
  const errores = [];
  const code = main(['check', 'docs/tasks.json'], {
    cwd: repoRoot,
    write: (l) => salida.push(l),
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 0, errores.join('\n'));
  assert.ok(salida.some((l) => /^LIMITE: /u.test(l)), 'el gate tiene que declarar qué NO comprueba');
});
