#!/usr/bin/env node
// verify-lock-vivo.mjs — un candado que nadie puede soltar porque no se sabe si su dueño existe.
//
// LA IDEA VIENE DE `quant-dhawan/dovsky`, estudiado el 2026-09-14. Para saber si un proceso que dice
// estar corriendo sigue vivo no se conforma con el PID: guarda PID más identificador de arranque de
// la máquina, y cuando no puede probar ninguna de las dos cosas declara un estado explícito
// `reconcile_required` en vez de adivinar. Quedó anotada como no adoptada; ésta es su adopción.
//
// EL MODO DE FALLA ES REAL Y PASÓ ACÁ. `tasks.json` marca `locked: true` y `owner: "<rol>-<fecha>"`
// antes de despachar, y lo suelta al pasar el gate. Si la sesión muere en el medio —y el 2026-09-15
// se mataron decenas de corridas en este repositorio— el candado queda puesto **para siempre**, y
// `owner` no prueba nada: es un rol y una fecha. La sesión siguiente no puede distinguir «alguien
// está trabajando en esto» de «esto lo dejó un proceso muerto», así que o rompe el trabajo de otro
// o se queda trabada. Las dos salidas son malas y hoy no hay forma de elegir con un dato.
//
// TRES RESPUESTAS, Y LA TERCERA ES LA QUE HACE QUE ESTO SIRVA:
//
//   vivo    — el proceso existe en ESTA máquina y en ESTE arranque. No se toca.
//   muerto  — el arranque es otro, o el proceso ya no está. El candado es un fantasma: se suelta.
//   reconcile_required — no se puede probar ninguna de las dos. Se dice, y decide una persona.
//
// POR QUÉ EL ARRANQUE Y NO SÓLO EL PID. Un PID se reusa. Después de reiniciar, el 4242 es otro
// programa —puede ser el navegador—, y preguntar «¿existe el 4242?» diría «sí, vivo» sobre un
// candado de hace tres días: exactamente el verde falso que este gate viene a impedir.
//
// EL PID REUSADO YA NO ES UN HUECO, desde el 2026-09-16. Node no expone la hora de arranque de un
// proceso, pero los tres sistemas donde esto corre sí: `/proc/<pid>/stat` en Linux, `StartTime.Ticks`
// en Windows y `ps -o lstart=` en el resto. El candado guarda esa marca y la compara, así que un
// número que el sistema le dio a otro programa se declara MUERTO en vez de leerse como vivo.
//
// LÍMITE HONESTO, y es el que queda. `ps -o lstart` tiene grano de **un segundo**: dos procesos con
// el mismo pid que arrancaron dentro del mismo segundo dan la misma marca, así que la ventana pasó
// de «todo el arranque de la máquina» a un segundo — y **un segundo no es cero**. Un candado escrito
// antes del 2026-09-16 no trae el campo y sigue sin distinguir nada: se dice en su propio motivo, en
// vez de trabar de golpe todos los candados que ya existían. En una plataforma que no sabe contestar
// no inventa un veredicto: declara `reconcile_required` y sale 1. Y no sabe si el proceso vivo está
// haciendo lo que el candado dice: comprueba que exista y que sea el mismo, nunca qué está haciendo.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { hostname, uptime } from 'node:os';
import { join } from 'node:path';

export const USAGE = 'usage: verify-lock-vivo.mjs check <tasks.json>';
export const EMPTY = 'VACÍO';

export const VIVO = 'vivo';
export const MUERTO = 'muerto';
export const RECONCILE = 'reconcile_required';

/** El arranque se redondea a minutos: `uptime()` se corre unos milisegundos entre dos llamadas. */
const GRANO_MS = 60_000;

/**
 * Un marcador del arranque de ESTA máquina. No es el `boot_id` de Linux —que no existe en Windows—
 * sino cuándo arrancó, redondeado, más el nombre del equipo: dos llamadas seguidas dan lo mismo y un
 * reinicio lo cambia, que es todo lo que hace falta para comparar. El nombre del equipo va adelante
 * porque dos máquinas pueden haber arrancado en el mismo minuto.
 */
export function marcaDeArranque(io = {}) {
  const nombre = (io.hostname ?? hostname)();
  const segundos = (io.uptime ?? uptime)();
  const ahora = io.ahora ?? Date.now();
  return `${nombre}:${Math.round((ahora - segundos * 1000) / GRANO_MS)}`;
}

/** Lo que hay que escribir al tomar un candado para poder preguntar después. */
export function tomarLock({ pid = process.pid, arranque = marcaDeArranque(), inicio = inicioDelProceso, ahora = new Date().toISOString() } = {}) {
  // `start` puede quedar en null: la plataforma no supo contestar. Se escribe igual, porque la
  // diferencia entre «no habia campo» y «el campo dice que no se pudo» la necesita quien lo lea.
  return { pid, boot: arranque, start: inicio(pid), taken_at: ahora };
}

