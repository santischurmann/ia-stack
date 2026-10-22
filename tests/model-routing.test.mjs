// El ruteo de modelos vive en UN contrato, y el dispatch lo lee: nunca un modelo escrito a mano.
//
// POR QUE EXISTE. Hasta la 3.2.0 todo subagente salia con `model="sonnet"` literal y los revisores,
// el refutador, el triangulador, DOCS y CHORE heredaban el modelo del orquestador, que es el caro.
// Haiku no aparecia en ninguna parte. Y el literal no era inofensivo: el `model` de la invocacion
// pisa el que declare cualquier otra capa, asi que mientras estuviera escrito ningun ruteo podia
// funcionar. Medido en los proyectos del operador entre el 12 y el 15-10-2026: el cupo semanal se
// cortaba jueves o viernes.
//
// QUE FIJA: la forma del contrato, que cada rol de subagente tenga ruta, los pisos (seguridad,
// revision y refutacion nunca por debajo de N3), que N4 nunca se use solo, que el juez corra en un
// modelo distinto del constructor, que el dispatch no escriba modelos literales y que la tabla de
// SKILL.md diga lo mismo que el contrato.
//
// LO QUE NO CUBRE: que el agente efectivamente pase el `model` al invocar. Eso ocurre en la
// conversacion, y ninguna prueba portable la ve. Un host sin parametro `model` ignora el ruteo.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const leer = (ruta) => readFileSync(join(repoRoot, ruta), 'utf8');
const contrato = () => JSON.parse(leer('contracts/model-routing.json'));

export const MODELOS = Object.freeze(['haiku', 'sonnet', 'opus', 'fable']);
export const ESFUERZOS = Object.freeze(['low', 'medium', 'high', 'xhigh', 'max']);
const ORDEN = Object.freeze(['N1', 'N2', 'N3', 'N4']);

/** Los roles que tienen archivo propio en skills/: cada uno tiene que tener ruta. */
function rolesConArchivo() {
  return readdirSync(join(repoRoot, 'skills'))
    .map((nombre) => /^subagent-(.+)\.md$/u.exec(nombre)?.[1])
    .filter(Boolean)
    .sort();
}

test('el contrato de ruteo existe y declara cuatro niveles con modelo y esfuerzo validos', () => {
  assert.ok(existsSync(join(repoRoot, 'contracts/model-routing.json')), 'falta contracts/model-routing.json');
  const c = contrato();
  assert.equal(c.schema, 'ia.model-routing/1');
  assert.equal(typeof c.why, 'string');
  assert.deepEqual(Object.keys(c.niveles), ORDEN);
  for (const [id, nivel] of Object.entries(c.niveles)) {
    assert.ok(MODELOS.includes(nivel.modelo), `${id}: modelo desconocido ${nivel.modelo}`);
    assert.ok(ESFUERZOS.includes(nivel.esfuerzo), `${id}: esfuerzo desconocido ${nivel.esfuerzo}`);
    assert.equal(typeof nivel.automatico, 'boolean', `${id}: automatico tiene que ser booleano`);
  }
  assert.equal(c.niveles.N1.modelo, 'haiku', 'la base es el modelo mas barato');
});

test('N4 nunca es automatico y la escalada automatica topa en N3', () => {
  const c = contrato();
  assert.equal(c.niveles.N4.automatico, false);
  for (const id of ['N1', 'N2', 'N3']) assert.equal(c.niveles[id].automatico, true, id);
  assert.equal(c.escalada.tope_automatico, 'N3');
  assert.equal(c.escalada.disparador_intentos_fallidos, 1);
  assert.equal(c.escalada.requiere_diagnostico_nuevo, true);
  assert.equal(c.escalada.vuelve_a_la_base, true);
  assert.match(c.escalada.N4, /sí/u, 'N4 tiene que decir que pide el «sí» de la persona');
});

test('cada subagente con archivo propio tiene ruta, y toda ruta apunta a un nivel que existe', () => {
  const c = contrato();
  for (const rol of rolesConArchivo()) assert.ok(c.roles[rol], `skills/subagent-${rol}.md no tiene ruta en el contrato`);
  for (const [rol, ruta] of Object.entries(c.roles)) {
    assert.ok(ORDEN.includes(ruta.nivel), `${rol}: nivel ${ruta.nivel} no existe`);
    assert.ok(ruta.nivel !== 'N4', `${rol}: ningun rol arranca en N4`);
    if (ruta.con_riesgo_alto) assert.ok(ORDEN.indexOf(ruta.con_riesgo_alto) > ORDEN.indexOf(ruta.nivel), `${rol}: con_riesgo_alto tiene que subir`);
    assert.equal(typeof ruta.para, 'string', `${rol}: falta para qué`);
  }
});

