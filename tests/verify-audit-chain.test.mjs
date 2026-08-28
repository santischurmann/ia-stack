import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-audit-chain.mjs');
const {
  USAGE,
  APPEND_USAGE,
  LEGACY_PREFIX_ALLOWED,
  chainHashFor,
  parseAuditLines,
  sealLineFor,
  verifyChain,
  gitVersions,
  verifyGrowth,
  historyCommand,
  main,
} = await import(pathToFileURL(script).href);

/** Independent oracle. Fixtures are never built with chainHashFor: a broken chainHashFor would
 * still produce a self-consistent chain and every verification test would pass on nothing. */
function sha256Chain(previousChain, lineWithoutChain) {
  return createHash('sha256').update(`${previousChain}\n${lineWithoutChain}`, 'utf8').digest('hex');
}

function chained(texts, previousChain = '') {
  let previous = previousChain;
  return texts.map((text) => {
    previous = sha256Chain(previous, text);
    return `${text} | chain:${previous}`;
  });
}

// The fixtures deliberately contain no standalone 1/2/3 digit, so asserting that a message names
// line N cannot be satisfied by a digit that leaked in from the echoed audit text.
const LINE_A = '[2026-08-27 21:40] Orchestrator | plan aprobado | docs/plan.md + docs/tasks.json | fase-plan';
const LINE_B = '[2026-08-27 21:45] Orchestrator | subagentes configurados | Opus effort max | fase-build';
const LINE_C = '[2026-08-27 21:50] Test-Engineer | T01 RED escrito | tests/verify-audit-chain.test.mjs | fase-red';

/** Cómo borra los sellos un atacante que no quiere recalcular nada: deja el sufijo a la vista pero
 * sin hash. El oráculo lo hace con su propia regex, no con la del script bajo prueba. */
const blankSeals = (lines) => lines.map((line) => line.replace(/ \| chain:[0-9a-f]{64}$/u, ' | chain:BORRADO'));

test('chainHashFor encadena sha256(previa + LF + línea) y mezcla ambas entradas', () => {
  const first = chainHashFor('', LINE_A);
  assert.equal(first, sha256Chain('', LINE_A));
  assert.match(first, /^[0-9a-f]{64}$/u);

  const second = chainHashFor(first, LINE_B);
  assert.equal(second, sha256Chain(first, LINE_B));
  assert.notEqual(second, chainHashFor(first, `${LINE_B}.`), 'un carácter de más en la línea debe cambiar el hash');
  assert.notEqual(second, chainHashFor(sha256Chain('', LINE_C), LINE_B), 'la misma línea bajo otra predecesora debe encadenar distinto');
});

test('parseAuditLines numera 1-based sobre el archivo, saltea blancos y distingue sello, texto heredado y sello roto', () => {
  const hash = sha256Chain('', LINE_B);
  const content = ['', LINE_A, '   ', `${LINE_B} | chain:${hash}`, ''].join('\n');
  assert.deepEqual(parseAuditLines(content), [
    { index: 2, text: LINE_A, chain: null, malformedChain: false },
    { index: 4, text: LINE_B, chain: hash, malformedChain: false },
  ]);

  assert.deepEqual(parseAuditLines(''), []);
  assert.deepEqual(parseAuditLines('\n  \n'), []);

  // Un sufijo que intenta declarar sello y no es 64 hex minúscula es un tercer estado: ni sello ni
  // texto heredado. Si fuera texto, borrar los sufijos degradaría el archivo a "traza heredada",
  // que verifica en verde con el contenido ya falsificado adentro.
  const short = `${LINE_C} | chain:${'a'.repeat(63)}`;
  assert.deepEqual(parseAuditLines(short), [{ index: 1, text: short, chain: null, malformedChain: true }]);
  const garbage = `${LINE_C} | chain:no-es-un-hash`;
  assert.deepEqual(parseAuditLines(garbage), [{ index: 1, text: garbage, chain: null, malformedChain: true }]);
});

test('AC1 · una cadena íntegra verifica en verde e informa cuántas líneas encadenó', () => {
  const content = `${chained([LINE_A, LINE_B, LINE_C]).join('\n')}\n`;
  assert.deepEqual(verifyChain(content), { ok: true, verified: 3, brokenLine: null, reason: null });

  const output = [];
  const errors = [];
  assert.equal(main(['check', 'AUDIT.md'], { readFile: () => content }, (line) => output.push(line), (line) => errors.push(line)), 0);
  assert.match(output.at(-1), /^OK:/u);
  assert.match(output.at(-1), /\b3\b/u, 'AC1 exige informar cuántas líneas verificó');
  assert.deepEqual(errors, []);
});

