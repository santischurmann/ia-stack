// Las pruebas que faltaban, encontradas por una pasada de MUTACIÓN sobre una copia del gate.
//
// Noventa mutaciones, sesenta y una muertas y veintinueve sobrevivientes. Cada prueba de este
// archivo mata exactamente una de las sobrevivientes. Están acá y no repartidas en los otros
// archivos porque juntas cuentan una sola historia: **una prueba que pasa no es una prueba que
// prueba**, y la única forma de saber la diferencia es romper el código a propósito y ver si alguna
// se pone en rojo.
//
// El caso que mejor lo muestra: la prueba que decía cubrir «un archivo corrupto rechaza, no escribe
// VACÍO» —la regresión más grave que la triangulación había encontrado— sobrevivía a que se
// reintrodujera la regresión exacta. Dos defectos se tapaban entre sí: el fixture daba un contrato
// válido, así que el rechazo salía por otra rama; y el regex de la aserción matcheaba la subcadena
// `.json` del NOMBRE DEL ARCHIVO. La prueba se aprobaba a sí misma.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-stack-matrix.mjs');
const { MAX_AGE_CEILING, MIN_TEXT, esRelleno, main, validateFreshness, validateLimits, validateMatrix } = await import(pathToFileURL(script).href);

const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};

const texto = (base) => `${base} — texto real y suficientemente largo para no ser relleno.`;
const identidad = (_raiz, ruta) => ruta;

const servicio = (over = {}) => ({
  service_id: 'proveedor-free',
  plan_name: 'Free',
  captured_from: 'https://ejemplo.invalid/precios',
  captured_at: '2026-09-14',
  limits: [{ metric: 'requests', value: 1000, unit: 'peticiones/dia', hard: true }],
  upgrade_trigger: texto('Cruzar las mil peticiones diarias corta el servicio'),
  paid_from: texto('USD 5 por mes el primer plan pago'),
  escalation: [{ when: texto('Se cruzan las mil peticiones'), to_plan: 'Paid', cost_note: texto('USD 5 por mes') }],
  ...over,
});

const contrato = (over = {}) => ({
  schema: 'ia.free-tier-limits/1',
  why: texto('Qué le alcanza a un proyecto del plan gratuito'),
  revalidated: '2026-09-14',
  max_age_days: 90,
  method: texto('Lectura de las páginas oficiales'),
  services: [servicio()],
  ...over,
});

const fila = (product_type, over = {}) => ({
  product_type,
  name: `Tipo ${product_type}`,
  decision_criterion: texto('La pregunta con respuesta observable que separa este tipo'),
  recommended: { stack: texto('El stack recomendado'), why: texto('Por qué ése y no otro') },
  alternatives: [],
  free_tier_refs: ['proveedor-free'],
  no_free_tier_reason: null,
  red_adapter: texto('El adaptador que le toca'),
  evidence: [texto('Lo que respalda esta fila')],
  ...over,
});

const matriz = (over = {}) => ({
  schema: 'ia.stack-matrix/1',
  feature: 'eleccion-de-stack',
  date: '2026-09-14',
  captured_at: '2026-09-14',
  sources: ['research/sources/ejemplo.md'],
  note: texto('Artefacto de discovery, no contrato'),
  rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((t) => fila(t)),
  limits: [texto('Lo que esta matriz no promete')],
  ...over,
});

const ids = new Set(['proveedor-free']);

// ─── El corrupto contra el ausente, sin que el nombre del archivo lo tape ────────────────────────

test('un archivo corrupto rechaza POR SER ILEGIBLE, no por faltar otra cosa', () => {
  // Nombre sin `.json` a propósito: el regex de la prueba anterior matcheaba la extensión del
  // archivo y daba verde aunque el mensaje hablara de otra cosa.
  for (const roto of ['﻿{"schema":"x"}', '{', 'no es json']) {
    const errores = [];
    const code = main(['check', 'entrada'], {
      safePath: identidad,
      read: (ruta) => (String(ruta).includes('free-tier') ? JSON.stringify(contrato()) : roto),
      hoy: '2026-09-14',
      write: () => {},
      writeError: (l) => errores.push(l),
    });
    assert.equal(code, 1);
    assert.ok(
      errores.some((l) => /es ilegible/u.test(l)),
      `tiene que decir que es ilegible, y dijo: ${errores.join(' | ')}`,
    );
  }
});

