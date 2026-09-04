// El gate que faltaba: los documentos que declaran la feature activa tienen que nombrar la misma.
//
// Medido en este repositorio el 2026-09-04, antes de que el gate existiera: `docs/spec.md` decía
// `candidatos-de-research`, `.vibe/SESSION.md` decía `integridad-verificable` y
// `docs/phase-plan.json` decía `research-cycle-2026-08-29`. Tres respuestas distintas a «¿en qué
// estamos trabajando?», y nada las comparaba.

import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';
import {
  EMPTY_PREFIX,
  FUENTES,
  USAGE,
  declaraciones,
  desacuerdos,
  main,
  slugDePhasePlan,
  slugDeSession,
  slugDeSpec,
} from '../scripts/verify-feature-activa.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};

const vista = (archivo, slug) => ({ archivo, slug, como: 'x' });

test('cada lector saca el slug de donde vive en su archivo', () => {
  assert.equal(slugDeSpec('# Spec: candidatos-de-research\n\ntexto'), 'candidatos-de-research');
  assert.equal(slugDeSpec('# Otra cosa\n'), null);
  assert.equal(slugDeSession('# Session — 2026-08-27\n\n**Feature slug:** integridad-verificable\n'), 'integridad-verificable');
  assert.equal(slugDeSession('sin slug\n'), null);
  assert.equal(slugDePhasePlan('{"feature":"x"}'), 'x');
  assert.equal(slugDePhasePlan('{"feature":""}'), null);
  assert.equal(slugDePhasePlan('{}'), null);
  // Un JSON roto lo rechaza el gate del plan de fases, que es su dueño. Acá no se opina.
  assert.equal(slugDePhasePlan('{roto'), null);
});

test('el placeholder de la plantilla no cuenta como declaración', () => {
  // `templates/vibe/SESSION.md` trae el hueco entre paréntesis. Leerlo como slug haría que un
  // proyecto recién instalado rechace por no haber elegido todavía, que es justo cuando no hay nada
  // que comparar.
  assert.equal(slugDeSession('**Feature slug:** (set before first gate; lowercase kebab-case)\n'), null);
});

test('FALSIFICACIÓN · dos documentos que dicen features distintas se rechazan, nombrando a los dos', () => {
  const malas = desacuerdos([vista('docs/spec.md', 'uno'), vista('.vibe/SESSION.md', 'dos')]);
  assert.equal(malas.length, 1);
  assert.match(malas[0], /docs\/spec\.md/u);
  assert.match(malas[0], /\.vibe\/SESSION\.md/u);
  assert.match(malas[0], /uno/u);
  assert.match(malas[0], /dos/u);
});

test('FALSIFICACIÓN · tres en desacuerdo se reportan todos, no sólo el primero', () => {
  const malas = desacuerdos([vista('docs/spec.md', 'a'), vista('.vibe/SESSION.md', 'b'), vista('docs/phase-plan.json', 'c')]);
  assert.equal(malas.length, 1, 'un solo mensaje, pero tiene que nombrar los tres');
  for (const s of ['a', 'b', 'c']) assert.match(malas[0], new RegExp(s, 'u'));
});

test('documentos de acuerdo no producen ninguna violación', () => {
  assert.deepEqual(desacuerdos([vista('docs/spec.md', 'x'), vista('.vibe/SESSION.md', 'x')]), []);
  assert.deepEqual(desacuerdos([vista('docs/spec.md', 'x')]), []);
  assert.deepEqual(desacuerdos([]), []);
});

test('declaraciones sólo mira las fuentes presentes y legibles', () => {
  const hay = (ruta) => !String(ruta).includes('phase-plan');
  const leer = (ruta) => {
    const r = String(ruta);
    if (r.includes('spec.md')) return '# Spec: mi-feature\n';
    if (r.includes('SESSION.md')) throw new Error('EACCES');
    return '';
  };
  // El ilegible se saltea en vez de reventar: un permiso raro no es un desacuerdo de feature.
  assert.deepEqual(declaraciones('/r', hay, leer), [{ archivo: 'docs/spec.md', slug: 'mi-feature', como: FUENTES[0].como }]);
});

function correr(args, io) {
  const salidas = [];
  const errores = [];
  const codigo = main(args, (m) => salidas.push(m), (m) => errores.push(m), io);
  return { codigo, salidas, errores };
}

test('el CLI rechaza el uso inválido y escribe VACÍO cuando no hay con qué comparar', () => {
  assert.deepEqual(correr([], {}).errores, [USAGE]);
  assert.equal(correr([], {}).codigo, 2);
  assert.equal(correr(['otra-cosa'], {}).codigo, 2);
  assert.equal(correr(['check', 'a', 'b'], {}).codigo, 2);

  const sinNada = correr(['check'], { hay: () => false });
  assert.equal(sinNada.codigo, 0);
  assert.match(sinNada.salidas[0], new RegExp(`^${EMPTY_PREFIX}`, 'u'));

  // Con una sola fuente no hay acuerdo NI desacuerdo: eso es VACÍO, no OK. Escribir OK ahí vendería
  // por comprobada una coherencia que nadie comparó.
  const unaSola = correr(['check'], { hay: (r) => String(r).includes('spec.md'), leer: () => '# Spec: sola\n' });
  assert.equal(unaSola.codigo, 0);
  assert.match(unaSola.salidas[0], new RegExp(`^${EMPTY_PREFIX}`, 'u'));
  assert.match(unaSola.salidas[0], /sola/u);
});

test('el CLI acepta el acuerdo y rechaza el desacuerdo', () => {
  const leer = (ruta) => (String(ruta).includes('spec.md') ? '# Spec: misma\n' : '**Feature slug:** misma\n');
  const ok = correr(['check'], { hay: (r) => !String(r).includes('phase-plan'), leer });
  assert.equal(ok.codigo, 0, ok.errores.join(' '));
  assert.match(ok.salidas.join('\n'), /^OK: /u);
  assert.match(ok.salidas.join('\n'), /LÍMITE:/u);

  const leerMal = (ruta) => (String(ruta).includes('spec.md') ? '# Spec: una\n' : '**Feature slug:** otra\n');
  const mal = correr(['check'], { hay: (r) => !String(r).includes('phase-plan'), leer: leerMal });
  assert.equal(mal.codigo, 1);
  assert.match(mal.errores.join('\n'), /^REJECTED: /u);
});

test('este repositorio declara una sola feature activa en todos sus documentos', SOLO_FUENTE, () => {
  // El self-check que hace verdadero al gate: no alcanza con que funcione sobre fixtures.
  const r = correr(['check', repoRoot], {});
  assert.equal(r.codigo, 0, r.errores.join(' | '));
});
