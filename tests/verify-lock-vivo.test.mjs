// Un candado que nadie puede soltar porque no se sabe si su dueño existe.
//
// LA IDEA VIENE DE `quant-dhawan/dovsky`, que para saber si un proceso que dice estar corriendo
// sigue vivo no se conforma con el PID: guarda PID + identificador de arranque de la máquina, y
// cuando no puede probar ninguna de las dos cosas declara un estado explícito `reconcile_required`
// en vez de adivinar. Se estudió el 2026-09-14 y quedó anotada como no adoptada.
//
// EL MODO DE FALLA ES REAL Y ME PASÓ. `tasks.json` marca `locked: true` y `owner: "<rol>-<fecha>"`
// antes de despachar, y lo suelta al pasar el gate. Si la sesión muere en el medio —y el 2026-09-15
// maté decenas de corridas— el candado queda puesto **para siempre**, y `owner` no prueba nada: es
// un rol y una fecha. La sesión siguiente no puede distinguir «alguien está trabajando en esto» de
// «esto lo dejó un proceso muerto», así que o rompe el trabajo de otro o se queda trabada.
//
// LAS TRES RESPUESTAS, Y LA TERCERA ES LA QUE IMPORTA. No son dos: son tres.
//
//   vivo    — el proceso existe en ESTA máquina y en ESTE arranque. No se toca.
//   muerto  — el arranque es otro, o el proceso ya no está. El candado es un fantasma: se suelta.
//   reconcile_required — no se puede probar ninguna de las dos. Se dice, y decide una persona.
//
// POR QUÉ EL ARRANQUE Y NO SÓLO EL PID. Un PID se reusa. Después de reiniciar, el 4242 es otro
// programa —puede ser el navegador—, y preguntar «¿existe el 4242?» diría «sí, vivo» sobre un
// candado de hace tres días. El marcador de arranque es lo que convierte esa respuesta en «ése es
// otro arranque, el proceso que puso el candado no existe más».
//
// LO QUE NO RESUELVE, y por eso existe el tercer estado: dentro del MISMO arranque, un PID reusado
// es indistinguible del original sin la marca de tiempo de inicio del proceso, que Node no expone
// de forma portable. Ahí no se inventa un veredicto: se declara `reconcile_required`.

import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-lock-vivo.mjs');
const {
  MUERTO, RECONCILE, USAGE, VIVO, estadoDelLock, existeProceso, main, marcaDeArranque, tomarLock,
} = await import(pathToFileURL(script).href);

const arranque = 'maquina-A:1000000';
const vivo = { pid: 4242, boot: arranque };

test('un uso inválido sale 2 y no se confunde con un rechazo', () => {
  const errores = [];
  for (const args of [[], ['otra'], ['check'], ['check', 'a', 'b']]) {
    errores.length = 0;
    assert.equal(main(args, { write: () => {}, writeError: (l) => errores.push(l) }), 2, JSON.stringify(args));
    assert.ok(errores.some((l) => l === USAGE), errores.join('\n'));
  }
});

test('la marca de arranque cambia cuando la máquina se reinicia, y no antes', () => {
  // Se deriva de cuándo arrancó la máquina, no de la hora: dos llamadas seguidas tienen que dar lo
  // mismo, o el marcador no sirve para comparar nada.
  const a = marcaDeArranque({ hostname: () => 'maquina-A', uptime: () => 5000, ahora: 9_000_000 });
  const b = marcaDeArranque({ hostname: () => 'maquina-A', uptime: () => 5001, ahora: 9_001_000 });
  assert.equal(a, b, 'un segundo después sigue siendo el mismo arranque');

  const otroArranque = marcaDeArranque({ hostname: () => 'maquina-A', uptime: () => 10, ahora: 9_001_000 });
  assert.notEqual(a, otroArranque, 'reiniciar cambia la marca');

  const otraMaquina = marcaDeArranque({ hostname: () => 'maquina-B', uptime: () => 5000, ahora: 9_000_000 });
  assert.notEqual(a, otraMaquina, 'otra máquina no es el mismo arranque, aunque los números coincidan');
});

test('VIVO · el proceso existe, en esta máquina y en este arranque', () => {
  const r = estadoDelLock(vivo, { arranque, existe: () => true });
  assert.equal(r.estado, VIVO);
  assert.match(r.motivo, /4242/u);
});

test('MUERTO · otro arranque, aunque el PID exista hoy', () => {
  // El caso que un PID solo no puede distinguir: después de reiniciar, el 4242 es otro programa.
  const r = estadoDelLock({ pid: 4242, boot: 'maquina-A:999' }, { arranque, existe: () => true });
  assert.equal(r.estado, MUERTO);
  assert.match(r.motivo, /arranque/u);
});

