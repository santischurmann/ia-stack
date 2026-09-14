// AC3 de docs/spec.md · El contrato de límites de plan gratuito tiene la forma que dice tener, y
// todo servicio declara QUÉ evento lo saca del plan.
//
// POR QUÉ LA INVARIANTE ES EL DISPARADOR Y NO EL CUPO. El research del 2026-09-14 midió ocho
// proveedores y encontró que el evento que saca a un proyecto del plan gratuito casi nunca es un
// número: es una cláusula de uso comercial sin contador, una pausa por inactividad, o una base de
// datos que expira a los treinta días. Un contrato que guardara sólo cupos dejaría afuera justo lo
// que rompe a la gente. Por eso `upgrade_trigger` y `escalation` son obligatorios y un cupo no.
//
// LÍMITE HONESTO: comprueba que el disparador esté escrito y que no sea relleno, nunca que
// corresponda a lo que el proveedor hace. Un contrato con cifras inventadas y fecha de hoy pasa en
// verde: verificarlas exigiría salir a la red, que es lo que este protocolo no hace.
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-stack-matrix.mjs');
const { SCHEMA, main, validateLimits } = await import(pathToFileURL(script).href);

import { esRuntimeInstalado } from './_entorno.mjs';

// Self-check del repositorio: estas pruebas leen `docs/`, que el instalador NO copia al proyecto de
// otra persona. Allá no aplican y además fallarían. Se saltean DICIENDO por qué.
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};


const texto = (base) => `${base} — texto real y suficientemente largo para no ser relleno.`;

function servicio(overrides = {}) {
  return {
    service_id: 'proveedor-free',
    plan_name: 'Free',
    captured_from: 'https://ejemplo.invalid/precios',
    captured_at: '2026-09-14',
    limits: [{ metric: 'requests', value: 1000, unit: 'peticiones/dia', hard: true }],
    upgrade_trigger: texto('Cruzar las mil peticiones diarias corta el servicio hasta el día siguiente'),
    paid_from: texto('USD 5 por mes el primer plan pago'),
    escalation: [{ when: texto('Se cruzan las mil peticiones'), to_plan: 'Paid', cost_note: texto('USD 5 por mes') }],
    ...overrides,
  };
}

function contrato(overrides = {}) {
  return {
    schema: SCHEMA,
    why: texto('Qué le alcanza a un proyecto del plan gratuito de cada servicio'),
    revalidated: '2026-09-14',
    max_age_days: 90,
    method: texto('Lectura de las páginas oficiales de cada proveedor'),
    services: [servicio()],
    ...overrides,
  };
}

test('AC3 · un contrato completo no tiene violaciones', () => {
  assert.deepEqual(validateLimits(contrato()), []);
});

test('FALSIFICACIÓN · AC3 · un servicio sin disparador de escalado se rechaza nombrándolo', () => {
  const sinTrigger = contrato({ services: [servicio({ upgrade_trigger: '' })] });
  const violaciones = validateLimits(sinTrigger);
  assert.ok(
    violaciones.some((v) => /upgrade_trigger/u.test(v) && /proveedor-free/u.test(v)),
    `tiene que nombrar el servicio y el campo, y devolvió: ${JSON.stringify(violaciones)}`,
  );
});

test('FALSIFICACIÓN · AC3 · un disparador de relleno no es un disparador', () => {
  for (const relleno of ['tbd', 'n/a', '-', 'si crece']) {
    const violaciones = validateLimits(contrato({ services: [servicio({ upgrade_trigger: relleno })] }));
    assert.ok(violaciones.some((v) => /upgrade_trigger/u.test(v)), `aceptó el relleno ${relleno}`);
  }
});

test('FALSIFICACIÓN · AC3 · un servicio sin ninguna fila de escalado se rechaza', () => {
  const vacio = validateLimits(contrato({ services: [servicio({ escalation: [] })] }));
  assert.ok(vacio.some((v) => /escalation/u.test(v)), JSON.stringify(vacio));

  const noEsLista = validateLimits(contrato({ services: [servicio({ escalation: 'ninguna' })] }));
  assert.ok(noEsLista.some((v) => /escalation/u.test(v)), JSON.stringify(noEsLista));
});

