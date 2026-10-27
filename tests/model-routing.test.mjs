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
import { leerProtocolo } from '../scripts/protocolo.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const leer = (ruta) => (ruta === 'SKILL.md' ? leerProtocolo(repoRoot) : readFileSync(join(repoRoot, ruta), 'utf8'));
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
    .map(([rol, ruta]) => [rol, ruta.nivel, c.niveles[ruta.nivel].modelo, ruta.esfuerzo]);
  assert.deepEqual(filas, esperadas);
});

test('filasDeLaTabla devuelve null sin delimitadores e ignora lo que no es fila de rol', () => {
  assert.equal(filasDeLaTabla('sin tabla'), null);
  assert.deepEqual(filasDeLaTabla('<!-- ruteo:inicio -->\n| Rol | Nivel |\n|---|---|\n| `red` | N2 | sonnet | low |\n<!-- ruteo:fin -->'),
    [['red', 'N2', 'sonnet', 'low']]);
});

// ---------------------------------------------------------------------------------------------
// ia-stack-3-4-1-tokens · AC4 · cada rol que nombran las fases tiene modelo y esfuerzo resolubles,
// y ninguna plantilla copia la tabla entera.
//
// LIMITE HONESTO. Los roles "que nombran las fases" se detectan por tres señales textuales: las filas
// de la tabla `<!-- ruteo:inicio -->`, las referencias `skills/subagent-<rol>.md` y las frases
// «rol `x`» / «role `x`» / `roles.x` en SKILL.md, phases/ y skills/. Un rol citado de otra forma no
// se ve. «Duplica la tabla» = un archivo de templates/ o AGENTS.md con una fila `| `rol` |` por cada
// rol del contrato; copiar 3 filas no se detecta, a propósito (citar un rol no es duplicar la tabla).
// El CLAUDE.md global del operador (~/.claude/CLAUDE.md) vive FUERA del repo: esta prueba no puede
// leerlo, así que no verifica que ahí no se duplique la tabla; el contrato manda y esa copia se
// revisa a mano.
// ---------------------------------------------------------------------------------------------

function archivosMd(dir) {
  const abs = join(repoRoot, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { recursive: true })
    .map((r) => `${dir}/${String(r).split(String.fromCharCode(92)).join('/')}`)
    .filter((r) => r.endsWith('.md'));
}

/** Roles que cita un texto: refs a subagent-<rol>.md, «rol `x`», «role `x`» y `roles.x`. */
export function rolesCitados(texto) {
  const hallados = new Set();
  for (const m of texto.matchAll(/skills\/subagent-([a-z-]+)\.md/gu)) hallados.add(m[1]);
  for (const m of texto.matchAll(/\b(?:rol|role)\s+`([a-z]+)`/gu)) hallados.add(m[1]);
  for (const m of texto.matchAll(/`roles\.([a-z]+)`/gu)) hallados.add(m[1]);
  return [...hallados].sort();
}

/** Cuántos roles de la lista tienen su fila `| `rol` |` en el texto. */
export function filasDeRolesEn(texto, roles) {
  return roles.filter((r) => new RegExp(`^[ \\t]*[|][ \\t]*\u0060${r}\u0060[ \\t]*[|]`, 'mu').test(texto));
}

test('ia-stack-3-4-1-tokens · AC4 · cada rol del contrato tiene nivel, modelo resoluble y esfuerzo explicito', () => {
  const c = contrato();
  for (const [rol, ruta] of Object.entries(c.roles)) {
    assert.ok(c.niveles[ruta.nivel], `${rol}: nivel sin definir`);
    assert.ok(MODELOS.includes(c.niveles[ruta.nivel].modelo), `${rol}: sin modelo resoluble`);
    assert.ok(ESFUERZOS.includes(ruta.esfuerzo), `${rol}: falta esfuerzo explicito en el rol`);
    assert.equal(ruta.esfuerzo, c.niveles[ruta.nivel].esfuerzo, `${rol}: el esfuerzo del rol difiere del de su nivel`);
    if (ruta.con_riesgo_alto) assert.ok(c.niveles[ruta.con_riesgo_alto], `${rol}: con_riesgo_alto apunta a un nivel inexistente`);
  }
});

