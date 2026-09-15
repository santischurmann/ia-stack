import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-spec-wordcap.mjs');
const { QUALITY_FLAG, SECCIONES_VIA_CORTA, USAGE, WORD_CAP, checkSpecQuality, countSpecWords, main, viaDeLaSpec } = await import(pathToFileURL(script).href);

import { esRuntimeInstalado } from './_entorno.mjs';

// Self-check: mide las plantillas de ESTE checkout. El instalador las copia, pero quien las verifica
// es el repositorio que las publica.
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};

const VALID_SPEC = `# Spec: billing\n\n## Problem / Problema\nEl cobro falla.\n\n## Discovery / Investigación previa\nSe revisó la evidencia.\n\n## Target Users / Usuarios\nOperadores.\n\n## Acceptance Criteria / Criterios de aceptación\n- [ ] **AC1:** GIVEN un pago pendiente, WHEN se reintenta, THEN se registra un resultado.\n- [ ] **AC2:** THE SYSTEM SHALL conservar el recibo.\n\n## Constraints / Restricciones\n- No dependencias nuevas.\n\n## Non-Goals / No-Goals\n- No se cambia la facturación.\n\n## Stack & Dependencies\n- Node nativo.\n\n## Definition of Done (DoD)\n- [ ] tests verdes\n`;

test('countSpecWords excludes fenced code blocks and table rows, counts everything else', () => {
  assert.equal(countSpecWords('one two three'), 3);
  assert.equal(countSpecWords('a\n```\ncode word here does not count\n```\nb'), 2);
  assert.equal(countSpecWords('prose\n| a | b |\n|---|---|\n| c | d |\nmore'), 2);
  assert.equal(countSpecWords('  \n\n  '), 0, 'pure whitespace counts as zero words');
  assert.equal(countSpecWords(''), 0);
});

test('FALSIFICACIÓN · a spec under the cap passes, one word over the cap rejects', () => {
  const output = [];
  const errors = [];
  const atCap = { readFile: () => Array.from({ length: WORD_CAP }, () => 'x').join(' ') };
  assert.equal(main(['check', 'spec.md'], { ...atCap, write: (l) => output.push(l), writeError: (l) => errors.push(l) }), 0);
  assert.match(output.at(-1), new RegExp(`${WORD_CAP}/${WORD_CAP} words`));

  const overCap = { readFile: () => Array.from({ length: WORD_CAP + 1 }, () => 'x').join(' ') };
  const overOutput = [];
  const overErrors = [];
  assert.equal(main(['check', 'spec.md'], { ...overCap, write: (l) => overOutput.push(l), writeError: (l) => overErrors.push(l) }), 1);
  assert.match(overErrors.at(-1), /over the 650-word cap/);
  assert.deepEqual(overOutput, []);
});

test('FALSIFICACIÓN · usage on bad args, unreadable file, and the real templates/spec.md fixture', () => {
  const errors = [];
  assert.equal(main([], { writeError: (l) => errors.push(l) }), 2);
  assert.equal(errors.at(-1), USAGE);
  assert.equal(main(['check'], { writeError: (l) => errors.push(l) }), 2);
  assert.equal(main(['check', 'a.md', 'extra'], { writeError: (l) => errors.push(l) }), 2);

  const missingErrors = [];
  assert.equal(main(['check', 'does-not-exist.md'], { writeError: (l) => missingErrors.push(l) }), 1);
  assert.match(missingErrors.at(-1), /unable to read/);

  const output = [];
  assert.equal(main(['check', join(repoRoot, 'templates', 'spec.md')], { write: (l) => output.push(l) }), 0, 'the real template must be under its own documented cap');
  assert.match(output.at(-1), /\/650 words/);
});

