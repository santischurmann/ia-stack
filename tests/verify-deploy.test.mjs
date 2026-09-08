// La fase 8 dejó de ser «git commit + git push + un zip».
//
// LA HERIDA. «Deploy» en VCP significaba commitear, pedir permiso para pushear, etiquetar y armar
// un zip. En las 1857 líneas del maestro **no existía ningún concepto de host, runtime, preview,
// health check ni endpoint**: el receipt certifica que el árbol commiteado es el revisado, no que
// la cosa arranque. Y tres cosas más quedaban afuera:
//
//   - La auditoría de secretos corre en 6.2, y la 8 no la re-corre: un secreto que entra en un fix
//     de 6.3, de 6.4 o en el refactor de la fase 7 **no lo mira nadie**.
//   - `verify-scope-diff` no ve lo que Git ignora, y eso está declarado como límite honesto: «un
//     .env con un secreto no lo mira ningún gate del protocolo».
//   - `rollback` aparecía tres veces en el protocolo y **ninguna dentro de la fase 8**.
//
// LO QUE ESTE GATE NO HACE, y es una decisión y no un olvido: **no audita dependencias**. VCP no
// tiene SCA y ese límite está pineado; proponer uno sería romper la promesa o mentir. Lo que hace
// es DECLARAR el inventario, para que «nadie auditó» sea visible en vez de leerse como limpio.
//
// Y NUNCA SALE A INTERNET: el host tiene que resolver a loopback ANTES de conectar. No es una
// promesa en un comentario, es un rechazo.

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

import {
  DESTRUCTIVE_ROLLBACK, EMPTY_PREFIX, LOOPBACK_CODE, NO_INPUTS_CODE, SCHEMA,
  STATUS_BEFORE_BODY_CODE, USAGE,
  deployPath, isLoopback, judgeProbe, main, validateDeploy,
} from '../scripts/verify-deploy.mjs';

function expediente(overrides = {}) {
  return {
    schema: SCHEMA,
    feature: 'demo',
    date: '2026-09-08',
    dependencies: {
      manifest: 'package.json',
      lockfile_sha256: 'ninguno — este proyecto no tiene lockfile: es Node nativo sin dependencias',
      count: 0,
      audited_by: 'ninguno — VCP no trae SCA y su límite está declarado; nadie auditó esto',
    },
    ignored_sensitive: [],
    service: { declared: false, start_command: [], base_url: '', health: [] },
    rollback_command: 'git revert 0123456789abcdef0123456789abcdef01234567',
    rollback_tested: { when: '2026-09-08', evidence: 'git revert --no-commit y git reset --hard: el árbol volvió al sha anterior' },
    ...overrides,
  };
}

test('el expediente vive junto a la feature', () => {
  assert.equal(deployPath('mi-feature').replaceAll('\\', '/'), 'docs/deploy/mi-feature.json');
});

// --- Reversión escrita, con la misma prohibición que la fase 9 ya tiene ------------------------

test('un expediente completo pasa', () => {
  assert.deepEqual(validateDeploy(expediente()), []);
});

test('LA REGLA · el comando de vuelta atrás no puede borrar', () => {
  assert.ok(DESTRUCTIVE_ROLLBACK.length >= 4, 'la lista de verbos destructivos no puede venir vacía');
  for (const verbo of DESTRUCTIVE_ROLLBACK) {
    const roto = expediente({ rollback_command: `${verbo} algo` });
    assert.ok(validateDeploy(roto).some((v) => /rollback_command/u.test(v)), `aceptó «${verbo}»`);
  }
});

test('FALSIFICACIÓN · sin comando de vuelta atrás, o sin haberlo probado, no se promueve', () => {
  assert.ok(validateDeploy(expediente({ rollback_command: '' })).some((v) => /rollback_command/u.test(v)));
  assert.ok(validateDeploy(expediente({ rollback_tested: { when: '2026-09-08', evidence: '' } })).some((v) => /rollback_tested/u.test(v)));
});

// --- Dependencias: se declara el inventario, no se audita --------------------------------------

