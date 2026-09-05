// El tablero servido en localhost.
//
// Es la mitad que faltaba del pedido original: además del archivo que se abre con doble clic, un
// servidor local que se recarga sin regenerar. Y es la superficie más delicada del protocolo,
// porque sirve datos agregados de TODOS los proyectos de la máquina.
//
// Las cuatro reglas duras, cada una con su falsificación acá abajo:
//
//   1. ESCUCHA SÓLO EN LOOPBACK. Bind explícito a 127.0.0.1, nunca 0.0.0.0: en una red de trabajo o
//      un café, 0.0.0.0 publica tus proyectos a cualquiera del wifi.
//   2. NO SIRVE ARCHIVOS DEL DISCO. Responde HTML armado en memoria y nada más. Sin lector de
//      archivos no hay recorrido de rutas que valga.
//   3. NO ESCRIBE NADA. Es sólo lectura; el que escribe es `build`.
//   4. EL PUERTO OCUPADO ES UN ERROR, no un salto silencioso a otro. Saltar dejaría el tablero en un
//      puerto que nadie sabe, o peor, serviría sobre un puerto que ya usa otra cosa.

import assert from 'node:assert/strict';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DIRECCION,
  PUERTO,
  USAGE,
  main,
  manejar,
  parseArguments,
} from '../scripts/tablero-servidor.mjs';

const MODELO = {
  generadoEn: '2026-09-05',
  proyectos: [{
    nombre: 'demo', sesiones: 2, turnos: 10, lineasRepetidas: 3,
    tokens: { entrada: 100, salida: 200, cacheLeido: 0, cacheEscrito: 0 },
    modelos: [], horas: { piso: 1, techo: 2, descartado: 0, umbralMinutos: 5, corteMinutos: 120, huecos: 9 },
    dias: [{ dia: '2026-09-05', piso: 1, techo: 2, descartado: 0, umbralMinutos: 5, corteMinutos: 120, huecos: 9 }],
    fases: { ultima: '2', faltan: ['3'], completo: false, cerradas: ['1', '2'] },
    mejoras: { total: 1, abiertas: 1, propuestas: 4, sinCerrar: ['2026-09-05.json'] },
    sesion: { feature: 'demo-feature', estado: 'en progreso' },
  }],
};

function pedir(url, modelo = MODELO) {
  const escrito = { estado: null, cabeceras: null, cuerpo: '' };
  const res = {
    writeHead(estado, cabeceras) { escrito.estado = estado; escrito.cabeceras = cabeceras; },
    end(cuerpo = '') { escrito.cuerpo = cuerpo; },
  };
  manejar({ url, method: 'GET' }, res, () => modelo);
  return escrito;
}

test('la raíz devuelve el tablero armado en memoria', () => {
  const r = pedir('/');
  assert.equal(r.estado, 200);
  assert.match(r.cabeceras['Content-Type'], /text\/html/u);
  assert.match(r.cuerpo, /demo/u);
  assert.match(r.cuerpo, /Tablero/u);
});

test('FALSIFICACIÓN · no sirve archivos del disco: cualquier otra ruta es 404', () => {
  // Sin lector de archivos no hay recorrido de rutas que valga. Se prueban las formas clásicas para
  // que quede escrito que ninguna abre nada, no porque el filtro las liste.
  for (const ruta of ['/../../etc/passwd', '/.env', '/scripts/tablero.mjs', '/%2e%2e/secreto', '/index.html']) {
    const r = pedir(ruta);
    assert.equal(r.estado, 404, `${ruta} tiene que ser 404`);
    assert.doesNotMatch(r.cuerpo, /demo-feature/u, 'una ruta desconocida no filtra datos del modelo');
  }
});

test('FALSIFICACIÓN · sólo responde GET: cualquier método que escriba se rechaza', () => {
  const escrito = { estado: null };
  const res = { writeHead(e) { escrito.estado = e; }, end() {} };
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    manejar({ url: '/', method }, res, () => MODELO);
    assert.equal(escrito.estado, 405, `${method} tiene que rechazar`);
  }
});

test('la dirección de escucha es loopback y nunca todas las interfaces', () => {
  // La regla que más importa: en 0.0.0.0 esto publica los proyectos de la máquina a cualquiera de
  // la red. Se afirma sobre la constante para que cambiarla ponga la suite en rojo.
  assert.equal(DIRECCION, '127.0.0.1');
  assert.notEqual(DIRECCION, '0.0.0.0');
  assert.equal(typeof PUERTO, 'number');
});

