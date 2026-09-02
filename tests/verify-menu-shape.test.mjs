import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { EMPTY, LIMITS, USAGE, main, parseMenus, validateMenus } from '../scripts/verify-menu-shape.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const RUTA = 'doc.md';

const menu = ({
  titulo = 'Una decisión',
  opciones = ['- **A)** hacer una cosa — *(recomendado)*', '- **B)** hacer la otra'],
  cierre = 'Esperando tu respuesta antes de continuar.',
} = {}) => ['🔵 **' + titulo + '**', '', ...opciones, '', cierre].filter((l) => l !== null).join('\n');

const doc = (...bloques) => `# Documento\n\nProsa cualquiera.\n\n${bloques.join('\n\n')}\n`;

function corrida(texto, args = ['check', RUTA]) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-menu-'));
  const salida = [];
  const errores = [];
  try {
    if (texto !== null) writeFileSync(join(root, RUTA), texto, 'utf8');
    const code = main(args, { root, write: (l) => salida.push(l), writeError: (l) => errores.push(l) });
    return { code, salida: salida.join('\n'), errores: errores.join('\n') };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// --- Falso rojo: los documentos reales del protocolo tienen que pasar --------------------------

test('los documentos reales de VCP pasan: un gate que obliga a escribir mal es peor que ninguno', () => {
  const docs = ['SKILL.md', 'README.md', 'AGENTS.md', ...readdirSync(join(repoRoot, 'skills')).filter((f) => f.endsWith('.md')).map((f) => `skills/${f}`)];
  const rojos = [];
  for (const doc of docs) {
    const errores = [];
    const code = main(['check', doc], { root: repoRoot, write: () => {}, writeError: (l) => errores.push(l) });
    if (code !== 0) rojos.push(`${doc}: ${errores.join(' | ')}`);
  }
  assert.deepEqual(rojos, []);
});

test('un documento con dos menús bien formados sale en verde y dice cuántos verificó', () => {
  const { code, errores, salida } = corrida(doc(menu(), menu({ titulo: 'Otra decisión' })));
  assert.deepEqual({ code, errores }, { code: 0, errores: '' });
  assert.match(salida, /2 menú/u);
});

// --- La causa real del colapso: el menú escrito como bloque de código o como líneas sueltas -----

test('FALSIFICACIÓN · un menú dentro de un bloque de código se rechaza: colapsa a un solo párrafo', () => {
  const bloque = ['🔵 **Una decisión**', '', '```', 'A) hacer una cosa', 'B) hacer la otra', '```', '', 'Esperando tu respuesta antes de continuar.'].join('\n');
  const { code, errores } = corrida(doc(bloque));
  assert.equal(code, 1);
  assert.match(errores, /bloque de código|opcion/iu);
});

test('FALSIFICACIÓN · opciones como líneas sueltas A) B) sin lista se rechazan', () => {
  const bloque = ['🔵 **Una decisión**', '', 'A) hacer una cosa', 'B) hacer la otra', '', 'Esperando tu respuesta antes de continuar.'].join('\n');
  const { code, errores } = corrida(doc(bloque));
  assert.equal(code, 1);
  assert.match(errores, /lista/iu);
});

test('FALSIFICACIÓN · un menú con una sola opción no es un menú', () => {
  const { code, errores } = corrida(doc(menu({ opciones: ['- **A)** única — *(recomendado)*'] })));
  assert.equal(code, 1);
  assert.match(errores, /dos opciones|2 opciones/iu);
});

test('FALSIFICACIÓN · un menú sin recomendación se rechaza: el protocolo la exige explícita', () => {
  const { code, errores } = corrida(doc(menu({ opciones: ['- **A)** una cosa', '- **B)** la otra'] })));
  assert.equal(code, 1);
  assert.match(errores, /recomend/iu);
});

test('FALSIFICACIÓN · un menú sin la línea de espera se rechaza: no queda claro que bloquea', () => {
  const bloque = ['🔵 **Una decisión**', '', '- **A)** una cosa — *(recomendado)*', '- **B)** la otra'].join('\n');
  const { code, errores } = corrida(doc(bloque));
  assert.equal(code, 1);
  assert.match(errores, /esperando/iu);
});

test('un menú con varias preguntas y una recomendación por pregunta pasa', () => {
  const bloque = [
    '🔵 **CONFIG con dos preguntas**',
    '',
    '**1. ¿Primera?**',
    '',
    '- **A)** una — *(recomendado)*',
    '- **B)** otra',
    '',
    '**2. ¿Segunda?**',
    '',
    '- **A)** una — *(recomendado)*',
    '- **B)** otra',
    '',
    'Esperando tu respuesta antes de continuar.',
  ].join('\n');
  const { code, errores } = corrida(doc(bloque));
  assert.deepEqual({ code, errores }, { code: 0, errores: '' });
});

test('una mención de 🔵 en prosa no se cuenta como menú', () => {
  const texto = `# Doc\n\nLa decisión se presenta con 🔵 y espera respuesta.\n\n${menu()}\n`;
  const { code, salida } = corrida(texto);
  assert.equal(code, 0);
  assert.match(salida, /1 menú/u);
});

// --- Entradas y límites ------------------------------------------------------------------------

test('un documento sin ningún menú no se escribe como verificado: se dice que no se verificó ninguno', () => {
  const { code, salida } = corrida('# Doc\n\nProsa sin decisiones.\n');
  assert.equal(code, 0);
  assert.match(salida, /0 menú/u);
});

test('sin archivo el gate escribe VACÍO y sale 0', () => {
  const { code, salida } = corrida(null);
  assert.equal(code, 0);
  assert.match(salida, new RegExp(EMPTY, 'u'));
});

test('FALSIFICACIÓN · una ruta que escapa del proyecto se rechaza sin abrirla', () => {
  const { code, errores } = corrida(doc(menu()), ['check', '../afuera.md']);
  assert.equal(code, 1);
  assert.match(errores, /REJECTED/u);
});

test('un uso inválido sale 2 con el usage', () => {
  for (const args of [[], ['check'], ['check', ''], ['verificar', RUTA], ['check', RUTA, 'de-mas']]) {
    const { code, errores } = corrida(doc(menu()), args);
    assert.deepEqual({ args: args.join(' '), code, usage: errores.includes(USAGE) }, { args: args.join(' '), code: 2, usage: true });
  }
});

test('el límite se imprime en verde Y en rojo: la línea de éxito no se cita sola', () => {
  const verde = corrida(doc(menu()));
  const rojo = corrida(doc(menu({ opciones: ['- **A)** sola'] })));
  assert.deepEqual(
    { verde: `${verde.salida}${verde.errores}`.includes(LIMITS), rojo: `${rojo.salida}${rojo.errores}`.includes(LIMITS) },
    { verde: true, rojo: true },
  );
});

test('parseMenus separa los bloques por encabezado y devuelve su línea', () => {
  const bloques = parseMenus(doc(menu(), menu({ titulo: 'Otra' })));
  assert.equal(bloques.length, 2);
  assert.deepEqual(bloques.map((b) => b.line > 0), [true, true]);
});

test('validateMenus devuelve la lista de violaciones sin lanzar nunca', () => {
  assert.deepEqual(validateMenus(doc(menu())), []);
  assert.equal(validateMenus(doc(menu({ opciones: ['- **A)** sola'] }))).length > 0, true);
});

test('FALSIFICACIÓN · un error de lectura que no es "no existe" se informa, no se toma por vacío', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-menu-'));
  const errores = [];
  try {
    writeFileSync(join(root, RUTA), doc(menu()), 'utf8');
    const code = main(['check', RUTA], {
      root,
      write: () => {},
      writeError: (l) => errores.push(l),
      read: () => { const error = new Error('EISDIR'); error.code = 'EISDIR'; throw error; },
    });
    assert.deepEqual({ code, acusa: /EISDIR/u.test(errores.join('\n')) }, { code: 1, acusa: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('si el archivo desaparece entre resolver la ruta y leerla, eso es VACÍO y no un rechazo', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-menu-'));
  const salida = [];
  try {
    writeFileSync(join(root, RUTA), doc(menu()), 'utf8');
    const code = main(['check', RUTA], {
      root,
      write: (l) => salida.push(l),
      writeError: () => {},
      read: () => { const error = new Error('ENOENT'); error.code = 'ENOENT'; throw error; },
    });
    assert.deepEqual({ code, vacio: salida.join('\n').includes(EMPTY) }, { code: 0, vacio: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un documento con CRLF se verifica igual que uno con LF', () => {
  const lf = doc(menu());
  assert.deepEqual(validateMenus(lf.replace(/\n/gu, '\r\n')), validateMenus(lf));
});

test('el propio README menciona el formato de menú que el gate exige', () => {
  const skill = readFileSync(join(repoRoot, 'SKILL.md'), 'utf8');
  assert.match(skill, /La forma canónica es una lista Markdown/u);
});

test('FALSIFICACIÓN · un menú sin cierre no se come el menú siguiente: se acusa solo, y el otro se valida aparte', () => {
  const sinCierre = ['🔵 **Primera decisión**', '', '- **A)** una — *(recomendado)*', '- **B)** otra'].join('\n');
  const texto = `${doc(sinCierre)}\n${menu({ titulo: 'Segunda decisión' })}\n`;
  const bloques = parseMenus(texto);
  const violaciones = validateMenus(texto);
  assert.deepEqual(
    { bloques: bloques.length, cerrados: bloques.map((b) => b.closed), acusaSoloAlPrimero: violaciones.length === 1 && /Primera/u.test(violaciones[0]) },
    { bloques: 2, cerrados: [false, true], acusaSoloAlPrimero: true },
  );
});

test('FALSIFICACIÓN · un menú sin cierre corta en el encabezado de sección siguiente, no lo absorbe', () => {
  const sinCierre = ['🔵 **Decisión trunca**', '', '- **A)** una — *(recomendado)*', '- **B)** otra'].join('\n');
  const texto = `# Doc\n\n${sinCierre}\n\n## Otra sección\n\nA) esto es prosa, no una opción\n`;
  const [bloque] = parseMenus(texto);
  const violaciones = validateMenus(texto);
  assert.deepEqual(
    { cerrado: bloque.closed, absorbio: bloque.body.some((r) => r.text.includes('esto es prosa')), violaciones: violaciones.length },
    { cerrado: false, absorbio: false, violaciones: 1 },
  );
});

// --- Segunda tanda de la auditoria: el gate no veia menus escondidos ----------------------------
// parseMenus solo reconocia un titulo al principio de linea y fuera de un fence, asi que un menu
// dentro de una cita, dentro de un bloque de codigo, o detras de un fence sin cerrar, DESAPARECIA
// -- y desaparecer es el verde mas peligroso: el gate contaba menos menus y salia OK.

test('FV-2 · FALSIFICACIÓN · un menú dentro de una cita markdown no desaparece', () => {
  const citado = ['> 🔵 **Una decisión**', '>', '> A) hacer una cosa', '> B) hacer la otra', '>', '> Esperando tu respuesta antes de continuar.'].join('\n');
  const { code, errores } = corrida(doc(citado));
  assert.deepEqual({ code, acusa: /cita|lista/iu.test(errores) }, { code: 1, acusa: true });
});

test('FV-3 · FALSIFICACIÓN · un menú entero dentro de un bloque de código no desaparece', () => {
  const dentro = ['```', '🔵 **Una decisión**', 'A) hacer una cosa', 'B) hacer la otra', 'Esperando tu respuesta antes de continuar.', '```'].join('\n');
  const { code, errores } = corrida(doc(dentro));
  assert.deepEqual({ code, acusa: /bloque de código/iu.test(errores) }, { code: 1, acusa: true });
});

test('FV-4 · FALSIFICACIÓN · un bloque de código sin cerrar no esconde el resto del documento', () => {
  const texto = `# Doc\n\n\`\`\`bash\necho sin cerrar\n\n${menu()}\n`;
  const { code, errores } = corrida(texto);
  assert.deepEqual({ code, acusa: /sin cerrar/iu.test(errores) }, { code: 1, acusa: true });
});

test('FV-1 · FALSIFICACIÓN · dos opciones con la misma letra, o dos opciones idénticas, se rechazan', () => {
  const letraRepetida = ['🔵 **Una decisión**', '', '- **A)** una cosa — *(recomendado)*', '- **A)** otra cosa', '', 'Esperando tu respuesta antes de continuar.'].join('\n');
  const identicas = ['🔵 **Una decisión**', '', '- **A)** la misma — *(recomendado)*', '- **B)** la misma', '', 'Esperando tu respuesta antes de continuar.'].join('\n');
  for (const [nombre, bloque] of [['letra repetida', letraRepetida], ['idénticas', identicas]]) {
    const { code } = corrida(doc(bloque));
    assert.deepEqual({ nombre, code }, { nombre, code: 1 });
  }
});

test('FV-5 · FALSIFICACIÓN · un menú dentro de un comentario HTML no cuenta como menú mostrado', () => {
  const oculto = `<!--\n${menu()}\n-->`;
  const { code, errores } = corrida(doc(oculto));
  assert.deepEqual({ code, acusa: /comentario/iu.test(errores) }, { code: 1, acusa: true });
});

test('FR-1 · una nota que nombra sus propias letras dentro del menú no lo rompe', () => {
  const conNota = ['🔵 **¿Publico?**', '', '- **A)** publicar — *(recomendado)*', '- **B)** publicar y abrir un PR', '- **C)** todavía no', '', 'A) y B) publican; C) no. No se pueden combinar.', '', 'Esperando tu respuesta antes de continuar.'].join('\n');
  const { code, errores } = corrida(doc(conNota));
  assert.deepEqual({ code, errores }, { code: 0, errores: '' });
});

// --- Tercera tanda de la auditoría sobre el gate de menús ---------------------------------------

test('FV-6 · FALSIFICACIÓN · opciones indentadas cuatro espacios se rechazan: Markdown las lee como código', () => {
  const bloque = ['🔵 **Una decisión**', '', '    - **A)** una — *(recomendado)*', '    - **B)** otra', '', 'Esperando tu respuesta antes de continuar.'].join('\n');
  const { code, errores } = corrida(doc(bloque));
  assert.deepEqual({ code, acusa: /indenta|código/iu.test(errores) }, { code: 1, acusa: true });
});

test('FV-7 · FALSIFICACIÓN · opciones sin texto no son opciones', () => {
  const bloque = ['🔵 **Una decisión**', '', '- **A)** ', '- **B)** ', '', '*(recomendado)*', '', 'Esperando tu respuesta antes de continuar.'].join('\n');
  const { code, errores } = corrida(doc(bloque));
  assert.deepEqual({ code, acusa: /sin texto|vacía/iu.test(errores) }, { code: 1, acusa: true });
});

test('FR-5 · un subencabezado adentro del menú no lo parte', () => {
  const bloque = ['🔵 **Una decisión**', '', '#### Contexto', '', 'por qué importa', '', '- **A)** una — *(recomendado)*', '- **B)** otra', '', 'Esperando tu respuesta antes de continuar.'].join('\n');
  const { code, errores } = corrida(doc(bloque));
  assert.deepEqual({ code, errores }, { code: 0, errores: '' });
});

test('FR-5 · pero un encabezado de sección sí cierra un menú sin línea de espera', () => {
  const texto = `# Doc\n\n🔵 **Trunca**\n\n- **A)** una — *(recomendado)*\n- **B)** otra\n\n## Otra sección\n\nA) esto es prosa\n`;
  const [bloque] = parseMenus(texto);
  assert.deepEqual({ cerrado: bloque.closed, absorbio: bloque.body.some((r) => r.text.includes('esto es prosa')) }, { cerrado: false, absorbio: false });
});

test('CONTR-2 · ningún menú de los documentos reales se pierde en el barrido', () => {
  // La prueba de "los documentos reales pasan" sólo miraba el exit code, así que un menú que
  // DESAPARECIERA del barrido la dejaba verde: el gate contaba menos y decía OK. Acá se fija la
  // invariante que importa — tantos bloques reconocidos como títulos hay en el archivo.
  const docs = ['SKILL.md', 'README.md', 'AGENTS.md', '.agents/skills/vibecodeprotocols/SKILL.md',
    ...readdirSync(join(repoRoot, 'skills')).filter((f) => f.endsWith('.md')).map((f) => `skills/${f}`)];
  const desajustes = [];
  let total = 0;
  for (const doc of docs) {
    const fuente = readFileSync(join(repoRoot, doc), 'utf8');
    const titulos = fuente.split(/\r?\n/u).filter((l) => /^(\s*>)*\s*🔵 \*\*/u.test(l)).length;
    const reconocidos = parseMenus(fuente).length;
    total += reconocidos;
    if (titulos !== reconocidos) desajustes.push(`${doc}: ${titulos} títulos contra ${reconocidos} bloques`);
  }
  assert.deepEqual({ desajustes, hayMenus: total > 0 }, { desajustes: [], hayMenus: true });
});