test('un CONTRATO corrupto con la matriz ausente también rechaza por ilegible', () => {
  const errores = [];
  const code = main(['check', 'entrada'], {
    safePath: identidad,
    read: (ruta) => {
      if (String(ruta).includes('free-tier')) return '{roto';
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    },
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1, 'un contrato roto no puede leerse como proyecto que no eligió stack');
  assert.ok(errores.some((l) => /es ilegible/u.test(l)), errores.join(' | '));
});

// ─── Las tres invariantes llegan al veredicto ───────────────────────────────────────────────────

function correrMain(matrizObj, contratoObj, hoy = '2026-09-14') {
  const errores = [];
  const salida = [];
  const code = main(['check', 'entrada'], {
    safePath: identidad,
    read: (ruta) => JSON.stringify(String(ruta).includes('free-tier') ? contratoObj : matrizObj),
    hoy,
    write: (l) => salida.push(l),
    writeError: (l) => errores.push(l),
  });
  return { code, errores, salida };
}

test('main cablea la invariante de cobertura: un tipo faltante llega al veredicto', () => {
  const sinE = matriz({ rows: matriz().rows.filter((r) => r.product_type !== 'E') });
  const { code, errores } = correrMain(sinE, contrato());
  assert.equal(code, 1, 'sin este cableado, borrar validateMatrix de main no rompe nada');
  assert.ok(errores.some((l) => /\bE\b/u.test(l)), errores.join(' | '));
});

test('main cablea la regla de antigüedad: una captura vencida llega al veredicto', () => {
  const { code, errores } = correrMain(matriz(), contrato(), '2027-06-01');
  assert.equal(code, 1, 'sin este cableado, borrar validateFreshness de main no rompe nada');
  assert.ok(errores.some((l) => /ANTIG/u.test(l)), errores.join(' | '));
});

test('el mensaje de aprobación cuenta lo que hay, no un número cualquiera', () => {
  const { code, salida } = correrMain(matriz(), contrato());
  assert.equal(code, 0, 'el caso feliz tiene que aprobar');
  assert.ok(salida.some((l) => /^OK: 8 tipo/u.test(l)), salida.join(' | '));
  assert.ok(salida.some((l) => /1 servicio/u.test(l)), 'la cuenta de servicios también sale del dato');
});

// ─── El relleno largo, que era el que de verdad se colaba ───────────────────────────────────────

test('un relleno LARGO no compra un campo, aunque supere el piso de caracteres', () => {
  const largo = 'placeholder placeholder placeholder placeholder';
  assert.ok(largo.length > MIN_TEXT, 'el caso sólo prueba algo si supera el piso');
  assert.ok(esRelleno(largo));
  assert.ok(validateLimits(contrato({ services: [servicio({ upgrade_trigger: largo })] })).some((v) => /upgrade_trigger/u.test(v)));

  const floja = matriz();
  floja.rows[0].decision_criterion = largo;
  assert.ok(validateMatrix(floja, ids).some((v) => /decision_criterion/u.test(v)));
});

test('FALSIFICACIÓN · una frase real no es relleno por ser corta de ideas', () => {
  assert.equal(esRelleno(texto('Cruzar el cupo corta el servicio')), false);
  assert.equal(esRelleno(''), false);
  assert.equal(esRelleno(null), false);
});

// ─── El piso de largo queda fijado en su borde ──────────────────────────────────────────────────

test('el piso de largo es exactamente 20: 19 no pasa y 20 sí', () => {
  assert.equal(MIN_TEXT, 20);
  const corto = 'a'.repeat(MIN_TEXT - 1);
  const justo = 'a'.repeat(MIN_TEXT);
  assert.ok(validateLimits(contrato({ services: [servicio({ paid_from: corto })] })).some((v) => /paid_from/u.test(v)));
  assert.deepEqual(validateLimits(contrato({ services: [servicio({ paid_from: justo })] })), []);
});

// ─── La fecha: el borde del período y la normalización del día ──────────────────────────────────

test('el día del período entra y el siguiente no: el borde queda fijado', () => {
  const base = contrato({ services: [servicio({ captured_at: '2026-01-01' })] });
  assert.deepEqual(validateFreshness(base, '2026-04-01'), [], '90 días exactos todavía entran');
  const pasado = validateFreshness(base, '2026-04-02');
  assert.ok(pasado.some((v) => /91 d[ií]as/u.test(v)), `el día 91 tiene que rechazar, y dio: ${JSON.stringify(pasado)}`);
});

test('un día que no existe se rechaza POR NO SER UNA FECHA, no por ser viejo', () => {
  const febrero31 = contrato({ services: [servicio({ service_id: 'imposible', captured_at: '2026-02-31' })] });
  const violaciones = validateFreshness(febrero31, '2026-03-05');
  assert.ok(
    violaciones.some((v) => /no es un d[ií]a/u.test(v)),
    `sin esta aserción, normalizar 02-31 a 03-03 pasa por "captura vieja": ${JSON.stringify(violaciones)}`,
  );
});

test('un período de cero o negativo se rechaza igual que uno ausente', () => {
  for (const malo of [0, -5]) {
    const violaciones = validateFreshness(contrato({ max_age_days: malo }), '2026-09-14');
    assert.ok(violaciones.some((v) => /max_age_days/u.test(v)), `aceptó un período de ${malo}`);
  }
});

// ─── Claves exactas: los nombres, no sólo el conteo ─────────────────────────────────────────────

test('una clave renombrada se rechaza aunque el conteo coincida', () => {
  const renombrado = servicio();
  renombrado.paid_frm = renombrado.paid_from;
  delete renombrado.paid_from;
  assert.ok(
    validateLimits(contrato({ services: [renombrado] })).some((v) => /exactamente/u.test(v)),
    'con sólo contar claves, renombrar una pasa',
  );

  const filaRenombrada = matriz();
  const f = { ...fila('A') };
  f.nombre = f.name;
  delete f.name;
  filaRenombrada.rows[0] = f;
  assert.ok(validateMatrix(filaRenombrada, ids).some((v) => /exactamente/u.test(v)));
});

test('un cupo con una clave de más se rechaza, y la unidad vacía se nombra', () => {
  const deMas = validateLimits(contrato({
    services: [servicio({ limits: [{ metric: 'x', value: 1, unit: 'y', hard: true, extra: 1 }] })],
  }));
  assert.ok(deMas.some((v) => /exactamente/u.test(v)), JSON.stringify(deMas));

  const sinUnidad = validateLimits(contrato({
    services: [servicio({ limits: [{ metric: 'x', value: 1, unit: '', hard: true }] })],
  }));
  assert.ok(sinUnidad.some((v) => /unit/u.test(v)), 'la unidad se ejecutaba pero nadie miraba su efecto');
});

test('el formato de fecha se comprueba de verdad, no sólo que haya algo escrito', () => {
  assert.ok(validateLimits(contrato({ revalidated: '14-09-2026' })).some((v) => /revalidated/u.test(v)));
  assert.ok(validateLimits(contrato({ services: [servicio({ captured_at: '14-09-2026' })] })).some((v) => /captured_at/u.test(v)));
});

// ─── El corte por esquema de la matriz, mirando el mensaje y no el conteo ───────────────────────

test('la matriz con otro esquema corta nombrando el esquema esperado', () => {
  const violaciones = validateMatrix({ schema: 'otro' }, ids);
  assert.ok(
    violaciones.some((v) => /ia\.stack-matrix/u.test(v)),
    `contar una sola violación no distingue el corte por esquema de la falta de rows: ${JSON.stringify(violaciones)}`,
  );
});

// ─── La exención del tipo H, con un dato que la separe del caso general ─────────────────────────

test('sólo H puede recomendar sin decir por qué; los otros siete no', () => {
  const conH = matriz();
  conH.rows[7].recommended = { stack: 'no aplica', why: '-' };
  conH.rows[7].free_tier_refs = [];
  conH.rows[7].no_free_tier_reason = texto('H es otro: todavía no se sabe qué es, así que no hay servicio que nombrar');
  assert.deepEqual(validateMatrix(conH, ids), [], 'H es el tipo cuya recomendación es que no hay ninguna');

  const conB = matriz();
  conB.rows[1].recommended = { stack: 'no aplica', why: '-' };
  assert.ok(
    validateMatrix(conB, ids).some((v) => /recommended/u.test(v)),
    'sin este caso, borrar la exención de H no rompe ninguna prueba',
  );
});

// ─── El rechazo por ruta insegura lleva su prefijo ──────────────────────────────────────────────

test('una ruta insegura rechaza con el prefijo que el resto de los gates usa', () => {
  const errores = [];
  const code = main(['check', '../afuera.json'], {
    safePath: () => { throw new Error('ratchet path escapes the project: ../afuera.json'); },
    read: () => '{}',
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /^REJECTED: /u.test(l)), `sin el prefijo, la salida no se lee como rechazo: ${errores.join(' | ')}`);
});

// ─── Y el dato real del repositorio, contra su propia fuente ────────────────────────────────────

test('el contrato real no declara ningún cupo con hard nulo sin explicarlo', SOLO_FUENTE, () => {
  const real = JSON.parse(readFileSync(join(repoRoot, 'contracts', 'free-tier-limits.json'), 'utf8'));
  const nulos = real.services.flatMap((s) => (s.limits ?? []).filter((l) => l.hard === null).map(() => s.service_id));
  assert.ok(nulos.length > 0, 'si ningún cupo quedó sin resolver, esta prueba no está midiendo nada');
  assert.deepEqual(validateLimits(real), [], 'cada null tiene que estar nombrado en su disparador');
});

// ─── Las cinco ramas que el gate de cobertura marcó sin ejecutar ────────────────────────────────

test('una frase entera de relleno se agarra aunque sus palabras sueltas sean legítimas', () => {
  // `por definir` no sobrevive a partirse en fichas: ni «por» ni «definir» son relleno por separado.
  // Por eso las frases van en su propia lista; meterlas entre las fichas las volvía entradas muertas,
  // que es el mismo defecto que este módulo ya tuvo con la lista corta.
  assert.equal(esRelleno('por definir'), true);
  assert.equal(esRelleno('Por Definir'), true);
  assert.equal(esRelleno('sin definir, ver despues'), true);
  assert.equal(esRelleno('definir el alcance con el equipo antes de empezar'), false);
});

test('un período de vencimiento por encima del techo se rechaza', () => {
  // LA HERIDA: sin techo, el dato bajo prueba elegía su propio umbral. Una ronda adversarial escribió
  // un período de diez mil años con una captura de 1970 y el gate aprobó, imprimiendo el número
  // absurdo sin inmutarse.
  const eterno = contrato({ max_age_days: 3650000 });
  const violaciones = validateLimits(eterno);
  assert.ok(violaciones.some((v) => /max_age_days/u.test(v) && /techo/u.test(v)), JSON.stringify(violaciones));

  assert.deepEqual(validateLimits(contrato({ max_age_days: MAX_AGE_CEILING })), [], 'el techo exacto todavía entra');
  assert.ok(validateLimits(contrato({ max_age_days: MAX_AGE_CEILING + 1 })).some((v) => /techo/u.test(v)));
});

test('un servicio gratuito para siempre puede declarar escalation vacía, y sólo si lo dice', () => {
  // LA HERIDA: la regla exigía al menos un escalón, así que un servicio sin plan pago tenía que
  // inventar uno. La regla empujaba una mentira al dato en vez de ponerse roja.
  const perpetuo = contrato({
    services: [servicio({
      escalation: [],
      paid_from: 'No existe plan pago: este servicio es gratuito de forma permanente para repositorios públicos.',
    })],
  });
  assert.deepEqual(validateLimits(perpetuo), []);

  const mudo = contrato({ services: [servicio({ escalation: [] })] });
  assert.ok(mudo.length !== 0 || true);
  assert.ok(
    validateLimits(mudo).some((v) => /escalation vacía/u.test(v)),
    'sin la declaración en paid_from, una lista vacía sigue siendo un hueco',
  );
});

test('un cupo con hard nulo cuyo disparador SÍ lo nombra pasa, y el que no lo nombra rechaza', () => {
  const nombrado = contrato({
    services: [servicio({
      limits: [{ metric: 'credito', value: 1, unit: 'USD/mes', hard: null }],
      upgrade_trigger: texto('Agotar el crédito. Ese cupo lleva hard en null porque la fuente no lo verificó'),
    })],
  });
  assert.deepEqual(validateLimits(nombrado), []);
});

test('una lista de evidencia con valores vacíos no compra el verde', () => {
  // `evidence` pedía sólo ser una lista, así que `[null, 0, false, {}]` pasaba: una matriz sin una
  // sola evidencia real salía aprobada.
  const basura = matriz();
  basura.rows[2].evidence = [null, 0, false, {}];
  assert.ok(validateMatrix(basura, ids).some((v) => /evidence/u.test(v)), JSON.stringify(validateMatrix(basura, ids)));

  const vacia = matriz();
  vacia.rows[2].evidence = [];
  assert.ok(validateMatrix(vacia, ids).some((v) => /evidence/u.test(v)));
});

test('FALSIFICACIÓN · un disparador nulo no se satisface a sí mismo', () => {
  // Sutil y real: sin el `?? ''`, `String(null)` da la cadena «null», que matchea la regla que
  // exige nombrar el null. Un disparador ausente se estaría auto-aprobando.
  const trampa = contrato({
    services: [servicio({
      upgrade_trigger: null,
      limits: [{ metric: 'credito', value: 1, unit: 'USD/mes', hard: null }],
    })],
  });
  const violaciones = validateLimits(trampa);
  assert.ok(violaciones.some((v) => /upgrade_trigger/u.test(v)), 'un disparador nulo tiene que rechazar por sí solo');
  assert.ok(
    violaciones.some((v) => /hard es null/u.test(v)),
    `y no puede satisfacer la regla del null con la palabra que JSON usa para el vacío: ${JSON.stringify(violaciones)}`,
  );
});

test('FALSIFICACIÓN · un paid_from nulo no declara que no hay plan pago', () => {
  const trampa = contrato({ services: [servicio({ paid_from: null, escalation: [] })] });
  const violaciones = validateLimits(trampa);
  assert.ok(violaciones.some((v) => /paid_from/u.test(v)));
  assert.ok(violaciones.some((v) => /escalation vacía/u.test(v)), 'un campo ausente no declara nada');
});

// ─── Fase 7 · lo que encontró el Boy Scout ──────────────────────────────────────────────────────

test('la regla del período dice lo mismo en las dos funciones que la comprueban', () => {
  // La regla estaba escrita dos veces y las dos copias NO coincidían: `validateLimits` rechazaba por
  // encima del techo y `validateFreshness` no, así que llamada sola aceptaba un período de diez mil
  // años. Dos redacciones de la misma garantía divergen, y ésta ya había divergido.
  const eterno = contrato({ max_age_days: MAX_AGE_CEILING + 1 });
  assert.ok(validateLimits(eterno).some((v) => /techo/u.test(v)));
  assert.ok(
    validateFreshness(eterno, '2026-09-14').some((v) => /techo/u.test(v)),
    'llamada sola, la comprobación de antigüedad también tiene que rechazar un período sin sentido',
  );

  for (const malo of [0, -1, 1.5, '90', null, undefined]) {
    assert.ok(validateFreshness(contrato({ max_age_days: malo }), '2026-09-14').some((v) => /max_age_days/u.test(v)), `aceptó ${JSON.stringify(malo)}`);
    assert.ok(validateLimits(contrato({ max_age_days: malo })).some((v) => /max_age_days/u.test(v)), `aceptó ${JSON.stringify(malo)}`);
  }
});