test('«nadie auditó» se admite CON motivo, y a secas no', () => {
  assert.deepEqual(validateDeploy(expediente()), []);
  const pelado = expediente();
  pelado.dependencies.audited_by = 'ninguno';
  assert.ok(validateDeploy(pelado).some((v) => /audited_by/u.test(v)));
});

test('FALSIFICACIÓN · el conteo de dependencias es un número, no una impresión', () => {
  const raro = expediente();
  raro.dependencies.count = 'unas cuantas';
  assert.ok(validateDeploy(raro).some((v) => /count/u.test(v)));
});

// --- Lo que Git ignora y parece sensible se reporta, sin leerlo --------------------------------

test('un ignorado sensible se declara con su motivo; sin motivo rechaza', () => {
  const conMotivo = expediente({ ignored_sensitive: [{ path: '.env', why: 'variables locales de desarrollo, ningún secreto real' }] });
  assert.deepEqual(validateDeploy(conMotivo), []);
  const sinMotivo = expediente({ ignored_sensitive: [{ path: '.env', why: '' }] });
  assert.ok(validateDeploy(sinMotivo).some((v) => /ignored_sensitive/u.test(v)));
});

// --- Nunca internet: es un chequeo, no una promesa ---------------------------------------------

test('sólo loopback: cualquier otro host se rechaza ANTES de conectar', () => {
  for (const url of ['http://127.0.0.1:3000', 'http://localhost:8080', 'http://[::1]:3000', 'http://127.0.0.5:1']) {
    assert.equal(isLoopback(url), true, url);
  }
  for (const url of ['http://example.com', 'https://staging.mi-app.com', 'http://192.168.0.10:3000', 'http://0.0.0.0:3000', 'no es una url']) {
    assert.equal(isLoopback(url), false, url);
  }
});

test('FALSIFICACIÓN · un servicio declarado contra un host remoto rechaza con su código', () => {
  const remoto = expediente({ service: { declared: true, start_command: ['node', 'server.mjs'], base_url: 'https://staging.mi-app.com', health: [{ path: '/health', expect_status: 200, expect_body: null }] } });
  assert.ok(validateDeploy(remoto).some((v) => v.includes(LOOPBACK_CODE)));
});

test('un servicio declarado en loopback, con sus rutas de salud, pasa', () => {
  const local = expediente({ service: { declared: true, start_command: ['node', 'server.mjs'], base_url: 'http://127.0.0.1:3000', health: [{ path: '/health', expect_status: 200, expect_body: 'ok' }] } });
  assert.deepEqual(validateDeploy(local), []);
});

test('FALSIFICACIÓN · un servicio declarado sin comando de arranque o sin rutas de salud no se puede comprobar', () => {
  const sinComando = expediente({ service: { declared: true, start_command: [], base_url: 'http://127.0.0.1:3000', health: [{ path: '/health', expect_status: 200, expect_body: null }] } });
  assert.ok(validateDeploy(sinComando).some((v) => /start_command/u.test(v)));
  const sinRutas = expediente({ service: { declared: true, start_command: ['node', 'x.mjs'], base_url: 'http://127.0.0.1:3000', health: [] } });
  assert.ok(validateDeploy(sinRutas).some((v) => /health/u.test(v)));
});

// --- LA REGLA DE LA ETAPA 1, APLICADA DONDE NACIO -----------------------------------------------
//
// El estado precede al contenido. Un 404 tiene cuerpo, y ese cuerpo tampoco trae lo que la prueba
// dice no encontrar: si el status no es el esperado, el veredicto es rechazo aunque el cuerpo
// coincida.

test('LA REGLA · el estado precede al contenido: un 404 no compra verde aunque el cuerpo coincida', () => {
  const esperado = { path: '/health', expect_status: 200, expect_body: 'ok' };
  const veredicto = judgeProbe(esperado, { status: 404, body: 'ok' });
  assert.equal(veredicto.ok, false);
  assert.equal(veredicto.status_matched, false);
  assert.equal(veredicto.body_matched, true, 'el cuerpo coincidía, y por eso este caso es el peligroso');
  assert.match(veredicto.reason, new RegExp(STATUS_BEFORE_BODY_CODE, 'u'));
});

