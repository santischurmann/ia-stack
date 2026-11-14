import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { contarTokens, ejecutar, evaluar, leerContrato, parsearArgs } from '../scripts/context-guard.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const guard = join(repoRoot, 'scripts', 'context-guard.mjs');

function run(args, { input = '', script = guard } = {}) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env, input });
  assert.equal(r.error, undefined, `no pudo lanzar: ${r.error?.message}`);
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

// Mensaje con exactamente `tokens` tokens (4 caracteres por token).
const msg = (tokens, type = 'user') => JSON.stringify({ type, message: { role: type, content: 'x'.repeat(tokens * 4) } });

function conTranscript(lineas, callback) {
  const root = mkdtempSync(join(tmpdir(), 'ia-context-guard-'));
  const file = join(root, 't.jsonl');
  writeFileSync(file, lineas.join('\n') + '\n');
  try {
    callback(file);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// Transcript sintético de N tokens: mensajes de hasta 1000 tokens, alternando usuario y asistente.
const sintetico = (n) => {
  const l = [];
  let falta = n;
  while (falta > 0) {
    const t = Math.min(1000, falta);
    l.push(msg(t, l.length % 2 ? 'assistant' : 'user'));
    falta -= t;
  }
  return l;
};

const CONTRATO = {
  tope_orquestador: 120000,
  tope_subsesion: 60000,
  aviso_desde: 0.7,
  ventana_max: 300000,
  handoff: { archivo: '.ia-stack/handoffs/ULTIMO.md', max_lineas: 40, max_caracteres: 6000, max_horas: 24, antes_de_compactar: 0.6 },
};

test('egm-preview-04-11 · handoff al 70 % · 84K de 120K avisa con tokens y tope y pide handoff, sale 0', () => {
  conTranscript(sintetico(84000), (f) => {
    const r = run(['--transcript', f]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /AVISO/);
    assert.match(r.stdout, /84000/);
    assert.match(r.stdout, /handoff/i);
    assert.match(r.stdout, /120000/);
    assert.doesNotMatch(r.stdout, /ORDEN/);
  });
});

test('egm-preview-04-11 · handoff al 70 % · 83999 tokens (bajo el 70 %) calla', () => {
  conTranscript(sintetico(83999), (f) => {
    const r = run(['--transcript', f]);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr, '');
  });
});

test('ia-stack-3-4-1-tokens · AC6 · 120K ordena cerrar: commit, resumen en .ia-stack/ESTADO.md y compactar o handoff', () => {
  conTranscript(sintetico(120000), (f) => {
    const r = run(['--transcript', f]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /ORDEN/);
    assert.match(r.stdout, /commit/i);
    assert.match(r.stdout, /\.ia-stack\/ESTADO\.md/);
    assert.match(r.stdout, /decisiones/);
    assert.match(r.stdout, /archivos clave/);
    assert.match(r.stdout, /pendientes/);
    assert.match(r.stdout, /retomar/);
    assert.match(r.stdout, /compact/i);
    assert.match(r.stdout, /handoff/i);
  });
});

test('ia-stack-3-4-1-tokens · AC6 · 130K también ordena cerrar y sale 0', () => {
  conTranscript(sintetico(130000), (f) => {
    const r = run(['--transcript', f]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /ORDEN/);
    assert.match(r.stdout, /130000/);
  });
});

test('ia-stack-3-4-1-tokens · AC6 · la subsesión usa el tope de 60K: 42K avisa, 60K ordena, y 60K en orquestador calla', () => {
  conTranscript(sintetico(42000), (f) => {
    const r = run(['--transcript', f, '--rol', 'subsesion']);
    assert.match(r.stdout, /AVISO/);
    assert.match(r.stdout, /60000/);
  });
  conTranscript(sintetico(60000), (f) => {
    assert.match(run(['--transcript', f, '--rol', 'subsesion']).stdout, /ORDEN/);
    assert.equal(run(['--transcript', f, '--rol', 'orquestador']).stdout, '');
  });
});

test('ia-stack-3-4-1-tokens · AC6 · lee transcript_path del JSON de hook por stdin', () => {
  conTranscript(sintetico(120000), (f) => {
    const r = run([], { input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', transcript_path: f }) });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /ORDEN/);
  });
});

test('ia-stack-3-4-1-tokens · AC6 · cuenta tool_use y tool_result serializados e ignora líneas no-JSON y otros tipos', () => {
  const toolUse = { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } };
  const toolResult = { type: 'tool_result', tool_use_id: 't1', content: 'ok' };
  const lineas = [
    'esto no es json',
    '',
    '[1,2,3]',
    'null',
    JSON.stringify({ type: 'summary', summary: 'x'.repeat(40000) }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'abcd' }, toolUse] } }),
    JSON.stringify({ type: 'user', message: { role: 'user', content: [toolResult, 'abcde'] } }),
    JSON.stringify({ type: 'user', message: { role: 'user' } }),
    JSON.stringify({ type: 'user', message: { role: 'user', content: 42 } }),
    JSON.stringify({ type: 'user' }),
  ];
  const asistente = Math.ceil(('abcd'.length + JSON.stringify(toolUse).length) / 4);
  const usuario = Math.ceil((JSON.stringify(toolResult).length + 'abcde'.length) / 4);
  assert.equal(contarTokens(lineas.join('\n')), asistente + usuario);
  assert.equal(contarTokens(''), 0);
});

