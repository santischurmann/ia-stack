// AC4 de docs/spec.md · Una captura vencida se rechaza, en vez de dejarla pasar como cierta.
//
// POR QUÉ EL RECHAZO ES DURO Y NO UN AVISO. Está razonado en
// docs/adr/0001-los-limites-de-plan-gratuito-vencen.md: un número de plan gratuito vencido es peor
// que ninguno, porque se lee como cierto. El research midió que estos planes se mueven varias veces
// por año — un proveedor recortó su ancho de banda veinte veces en la ventana revisada.
//
// EL MODO DE FALLA QUE INTRODUCE, dicho de frente: el repositorio puede ponerse rojo sin que nadie
// haya tocado una línea, sólo porque pasó el tiempo. Es poco habitual y sorprende, así que el
// mensaje tiene que decir que la causa es la antigüedad y no un defecto.
//
// EL RELOJ SE INYECTA. Una comprobación que lee la hora del sistema no se puede falsificar sin
// esperar noventa días, y una prueba que no se puede falsificar no prueba nada.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-stack-matrix.mjs');
const { validateFreshness } = await import(pathToFileURL(script).href);

const contrato = (over = {}) => ({
  revalidated: '2026-09-14',
  max_age_days: 90,
  services: [
    { service_id: 'proveedor-free', captured_at: '2026-09-14' },
    { service_id: 'otro-free', captured_at: '2026-08-20' },
  ],
  ...over,
});

test('AC4 · una captura dentro del periodo no tiene violaciones', () => {
  assert.deepEqual(validateFreshness(contrato(), '2026-10-01'), []);
  assert.deepEqual(validateFreshness(contrato(), '2026-11-17'), [], 'el dia 90 exacto todavia entra');
});

test('FALSIFICACIÓN · AC4 · una captura vencida se rechaza diciendo que la causa es el tiempo', () => {
  const violaciones = validateFreshness(contrato(), '2026-12-25');
  assert.ok(violaciones.length > 0, 'una captura de 102 dias tiene que rechazar con periodo de 90');
  assert.ok(
    violaciones.some((v) => /antig|venc|dia/iu.test(v)),
    `el mensaje tiene que nombrar la antigüedad como causa, y devolvio: ${JSON.stringify(violaciones)}`,
  );
});

test('FALSIFICACIÓN · AC4 · se nombra el servicio vencido, no solo que algo venció', () => {
  const desparejo = contrato({
    services: [
      { service_id: 'al-dia', captured_at: '2026-12-01' },
      { service_id: 'vencido', captured_at: '2026-06-01' },
    ],
  });
  const violaciones = validateFreshness(desparejo, '2026-12-25');
  assert.ok(violaciones.some((v) => /vencido/u.test(v)), JSON.stringify(violaciones));
  assert.ok(!violaciones.some((v) => /al-dia/u.test(v)), 'no puede acusar al que esta fresco');
});

test('FALSIFICACIÓN · AC4 · una fecha del futuro se rechaza en vez de contarse como fresca', () => {
  const futuro = contrato({ services: [{ service_id: 'adivino', captured_at: '2027-01-01' }] });
  const violaciones = validateFreshness(futuro, '2026-09-14');
  assert.ok(violaciones.some((v) => /adivino/u.test(v)), 'una captura posterior a hoy es un dato mal escrito, no uno muy fresco');
});

test('FALSIFICACIÓN · AC4 · una fecha ilegible se rechaza, no se ignora', () => {
  for (const mala of ['ayer', '14/09/2026', '', null, '2026-13-45']) {
    const roto = contrato({ services: [{ service_id: 'ilegible', captured_at: mala }] });
    assert.ok(
      validateFreshness(roto, '2026-09-14').some((v) => /ilegible/u.test(v)),
      `acepto la fecha ${JSON.stringify(mala)}`,
    );
  }
});

test('FALSIFICACIÓN · sin periodo declarado no se adivina uno', () => {
  const sinPeriodo = contrato({ max_age_days: undefined });
  const violaciones = validateFreshness(sinPeriodo, '2030-01-01');
  assert.ok(violaciones.some((v) => /max_age_days/u.test(v)), JSON.stringify(violaciones));
});

test('el contrato real del repositorio esta fresco a la fecha de su propia captura', () => {
  const real = JSON.parse(readFileSync(join(repoRoot, 'contracts', 'free-tier-limits.json'), 'utf8'));
  assert.deepEqual(validateFreshness(real, real.revalidated), []);
});

// Las ramas defensivas: un contrato roto tiene que producir una violacion, nunca una excepcion. Un
// gate que se salva lanzando no comprobo nada, y quien lee su salida no distingue "esto esta mal"
// de "el gate se rompio mirandolo".
test('FALSIFICACIÓN · un contrato que no es objeto, o con servicios que no lo son, no lanza', () => {
  assert.ok(validateFreshness(null, '2026-09-14').some((v) => /objeto/u.test(v)));
  assert.ok(validateFreshness('texto', '2026-09-14').some((v) => /objeto/u.test(v)));

  const sinLista = validateFreshness(contrato({ services: 'ninguna' }), '2026-09-14');
  assert.deepEqual(sinLista, [], 'sin lista de servicios no hay ninguna captura que fechar');

  const servicioRoto = validateFreshness(contrato({ services: [null, 'texto', { captured_at: '2026-09-14' }] }), '2026-09-14');
  assert.equal(servicioRoto.length, 2, JSON.stringify(servicioRoto));
  assert.ok(servicioRoto.every((v) => /sin id/u.test(v)), 'un servicio sin identificador se nombra como tal, no se saltea');
  // El tercero no tiene identificador pero sí una fecha válida, así que esta comprobación no tiene
  // nada que decirle: el identificador faltante lo acusa validateLimits, que es de quien es ese
  // trabajo. Dos gates que acusen lo mismo divergen con el tiempo y nadie sabe cuál manda.
});

test('FALSIFICACIÓN · una fecha de referencia ilegible se rechaza antes de comparar nada', () => {
  for (const mala of ['hoy', '2026-02-30', '', null, 42]) {
    const violaciones = validateFreshness(contrato(), mala);
    assert.ok(violaciones.some((v) => /referencia/u.test(v)), `acepto ${JSON.stringify(mala)} como fecha de referencia`);
  }
});

test('FALSIFICACIÓN · una fecha con forma válida pero día inexistente no cuenta como fecha', () => {
  const febrero31 = contrato({ services: [{ service_id: 'imposible', captured_at: '2026-02-31' }] });
  assert.ok(
    validateFreshness(febrero31, '2026-09-14').some((v) => /imposible/u.test(v)),
    'el 31 de febrero parsea con el constructor pero no existe',
  );
});
