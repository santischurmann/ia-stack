// El presupuesto de contexto vive en UN contrato y los documentos dicen lo mismo que el.
//
// POR QUE EXISTE. Medido el 26-10-2026: una sesion llego a 910K tokens de contexto, cada sesion
// arrastra ~80K fijos (conectores, memoria, instrucciones) y una sesion a 910K cuesta ~8 veces por
// turno lo que una de 110K. El tope viejo (200K, 100K en Haiku) se medía sobre el total, con lo que
// los ~80K fijos se comian el margen y el aviso llegaba tarde. El tope nuevo se mide sobre MENSAJES:
// 120K el orquestador, 60K la subsesion.
//
// QUE FIJA: el contrato `contracts/model-routing.json` § `contexto` (medido_sobre, topes, aviso) y
// que ningun documento vivo (SKILL.md, phases/, skills/, README, INSTALL, AGENTS, templates/)
// nombre un tope de contexto distinto de 120K / 60K ni lo mida sobre el total.
//
// LIMITE HONESTO (lo que NO cubre): la deteccion es una heuristica por PARRAFO. Un parrafo es
// "de presupuesto" si nombra presupuesto/tope/handoff de contexto o "sesion nueva pasados"; ahi cada
// cifra de 50.000 o mas tokens tiene que ser 120K o 60K y el parrafo tiene que decir "mensajes".
// No se ve un tope escrito con palabras ("doscientos mil"), ni uno en un parrafo que no use esas
// frases, ni los numeros chicos. Cifras con tilde (`~80K`, el costo fijo) no cuentan como tope. Una cifra con tilde (`~80K`, el costo fijo) no cuenta como tope. Tampoco se confunde con cifras que describen otra cosa (los
// "unos 40.000 tokens" del MAPA son el tamaño del protocolo; los 300.000 del dato historico no estan
// en un parrafo de presupuesto). CHANGELOG.md es historia y no se revisa. Que el agente efectivamente
// cierre y compacte al llegar al tope ocurre en la conversacion: ninguna prueba portable lo ve.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { leerProtocolo } from '../scripts/protocolo.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const contrato = () => JSON.parse(readFileSync(join(repoRoot, 'contracts/model-routing.json'), 'utf8'));

function mdEn(dir) {
  const abs = join(repoRoot, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { recursive: true })
    .map((r) => join(dir, String(r)).replaceAll(String.fromCharCode(92), '/'))
    .filter((r) => r.endsWith('.md') && statSync(join(repoRoot, r)).isFile());
}

export function documentosVivos() {
  return ['SKILL.md', 'README.md', 'INSTALL.md', 'AGENTS.md', ...mdEn('phases'), ...mdEn('skills'), ...mdEn('templates')]
    .filter((r) => existsSync(join(repoRoot, r)));
}

const FRASE_DE_PRESUPUESTO = /presupuesto de contexto|tope de contexto|handoff|sesi[oó]n nueva pasados/iu;
// `~80K` es el costo fijo por sesion (se descuenta del tope), no un tope: la tilde lo exime.
const CIFRA = /(?<!~)(\d{1,3}(?:[.,]\d{3})+|\d+\s?[kK])(?![\w])/gu;

/** Tokens que nombra una cifra: `120.000` / `120K` / `120000`. */
function tokens(cifra) {
  const k = /^(\d+)\s?[kK]$/u.exec(cifra);
  return k ? Number(k[1]) * 1000 : Number(cifra.replace(/[.,]/gu, ''));
}

/** Problemas de presupuesto de un texto: cifras distintas de 120K/60K, o falta de «mensajes». */
export function problemasDePresupuesto(texto) {
  const problemas = [];
  for (const parrafo of texto.split(/\n\s*\n|\n(?=- \*\*)/u)) {
    if (!FRASE_DE_PRESUPUESTO.test(parrafo)) continue;
    const cifras = [...parrafo.matchAll(CIFRA)].map((m) => tokens(m[1])).filter((n) => n >= 50000);
    if (cifras.length === 0) continue;
    for (const n of cifras) if (n !== 120000 && n !== 60000) problemas.push(`tope ${n} (solo 120000 y 60000)`);
    if (!/mensajes/iu.test(parrafo)) problemas.push('no dice que se mide sobre mensajes');
    if (/(sobre|del) total/iu.test(parrafo)) problemas.push('lo mide sobre el total');
  }
  return problemas;
}

test('ia-stack-3-4-1-tokens · AC1 · el contrato mide el contexto sobre mensajes con topes 120K/60K', () => {
  const c = contrato().contexto;
  assert.equal(c.medido_sobre, 'mensajes');
  assert.equal(c.tope_orquestador, 120000);
  assert.equal(c.tope_subsesion, 60000);
  assert.equal(c.aviso_desde, 0.8);
  assert.equal(c.handoff_tokens, undefined, 'el tope viejo sobre el total no puede quedar');
  assert.equal(c.handoff_tokens_si_la_sesion_es_haiku, undefined);
  for (const dato of ['26-10-2026', '910K', '80K']) assert.ok(c.por_que.includes(dato), `por_que no cita ${dato}`);
  assert.match(c.por_que, /8×|8 veces/u);
});

test('ia-stack-3-4-1-tokens · AC1 · ningun documento vivo nombra un tope distinto de 120K/60K ni lo mide sobre el total', () => {
  const docs = documentosVivos();
  assert.ok(docs.includes('SKILL.md') && docs.some((d) => d.startsWith('phases/')) && docs.some((d) => d.startsWith('skills/')));
  for (const ruta of docs) {
    const texto = ruta === 'SKILL.md' ? leerProtocolo(repoRoot) : readFileSync(join(repoRoot, ruta), 'utf8');
    assert.deepEqual(problemasDePresupuesto(texto), [], `${relative('.', ruta)} contradice el contrato de contexto`);
  }
});

test('ia-stack-3-4-1-tokens · AC1 · el parrafo de presupuesto de SKILL.md existe y nombra 120K, 60K y mensajes', () => {
  const skill = readFileSync(join(repoRoot, 'SKILL.md'), 'utf8');
  const p = skill.split(/\n\s*\n|\n(?=- \*\*)/u).find((x) => x.includes('Presupuesto de contexto'));
  assert.ok(p, 'SKILL.md perdio el parrafo «Presupuesto de contexto»');
  assert.match(p, /120\.000|120K/u);
  assert.match(p, /60\.000|60K/u);
  assert.match(p, /mensajes/u);
  assert.match(p, /autocompact/iu);
});

test('ia-stack-3-4-1-tokens · AC1 · la heuristica agarra el texto viejo y deja pasar descripciones de otra cosa', () => {
  const viejo = 'Presupuesto de contexto. Pasados unos 200.000 tokens (100.000 si la sesión corre en Haiku), se cierra.';
  const p = problemasDePresupuesto(viejo);
  assert.ok(p.some((x) => x.includes('200000')) && p.some((x) => x.includes('100000')));
  assert.ok(p.some((x) => x.includes('mensajes')));
  assert.ok(problemasDePresupuesto('Tope de contexto: 120K sobre mensajes. Subsesión 60K, mensajes.').length === 0);
  assert.ok(problemasDePresupuesto('Tope de contexto: 120K del total de mensajes.').some((x) => x.includes('total')));
  assert.deepEqual(problemasDePresupuesto('No se lee el protocolo entero: son unos 40.000 tokens.'), []);
  assert.deepEqual(problemasDePresupuesto('Medido: mensajes con más de 300.000 tokens de contexto.'), []);
});
