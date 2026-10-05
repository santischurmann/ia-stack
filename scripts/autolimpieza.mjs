#!/usr/bin/env node
// autolimpieza.mjs — el ejecutor de la regla de autolimpieza de un proyecto (lote 5, fase 5B).
//
// La regla y su registro los juzga verify-autolimpieza.mjs; este script es lo que ACTÚA, y actúa con la
// misma regla y el mismo código de lectura (importa `cargarContrato` y `juzgarProyecto` del verificador:
// dos juicios distintos sobre el mismo registro serían dos fuentes de verdad).
//
//   listar    <contrato>        qué se movería y por qué se omite el resto. No escribe nada. Es el modo seguro.
//   aplicar   <contrato>        MUEVE cada candidata a la cuarentena y sella una línea en el log.
//   purgar    <contrato>        elimina de verdad lo que ya cumplió su retención, y sólo desde la cuarentena.
//   restaurar <contrato> <item> devuelve un item de la cuarentena a donde estaba.
//
// LO QUE NO HACE, aunque se lo pidan:
//   - borrar de entrada: `aplicar` mueve, nunca elimina;
//   - actuar sobre un registro que el verificador rechaza: un log roto, una cuarentena alterada o que el
//     log no explica son un estado que alguien tiene que mirar, no que se agrava limpiando encima;
//   - tocar una carpeta con una fuente intocable ADENTRO, ni para moverla ni para purgarla: la regla dura
//     de este protocolo es que un fuente sin backup no se pierde por una limpieza, y se aplica aunque
//     el nombre coincida con la categoría;
//   - mover algo demasiado reciente. La edad es la de lo MÁS RECIENTE que hay adentro, no la de la
//     carpeta: una corrida en curso escribe archivos sin cambiar la fecha de su carpeta.
//
// ORDEN DE LAS COSAS, y por qué. Se mueve y DESPUÉS se sella: si el proceso muere entre las dos cosas,
// queda algo en la cuarentena que el log no registra, que el verificador marca y que no perdió nada. Al
// revés quedaría un log que dice haber movido algo que sigue en su lugar. Si sellar falla, se devuelve
// lo movido a su sitio. Y antes de mover NADA se lee el log: uno ilegible aborta sin haber tocado un archivo.
//
// LÍMITE HONESTO. La edad es la de la última modificación: un proceso que tenga abierto un archivo sin
// escribirlo no se ve (en Windows, mover algo en uso falla y esa candidata se queda donde está, que es
// lo que se quiere). No hay exclusión entre dos corridas simultáneas. Una cuarentena en el mismo disco
// no protege de un fallo del disco. Y mover un archivo no prueba que su contenido no importaba.

