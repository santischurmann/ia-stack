// Pruebas del gate del sistema de diseno. Las que llevan FALSIFICACION atacan al gate: cada una
// construye una superficie que deberia pasar por sana y comprueba que el gate no se la crea.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  DARK_MEDIA,
  DARK_STAMPED,
  LIGHT,
  SCHEMA,
  USAGE,
  classifyBlock,
  extractTokenBlocks,
  findSlopSignatures,
  findViolations,
  main,
  parseArgs,
  readContract,
} from '../scripts/verify-design-tokens.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-design-tokens.mjs');

/** Una superficie sana minima: paleta clara, las dos oscuras identicas, pares completos, radio
 * base, y el fondo del body saliendo de un token. */
function healthyHtml({ light = {}, darkMedia = {}, darkStamped = {}, extra = '', body = 'background: var(--paper); color: var(--paper-foreground);' } = {}) {
  const base = {
    paper: '#fff', 'paper-foreground': '#000',
    card: '#eee', 'card-foreground': '#111',
    accent: '#05f', 'accent-foreground': '#fff',
    radius: '3px',
  };
  const dark = {
    paper: '#000', 'paper-foreground': '#fff',
    card: '#111', 'card-foreground': '#eee',
    accent: '#7bf', 'accent-foreground': '#000',
    radius: '3px',
  };
  const render = (obj) => Object.entries(obj).map(([k, v]) => `    --${k}: ${v};`).join('\n');
  const l = { ...base, ...light };
  const dm = { ...dark, ...darkMedia };
  const ds = { ...dark, ...darkStamped };
  return `<style>
  :root {
${render(l)}
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
${render(dm)}
    }
  }
  :root[data-theme="dark"] {
${render(ds)}
  }
  body { ${body} }
${extra}
</style>`;
}

const surface = {
  file: 'x.html',
  tokens: ['paper', 'paper-foreground', 'card', 'card-foreground', 'accent', 'accent-foreground'],
  pairs: [['paper', 'paper-foreground'], ['card', 'card-foreground'], ['accent', 'accent-foreground']],
  radius_base: 'radius',
  body_background_token: 'paper',
};

// --- Argumentos y contrato ----------------------------------------------------------------------

test('parseArgs acepta sólo `check <archivo>` y rechaza todo lo demás', () => {
  assert.deepEqual(parseArgs(['check', 'contracts/design-tokens.json']), { contract: 'contracts/design-tokens.json' });
  for (const malos of [[], ['check'], ['check', ''], ['otro', 'x.json'], ['check', 'a', 'b']]) {
    assert.equal(parseArgs(malos), null, `no debería aceptar ${JSON.stringify(malos)}`);
  }
});

test('readContract exige el schema declarado y una lista de superficies no vacía', () => {
  const ok = { schema: SCHEMA, surfaces: [surface] };
  assert.equal(readContract('x', () => JSON.stringify(ok)).error, null);
  assert.match(readContract('x', () => '{').error, /JSON/u);
  assert.match(readContract('x', () => JSON.stringify({ schema: 'otro', surfaces: [surface] })).error, /schema/u);
  assert.match(readContract('x', () => JSON.stringify({ schema: SCHEMA, surfaces: [] })).error, /surfaces/u);
  for (const noEsObjeto of ['[1,2]', 'null', '"texto"', '42']) {
    assert.match(readContract('x', () => noEsObjeto).error, /objeto/u, `${noEsObjeto} no es un contrato`);
  }
});

// --- Lectura del CSS ----------------------------------------------------------------------------

test('extractTokenBlocks encuentra los tres bloques y sus tokens con valor', () => {
  const bloques = extractTokenBlocks(healthyHtml());
  assert.equal(bloques.length, 3, 'claro, oscuro por preferencia y oscuro estampado');
  assert.deepEqual(bloques.map((b) => b.state), [LIGHT, DARK_MEDIA, DARK_STAMPED]);
  assert.equal(bloques[0].tokens.get('paper'), '#fff');
  assert.equal(bloques[1].tokens.get('paper'), '#000');
});

