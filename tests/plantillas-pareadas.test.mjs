// Cada artefacto tiene DOS plantillas, y tienen que decir lo mismo.
//
// `templates/<x>.md` es la canónica y `skills/spec-plan-templates.md` embebe una copia — que es la
// que `SKILL.md` manda usar. Ya divergieron dos veces en dos días:
//
//   - La de **spec** perdió la sección Discovery y los encabezados en castellano: su propio gate la
//     rechazaba en 7 de 8 secciones, mientras el protocolo la mandaba usar.
//   - La de **plan** perdió `Risk Notes` y `Subagent assignments`, que sí están en la canónica.
//
// Los gates existentes verifican cada plantilla contra su forma; ninguno comprobaba que el par
// dijera lo mismo. Esta regla lo hace por forma: descubre los pares leyendo los encabezados
// `## TEMPLATE: docs/<x>.md` del archivo de skills, sin una lista de nombres que mantener.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};

const EMBEBIDAS = join('skills', 'spec-plan-templates.md');

/** Los pares que el archivo de skills declara: por cada `## TEMPLATE: docs/<x>.md` seguido de un
 * bloque markdown, el nombre del artefacto y los encabezados de la copia embebida. */
export function paresDeclarados(texto) {
  const pares = [];
  // Cuando la ruta lleva subdirectorio —`docs/adr/<NNNN>-<title>.md`— el artefacto es el
  // DIRECTORIO: el nombre del archivo ahí es un molde con huecos y no nombra nada.
  const re = /^## TEMPLATE: docs\/(?:([\w-]+)\/[^\n]*?|([\w-]+))\.md[^\n]*\n+```markdown\n([\s\S]*?)```/gmu;
  for (const m of texto.matchAll(re)) {
    pares.push({ artefacto: m[1] ?? m[2], encabezados: encabezadosDe(m[3]) });
  }
  return pares;
}

export function encabezadosDe(texto) {
  return [...texto.matchAll(/^##\s+(.+?)\s*$/gmu)].map((m) => m[1]);
}

test('cada plantilla embebida tiene las mismas secciones que su canónica', SOLO_FUENTE, () => {
  const pares = paresDeclarados(readFileSync(join(repoRoot, EMBEBIDAS), 'utf8'));
  assert.ok(pares.length >= 3, `el barrido tiene que encontrar los pares, o no prueba nada (encontró ${pares.length})`);
  const divergen = [];
  for (const { artefacto, encabezados } of pares) {
    const canonica = join(repoRoot, 'templates', `${artefacto}.md`);
    if (!existsSync(canonica)) continue;
    const suyas = new Set(encabezadosDe(readFileSync(canonica, 'utf8')));
    const faltan = [...suyas].filter((h) => !encabezados.includes(h));
    if (faltan.length > 0) divergen.push(`${artefacto}: la copia embebida no tiene ${faltan.join(', ')}`);
  }
  assert.deepEqual(divergen, [], 'la copia que SKILL.md manda usar tiene que decir lo mismo que la canónica');
});

test('FALSIFICACIÓN · el barrido encuentra los pares y ve una sección que falta', () => {
  const doc = '## TEMPLATE: docs/spec.md\n\n```markdown\n# x\n\n## Uno\ntexto\n\n## Dos\ntexto\n```\n';
  assert.deepEqual(paresDeclarados(doc), [{ artefacto: 'spec', encabezados: ['Uno', 'Dos'] }]);
  // El nombre con placeholder —`docs/adr/<NNNN>-<title>.md`— resuelve al artefacto, no al hueco.
  assert.deepEqual(paresDeclarados('## TEMPLATE: docs/adr/<NNNN>-<title>.md\n\n```markdown\n## Uno\nx\n```').map((p) => p.artefacto), ['adr']);
  assert.deepEqual(paresDeclarados('sin plantillas'), []);
  assert.deepEqual(encabezadosDe('## Uno\n### No cuenta\n## Dos'), ['Uno', 'Dos']);
});