test('FALSIFICACIÓN · AC2 · editar una línea ya escrita rompe la cadena y nombra la línea exacta', () => {
  const signed = chained([LINE_A, LINE_B, LINE_C]);
  const edited = [signed[0], signed[1].replace(LINE_B, `${LINE_B} (editado)`), signed[2]];
  const result = verifyChain(edited.join('\n'));
  assert.equal(result.ok, false);
  assert.equal(result.brokenLine, 2, 'debe nombrar la primera línea rota, no una posterior');
  assert.equal(result.verified, 1);
  assert.match(result.reason, /\S/u);

  const output = [];
  const errors = [];
  assert.equal(main(['check', 'AUDIT.md'], { readFile: () => edited.join('\n') }, (line) => output.push(line), (line) => errors.push(line)), 1);
  assert.match(errors.at(-1), /^REJECTED:/u);
  assert.match(errors.at(-1), /\b2\b/u, 'AC2 exige nombrar la línea exacta donde se rompe');
  assert.deepEqual(output, []);

  // La última línea también se verifica: un bucle que corta una vuelta antes no la miraría.
  const tail = verifyChain([signed[0], signed[1], signed[2].replace(LINE_C, `${LINE_C} (editado)`)].join('\n'));
  assert.equal(tail.ok, false);
  assert.equal(tail.brokenLine, 3);
  assert.equal(tail.verified, 2);
});

