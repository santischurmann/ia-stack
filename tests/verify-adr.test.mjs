// El registro de decisión de arquitectura, que hasta el 2026-09-04 era un artefacto huérfano.
//
// `templates/adr.md` y su plantilla embebida existían desde hacía meses y **ninguna fase los
// invocaba**: `grep -ci adr` daba 0 en SKILL.md y 0 en README.md. Un artefacto que nadie pide es
// peso muerto, y el que lo encuentra no sabe si tiene que usarlo.
//
// Se enganchó a la fase 4 (PLAN) y se le puso este gate, porque engancharlo sin verificación es
// prosa que nadie cumple — que es exactamente el defecto que tenía la plantilla de spec: `SKILL.md`
// la mandaba usar y su propio gate la rechazaba en 7 de 8 secciones.

import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';
import { CARPETA, EMPTY_PREFIX, ESTADOS, SECCIONES, USAGE, cuerpoDeSeccion, esAdr, main, violaciones } from '../scripts/verify-adr.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};

const VALIDO = `# ADR 0001: usar Node nativo sin dependencias

**Date:** 2026-09-05 | **Status:** Accepted

## Context
El protocolo tiene que correr en la máquina de cualquiera sin instalar nada primero.

## Decision
Se usa la biblioteca estándar de Node y nada más, incluido su corredor de pruebas.

## Options Considered
**A — Node nativo** Pros: cero instalación. Cons: menos azúcar sintáctica.
**B — Un framework de pruebas** Pros: más cómodo. Cons: una dependencia que envejece.

**Chosen:** A · **Reason:** una dependencia menos es una promesa menos que romper.

## Consequences
Se vuelve más difícil escribir dobles de prueba complejos, y hay que escribirlos a mano.
`;

test('un ADR bien formado pasa', () => {
  assert.deepEqual(violaciones('0001-node-nativo.md', VALIDO), []);
});

test('FALSIFICACIÓN · falta cualquiera de las cuatro secciones y rechaza, nombrando cuál', () => {
  for (const seccion of SECCIONES) {
    const sin = VALIDO.replace(`## ${seccion}`, '## Otra cosa');
    const v = violaciones('0001-x.md', sin);
    assert.equal(v.length >= 1, true, `sacar ${seccion} tiene que rechazar`);
    assert.match(v.join(' '), new RegExp(seccion, 'u'));
  }
});