test('classifyBlock distingue los tres estados de tema y ignora un selector cualquiera', () => {
  assert.equal(classifyBlock(':root'), LIGHT);
  assert.equal(classifyBlock(':root:not([data-theme="light"])'), DARK_MEDIA);
  assert.equal(classifyBlock(':root[data-theme="dark"]'), DARK_STAMPED);
  assert.equal(classifyBlock('.card'), null);
});

// --- La superficie sana pasa --------------------------------------------------------------------

test('una superficie que cumple todas las reglas no produce ninguna violación', () => {
  assert.deepEqual(findViolations(surface, healthyHtml()), []);
});

// --- FALSIFICACION: cada regla, atacada ---------------------------------------------------------

test('FALSIFICACIÓN · un token declarado que no está en el bloque claro es rechazo', () => {
  const html = healthyHtml().replace('    --card: #eee;\n', '');
  const v = findViolations(surface, html);
  assert.ok(v.some((m) => /card/u.test(m) && /claro/u.test(m)), `esperaba una violación sobre card: ${JSON.stringify(v)}`);
});

// El bug clasico de los tres estados: en el default del sistema no hay estampado, asi que un color
// que solo vive en un bloque oscuro no aplica nunca y la pagina pinta un tema sobre el otro.
test('FALSIFICACIÓN · un token que sólo existe en un bloque oscuro es rechazo', () => {
  const html = healthyHtml({ darkMedia: { sombra: '#123' }, darkStamped: { sombra: '#123' } });
  const v = findViolations(surface, html);
  assert.ok(v.some((m) => /sombra/u.test(m)), `un token huérfano del bloque claro tiene que doler: ${JSON.stringify(v)}`);
});

// La duplicacion de la paleta oscura es estructural: hacen falta las dos. Lo que no puede pasar es
// que editen una sola y nadie se entere.
test('FALSIFICACIÓN · los dos bloques oscuros que no coinciden son rechazo', () => {
  const distintoValor = findViolations(surface, healthyHtml({ darkStamped: { paper: '#0a0a0a' } }));
  assert.ok(distintoValor.some((m) => /paper/u.test(m)), `mismo token, distinto valor: ${JSON.stringify(distintoValor)}`);

  const distintoSet = findViolations(surface, healthyHtml({ darkStamped: { sobrante: '#111' } }));
  assert.ok(distintoSet.length > 0, 'un token de más en uno de los dos bloques oscuros tiene que doler');
});

test('FALSIFICACIÓN · una superficie sin su color de texto emparejado es rechazo', () => {
  const sinPar = { ...surface, tokens: surface.tokens.filter((t) => t !== 'card-foreground') };
  const html = healthyHtml().replaceAll(/ *--card-foreground: [^;]+;\n/gu, '');
  const v = findViolations(sinPar, html);
  assert.ok(v.some((m) => /card-foreground/u.test(m)), `el par incompleto tiene que doler: ${JSON.stringify(v)}`);
});