const esObjeto = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** ¿El proceso que puso este candado sigue vivo? Las tres respuestas, nunca dos. */
export function estadoDelLock(lock, { arranque, existe, inicio = inicioDelProceso }) {
  if (!esObjeto(lock) || typeof lock.pid !== 'number' || typeof lock.boot !== 'string') {
    return {
      estado: RECONCILE,
      motivo: 'el candado no declara pid y boot: es de antes de que esto existiera, o lo escribió algo que no sigue el protocolo. No se puede probar ni que viva ni que haya muerto',
    };
  }
  // EL ARRANQUE PRIMERO, y es lo que un PID solo no puede contestar: si la máquina se reinició, el
  // proceso que puso el candado no existe más, y da igual qué esté usando ese número hoy.
  if (lock.boot !== arranque) {
    return { estado: MUERTO, motivo: `el candado es de otro arranque (${lock.boot}, y ahora es ${arranque}): el proceso ${lock.pid} que lo puso no existe más` };
  }
  let vive;
  try {
    vive = existe(lock.pid);
  } catch (error) {
    return { estado: RECONCILE, motivo: `no se pudo preguntar por el proceso ${lock.pid}: ${error.message}. Suponer que murió soltaría el candado de alguien que está trabajando, y suponer que vive dejaría esto trabado para siempre` };
  }
  if (!vive) return { estado: MUERTO, motivo: `el proceso ${lock.pid} ya no existe en este arranque` };
  // EL NUMERO EXISTE. Falta saber si es EL MISMO PROCESO, que es otra pregunta: un pid se libera
  // cuando la sesion muere y el sistema se lo da al que venga. Sin esto, el candado de un proceso
  // muerto se lee como vivo y la tarea queda trabada para siempre.
  if (!noVacio(lock.start)) {
    // UN CANDADO VIEJO NO SE TRABA. Convertir en reconcile todos los que ya estaban escritos
    // frenaria el protocolo entero de golpe por un campo que nadie pudo poner. Se sigue con lo que
    // habia -- arranque mas pid -- y se nombra el hueco en vez de taparlo.
    return { estado: VIVO, motivo: `el proceso ${lock.pid} existe en este mismo arranque. Este candado no declara la hora de arranque del proceso, así que no puede distinguir un PID que el sistema le haya dado a otro programa: es de antes de que eso se guardara` };
  }
  let ahora;
  try {
    ahora = inicio(lock.pid);
  } catch (error) {
    return { estado: RECONCILE, motivo: `no se pudo leer la hora de arranque del proceso ${lock.pid}: ${error.message}` };
  }
  if (ahora === null) {
    return { estado: RECONCILE, motivo: `el candado declara la hora de arranque del proceso ${lock.pid} pero esta máquina no la sabe contestar, así que no se puede probar si es el mismo proceso o uno que heredó el número. Suponer que murió soltaría el candado de alguien que está trabajando, y suponer que vive lo dejaría trabado para siempre` };
  }
  if (ahora !== lock.start) {
    return { estado: MUERTO, motivo: `el PID ${lock.pid} existe pero no es el mismo proceso: el candado lo tomó uno que arrancó en ${lock.start} y el que tiene ese número ahora arrancó en ${ahora}. El sistema reusó el número` };
  }
  return { estado: VIVO, motivo: `el proceso ${lock.pid} existe en este mismo arranque y es el mismo que puso el candado: arrancó en ${lock.start}` };
}

/**
 * ¿Existe ese proceso? `kill(pid, 0)` no manda ninguna señal: sólo pregunta.
 *
 * La señal se inyecta para poder probar las tres respuestas del sistema operativo. EPERM -- existe y
 * es de otro usuario -- no se puede provocar de forma portable, y es justo la que NO hay que
 * confundir con «no existe»: un candado de otra cuenta esta vivo.
 */
export const existeProceso = (pid, señal = (p) => process.kill(p, 0)) => {
  try {
    señal(pid);
    return true;
  } catch (error) {
    // ESRCH es «no existe». EPERM es «existe y no es tuyo», que para esto cuenta como vivo.
    if (error.code === 'ESRCH') return false;
    if (error.code === 'EPERM') return true;
    throw error;
  }
};

/**
 * LA HORA DE ARRANQUE DEL PROCESO, que es lo que un PID solo no puede contestar.
 *
 * Node no la expone de forma portable y por eso este gate declaraba el hueco como limite honesto.
 * Los tres sistemas donde esto corre SI la exponen, cada uno a su manera, y con eso alcanza: un
 * candado deja de poder confundirse con otro programa que heredo el mismo numero.
 *
 *   linux   campo 22 de /proc/<pid>/stat -- ticks desde que arranco el kernel
 *   win32   (Get-Process -Id N).StartTime.Ticks
 *   resto   ps -o lstart= -p N, con precision de segundo
 *
 * DEVUELVE `null` CUANDO NO SABE, y eso es la mitad del diseno: una marca inventada convertiria
 * «no se pudo probar» en «probado». Quien llama trata el null como reconcile_required, no como
 * muerto ni como vivo.
 *
 * LA PRECISION IMPORTA Y NO ALCANZA SIEMPRE. `ps -o lstart` tiene grano de un segundo: dos procesos
 * distintos con el mismo pid que arrancaron dentro del mismo segundo darian la misma marca. Es una
 * ventana mucho mas chica que la de antes -- que era «todo el arranque» -- y sigue sin ser cero.
 */