test('FALSIFICACIÓN · una sección presente pero vacía no cuenta como escrita', () => {
  // El modo de falla que importa: dejar el encabezado para que el gate lo vea y no escribir nada
  // debajo. Un ADR con las cuatro secciones vacías sería un ADR según un detector que sólo cuente
  // encabezados.
  const vacia = VALIDO.replace(/## Consequences\n[^#]*/u, '## Consequences\n\n');
  assert.match(violaciones('0001-x.md', vacia).join(' '), /Consequences/u);
});

test('FALSIFICACIÓN · un estado inventado, o ninguno, se rechaza', () => {
  assert.match(violaciones('0001-x.md', VALIDO.replace('Accepted', 'listo')).join(' '), /Status/u);
  assert.match(violaciones('0001-x.md', VALIDO.replace(/\*\*Status:\*\*[^\n]*/u, '')).join(' '), /Status/u);
  // Los cuatro válidos pasan.
  for (const estado of ESTADOS) {
    assert.deepEqual(violaciones('0001-x.md', VALIDO.replace('Accepted', estado)), [], `${estado} es un estado válido`);
  }
});

test('FALSIFICACIÓN · la plantilla sin llenar no cuenta como decisión registrada', () => {
  const conHueco = VALIDO.replace('usar Node nativo sin dependencias', '<title>');
  assert.match(violaciones('0001-x.md', conHueco).join(' '), /sin llenar|hueco|plantilla/iu);
});

test('FALSIFICACIÓN · elegir sin decir por qué se rechaza', () => {
  const sinRazon = VALIDO.replace('**Chosen:** A · **Reason:** una dependencia menos es una promesa menos que romper.', '**Chosen:** A');
  assert.match(violaciones('0001-x.md', sinRazon).join(' '), /Reason|por qué/iu);
});

test('esAdr reconoce la forma del nombre y descarta el resto', () => {
  assert.equal(esAdr('0001-node-nativo.md'), true);
  assert.equal(esAdr('0042-otra-cosa.md'), true);
  assert.equal(esAdr('README.md'), false);
  assert.equal(esAdr('1-corto.md'), false);
  assert.equal(esAdr('0001-node-nativo.txt'), false);
});

test('cuerpoDeSeccion devuelve el texto de la sección y null si no está', () => {
  assert.match(cuerpoDeSeccion(VALIDO, 'Decision'), /biblioteca estándar/u);
  assert.equal(cuerpoDeSeccion(VALIDO, 'Inexistente'), null);
});

function correr(args, io) {
  const salidas = [];
  const errores = [];
  const codigo = main(args, (m) => salidas.push(m), (m) => errores.push(m), io);
  return { codigo, salidas, errores };
}

test('el CLI rechaza el uso inválido y escribe VACÍO cuando no hay decisiones', () => {
  assert.deepEqual(correr([], {}).errores, [USAGE]);
  assert.equal(correr([], {}).codigo, 2);
  assert.equal(correr(['otra'], {}).codigo, 2);
  assert.equal(correr(['check', 'a', 'b'], {}).codigo, 2);

  const sinCarpeta = correr(['check'], { hay: () => false });
  assert.equal(sinCarpeta.codigo, 0);
  assert.match(sinCarpeta.salidas[0], new RegExp(`^${EMPTY_PREFIX}`, 'u'));
  assert.match(sinCarpeta.salidas[0], new RegExp(CARPETA, 'u'));

  // Carpeta con archivos que no son ADR: tampoco hay nada que verificar, y eso es VACÍO, no OK.
  const sinAdrs = correr(['check'], { hay: () => true, listar: () => ['notas.md', 'README.md'] });
  assert.equal(sinAdrs.codigo, 0);
  assert.match(sinAdrs.salidas[0], new RegExp(`^${EMPTY_PREFIX}`, 'u'));
});

test('el CLI acepta un ADR válido, rechaza uno inválido y uno ilegible', () => {
  const io = { hay: () => true, listar: () => ['0001-x.md'], leer: () => VALIDO };
  const ok = correr(['check'], io);
  assert.equal(ok.codigo, 0, ok.errores.join(' '));
  assert.match(ok.salidas.join('\n'), /^OK: 1 decisión/u);
  assert.match(ok.salidas.join('\n'), /LÍMITE:/u);

  const mal = correr(['check'], { ...io, leer: () => VALIDO.replace('## Consequences', '## Nada') });
  assert.equal(mal.codigo, 1);
  assert.match(mal.errores.join('\n'), /^REJECTED: /u);

  const roto = correr(['check'], { ...io, leer: () => { throw new Error('EACCES'); } });
  assert.equal(roto.codigo, 1);
  assert.match(roto.errores.join('\n'), /no se pudo leer/u);
});

test('las dos plantillas de ADR que el protocolo publica pasan su propio gate', SOLO_FUENTE, () => {
  // Mismo criterio que las plantillas de spec: un molde que su propio gate rechaza le hace perder
  // el día a quien lo copie. Se les llenan los huecos con un valor mínimo, porque un molde vacío
  // tiene que tener huecos — lo que se comprueba es que las SECCIONES estén y estén completas.
  const llenar = (t) => t
    .replace(/<NNNN>/gu, '0001')
    .replace(/<title>/gu, 'una decisión de ejemplo')
    .replace(/<YYYY-MM-DD>/gu, '2026-09-05')
    .replace(/Proposed \| Accepted \| Deprecated \| Superseded by ADR-NNNN/u, 'Accepted')
    .replace(/<[^>\n]+>/gu, 'texto de ejemplo suficientemente largo para contar');

  const canonica = llenar(readFileSync(join(repoRoot, 'templates', 'adr.md'), 'utf8'));
  assert.deepEqual(violaciones('0001-canonica.md', canonica), [], 'templates/adr.md tiene que pasar');

  const skill = readFileSync(join(repoRoot, 'skills', 'spec-plan-templates.md'), 'utf8');
  const bloque = skill.match(/## TEMPLATE: docs\/adr[\s\S]*?```markdown\n([\s\S]*?)```/u);
  assert.ok(bloque, 'no se encontró la plantilla embebida de ADR');
  assert.deepEqual(violaciones('0001-embebida.md', llenar(bloque[1])), [], 'la plantilla embebida tiene que pasar');
});

test('las decisiones de arquitectura de este repositorio, si existen, están bien formadas', SOLO_FUENTE, () => {
  const r = correr(['check', join(repoRoot, 'docs', 'adr')], {});
  assert.equal(r.codigo, 0, r.errores.join(' | '));
});
