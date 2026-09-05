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

/** Los comandos `node .vibe/vcp-runtime/scripts/<gate>` que un documento publica dentro de un bloque
 * bash. Se leen del texto, no de una lista: si mañana alguien agrega uno, entra solo.
 *
 * DOS FORMAS QUE NO SON COMANDOS ROTOS, y por eso se tratan aparte:
 *
 *   - La CONTINUACIÓN DE LÍNEA. Un comando partido con una barra al final sigue en la línea
 *     siguiente; cortarlo ahí lo dejaría sin sus argumentos y daría un `usage:` que no existe.
 *     Se unen antes de leer.
 *   - El PLACEHOLDER. `--feature <feature-slug>` le dice al lector que ponga lo suyo: no es un
 *     comando ejecutable, es una plantilla. Correrlo da `usage:` correctamente, y marcarlo sería
 *     exigirle a la documentación que no enseñe. Se apartan en `conPlaceholder` para que el salteo
 *     quede visible en vez de silencioso.
 *
 * Medido el 2026-09-05 sobre SKILL.md: sin estas dos reglas, 6 falsos positivos sobre 33 comandos,
 * y ninguno era un defecto. */
export function comandosPublicados(texto) {
  const bloques = [...texto.matchAll(/```bash\n([\s\S]*?)```/gu)].map((m) => m[1]);
  const comandos = [];
  const conPlaceholder = [];
  for (const bloque of bloques) {
    const unido = bloque.replace(/\\\n\s*/gu, ' ');
    for (const linea of unido.split('\n')) {
      const m = linea.match(/^node\s+\.vibe\/vcp-runtime\/(scripts\/[\w.-]+\.mjs)(.*)$/u);
      if (m === null) continue;
      const entrada = { script: m[1], args: m[2].trim().split(/\s+/u).filter(Boolean) };
      if (/<[^>]+>/u.test(m[2])) conPlaceholder.push(entrada);
      else comandos.push(entrada);
    }
  }
  return { ejecutables: comandos, conPlaceholder };
}

// Los dos documentos que publican comandos. `SKILL.md` es el que el agente lee entero y publica 47;
// el README publica 6. La regla nació mirando sólo el README —el archivo chico— y el grande quedaba
// sin cubrir: si mañana alguien escribe ahí un comando roto, nadie lo ve. El README tenía 2 de 3
// rotos justamente porque nadie los miraba.
const PUBLICAN_COMANDOS = ['README.md', 'SKILL.md'];

test('todo comando que el protocolo publica corre: ninguno muere por uso incorrecto', SOLO_FUENTE, () => {
  const rotos = [];
  let vistos = 0;
  for (const documento of PUBLICAN_COMANDOS) {
    const { ejecutables } = comandosPublicados(readFileSync(join(repoRoot, documento), 'utf8'));
    assert.ok(ejecutables.length >= 3, `${documento}: el barrido tiene que encontrar comandos, o no prueba nada`);
    vistos += ejecutables.length;
    for (const { script, args } of ejecutables) {
      // Sólo lo que no escribe: `check`, `due` e `history`. Correr un `append` o un `record` desde
      // una prueba tocaría el árbol de verdad, y una prueba que muta lo que mide no mide nada.
      if (args.length > 0 && !/^(check|due|history)$/u.test(args[0])) continue;
      const r = spawnSync(process.execPath, [join(repoRoot, script), ...args], { cwd: repoRoot, encoding: 'utf8' });
      if (r.status === USO_INCORRECTO) rotos.push(`${documento} → ${script} ${args.join(' ')}: ${(r.stderr || r.stdout).split('\n')[0]}`);
    }
  }
  assert.ok(vistos >= 20, `tienen que verse los comandos de los dos documentos, no sólo los del chico (vistos: ${vistos})`);
  assert.deepEqual(rotos, [], 'un comando publicado que muere con «usage:» es una promesa que el propio protocolo rompe');
});

test('FALSIFICACIÓN · el barrido lee los comandos del texto y no confunde otra prosa', () => {
  const doc = '```bash\nnode .vibe/vcp-runtime/scripts/verify-x.mjs check --flag v\nls algo\n```\ntexto\n```bash\nnode .vibe/vcp-runtime/scripts/verify-y.mjs\n```';
  assert.deepEqual(comandosPublicados(doc).ejecutables, [
    { script: 'scripts/verify-x.mjs', args: ['check', '--flag', 'v'] },
    { script: 'scripts/verify-y.mjs', args: [] },
  ]);
  assert.deepEqual(comandosPublicados('sin bloques'), { ejecutables: [], conPlaceholder: [] });
});

test('FALSIFICACIÓN · el placeholder se aparta y la continuación de línea se une', () => {
  // Las dos formas que daban falso positivo. Sin ellas, 6 sobre 33 en SKILL.md, y ninguno era un
  // defecto: correr una plantilla da `usage:` porque es una plantilla, no porque esté rota.
  const conHueco = '```bash\nnode .vibe/vcp-runtime/scripts/verify-z.mjs check --feature <feature-slug>\n```';
  const r = comandosPublicados(conHueco);
  assert.deepEqual(r.ejecutables, [], 'una plantilla no es un comando ejecutable');
  assert.deepEqual(r.conPlaceholder.map((c) => c.script), ['scripts/verify-z.mjs'], 'pero se cuenta aparte, para que el salteo se vea');

  const partido = `\`\`\`bash\nnode .vibe/vcp-runtime/scripts/verify-w.mjs check \\\n  --tasks docs/tasks.json\n\`\`\``;
  assert.deepEqual(comandosPublicados(partido).ejecutables, [
    { script: 'scripts/verify-w.mjs', args: ['check', '--tasks', 'docs/tasks.json'] },
  ], 'un comando partido en dos líneas es UN comando, no uno truncado');
});