test('lectura, documentacion y tareas mecanicas van al nivel barato; seguridad, revision y refutacion nunca bajo N3', () => {
  const c = contrato();
  for (const rol of ['lector', 'docs', 'chore']) assert.equal(c.roles[rol].nivel, 'N1', rol);
  for (const rol of ['red', 'green', 'triangulate', 'refactor']) assert.equal(c.roles[rol].nivel, 'N2', rol);
  for (const rol of ['seguridad', 'revisor', 'refutador']) assert.ok(ORDEN.indexOf(c.roles[rol].nivel) >= 2, `${rol} bajo N3`);
  assert.equal(c.roles.planificador.con_riesgo_alto, 'N3');
});

test('el juez corre en un modelo distinto del que construyo', () => {
  const c = contrato();
  const modelo = (rol) => c.niveles[c.roles[rol].nivel].modelo;
  assert.ok(c.juez_distinto_del_constructor.length >= 3);
  for (const [juez, constructor] of c.juez_distinto_del_constructor) {
    assert.notEqual(modelo(juez), modelo(constructor), `${juez} y ${constructor} usan el mismo modelo`);
  }
  // Si el constructor escalo hasta el modelo del juez, la regla de arriba deja de valer en esa tarea:
  // el contrato tiene que decir que se hace entonces, no callarlo.
  assert.match(c.si_el_constructor_escalo_al_modelo_del_juez ?? '', /NOT_REVIEWED/u);
});

test('el dispatch del orquestador no escribe modelos ni esfuerzos literales', () => {
  const texto = leer('skills/orchestrator-opus.md');
  assert.doesNotMatch(texto, /model\s*=\s*["'](?:haiku|sonnet|opus|fable)["']/u);
  assert.doesNotMatch(texto, /effort\s*=\s*config\.effort/u);
  assert.match(texto, /contracts\/model-routing\.json/u);
});

test('ningun documento vivo nombra un modelo retirado como si fuera el vigente', () => {
  const vivos = ['SKILL.md', 'AGENTS.md', '.agents/skills/ia-stack/SKILL.md', 'templates/spec.md',
    ...readdirSync(join(repoRoot, 'skills')).map((n) => `skills/${n}`)];
  for (const ruta of vivos) assert.doesNotMatch(leer(ruta), /Sonnet 5(?![.\d])/u, `${ruta} dice «Sonnet 5»`);
});

/** Las filas de la tabla delimitada de SKILL.md: `| rol | nivel | modelo | esfuerzo |`. */
export function filasDeLaTabla(texto) {
  const m = /<!-- ruteo:inicio -->([\s\S]*?)<!-- ruteo:fin -->/u.exec(texto);
  if (!m) return null;
  return m[1].split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea.startsWith('| `'))
    .map((linea) => linea.split('|').slice(1, 5).map((celda) => celda.trim().replaceAll('`', '')));
}

test('la tabla de SKILL.md dice exactamente lo que dice el contrato', () => {
  const c = contrato();
  const filas = filasDeLaTabla(leer('SKILL.md'));
  assert.ok(filas, 'SKILL.md no tiene la tabla delimitada por <!-- ruteo:inicio --> / <!-- ruteo:fin -->');
  const esperadas = Object.entries(c.roles)
    .map(([rol, ruta]) => [rol, ruta.nivel, c.niveles[ruta.nivel].modelo, c.niveles[ruta.nivel].esfuerzo]);
  assert.deepEqual(filas, esperadas);
});

test('filasDeLaTabla devuelve null sin delimitadores e ignora lo que no es fila de rol', () => {
  assert.equal(filasDeLaTabla('sin tabla'), null);
  assert.deepEqual(filasDeLaTabla('<!-- ruteo:inicio -->\n| Rol | Nivel |\n|---|---|\n| `red` | N2 | sonnet | low |\n<!-- ruteo:fin -->'),
    [['red', 'N2', 'sonnet', 'low']]);
});