test('MUERTO · mismo arranque y el proceso ya no está', () => {
  const r = estadoDelLock(vivo, { arranque, existe: () => false });
  assert.equal(r.estado, MUERTO);
  assert.match(r.motivo, /no existe/u);
});

test('RECONCILE · no se puede preguntar por el proceso, y eso NO es «muerto»', () => {
  // Suponer muerto acá soltaría el candado de alguien que está trabajando. Suponer vivo dejaría el
  // repositorio trabado para siempre. Las dos son peores que decir que no se sabe.
  const r = estadoDelLock(vivo, { arranque, existe: () => { throw new Error('EPERM'); } });
  assert.equal(r.estado, RECONCILE);
  assert.match(r.motivo, /EPERM|no se pudo/u);
});

test('RECONCILE · un lock sin marca de arranque es de antes de que esto existiera', () => {
  for (const viejo of [{ pid: 4242 }, { boot: arranque }, {}, null, undefined, 'builder-1757900000']) {
    const r = estadoDelLock(viejo, { arranque, existe: () => true });
    assert.equal(r.estado, RECONCILE, JSON.stringify(viejo));
    assert.match(r.motivo, /no declara|sin/iu);
  }
});

test('tomarLock escribe lo que hace falta para poder preguntar después', () => {
  const l = tomarLock({ pid: 777, arranque, ahora: '2026-09-15T10:00:00.000Z' });
  assert.deepEqual(Object.keys(l).sort(), ['boot', 'pid', 'taken_at']);
  assert.equal(l.pid, 777);
  assert.equal(l.boot, arranque);
  assert.equal(estadoDelLock(l, { arranque, existe: () => true }).estado, VIVO);
});

test('EL PLAN REAL: cada tarea tomada dice si su dueño sigue vivo', () => {
  const salida = [];
  const errores = [];
  const code = main(['check', 'docs/tasks.json'], {
    cwd: repoRoot,
    write: (l) => salida.push(l),
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 0, errores.join('\n'));
  // Hoy el plan real no tiene ninguna tarea tomada, asi que la respuesta honesta es VACIO y no un
  // verde: no habia candado que probar. Se afirma la disyuncion en vez de clavar una de las dos,
  // porque el dia que haya una tarea tomada esta prueba tiene que seguir diciendo la verdad.
  const texto = salida.join(String.fromCharCode(10));
  assert.ok(/^VACÍO: /u.test(salida.at(-1)) || /^LIMITE: /mu.test(texto), texto);
});

test('sin plan no hay candados que revisar, y eso no es un incumplimiento', () => {
  const salida = [];
  const code = main(['check', 'docs/tasks.json'], {
    leer: () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); },
    write: (l) => salida.push(l),
    writeError: () => {},
  });
  assert.equal(code, 0);
  assert.ok(/^VACÍO: /u.test(salida.at(-1)), salida.join('\n'));
});

