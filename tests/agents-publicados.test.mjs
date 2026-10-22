// La lista de AGENTS.md que IA Stack publico: con ella el instalador distingue el que el mismo
// escribio —y puede actualizar— del que es de la persona y no se toca.
//
// POR QUE EXISTE. El 22-10-2026, al reinstalar el runtime en los proyectos del operador, el
// AGENTS.md de dos de ellos era byte a byte el que habia escrito un instalador anterior, y seguia
// mandando a «leer el protocolo entero» y, en uno, a la carpeta del nombre anterior. El instalador
// nunca los reescribia. Ahora los reconoce por hash; esta prueba fija que la lista no se quede atras:
// si alguien cambia AGENTS.md y no agrega su hash, la proxima version no podria reconocer esta.
//
// LO QUE NO CUBRE: un AGENTS.md que la persona edito a partir del publicado ya no coincide con
// ningun hash, asi que no se actualiza. Es a proposito: ante la duda, el archivo es de la persona.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';
import { AGENTS_PUBLICADO_3_2_0, hashGitLf } from './_install-fixture.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de IA Stack, no del proyecto de quien instala' }
  : {};
const contrato = () => JSON.parse(readFileSync(join(repoRoot, 'contracts/agents-publicados.json'), 'utf8'));

test('el contrato lista hashes de git validos y sin repetir', () => {
  const c = contrato();
  assert.equal(c.schema, 'ia.agents-publicados/1');
  assert.equal(typeof c.why, 'string');
  assert.ok(c.blobs.length >= 2);
  for (const h of c.blobs) assert.match(h, /^[0-9a-f]{40}$/u);
  assert.equal(new Set(c.blobs).size, c.blobs.length);
});

test('hashGitLf da el hash de git y no le importan los CRLF', () => {
  assert.equal(hashGitLf(''), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  assert.equal(hashGitLf('a\r\nb\r\n'), hashGitLf('a\nb\n'));
});

test('el AGENTS.md actual y el de la 3.2.0 estan en la lista', () => {
  const { blobs } = contrato();
  assert.ok(blobs.includes(hashGitLf(readFileSync(join(repoRoot, 'AGENTS.md'), 'utf8'))), 'AGENTS.md cambio y su hash no esta en contracts/agents-publicados.json');
  assert.ok(blobs.includes(hashGitLf(AGENTS_PUBLICADO_3_2_0)));
});

test('cada version de AGENTS.md que tuvo este repositorio esta en la lista', SOLO_FUENTE, () => {
  const { blobs } = contrato();
  const commits = execFileSync('git', ['-C', repoRoot, 'log', '--format=%H', '--follow', '--', 'AGENTS.md'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.ok(commits.length > 0, 'sin historia de AGENTS.md no hay nada que comparar');
  for (const c of commits) {
    const texto = execFileSync('git', ['-C', repoRoot, 'show', `${c}:AGENTS.md`], { encoding: 'utf8' });
    assert.ok(blobs.includes(hashGitLf(texto)), `la version de AGENTS.md de ${c.slice(0, 7)} no esta en la lista`);
  }
});