test('con el estado y el cuerpo esperados, el veredicto es verde y los dos campos quedan separados', () => {
  const veredicto = judgeProbe({ path: '/health', expect_status: 200, expect_body: 'ok' }, { status: 200, body: 'todo ok acá' });
  assert.deepEqual({ ok: veredicto.ok, status_matched: veredicto.status_matched, body_matched: veredicto.body_matched }, { ok: true, status_matched: true, body_matched: true });
});

test('sin cuerpo esperado alcanza con el estado, y un cuerpo que no coincide rechaza', () => {
  assert.equal(judgeProbe({ path: '/x', expect_status: 204, expect_body: null }, { status: 204, body: '' }).ok, true);
  const malCuerpo = judgeProbe({ path: '/x', expect_status: 200, expect_body: 'listo' }, { status: 200, body: 'otra cosa' });
  assert.equal(malCuerpo.ok, false);
  assert.equal(malCuerpo.status_matched, true);
  assert.equal(malCuerpo.body_matched, false);
});

// --- El CLI ------------------------------------------------------------------------------------

function io(doc) {
  return { hay: () => doc !== undefined, leer: () => JSON.stringify(doc) };
}

test('sin expediente escribe VACÍO y sale 0; con --require-inputs pasa a rechazo', () => {
  const dichos = [];
  assert.equal(main(['check', '--feature', 'demo'], (m) => dichos.push(m), () => {}, io(undefined)), 0);
  assert.ok(dichos[0].startsWith(EMPTY_PREFIX));
  const errores = [];
  assert.equal(main(['check', '--feature', 'demo', '--require-inputs'], () => {}, (m) => errores.push(m), io(undefined)), 1);
  assert.match(errores.join('\n'), new RegExp(NO_INPUTS_CODE, 'u'));
});

test('con el expediente completo sale 0 y dice su límite', () => {
  const dichos = [];
  assert.equal(main(['check', '--feature', 'demo'], (m) => dichos.push(m), () => {}, io(expediente())), 0);
  assert.ok(dichos.some((d) => d.startsWith('OK: ')), dichos.join(' | '));
  assert.ok(dichos.some((d) => /no audita dependencias/iu.test(d)));
});

test('FALSIFICACIÓN · un expediente inválido rechaza nombrando el campo', () => {
  const errores = [];
  assert.equal(main(['check', '--feature', 'demo'], () => {}, (m) => errores.push(m), io(expediente({ rollback_command: 'rm -rf dist' }))), 1);
  assert.match(errores.join('\n'), /rollback_command/u);
});

test('un expediente ilegible se rechaza como roto, no como ausente', () => {
  const errores = [];
  assert.equal(main(['check', '--feature', 'demo'], () => {}, (m) => errores.push(m), { hay: () => true, leer: () => '{ roto' }), 1);
  assert.match(errores.join('\n'), /no se pudo leer/u);
});

test('un uso incorrecto sale 2', () => {
  const errores = [];
  assert.equal(main(['inesperado'], () => {}, (m) => errores.push(m)), 2);
  assert.deepEqual(errores, [USAGE]);
  assert.equal(main(['check'], () => {}, () => {}), 2);
  assert.equal(main(['check', '--feature', 'MAL'], () => {}, () => {}), 2);
});

// --- La sonda contra un servidor de verdad, en loopback ----------------------------------------

