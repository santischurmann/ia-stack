#!/usr/bin/env node
// tablero-servidor.mjs — el tablero servido en localhost, para verlo sin regenerar.
//
// QUE ES, Y QUE NO. Es la mitad "servida" del tablero: `tablero.mjs build` escribe un archivo que se
// abre con doble clic y se archiva; esto levanta un servidor local que arma la pagina en cada pedido
// y no escribe nada. Los dos leen el MISMO modelo, asi que no pueden divergir en lo que muestran.
//
// LA SUPERFICIE MAS DELICADA DEL PROTOCOLO, y por eso las cuatro reglas duras:
//
//   1. ESCUCHA SOLO EN LOOPBACK. El bind es a 127.0.0.1 explicito, nunca 0.0.0.0. Este tablero
//      agrega datos de TODOS los proyectos de la maquina: en la red de una oficina o un cafe,
//      0.0.0.0 se los publica a cualquiera del wifi. Una prueba afirma la constante.
//   2. NO SIRVE ARCHIVOS DEL DISCO. Responde HTML armado en memoria y nada mas. No hay lector de
//      archivos, asi que no hay recorrido de rutas posible -- no es un filtro que haya que
//      mantener, es una capacidad que no existe.
//   3. NO ESCRIBE NADA. Solo GET; todo metodo que pueda mutar se rechaza con 405.
//   4. EL PUERTO OCUPADO ES UN ERROR. No salta a otro en silencio: saltar dejaria el tablero en un
//      puerto que nadie sabe cual es, o serviria sobre uno que ya usa otra cosa.
//
// LO QUE NO PUEDE HACER, dicho de frente:
//   - No autentica a nadie. Cualquier proceso de TU maquina puede leerlo mientras corre. Loopback no
//     es una frontera de confianza entre usuarios de la misma computadora.
//   - Reconstruye el modelo en cada pedido: no hay cache. Sobre muchas transcripciones cada recarga
//     cuesta lo que cuesta leerlas.
//   - Muestra lo que las transcripciones dicen. No sabe si el trabajo sirvio: cuenta actividad.

import { createServer } from 'node:http';

import { homedir } from 'node:os';
import { join } from 'node:path';

import { construirModelo } from './tablero.mjs';
import { renderizar } from './tablero-modelo.mjs';

export const USAGE = 'usage: tablero-servidor.mjs serve [--port <n>]';
/** Loopback explicito. Cambiar esto publica los proyectos de la maquina a la red: hay una prueba que
 * afirma este valor justamente para que el cambio no pase inadvertido. */
export const DIRECCION = '127.0.0.1';
export const PUERTO = 7373;

export function parseArguments(args) {
  if (args[0] !== 'serve') return null;
  if (args.length === 1) return { accion: 'serve', puerto: PUERTO };
  if (args.length !== 3 || args[1] !== '--port') return null;
  // El puerto 0 le pide al sistema uno al azar: el tablero quedaria escuchando donde nadie sabe.
  if (!/^\d+$/u.test(args[2])) return null;
  const puerto = Number(args[2]);
  if (puerto < 1 || puerto > 65535) return null;
  return { accion: 'serve', puerto };
}

/** El manejador, con el modelo INYECTADO: asi se prueba entero sin abrir un socket. */
export function manejar(req, res, obtenerModelo) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('sólo GET: este tablero no escribe nada');
    return;
  }
  // Una sola ruta. No hay `else` que sirva archivos, y esa ausencia es la garantia.
  if (req.url !== '/') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('no encontrado: este servidor sirve una sola página, no archivos del disco');
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    // Sin cache: el sentido de servirlo es ver el estado de ahora al recargar.
    'Cache-Control': 'no-store',
  });
  res.end(`<!doctype html><meta charset="utf-8"><title>Tablero de ia-stack</title>${renderizar(obtenerModelo())}`);
}

export function main(args = process.argv.slice(2), write = console.log, writeError = console.error, io = {}) {
  const parsed = parseArguments(args);
  if (parsed === null) { writeError(USAGE); return 2; }
  // La MISMA raiz que usa `build`: las transcripciones del agente. Sin esto el servidor leia el
  // directorio de trabajo y devolvia un tablero vacio que parecia correcto.
  const raiz = io.raizProyectos ?? join(io.casa ?? homedir(), '.claude', 'projects');
  // La fecha se calcula EN CADA PEDIDO, no al arrancar: un servidor que queda abierto de un dia
  // para el otro seguiria sellando la pagina con la fecha en que se levanto. Sin esto salia
  // '(sin fecha)' arriba de datos frescos, que es peor que no poner nada.
  const { crear = createServer, obtenerModelo = () => construirModelo(raiz, { ...io, hoy: io.hoy ?? new Date().toISOString().slice(0, 10) }) } = io;
  const servidor = crear((req, res) => manejar(req, res, obtenerModelo));
  servidor.on('error', (error) => {
    writeError(error.code === 'EADDRINUSE'
      ? `REJECTED: el puerto ${parsed.puerto} ya está ocupado. Elegí otro con --port; el tablero no salta a uno distinto por su cuenta, porque quedaría escuchando donde nadie sabe.`
      : `REJECTED: no se pudo abrir el servidor: ${error.message}`);
    process.exitCode = 1;
  });
  servidor.listen(parsed.puerto, DIRECCION, () => {
    write(`Tablero en http://${DIRECCION}:${parsed.puerto} — Ctrl+C para cortar.`);
    write('LÍMITE: escucha sólo en loopback y no autentica a nadie: cualquier proceso de esta máquina puede leerlo mientras corre.');
  });
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('tablero-servidor.mjs')) {
  process.exitCode = main();
}