test('FALSIFICACIÓN · AC3 · una fila de escalado sin su costo no alcanza', () => {
  const sinCosto = validateLimits(contrato({
    services: [servicio({ escalation: [{ when: texto('Se cruza el cupo'), to_plan: 'Paid', cost_note: '' }] })],
  }));
  assert.ok(sinCosto.some((v) => /cost_note/u.test(v)), JSON.stringify(sinCosto));

  const claveDeMas = validateLimits(contrato({
    services: [servicio({ escalation: [{ when: texto('x'), to_plan: 'Paid', cost_note: texto('y'), extra: 1 }] })],
  }));
  assert.ok(claveDeMas.some((v) => /escalation/u.test(v)), 'una clave de más no se ignora en silencio');
});

test('FALSIFICACIÓN · el esquema se mira primero y corta', () => {
  assert.ok(validateLimits(null).some((v) => /objeto/u.test(v)));
  assert.ok(validateLimits({ schema: 'otro' }).some((v) => new RegExp(SCHEMA, 'u').test(v)));
  assert.equal(validateLimits({ schema: 'otro' }).length, 1, 'enumerar campos de algo que no es el contrato produce reproches sobre otra cosa');
});

test('FALSIFICACIÓN · un servicio con claves de más o de menos se rechaza', () => {
  const deMas = validateLimits(contrato({ services: [{ ...servicio(), extra: 1 }] }));
  assert.ok(deMas.some((v) => /proveedor-free/u.test(v)), JSON.stringify(deMas));

  const sinPlan = servicio();
  delete sinPlan.plan_name;
  assert.ok(validateLimits(contrato({ services: [sinPlan] })).length > 0, 'una clave faltante no pasa');
});

test('FALSIFICACIÓN · dos servicios con el mismo identificador se rechazan', () => {
  const repetido = validateLimits(contrato({ services: [servicio(), servicio()] }));
  assert.ok(repetido.some((v) => /proveedor-free/u.test(v)), JSON.stringify(repetido));
});

test('FALSIFICACIÓN · un cupo mal formado se rechaza, y una lista de cupos vacía se acepta', () => {
  const malFormado = validateLimits(contrato({ services: [servicio({ limits: [{ metric: 'x', value: 'mucho', unit: 'y', hard: true }] })] }));
  assert.ok(malFormado.some((v) => /limits/u.test(v)), 'el valor de un cupo tiene que ser un número');

  // Un servicio puede no tener ningún cupo numérico y ser honesto: lo que lo saca del plan gratuito
  // puede no ser un número. Es el caso medido de la cláusula de uso comercial.
  assert.deepEqual(validateLimits(contrato({ services: [servicio({ limits: [] })] })), []);
});

test('el contrato real del repositorio pasa su propia validación', async () => {
  const { readFileSync } = await import('node:fs');
  const real = JSON.parse(readFileSync(join(repoRoot, 'contracts', 'free-tier-limits.json'), 'utf8'));
  assert.deepEqual(validateLimits(real), []);
});

// AC5 de docs/spec.md · Sin entrada no aprueba: escribe VACÍO y sale 0, que es distinto de OK.
//
// POR QUÉ IMPORTA LA DISTINCIÓN. Un gate que aprueba por ausencia de entrada dice que la cobertura
// está bien cuando en realidad no se miró nada. Es la invención propia de este repositorio y todo
// gate nuevo tiene que declarar cuál de las dos cosas hace.
test('AC5 · sin matriz ni contrato escribe VACÍO y sale 0, sin decir OK', () => {
  const salida = [];
  const errores = [];
  const code = main(['check', 'docs/no-existe.json'], {
    read: () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); },
    write: (l) => salida.push(l),
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 0, errores.join('\n'));
  assert.ok(/^VACÍO: /u.test(salida.at(-1)), salida.join('\n'));
  assert.ok(!salida.some((l) => /^OK: /u.test(l)), 'un directorio sin matriz no compra un OK de cobertura');
});

