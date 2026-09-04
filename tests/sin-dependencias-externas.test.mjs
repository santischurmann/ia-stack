// El camino obligatorio del protocolo no puede depender de una herramienta que no declara.
//
// La fase 8.2 exigía correr `graphify update .` y `graphify export obsidian`, y cableaba un gate a
// la salida de esa CLI. Nada de eso estaba marcado como opcional, y `graphify` no es una dependencia
// del protocolo: es una herramienta que el autor tiene instalada. Quien instalara VCP sin ella no
// podía cerrar la fase 8, y el documento no se lo decía.
//
// Esta comprobación no lista herramientas prohibidas —una lista sólo encuentra lo que ya pensó quien
// la escribió—. Lista lo PERMITIDO, que es corto y deliberado: `node` y `git`, más los dos shells
// que el propio protocolo usa para correrse a sí mismo.
//
// LO QUE NO CUBRE, dicho: mira los bloques de comando del documento, no lo que un agente decida
// ejecutar por su cuenta. Un protocolo puede pedir en prosa algo que esta regla no ve.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};

/** Lo único que el protocolo puede invocar sin declararlo como dependencia. */
export const PERMITIDOS = Object.freeze([
  'node', 'git', 'bash', 'powershell', 'pwsh', 'npx',
  // Utilidades POSIX que vienen con cualquier shell. No son dependencias: son el shell.
  'ls', 'cat', 'grep', 'sed', 'awk', 'head', 'tail', 'cp', 'mv', 'mkdir', 'echo', 'printf', 'find', 'diff', 'wc', 'sort', 'chmod', 'test',
]);

/** Un bloque marcado como opcional no cuenta: el problema nunca fue usar una herramienta externa,
 * fue exigirla sin decirlo. La marca vale para la línea y las dos anteriores, que es donde el
 * documento pone su aclaración. */
const OPCIONAL = /opcional|si la tenés|si lo usás|si está instalad|only if|integración/iu;

/** La senal de que la linea manda a EJECUTAR algo, y no solo lo menciona. */
const EJECUTA = /se corre|correr|ejecut|hay que correr|\brun\b/iu;

export function binariosDelCaminoObligatorio(texto) {
  const lineas = texto.split(/\r?\n/u);
  const sueltos = [];
  let enBloque = false;
  for (let i = 0; i < lineas.length; i += 1) {
    const l = lineas[i];
    // Solo cuentan los bloques que DECLARAN un shell. Un bloque sin lenguaje, o marcado `text`,
    // suele ser prosa o salida de ejemplo: mirarlo hacia que la regla acusara palabras sueltas
    // como `paths.` o `igual`, medido sobre el propio SKILL.md.
    if (l.trimStart().startsWith('```')) {
      const lenguaje = l.trim().slice(3).trim().toLowerCase();
      enBloque = enBloque ? false : ['bash', 'sh', 'shell', 'powershell', 'ps1', 'console'].includes(lenguaje);
      continue;
    }
    // La ventana es la linea y la anterior, no tres. Con tres, un `(opcional)` de OTRO paso
    // excusaba al paso obligatorio de mas abajo: medido sobre 8.2, donde la linea de la bitacora
    // de respaldos decia opcional y tapaba al `graphify` que si era obligatorio.
    const contexto = lineas.slice(Math.max(0, i - 1), i + 1).join(' ');
    const acusar = (binario) => {
      // Un binario no lleva punto ni barra: `verify-x.mjs` es un script -- se corre con node -- y
      // `docs/spec.md` es una ruta. Y menos de tres letras es casi siempre una palabra suelta
      // entre comillas invertidas, no un programa. Las dos reglas salieron de medir sobre SKILL.md.
      if (binario.includes('.') || binario.includes('/') || binario.length < 3) return;
      if (PERMITIDOS.includes(binario)) return;
      if (OPCIONAL.test(contexto)) return;
      sueltos.push(`${binario} (línea ${i + 1})`);
    };
    // Codigo EN LINEA dentro de la prosa. La primera version solo miraba bloques cercados y por eso
    // daba verde con `graphify update .` escrito asi en el paso obligatorio 8.2: la comprobacion
    // nunca llego a estar roja para el defecto que existia para arreglar.
    // Para codigo EN LINEA hace falta una senal de que se ejecuta. Sin ella, la regla marcaba
    // frases en ingles entre comillas invertidas -- `not ok`, `matches this source checkout` -- que
    // no son comandos. Medido sobre SKILL.md: ocho falsos positivos y un solo comando real.
    if (EJECUTA.test(l)) {
      for (const m of l.matchAll(/`([a-z][\w.-]*)\s+[^`]*`/gu)) acusar(m[1]);
    }
    if (!enBloque) continue;
    const m = l.trim().match(/^([a-z][\w.-]*)\s/u);
    if (m !== null) acusar(m[1]);
  }
  return [...new Set(sueltos)];
}

test('el camino obligatorio de SKILL.md no invoca ninguna herramienta externa', SOLO_FUENTE, () => {
  const skill = readFileSync(join(repoRoot, 'SKILL.md'), 'utf8');
  assert.deepEqual(
    binariosDelCaminoObligatorio(skill),
    [],
    'el protocolo exige una herramienta que no declara como dependencia: o se marca opcional, o deja de ser obligatoria',
  );
});

test('FALSIFICACIÓN · distingue un binario exigido de uno permitido y de uno marcado opcional', () => {
  const exigido = ['```bash', 'graphify update .', '```'].join('\n');
  assert.deepEqual(binariosDelCaminoObligatorio(exigido), ['graphify (línea 2)']);

  const permitido = ['```bash', 'node scripts/x.mjs check', 'git status', '```'].join('\n');
  assert.deepEqual(binariosDelCaminoObligatorio(permitido), []);

  // La marca vale para la línea y la ANTERIOR, no para tres atrás: un `(opcional)` de otro paso no
  // puede excusar a un paso obligatorio de más abajo. Medido sobre la fase 8.2, donde la línea de la
  // bitácora de respaldos decía «opcional» y tapaba al `graphify` que sí era obligatorio.
  const marcado = ['```bash', '# Integración opcional, si la tenés instalada', 'graphify update .', '```'].join('\n');
  assert.deepEqual(binariosDelCaminoObligatorio(marcado), []);

  // Fuera de un bloque de comando no se mira: la prosa nombra herramientas todo el tiempo.
  assert.deepEqual(binariosDelCaminoObligatorio('graphify es una herramienta externa'), []);
});

test('FALSIFICACIÓN · también ve un comando escrito como código en línea, no sólo en un bloque', () => {
  const enLinea = 'Después del commit se corre `graphify update .` y listo.';
  assert.deepEqual(binariosDelCaminoObligatorio(enLinea), ['graphify (línea 1)']);
  // Y sigue respetando la marca de opcional y la lista de permitidos.
  assert.deepEqual(binariosDelCaminoObligatorio('Integración opcional: `graphify update .`'), []);
  assert.deepEqual(binariosDelCaminoObligatorio('Se corre `node scripts/x.mjs check` siempre.'), []);
});
