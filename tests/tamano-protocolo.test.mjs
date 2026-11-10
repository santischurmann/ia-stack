// El protocolo no crece: topes de tamaño del núcleo, las fases y las skills (spec 3.4.4, criterios 1, 2 y 6).
// Para sumar una regla hay que sacar otra.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const leer = (rel) => readFileSync(join(raiz, rel), 'utf8');
const lineas = (texto) => texto.replace(/\r?\n$/u, '').split(/\r?\n/u).length;

const FASES = ['00-arranque', '01-pedido', '02-caio', '03-research', '04-marca', '05-spec', '06-preview', '07-build', '08-publicar', '09-cierre'];
const ENCABEZADOS = ['## Para qué', '## Entra', '## Pasos', '## Entrega', '## Gate', '## Modelo'];

test('SKILL.md tiene 120 líneas o menos', () => {
  assert.ok(lineas(leer('SKILL.md')) <= 120, `SKILL.md tiene ${lineas(leer('SKILL.md'))} líneas`);
});

test('phases/ tiene exactamente las 10 fases', () => {
  const hay = readdirSync(join(raiz, 'phases')).sort();
  assert.deepEqual(hay, FASES.map((f) => `${f}.md`));
});

for (const fase of FASES) {
  test(`phases/${fase}.md: 60 líneas o menos y el esqueleto fijo`, () => {
    const texto = leer(`phases/${fase}.md`);
    assert.ok(lineas(texto) <= 60, `${fase} tiene ${lineas(texto)} líneas`);
    const titulos = texto.split(/\r?\n/u).filter((l) => l.startsWith('## ')).map((l) => l.trim());
    for (const h of ENCABEZADOS) assert.ok(titulos.includes(h), `${fase} no tiene «${h}»`);
  });
}

test('SKILL.md más la fase más larga caben en 24.000 caracteres', () => {
  const nucleo = leer('SKILL.md').length;
  const mayor = Math.max(...FASES.map((f) => leer(`phases/${f}.md`).length));
  assert.ok(nucleo + mayor <= 24000, `${nucleo} + ${mayor} = ${nucleo + mayor}`);
});

test('cada archivo de skills/ tiene 80 líneas o menos, y son 6 como máximo', () => {
  const archivos = readdirSync(join(raiz, 'skills')).filter((f) => f.endsWith('.md'));
  assert.ok(archivos.length <= 6, `hay ${archivos.length} skills`);
  for (const f of archivos) assert.ok(lineas(leer(`skills/${f}`)) <= 80, `skills/${f} tiene ${lineas(leer(`skills/${f}`))} líneas`);
});

test('las fases 1, 2, 5 y 6 nombran skills/brainstorm-egm.md y el archivo existe', () => {
  assert.ok(existsSync(join(raiz, 'skills/brainstorm-egm.md')));
  for (const fase of ['01-pedido', '02-caio', '05-spec', '06-preview']) {
    assert.ok(leer(`phases/${fase}.md`).includes('skills/brainstorm-egm.md'), `${fase} no nombra skills/brainstorm-egm.md`);
  }
});