test('health comprueba contra un servidor real en 127.0.0.1 y separa estado de contenido', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('ok');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const base = `http://127.0.0.1:${port}`;
    const doc = expediente({ service: { declared: true, start_command: ['noop'], base_url: base, health: [{ path: '/health', expect_status: 200, expect_body: 'ok' }] } });
    const dichos = [];
    assert.equal(await main(['health', '--feature', 'demo'], (m) => dichos.push(m), () => {}, io(doc)), 0, dichos.join('\n'));

    // La misma ruta rota: el cuerpo sigue diciendo «ok» y el status es 404. Tiene que rechazar.
    const roto = expediente({ service: { declared: true, start_command: ['noop'], base_url: base, health: [{ path: '/no-existe', expect_status: 200, expect_body: 'ok' }] } });
    const errores = [];
    assert.equal(await main(['health', '--feature', 'demo'], () => {}, (m) => errores.push(m), io(roto)), 1);
    assert.match(errores.join('\n'), new RegExp(STATUS_BEFORE_BODY_CODE, 'u'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('health sin servicio declarado no aplica, y lo dice con la evidencia de la detección', async () => {
  const dichos = [];
  assert.equal(await main(['health', '--feature', 'demo'], (m) => dichos.push(m), () => {}, io(expediente())), 0);
  assert.match(dichos.join('\n'), /no aplica/iu);
});

test('FALSIFICACIÓN · health contra un host que no es loopback rechaza sin conectar', async () => {
  const errores = [];
  const remoto = expediente({ service: { declared: true, start_command: ['noop'], base_url: 'https://staging.mi-app.com', health: [{ path: '/health', expect_status: 200, expect_body: null }] } });
  assert.equal(await main(['health', '--feature', 'demo'], () => {}, (m) => errores.push(m), io(remoto)), 1);
  assert.match(errores.join('\n'), new RegExp(LOOPBACK_CODE, 'u'));
});

test('FALSIFICACIÓN · un servicio declarado que no responde BLOQUEA: nunca «no aplica»', async () => {
  const errores = [];
  // Puerto cerrado a propósito: el servicio está declarado y no arranca.
  const caido = expediente({ service: { declared: true, start_command: ['noop'], base_url: 'http://127.0.0.1:1', health: [{ path: '/health', expect_status: 200, expect_body: null }] } });
  assert.equal(await main(['health', '--feature', 'demo'], () => {}, (m) => errores.push(m), io(caido)), 1);
  assert.match(errores.join('\n'), /no respondió|ECONNREFUSED|no se pudo/iu);
});

// --- Los bordes: basura por la puerta, y ninguna rama sin ejercitar ----------------------------

test('el expediente rechaza lo que no es un objeto, y cada bloque ausente se nombra', () => {
  for (const basura of [null, 'texto', [], 7]) assert.equal(validateDeploy(basura).length, 1, String(basura));
  const vacio = { schema: 'otro', feature: 'MAL', date: 'ayer' };
  const violaciones = validateDeploy(vacio);
  for (const campo of ['schema', 'feature', 'date', 'dependencies', 'ignored_sensitive', 'service.declared', 'rollback_command', 'rollback_tested']) {
    assert.ok(violaciones.some((v) => v.includes(campo)), `no nombró ${campo}: ${violaciones.join(' | ')}`);
  }
});

test('cada campo declarable rechaza el relleno por separado', () => {
  for (const campo of ['manifest', 'lockfile_sha256', 'audited_by']) {
    const roto = expediente();
    roto.dependencies[campo] = 'n/a';
    assert.ok(validateDeploy(roto).some((v) => v.includes(campo)), campo);
    const vacio = expediente();
    vacio.dependencies[campo] = '';
    assert.ok(validateDeploy(vacio).some((v) => v.includes(campo)), `${campo} vacío`);
  }
});

test('ignored_sensitive tiene que ser una lista, y una entrada mal formada se nombra', () => {
  assert.ok(validateDeploy(expediente({ ignored_sensitive: 'no es lista' })).some((v) => /ignored_sensitive/u.test(v)));
  assert.ok(validateDeploy(expediente({ ignored_sensitive: [null] })).some((v) => /ignored_sensitive/u.test(v)));
});

test('las rutas de salud se validan una por una', () => {
  const sinRuta = expediente({ service: { declared: true, start_command: ['x'], base_url: 'http://127.0.0.1:1', health: [{ expect_status: 200 }] } });
  assert.ok(validateDeploy(sinRuta).some((v) => /health\[0\]\.path/u.test(v)));
  const sinEstado = expediente({ service: { declared: true, start_command: ['x'], base_url: 'http://127.0.0.1:1', health: [{ path: '/x' }] } });
  assert.ok(validateDeploy(sinEstado).some((v) => /expect_status/u.test(v)));
  const listaRara = expediente({ service: { declared: true, start_command: ['x'], base_url: 'http://127.0.0.1:1', health: 'no es lista' } });
  assert.ok(validateDeploy(listaRara).some((v) => /health/u.test(v)));
});

test('el veredicto de una sonda sin cuerpo esperado no inventa una coincidencia', () => {
  assert.equal(judgeProbe({ path: '/x', expect_status: 200 }, { status: 200 }).body_matched, true);
  assert.equal(judgeProbe({ path: '/x', expect_status: 200, expect_body: 'z' }, { status: 200 }).body_matched, false);
});

test('sin `leer` inyectado usa el sistema de archivos real', () => {
  const errores = [];
  assert.equal(main(['check', '--feature', 'una-feature-que-no-existe'], () => {}, (m) => errores.push(m), { hay: () => true }), 1);
  assert.match(errores.join('\n'), /no se pudo leer/u);
});

test('FALSIFICACIÓN · las banderas del CLI son cerradas y necesitan valor', () => {
  assert.equal(main(['check', '--feature'], () => {}, () => {}), 2);
  assert.equal(main(['check', '--feature', '--require-inputs'], () => {}, () => {}), 2);
  assert.equal(main(['check', '--desconocida', 'x'], () => {}, () => {}), 2);
});

test('health con --require-inputs y sin expediente también frena', async () => {
  const errores = [];
  assert.equal(await main(['health', '--feature', 'demo', '--require-inputs'], () => {}, (m) => errores.push(m), io(undefined)), 1);
  assert.match(errores.join('\n'), new RegExp(NO_INPUTS_CODE, 'u'));
});

test('health sobre un expediente inválido frena antes de tocar la red', async () => {
  const errores = [];
  assert.equal(await main(['health', '--feature', 'demo'], () => {}, (m) => errores.push(m), io(expediente({ rollback_command: '' }))), 1);
  assert.match(errores.join('\n'), /rollback_command/u);
});

test('la sonda real corta por timeout en vez de colgarse, y eso bloquea', async () => {
  const errores = [];
  const colgado = expediente({ service: { declared: true, start_command: ['x'], base_url: 'http://127.0.0.1:9', health: [{ path: '/x', expect_status: 200, expect_body: null }] } });
  const salida = await main(['health', '--feature', 'demo'], () => {}, (m) => errores.push(m), {
    ...io(colgado),
    pedir: () => Promise.reject(new Error('timeout')),
  });
  assert.equal(salida, 1);
  assert.match(errores.join('\n'), /no respondió/u);
});

test('un expediente sin feature ni fecha ni base_url no rompe: cada ausencia se nombra', () => {
  const violaciones = validateDeploy({ schema: SCHEMA, service: { declared: true, start_command: [], health: [] } });
  for (const campo of ['feature', 'date', 'base_url']) {
    assert.ok(violaciones.some((v) => v.includes(campo)), `no nombró ${campo}`);
  }
});

test('con estado Y cuerpo equivocados, el motivo no dice que el cuerpo coincidía', () => {
  const veredicto = judgeProbe({ path: '/x', expect_status: 200, expect_body: 'ok' }, { status: 500, body: 'boom' });
  assert.equal(veredicto.ok, false);
  assert.equal(veredicto.body_matched, false);
  assert.doesNotMatch(veredicto.reason, /el cuerpo coincidía/u);
});

test('check con un servicio declarado nombra cuántas comprobaciones de salud tiene', () => {
  const dichos = [];
  const conServicio = expediente({ service: { declared: true, start_command: ['node', 'x.mjs'], base_url: 'http://127.0.0.1:3000', health: [{ path: '/health', expect_status: 200, expect_body: null }] } });
  assert.equal(main(['check', '--feature', 'demo'], (m) => dichos.push(m), () => {}, io(conServicio)), 0, dichos.join('\n'));
  assert.match(dichos.join('\n'), /1 comprobación\(es\) de salud en loopback/u);
});

test('un servidor que no contesta nunca corta por timeout en vez de colgar la fase', async () => {
  const server = createServer(() => { /* nunca responde: ni cabecera, ni cuerpo, ni cierre */ });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const colgado = expediente({ service: { declared: true, start_command: ['x'], base_url: `http://127.0.0.1:${port}`, health: [{ path: '/x', expect_status: 200, expect_body: null }] } });
    const errores = [];
    const salida = await main(['health', '--feature', 'demo'], () => {}, (m) => errores.push(m), { ...io(colgado), timeoutMs: 150 });
    assert.equal(salida, 1);
    assert.match(errores.join('\n'), /no respondió/u);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
});

// --- La declaracion de ausencia se invierte contra el arbol ------------------------------------
//
// declaredOrNone acepta «ninguno — motivo» y no compara ese «ninguno» contra nada. Un proyecto con
// package.json a la raiz podia declarar «ninguno — no usamos dependencias» y salir en verde.
// Se invierte: si alguien declara que NO hay manifest, el gate le pregunta AL ARBOL.
//
// Acotado a la RAIZ a proposito: un manifest a nivel raiz nunca es un fixture, y el falso positivo
// medido sobre los 339 archivos versionados de este repositorio es CERO. Bajar a subdirectorios
// encontraria fixtures de prueba y gritaria en falso, que es como muere un gate.

test('INVERSION · declarar que no hay manifest con uno a la raíz rechaza, y lo nombra', () => {
  const sinManifest = expediente();
  sinManifest.dependencies.manifest = 'ninguno — no usamos dependencias';
  const violaciones = validateDeploy(sinManifest, { versionados: ['package.json', 'src/app.mjs'] });
  assert.ok(violaciones.some((v) => v.includes('package.json')), `no lo nombró: ${violaciones.join(' | ')}`);
});

test('FALSIFICACIÓN · un manifest en un subdirectorio NO dispara la inversión', () => {
  const sinManifest = expediente();
  sinManifest.dependencies.manifest = 'ninguno — es Node nativo sin dependencias';
  // Un fixture de prueba con su propio package.json es el caso legítimo que un barrido recursivo
  // marcaría mal. Acá no lo marca.
  assert.deepEqual(validateDeploy(sinManifest, { versionados: ['tests/fixtures/demo/package.json'] }), []);
});

test('sin lista de versionados la inversión no corre, y no inventa un verde ni un rojo', () => {
  const sinManifest = expediente();
  sinManifest.dependencies.manifest = 'ninguno — es Node nativo sin dependencias';
  assert.deepEqual(validateDeploy(sinManifest), []);
});

// --- La huella del lockfile contra el disco, en MODO AVISO --------------------------------------

test('AVISO · la huella declarada que no coincide con el disco se avisa, no bloquea', () => {
  const doc = expediente();
  doc.dependencies.manifest = 'package.json';
  doc.dependencies.lockfile_sha256 = 'f'.repeat(64);
  const avisos = [];
  const salida = main(['check', '--feature', 'demo'], () => {}, (m) => avisos.push(m), {
    ...io(doc),
    versionados: ['package.json', 'package-lock.json'],
    huella: () => 'a'.repeat(64),
  });
  assert.equal(salida, 0, 'la huella que no coincide avisa, no frena: es modo aviso');
  assert.match(avisos.join('\n'), /AVISO/u);
  assert.match(avisos.join('\n'), /a{64}/u, 'tiene que imprimir la huella que calculó');
});

test('con la huella correcta no se avisa nada', () => {
  const doc = expediente();
  doc.dependencies.manifest = 'package.json';
  doc.dependencies.lockfile_sha256 = 'a'.repeat(64);
  const avisos = [];
  assert.equal(main(['check', '--feature', 'demo'], () => {}, (m) => avisos.push(m), {
    ...io(doc), versionados: ['package.json', 'package-lock.json'], huella: () => 'a'.repeat(64),
  }), 0);
  assert.deepEqual(avisos, []);
});

test('cuando el manifest no es una ruta limpia, la huella NO compara y lo dice', () => {
  const doc = expediente();
  doc.dependencies.manifest = 'package.json y pyproject.toml — repo políglota';
  const dichos = [];
  assert.equal(main(['check', '--feature', 'demo'], (m) => dichos.push(m), () => {}, {
    ...io(doc), versionados: ['package.json'], huella: () => 'a'.repeat(64),
  }), 0);
  assert.match(dichos.join('\n'), /no se comparó/iu, 'un no-comparé nunca es un verde silencioso');
});

test('la huella cubre sus caminos: sin lockfile al lado, ilegible, y con «ninguno» declarado', () => {
  const conManifest = (extra = {}) => {
    const d = expediente();
    d.dependencies.manifest = 'package.json';
    Object.assign(d.dependencies, extra);
    return d;
  };

  // Manifest versionado pero sin ningún lockfile al lado: no se compara, y se dice.
  const sinLock = [];
  assert.equal(main(['check', '--feature', 'demo'], (m) => sinLock.push(m), () => {}, {
    ...io(conManifest()), versionados: ['package.json'], huella: () => 'a'.repeat(64),
  }), 0);
  assert.match(sinLock.join('\n'), /no tiene ningún lockfile versionado/u);

  // El lockfile existe en el índice y no se puede leer del disco: tampoco se compara en silencio.
  const ilegible = [];
  assert.equal(main(['check', '--feature', 'demo'], (m) => ilegible.push(m), () => {}, {
    ...io(conManifest()), versionados: ['package.json', 'package-lock.json'], huella: () => null,
  }), 0);
  assert.match(ilegible.join('\n'), /no se pudo leer/u);

  // Con «ninguno — motivo» en el manifest, la huella no tiene nada que comparar y calla.
  const declaradoNinguno = expediente();
  declaradoNinguno.dependencies.manifest = 'ninguno — es Node nativo sin dependencias';
  const callado = [];
  assert.equal(main(['check', '--feature', 'demo'], (m) => callado.push(m), () => {}, {
    ...io(declaradoNinguno), versionados: ['src/app.mjs'], huella: () => 'a'.repeat(64),
  }), 0);
  assert.doesNotMatch(callado.join('\n'), /huella del lockfile/u);
});

test('sin `versionados` ni `huella` inyectados usa git y el disco reales, y no lanza', () => {
  const dichos = [];
  const doc = expediente();
  doc.dependencies.manifest = 'README.md';
  doc.dependencies.lockfile_sha256 = 'b'.repeat(64);
  assert.equal(main(['check', '--feature', 'demo'], (m) => dichos.push(m), () => {}, { hay: () => true, leer: () => JSON.stringify(doc) }), 0);
  assert.match(dichos.join('\n'), /huella del lockfile no se comparó/u, 'README.md no tiene lockfile derivable');
});

test('FALSIFICACIÓN · la huella distingue un final de línea de un contenido distinto', () => {
  const doc = expediente();
  doc.dependencies.manifest = 'package.json';
  doc.dependencies.lockfile_sha256 = 'C'.repeat(64);
  const avisos = [];
  main(['check', '--feature', 'demo'], () => {}, (m) => avisos.push(m), {
    ...io(doc), versionados: ['package.json', 'package-lock.json'], huella: () => 'c'.repeat(64),
  });
  assert.deepEqual(avisos, [], 'la comparación es en minúsculas: una huella en mayúsculas es la misma huella');
});

test('los dos ayudantes de disco y de git no lanzan nunca, y su fallo es «sin dato»', async () => {
  const { listarVersionados, huellaDeArchivo } = await import('../scripts/verify-deploy.mjs');

  assert.deepEqual(listarVersionados(() => 'a.md\n\n b.md \n'), ['a.md', 'b.md']);
  assert.equal(listarVersionados(() => { throw new Error('no es un repo'); }), null,
    'sin git no se inventa ni un verde ni un rojo: la inversión no corre');

  assert.equal(huellaDeArchivo('x', () => Buffer.from('hola')),
    'b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79');
  assert.equal(huellaDeArchivo('x', () => { throw new Error('ENOENT'); }), null);
});

test('un manifest que no es ruta limpia y uno que no está versionado se tratan igual: no se compara', () => {
  const noVersionado = expediente();
  noVersionado.dependencies.manifest = 'package.json';
  const dichos = [];
  assert.equal(main(['check', '--feature', 'demo'], (m) => dichos.push(m), () => {}, {
    ...io(noVersionado), versionados: ['otra/cosa.md'], huella: () => 'a'.repeat(64),
  }), 0);
  assert.match(dichos.join('\n'), /no es una ruta versionada/u);
});
