// Los 8 gates del protocolo (spec 3.4.4, criterio 4): cada uno apunta a scripts que existen y tienen test.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const contrato = JSON.parse(readFileSync(join(raiz, 'contracts/gates.json'), 'utf8'));
const tests = readdirSync(join(raiz, 'tests'))
  .filter((f) => f.endsWith('.mjs'))
  .map((f) => ({ f, texto: readFileSync(join(raiz, 'tests', f), 'utf8') }));

test('hay 8 gates numerados de 1 a 8', () => {
  assert.deepEqual(contrato.gates.map((g) => g.n), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('los protegidos son el 1, el 3, el 4 y el 5', () => {
  assert.deepEqual(contrato.gates.filter((g) => g.protegido).map((g) => g.n), [1, 3, 4, 5]);
});

test('los gates 3 y 5 traen comandos con la interfaz real de los scripts (ninguno sale 2 por uso incorrecto)', () => {
  const vacio = mkdtempSync(join(tmpdir(), 'ia-gates-'));
  try {
    for (const n of [3, 5]) {
      const gate = contrato.gates.find((g) => g.n === n);
      assert.ok(Array.isArray(gate.comandos) && gate.comandos.length > 0, `gate ${n} sin comandos`);
      for (const comando of gate.comandos) {
        const partes = comando.split(' ');
        assert.equal(partes[0], 'node', comando);
        assert.match(partes[1], /^scripts\/[\w-]+\.mjs$/u, comando);
        assert.ok(gate.scripts.includes(partes[1].slice('scripts/'.length)) || partes[1] === 'scripts/aprobar.mjs', comando);
        const args = partes.slice(2).map((a) => ({ '<pieza>': 'x', '<vN>': 'v1', '<sha>': 'abcdef1' }[a] ?? a));
        if (partes[1] === 'scripts/aprobar.mjs') args.push('--proyecto', vacio);
        const env = { ...process.env };
        delete env.NODE_TEST_CONTEXT;
        const r = spawnSync(process.execPath, [join(raiz, partes[1]), ...args], { cwd: vacio, encoding: 'utf8', env });
        assert.notEqual(r.status, 2, `${comando}\n${r.stderr}`);
        assert.equal(r.status, 1, `sin registro nunca aprueba: ${comando}\n${r.stdout}${r.stderr}`);
      }
    }
  } finally {
    rmSync(vacio, { recursive: true, force: true });
  }
});

for (const gate of contrato.gates) {
  test(`gate ${gate.n} (${gate.nombre}): sus scripts existen y tienen test`, () => {
    assert.ok(gate.scripts.length > 0, 'no nombra ningún script');
    for (const s of gate.scripts) {
      assert.ok(existsSync(join(raiz, 'scripts', s)), `scripts/${s} no existe`);
      assert.ok(tests.some((t) => t.texto.includes(s) || t.texto.includes(s.replace(/\.mjs$/u, ''))), `ningún test menciona ${s}`);
    }
  });
}