test('FALSIFICACIÓN · con contrato pero sin matriz, y al revés, rechaza en vez de escribir VACÍO', () => {
  const soloContrato = [];
  assert.equal(main(['check', 'm.json'], {
    read: (ruta) => (String(ruta).includes('free-tier') ? JSON.stringify(contrato()) : (() => { throw new Error('ENOENT'); })()),
    write: () => {}, writeError: (l) => soloContrato.push(l),
  }), 1);
  assert.ok(soloContrato.some((l) => /matriz/u.test(l)), soloContrato.join('\n'));

  const soloMatriz = [];
  assert.equal(main(['check', 'm.json'], {
    read: (ruta) => (String(ruta).includes('free-tier') ? (() => { throw new Error('ENOENT'); })() : '{}'),
    write: () => {}, writeError: (l) => soloMatriz.push(l),
  }), 1);
  assert.ok(soloMatriz.some((l) => /free-tier/u.test(l)), soloMatriz.join('\n'));
});

test('FALSIFICACIÓN · un uso inválido sale 2 y no se confunde con un rechazo', () => {
  for (const args of [[], ['check'], ['otra', 'x'], ['check', '']]) {
    const errores = [];
    assert.equal(main(args, { write: () => {}, writeError: (l) => errores.push(l) }), 2, JSON.stringify(args));
    assert.ok(errores.some((l) => /usage/u.test(l)));
  }
});

