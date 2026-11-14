// ventana — la ventana de 300K y los dos hooks quedan puestos solos en `.claude/settings.local.json`
// del proyecto: la variable que hace compactar al host, el hook que mide el contexto en cada mensaje
// y el que vuelve a mostrar el handoff después de compactar.
//
// LO QUE NO CUBRE: que el host lea ese archivo ni que compacte de verdad. El exit 1 del CLI cuando
// no puede escribir se prueba por dos caminos: `main` con un `escribir` inyectado que falla, y el
// subproceso con `.claude` como archivo. Los reintentos del renombrado se prueban en `escribirAtomico`.
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { CMD_CONTEXTO, CMD_HANDOFF, VARIABLE, escribirAtomico, leerVentana, main, mismaCarpeta, planear } from '../scripts/ventana.mjs';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(raiz, 'scripts', 'ventana.mjs');
const V = 300000;
const TODO = ['ventana', 'hook-contexto', 'hook-handoff'];
const hook = (command) => ({ type: 'command', command });
const completo = (extra = {}) => ({
  env: { [VARIABLE]: '300000' },
  hooks: { UserPromptSubmit: [{ hooks: [hook(CMD_CONTEXTO)] }], SessionStart: [{ matcher: 'compact', hooks: [hook(CMD_HANDOFF)] }] },
  ...extra,
});
const json = (o) => `${JSON.stringify(o, null, 2)}\n`;