test('CLI exit codes match the library behavior for a real over-cap file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vcp-wordcap-'));
  const tmp = join(dir, 'spec.md');
  writeFileSync(tmp, Array.from({ length: WORD_CAP + 5 }, () => 'x').join(' '));
  try {
    const result = spawnSync(process.execPath, [script, 'check', tmp], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /over the 650-word cap/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Estas dos pruebas son sobre la FORMA de una spec, no sobre si este repositorio tiene un modelo de
// amenaza. La exigencia de la sección de seguridad la deriva el gate del árbol real, y eso tiene sus
// propias pruebas más abajo. Sin inyectar aquí esa dependencia, crear un threat.json en cualquier
// parte del repositorio ponía estas dos en rojo por una razón que no es la que están midiendo.
// Reproducido el 2026-09-14 al escribir el threat.json de un ciclo nuevo.
test('checkSpecQuality accepts a complete spec with event and invariant AC grammar', () => {
  assert.deepEqual(checkSpecQuality(VALID_SPEC), []);
  const output = [];
  assert.equal(main(['check', 'spec.md', QUALITY_FLAG], { readFile: () => VALID_SPEC, hasThreatModel: () => false, write: (line) => output.push(line) }), 0);
  assert.match(output.at(-1), /quality shape valid/);
});

test('FALSIFICACIÓN · quality rejects empty, missing sections, placeholders and unresolved questions', () => {
  assert.ok(checkSpecQuality('').some((item) => item.includes('empty')));
  const incomplete = VALID_SPEC.replace('## Constraints / Restricciones', '## Limits');
  assert.ok(checkSpecQuality(incomplete).some((item) => item.includes('missing required section')));
  const placeholder = VALID_SPEC.replace('Operadores.', '<role>');
  assert.ok(checkSpecQuality(placeholder).some((item) => item.includes('placeholder')));
  const unresolved = VALID_SPEC.replace('Se revisó la evidencia.', '[NEEDS CLARIFICATION: qué evidencia]');
  assert.ok(checkSpecQuality(unresolved).some((item) => item.includes('unresolved')));
});

test('FALSIFICACIÓN · quality rejects duplicate, malformed and absent acceptance criteria', () => {
  const duplicate = VALID_SPEC.replace('**AC2:**', '**AC1:**');
  assert.ok(checkSpecQuality(duplicate).some((item) => item.includes('duplicate')));
  const malformed = VALID_SPEC.replace('GIVEN un pago pendiente, WHEN se reintenta, THEN se registra un resultado.', 'the payment is handled');
  assert.ok(checkSpecQuality(malformed).some((item) => item.includes('AC1') && item.includes('GIVEN')));
  const noAc = VALID_SPEC.replace(/- \[ \] \*\*AC1:[^\n]+\n/gu, '').replace(/- \[ \] \*\*AC2:[^\n]+\n/gu, '');
  assert.ok(checkSpecQuality(noAc).some((item) => item.includes('no acceptance criterion')));
});

test('quality ignores placeholders and AC-like text inside fenced code', () => {
  const withCode = `${VALID_SPEC}\n\`\`\`text\n<placeholder>\n- [ ] **AC99:** not a real criterion\n\`\`\``;
  assert.deepEqual(checkSpecQuality(withCode), []);
});

test('quality CLI handles invalid usage, unreadable input and over-cap before quality', () => {
  const errors = [];
  assert.equal(main(['check', 'spec.md', '--unknown'], { writeError: (line) => errors.push(line) }), 2);
  assert.equal(main(['check', 'missing.md', QUALITY_FLAG], { writeError: (line) => errors.push(line) }), 1);
  assert.equal(main(['check', 'spec.md', QUALITY_FLAG], { readFile: () => Array.from({ length: WORD_CAP + 1 }, () => 'x').join(' '), writeError: (line) => errors.push(line) }), 1);
  assert.ok(errors.length >= 3);
});

test('FALSIFICACIÓN · con --quality, una spec bajo el tope pero mal formada se rechaza por la CLI', () => {
  // El camino de rechazo por calidad dentro de `main` no lo ejercitaba ninguna prueba: sólo se
  // probaba `checkSpecQuality` por separado. Un gate cuyo camino de rechazo nunca se ejecutó es un
  // gate del que no se sabe si rechaza. Medido el 2026-09-01: verify-spec-wordcap.mjs:99 no la
  // ejecutaba ningún proceso de la suite.
  const errors = [];
  const rota = VALID_SPEC.replace('## Constraints / Restricciones', '## Restricciones que no son la sección pedida');
  const code = main(['check', 'docs/spec.md', QUALITY_FLAG], {
    readFile: () => rota,
    hasThreatModel: () => false,
    write: () => {},
    writeError: (line) => errors.push(line),
  });
  assert.equal(code, 1, 'aceptó una spec sin una sección obligatoria');
  // El mensaje NOMBRA LA VIA desde el 2026-09-15. Sin eso, «falta Constraints» es desconcertante
  // para quien creia estar en la via corta: el rechazo tiene que decir contra que listado se
  // comprobo, o manda a buscar el problema al lugar equivocado.
  assert.ok(errors.some((line) => /quality \(vía \w+\): missing required section: Constraints \/ Restricciones/u.test(line)), errors.join(' || '));
  // Y la contraprueba: la misma spec sin tocar, con la misma bandera, sale en verde.
  const salida = [];
  assert.equal(main(['check', 'docs/spec.md', QUALITY_FLAG], { readFile: () => VALID_SPEC, hasThreatModel: () => false, write: (l) => salida.push(l), writeError: (l) => errors.push(l) }), 0, errors.join(' || '));
  assert.ok(salida.at(-1).includes('quality shape valid'));
});

// --- Las plantillas de spec que el protocolo distribuye ------------------------------------------
//
// `SKILL.md:469` manda generar `docs/spec.md` con la plantilla de `skills/spec-plan-templates.md`, y
// esa plantilla era rechazada por este mismo gate en **7 de sus 8 secciones**: tenía encabezados en
// inglés sin la mitad castellana, y no tenía sección Discovery en absoluto. Medido el 2026-09-04.
//
// Había DOS plantillas de spec divergentes: `templates/spec.md` con las ocho correctas —la que el
// contrato ancla como canónica— y la embebida, vieja, que es la que el protocolo nombraba. Quien
// siguiera la instrucción al pie de la letra escribía una spec que su propio gate rechazaba.
//
// La regla mira las DOS, y por forma: cualquier plantilla de spec que el repositorio publique tiene
// que llevar los encabezados que este gate exige. Sólo se comprueban las secciones — el resto de las
// violaciones (placeholders sin llenar, gramática de los criterios) son esperables en una plantilla
// vacía y marcarlas sería exigirle a un molde que esté lleno.

const FALTA_SECCION = /^missing required section:/u;

export function seccionesFaltantes(texto) {
  return checkSpecQuality(texto).filter((v) => FALTA_SECCION.test(v));
}

test('las dos plantillas de spec que el protocolo publica llevan las secciones que el gate exige', SOLO_FUENTE, () => {
  const canonica = readFileSync(join(repoRoot, 'templates', 'spec.md'), 'utf8');
  assert.deepEqual(seccionesFaltantes(canonica), [], 'templates/spec.md es la plantilla canónica');

  const skill = readFileSync(join(repoRoot, 'skills', 'spec-plan-templates.md'), 'utf8');
  const bloque = skill.match(/## TEMPLATE: docs\/spec\.md[\s\S]*?```markdown\n([\s\S]*?)```/u);
  assert.ok(bloque, 'no se encontró la plantilla embebida: si se movió, esta prueba dejó de mirar lo que dice mirar');
  assert.deepEqual(seccionesFaltantes(bloque[1]), [], 'la plantilla que SKILL.md manda usar tiene que pasar el gate de spec');
});

test('FALSIFICACIÓN · sacarle una sección a la plantilla la pone roja', () => {
  const completa = readFileSync(join(repoRoot, 'templates', 'spec.md'), 'utf8');
  const sinDiscovery = completa.replace('## Discovery / Investigación previa', '## Otra cosa');
  assert.equal(seccionesFaltantes(sinDiscovery).length, 1);
  assert.match(seccionesFaltantes(sinDiscovery)[0], /Discovery/u);
});

// --- La spec nombra su superficie de ataque cuando el proyecto declaró una ---------------------
//
// El modelo de amenaza vive en Discovery porque la spec tiene tope de 650 palabras. Pero si el
// proyecto declaró una superficie, la spec tiene que NOMBRARLA: una spec que no menciona qué se
// protege deja el modelo de amenaza como un expediente que nadie lee desde el trabajo real.
//
// La exigencia se DERIVA DEL ARBOL, no de una bandera que alguien tiene que acordarse de pasar:
// si hay algún `threat.json` bajo docs/discovery/, la sección se exige.

test('sin modelo de amenaza declarado, la sección de seguridad no se exige', () => {
  assert.deepEqual(checkSpecQuality(VALID_SPEC, { requireSecuritySurface: false }), []);
});

test('con modelo de amenaza declarado, una spec sin la sección se rechaza nombrándola', () => {
  const violaciones = checkSpecQuality(VALID_SPEC, { requireSecuritySurface: true });
  assert.ok(violaciones.some((v) => /Security surface/u.test(v)), `no la nombró: ${violaciones.join(' | ')}`);
});

test('con la sección presente, la spec pasa aunque el modelo exista', () => {
  const conSeccion = `${VALID_SPEC}\n\n## Security surface / Superficie de ataque\nLa entrada E1 alcanza el activo A1 y la guarda el control C1 (authz), probado por AC1.\n`;
  assert.deepEqual(checkSpecQuality(conSeccion, { requireSecuritySurface: true }), []);
});

test('hasThreatModel le pregunta al árbol: sin carpeta es false, con un threat.json es true', async () => {
  const { hasThreatModel } = await import(pathToFileURL(script).href);
  assert.equal(hasThreatModel('docs/discovery', { exists: () => false, list: () => [] }), false);
  assert.equal(hasThreatModel('docs/discovery', { exists: () => true, list: () => ['una-feature'] }), true);
  assert.equal(hasThreatModel('docs/discovery', {
    exists: (ruta) => !String(ruta).includes('threat.json'),
    list: () => ['una-feature'],
  }), false);
  // Sin inyección, mira el árbol real de este repositorio y no lanza.
  assert.equal(typeof hasThreatModel(), 'boolean');
});

test('el CLI deriva la exigencia del árbol, no de una bandera', () => {
  const errores = [];
  const salida = main(['check', 'spec.md', QUALITY_FLAG], {
    write: () => {}, writeError: (m) => errores.push(m),
    readFile: () => VALID_SPEC, hasThreatModel: () => true,
  });
  assert.equal(salida, 1);
  assert.ok(errores.some((e) => /Security surface/u.test(e)));

  const dichos = [];
  assert.equal(main(['check', 'spec.md', QUALITY_FLAG], {
    write: (m) => dichos.push(m), writeError: () => {},
    readFile: () => VALID_SPEC, hasThreatModel: () => false,
  }), 0, dichos.join('\n'));
});

// LA VIA CORTA NO SE DECLARA CON UNA BANDERA: SE DERIVA DEL ARBOL.
//
// Este gate ya tenia la regla escrita para la seccion de seguridad: «la exigencia se deriva del
// ARBOL y no de una bandera que alguien tiene que acordarse de pasar», porque una exigencia que
// depende de recordarla se olvida en la primera sesion bajo presion. La via corta sigue la misma
// regla: sale del `scope` que el scavenge de esa funcionalidad ya declaro.
//
// QUE SE SACA Y QUE NO. En via corta sobreviven tres secciones y se caen cinco:
//
//   Problem              se queda — sin esto nadie sabe por que se hizo
//   Acceptance Criteria  se queda — es lo que leen el test rojo, la traza y el recibo
//   Definition of Done   se queda — sin esto «terminado» no quiere decir nada
//
//   Discovery, Target Users, Constraints, Non-Goals y Stack & Dependencies se caen: son el
//   expediente de producto, y un cambio de tres archivos sin ambiguedad no necesita uno.
//
// EL RIGOR DE LOS CRITERIOS NO BAJA. Gramatica GIVEN/WHEN/THEN, ids unicos, sin marcadores de
// clarificacion sin resolver y sin marcadores de plantilla: identico en las dos vias. Bajar eso
// romperia el test rojo, la traza de evidencia y el recibo, que es exactamente lo que hacia que el
// atajo publicitado no tuviera salida legal.
//
// Y LA SEGURIDAD NO TIENE VIA CORTA: si el proyecto declaro una superficie de ataque, la spec la
// nombra aunque sea corta.

const SPEC_CORTA = [
  '# Spec: cambio-chico',
  '',
  '## Problem / Problema',
  'Hace falta arreglar una cosa concreta que hoy no anda.',
  '',
  '## Acceptance Criteria / Criterios de aceptación',
  '- [ ] **AC1:** GIVEN una entrada mal formada, WHEN corre el gate, THEN sale 1 nombrando la clave.',
  '',
  '## Definition of Done (DoD)',
  'Suite verde y el gate declarando su límite.',
  '',
].join('\n');

test('viaDeLaSpec lee la vía del scavenge de esa funcionalidad, no de una bandera', () => {
  const corto = { exists: () => true, read: () => JSON.stringify({ scope: 'corto' }) };
  assert.equal(viaDeLaSpec(SPEC_CORTA, '.', corto), 'corta');

  const completo = { exists: () => true, read: () => JSON.stringify({ scope: 'completo' }) };
  assert.equal(viaDeLaSpec(SPEC_CORTA, '.', completo), 'completa');

  // Sin scavenge la vía es la completa: la ausencia nunca afloja una exigencia.
  const ninguno = { exists: () => false, read: () => { throw new Error('no debería leer'); } };
  assert.equal(viaDeLaSpec(SPEC_CORTA, '.', ninguno), 'completa');

  // Un scavenge ilegible tampoco afloja nada.
  const roto = { exists: () => true, read: () => 'no es json' };
  assert.equal(viaDeLaSpec(SPEC_CORTA, '.', roto), 'completa');

  // Y una spec sin título de funcionalidad no resuelve a ningún scavenge.
  assert.equal(viaDeLaSpec('## Problem / Problema\ntexto\n', '.', corto), 'completa');

  // Ni siquiera algo que no es texto: el lector recibe lo que devuelva `readFile`, y en un proyecto
  // roto puede ser cualquier cosa. Contestar «completa» es lo correcto; explotar seria un rechazo
  // con la causa equivocada.
  for (const basura of [null, undefined, 42]) {
    assert.equal(viaDeLaSpec(basura, '.', corto), 'completa', JSON.stringify(basura));
  }
});

test('VIA CORTA · una spec de tres secciones pasa, y no se le piden las otras cinco', () => {
  const violaciones = checkSpecQuality(SPEC_CORTA, { via: 'corta' });
  assert.deepEqual(violaciones, [], violaciones.join(' | '));
});

test('VIA CORTA · esa misma spec NO pasa como completa', () => {
  const violaciones = checkSpecQuality(SPEC_CORTA, { via: 'completa' });
  assert.ok(violaciones.some((v) => /Discovery/u.test(v)), violaciones.join(' | '));
  assert.ok(violaciones.some((v) => /Non-Goals/u.test(v)), violaciones.join(' | '));
});

test('VIA CORTA · el rigor de los criterios NO baja', () => {
  const sinGramatica = SPEC_CORTA.replace(
    '- [ ] **AC1:** GIVEN una entrada mal formada, WHEN corre el gate, THEN sale 1 nombrando la clave.',
    '- [ ] **AC1:** el gate tiene que andar bien.',
  );
  assert.ok(checkSpecQuality(sinGramatica, { via: 'corta' }).some((v) => /GIVEN/u.test(v)));

  const sinCriterios = SPEC_CORTA.replace(/^- \[ \] \*\*AC1.*$/mu, 'nada acá.');
  assert.ok(checkSpecQuality(sinCriterios, { via: 'corta' }).some((v) => /acceptance criterion/u.test(v)));

  const conMarcador = SPEC_CORTA.replace('Hace falta arreglar', '[NEEDS CLARIFICATION: qué] Hace falta arreglar');
  assert.ok(checkSpecQuality(conMarcador, { via: 'corta' }).some((v) => /CLARIFICATION/u.test(v)));

  const duplicado = SPEC_CORTA.replace(
    '## Definition of Done (DoD)',
    '- [ ] **AC1:** GIVEN otra cosa, WHEN pasa, THEN sale 1.\n\n## Definition of Done (DoD)',
  );
  assert.ok(checkSpecQuality(duplicado, { via: 'corta' }).some((v) => /duplicate/u.test(v)));
});

test('VIA CORTA · la seguridad no tiene vía corta', () => {
  const violaciones = checkSpecQuality(SPEC_CORTA, { via: 'corta', requireSecuritySurface: true });
  assert.ok(violaciones.some((v) => /Security surface/u.test(v)), violaciones.join(' | '));
});

test('viaDeLaSpec corre contra el DISCO REAL con sus valores por defecto', () => {
  // Las demas pruebas inyectan `exists` y `read` para poder describir casos sin montar un arbol. Eso
  // deja sin ejecutar el lado por defecto, que es justo el que corre en produccion: si estuviera
  // roto, la bateria seguiria en verde y el gate fallaria recien en la maquina de alguien.
  const d = mkdtempSync(join(tmpdir(), 'vcp-via-'));
  try {
    // Sin scavenge en disco: via completa, y sin explotar.
    assert.equal(viaDeLaSpec(SPEC_CORTA, d), 'completa');

    // Con un scavenge real que declara scope corto: via corta.
    mkdirSync(join(d, 'docs', 'scavenge'), { recursive: true });
    writeFileSync(join(d, 'docs', 'scavenge', 'cambio-chico.json'), JSON.stringify({ scope: 'corto' }), 'utf8');
    assert.equal(viaDeLaSpec(SPEC_CORTA, d), 'corta');

    // Y con uno ilegible en disco: vuelve a completa, nunca afloja.
    writeFileSync(join(d, 'docs', 'scavenge', 'cambio-chico.json'), 'no es json', 'utf8');
    assert.equal(viaDeLaSpec(SPEC_CORTA, d), 'completa');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('las secciones de la vía corta son las tres que los gates de abajo necesitan', () => {
  assert.deepEqual(SECCIONES_VIA_CORTA, [
    'Problem / Problema',
    'Acceptance Criteria / Criterios de aceptación',
    'Definition of Done (DoD)',
  ]);
});
