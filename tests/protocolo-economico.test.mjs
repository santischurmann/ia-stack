// Tres ahorros que el protocolo promete y que tienen que estar escritos donde el agente los lee.
//
// 1. PUBLICAR UNA VEZ, AL TERMINAR. El protocolo ya pedia un menu antes de cada push, pero el menu
//    recomendaba publicar, aparecia al cierre de CADA funcionalidad y el modo continuo no decia
//    cuando se pide el push reservado. En los proyectos del operador eso se leyo como «un push por
//    fase»: el 14-10-2026 hubo dos pushes en rojo el mismo dia en el mismo repositorio.
// 2. LEER LO QUE HACE FALTA. Los punteros decian «leé el protocolo entero»: unos 40.000 tokens antes
//    de hacer nada, y medido entre el 12 y el 15-10-2026, el 75 % del consumo venia de mensajes con
//    mas de 300.000 tokens de contexto.
// 3. EL MODO BREVE ES PROPIO. El estilo telegrafico lo daba un plugin externo. Ahora vive en
//    skills/modo-breve.md, va adentro de la plantilla de cada subagente y nada lo invoca de afuera.
//
// LO QUE NO CUBRE: que el agente obedezca. Fija que la regla este escrita, con su forma.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const leer = (ruta) => readFileSync(join(repoRoot, ruta), 'utf8');
const skill = () => leer('SKILL.md');

/** La seccion de SKILL.md que empieza en `## <titulo>` y termina en el proximo `## `. */
export function seccion(texto, titulo) {
  const inicio = texto.indexOf(`\n## ${titulo}`);
  if (inicio === -1) return null;
  const resto = texto.slice(inicio + 1);
  const fin = resto.indexOf('\n## ', 3);
  return fin === -1 ? resto : resto.slice(0, fin);
}

/** Los encabezados que cita el mapa como `§ <encabezado>`. */
export function citasDelMapa(mapa) {
  return [...mapa.matchAll(/§ ([^`\n—]+?)(?=\s*(?:—|$|\n|,))/gmu)].map((m) => m[1].trim());
}

test('seccion y citasDelMapa leen lo que dicen', () => {
  assert.equal(seccion('x', 'NADA'), null);
  assert.equal(seccion('\n## A\nuno\n## B\ndos', 'A'), '## A\nuno');
  assert.equal(seccion('\n## A\nuno', 'A'), '## A\nuno');
  assert.deepEqual(citasDelMapa('- § PHASE 3 — SPEC — a\n- § LAWS'), ['PHASE 3', 'LAWS']);
});

test('LAW 9: publicar es una vez, al terminar el trabajo aprobado', () => {
  const leyes = seccion(skill(), 'LAWS — non-negotiable');
  assert.ok(leyes);
  assert.match(leyes, /^9\. \*\*Publicar es una vez, al terminar\.\*\*/mu);
  assert.match(leyes, /ni por fase, ni por lote, ni por arreglo/u);
});

test('el modo continuo dice cuando se pide el push reservado', () => {
  assert.match(skill(), /el push se pide una vez, al cerrar el plan entero/u);
});

test('el menu de 8.1 recomienda dejar local mientras el plan tenga trabajo pendiente', () => {
  const texto = skill();
  const menu = texto.slice(texto.indexOf('**8.1 Commit/push/merge**'), texto.indexOf('**8.1.1 Ancla de la traza**'));
  assert.match(menu, /- \*\*A\)\*\* `git push origin <branch>`.*\*\(recomendado cuando el plan entero cerró y los gates están en verde\)\*/u);
  assert.match(menu, /- \*\*C\)\*\* Todavía no — dejarlo local.*\*\(recomendado mientras el plan tenga fases o lotes pendientes\)\*/u);
  assert.match(menu, /git rev-list --count @\{u\}\.\.HEAD/u);
});

test('el commit manual nombra las rutas y lleva el mensaje por archivo', () => {
  const texto = skill();
  for (const ruta of ['SKILL.md', ...readdirSync(join(repoRoot, 'skills')).map((n) => `skills/${n}`)]) {
    assert.doesNotMatch(leer(ruta), /git add -A/u, `${ruta}: git add -A mete trabajo ajeno en el commit`);
  }
  assert.match(texto, /git commit -F /u);
});

test('el mapa de lectura existe y cada encabezado que cita existe en SKILL.md', () => {
  const texto = skill();
  const mapa = seccion(texto, 'MAPA DE LECTURA');
  assert.ok(mapa, 'falta ## MAPA DE LECTURA');
  const citas = citasDelMapa(mapa);
  assert.ok(citas.length >= 10, `el mapa cita ${citas.length} encabezados`);
  const encabezados = texto.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3));
  for (const cita of citas) assert.ok(encabezados.some((e) => e.startsWith(cita)), `el mapa cita «${cita}» y no existe`);
});

test('los punteros mandan a leer por el mapa, no el protocolo entero', () => {
  for (const ruta of ['AGENTS.md', '.agents/skills/ia-stack/SKILL.md']) {
    const texto = leer(ruta);
    assert.doesNotMatch(texto, /protocolo entero/u, ruta);
    assert.match(texto, /MAPA DE LECTURA/u, ruta);
  }
});

test('el modo breve es propio, va en la plantilla de cada subagente y nadie invoca uno externo', () => {
  assert.ok(existsSync(join(repoRoot, 'skills/modo-breve.md')), 'falta skills/modo-breve.md');
  const breve = leer('skills/modo-breve.md');
  assert.match(breve, /caveman interno/iu);
  assert.match(breve, /lenguaje simple/u, 'hacia la persona manda lenguaje simple');
  assert.match(leer('skills/orchestrator-opus.md'), /## MODO BREVE/u, 'la plantilla de spawn no trae el bloque breve');
  assert.match(leer('skills/orchestrator-opus.md'), /NOTES: <.*80 words/u);
  const vivos = ['SKILL.md', 'AGENTS.md', 'README.md', 'INSTALL.md', '.agents/skills/ia-stack/SKILL.md',
    ...readdirSync(join(repoRoot, 'skills')).map((n) => `skills/${n}`)].filter((r) => existsSync(join(repoRoot, r)));
  for (const ruta of vivos) assert.doesNotMatch(leer(ruta), /caveman:|(?:^|\s)\/caveman\b/mu, `${ruta} invoca un caveman externo`);
});
