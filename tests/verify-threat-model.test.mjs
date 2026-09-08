// El puente entre «declaré un control» y «ese control está probado».
//
// El modelo de amenaza vive en Discovery y su gate comprueba forma y referencias internas. Este es
// la otra mitad, y corre en la fase 6.2: cada control declara un criterio de aceptación, y ese
// criterio tiene que existir en la spec y —cuando hay receipt— estar `COMPLIANT`.
//
// POR QUE ESTO CIERRA EL AGUJERO QUE MOTIVO TODO. `skills/security-baseline.md` declara
// textualmente que los huecos de authz NO están cubiertos por el escáner de patrones. Un control de
// authz declarado en el modelo produce un `ac_id`; de ahí el aparato que ya existe lo arrastra solo
// —RED escribe el test, `verify-evidence-trace criteria` exige una prueba que lo nombre, y el
// receipt exige ese AC `COMPLIANT` con hash vigente—. **Un control de authz declarado y no probado
// bloquea el push con los gates que ya existían.** No hace falta ningún mecanismo nuevo.
//
// EL ESCANER Y EL MODELO SON ORTOGONALES: el escáner mira patrones en un delta ya escrito, el
// modelo mira superficie declarada antes de construir. Hasta ahora corría uno solo.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMPTY_PREFIX, NO_INPUTS_CODE, UNKNOWN_AC_CODE, UNPROVEN_AC_CODE, USAGE,
  main, threatPath, unprovenControls, unresolvedControls,
} from '../scripts/verify-threat-model.mjs';

const MODELO = {
  schema: 'vcp.threat-model/1',
  controls: [
    { id: 'C1', entrypoint_id: 'E1', asset_id: 'A1', kind: 'authz', ac_id: 'AC7' },
    { id: 'C2', entrypoint_id: 'E1', asset_id: 'A1', kind: 'validation', ac_id: 'AC8' },
  ],
};

const SPEC = [
  '# Spec',
  '- [ ] **AC7:** GIVEN un rol sin permiso WHEN abre el reporte THEN recibe 403',
  '- [ ] **AC8:** GIVEN un id que no es un número WHEN llega THEN se rechaza sin tocar la base',
].join('\n');

test('el expediente vive donde el resto de los diagnósticos de la feature', () => {
  assert.equal(threatPath('mi-feature').replaceAll('\\', '/'), 'docs/discovery/mi-feature/diagnostics/threat.json');
});

// --- El control tiene que nombrar un criterio que la spec declare ------------------------------

test('con los dos criterios declarados en la spec no queda ningún control sin resolver', () => {
  assert.deepEqual(unresolvedControls(MODELO, SPEC), []);
});

test('FALSIFICACIÓN · un control que cita un criterio inexistente es una referencia rota', () => {
  const roto = { ...MODELO, controls: [{ ...MODELO.controls[0], ac_id: 'AC99' }] };
  const sueltos = unresolvedControls(roto, SPEC);
  assert.equal(sueltos.length, 1);
  assert.match(sueltos[0], /C1/u);
  assert.match(sueltos[0], /AC99/u);
});

test('un modelo sin controles no tiene nada que resolver, y eso no es un incumplimiento', () => {
  assert.deepEqual(unresolvedControls({ controls: [] }, SPEC), []);
  assert.deepEqual(unresolvedControls({}, SPEC), []);
});

// --- Y ese criterio tiene que estar probado ----------------------------------------------------

const RECEIPT_VERDE = {
  acceptance_criteria: [
    { ac_id: 'AC7', verdict: 'COMPLIANT' },
    { ac_id: 'AC8', verdict: 'COMPLIANT' },
  ],
};

test('con los criterios COMPLIANT no queda ningún control sin probar', () => {
  assert.deepEqual(unprovenControls(MODELO, RECEIPT_VERDE), []);
});

test('LA REGLA · un control cuyo criterio no está COMPLIANT bloquea aunque el escáner esté limpio', () => {
  const parcial = { acceptance_criteria: [{ ac_id: 'AC7', verdict: 'COMPLIANT' }, { ac_id: 'AC8', verdict: 'UNTESTED' }] };
  const sinProbar = unprovenControls(MODELO, parcial);
  assert.equal(sinProbar.length, 1);
  assert.match(sinProbar[0], /C2/u);
  assert.match(sinProbar[0], /AC8/u);
});