test('FALSIFICACIÓN · un color literal fuera de los bloques de tokens es rechazo', () => {
  const v = findViolations(surface, healthyHtml({ extra: '  .aviso { color: #c00; }' }));
  assert.ok(v.some((m) => /#c00/u.test(m)), `un color suelto no participa del tema: ${JSON.stringify(v)}`);
});

test('FALSIFICACIÓN · el body sin fondo explícito del token declarado es rechazo', () => {
  const v = findViolations(surface, healthyHtml({ body: 'color: var(--paper-foreground);' }));
  assert.ok(v.some((m) => /body/u.test(m)), `un body transparente hereda el fondo del anfitrión: ${JSON.stringify(v)}`);
});

test('FALSIFICACIÓN · sin el token de radio base declarado es rechazo', () => {
  const html = healthyHtml().replaceAll(/ *--radius: [^;]+;\n/gu, '');
  const v = findViolations(surface, html);
  assert.ok(v.some((m) => /radius/u.test(m)), `el radio base es la fuente única de verdad: ${JSON.stringify(v)}`);
});

test('FALSIFICACIÓN · un archivo sin ningún bloque de tokens no pasa por sano', () => {
  const v = findViolations(surface, '<style>body { color: red; }</style>');
  assert.ok(v.length > 0, 'cero bloques no es cero violaciones');
});

// --- Escalas: la leccion de Core Framework (el motor de tokens de Instatic) ----------------------

const conEscalas = {
  ...surface,
  type_scale: ['var(--text-sm)', 'var(--text-md)'],
  space_scale: ['0', 'auto', 'var(--space-2)', 'var(--space-4)'],
};

test('los valores que salen de la escala declarada no producen violación', () => {
  const html = healthyHtml({ extra: '  .a { font-size: var(--text-md); padding: var(--space-2) var(--space-4); margin: 0 auto; }' });
  assert.deepEqual(findViolations(conEscalas, html), []);
});

// Diecisiete tamanos distintos en una pagina no son una decision tipografica, son la ausencia de
// una. Core Framework lo dice al reves: una rampa matematica en vez de cuarenta valores a mano.
test('FALSIFICACIÓN · un font-size fuera de la rampa declarada es rechazo', () => {
  const v = findViolations(conEscalas, healthyHtml({ extra: '  .a { font-size: 15.5px; }' }));
  assert.ok(v.some((m) => /15\.5px/u.test(m) && /rampa/iu.test(m)), `un tamaño a mano tiene que doler: ${JSON.stringify(v)}`);
});

test('FALSIFICACIÓN · un espaciado fuera del ritmo declarado es rechazo, componente por componente', () => {
  const v = findViolations(conEscalas, healthyHtml({ extra: '  .a { padding: var(--space-2) 22px; }' }));
  assert.ok(v.some((m) => /22px/u.test(m)), `en un atajo, cada componente cuenta: ${JSON.stringify(v)}`);
  assert.ok(!v.some((m) => /space-2/u.test(m)), 'el componente que sí está en el ritmo no se reporta');
});

test('un tamaño relativo en em queda fuera de la regla: es proporcional por definición', () => {
  assert.deepEqual(findViolations(conEscalas, healthyHtml({ extra: '  .a { font-size: .86em; }' })), []);
});

// --- Anti-slop: firmas de diseño genérico declaradas como datos ----------------------------------

const firmas = [
  { id: 'safe-ai-display-face', pattern: 'font-family:[^;]*\\b(Inter|Space Grotesk)\\b', why: 'la cara a la que se cae por defecto' },
  { id: 'emoji-as-section-marker', pattern: '<h[1-6][^>]*>\\s*[\\u{1F300}-\\u{1FAFF}]', why: 'decoración en lugar de jerarquía' },
];

test('FALSIFICACIÓN · el gate detecta la tipografía a la que cae un generador por defecto', () => {
  const html = `${healthyHtml()}<style>.t { font-family: Inter, sans-serif; }</style>`;
  const v = findViolations(surface, html, firmas);
  assert.ok(v.some((m) => /safe-ai-display-face/u.test(m)), `la firma tiene que aparecer nombrada: ${JSON.stringify(v)}`);
  assert.ok(v.some((m) => /por defecto/u.test(m)), 'y con el motivo escrito al lado');
});

test('FALSIFICACIÓN · el gate detecta un emoji abriendo un título', () => {
  const v = findViolations(surface, `${healthyHtml()}<h2>🚀 Lanzamiento</h2>`, firmas);
  assert.ok(v.some((m) => /emoji-as-section-marker/u.test(m)), `el emoji como marcador tiene que doler: ${JSON.stringify(v)}`);
});

test('sin firmas declaradas el gate no inventa ninguna, y una página limpia pasa', () => {
  assert.deepEqual(findViolations(surface, `${healthyHtml()}<h2>Lanzamiento</h2>`, firmas), []);
  assert.deepEqual(findViolations(surface, `${healthyHtml()}<style>.t{font-family:Inter}</style>`, []), []);
  assert.deepEqual(findSlopSignatures('<p>lo que sea</p>', undefined), [], 'sin lista declarada no hay firmas que buscar');
});

// Una firma con un patrón roto no puede pasar por "no encontré nada": eso convertiría un error del
// contrato en un verde silencioso, que es justo el verde vacío contra el que existe este proyecto.
test('FALSIFICACIÓN · una firma cuyo patrón no compila se reporta, no se saltea', () => {
  const rotas = [{ id: 'patron-roto', pattern: '( sin cerrar', why: 'da igual' }];
  const hits = findSlopSignatures('<p>x</p>', rotas);
  assert.equal(hits.length, 1);
  assert.match(hits[0], /patron-roto.*no compila/u);
});

test('las palabras clave de CSS no cuentan como valores fuera de escala', () => {
  const conPalabras = { ...surface, space_scale: ['0', 'var(--space-2)'], type_scale: ['var(--text-md)'] };
  const html = healthyHtml({ extra: '  .a { margin: inherit; padding: unset; font-size: inherit; }' });
  assert.deepEqual(findViolations(conPalabras, html), []);
});

// --- El CLI real ---------------------------------------------------------------------------------

test('main rechaza argumentos malos con la usage y código 2', () => {
  const errores = [];
  assert.equal(main([], {}, () => {}, (m) => errores.push(m)), 2);
  assert.deepEqual(errores, [USAGE]);
});

test('main informa el contrato ilegible sin fingir que verificó algo', () => {
  const errores = [];
  const code = main(['check', 'no-existe.json'], { readFile: () => { throw new Error('ENOENT'); } }, () => {}, (m) => errores.push(m));
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /REJECTED/u);
});

test('main verifica cada superficie declarada y cuenta cuántas revisó', () => {
  const salidas = [];
  const contrato = JSON.stringify({ schema: SCHEMA, surfaces: [{ ...surface, file: 'a.html' }] });
  const readFile = (path) => (String(path).endsWith('a.html') ? healthyHtml() : contrato);
  const code = main(['check', 'c.json'], { readFile }, (m) => salidas.push(m), () => {});
  assert.equal(code, 0, salidas.join('\n'));
  assert.match(salidas.join('\n'), /^OK:/u);
  assert.match(salidas.join('\n'), /1/u, 'la salida dice cuántas superficies miró');
});

test('main sale 1 y nombra el archivo cuando una superficie viola una regla', () => {
  const errores = [];
  const contrato = JSON.stringify({ schema: SCHEMA, surfaces: [{ ...surface, file: 'a.html' }] });
  const readFile = (path) => (String(path).endsWith('a.html') ? '<style>body{color:red}</style>' : contrato);
  const code = main(['check', 'c.json'], { readFile }, () => {}, (m) => errores.push(m));
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /a\.html/u);
});