export function inicioDelProceso(pid, io = {}) {
  const so = io.platform ?? process.platform;
  const correr = io.spawn ?? spawnSync;
  const leer = io.leer ?? readFileSync;
  try {
    if (so === 'linux') {
      const stat = leer(`/proc/${pid}/stat`, 'utf8');
      // El nombre del ejecutable va entre parentesis y PUEDE traer espacios y parentesis adentro,
      // asi que se corta desde el ULTIMO ')' o todos los campos quedan corridos.
      const cierre = stat.lastIndexOf(')');
      if (cierre === -1) return null;
      const campos = stat.slice(cierre + 2).trim().split(/\s+/u);
      // El campo 22 global es el 20mo despues del estado, que es el campo 3.
      const arranque = campos[19];
      return /^\d+$/u.test(arranque ?? '') ? `linux:${arranque}` : null;
    }
    if (so === 'win32') {
      const r = correr('powershell', ['-NoProfile', '-NonInteractive', '-Command', `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.Ticks`], { encoding: 'utf8', windowsHide: true });
      const t = String(r?.stdout ?? '').trim();
      return r?.status === 0 && /^\d+$/u.test(t) ? `win:${t}` : null;
    }
    const r = correr('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8' });
    const t = String(r?.stdout ?? '').trim();
    return r?.status === 0 && t !== '' ? `ps:${t}` : null;
  } catch {
    // Un /proc que no esta, un powershell que no existe, un ps que no acepta el flag: todos son
    // «no se pudo probar», nunca «no existe».
    return null;
  }
}

const noVacio = (v) => typeof v === 'string' && v.trim().length > 0;

function parseArgs(args) {
  if (args.length !== 2 || args[0] !== 'check' || !noVacio(args[1])) return null;
  return { ruta: args[1] };
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;

  const parsed = parseArgs(args);
  if (parsed === null) {
    writeError(USAGE);
    return 2;
  }

  const cwd = options.cwd ?? '.';
  const leer = options.leer ?? ((ruta) => JSON.parse(readFileSync(join(cwd, ruta), 'utf8')));

  let doc;
  try {
    doc = leer(parsed.ruta);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      write(`${EMPTY}: no hay plan en ${parsed.ruta}. Sin tareas no hay candados que revisar.`);
      return 0;
    }
    writeError(`REJECTED: ${parsed.ruta} existe pero no se puede leer: ${error?.message ?? error}.`);
    return 1;
  }

  const tareas = esObjeto(doc) && Array.isArray(doc.tasks) ? doc.tasks : [];
  const tomadas = tareas.filter((t) => esObjeto(t) && t.locked === true);
  if (tomadas.length === 0) {
    write(`${EMPTY}: ninguna de las ${tareas.length} tarea(s) está tomada. No hay candado que probar, y eso no es una aprobación: es que no había nada que mirar.`);
    return 0;
  }

  const arranque = options.arranque ?? marcaDeArranque();
  const existe = options.existe ?? existeProceso;
  const inicio = options.inicio ?? inicioDelProceso;

  const cuenta = { [VIVO]: 0, [MUERTO]: 0, [RECONCILE]: 0 };
  const problemas = [];
  for (const t of tomadas) {
    const { estado, motivo } = estadoDelLock(t.lock, { arranque, existe, inicio });
    cuenta[estado] += 1;
    if (estado === MUERTO) {
      problemas.push(`REJECTED: ${t.id}: candado fantasma — ${motivo}. Es seguro soltarlo: poné locked en false y owner en null, y volvé a despachar la tarea.`);
    } else if (estado === RECONCILE) {
      problemas.push(`REJECTED: ${t.id}: RECONCILE_REQUIRED — ${motivo}. Esto lo decide una persona: mirá si hay una sesión trabajando en ${t.id} antes de soltar nada.`);
    }
  }

  if (problemas.length > 0) {
    for (const p of problemas) writeError(p);
    return 1;
  }

  write(`OK: ${cuenta[VIVO]} candado(s) vivo(s) sobre ${tomadas.length} tarea(s) tomada(s): el proceso que los puso existe en este mismo arranque, así que hay alguien trabajando y no se tocan.`);
  write('LIMITE: distingue un PID reusado comparando la hora de arranque del proceso, que se lee de /proc en Linux, de Get-Process en Windows y de ps en el resto. Donde esa lectura tiene grano de un segundo, dos procesos con el mismo pid que arrancaron dentro del mismo segundo dan la misma marca: un segundo no es cero. Un candado escrito antes del 2026-09-16 no trae el campo y no puede distinguir nada, y lo dice en su propio motivo. En una plataforma que no sabe contestar declara reconcile_required en vez de inventar un veredicto. Y comprueba que el proceso exista y sea el mismo, nunca qué está haciendo.');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-lock-vivo.mjs')) {
  process.exitCode = main();
}