test('ia-stack-3-4-1-tokens · AC6 · evaluar: silencio, aviso y orden según el ratio', () => {
  assert.equal(evaluar(0, 'orquestador', CONTRATO), null);
  assert.equal(evaluar(83999, 'orquestador', CONTRATO), null);
  assert.match(evaluar(84000, 'orquestador', CONTRATO), /AVISO/);
  assert.match(evaluar(119999, 'orquestador', CONTRATO), /AVISO/);
  assert.match(evaluar(120000, 'orquestador', CONTRATO), /ORDEN/);
  assert.match(evaluar(60000, 'subsesion', CONTRATO), /ORDEN/);
});

test('ia-stack-3-4-1-tokens · AC6 · los topes salen de contracts/model-routing.json y se validan', () => {
  assert.deepEqual(leerContrato(), CONTRATO);
  assert.throws(() => leerContrato(join(tmpdir(), 'ia-stack-context-guard-no-existe.json')), /contrato/i);
  const root = mkdtempSync(join(tmpdir(), 'ia-context-guard-c-'));
  try {
    const malo = join(root, 'c.json');
    writeFileSync(malo, JSON.stringify({ contexto: { tope_orquestador: 'mucho' } }));
    assert.throws(() => leerContrato(malo), /tope_orquestador/);
    writeFileSync(malo, JSON.stringify({ contexto: { tope_orquestador: 1, tope_subsesion: 0, aviso_desde: 0.8 } }));
    assert.throws(() => leerContrato(malo), /tope_subsesion/);
    writeFileSync(malo, JSON.stringify({ contexto: { tope_orquestador: 1, tope_subsesion: 1, aviso_desde: 2 } }));
    assert.throws(() => leerContrato(malo), /aviso_desde/);
    writeFileSync(malo, JSON.stringify({ contexto: { tope_orquestador: 10, tope_subsesion: 1, aviso_desde: 0.7, ventana_max: 5 } }));
    assert.throws(() => leerContrato(malo), /ventana_max/);
    writeFileSync(malo, '{');
    assert.throws(() => leerContrato(malo), /contrato/i);
    writeFileSync(malo, JSON.stringify({}));
    assert.throws(() => leerContrato(malo), /contexto/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ia-stack-3-4-1-tokens · AC6 · parsearArgs', () => {
  assert.deepEqual(parsearArgs(['--transcript', 'a', '--rol', 'subsesion']), { transcript: 'a', rol: 'subsesion' });
  assert.deepEqual(parsearArgs([], {}), { transcript: undefined, rol: 'orquestador' });
  assert.throws(() => parsearArgs(['--rol', 'otro']), /rol/);
  assert.throws(() => parsearArgs(['--transcript']), /transcript/);
  assert.throws(() => parsearArgs(['--rol']), /rol/);
  assert.throws(() => parsearArgs(['--nada']), /argumento/);
});

test('ia-stack-3-4-1-tokens · AC6 · sale 0 SIEMPRE: los errores van a stderr y no actúa solo', () => {
  const casos = [
    { args: ['--transcript', join(tmpdir(), 'ia-stack-context-guard-no-existe.jsonl')], input: '' },
    { args: [], input: '' },
    { args: [], input: 'no es json' },
    { args: [], input: '[1]' },
    { args: [], input: JSON.stringify({ sin: 'transcript_path' }) },
    { args: ['--rol', 'otro'], input: '' },
    { args: ['--nada'], input: '' },
  ];
  for (const { args, input } of casos) {
    const r = run(args, { input });
    assert.equal(r.status, 0, `${args.join(' ')} | ${input}\n${r.stderr}`);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /context-guard:/);
  }
});

test('ia-stack-3-4-1-tokens · AC6 · sin contrato junto al script avisa por stderr y sale 0 (runtime roto)', () => {
  const root = mkdtempSync(join(tmpdir(), 'ia-context-guard-rt-'));
  try {
    mkdirSync(join(root, 'scripts'));
    copyFileSync(guard, join(root, 'scripts', 'context-guard.mjs'));
    conTranscript(sintetico(130000), (f) => {
      const r = run(['--transcript', f], { script: join(root, 'scripts', 'context-guard.mjs') });
      assert.equal(r.status, 0);
      assert.equal(r.stdout, '');
      assert.match(r.stderr, /contrato/i);
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ia-stack-3-4-1-tokens · AC6 · ejecutar devuelve salida y errores sin tocar el proceso', () => {
  conTranscript(sintetico(120000), (f) => {
    const r = ejecutar(['--transcript', f], () => '');
    assert.match(r.stdout, /ORDEN/);
    assert.equal(r.stderr, '');
  });
  const e = ejecutar([], () => {
    throw new Error('sin stdin');
  });
  assert.equal(e.stdout, '');
  assert.match(e.stderr, /context-guard:.*stdin/);
});

// ---- Revisión N3 3.4.1: compactación, sidechain y rol por entorno ----
const frontera = () => JSON.stringify({ type: 'system', subtype: 'compact_boundary', content: 'Conversation compacted' });
const resumen = (tokens) => JSON.stringify({ type: 'user', isCompactSummary: true, message: { role: 'user', content: 'x'.repeat(tokens * 4) } });

test('revision-n3 · ALTA 1 · tras compact_boundary el conteo reinicia: 130K antes + resumen de 2K queda bajo el aviso', () => {
  const lineas = [...sintetico(130000), frontera(), resumen(2000), msg(500)];
  assert.equal(contarTokens(lineas.join('\n')), 2500);
  conTranscript(lineas, (f) => {
    const r = run(['--transcript', f]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, '');
  });
});

test('revision-n3 · ALTA 1 · se reinicia en el ÚLTIMO boundary y un resumen sin boundary también corta', () => {
  const dos = [...sintetico(50000), frontera(), ...sintetico(30000), frontera(), resumen(10), msg(5)];
  assert.equal(contarTokens(dos.join('\n')), 15);
  const soloResumen = [...sintetico(50000), resumen(10), msg(5)];
  assert.equal(contarTokens(soloResumen.join('\n')), 15);
});

test('revision-n3 · MEDIA 2 · las líneas isSidechain no cuentan como contexto del orquestador', () => {
  const lado = JSON.stringify({ type: 'assistant', isSidechain: true, message: { role: 'assistant', content: 'x'.repeat(4000) } });
  assert.equal(contarTokens([msg(10), lado, msg(5)].join('\n')), 15);
});

test('revision-n3 · MEDIA 3 · el rol sale de IA_STACK_ROL si no hay --rol; --rol gana; valor inválido falla', () => {
  assert.deepEqual(parsearArgs([], { IA_STACK_ROL: 'subsesion' }), { transcript: undefined, rol: 'subsesion' });
  assert.deepEqual(parsearArgs(['--rol', 'orquestador'], { IA_STACK_ROL: 'subsesion' }), { transcript: undefined, rol: 'orquestador' });
  assert.deepEqual(parsearArgs([], { IA_STACK_ROL: '' }), { transcript: undefined, rol: 'orquestador' });
  assert.throws(() => parsearArgs([], { IA_STACK_ROL: 'otro' }), /IA_STACK_ROL/);
  conTranscript(sintetico(60000), (f) => {
    const env = { ...process.env, IA_STACK_ROL: 'subsesion' };
    delete env.NODE_TEST_CONTEXT;
    const r = spawnSync(process.execPath, [guard, '--transcript', f], { encoding: 'utf8', env });
    assert.match(r.stdout, /ORDEN/);
    assert.match(r.stdout, /rol subsesion/);
  });
});

// ---- 3.4.5 · handoff antes de compactar ----
const CON_HANDOFF = CONTRATO;

test('3.4.5 · a 0,6 × ventana (180.000 tokens de mensajes) ordena escribir el handoff, en los dos roles', () => {
  for (const rol of ['orquestador', 'subsesion']) {
    assert.doesNotMatch(evaluar(179999, rol, CON_HANDOFF), /compactación es inminente/u, rol);
    const m = evaluar(180000, rol, CON_HANDOFF);
    assert.match(m, /^ORDEN: escribí el handoff en \.ia-stack\/handoffs\/ULTIMO\.md ahora: la compactación es inminente/u, rol);
    const llena = evaluar(300000, rol, CON_HANDOFF);
    assert.match(llena, /ventana de 300000 tokens llena/u);
    assert.doesNotMatch(llena, /compactación es inminente/u);
  }
});

test('3.4.5 · los avisos de relevo nombran el archivo de handoff y su plantilla', () => {
  for (const tokens of [84000, 120000]) {
    const m = evaluar(tokens, 'orquestador', CON_HANDOFF);
    assert.ok(m.includes('.ia-stack/handoffs/ULTIMO.md'), m);
    assert.ok(m.includes('templates/estado/HANDOFF.md'), m);
  }
});

const SIN_HANDOFF = { contexto: { tope_orquestador: 120000, tope_subsesion: 60000, aviso_desde: 0.7, ventana_max: 300000 } };

test('3.4.5 · leerContrato trae contexto.handoff; si falta o está roto devuelve null, no lanza', () => {
  assert.deepEqual(leerContrato().handoff, CON_HANDOFF.handoff);
  const dir = mkdtempSync(join(tmpdir(), 'ia-guard-'));
  try {
    const ruta = join(dir, 'c.json');
    writeFileSync(ruta, JSON.stringify(SIN_HANDOFF));
    assert.equal(leerContrato(ruta).handoff, null);
    writeFileSync(ruta, JSON.stringify({ contexto: { ...SIN_HANDOFF.contexto, handoff: { archivo: '' } } }));
    assert.equal(leerContrato(ruta).handoff, null);
    writeFileSync(ruta, JSON.stringify({ contexto: { ...SIN_HANDOFF.contexto, handoff: { ...CON_HANDOFF.handoff, antes_de_compactar: '0.6' } } }));
    assert.equal(leerContrato(ruta).handoff, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('3.4.5 · sin contexto.handoff el relevo y la ventana siguen avisando; sólo falta la orden de handoff', () => {
  const sin = { ...CONTRATO, handoff: null };
  assert.equal(evaluar(83999, 'orquestador', sin), null);
  const aviso = evaluar(84000, 'orquestador', sin);
  assert.match(aviso, /^AVISO/u);
  assert.doesNotMatch(aviso, /ULTIMO\.md|HANDOFF\.md/u);
  assert.match(aviso, /objetivo, decisiones, archivos clave, pendientes, cómo retomar/u);
  assert.match(evaluar(120000, 'orquestador', sin), /^ORDEN: contexto al tope/u);
  assert.match(evaluar(180000, 'orquestador', sin), /^ORDEN: contexto al tope/u);
  assert.match(evaluar(300000, 'orquestador', sin), /ventana de 300000 tokens llena/u);
});

test('3.4.5 · CLI con handoff pero sin ventana_max: da la orden de relevo y avisa por stderr que no hay orden de handoff', () => {
  const root = mkdtempSync(join(tmpdir(), 'ia-context-guard-sv-'));
  try {
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'contracts'));
    copyFileSync(guard, join(root, 'scripts', 'context-guard.mjs'));
    const { ventana_max: _fuera, ...contexto } = { ...SIN_HANDOFF.contexto, handoff: CON_HANDOFF.handoff };
    writeFileSync(join(root, 'contracts', 'model-routing.json'), JSON.stringify({ contexto }));
    conTranscript(sintetico(190000), (f) => {
      const r = run(['--transcript', f], { script: join(root, 'scripts', 'context-guard.mjs') });
      assert.equal(r.status, 0);
      assert.match(r.stdout, /^ORDEN: contexto al tope/u);
      assert.equal(r.stderr, 'context-guard: contrato sin contexto.ventana_max: no se ordena el handoff\n');
    });
    conTranscript(sintetico(1000), (f) => {
      const r = run(['--transcript', f], { script: join(root, 'scripts', 'context-guard.mjs') });
      assert.equal(r.stdout, '', 'debajo de todo umbral no hay mensaje');
      assert.equal(r.stderr, 'context-guard: contrato sin contexto.ventana_max: no se ordena el handoff\n', 'el aviso sale en cada corrida');
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('3.4.5 · CLI con un contrato sin contexto.handoff: da la orden de relevo y lo avisa por stderr', () => {
  const root = mkdtempSync(join(tmpdir(), 'ia-context-guard-sh-'));
  try {
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'contracts'));
    copyFileSync(guard, join(root, 'scripts', 'context-guard.mjs'));
    writeFileSync(join(root, 'contracts', 'model-routing.json'), JSON.stringify(SIN_HANDOFF));
    conTranscript(sintetico(130000), (f) => {
      const r = run(['--transcript', f], { script: join(root, 'scripts', 'context-guard.mjs') });
      assert.equal(r.status, 0);
      assert.match(r.stdout, /^ORDEN: contexto al tope/u);
      assert.equal(r.stderr, 'context-guard: contrato sin contexto.handoff: no se ordena el handoff\n');
    });
    conTranscript(sintetico(1000), (f) => {
      const r = run(['--transcript', f], { script: join(root, 'scripts', 'context-guard.mjs') });
      assert.equal(r.stdout, '', 'debajo de todo umbral no hay mensaje');
      assert.equal(r.stderr, 'context-guard: contrato sin contexto.handoff: no se ordena el handoff\n', 'el aviso sale en cada corrida');
    });
    const malUso = run(['--raro'], { script: join(root, 'scripts', 'context-guard.mjs') });
    assert.equal(malUso.status, 0);
    assert.equal(malUso.stderr, 'context-guard: argumento desconocido: --raro\n', 'con argumentos inválidos el contrato no se lee: el aviso no sale');
    const sinRuta = run([], { input: '{}', script: join(root, 'scripts', 'context-guard.mjs') });
    assert.equal(sinRuta.status, 0);
    assert.equal(sinRuta.stderr, 'context-guard: contrato sin contexto.handoff: no se ordena el handoff\ncontext-guard: el JSON de stdin no trae transcript_path\n');
    const sinTranscript = run(['--transcript', join(root, 'no-existe.jsonl')], { script: join(root, 'scripts', 'context-guard.mjs') });
    assert.equal(sinTranscript.status, 0);
    assert.equal(sinTranscript.stdout, '');
    assert.match(sinTranscript.stderr, /^context-guard: contrato sin contexto\.handoff: no se ordena el handoff\ncontext-guard: no se pudo leer el transcript .*\n$/u, 'el aviso sale también cuando después falla la lectura');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