test('el gate real compone las tres invariantes y sale verde sobre el repositorio', SOLO_FUENTE, async () => {
  const { readFileSync } = await import('node:fs');
  const salida = [];
  const errores = [];
  const code = main(['check', 'docs/discovery/eleccion-de-stack/diagnostics/stack-matrix.json'], {
    read: (ruta) => readFileSync(join(repoRoot, String(ruta)), 'utf8'),
    hoy: JSON.parse(readFileSync(join(repoRoot, 'contracts', 'free-tier-limits.json'), 'utf8')).revalidated,
    write: (l) => salida.push(l),
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 0, errores.join('\n'));
  assert.ok(salida.some((l) => /^OK: /u.test(l)), salida.join('\n'));
  assert.ok(salida.some((l) => /^LIMITE: /u.test(l)), 'el gate tiene que declarar qué NO puede comprobar');
});

test('FALSIFICACIÓN · los campos de cabecera del contrato se comprueban uno por uno', () => {
  const claveDeMas = validateLimits({ ...contrato(), extra: 1 });
  assert.ok(claveDeMas.some((v) => /exactamente/u.test(v)), JSON.stringify(claveDeMas));

  assert.ok(validateLimits(contrato({ why: 'corto' })).some((v) => /why/u.test(v)));
  assert.ok(validateLimits(contrato({ method: '' })).some((v) => /method/u.test(v)));
  assert.ok(validateLimits(contrato({ revalidated: 'ayer' })).some((v) => /revalidated/u.test(v)));
  for (const malo of [0, -1, 1.5, '90', null]) {
    assert.ok(validateLimits(contrato({ max_age_days: malo })).some((v) => /max_age_days/u.test(v)), `aceptó ${JSON.stringify(malo)}`);
  }
});

test('FALSIFICACIÓN · sin servicios el contrato corta ahí, sin enumerar lo que no existe', () => {
  assert.ok(validateLimits(contrato({ services: [] })).some((v) => /al menos un servicio/u.test(v)));
  assert.ok(validateLimits(contrato({ services: 'ninguno' })).some((v) => /al menos un servicio/u.test(v)));
});

test('FALSIFICACIÓN · un identificador de servicio mal formado se rechaza', () => {
  assert.ok(validateLimits(contrato({ services: [servicio({ service_id: 'Con Mayúsculas' })] })).some((v) => /service_id/u.test(v)));
  assert.ok(validateLimits(contrato({ services: [servicio({ plan_name: '' })] })).some((v) => /plan_name/u.test(v)));
  assert.ok(validateLimits(contrato({ services: [servicio({ captured_from: '' })] })).some((v) => /captured_from/u.test(v)));
  assert.ok(validateLimits(contrato({ services: [servicio({ captured_at: 'ayer' })] })).some((v) => /captured_at/u.test(v)));
  assert.ok(validateLimits(contrato({ services: [servicio({ paid_from: '' })] })).some((v) => /paid_from/u.test(v)));
  assert.ok(validateLimits(contrato({ services: [servicio({ limits: 'ninguno' })] })).some((v) => /limits/u.test(v)));
  assert.ok(validateLimits(contrato({ services: [servicio({ escalation: [{ when: texto('x'), to_plan: '', cost_note: texto('y') }] })] })).some((v) => /to_plan/u.test(v)));
  const cupoIncompleto = validateLimits(contrato({ services: [servicio({ limits: [{ metric: 'x', value: 1, unit: 'y' }] })] }));
  assert.ok(cupoIncompleto.some((v) => /limits/u.test(v)), 'un cupo con claves de menos no pasa');
  const cupoSinTipo = validateLimits(contrato({ services: [servicio({ limits: [{ metric: '', value: 1, unit: '', hard: 'si' }] })] }));
  assert.ok(cupoSinTipo.some((v) => /metric/u.test(v)) && cupoSinTipo.some((v) => /hard/u.test(v)), JSON.stringify(cupoSinTipo));
});

test('FALSIFICACIÓN · main rechaza y escribe cada violación, en vez de contarlas', SOLO_FUENTE, async () => {
  const { readFileSync } = await import('node:fs');
  const errores = [];
  const roto = JSON.parse(readFileSync(join(repoRoot, 'contracts', 'free-tier-limits.json'), 'utf8'));
  roto.services[0].upgrade_trigger = 'tbd';
  const code = main(['check', 'm.json'], {
    read: (ruta) => (String(ruta).includes('free-tier')
      ? JSON.stringify(roto)
      : readFileSync(join(repoRoot, 'docs', 'discovery', 'eleccion-de-stack', 'diagnostics', 'stack-matrix.json'), 'utf8')),
    hoy: roto.revalidated,
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  assert.ok(errores.every((l) => /^REJECTED: /u.test(l)), errores.join('\n'));
  assert.ok(errores.some((l) => /upgrade_trigger/u.test(l)), errores.join('\n'));
});

test('FALSIFICACIÓN · las ramas defensivas del contrato producen violación, nunca excepción', () => {
  assert.ok(validateLimits(contrato({ revalidated: undefined })).some((v) => /revalidated/u.test(v)));
  assert.ok(validateLimits(contrato({ services: [null] })).some((v) => /sin id/u.test(v)), 'un servicio nulo se nombra como sin id');
  assert.ok(validateLimits(contrato({ services: [servicio({ captured_at: undefined })] })).some((v) => /captured_at/u.test(v)));
  const whenCorto = validateLimits(contrato({
    services: [servicio({ escalation: [{ when: 'ya', to_plan: 'Paid', cost_note: texto('USD 5') }] })],
  }));
  assert.ok(whenCorto.some((v) => /when/u.test(v)), JSON.stringify(whenCorto));
});

test('FALSIFICACIÓN · main tolera un contrato sin lista de servicios y una matriz sin filas', () => {
  const errores = [];
  const code = main(['check', 'm.json'], {
    read: (ruta) => (String(ruta).includes('free-tier')
      ? JSON.stringify({ ...contrato(), services: 'ninguna' })
      : JSON.stringify({ schema: 'vcp.stack-matrix/1' })),
    hoy: '2026-09-14',
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1, 'un contrato sin servicios y una matriz sin filas no pueden aprobar');
  assert.ok(errores.every((l) => /^REJECTED: /u.test(l)), errores.join('\n'));
});