import { appendFileSync, lstatSync, mkdirSync, readdirSync, renameSync, rmSync, rmdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { sealLineFor } from './verify-audit-chain.mjs';
import { cargarContrato, diasEntre, huellaDeArbol, juzgarProyecto } from './verify-autolimpieza.mjs';

export const USAGE = 'usage: autolimpieza.mjs listar|aplicar|purgar <contrato.json> | autolimpieza.mjs restaurar <contrato.json> <item>';
const ITEM = /^\d{4}-\d{2}-\d{2}-\d{3}$/u;
const HORA_MS = 3_600_000;
const MAX_ITEMS_POR_DIA = 999;

/** La fecha de modificación más reciente de una entrada y de todo lo que tiene adentro. Un enlace no se sigue. */
export function masReciente(ruta, io = {}) {
  const lstat = io.lstat ?? lstatSync;
  const listar = io.readdir ?? readdirSync;
  const propia = lstat(ruta);
  let maximo = propia.mtimeMs;
  if (propia.isDirectory()) {
    for (const nombre of listar(ruta)) maximo = Math.max(maximo, masReciente(join(ruta, nombre), io));
  }
  return maximo;
}

/** La ruta, relativa a `ruta`, de la primera fuente intocable que hay adentro; `null` si no hay ninguna. */
export function contieneIntocable(ruta, intocables, io = {}) {
  const lstat = io.lstat ?? lstatSync;
  const listar = io.readdir ?? readdirSync;
  if (!lstat(ruta).isDirectory()) return intocables.test(basename(ruta)) ? basename(ruta) : null;
  const visitar = (dir, prefijo) => {
    for (const nombre of listar(dir).sort()) {
      const relativa = `${prefijo}${nombre}`;
      const completa = join(dir, nombre);
      if (intocables.test(relativa)) return relativa;
      if (lstat(completa).isDirectory()) {
        const dentro = visitar(completa, `${relativa}/`);
        if (dentro !== null) return dentro;
      }
    }
    return null;
  };
  return visitar(ruta, '');
}

/** El identificador siguiente del día: AAAA-MM-DD-NNN, siguiendo al máximo ya registrado ese día. */
export function siguienteItem(hoy, entradas) {
  let maximo = 0;
  for (const e of entradas) {
    if (e.ok && e.item.startsWith(`${hoy}-`)) maximo = Math.max(maximo, Number(e.item.slice(hoy.length + 1)));
  }
  if (maximo >= MAX_ITEMS_POR_DIA) throw new Error(`ya hay ${MAX_ITEMS_POR_DIA} items el ${hoy}: no hay un identificador siguiente`);
  return `${hoy}-${String(maximo + 1).padStart(3, '0')}`;
}

/** Lo que la regla permite mover ahora, y lo que se omite con su motivo. Sin efectos. */
export function candidatas(contrato, cwd, ahoraMs, intocables, io = {}) {
  const listar = io.readdir ?? readdirSync;
  const resultado = { candidatas: [], omitidas: [] };
  for (const categoria of contrato.categorias) {
    let nombres;
    try {
      nombres = listar(join(cwd, categoria.raiz)).sort();
    } catch (error) {
      if (error.code !== 'ENOENT') resultado.omitidas.push({ ruta: categoria.raiz, motivo: `no se pudo leer la raíz: ${error.message}` });
      continue;
    }
    for (const nombre of nombres.filter((n) => n.startsWith(categoria.prefijo))) {
      const ruta = `${categoria.raiz}/${nombre}`;
      const completa = join(cwd, categoria.raiz, nombre);
      const edadHoras = Math.floor((ahoraMs - masReciente(completa, io)) / HORA_MS);
      if (edadHoras < categoria.edad_minima_horas) {
        resultado.omitidas.push({ ruta, motivo: `demasiado reciente (${edadHoras} h; la categoría pide ${categoria.edad_minima_horas})` });
        continue;
      }
      const intocable = contieneIntocable(completa, intocables, io);
      if (intocable !== null) {
        resultado.omitidas.push({ ruta, motivo: `contiene una fuente intocable (${intocable})` });
        continue;
      }
      resultado.candidatas.push({ categoria: categoria.id, ruta, nombre, edadHoras });
    }
  }
  return resultado;
}

const linea = (hoy, accion, item, categoria, ruta, bytes, sha256) => `[${hoy}] Limpieza | ${accion} | ${item} | ${categoria} | ${ruta} | ${bytes} | ${sha256}`;

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  const [orden, rutaContrato, item] = args;
  const largo = orden === 'restaurar' ? 3 : 2;
  const valido = ['listar', 'aplicar', 'purgar', 'restaurar'].includes(orden) && args.length === largo && typeof rutaContrato === 'string' && rutaContrato !== ''
    && (orden !== 'restaurar' || ITEM.test(item));
  if (!valido) {
    writeError(USAGE);
    return 2;
  }
  const cwd = options.cwd ?? '.';
  const ahora = options.ahora ?? Date.now();
  const hoy = options.hoy ?? new Date(ahora).toISOString().slice(0, 10);
  const io = { rename: renameSync, rm: rmSync, append: appendFileSync, ...options.io };
  const rechazar = (items) => {
    for (const i of items) writeError(`REJECTED: ${i.codigo}: ${i.mensaje}`);
    return 1;
  };

  const cargado = cargarContrato(rutaContrato, cwd, options);
  if (cargado.ausente) {
    write(`VACÍO: no hay contrato en ${rutaContrato}: un proyecto sin regla de limpieza no se limpia.`);
    return 0;
  }
  if (cargado.errores) return rechazar(cargado.errores);
  const { contrato, intocables } = cargado;

  const lista = candidatas(contrato, cwd, ahora, intocables);
  if (orden === 'listar') {
    for (const c of lista.candidatas) write(`CANDIDATA ${c.ruta} (${c.categoria}, ${c.edadHoras} h)`);
    for (const o of lista.omitidas) write(`OMITIDA ${o.ruta}: ${o.motivo}`);
    write(`listar: ${lista.candidatas.length} candidata(s), ${lista.omitidas.length} omitida(s). No se movió nada: para mover, corré aplicar.`);
    return 0;
  }

  // Antes de actuar, el mismo juicio que hace el verificador. Sobre un estado que no cierra no se agrega nada.
  const estado = juzgarProyecto(contrato, intocables, cwd, { hoy });
  if (estado.estado === 'rechazo') return rechazar(estado.problemas);

  const rutaLog = join(cwd, contrato.log);
  const cuarentena = join(cwd, contrato.cuarentena.directorio);
  let contenido = estado.contenidoLog;
  const entradas = [...estado.entradas];
  const problemas = [];
  // `sealLineFor` sólo se niega ante un log roto, un texto en blanco, de varias líneas o ya sellado:
  // el log ya lo juzgó `juzgarProyecto` y el texto lo arma este script, así que acá no se niega. Lo que
  // sí puede fallar es el disco, y quien llama deshace o informa.
  const sellar = (texto) => {
    const sellada = sealLineFor(contenido, texto);
    mkdirSync(dirname(rutaLog), { recursive: true });
    io.append(rutaLog, sellada.append);
    contenido += sellada.append;
  };

  if (orden === 'aplicar') {
    for (const o of lista.omitidas) write(`OMITIDA ${o.ruta}: ${o.motivo}`);
    if (lista.candidatas.length === 0) {
      write('aplicar: ninguna candidata: nada que mover.');
      return 0;
    }
    let movidas = 0;
    for (const c of lista.candidatas) {
      const id = siguienteItem(hoy, entradas);
      const destino = join(cuarentena, id);
      const origen = join(cwd, c.ruta);
      mkdirSync(destino, { recursive: true });
      try {
        io.rename(origen, join(destino, c.nombre));
      } catch (error) {
        rmdirSync(destino);
        problemas.push({ codigo: 'AUTOLIMPIEZA_MOVE_FAILED', mensaje: `${c.ruta}: no se pudo mover y se queda donde está: ${error.message}` });
        continue;
      }
      const { sha256, bytes } = huellaDeArbol(join(destino, c.nombre));
      try {
        sellar(linea(hoy, 'cuarentena', id, c.categoria, c.ruta, bytes, sha256));
      } catch (error) {
        io.rename(join(destino, c.nombre), origen);
        rmdirSync(destino);
        problemas.push({ codigo: 'AUTOLIMPIEZA_LOG_WRITE_FAILED', mensaje: `${c.ruta}: no se pudo sellar en el log, así que se devolvió a su lugar: ${error.message}` });
        continue;
      }
      entradas.push({ ok: true, item: id });
      movidas += 1;
      write(`MOVIDA ${c.ruta} -> ${contrato.cuarentena.directorio}/${id}`);
    }
    write(`aplicar: ${movidas} movida(s) a la cuarentena (retención ${contrato.cuarentena.retencion_dias} días).`);
    return problemas.length > 0 ? rechazar(problemas) : 0;
  }

  if (orden === 'purgar') {
    const vencidas = estado.pendientes.filter((p) => diasEntre(p.fecha, hoy) >= contrato.cuarentena.retencion_dias);
    if (vencidas.length === 0) {
      write('purgar: ninguna vencida: nada que purgar.');
      return 0;
    }
    let purgadas = 0;
    for (const p of vencidas) {
      const ubicacion = join(cuarentena, p.item);
      const intocable = contieneIntocable(join(ubicacion, basename(p.ruta)), intocables);
      if (intocable !== null) {
        problemas.push({ codigo: 'AUTOLIMPIEZA_PURGE_REFUSED', mensaje: `${p.item}: ${p.ruta} contiene una fuente intocable (${intocable}): no se purga nunca` });
        continue;
      }
      try {
        io.rm(ubicacion, { recursive: true, force: true });
      } catch (error) {
        problemas.push({ codigo: 'AUTOLIMPIEZA_PURGE_REFUSED', mensaje: `${p.item}: no se pudo eliminar y sigue en la cuarentena: ${error.message}` });
        continue;
      }
      try {
        sellar(linea(hoy, 'purga', p.item, p.categoria, p.ruta, p.bytes, p.sha256));
      } catch (error) {
        // Ya se eliminó y no hay vuelta atrás: se dice a gritos. El verificador va a marcar que falta en la cuarentena.
        problemas.push({ codigo: 'AUTOLIMPIEZA_LOG_WRITE_FAILED', mensaje: `${p.item}: se eliminó pero no se pudo sellar la purga en el log: ${error.message}` });
        continue;
      }
      purgadas += 1;
      write(`PURGADA ${p.item} (${p.ruta})`);
    }
    write(`purgar: ${purgadas} purgada(s).`);
    return problemas.length > 0 ? rechazar(problemas) : 0;
  }

  const pendiente = estado.pendientes.find((p) => p.item === item);
  if (pendiente === undefined) {
    return rechazar([{ codigo: 'AUTOLIMPIEZA_RESTORE_REFUSED', mensaje: `${item}: no está en la cuarentena, o ya se resolvió` }]);
  }
  const origen = join(cwd, pendiente.ruta);
  let existe = true;
  try {
    lstatSync(origen);
  } catch {
    existe = false;
  }
  if (existe) return rechazar([{ codigo: 'AUTOLIMPIEZA_RESTORE_REFUSED', mensaje: `${item}: ${pendiente.ruta} ya existe: restaurar no pisa nada` }]);
  const ubicacion = join(cuarentena, item);
  mkdirSync(dirname(origen), { recursive: true });
  io.rename(join(ubicacion, basename(pendiente.ruta)), origen);
  rmdirSync(ubicacion);
  try {
    sellar(linea(hoy, 'restauracion', item, pendiente.categoria, pendiente.ruta, pendiente.bytes, pendiente.sha256));
  } catch (error) {
    mkdirSync(ubicacion, { recursive: true });
    io.rename(origen, join(ubicacion, basename(pendiente.ruta)));
    return rechazar([{ codigo: 'AUTOLIMPIEZA_LOG_WRITE_FAILED', mensaje: `${item}: no se pudo sellar la restauración en el log, así que volvió a la cuarentena: ${error.message}` }]);
  }
  write(`RESTAURADA ${item} -> ${pendiente.ruta}`);
  return 0;
}

if (process.argv[1] && basename(process.argv[1]) === 'autolimpieza.mjs') {
  process.exitCode = main();
}
