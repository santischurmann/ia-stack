// No romper lo que ya usa gente real, y revisar el codigo de verdad.
//
// POR QUE EXISTE. Hasta la 3.3.0 el protocolo no sabia si una app tenia usuarios: no preguntaba donde
// corria ni que rama desplegaba a produccion, su chequeo de salud mira solo esta maquina, y una
// migracion de datos no pedia respaldo. Un vibe coder con la app en vivo podia seguirlo al pie de la
// letra y romper produccion con el primer push. Ademas la Fase 7 confiaba en el criterio del modelo
// sobre lo tocado, sin decirle que buscar ni pedirle que lo compruebe, y ninguna lente miraba el
// rendimiento. Viene del video «nKkmfBYHu_Q» (23-10-2026), refutado en dos rondas por Codex y un
// refutador ciego.
//
// QUE FIJA: que cada regla este escrita donde el agente la lee, con su forma. LO QUE NO CUBRE: que el
// agente la cumpla, ni que lo que la persona declara sobre produccion sea cierto: se declara, no se
// infiere, y ningun gate puede verlo.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const leer = (ruta) => readFileSync(join(repoRoot, ruta), 'utf8');

/** El texto entre dos marcas literales del documento; null si falta alguna. */
export function entre(texto, desde, hasta) {
  const i = texto.indexOf(desde);
  if (i === -1) return null;
  const j = texto.indexOf(hasta, i + desde.length);
  return j === -1 ? null : texto.slice(i, j);
}

test('entre devuelve el tramo o null', () => {
  assert.equal(entre('a [x] b', '[', ']'), '[x');
  assert.equal(entre('a', '[', ']'), null);
  assert.equal(entre('a [x', '[', ']'), null);
});

test('PROJECT.md trae el bloque de produccion, declarado por la persona y sin fecha que se selle sola', () => {
  const bloque = entre(leer('templates/vibe/PROJECT.md'), '## Producción', '\n---');
  assert.ok(bloque, 'falta ## Producción en templates/vibe/PROJECT.md');
  for (const campo of ['¿La usa gente real?', '¿Qué rama despliega a producción?', '¿Hay una copia de prueba?', '¿Toca datos reales?', 'Declarado por']) {
    assert.ok(bloque.includes(campo), `falta el campo «${campo}»`);
  }
  // El instalador reemplaza TODO YYYY-MM-DD por la fecha de hoy: aca sellaria una declaracion que nadie hizo.
  assert.doesNotMatch(bloque, /YYYY-MM-DD/u);
});

test('Bootstrap pregunta por produccion una vez, en lenguaje simple, y nunca lo infiere', () => {
  const paso = entre(leer('SKILL.md'), '7c. **Producción**', '8. **Confirmar el stack detectado**');
  assert.ok(paso, 'falta el paso 7c de Bootstrap');
  assert.match(paso, /🔵 \*\*¿Tu app ya la usa gente real\?\*\*/u);
  assert.match(paso, /nunca se infiere/u);
  assert.match(paso, /copia de prueba \(staging\)/u, 'cada término técnico, explicado');
});

test('LAW 9 dice que hacer cuando un push despliega a produccion, sin romper sus frases fijadas', () => {
  const leyes = entre(leer('SKILL.md'), '## LAWS — non-negotiable', '\n**IRON LAW');
  assert.ok(leyes);
  assert.match(leyes, /\*\*Cuando un push despliega a producción\*\*/u);
  assert.match(leyes, /dos pasos, a propósito/u);
  assert.match(leyes, /se pide aparte, con su propio menú/u);
});

test('8.1 lleva a produccion con un menu aparte, despues de probar la copia de prueba', () => {
  const texto = leer('SKILL.md');
  const tramo = entre(texto, '**8.1 Commit/push/merge**', '**8.1.1 Ancla de la traza**');
  assert.ok(tramo);
  assert.match(tramo, /🔵 \*\*¿Lo llevo a producción\?\*\*/u);
  assert.match(tramo, /- \*\*A\)\*\* Todavía no — .*\*\(recomendado mientras la copia de prueba no se haya mirado\)\*/u);
});

test('8.0 pide respaldo y vuelta atras de los datos antes de tocarlos', () => {
  const tramo = entre(leer('SKILL.md'), '## PHASE 8 — DEPLOY', '**8.1 Commit/push/merge**');
  assert.match(tramo, /`datos`/u);
  assert.match(tramo, /respaldo/u);
  assert.match(leer('templates/deploy.json'), /"datos"/u);
});

test('la Fase 6 mira la interfaz en un navegador real sin imponer una herramienta', () => {
  const fase = entre(leer('SKILL.md'), '## PHASE 6 — TEST', '## PHASE 7 — SIMPLIFY');
  assert.match(fase, /navegador real/u);
  assert.match(fase, /no automatizado/u);
  assert.match(fase, /nunca al commit/u, 'los artefactos de la prueba no se commitean');
});

test('la revision busca lo que sobra, lo repetido y el trabajo de mas, y cada hallazgo trae su prueba', () => {
  const refactor = leer('skills/subagent-refactor.md');
  for (const busca of ['Código sin usar', 'Lógica repetida', 'Trabajo de más']) assert.ok(refactor.includes(busca), `subagent-refactor.md no busca «${busca}»`);
  assert.match(refactor, /cómo lo comprobaste/u);
  assert.match(refactor, /cambia lo que el programa hace/u, 'lo que cambia conducta no se toca en verde: pide su prueba roja');
  assert.match(leer('SKILL.md'), /- \*\*Confiabilidad\*\* — [^\n]*rendimiento/u, 'la lente de confiabilidad mira el rendimiento cuando corresponde');
});

test('DOCS mantiene el diagrama de arquitectura solo si existe y quedo falso', () => {
  const docs = leer('skills/subagent-docs.md');
  assert.match(docs, /docs\/arquitectura\.md/u);
  assert.match(docs, /Mermaid/u);
  assert.match(docs, /quedó falso/u);
});