test('parseArguments acepta serve con su puerto y rechaza el resto', () => {
  assert.deepEqual(parseArguments(['serve']), { accion: 'serve', puerto: PUERTO });
  assert.deepEqual(parseArguments(['serve', '--port', '8080']), { accion: 'serve', puerto: 8080 });
  assert.equal(parseArguments([]), null);
  assert.equal(parseArguments(['otra']), null);
  assert.equal(parseArguments(['serve', '--port']), null);
  assert.equal(parseArguments(['serve', '--port', 'ochenta']), null);
  assert.equal(parseArguments(['serve', '--port', '0']), null, 'el puerto 0 elegiría uno al azar que nadie sabe');
  assert.equal(parseArguments(['serve', '--port', '99999']), null);
  assert.equal(parseArguments(['serve', '--raro', '1']), null);
});

// --- El arranque del servidor, sin abrir un socket de verdad -------------------------------------
//
// `crear` se inyecta, así que se prueba el ciclo entero —escuchar, informar, fallar— sin ocupar un
// puerto real. Una prueba que abriera puertos sería flaky en cualquier máquina con algo corriendo.

function servidorFalso() {
  const estado = { escuchando: null, manejador: null, errores: {} };
  const servidor = {
    on(evento, cb) { estado.errores[evento] = cb; return servidor; },
    listen(puerto, direccion, cb) { estado.escuchando = { puerto, direccion }; cb(); return servidor; },
  };
  return { estado, crear: (manejador) => { estado.manejador = manejador; return servidor; } };
}

test('main levanta el servidor en loopback y dice dónde, con su límite', () => {
  const { estado, crear } = servidorFalso();
  const salidas = [];
  const codigo = main(['serve', '--port', '9999'], (m) => salidas.push(m), () => {}, { crear, obtenerModelo: () => MODELO });
  assert.equal(codigo, 0);
  assert.deepEqual(estado.escuchando, { puerto: 9999, direccion: DIRECCION });
  assert.match(salidas.join('\n'), /127\.0\.0\.1:9999/u);
  assert.match(salidas.join('\n'), /LÍMITE:/u);
  // El manejador que se le pasó al servidor es el mismo que se prueba arriba.
  const escrito = { estado: null };
  estado.manejador({ url: '/nada', method: 'GET' }, { writeHead(e) { escrito.estado = e; }, end() {} });
  assert.equal(escrito.estado, 404);
});

test('FALSIFICACIÓN · el puerto ocupado es un error con nombre, no un salto silencioso a otro', () => {
  // Saltar a otro puerto dejaría el tablero escuchando donde nadie sabe, o serviría sobre uno que ya
  // usa otra cosa. El mensaje tiene que decir qué hacer.
  const { estado, crear } = servidorFalso();
  const errores = [];
  main(['serve'], () => {}, (m) => errores.push(m), { crear, obtenerModelo: () => MODELO });
  estado.errores.error(Object.assign(new Error('address in use'), { code: 'EADDRINUSE' }));
  assert.match(errores.join('\n'), /ya está ocupado/u);
  assert.match(errores.join('\n'), /--port/u);
  assert.equal(process.exitCode, 1);
  process.exitCode = 0;

  // Cualquier otro fallo del socket también se reporta, sin confundirlo con el puerto ocupado.
  const otro = servidorFalso();
  const otrosErrores = [];
  main(['serve'], () => {}, (m) => otrosErrores.push(m), { crear: otro.crear, obtenerModelo: () => MODELO });
  otro.estado.errores.error(Object.assign(new Error('sin permisos'), { code: 'EACCES' }));
  assert.match(otrosErrores.join('\n'), /no se pudo abrir/u);
  assert.doesNotMatch(otrosErrores.join('\n'), /ocupado/u);
  process.exitCode = 0;
});

test('main sin argumentos válidos imprime el uso y sale 2', () => {
  const errores = [];
  assert.equal(main([], () => {}, (m) => errores.push(m), {}), 2);
  assert.deepEqual(errores, [USAGE]);
});

test('sin modelo inyectado lo construye de la raíz de proyectos, igual que build', () => {
  // El default es el que corre de verdad cuando alguien usa el comando: si nunca se ejercita, la
  // prueba mide un camino que ningún usuario toma. Se le pasa una raíz que no existe para que el
  // modelo salga vacío sin leer nada de la máquina donde corre la suite.
  const { estado, crear } = servidorFalso();
  const codigo = main(['serve'], () => {}, () => {}, { crear, raizProyectos: join(tmpdir(), 'vcp-no-existe-jamas') });
  assert.equal(codigo, 0);
  const escrito = { estado: null, cuerpo: '' };
  estado.manejador({ url: '/', method: 'GET' }, { writeHead(e) { escrito.estado = e; }, end(c) { escrito.cuerpo = c; } });
  assert.equal(escrito.estado, 200);
  assert.match(escrito.cuerpo, /0 proyecto\(s\)|sobre 0/u, 'una raíz inexistente da un tablero vacío, no un error');
});
