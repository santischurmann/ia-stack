// El flujo que publica la release. Decidido por el operador el 2026-09-26 y confirmado el 2026-09-27
// con el dato corregido: el zip lo arma GitHub al subir el tag, no la maquina de nadie.
//
// Es el UNICO flujo del repositorio con permiso de escritura, y por eso las reglas van en una prueba y
// no en un comentario: la escritura vive en un solo trabajo, ese trabajo no ejecuta codigo del
// repositorio, y el zip se arma y se prueba INSTALANDOLO en otro trabajo que solo puede leer. La
// ultima regla sale del ALTO de la revision del 2026-09-26: el zip no llevaba lo que el instalador
// lee, y nada lo habia instalado nunca desde el zip.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { scanFile } from '../scripts/verify-security-baseline.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const RUTA = '.github/workflows/release.yml';

/** Las lineas de un bloque de nivel superior (`on:`, `permissions:`), con su propia linea. */
function bloque(yaml, clave) {
  const lineas = yaml.split(/\r?\n/u);
  const inicio = lineas.findIndex((l) => l.startsWith(`${clave}:`));
  if (inicio < 0) return null;
  const fin = lineas.findIndex((l, i) => i > inicio && /^[^\s#]/u.test(l));
  return lineas.slice(inicio, fin < 0 ? undefined : fin).join('\n');
}

/** Cada trabajo de `jobs:` con su texto. Los comentarios no cortan un trabajo. */
export function trabajos(yaml) {
  const lineas = yaml.split(/\r?\n/u);
  const inicio = lineas.findIndex((l) => /^jobs:\s*$/u.test(l));
  const salida = new Map();
  if (inicio < 0) return salida;
  let actual = null;
  for (const linea of lineas.slice(inicio + 1)) {
    const nombre = linea.match(/^ {2}([A-Za-z0-9_-]+):\s*$/u);
    if (nombre) {
      actual = nombre[1];
      salida.set(actual, []);
      continue;
    }
    if (/^[^\s#]/u.test(linea)) break;
    if (actual) salida.get(actual).push(linea);
  }
  return new Map([...salida].map(([k, v]) => [k, v.join('\n')]));
}

/** Lo que el flujo de release hace de mas. Vacio es el unico resultado aceptable. */
export function defectosDelRelease(yaml) {
  const defectos = [];
  const on = bloque(yaml, 'on') ?? '';
  if (!/\btags:/u.test(on) || /pull_request|workflow_run|workflow_dispatch|schedule|branches:/u.test(on)) {
    defectos.push('el disparador no es solamente el push de un tag');
  }
  const permisos = bloque(yaml, 'permissions');
  if (permisos === null) defectos.push('sin permisos de nivel superior, cada trabajo hereda el token por omision, que puede escribir');
  else if (/write/u.test(permisos)) defectos.push('el nivel superior da escritura a todos los trabajos');
  const jobs = trabajos(yaml);
  const conEscritura = [...jobs].filter(([, texto]) => /contents:\s*write/u.test(texto));
  if (conEscritura.length !== 1) {
    defectos.push(`la escritura tiene que vivir en UN trabajo, y vive en ${conEscritura.length}`);
  } else {
    const [nombre, texto] = conEscritura[0];
    if (!/gh release create/u.test(texto)) defectos.push(`el trabajo con escritura (${nombre}) no es el que crea la release`);
    if (/actions\/checkout|scripts\/|\.sh\b/u.test(texto)) defectos.push(`el trabajo con escritura (${nombre}) corre codigo del repositorio`);
  }
  const armado = [...jobs].filter(([, texto]) => /build-zip\.sh/u.test(texto));
  if (armado.length !== 1) {
    defectos.push(`el zip tiene que armarse en UN trabajo, y se arma en ${armado.length}`);
  } else {
    const [nombre, texto] = armado[0];
    if (!/contents:\s*read/u.test(texto) || /write/u.test(texto)) defectos.push(`el trabajo que arma el zip (${nombre}) no es de solo lectura`);
    if (!/sha256sum -c/u.test(texto) || !/\/scripts\/install\.sh/u.test(texto)) {
      defectos.push(`el trabajo que arma el zip (${nombre}) no prueba lo que se publica instalandolo`);
    }
  }
  return defectos;
}

test('el flujo de release existe y no hace nada de mas', () => {
  const ruta = join(repoRoot, RUTA);
  assert.ok(existsSync(ruta), `no hay ${RUTA}: la release se armaria a mano, en la maquina de alguien`);
  const yaml = readFileSync(ruta, 'utf8');
  assert.deepEqual(defectosDelRelease(yaml), []);
  // El mismo escaner que el gate de seguridad corre sobre cada cambio: acciones fijadas a un SHA
  // completo, ninguna expresion de GitHub adentro de un `run:`, ningun disparador de terceros. En un
  // flujo con permiso de escritura, una accion fijada a una etiqueta movil es una puerta abierta.
  assert.deepEqual(scanFile(RUTA, yaml).map((f) => `${f.category} ${f.location}`), []);
});

// --- FALSIFICACIONES: cada regla tiene que poder fallar. Un flujo que la cumple de casualidad no
// prueba nada; estos no la cumplen a proposito.

const BUENO = [
  'on:',
  '  push:',
  '    tags:',
  "      - 'v*'",
  'permissions: {}',
  'jobs:',
  '  armar:',
  '    permissions:',
  '      contents: read',
  '    steps:',
  '      - run: ./ia-stack/scripts/build-zip.sh "$V"',
  '      # un comentario no corta el trabajo',
  '      - run: sha256sum -c x.sha256 && prueba/ia-stack/scripts/install.sh --project p',
  '  publicar:',
  '    permissions:',
  '      contents: write',
  '    steps:',
  '      - run: gh release create "$TAG" x.zip',
  '',
].join('\n');

test('FALSIFICACIÓN · el flujo de referencia de estas pruebas no tiene defectos', () => {
  // Si este diera defectos, las falsificaciones de abajo fallarian por el motivo equivocado.
  assert.deepEqual(defectosDelRelease(BUENO), []);
  assert.deepEqual([...trabajos(BUENO).keys()], ['armar', 'publicar']);
});

test('FALSIFICACIÓN · cada regla del flujo de release rechaza su propia violacion', () => {
  const con = (de, a) => {
    assert.ok(BUENO.includes(de), `la falsificacion no encontro «${de}» en el flujo de referencia`);
    return defectosDelRelease(BUENO.replace(de, a));
  };
  assert.match(con("    tags:\n      - 'v*'", "    branches: [main]").join(), /disparador/u);
  assert.match(con('  push:', '  pull_request:\n  push:').join(), /disparador/u);
  assert.match(con('permissions: {}\n', '').join(), /nivel superior, cada trabajo hereda/u);
  assert.match(con('permissions: {}', 'permissions:\n  contents: write').join(), /nivel superior da escritura/u);
  assert.match(con('      contents: read', '      contents: write').join(), /UN trabajo, y vive en 2/u);
  assert.match(con('      - run: gh release create "$TAG" x.zip', '      - run: echo nada').join(), /no es el que crea la release/u);
  assert.match(con('      - run: gh release create', '      - uses: actions/checkout@0000000000000000000000000000000000000000\n      - run: gh release create').join(), /corre codigo del repositorio/u);
  assert.match(con('      - run: gh release create', '      - run: ./scripts/algo.sh\n      - run: gh release create').join(), /corre codigo del repositorio/u);
  assert.match(con('sha256sum -c x.sha256 && ', '').join(), /no prueba lo que se publica/u);
  assert.match(con(' && prueba/ia-stack/scripts/install.sh --project p', '').join(), /no prueba lo que se publica/u);
  assert.match(con('./ia-stack/scripts/build-zip.sh "$V"', 'echo sin zip').join(), /se arma en 0/u);
});