test('main nombra la superficie que no se puede leer en vez de contarla como revisada', () => {
  const errores = [];
  const contrato = JSON.stringify({ schema: SCHEMA, surfaces: [{ ...surface, file: 'fantasma.html' }] });
  const readFile = (path) => {
    if (String(path).endsWith('fantasma.html')) throw new Error('ENOENT: no such file');
    return contrato;
  };
  const code = main(['check', 'c.json'], { readFile }, () => {}, (m) => errores.push(m));
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /fantasma\.html.*no se puede leer/su);
});

// Una superficie que no declara tokens, pares, radio ni fondo de body no inventa violaciones: el
// contrato decide qué se exige, el gate no agrega reglas por su cuenta.
test('una superficie sin reglas declaradas sólo exige los tres bloques de tema', () => {
  const minima = { file: 'x.html' };
  assert.deepEqual(findViolations(minima, healthyHtml()), []);
  assert.equal(findViolations(minima, '<style>.a{}</style>').length, 3, 'los tres estados de tema siguen siendo obligatorios');
});

test('extractTokenBlocks ignora un bloque de tema que no define ningún token', () => {
  const bloques = extractTokenBlocks('<style>:root { }\n:root { --paper: #fff; }</style>');
  assert.equal(bloques.length, 1, 'un :root vacío no es una paleta');
  assert.equal(bloques[0].tokens.get('paper'), '#fff');
});

// `:root[data-theme="light"]` es un selector :root que no declara ninguno de los tres estados que
// el gate modela: el claro vive en `:root` a secas, y el estampado claro sólo existe para que el
// bloque de preferencia lo esquive. Redefinir tokens ahí queda fuera del sistema, no adentro.
test('extractTokenBlocks descarta un selector :root que no es ninguno de los tres estados', () => {
  const bloques = extractTokenBlocks('<style>:root { --paper: #fff; }\n:root[data-theme="light"] { --paper: #eee; }</style>');
  assert.deepEqual(bloques.map((b) => b.state), [LIGHT]);
  assert.equal(bloques[0].tokens.get('paper'), '#fff', 'gana el bloque claro de verdad');
});