function run(args, { cwd = raiz, env = {} } = {}) {
  const e = { ...process.env, ...env };
  delete e.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: e, cwd });
  assert.equal(r.error, undefined);
  return { status: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/** Proyecto temporal con `.ia-stack/`; `runtime` planta los dos scripts que los hooks nombran. */
function conProyecto(cb, { runtime = true, settings = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ia-ventana-'));
  try {
    mkdirSync(join(dir, '.ia-stack'));
    if (runtime) {
      mkdirSync(join(dir, '.ia-stack', 'runtime', 'scripts'), { recursive: true });
      for (const f of ['context-guard.mjs', 'handoff.mjs']) writeFileSync(join(dir, '.ia-stack', 'runtime', 'scripts', f), '');
    }
    const ruta = join(dir, '.claude', 'settings.local.json');
    if (settings !== null) {
      mkdirSync(dirname(ruta));
      writeFileSync(ruta, settings);
    }
    cb(dir, ruta);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('los comandos de los hooks son los del runtime del proyecto, con $CLAUDE_PROJECT_DIR', () => {
  assert.equal(VARIABLE, 'CLAUDE_CODE_AUTO_COMPACT_WINDOW');
  assert.equal(CMD_CONTEXTO, 'node "$CLAUDE_PROJECT_DIR/.ia-stack/runtime/scripts/context-guard.mjs"');
  assert.equal(CMD_HANDOFF, 'node "$CLAUDE_PROJECT_DIR/.ia-stack/runtime/scripts/handoff.mjs" mostrar --proyecto "$CLAUDE_PROJECT_DIR"');
});

test('planear · sin archivo crea las tres cosas, con la forma anidada exacta, en LF y con salto final', () => {
  const p = planear(null, V, true);
  assert.equal(p.accion, 'crear');
  assert.deepEqual(p.faltan, TODO);
  assert.equal(p.texto, json(completo()));
  assert.ok(!p.texto.includes('\r'));
  const sin = planear(null, V, false);
  assert.deepEqual(sin.faltan, ['ventana']);
  assert.equal(sin.texto, json({ env: { [VARIABLE]: '300000' } }));
});

test('planear · la variable se fija si falta o no sirve, y se respeta si es válida y no pasa la ventana', () => {
  for (const malo of [undefined, '500000', '0', '-5', '5', 'abc', '3e5', 300000, '099999', '']) {
    const o = completo();
    if (malo === undefined) delete o.env[VARIABLE];
    else o.env[VARIABLE] = malo;
    const p = planear(json(o), V, true);
    assert.equal(p.accion, 'fijar', String(malo));
    assert.deepEqual(p.faltan, ['ventana'], String(malo));
    assert.equal(JSON.parse(p.texto).env[VARIABLE], '300000');
  }
  for (const bueno of ['200000', '100000', '300000']) {
    const o = completo();
    o.env[VARIABLE] = bueno;
    const p = planear(json(o), V, true);
    assert.equal(p.accion, 'respetar', bueno);
    assert.deepEqual(p.faltan, []);
  }
});

test('planear · variable válida sin hooks los agrega; aplicado dos veces da los mismos bytes', () => {
  const p = planear(json({ env: { [VARIABLE]: '200000', OTRA: 'x' }, permissions: { allow: ['a'] } }), V, true);
  assert.equal(p.accion, 'fijar');
  assert.deepEqual(p.faltan, ['hook-contexto', 'hook-handoff']);
  const o = JSON.parse(p.texto);
  assert.deepEqual(o.env, { [VARIABLE]: '200000', OTRA: 'x' });
  assert.deepEqual(o.permissions, { allow: ['a'] });
  assert.deepEqual(Object.keys(o), ['env', 'permissions', 'hooks']);
  assert.deepEqual(o.hooks, completo().hooks);
  const otra = planear(p.texto, V, true);
  assert.equal(otra.accion, 'respetar');
  assert.equal(otra.texto, p.texto);
});

test('planear · conserva hooks ajenos y entradas de forma rara, y no las cuenta como presentes', () => {
  const ajeno = { hooks: [hook('echo hola')] };
  const rara = { command: CMD_CONTEXTO };
  const rota = { hooks: 'no es lista' };
  const sinMatcher = { hooks: [hook(CMD_HANDOFF)] };
  const p = planear(json({ env: { [VARIABLE]: '300000' }, hooks: { UserPromptSubmit: [ajeno, rara, rota], SessionStart: [sinMatcher], Stop: [ajeno] } }), V, true);
  assert.deepEqual(p.faltan, ['hook-contexto', 'hook-handoff']);
  const h = JSON.parse(p.texto).hooks;
  assert.deepEqual(h.UserPromptSubmit, [ajeno, rara, rota, { hooks: [hook(CMD_CONTEXTO)] }]);
  assert.deepEqual(h.SessionStart, [sinMatcher, { matcher: 'compact', hooks: [hook(CMD_HANDOFF)] }]);
  assert.deepEqual(h.Stop, [ajeno]);
  const conMatcher = planear(json({ env: { [VARIABLE]: '300000' }, hooks: { UserPromptSubmit: [{ matcher: 'x', hooks: [hook('otro'), hook(CMD_CONTEXTO)] }], SessionStart: [{ matcher: 'compact', hooks: [hook(CMD_HANDOFF)] }] } }), V, true);
  assert.equal(conMatcher.accion, 'respetar', 'el mismo comando en una entrada con matcher cuenta');
});

test('planear · sólo cuenta el matcher "compact" exacto: con "compact|startup" agrega el suyo y conserva el otro', () => {
  const o = completo();
  o.hooks.SessionStart = [{ matcher: 'compact|startup', hooks: [hook(CMD_HANDOFF)] }];
  const p = planear(json(o), V, true);
  assert.deepEqual(p.faltan, ['hook-handoff']);
  assert.deepEqual(JSON.parse(p.texto).hooks.SessionStart, [
    { matcher: 'compact|startup', hooks: [hook(CMD_HANDOFF)] },
    { matcher: 'compact', hooks: [hook(CMD_HANDOFF)] },
  ]);
});

test('leerVentana · exige un entero dentro del rango del host, de 100.000 a 1.000.000', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ia-ventana-c-'));
  try {
    const ruta = join(dir, 'c.json');
    const con = (v) => {
      writeFileSync(ruta, JSON.stringify({ contexto: { ventana_max: v } }));
      return ruta;
    };
    assert.equal(leerVentana(con(100000)), 100000);
    assert.equal(leerVentana(con(1000000)), 1000000);
    for (const v of [99999, 1000001, 300000.5, '300000', undefined]) assert.throws(() => leerVentana(con(v)), /^Error: contrato sin contexto\.ventana_max$/u, String(v));
    const conTopes = (v) => {
      writeFileSync(ruta, JSON.stringify({ contexto: { ventana_max: v, tope_orquestador: 120000, tope_subsesion: 60000 } }));
      return ruta;
    };
    assert.throws(() => leerVentana(conTopes(110000)), /^Error: contrato sin contexto\.ventana_max$/u, 'menor que un tope: el guard la rechazaría');
    assert.equal(leerVentana(conTopes(120000)), 120000);
    writeFileSync(ruta, '{ roto');
    assert.throws(() => leerVentana(ruta), /^Error: contrato sin contexto\.ventana_max$/u, 'contrato que no es JSON');
    assert.throws(() => leerVentana(join(dir, 'no-existe.json')), /^Error: contrato sin contexto\.ventana_max$/u, 'contrato ausente');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI · settings.local.json que no se puede leer (es una carpeta) es inválido: sale 1 y no se toca', () => {
  conProyecto((dir, ruta) => {
    mkdirSync(ruta, { recursive: true });
    for (const comando of ['check', 'aplicar']) {
      const r = run([comando, '--proyecto', dir]);
      assert.equal(r.status, 1, comando);
      assert.equal(r.output, 'REJECTED: settings.local.json inválido: no se toca\n', comando);
    }
    assert.deepEqual(readdirSync(ruta), []);
  });
});

test('planear · un hook con el mismo comando y otro type no cuenta: se agrega el propio y el ajeno queda', () => {
  const o = completo();
  o.hooks.UserPromptSubmit = [{ hooks: [{ type: 'otro', command: CMD_CONTEXTO }] }];
  o.hooks.SessionStart = [{ matcher: 'compact', hooks: [{ command: CMD_HANDOFF }] }];
  const p = planear(json(o), V, true);
  assert.deepEqual(p.faltan, ['hook-contexto', 'hook-handoff']);
  const n = JSON.parse(p.texto);
  assert.deepEqual(n.hooks.UserPromptSubmit, [{ hooks: [{ type: 'otro', command: CMD_CONTEXTO }] }, { hooks: [hook(CMD_CONTEXTO)] }]);
  assert.deepEqual(n.hooks.SessionStart, [{ matcher: 'compact', hooks: [{ command: CMD_HANDOFF }] }, { matcher: 'compact', hooks: [hook(CMD_HANDOFF)] }]);
});

test('planear · sin runtime exige y deja sólo la variable', () => {
  assert.equal(planear(json({ env: { [VARIABLE]: '300000' } }), V, false).accion, 'respetar');
  const p = planear(json({ a: 1 }), V, false);
  assert.deepEqual(p.faltan, ['ventana']);
  assert.deepEqual(JSON.parse(p.texto), { a: 1, env: { [VARIABLE]: '300000' } });
});

test('planear · inválido no se toca', () => {
  const invalidos = ['{ // comentario\n "env": {} }', '[]', 'null', '"x"', '{', json({ env: 'x' }), json({ env: [] }), json({ hooks: [] }), json({ hooks: { UserPromptSubmit: {} } }), json({ hooks: { SessionStart: 'x' } })];
  for (const t of invalidos) assert.deepEqual(planear(t, V, true), { accion: 'invalido', texto: null, faltan: [] }, t);
});

test('planear · quita el BOM al leer y conserva CRLF al escribir', () => {
  const crlf = `﻿${json({ a: 1 }).replaceAll('\n', '\r\n')}`;
  const p = planear(crlf, V, false);
  assert.equal(p.accion, 'fijar');
  assert.ok(!p.texto.startsWith('﻿'));
  assert.equal(p.texto, json({ a: 1, env: { [VARIABLE]: '300000' } }).replaceAll('\n', '\r\n'));
  assert.equal(planear(`﻿${json(completo())}`, V, true).accion, 'respetar');
});

test('escribirAtomico · 3 intentos en total; si fallan todos lanza, con el original intacto y sin temporal', () => {
  conProyecto((dir) => {
    const ruta = join(dir, 'a.json');
    writeFileSync(ruta, 'original');
    let intentos = 0;
    let esperas = 0;
    const falla = () => {
      intentos += 1;
      throw Object.assign(new Error('ocupado'), { code: 'EBUSY' });
    };
    assert.throws(() => escribirAtomico(ruta, 'nuevo', { rename: falla, esperar: () => { esperas += 1; } }), /ocupado/u);
    assert.equal(intentos, 3);
    assert.equal(esperas, 2);
    assert.equal(readFileSync(ruta, 'utf8'), 'original');
    assert.deepEqual(readdirSync(dir).filter((f) => f.endsWith('.tmp')), []);
  });
});

test('escribirAtomico · falla dos veces y anda la tercera: escribe; y sin inyectar nada, también', async () => {
  const { renameSync } = await import('node:fs');
  conProyecto((dir) => {
    const ruta = join(dir, 'a.json');
    writeFileSync(ruta, 'original');
    let n = 0;
    const rename = (a, b) => {
      n += 1;
      if (n < 3) throw new Error('ocupado');
      renameSync(a, b);
    };
    escribirAtomico(ruta, 'nuevo', { rename, esperar: () => {} });
    assert.equal(readFileSync(ruta, 'utf8'), 'nuevo');
    escribirAtomico(ruta, 'otro');
    assert.equal(readFileSync(ruta, 'utf8'), 'otro');
    assert.deepEqual(readdirSync(dir).filter((f) => f.endsWith('.tmp')), []);
  });
});

test('CLI aplicar · crea .claude/ y deja las tres cosas; check pasa después y aplicar de nuevo no cambia los bytes', () => {
  conProyecto((dir, ruta) => {
    assert.equal(run(['check', '--proyecto', dir]).status, 1);
    const r = run(['aplicar', '--proyecto', dir]);
    assert.equal(r.status, 0, r.output);
    const texto = readFileSync(ruta, 'utf8');
    assert.equal(texto, json(completo()));
    assert.equal(run(['check', '--proyecto', dir]).status, 0);
    assert.equal(run(['aplicar'], { cwd: dir }).status, 0, 'por defecto usa la carpeta actual');
    assert.equal(readFileSync(ruta, 'utf8'), texto);
  });
});

test('CLI check · sale 1 y nombra lo que falta, sea cual sea de las tres', () => {
  const casos = { ventana: (o) => delete o.env[VARIABLE], 'hook-contexto': (o) => delete o.hooks.UserPromptSubmit, 'hook-handoff': (o) => delete o.hooks.SessionStart };
  for (const [nombre, quitar] of Object.entries(casos)) {
    const o = completo();
    quitar(o);
    conProyecto((dir, ruta) => {
      const r = run(['check', '--proyecto', dir]);
      assert.equal(r.status, 1, nombre);
      assert.match(r.output, new RegExp(`REJECTED: falta ${nombre}\\b`, 'u'));
      assert.equal(readFileSync(ruta, 'utf8'), json(o), 'check no escribe');
    }, { settings: json(o) });
  }
});

test('CLI · sin runtime deja sólo la variable, lo dice, y check sale 0', () => {
  conProyecto((dir, ruta) => {
    const r = run(['aplicar', '--proyecto', dir]);
    assert.equal(r.status, 0, r.output);
    assert.match(r.output, /hooks: sin runtime instalado, no se registran/u);
    assert.deepEqual(JSON.parse(readFileSync(ruta, 'utf8')), { env: { [VARIABLE]: '300000' } });
    for (const comando of ['check', 'aplicar']) {
      const ya = run([comando, '--proyecto', dir]);
      assert.equal(ya.status, 0, comando);
      assert.match(ya.output, /^OK: ventana y hooks en su lugar .*\nhooks: sin runtime instalado, no se registran/u, `${comando} sin nada que escribir también lo dice`);
    }
  }, { runtime: false });
  conProyecto((dir) => {
    const falta = run(['check', '--proyecto', dir]);
    assert.equal(falta.status, 1);
    assert.doesNotMatch(falta.output, /sin runtime instalado/u, 'un check que rechaza sólo dice qué falta');
  }, { runtime: false });
  conProyecto((dir) => {
    assert.doesNotMatch(run(['aplicar', '--proyecto', dir]).output, /sin runtime instalado/u, 'con runtime la línea no sale');
  });
});

test('CLI · "500000" pasa a "300000", "200000" queda, y un JSON con comentarios sale 1 con los bytes intactos', () => {
  conProyecto((dir, ruta) => {
    assert.equal(run(['aplicar', '--proyecto', dir]).status, 0);
    assert.equal(JSON.parse(readFileSync(ruta, 'utf8')).env[VARIABLE], '300000');
  }, { runtime: false, settings: json({ env: { [VARIABLE]: '500000' } }) });
  conProyecto((dir, ruta) => {
    assert.equal(run(['aplicar', '--proyecto', dir]).status, 0);
    assert.equal(readFileSync(ruta, 'utf8'), json({ env: { [VARIABLE]: '200000' } }));
  }, { runtime: false, settings: json({ env: { [VARIABLE]: '200000' } }) });
  const roto = '{\n  // mío\n  "env": {}\n}\n';
  conProyecto((dir, ruta) => {
    for (const comando of ['aplicar', 'check']) {
      const r = run([comando, '--proyecto', dir]);
      assert.equal(r.status, 1, comando);
      assert.match(r.output, /settings\.local\.json inválido: no se toca/u);
    }
    assert.equal(readFileSync(ruta, 'utf8'), roto);
  }, { settings: roto });
});

test('main aplicar · si el renombrado falla siempre devuelve 1 con el mensaje y deja el original intacto', (t) => {
  conProyecto((dir) => {
    const ruta = join(dir, '.claude', 'settings.local.json');
    const antes = readFileSync(ruta, 'utf8');
    const errores = t.mock.method(console, 'error', () => {});
    const falla = () => {
      throw Object.assign(new Error('ocupado'), { code: 'EBUSY' });
    };
    const codigo = main(['aplicar', '--proyecto', dir], { escribir: (r, texto) => escribirAtomico(r, texto, { rename: falla, esperar: () => {} }) });
    assert.equal(codigo, 1);
    assert.deepEqual(errores.mock.calls.map((c) => c.arguments[0]), ['REJECTED: no se pudo escribir settings.local.json']);
    assert.equal(readFileSync(ruta, 'utf8'), antes);
    assert.deepEqual(readdirSync(join(dir, '.claude')), ['settings.local.json']);
  }, { settings: '{}\n' });
});

test('CLI aplicar · si no puede crear .claude/ sale 1 con el mismo mensaje, sin temporal y sin tocar lo que había', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ia-ventana-'));
  try {
    mkdirSync(join(dir, '.ia-stack'));
    writeFileSync(join(dir, '.claude'), 'no soy una carpeta');
    const r = run(['aplicar', '--proyecto', dir]);
    assert.equal(r.status, 1, r.output);
    assert.match(r.output, /REJECTED: no se pudo escribir settings\.local\.json/u);
    assert.equal(readFileSync(join(dir, '.claude'), 'utf8'), 'no soy una carpeta');
    assert.deepEqual(readdirSync(dir).filter((f) => f.endsWith('.tmp')), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI · la carpeta personal y una carpeta que no es proyecto salen 2; el mal uso también', () => {
  const casa = mkdtempSync(join(tmpdir(), 'ia-casa-'));
  const suelta = mkdtempSync(join(tmpdir(), 'ia-suelta-'));
  try {
    mkdirSync(join(casa, '.git'));
    const r = run(['aplicar', '--proyecto', casa], { env: { HOME: casa, USERPROFILE: casa } });
    assert.equal(r.status, 2, r.output);
    assert.equal(r.output, 'ventana: --proyecto no es un proyecto\n');
    assert.equal(existsSync(join(casa, '.claude')), false);
    const s = run(['aplicar', '--proyecto', suelta]);
    assert.equal(s.status, 2);
    assert.equal(s.output, 'ventana: --proyecto no es un proyecto\n');
    assert.equal(run(['aplicar', '--proyecto', join(suelta, 'no-existe')]).status, 2);
  } finally {
    rmSync(casa, { recursive: true, force: true });
    rmSync(suelta, { recursive: true, force: true });
  }
  for (const args of [[], ['otro'], ['check', '--raro'], ['aplicar', '--proyecto']]) assert.equal(run(args).status, 2, args.join(' '));
});

test('mismaCarpeta · en Windows no distingue mayúsculas; en las demás plataformas sí', () => {
  assert.equal(mismaCarpeta('C:\\Users\\Ana', 'c:\\users\\ANA', 'win32'), true);
  assert.equal(mismaCarpeta('C:\\Users\\Ana', 'C:\\Users\\Ana2', 'win32'), false);
  assert.equal(mismaCarpeta('/home/Ana', '/home/ana', 'linux'), false);
  assert.equal(mismaCarpeta('/home/ana', '/home/ana', 'darwin'), true);
});

test('CLI · con el contrato sin ventana_max, o que no es JSON, sale 1 con el mensaje fijo y no escribe', () => {
  const root = mkdtempSync(join(tmpdir(), 'ia-ventana-cli-'));
  try {
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'contracts'));
    const copia = join(root, 'scripts', 'ventana.mjs');
    copyFileSync(script, copia);
    for (const contrato of [JSON.stringify({ contexto: {} }), '{ roto']) {
      writeFileSync(join(root, 'contracts', 'model-routing.json'), contrato);
      conProyecto((dir) => {
        for (const comando of ['check', 'aplicar']) {
          const r = spawnSync(process.execPath, [copia, comando, '--proyecto', dir], { encoding: 'utf8' });
          assert.equal(r.status, 1, comando);
          assert.equal(`${r.stdout}${r.stderr}`, 'REJECTED: contrato sin contexto.ventana_max\n', comando);
        }
        assert.equal(existsSync(join(dir, '.claude')), false);
      });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('el gate 6 nombra ventana.mjs y handoff.mjs, e INSTALL.md la bandera y el archivo', () => {
  const gates = JSON.parse(readFileSync(join(raiz, 'contracts', 'gates.json'), 'utf8'));
  const seis = (gates.gates ?? gates).find((g) => g.n === 6);
  const texto = JSON.stringify(seis);
  assert.ok(texto.includes('ventana.mjs') && texto.includes('handoff.mjs'), texto);
  const install = readFileSync(join(raiz, 'INSTALL.md'), 'utf8');
  for (const pedazo of ['--sin-ventana', '-SinVentana', '.claude/settings.local.json', 'ventana.mjs aplicar']) assert.ok(install.includes(pedazo), pedazo);
  assert.doesNotMatch(install, /se agrega a mano/u);
});
