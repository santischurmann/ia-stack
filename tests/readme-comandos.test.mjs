// Los comandos que el README publica tienen que correr.
//
// El README los presenta como «tres comandos que vas a usar seguido». Medido el 2026-09-04: dos de
// los tres salían con código 2 —error de uso— porque les faltaban argumentos obligatorios.
// `verify-scope-diff` exige `--tasks`, `--task` y `--base`; `verify-backup-state check` exige la
// ruta del manifiesto. Alguien que copiaba el bloque tal cual se comía un `usage:` en la cara.
//
// Es exactamente el modo de falla que este protocolo existe para impedir —el README promete que
// «cada afirmación importante tiene detrás un comando que la respalda»— ocurriendo en la puerta de
// entrada del producto, donde más caro sale.
//
// LO QUE ESTA REGLA NO PUEDE HACER: comprueba que el comando no muera por uso incorrecto. No
// comprueba que haga lo que el README dice que hace, ni que sus argumentos tengan sentido en el
// proyecto de quien lo lee. Un comando que corre y miente pasa igual.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
// El instalador NO copia el README (sólo SKILL.md, SECURITY.md y AGENTS.md), así que adentro de una
// instalación no hay README que leer y esta prueba no tiene objeto.
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};

const USO_INCORRECTO = 2;

/** Los comandos `node .vibe/vcp-runtime/scripts/<gate>` que el documento publica dentro de un bloque
 * bash. Se leen del texto, no de una lista: si mañana alguien agrega un cuarto, entra solo. */
export function comandosPublicados(texto) {
  const bloques = [...texto.matchAll(/```bash\n([\s\S]*?)```/gu)].map((m) => m[1]);
  const comandos = [];
  for (const bloque of bloques) {
    for (const linea of bloque.split('\n')) {
      const m = linea.match(/^node\s+\.vibe\/vcp-runtime\/(scripts\/[\w.-]+\.mjs)(.*)$/u);
      if (m !== null) comandos.push({ script: m[1], args: m[2].trim().split(/\s+/u).filter(Boolean) });
    }
  }
  return comandos;
}

test('todo comando que el README publica corre: ninguno muere por uso incorrecto', SOLO_FUENTE, () => {
  const comandos = comandosPublicados(readFileSync(join(repoRoot, 'README.md'), 'utf8'));
  assert.ok(comandos.length >= 3, `el barrido tiene que encontrar comandos, o no prueba nada (encontró ${comandos.length})`);
  const rotos = [];
  for (const { script, args } of comandos) {
    const r = spawnSync(process.execPath, [join(repoRoot, script), ...args], { cwd: repoRoot, encoding: 'utf8' });
    if (r.status === USO_INCORRECTO) rotos.push(`${script} ${args.join(' ')} → ${(r.stderr || r.stdout).split('\n')[0]}`);
  }
  assert.deepEqual(rotos, [], 'un comando publicado que muere con «usage:» es una promesa que el propio protocolo rompe');
});

test('FALSIFICACIÓN · el barrido lee los comandos del texto y no confunde otra prosa', () => {
  const doc = '```bash\nnode .vibe/vcp-runtime/scripts/verify-x.mjs check --flag v\nls algo\n```\ntexto\n```bash\nnode .vibe/vcp-runtime/scripts/verify-y.mjs\n```';
  assert.deepEqual(comandosPublicados(doc), [
    { script: 'scripts/verify-x.mjs', args: ['check', '--flag', 'v'] },
    { script: 'scripts/verify-y.mjs', args: [] },
  ]);
  assert.deepEqual(comandosPublicados('sin bloques'), []);
});
