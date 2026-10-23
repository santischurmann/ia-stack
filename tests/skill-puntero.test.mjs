// La skill que Claude Code y Codex cargan es el PUNTERO, no el protocolo.
//
// POR QUE EXISTE. Hasta la 3.3.0 el instalador dejaba el protocolo entero —162 KB— como archivo suelto
// en el directorio de skills, y Claude Code solo descubre `<skills>/<nombre>/SKILL.md`: medido el
// 23-10-2026, `/ia-stack` no figuraba entre las skills de una sesion con los dos archivos instalados. Y
// la `description` de SKILL.md medía 1315 caracteres, por encima del maximo de 1024 de una skill. Ahora
// se instala el puntero de 2 KB, que dice donde esta el protocolo y que leer en cada fase.
//
// QUE FIJA: el frontmatter de las dos (nombre, una sola linea de descripcion, el tope), que el puntero
// nombre los tres lugares donde puede vivir el protocolo, y que no mande a leerlo entero.
//
// LO QUE NO CUBRE: que el host lo cargue. Eso lo decide Claude Code o Codex, y ninguna prueba portable
// lo ve; lo fija `assertSkillDeClaude` en las pruebas del instalador, que miran donde queda cada copia.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const leer = (ruta) => readFileSync(join(repoRoot, ruta), 'utf8');
export const TOPE_DESCRIPCION = 1024;

/** Las claves del frontmatter YAML, de una linea cada una; null si no hay frontmatter. */
export function frontmatter(texto) {
  // `match` y no el metodo de RegExp: el gate de seguridad marca ese nombre como ejecucion dinamica.
  const m = String(texto).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  if (!m) return null;
  const claves = {};
  for (const linea of m[1].split(/\r?\n/u)) {
    const par = linea.match(/^([a-z][a-z0-9-]*):\s*(.*)$/u);
    if (par) claves[par[1]] = par[2];
  }
  return claves;
}

test('frontmatter lee claves de una linea y devuelve null sin frontmatter', () => {
  assert.equal(frontmatter('# nada'), null);
  assert.deepEqual(frontmatter('---\nname: x\ndescription: hace algo\n---\ncuerpo'), { name: 'x', description: 'hace algo' });
  assert.deepEqual(frontmatter('---\r\nname: x\r\n---\r\n'), { name: 'x' });
});

test('el puntero es una skill valida: se llama como su carpeta y su descripcion dice cuando usarla', () => {
  const f = frontmatter(leer('.agents/skills/ia-stack/SKILL.md'));
  assert.ok(f, 'el puntero no tiene frontmatter');
  assert.equal(f.name, 'ia-stack');
  assert.ok(f.description.length > 40 && f.description.length <= TOPE_DESCRIPCION, `descripcion de ${f.description.length} caracteres`);
  assert.doesNotMatch(f.description, /^[|>]/u, 'la descripcion va en una sola linea');
  assert.match(f.description, /\busal[ao]\b|cu[aá]ndo/iu, 'la descripcion dice cuando usarla');
});

test('la descripcion del protocolo entra en el tope de una skill', () => {
  const f = frontmatter(leer('SKILL.md'));
  assert.equal(f.name, 'ia-stack');
  assert.ok(f.description.length <= TOPE_DESCRIPCION, `SKILL.md tiene una descripcion de ${f.description.length} caracteres`);
});

test('el puntero nombra los tres lugares del protocolo y manda a leer por el mapa', () => {
  const texto = leer('.agents/skills/ia-stack/SKILL.md');
  for (const lugar of ['`SKILL.md`', '.vibe/ia-stack-runtime/SKILL.md', '~/.claude/ia-stack-runtime/SKILL.md']) {
    assert.ok(texto.includes(lugar), `el puntero no nombra ${lugar}`);
  }
  assert.match(texto, /MAPA DE LECTURA/u);
  assert.doesNotMatch(texto, /protocolo entero/u);
});
