import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { resolveBash } from './_entorno.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bash = resolveBash();

// install.sh lee la versión del sello de SKILL.md. La «ó» de «Versión» ocupa dos bytes: un patrón
// que dependa de la locale para emparejarla deja INSTALADO.json con la versión vacía.
test('install.sh extrae la versión de SKILL.md con cualquier locale', () => {
  const linea = readFileSync(join(repoRoot, 'scripts', 'install.sh'), 'utf8')
    .split('\n').find((l) => l.includes('version="$(sed'));
  assert.ok(linea, 'no se encontró la línea que lee la versión en install.sh');
  const comando = `PACKAGE_DIR='${repoRoot.split('\\').join('/')}'; ${linea.trim()}; printf %s "$version"`;
  const esperada = readFileSync(join(repoRoot, 'SKILL.md'), 'utf8').match(/\*\*Versión:\*\* *([0-9.]+)/)[1];
  for (const locale of ['C', 'C.UTF-8']) {
    const r = spawnSync(bash, ['-c', comando], { encoding: 'utf8', env: { ...process.env, LC_ALL: locale } });
    assert.equal(r.stdout, esperada, `locale ${locale}: salió «${r.stdout}» (${r.stderr})`);
  }
});