test('FALSIFICACIÓN · un criterio que el receipt ni menciona cuenta como no probado, no como ausente', () => {
  const sinMencion = { acceptance_criteria: [{ ac_id: 'AC7', verdict: 'COMPLIANT' }] };
  assert.equal(unprovenControls(MODELO, sinMencion).length, 1);
});

test('un receipt mal formado no cuelga el gate: todos los controles quedan sin probar', () => {
  assert.equal(unprovenControls(MODELO, {}).length, 2);
  assert.equal(unprovenControls(MODELO, null).length, 2);
});

// --- El CLI ------------------------------------------------------------------------------------

function io({ modelo, spec = SPEC, receipt } = {}) {
  const archivos = new Map();
  if (modelo !== undefined) archivos.set('threat', JSON.stringify(modelo));
  // `null` significa «ese archivo no está». `undefined` no serviría: dispara el valor por defecto
  // del parámetro y el fixture terminaría midiendo lo contrario de lo que dice medir.
  if (spec !== null) archivos.set('spec', spec);
  if (receipt !== undefined) archivos.set('receipt', JSON.stringify(receipt));
  return {
    hay: (ruta) => {
      if (ruta.includes('threat.json')) return archivos.has('threat');
      if (ruta.includes('receipt')) return archivos.has('receipt');
      return archivos.has('spec');
    },
    leer: (ruta) => {
      if (ruta.includes('threat.json')) return archivos.get('threat');
      if (ruta.includes('receipt')) return archivos.get('receipt');
      return archivos.get('spec');
    },
  };
}

test('sin modelo de amenaza escribe VACÍO y sale 0; con --require-inputs eso pasa a rechazo', () => {
  const dichos = [];
  assert.equal(main(['check', '--feature', 'demo'], () => {}, (m) => dichos.push(m), io({})), 0);
  const errores = [];
  assert.equal(main(['check', '--feature', 'demo', '--require-inputs'], () => {}, (m) => errores.push(m), io({})), 1);
  assert.match(errores.join('\n'), new RegExp(NO_INPUTS_CODE, 'u'));
});

test('el VACÍO se escribe con su prefijo, nunca como OK', () => {
  const dichos = [];
  main(['check', '--feature', 'demo'], (m) => dichos.push(m), () => {}, io({}));
  assert.ok(dichos[0].startsWith(EMPTY_PREFIX));
});

test('con el modelo y la spec en su lugar sale 0 y dice su límite', () => {
  const dichos = [];
  assert.equal(main(['check', '--feature', 'demo'], (m) => dichos.push(m), () => {}, io({ modelo: MODELO })), 0);
  assert.ok(dichos[0].startsWith('OK: '));
  assert.ok(dichos.some((d) => /nunca que el control exista/iu.test(d)), 'el límite tiene que viajar con la línea de éxito');
});

test('FALSIFICACIÓN · una referencia rota rechaza con su código', () => {
  const errores = [];
  const roto = { ...MODELO, controls: [{ ...MODELO.controls[0], ac_id: 'AC99' }] };
  assert.equal(main(['check', '--feature', 'demo'], () => {}, (m) => errores.push(m), io({ modelo: roto })), 1);
  assert.match(errores.join('\n'), new RegExp(UNKNOWN_AC_CODE, 'u'));
});

test('FALSIFICACIÓN · con receipt, un control sin probar rechaza con su propio código', () => {
  const errores = [];
  const parcial = { acceptance_criteria: [{ ac_id: 'AC7', verdict: 'COMPLIANT' }, { ac_id: 'AC8', verdict: 'PARTIAL' }] };
  const salida = main(['check', '--feature', 'demo', '--receipt', '.vibe/receipts/x.json'], () => {}, (m) => errores.push(m), io({ modelo: MODELO, receipt: parcial }));
  assert.equal(salida, 1);
  assert.match(errores.join('\n'), new RegExp(UNPROVEN_AC_CODE, 'u'));
});

test('sin spec no se puede resolver nada, y eso se dice en vez de pasar en verde', () => {
  const errores = [];
  assert.equal(main(['check', '--feature', 'demo'], () => {}, (m) => errores.push(m), io({ modelo: MODELO, spec: null })), 1);
  assert.match(errores.join('\n'), /spec/iu);
});