test('AC3 · un AUDIT.md vacío, en blanco o inexistente verifica en verde', () => {
  assert.deepEqual(verifyChain(''), { ok: true, verified: 0, brokenLine: null, reason: null });
  assert.deepEqual(verifyChain('\n   \n\n'), { ok: true, verified: 0, brokenLine: null, reason: null });

  const emptyErrors = [];
  assert.equal(main(['check', 'AUDIT.md'], { readFile: () => '' }, () => {}, (line) => emptyErrors.push(line)), 0);
  assert.deepEqual(emptyErrors, []);

  // Ruta de lectura real: un archivo ausente no es una falla del gate, es un repo sin traza todavía.
  const dir = mkdtempSync(join(tmpdir(), 'vcp-audit-chain-'));
  const missingErrors = [];
  try {
    assert.equal(main(['check', join(dir, 'AUDIT.md')], {}, () => {}, (line) => missingErrors.push(line)), 0);
    assert.deepEqual(missingErrors, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC4 · las líneas heredadas se aceptan y la cadena arranca en la primera que declara hash', () => {
  assert.equal(LEGACY_PREFIX_ALLOWED, true, 'la constante documenta la compatibilidad que este AC ejerce');
  const legacy = [LINE_A, LINE_B];
  const content = [...legacy, ...chained([LINE_C])].join('\n');
  assert.deepEqual(verifyChain(content), { ok: true, verified: 1, brokenLine: null, reason: null });

  const output = [];
  assert.equal(main(['check', 'AUDIT.md'], { readFile: () => content }, (line) => output.push(line), () => {}), 0);
  assert.match(output.at(-1), /\b1\b/u, 'sólo la línea encadenada cuenta como verificada');

  // La primera línea firmada encadena desde la cadena vacía: haber incluido las heredadas rompe.
  const wrongStart = verifyChain([...legacy, ...chained([LINE_C], sha256Chain('', LINE_B))].join('\n'));
  assert.equal(wrongStart.ok, false);
  assert.equal(wrongStart.brokenLine, 3);
  assert.equal(wrongStart.verified, 0);
});

test('FALSIFICACIÓN · una línea sin hash después de una encadenada rompe la cadena', () => {
  const signed = chained([LINE_A, LINE_B]);
  const late = [...signed, LINE_C].join('\n');
  const result = verifyChain(late);
  assert.equal(result.ok, false);
  assert.equal(result.brokenLine, 3, 'la línea heredada tardía es la que rompe');
  assert.equal(result.verified, 2);

  const mismatch = verifyChain([signed[0], signed[1].replace(LINE_B, `${LINE_B} (editado)`)].join('\n'));
  assert.equal(mismatch.ok, false);
  assert.notEqual(result.reason, mismatch.reason, 'omitir el hash y declarar uno que no cuadra son fallas distintas');

  const errors = [];
  assert.equal(main(['check', 'AUDIT.md'], { readFile: () => late }, () => {}, (line) => errors.push(line)), 1);
  assert.match(errors.at(-1), /\b3\b/u);
});

test('FALSIFICACIÓN · AC12 · borrar los sellos de toda la traza es un rechazo, no una traza heredada', () => {
  const signed = chained([LINE_A, LINE_B]);
  const intact = `${signed.join('\n')}\n`;
  assert.deepEqual(verifyChain(intact), { ok: true, verified: 2, brokenLine: null, reason: null });

  // Paso 2 del ataque reproducido: cada " | chain:<64hex>" pasa a " | chain:BORRADO". Antes esto
  // salía "OK ... over 0 chained line(s)" con exit 0, y la única señal era el contador.
  const blanked = blankSeals(signed);
  const erased = verifyChain(`${blanked.join('\n')}\n`);
  assert.equal(erased.ok, false);
  assert.equal(erased.brokenLine, 1, 'el primer sello borrado es el que rompe, aunque esté en posición heredada');
  assert.equal(erased.verified, 0);

  // Paso 3: encima del borrado, el contenido ya escrito reescrito. Este es el que importa: el
  // historial falsificado no puede salir en verde.
  const forged = `${[blanked[0].replace('plan aprobado', 'plan FALSIFICADO'), blanked[1]].join('\n')}\n`;
  assert.notEqual(forged, `${blanked.join('\n')}\n`, 'el reemplazo tiene que haber tocado la línea');
  const output = [];
  const errors = [];
  assert.equal(main(['check', 'AUDIT.md'], { readFile: () => forged }, (line) => output.push(line), (line) => errors.push(line)), 1);
  assert.match(errors.at(-1), /^REJECTED:/u);
  assert.deepEqual(output, []);

  const green = [];
  assert.equal(main(['check', 'AUDIT.md'], { readFile: () => intact }, (line) => green.push(line), () => {}), 0);
  assert.match(green.at(-1), /^OK:/u);
});

test('FALSIFICACIÓN · AC12 · un sello en MAYÚSCULA, truncado, largo o vacío se rechaza en vez de pasar por heredado', () => {
  const hash = sha256Chain('', LINE_A);
  // Un archivo de una sola línea sellada encadena desde la cadena vacía y verifica.
  assert.deepEqual(verifyChain(`${LINE_A} | chain:${hash}`), { ok: true, verified: 1, brokenLine: null, reason: null });

  // Decisión fijada: el sello se compara byte a byte contra digest('hex'), que es minúscula. Las
  // mismas 64 posiciones en mayúscula son un sello roto, no un sinónimo.
  assert.notEqual(hash.toUpperCase(), hash, 'sin letras en el hash el caso de mayúsculas no probaría nada');
  const upper = verifyChain(`${LINE_A} | chain:${hash.toUpperCase()}`);
  assert.equal(upper.ok, false);
  assert.equal(upper.brokenLine, 1);
  assert.equal(upper.verified, 0);

  assert.equal(verifyChain(`${LINE_A} | chain:${hash.slice(0, -1)}`).ok, false, 'un hash de 63 hex es un sello truncado');
  assert.equal(verifyChain(`${LINE_A} | chain:${hash}f`).ok, false, 'un hash de 65 hex tampoco es el sello que se escribió');
  assert.equal(verifyChain(`${LINE_A} | chain:`).ok, false, 'el sufijo vacío es el borrado más barato de todos');

  // Tres fallas distintas, tres motivos distintos: sello roto, sello ausente y hash que no cuadra.
  const missing = verifyChain([...chained([LINE_A]), LINE_B].join('\n'));
  const mismatch = verifyChain(`${LINE_B} | chain:${hash}`);
  assert.equal(missing.ok, false);
  assert.equal(mismatch.ok, false);
  assert.match(upper.reason, /\S/u);
  assert.notEqual(upper.reason, missing.reason);
  assert.notEqual(upper.reason, mismatch.reason);
});

test('la palabra chain: en medio del texto no es un sello y no rompe la traza heredada', () => {
  const talksAboutChains = '[2026-08-27 22:52] Orchestrator | chain: notas sobre el sello | docs/plan.md | fase-plan';
  const embedded = '[2026-08-27 22:52] Orchestrator | chain:sin-espacios | docs/plan.md | fase-plan';
  assert.deepEqual(parseAuditLines(talksAboutChains), [{ index: 1, text: talksAboutChains, chain: null, malformedChain: false }]);
  assert.deepEqual(verifyChain([talksAboutChains, embedded].join('\n')), { ok: true, verified: 0, brokenLine: null, reason: null });

  // Y firmada, la misma línea verifica: lo hasheado es la línea entera, con su chain: adentro.
  const sealed = chained([embedded]);
  assert.deepEqual(verifyChain(sealed.join('\n')), { ok: true, verified: 1, brokenLine: null, reason: null });
  assert.deepEqual(parseAuditLines(sealed[0]), [{ index: 1, text: embedded, chain: sha256Chain('', embedded), malformedChain: false }]);
});

test('FALSIFICACIÓN · un checkout CRLF verifica igual que LF y no esconde ni la edición ni el sello borrado', () => {
  const signed = chained([LINE_A, LINE_B, LINE_C]);
  const crlf = `${signed.join('\r\n')}\r\n`;
  assert.deepEqual(verifyChain(crlf), verifyChain(`${signed.join('\n')}\n`), 'el \\r no puede entrar al texto hasheado');
  assert.deepEqual(verifyChain(crlf), { ok: true, verified: 3, brokenLine: null, reason: null });

  const edited = verifyChain([signed[0], signed[1].replace(LINE_B, `${LINE_B} (editado)`), signed[2]].join('\r\n'));
  assert.equal(edited.ok, false);
  assert.equal(edited.brokenLine, 2);
  assert.equal(edited.verified, 1);

  const erased = verifyChain(blankSeals(signed).join('\r\n'));
  assert.equal(erased.ok, false);
  assert.equal(erased.brokenLine, 1);
});

test('FALSIFICACIÓN · pegar un segundo sufijo o correr el separador no cuela un sello', () => {
  const hash = sha256Chain('', LINE_A);
  const sealed = `${LINE_A} | chain:${hash}`;

  // Dos sufijos pegados: manda el último y el primero pasa a ser texto, así que el hash heredado
  // ya no cubre la línea que ahora dice cubrir.
  const doubled = `${sealed} | chain:${hash}`;
  assert.deepEqual(parseAuditLines(doubled), [{ index: 1, text: sealed, chain: hash, malformedChain: false }]);
  const twice = verifyChain(doubled);
  assert.equal(twice.ok, false);
  assert.equal(twice.brokenLine, 1);

  // Un espacio de más después del pipe, o la palabra clave a los gritos, siguen siendo intentos de
  // declarar sello: no son un rescate hacia "texto heredado".
  assert.equal(verifyChain(`${LINE_A} |  chain:BORRADO`).ok, false);
  assert.equal(verifyChain(`${LINE_A} | CHAIN:${hash}`).ok, false);

  // El separador se toma literal: un espacio de más antes del pipe es texto de la línea y el hash
  // tiene que cubrirlo. El gate no recorta nada antes de hashear.
  assert.deepEqual(verifyChain(`${LINE_A}  | chain:${sha256Chain('', `${LINE_A} `)}`), { ok: true, verified: 1, brokenLine: null, reason: null });
  assert.equal(verifyChain(`${LINE_A}  | chain:${hash}`).ok, false, 'hashear la línea recortada no debe verificar');
});

test('FALSIFICACIÓN · main exige argumentos válidos y distingue el archivo ausente del ilegible', () => {
  assert.equal(USAGE, 'usage: verify-audit-chain.mjs check <audit.md> [--require-inputs] | verify-audit-chain.mjs history <audit.md> [--require-inputs] | verify-audit-chain.mjs append <audit.md> "<line>"');

  const output = [];
  const errors = [];
  const reject = (args) => main(args, {}, (line) => output.push(line), (line) => errors.push(line));
  assert.equal(reject([]), 2);
  assert.equal(errors.at(-1), USAGE);
  assert.equal(reject(['check']), 2);
  assert.equal(reject(['check', 'AUDIT.md', 'extra']), 2);
  assert.equal(reject(['verify', 'AUDIT.md']), 2);
  assert.equal(errors.length, 4, 'cada uso inválido reporta exactamente una vez');
  assert.deepEqual(output, []);

  const denied = () => { const error = new Error('EACCES: permission denied'); error.code = 'EACCES'; throw error; };
  const failures = [];
  assert.equal(main(['check', 'AUDIT.md'], { readFile: denied }, () => {}, (line) => failures.push(line)), 1);
  assert.match(failures.at(-1), /^REJECTED:/u);
  assert.match(failures.at(-1), /permission denied/u);

  const absent = () => { const error = new Error('ENOENT: no such file or directory'); error.code = 'ENOENT'; throw error; };
  const quiet = [];
  assert.equal(main(['check', 'AUDIT.md'], { readFile: absent }, () => {}, (line) => quiet.push(line)), 0);
  assert.deepEqual(quiet, []);
});

test('el CLI real refleja los exit codes de la librería sobre archivos en disco', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vcp-audit-chain-'));
  try {
    const signed = chained([LINE_A, LINE_B]);
    const intact = join(dir, 'AUDIT.md');
    writeFileSync(intact, `${signed.join('\n')}\n`);
    const passed = spawnSync(process.execPath, [script, 'check', intact], { encoding: 'utf8' });
    assert.equal(passed.status, 0, `${passed.stdout}${passed.stderr}`);
    assert.match(passed.stdout, /^OK:/u);

    const broken = join(dir, 'BROKEN.md');
    writeFileSync(broken, `${[signed[0], signed[1].replace(LINE_B, `${LINE_B} (editado)`)].join('\n')}\n`);
    const failed = spawnSync(process.execPath, [script, 'check', broken], { encoding: 'utf8' });
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /^REJECTED:/u);

    // El ataque completo contra el CLI de verdad: sellos borrados y contenido reescrito encima.
    const erased = join(dir, 'ERASED.md');
    const blanked = blankSeals(signed);
    writeFileSync(erased, `${[blanked[0].replace('plan aprobado', 'plan FALSIFICADO'), blanked[1]].join('\n')}\n`);
    const forged = spawnSync(process.execPath, [script, 'check', erased], { encoding: 'utf8' });
    assert.equal(forged.status, 1, `${forged.stdout}${forged.stderr}`);
    assert.match(forged.stderr, /^REJECTED:/u);
    assert.equal(forged.stdout, '');

    const misused = spawnSync(process.execPath, [script], { encoding: 'utf8' });
    assert.equal(misused.status, 2);
    assert.equal(misused.stderr.trim(), USAGE);

    // Dogfooding: la traza de auditoría del propio repo tiene que pasar su propio gate.
    const real = spawnSync(process.execPath, [script, 'check', join(repoRoot, '.vibe', 'AUDIT.md')], { encoding: 'utf8' });
    assert.equal(real.status, 0, `${real.stdout}${real.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AC11 · sealLineFor encadena sobre el head real de la traza y arma los bytes exactos a agregar', () => {
  // Archivo vacío: primer eslabón, encadena desde la cadena vacía igual que la regla del verificador.
  const firstSeal = sha256Chain('', LINE_A);
  assert.deepEqual(sealLineFor('', LINE_A), {
    ok: true,
    chain: firstSeal,
    append: `${LINE_A} | chain:${firstSeal}\n`,
    reason: null,
  });

  // Sobre una traza ya sellada tiene que encadenar sobre el último sello, no volver a arrancar de ''.
  const secondSeal = sha256Chain(firstSeal, LINE_B);
  assert.notEqual(secondSeal, sha256Chain('', LINE_B), 'sin esto, sellar desde el head y desde vacío serían indistinguibles');
  assert.deepEqual(sealLineFor(`${chained([LINE_A]).join('\n')}\n`, LINE_B), {
    ok: true,
    chain: secondSeal,
    append: `${LINE_B} | chain:${secondSeal}\n`,
    reason: null,
  });

  // Traza 100% heredada: el primer sello arranca en '' aunque haya líneas escritas arriba.
  assert.equal(sealLineFor(`${LINE_A}\n${LINE_B}\n`, LINE_C).chain, sha256Chain('', LINE_C));

  // Un archivo sin salto de línea final se tragaría la entrada nueva dentro de la última línea, y esa
  // línea dejaría de coincidir con su propio sello. El separador va antes, no después.
  assert.equal(sealLineFor(chained([LINE_A])[0], LINE_B).append, `\n${LINE_B} | chain:${secondSeal}\n`);
});

test('FALSIFICACIÓN · AC11 · sealLineFor rechaza el texto que rompería la verificación siguiente', () => {
  const hash = sha256Chain('', LINE_A);
  const blank = sealLineFor('', '   ');
  const multiline = sealLineFor('', `${LINE_A}\n${LINE_B}`);
  const presealed = sealLineFor('', `${LINE_A} | chain:${hash}`);
  const handRolled = sealLineFor('', `${LINE_A} | chain:BORRADO`);

  for (const [name, refusal] of Object.entries({ blank, multiline, presealed, handRolled })) {
    assert.deepEqual({ ok: refusal.ok, chain: refusal.chain, append: refusal.append },
      { ok: false, chain: null, append: null }, `${name}: un rechazo no puede devolver bytes que escribir`);
    assert.match(refusal.reason, /\S/u);
  }
  assert.equal(new Set([blank.reason, multiline.reason, presealed.reason]).size, 3,
    'tres fallas distintas necesitan tres motivos distintos o el usuario no sabe qué arreglar');
  assert.equal(handRolled.reason, presealed.reason, 'un sello puesto a mano es un sello a mano, bien formado o no');

  // El texto multilínea es el que más engaña: si se colara, la segunda mitad entraría sin sello.
  assert.equal(verifyChain(`${LINE_A}\n${LINE_B} | chain:${sha256Chain('', `${LINE_A}\n${LINE_B}`)}`).ok, false,
    'esto es lo que quedaría en disco si el rechazo multilínea no existiera');

  // Nombrar chain: en medio del texto no es sellar a mano: esa línea se tiene que poder agregar.
  const talksAboutChains = '[2026-08-27 22:52] Orchestrator | chain: notas sobre el sello | docs/plan.md | fase-plan';
  assert.equal(sealLineFor('', talksAboutChains).chain, sha256Chain('', talksAboutChains));

  // Y sobre una traza rota no se sella nada, por impecable que venga el texto nuevo.
  const signed = chained([LINE_A, LINE_B]);
  const tampered = [signed[0].replace('plan aprobado', 'plan FALSIFICADO'), signed[1]].join('\n');
  const refused = sealLineFor(tampered, LINE_C);
  assert.equal(refused.ok, false);
  assert.equal(refused.append, null);
  assert.match(refused.reason, /\b1\b/u, 'el motivo tiene que decir en qué línea está rota la traza');
});

test('AC11 · dos append seguidos dejan una cadena de 2 que el propio check acepta', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vcp-audit-append-'));
  try {
    const file = join(dir, 'AUDIT.md');
    // Primer append por la ruta de fs real: el archivo todavía no existe y se crea sellado.
    const output = [];
    assert.equal(main(['append', file, LINE_A], {}, (line) => output.push(line), (line) => { throw new Error(line); }), 0);
    assert.match(output.at(-1), /^OK:/u);
    assert.match(output.at(-1), new RegExp(sha256Chain('', LINE_A), 'u'), 'el OK informa el head nuevo, que es lo único anclable afuera');

    // Segundo append por el CLI de verdad, para que el subcomando quede probado end-to-end.
    const second = spawnSync(process.execPath, [script, 'append', file, LINE_B], { encoding: 'utf8' });
    assert.equal(second.status, 0, `${second.stdout}${second.stderr}`);

    // Los bytes en disco contra el oráculo: que el gate se acepte a sí mismo no prueba que selle bien.
    assert.equal(readFileSync(file, 'utf8'), `${chained([LINE_A, LINE_B]).join('\n')}\n`);

    const checked = spawnSync(process.execPath, [script, 'check', file], { encoding: 'utf8' });
    assert.equal(checked.status, 0, `${checked.stdout}${checked.stderr}`);
    assert.match(checked.stdout, /\b2\b/u, 'las dos líneas selladas tienen que contar como verificadas');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · AC11 · append aborta sobre una traza rota y no toca el archivo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vcp-audit-append-'));
  try {
    const signed = chained([LINE_A, LINE_B]);
    const corrupted = {
      editada: [signed[0].replace('plan aprobado', 'plan FALSIFICADO'), signed[1]].join('\n'),
      borrada: blankSeals(signed).join('\n'),
    };
    for (const [name, damaged] of Object.entries(corrupted)) {
      const file = join(dir, `${name}.md`);
      const before = `${damaged}\n`;
      writeFileSync(file, before);
      const refused = spawnSync(process.execPath, [script, 'append', file, LINE_C], { encoding: 'utf8' });
      assert.equal(refused.status, 1, `${name}: ${refused.stdout}${refused.stderr}`);
      assert.match(refused.stderr, /^REJECTED:/u);
      assert.equal(refused.stdout, '');
      // Lo que importa no es el exit code sino que no haya quedado un sello válido encima del fraude.
      assert.equal(readFileSync(file, 'utf8'), before, `${name}: append no puede haber escrito un byte`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · append exige tres argumentos y ante E/S rota falla sin escribir', () => {
  assert.equal(APPEND_USAGE, 'usage: verify-audit-chain.mjs append <audit.md> "<line text>"');
  assert.notEqual(APPEND_USAGE, USAGE);

  const errors = [];
  const written = [];
  const spy = (path, data) => written.push([path, data]);
  const noStdout = (line) => { throw new Error(`no debía escribir en stdout: ${line}`); };
  const reject = (args) => main(args, { readFile: () => '', appendFile: spy }, noStdout, (line) => errors.push(line));
  assert.equal(reject(['append']), 2);
  assert.equal(reject(['append', 'AUDIT.md']), 2);
  assert.equal(reject(['append', 'AUDIT.md', LINE_A, 'extra']), 2);
  assert.deepEqual(errors, [APPEND_USAGE, APPEND_USAGE, APPEND_USAGE]);
  assert.deepEqual(written, [], 'un uso inválido no puede haber llegado a escribir');

  // Archivo ilegible: si no se puede verificar lo que ya hay, no se sella encima.
  const denied = () => { const error = new Error('EACCES: permission denied'); error.code = 'EACCES'; throw error; };
  const readErrors = [];
  assert.equal(main(['append', 'AUDIT.md', LINE_A], { readFile: denied, appendFile: spy }, noStdout, (line) => readErrors.push(line)), 1);
  assert.match(readErrors.at(-1), /^REJECTED:.*permission denied/u);
  assert.deepEqual(written, []);

  // La escritura que falla se reporta, no se traga: sin esto el sello se perdería en silencio.
  const full = () => { throw new Error('ENOSPC: no space left on device'); };
  const writeErrors = [];
  assert.equal(main(['append', 'AUDIT.md', LINE_A], { readFile: () => '', appendFile: full }, noStdout, (line) => writeErrors.push(line)), 1);
  assert.match(writeErrors.at(-1), /^REJECTED:.*no space left/u);

  // Camino feliz inyectado: los bytes que salen son exactamente los que sella el oráculo, ni uno más.
  const output = [];
  assert.equal(main(['append', 'AUDIT.md', LINE_B], { readFile: () => `${LINE_A}\n`, appendFile: spy },
    (line) => output.push(line), (line) => { throw new Error(`no debía reportar errores: ${line}`); }), 0);
  assert.deepEqual(written, [['AUDIT.md', `${LINE_B} | chain:${sha256Chain('', LINE_B)}\n`]]);
  assert.match(output.at(-1), /^OK:/u);
});

// --- Verde vacío: un AUDIT.md que no existe no es una cadena verificada -------------------------

// Contrato de salida fijado literal: el RED tiene que fallar por aserción, no por un import roto.
const AUDIT_NO_INPUTS = 'AUDIT_CHAIN_NO_INPUTS';

test('un AUDIT.md ausente o vacío sale VACÍO, no OK: borrar el archivo entero no es una cadena íntegra', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-audit-vacio-'));
  try {
    const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });

    const ausente = run('check', 'AUDIT.md');
    assert.deepEqual({ status: ausente.status, vacio: ausente.stdout.startsWith('VACÍO: ') }, { status: 0, vacio: true });

    writeFileSync(join(root, 'AUDIT.md'), '', 'utf8');
    const vacio = run('check', 'AUDIT.md');
    assert.deepEqual({ status: vacio.status, vacio: vacio.stdout.startsWith('VACÍO: ') }, { status: 0, vacio: true });

    const estricto = run('check', 'AUDIT.md', '--require-inputs');
    assert.equal(estricto.status, 1);
    assert.match(estricto.stderr, new RegExp(AUDIT_NO_INPUTS, 'u'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · una cadena con al menos una línea sellada sigue saliendo OK, con y sin el flag', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-audit-lleno-'));
  try {
    const file = join(root, 'AUDIT.md');
    writeFileSync(file, '', 'utf8');
    const sello = spawnSync(process.execPath, [script, 'append', 'AUDIT.md', '[2026-08-28] Rol | accion | evidencia | ref'], { cwd: root, encoding: 'utf8' });
    assert.equal(sello.status, 0);

    for (const args of [['check', 'AUDIT.md'], ['check', 'AUDIT.md', '--require-inputs']]) {
      const run = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
      assert.deepEqual({ args: args.join(' '), status: run.status, ok: run.stdout.startsWith('OK: ') }, { args: args.join(' '), status: 0, ok: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- El ancla externa que faltaba: la propia historia de git -----------------------------------

// El límite declarado decía que recortar la cadena o refabricarla entera exigía "un ancla fuera del
// archivo, y no hay ninguna portable". Es falso: git ya es esa ancla. Un archivo de auditoría es
// append-only por construcción, así que cada versión commiteada tiene que empezar con la anterior.
// Recortar, reescribir o borrar rompe esa relación, y defenderse exige reescribir historia
// publicada — visible para cualquiera que tenga un clon previo.
const CODIGO_HISTORIA = 'AUDIT_CHAIN_HISTORY_BROKEN';

function repoConHistoria(versiones) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-audit-historia-'));
  const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  git('init', '-q', '.');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  for (const [i, contenido] of versiones.entries()) {
    writeFileSync(join(root, 'AUDIT.md'), contenido, 'utf8');
    git('add', 'AUDIT.md');
    git('commit', '-q', '-m', `v${i}`);
  }
  return { root, git };
}

const L1 = '[2026-08-28] Rol | uno | ev | ref | chain:' + 'a'.repeat(64) + '\n';
const L2 = L1 + '[2026-08-28] Rol | dos | ev | ref | chain:' + 'b'.repeat(64) + '\n';
const L3 = L2 + '[2026-08-28] Rol | tres | ev | ref | chain:' + 'c'.repeat(64) + '\n';

test('history acepta una traza que sólo creció, commit tras commit', () => {
  const { root } = repoConHistoria([L1, L2, L3]);
  try {
    const run = spawnSync(process.execPath, [script, 'history', 'AUDIT.md'], { cwd: root, encoding: 'utf8' });
    assert.deepEqual({ status: run.status, ok: run.stdout.startsWith('OK: ') }, { status: 0, ok: true }, run.stderr);
    assert.match(run.stdout, /3 versión\(es\)/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · history detecta que alguien recortó las últimas líneas', () => {
  const { root } = repoConHistoria([L1, L2, L3, L1]);
  try {
    const run = spawnSync(process.execPath, [script, 'history', 'AUDIT.md'], { cwd: root, encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, new RegExp(CODIGO_HISTORIA, 'u'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · history detecta la cadena refabricada entera sobre contenido falso', () => {
  const falsa = '[2026-08-28] Rol | inventado | ev | ref | chain:' + 'd'.repeat(64) + '\n';
  const { root } = repoConHistoria([L1, L2, falsa]);
  try {
    const run = spawnSync(process.execPath, [script, 'history', 'AUDIT.md'], { cwd: root, encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, new RegExp(CODIGO_HISTORIA, 'u'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · history detecta el borrado total, aunque el archivo vuelva a existir vacío', () => {
  const { root, git } = repoConHistoria([L1, L2]);
  try {
    writeFileSync(join(root, 'AUDIT.md'), '', 'utf8');
    git('add', 'AUDIT.md');
    git('commit', '-q', '-m', 'borrado');
    const run = spawnSync(process.execPath, [script, 'history', 'AUDIT.md'], { cwd: root, encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, new RegExp(CODIGO_HISTORIA, 'u'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · history mira también el árbol de trabajo, no sólo lo commiteado', () => {
  const { root } = repoConHistoria([L1, L2, L3]);
  try {
    writeFileSync(join(root, 'AUDIT.md'), L1, 'utf8');
    const run = spawnSync(process.execPath, [script, 'history', 'AUDIT.md'], { cwd: root, encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /sin commitear/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('history sobre un archivo que nunca se commiteó escribe VACÍO, no OK', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-audit-sin-historia-'));
  try {
    spawnSync('git', ['init', '-q', '.'], { cwd: root, encoding: 'utf8' });
    writeFileSync(join(root, 'AUDIT.md'), L1, 'utf8');
    const run = spawnSync(process.execPath, [script, 'history', 'AUDIT.md'], { cwd: root, encoding: 'utf8' });
    assert.deepEqual({ status: run.status, vacio: run.stdout.startsWith('VACÍO: ') }, { status: 0, vacio: true }, run.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- Las ramas del ancla, con el proceso de git inyectado --------------------------------------

/** Falsea `spawnSync` de git: cada respuesta se declara por subcomando. */
function gitFalso(respuestas) {
  return (_cmd, args) => {
    const sub = args[2];
    const r = respuestas[sub];
    if (typeof r === 'function') return r(args);
    return r ?? { status: 0, stdout: '', stderr: '' };
  };
}

test('gitVersions distingue el repo sin commits del error real de git', () => {
  const sinCommits = gitVersions('AUDIT.md', '.', gitFalso({
    log: { status: 128, stdout: '', stderr: 'does not have any commits yet' },
    'rev-parse': { status: 128, stdout: '', stderr: '' },
  }));
  assert.deepEqual(sinCommits, { error: null, versions: [] });

  const errorReal = gitVersions('AUDIT.md', '.', gitFalso({
    log: { status: 128, stdout: '', stderr: 'fatal: not a git repository' },
    'rev-parse': { status: 0, stdout: 'abc123', stderr: '' },
  }));
  assert.equal(errorReal.versions.length, 0);
  assert.match(errorReal.error, /not a git repository/u);
});

test('gitVersions registra como vacío el commit que borró el archivo, en vez de saltearlo', () => {
  const { error, versions } = gitVersions('AUDIT.md', '.', gitFalso({
    log: { status: 0, stdout: ['aaa', 'bbb', ''].join(String.fromCharCode(10)), stderr: '' },
    show: (args) => (args[3].startsWith('aaa') ? { status: 0, stdout: 'una linea' + String.fromCharCode(10) } : { status: 128, stdout: null }),
  }));
  assert.equal(error, null);
  assert.deepEqual(versions, [{ commit: 'aaa', content: 'una linea' + String.fromCharCode(10) }, { commit: 'bbb', content: '' }]);
});

test('gitVersions tolera que git no escriba nada en stdout, en el log y en el show', () => {
  const { versions } = gitVersions('AUDIT.md', '.', gitFalso({ log: { status: 0, stdout: null, stderr: '' } }));
  assert.deepEqual(versions, []);

  // Un `show` que sale bien pero no escribe nada es un archivo commiteado vacio, no un fallo.
  const vacio = gitVersions('AUDIT.md', '.', gitFalso({
    log: { status: 0, stdout: 'aaa', stderr: '' },
    show: { status: 0, stdout: null },
  }));
  assert.deepEqual(vacio.versions, [{ commit: 'aaa', content: '' }]);
});

test('verifyGrowth acepta el árbol de trabajo ausente y la lista vacía', () => {
  assert.deepEqual(verifyGrowth([], null), { ok: true, commit: null, reason: null });
  assert.deepEqual(verifyGrowth([{ commit: 'aaa', content: 'x' }], null), { ok: true, commit: null, reason: null });
  assert.deepEqual(verifyGrowth([{ commit: 'aaa', content: 'x' }], 'xy'), { ok: true, commit: null, reason: null });
});

test('FALSIFICACIÓN · historyCommand rechaza el uso inválido, el error de git y el vacío bajo --require-inputs', () => {
  const salida = [];
  const errores = [];
  const w = (l) => salida.push(l);
  const e = (l) => errores.push(l);

  assert.equal(historyCommand(['history'], {}, w, e), 2);
  assert.equal(errores.at(-1), USAGE);
  assert.equal(historyCommand(['history', 'AUDIT.md', 'extra'], {}, w, e), 2);

  const roto = { run: gitFalso({ log: { status: 128, stderr: 'fatal: roto' }, 'rev-parse': { status: 0, stdout: 'abc' } }) };
  assert.equal(historyCommand(['history', 'AUDIT.md'], roto, w, e), 1);
  assert.match(errores.at(-1), new RegExp(CODIGO_HISTORIA, 'u'));

  const vacio = { run: gitFalso({ log: { status: 128 }, 'rev-parse': { status: 128 } }) };
  assert.equal(historyCommand(['history', 'AUDIT.md', '--require-inputs'], vacio, w, e), 1);
  assert.match(errores.at(-1), /AUDIT_CHAIN_NO_INPUTS/u);
  assert.deepEqual(salida, []);
});

test('historyCommand usa spawnSync real cuando no le inyectan proceso', () => {
  // Sobre un repo propio, NUNCA sobre el repo donde vive esta prueba: leerlo la acopla a cualquier
  // otra prueba que corra git en paralelo, y una suite flaky no se distingue de una que encontro algo.
  const { root } = repoConHistoria([L1, L2]);
  try {
    const salida = [];
    const status = historyCommand(['history', 'AUDIT.md'], { cwd: root }, (l) => salida.push(l), () => {});
    assert.equal(status, 0);
    assert.match(salida.at(-1), /^OK: /u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