test('readContract y main leen del disco real cuando no se les pasa un lector', () => {
  const { document, error } = readContract('contracts/design-tokens.json');
  assert.equal(error, null);
  assert.ok(document.surfaces.length > 0);
  const salidas = [];
  assert.equal(main(['check', 'contracts/design-tokens.json'], {}, (m) => salidas.push(m), () => {}), 0, salidas.join('\n'));
});

test('el desbalance entre los dos bloques oscuros duele en las dos direcciones', () => {
  const soloEnMedia = findViolations(surface, healthyHtml({ darkMedia: { sueltoA: '#111' } }));
  assert.ok(soloEnMedia.some((m) => /sueltoA/u.test(m)), 'un token sólo en el bloque de preferencia');
  const soloEnEstampado = findViolations(surface, healthyHtml({ darkStamped: { sueltoB: '#222' } }));
  assert.ok(soloEnEstampado.some((m) => /sueltoB/u.test(m)), 'un token sólo en el bloque estampado');
});

test('un color suelto en notación funcional también es rechazo, y background-color cuenta como fondo', () => {
  const funcional = findViolations(surface, healthyHtml({ extra: '  .aviso { box-shadow: 0 0 2px rgba(0,0,0,.5); }' }));
  assert.ok(funcional.some((m) => /rgba/u.test(m)), `rgba() suelto no participa del tema: ${JSON.stringify(funcional)}`);
  const conBackgroundColor = findViolations(surface, healthyHtml({ body: 'background-color: var(--paper); color: var(--paper-foreground);' }));
  assert.deepEqual(conBackgroundColor, [], 'background-color es tan explícito como background');
});

test('classifyBlock acepta el selector con y sin comillas, como lo escribe una persona', () => {
  assert.equal(classifyBlock(':root[data-theme=dark]'), DARK_STAMPED);
  assert.equal(classifyBlock(":root:not([data-theme=light])"), DARK_MEDIA);
  assert.equal(classifyBlock(':root[data-theme="light"]'), null, 'el claro estampado no redefine la paleta');
});

test('main corrido sólo con argumentos usa sus salidas por defecto', () => {
  assert.equal(main(['check', 'contracts/design-tokens.json']), 0);
  // Sin argumentos toma los de la línea de comandos, que en una corrida de pruebas no son `check`.
  assert.equal(main(undefined, {}, () => {}, () => {}), 2);
});

// Una página que sólo trae la paleta clara: es el caso mas comun de artifact roto, porque en el
// tema oscuro del lector queda texto oscuro sobre un fondo que pinta el anfitrion.
test('FALSIFICACIÓN · una paleta sólo clara no pasa por sistema de tokens completo', () => {
  const soloClaro = `<style>
  :root {
    --paper: #fff; --paper-foreground: #000;
    --card: #eee; --card-foreground: #111;
    --accent: #05f; --accent-foreground: #fff;
    --radius: 3px;
  }
  body { background: var(--paper); color: var(--paper-foreground); }
</style>`;
  const v = findViolations(surface, soloClaro);
  assert.equal(v.length, 2, `faltan los dos bloques oscuros: ${JSON.stringify(v)}`);
  assert.ok(v.every((m) => /falta el bloque de tokens/u.test(m)));
});

test('un archivo sin ninguna regla body no satisface el fondo declarado', () => {
  const sinBody = healthyHtml().replace(/ *body \{[^}]*\}\n/u, '');
  const v = findViolations(surface, sinBody);
  assert.ok(v.some((m) => /body/u.test(m)), `ninguna regla body es tan grave como una sin fondo: ${JSON.stringify(v)}`);
});

// --- El contrato real de este repositorio ---------------------------------------------------------

test('el mapa del protocolo de este repositorio cumple su propio contrato de diseño', () => {
  const run = spawnSync(process.execPath, [script, 'check', 'contracts/design-tokens.json'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /^OK:/u);
});