test('ia-stack-3-4-1-tokens · AC4 · todo rol que nombran el nucleo, las fases o los skills existe en el contrato', () => {
  const c = contrato();
  const docs = ['SKILL.md', ...archivosMd('phases'), ...archivosMd('skills')];
  const citados = new Set(filasDeLaTabla(leer('SKILL.md'))?.map((f) => f[0]));
  for (const ruta of docs) for (const rol of rolesCitados(leer(ruta))) citados.add(rol);
  assert.ok(citados.size >= Object.keys(c.roles).length, 'la deteccion no vio ni los roles de la tabla');
  for (const rol of citados) {
    assert.ok(c.roles[rol], `el rol «${rol}» se nombra en los documentos pero no tiene ruta en el contrato`);
    assert.ok(c.niveles[c.roles[rol].nivel].modelo && c.roles[rol].esfuerzo, `${rol}: sin modelo o sin esfuerzo`);
  }
});

test('ia-stack-3-4-1-tokens · AC4 · el contrato declara la regla de Haiku', () => {
  const r = contrato().regla_haiku;
  assert.equal(typeof r, 'string');
  assert.match(r, /tareas cortas/u);
  assert.match(r, /subagentes con contexto nuevo/u);
  assert.match(r, /60K/u);
  assert.match(r, /N2 low/u);
});

test('ia-stack-3-4-1-tokens · AC4 · ninguna plantilla ni AGENTS.md duplica la tabla completa de roles', () => {
  const roles = Object.keys(contrato().roles);
  const candidatos = ['AGENTS.md', ...archivosMd('templates')].filter((r) => existsSync(join(repoRoot, r)));
  assert.ok(candidatos.length > 1);
  for (const ruta of candidatos) {
    const filas = filasDeRolesEn(leer(ruta), roles);
    assert.ok(filas.length < roles.length, `${ruta} duplica la tabla de ruteo (${filas.length}/${roles.length} filas): que cite contracts/model-routing.json`);
  }
});

test('ia-stack-3-4-1-tokens · AC4 · los detectores ven un rol sin ruta y una tabla copiada entera', () => {
  assert.deepEqual(rolesCitados('ver skills/subagent-red.md; el rol `fantasma`; `roles.docs`'), ['docs', 'fantasma', 'red']);
  const roles = ['a', 'b'];
  assert.deepEqual(filasDeRolesEn('| `a` | N1 |\n| `b` | N2 |', roles), ['a', 'b']);
  assert.deepEqual(filasDeRolesEn('texto `a` y `b`', roles), []);
});

// Revisión N3 3.4.1: `planificador` sube a N3 con riesgo alto (`con_riesgo_alto`) pero NO declara un
// `esfuerzo_con_riesgo_alto`. Decisión (la mínima y coherente): al subir de nivel hereda el esfuerzo
// del NIVEL destino, porque el orquestador pasa `effort=niveles[nivel].esfuerzo` (orchestrator-opus.md),
// no el esfuerzo del rol. Esta prueba fija esa herencia y que nunca baje respecto del esfuerzo base.
test('revision-n3 · BAJA · planificador con riesgo alto hereda el esfuerzo del nivel destino, y no baja', () => {
  const c = contrato();
  const ruta = c.roles.planificador;
  assert.equal('esfuerzo_con_riesgo_alto' in ruta, false, 'si se agrega esfuerzo_con_riesgo_alto, esta prueba y el orquestador deben usarlo');
  assert.ok(c.niveles[ruta.con_riesgo_alto], 'con_riesgo_alto debe ser un nivel del contrato');
  const heredado = c.niveles[ruta.con_riesgo_alto].esfuerzo;
  assert.ok(ESFUERZOS.includes(heredado));
  assert.ok(ESFUERZOS.indexOf(heredado) >= ESFUERZOS.indexOf(ruta.esfuerzo), 'subir de nivel no puede bajar el esfuerzo');
  assert.ok(ORDEN.indexOf(ruta.con_riesgo_alto) > ORDEN.indexOf(ruta.nivel), 'con_riesgo_alto debe subir de nivel');
});
