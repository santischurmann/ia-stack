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
  const root = mkdtempSync(join(tmpdir(), 'vcp-context-guard-'));
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

const CONTRATO = { tope_orquestador: 120000, tope_subsesion: 60000, aviso_desde: 0.8 };

test('ia-stack-3-4-1-tokens · AC6 · 96K de 120K (80 %) avisa con tokens y tope, sale 0', () => {
  conTranscript(sintetico(96000), (f) => {
    const r = run(['--transcript', f]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /AVISO/);
    assert.match(r.stdout, /96000/);
    assert.match(r.stdout, /120000/);
    assert.doesNotMatch(r.stdout, /ORDEN/);
  });
});

test('ia-stack-3-4-1-tokens · AC6 · 95999 tokens (bajo el 80 %) calla', () => {
  conTranscript(sintetico(95999), (f) => {
    const r = run(['--transcript', f]);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr, '');
  });
});

test('ia-stack-3-4-1-tokens · AC6 · 120K ordena cerrar: commit, resumen en .vibe/SESSION.md y compactar o handoff', () => {
  conTranscript(sintetico(120000), (f) => {
    const r = run(['--transcript', f]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /ORDEN/);
    assert.match(r.stdout, /commit/i);
    assert.match(r.stdout, /\.vibe\/SESSION\.md/);
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

test('ia-stack-3-4-1-tokens · AC6 · la subsesión usa el tope de 60K: 48K avisa, 60K ordena, y 60K en orquestador calla', () => {
  conTranscript(sintetico(48000), (f) => {
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
  assert.equal(evaluar(95999, 'orquestador', CONTRATO), null);
  assert.match(evaluar(96000, 'orquestador', CONTRATO), /AVISO/);
  assert.match(evaluar(119999, 'orquestador', CONTRATO), /AVISO/);
  assert.match(evaluar(120000, 'orquestador', CONTRATO), /ORDEN/);
  assert.match(evaluar(60000, 'subsesion', CONTRATO), /ORDEN/);
});

test('ia-stack-3-4-1-tokens · AC6 · los topes salen de contracts/model-routing.json y se validan', () => {
  assert.deepEqual(leerContrato(), CONTRATO);
  assert.throws(() => leerContrato(join(tmpdir(), 'ia-stack-context-guard-no-existe.json')), /contrato/i);
  const root = mkdtempSync(join(tmpdir(), 'vcp-context-guard-c-'));
  try {
    const malo = join(root, 'c.json');
    writeFileSync(malo, JSON.stringify({ contexto: { tope_orquestador: 'mucho' } }));
    assert.throws(() => leerContrato(malo), /tope_orquestador/);
    writeFileSync(malo, JSON.stringify({ contexto: { tope_orquestador: 1, tope_subsesion: 0, aviso_desde: 0.8 } }));
    assert.throws(() => leerContrato(malo), /tope_subsesion/);
    writeFileSync(malo, JSON.stringify({ contexto: { tope_orquestador: 1, tope_subsesion: 1, aviso_desde: 2 } }));
    assert.throws(() => leerContrato(malo), /aviso_desde/);
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
  assert.deepEqual(parsearArgs([]), { transcript: undefined, rol: 'orquestador' });
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
  const root = mkdtempSync(join(tmpdir(), 'vcp-context-guard-rt-'));
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