test('un modelo ilegible se rechaza como modelo roto, no como ausente', () => {
  const errores = [];
  const roto = { hay: () => true, leer: () => '{ no es json' };
  assert.equal(main(['check', '--feature', 'demo'], () => {}, (m) => errores.push(m), roto), 1);
  assert.match(errores.join('\n'), /threat\.json/u);
});

test('un uso incorrecto sale 2 y escribe el uso', () => {
  const errores = [];
  assert.equal(main(['inesperado'], () => {}, (m) => errores.push(m)), 2);
  assert.deepEqual(errores, [USAGE]);
  assert.equal(main(['check'], () => {}, () => {}), 2);
  assert.equal(main(['check', '--feature', 'MAYUSCULAS'], () => {}, () => {}), 2);
  assert.equal(main(['check', '--feature', 'demo', '--desconocido'], () => {}, () => {}), 2);
});

// --- Los bordes: basura por la puerta, y ninguna rama sin ejercitar ----------------------------

test('un control sin id o sin criterio se nombra «(sin id)» en vez de romper el mensaje', () => {
  const anonimo = { controls: [{ kind: 'authz' }] };
  assert.match(unresolvedControls(anonimo, SPEC)[0], /\(sin id\)/u);
  assert.match(unresolvedControls(anonimo, SPEC)[0], /null/u);
  assert.match(unprovenControls(anonimo, RECEIPT_VERDE)[0], /\(sin id\)/u);
  assert.match(unprovenControls(anonimo, RECEIPT_VERDE)[0], /null/u);
});

test('sin `leer` inyectado usa el sistema de archivos real y un fallo se reporta como modelo ilegible', () => {
  const errores = [];
  const salida = main(['check', '--feature', 'una-feature-que-no-existe'], () => {}, (m) => errores.push(m), { hay: () => true });
  assert.equal(salida, 1);
  assert.match(errores.join('\n'), /threat\.json no se pudo leer/u);
});

test('la spec y el receipt se pueden pasar por argumento, y el OK los nombra a los dos', () => {
  const dichos = [];
  const salida = main(
    ['check', '--feature', 'demo', '--spec', 'otra/spec.md', '--receipt', '.vibe/receipts/x.json'],
    (m) => dichos.push(m), () => {}, io({ modelo: MODELO, receipt: RECEIPT_VERDE }),
  );
  assert.equal(salida, 0, dichos.join('\n'));
  assert.match(dichos[0], /otra\/spec\.md/u);
  assert.match(dichos[0], /COMPLIANT en \.vibe\/receipts\/x\.json/u);
});

test('FALSIFICACIÓN · un receipt pedido y ausente frena, y uno ilegible también', () => {
  const ausentes = [];
  const sinReceipt = {
    hay: (ruta) => !ruta.includes('receipts'),
    leer: (ruta) => (ruta.includes('threat.json') ? JSON.stringify(MODELO) : SPEC),
  };
  assert.equal(main(['check', '--feature', 'demo', '--receipt', '.vibe/receipts/x.json'], () => {}, (m) => ausentes.push(m), sinReceipt), 1);
  assert.match(ausentes.join('\n'), /no existe \.vibe\/receipts\/x\.json/u);

  const rotos = [];
  const receiptRoto = {
    hay: () => true,
    leer: (ruta) => {
      if (ruta.includes('threat.json')) return JSON.stringify(MODELO);
      if (ruta.includes('receipts')) return '{ no es json';
      return SPEC;
    },
  };
  assert.equal(main(['check', '--feature', 'demo', '--receipt', '.vibe/receipts/x.json'], () => {}, (m) => rotos.push(m), receiptRoto), 1);
  assert.match(rotos.join('\n'), /no se pudo leer como JSON/u);
});

test('FALSIFICACIÓN · una bandera sin valor no se traga la bandera siguiente', () => {
  assert.equal(main(['check', '--feature', '--spec'], () => {}, () => {}), 2);
  assert.equal(main(['check', '--feature'], () => {}, () => {}), 2);
});

test('FALSIFICACIÓN · una bandera desconocida CON valor tampoco pasa: la lista es cerrada', () => {
  assert.equal(main(['check', '--feature', 'demo', '--desconocido', 'valor'], () => {}, () => {}), 2);
});
