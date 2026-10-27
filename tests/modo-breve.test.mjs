// ia-stack-3-4-1-tokens · AC3 — skills/modo-breve.md como contrato propio, y ninguna fase pide prosa larga.
//
// POR QUE EXISTE. Todo lo que un agente escribe vuelve a pagarse en cada mensaje siguiente. El modo
// breve fija el nivel (full) entre agentes y nombra cada excepción donde se escribe normal: código,
// commits, seguridad y acciones irreversibles. Un contrato que no nombra sus excepciones se lee con
// la que más conviene. Y de nada sirve si una fase le pide al subagente un «reporte detallado».
//
// QUE FIJA: el nivel declarado, las cuatro excepciones por nombre y con lenguaje normal, y que
// SKILL.md, phases/*.md y skills/orchestrator-opus.md no contengan frases que pidan prosa larga.
//
// LIMITE HONESTO: la detección es una lista acotada de frases («reporte/informe/resumen detallado,
// extenso, completo o largo», «explicá en detalle», y sus equivalentes en inglés). No entiende el
// sentido: una paráfrasis («contame todo con todos los detalles») pasa, y una frase de esa lista
// dirigida a la persona y no a un agente también se marca. Tampoco puede ver qué escribió un agente.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const leer = (ruta) => readFileSync(join(raiz, ruta), 'utf8');

const PROSA_LARGA = [
  /\b(?:reporte|informe|resumen)s?\s+(?:detallad|extens|complet|larg|exhaustiv)\p{L}*/iu,
  /\b(?:expl[ií]c|expliqu|describ|document)\p{L}*\s+(?:todo\s+)?(?:en\s+detalle|detalladamente|extensamente)/iu,
  /\b(?:detailed|full|long|verbose|exhaustive)\s+(?:report|summary|write-?up|explanation)\b/iu,
  /\b(?:explain|describe)\s+(?:everything\s+)?in\s+detail\b/iu,
];

/** Líneas (1-based) de un texto que contienen alguna frase que pide prosa larga. */
export function lineasConProsaLarga(texto) {
  const hallazgos = [];
  texto.split(/\r?\n/u).forEach((linea, i) => {
    if (PROSA_LARGA.some((re) => re.test(linea))) hallazgos.push({ linea: i + 1, texto: linea.trim() });
  });
  return hallazgos;
}

const documentosDeFases = () => [
  'SKILL.md',
  'skills/orchestrator-opus.md',
  ...readdirSync(join(raiz, 'phases')).filter((f) => /^\d\d-.*\.md$/u.test(f)).sort().map((f) => `phases/${f}`),
];

test('ia-stack-3-4-1-tokens · AC3 · modo-breve.md declara el nivel full entre agentes', () => {
  const md = leer('skills/modo-breve.md');
  assert.match(md, /^\*\*Nivel: full\*\*/mu, 'falta la línea «**Nivel: full**»');
  assert.match(md, /entre agentes/iu);
  assert.doesNotMatch(md, /nivel:\s*(?:lite|ultra)/iu, 'no declara otro nivel');
});

test('ia-stack-3-4-1-tokens · AC3 · modo-breve.md nombra cada excepción: código, commits, seguridad e irreversibles, con lenguaje normal', () => {
  const md = leer('skills/modo-breve.md');
  const idx = md.indexOf('## Lenguaje normal, nunca breve');
  assert.ok(idx >= 0, 'falta la sección «## Lenguaje normal, nunca breve»');
  const seccion = md.slice(idx).split(/\n## /u)[0];
  for (const excepcion of ['Código', 'Commits', 'Seguridad', 'Acciones irreversibles']) {
    assert.match(seccion, new RegExp(`^- \\*\\*${excepcion}\\*\\*`, 'mu'), `la excepción «${excepcion}» no está nombrada`);
  }
  assert.match(seccion, /lenguaje normal/iu);
});

test('ia-stack-3-4-1-tokens · AC3 · ni el núcleo, ni las fases, ni el orquestador piden prosa larga entre agentes', () => {
  for (const ruta of documentosDeFases()) {
    const hallazgos = lineasConProsaLarga(leer(ruta));
    assert.deepEqual(hallazgos, [], `${ruta} pide prosa larga: ${JSON.stringify(hallazgos)}`);
  }
});

test('ia-stack-3-4-1-tokens · AC3 · el detector marca las frases de la lista y deja pasar el modo breve', () => {
  const malas = [
    'Pedile al subagente un reporte detallado de lo que hizo.',
    'El informe completo va en el mensaje.',
    'Explicá en detalle cada decisión.',
    'Return a detailed report to the orchestrator.',
    'Explain in detail what you changed.',
    'Devolvé un resumen extenso.',
  ];
  for (const m of malas) assert.equal(lineasConProsaLarga(m).length, 1, m);
  const buenas = [
    'Reportá breve: sin relleno, fragmentos OK.',
    'EVIDENCE va entero; NOTES hasta 80 palabras.',
    'El detalle va a .vibe/handoffs/ y el reporte tiene 40 líneas o menos.',
  ];
  for (const b of buenas) assert.deepEqual(lineasConProsaLarga(b), [], b);
  assert.deepEqual(lineasConProsaLarga('uno\nun reporte detallado\r\ntres'), [{ linea: 2, texto: 'un reporte detallado' }]);
});