test('UN CANDADO MUERTO SE REPORTA, y se dice cómo soltarlo', () => {
  const salida = [];
  const errores = [];
  const code = main(['check', 'docs/tasks.json'], {
    leer: () => ({ tasks: [{ id: 'T01', locked: true, owner: 'builder-1', lock: { pid: 1, boot: 'otro:1' } }] }),
    arranque,
    existe: () => true,
    write: (l) => salida.push(l),
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1, salida.join('\n'));
  assert.match(errores.join('\n'), /T01/u);
  assert.match(errores.join('\n'), /locked.*false|soltar/iu, 'tiene que decir qué hacer con un candado fantasma');
});

test('UN CANDADO VIVO NO SE TOCA, y el verde lo dice', () => {
  const salida = [];
  const code = main(['check', 'docs/tasks.json'], {
    leer: () => ({ tasks: [{ id: 'T01', locked: true, owner: 'builder-1', lock: { pid: 1, boot: arranque } }] }),
    arranque,
    existe: () => true,
    write: (l) => salida.push(l),
    writeError: () => {},
  });
  assert.equal(code, 0, salida.join('\n'));
  assert.match(salida.join('\n'), /1 .*vivo|vivo.*1/iu);
});

test('RECONCILE no aprueba ni rechaza en silencio: sale 1 diciendo que decide una persona', () => {
  const errores = [];
  const code = main(['check', 'docs/tasks.json'], {
    leer: () => ({ tasks: [{ id: 'T01', locked: true, owner: 'builder-1', lock: { pid: 1 } }] }),
    arranque,
    existe: () => true,
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /reconcile|una persona/iu);
});

test('una tarea sin candado no se mira: no hay nada que probar', () => {
  const salida = [];
  const code = main(['check', 'docs/tasks.json'], {
    leer: () => ({ tasks: [{ id: 'T01', locked: false, owner: null }, { id: 'T02', locked: false, owner: 'quien-la-hizo' }] }),
    arranque,
    existe: () => { throw new Error('no debería preguntarse'); },
    write: (l) => salida.push(l),
    writeError: () => {},
  });
  assert.equal(code, 0, salida.join('\n'));
  assert.ok(/^VACÍO: /u.test(salida.at(-1)), salida.join('\n'));
});

// --- LO QUE LE PREGUNTA AL SISTEMA DE VERDAD -----------------------------------------------------

test('existeProceso dice que sí sobre este mismo proceso, y que no sobre uno que no está', () => {
  // Es la única pieza que habla con el sistema operativo, así que se prueba directo y no por
  // intermediarios: un doble acá probaría el doble.
  assert.equal(existeProceso(process.pid), true, 'este proceso existe, por definición');
  // Un PID absurdamente alto no está asignado. Si alguna vez lo estuviera, la prueba lo diría.
  assert.equal(existeProceso(0x7ffffffe), false);
});

test('las tres respuestas del sistema operativo, y EPERM NO es «no existe»', () => {
  // Un proceso de otro usuario existe: confundir EPERM con ESRCH soltaria el candado de alguien que
  // esta trabajando con otra cuenta. No se puede provocar de forma portable, asi que se inyecta.
  const conCodigo = (code) => () => { throw Object.assign(new Error(code), { code }); };
  assert.equal(existeProceso(1, conCodigo('ESRCH')), false, 'ESRCH es no existe');
  assert.equal(existeProceso(1, conCodigo('EPERM')), true, 'EPERM es existe y no es tuyo');
  assert.throws(() => existeProceso(1, conCodigo('EIO')), /EIO/u, 'lo que no se entiende se propaga, no se inventa');
});

test('un plan que revienta con algo que NO es un Error igual se reporta', () => {
  const errores = [];
  const code = main(['check', 'docs/tasks.json'], {
    leer: () => { throw 'el plan es una cadena rota'; },
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  assert.match(errores.join(String.fromCharCode(10)), /cadena rota/u);
});

test('la marca de arranque real se puede calcular sin inyectarle nada', () => {
  const a = marcaDeArranque();
  assert.match(a, /^.+:\d+$/u, a);
  assert.equal(a, marcaDeArranque(), 'dos llamadas seguidas tienen que dar lo mismo');
});

test('tomarLock sin argumentos describe a ESTE proceso, que es para lo que existe', () => {
  const l = tomarLock();
  assert.equal(l.pid, process.pid);
  assert.equal(l.boot, marcaDeArranque());
  assert.equal(estadoDelLock(l, { arranque: marcaDeArranque(), existe: existeProceso }).estado, VIVO);
});

test('un plan ilegible es un defecto, no una ausencia', () => {
  const errores = [];
  const code = main(['check', 'docs/tasks.json'], {
    leer: () => { throw new SyntaxError('Unexpected token'); },
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /no se puede leer/u);
});

test('un plan que no es un objeto con tasks no tiene candados: VACÍO, no un verde', () => {
  for (const doc of ['no es un objeto', null, 42, { sin: 'tasks' }, { tasks: 'no es una lista' }]) {
    const salida = [];
    assert.equal(main(['check', 'docs/tasks.json'], { leer: () => doc, write: (l) => salida.push(l), writeError: () => {} }), 0, JSON.stringify(doc));
    assert.ok(/^VACÍO: /u.test(salida.at(-1)), `${JSON.stringify(doc)}: ${salida.join('\n')}`);
  }
});

test('sin inyectarle el arranque ni el probe, usa los de verdad', () => {
  // Cubre el camino que corre en una máquina real: un candado tomado por ESTE proceso sale vivo sin
  // que la prueba le pase ni el arranque ni la forma de preguntar.
  const salida = [];
  const code = main(['check', 'docs/tasks.json'], {
    leer: () => ({ tasks: [{ id: 'T01', locked: true, owner: 'builder-1', lock: tomarLock() }] }),
    write: (l) => salida.push(l),
    writeError: () => {},
  });
  assert.equal(code, 0, salida.join('\n'));
  assert.match(salida.join('\n'), /vivo/iu);
});
