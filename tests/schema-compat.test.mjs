// El protocolo cambió de nombre, y los artefactos ya escritos siguen valiendo.
//
// EL PROBLEMA, medido el 2026-09-15 antes de tocar nada: **42 familias de schema** llevan el prefijo
// `vcp.`, y cada artefacto que el protocolo produce lo declara — recibos, contratos, paquetes de
// Discovery, planes de fase—. Los gates lo comparan **por igualdad exacta**, que es correcto: un
// schema es un identificador, no una descripción. Renombrarlo de golpe convertiría en inválido todo
// lo que este repositorio y cualquier instalación produjeron hasta hoy.
//
// LA SALIDA NO ES NO RENOMBRAR, ES **ACEPTAR EL VIEJO Y ESCRIBIR EL NUEVO**. Es la migración de
// siempre, y lo único que importa es que la tolerancia viva en UN SOLO LUGAR con su límite escrito.
// Si cada gate hiciera su propia excepción, en seis meses habría 42 reglas distintas sobre qué se
// acepta, y nadie sabría cuál es la vigente — el mismo error que este repositorio ya evitó con la
// redacción reusable de `validateDeclaredField`.
//
// LO QUE ESTO NO ES. No es un traductor de versiones: `ia.receipt/v2` y `ia.receipt/v3` siguen
// siendo distintos, y ninguno acepta al otro. La equivalencia es **sólo del prefijo**, con la misma
// familia y la misma versión. Un artefacto viejo se lee; un artefacto de otra versión, no.

import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'schema-compat.mjs');
const { CORTE, LEGADO, PREFIJO, aLegado, contarLegado, estadoDeCompatibilidad, leidosConNombreViejo, mismoSchema } = await import(pathToFileURL(script).href);

test('los dos prefijos son los que el protocolo declara, y no se adivinan', () => {
  assert.equal(PREFIJO, 'ia.');
  assert.equal(LEGADO, 'vcp.');
});

test('el nombre nuevo vale', () => {
  assert.equal(mismoSchema('ia.receipt/v3', 'ia.receipt/v3'), true);
});

test('EL NOMBRE VIEJO TAMBIÉN VALE: un recibo escrito antes del cambio se sigue leyendo', () => {
  // Es toda la razón de ser de este módulo. `.vibe/receipts/` tiene decenas de recibos con el
  // prefijo viejo, y son el registro de lo que realmente pasó: invalidarlos sería reescribir la
  // historia para que cierre con el nombre nuevo.
  assert.equal(mismoSchema('vcp.receipt/v3', 'ia.receipt/v3'), true);
  assert.equal(mismoSchema('vcp.index/1', 'ia.index/1'), true);
});

test('LA EQUIVALENCIA ES SÓLO DEL PREFIJO: la familia y la versión tienen que coincidir', () => {
  // No es un traductor de versiones. Aflojar acá convertiría una tolerancia de nombre en una
  // tolerancia de formato, que es exactamente lo que un schema existe para impedir.
  assert.equal(mismoSchema('vcp.receipt/v2', 'ia.receipt/v3'), false);
  assert.equal(mismoSchema('ia.receipt/v2', 'ia.receipt/v3'), false);
  assert.equal(mismoSchema('vcp.index/1', 'ia.intake/1'), false);
  assert.equal(mismoSchema('vcp.intake/1', 'ia.index/1'), false);
});

test('FALSIFICACIÓN · la tolerancia va en UNA sola dirección', () => {
  // Un artefacto con el nombre NUEVO no puede pasar por un gate que todavía espera el viejo: eso
  // seria aceptar un futuro que nadie escribió. Y el esperado siempre es el nuevo, por construcción.
  assert.equal(mismoSchema('ia.receipt/v3', 'vcp.receipt/v3'), false);
});

test('FALSIFICACIÓN · un prefijo parecido no es el prefijo', () => {
  for (const impostor of ['vcpx.receipt/v3', 'ia-stack.receipt/v3', 'xvcp.receipt/v3', 'IA Stack.receipt/v3', 'IA.receipt/v3']) {
    assert.equal(mismoSchema(impostor, 'ia.receipt/v3'), false, impostor);
  }
});

test('FALSIFICACIÓN · lo que no es una cadena no es un schema', () => {
  for (const basura of [null, undefined, 42, {}, ['ia.receipt/v3'], true, '']) {
    assert.equal(mismoSchema(basura, 'ia.receipt/v3'), false, JSON.stringify(basura));
  }
  for (const esperadoMalo of [null, undefined, 42, '', 'sin-prefijo/1']) {
    assert.equal(mismoSchema('ia.receipt/v3', esperadoMalo), false, JSON.stringify(esperadoMalo));
  }
});

test('aLegado nombra la forma vieja, para poder decirla en un mensaje de rechazo', () => {
  // Un rechazo que sólo nombra el schema nuevo deja a quien migra sin saber qué se sigue aceptando.
  assert.equal(aLegado('ia.receipt/v3'), 'vcp.receipt/v3');
  assert.equal(aLegado('vcp.receipt/v3'), 'vcp.receipt/v3');
  assert.equal(aLegado('sin-prefijo/1'), 'sin-prefijo/1');
});

test('TODOS los schemas que los gates esperan usan el prefijo nuevo', async () => {
  // La prueba que impide que la migración quede a medias: si un gate nuevo nace con `vcp.`, acá se
  // ve. Se mira el literal en el código, no una lista escrita a mano que alguien tenga que recordar.
  const { readdirSync, readFileSync } = await import('node:fs');
  const viejos = [];
  for (const nombre of readdirSync(join(repoRoot, 'scripts')).filter((n) => n.endsWith('.mjs'))) {
    if (nombre === 'schema-compat.mjs') continue;
    const fuente = readFileSync(join(repoRoot, 'scripts', nombre), 'utf8');
    // Sólo los literales de schema: `'vcp.algo/1'`. La prosa de los comentarios no cuenta.
    for (const [literal] of fuente.matchAll(/'vcp\.[a-z0-9-]+\/[a-z0-9]+'/gu)) {
      viejos.push(`${nombre}: ${literal}`);
    }
  }
  assert.deepEqual(viejos, []);
});

// --- LA COMPATIBILIDAD SE PUEDE RETIRAR CUANDO HAY UN DATO, Y NO ANTES --------------------------
//
// Propuesta 4 de la ronda del 2026-09-15. Aceptar el prefijo viejo era la unica forma de renombrar
// 42 schemas sin invalidar todo lo que el protocolo produjo, y se declaro como limite honesto. El
// problema no es que exista: es que NO TIENE CUENTA. Sin un numero, dentro de un ano nadie va a
// poder decir si la tolerancia todavia sirve o si ya no la usa nadie y solo queda como deuda.
//
// El contador NO cambia ningun veredicto: cuenta. Esa es toda la gracia -- una compatibilidad que
// se promete transitoria y no se puede medir se queda para siempre, y este repositorio ya declaro
// por escrito que no sabe cuando termina. Ahora al menos va a saber cuanto se usa.

test('el contador arranca en cero y sube SOLO con el nombre viejo', () => {
  const c = contarLegado();
  assert.equal(c.total, 0);
  assert.equal(c.legado, 0);

  c.mirar('ia.receipt/v3', 'ia.receipt/v3');
  assert.deepEqual({ total: c.total, legado: c.legado }, { total: 1, legado: 0 });

  c.mirar('vcp.receipt/v3', 'ia.receipt/v3');
  assert.deepEqual({ total: c.total, legado: c.legado }, { total: 2, legado: 1 });
});

test('lo que NO coincide no entra en la cuenta: contar rechazos inflaria el uso del nombre viejo', () => {
  const c = contarLegado();
  c.mirar('ia.receipt/v2', 'ia.receipt/v3');
  c.mirar('basura', 'ia.receipt/v3');
  c.mirar(null, 'ia.receipt/v3');
  assert.deepEqual({ total: c.total, legado: c.legado }, { total: 0, legado: 0 });
});

test('el contador NO cambia ningún veredicto: sólo cuenta', () => {
  const c = contarLegado();
  assert.equal(c.mirar('vcp.index/1', 'ia.index/1'), true, 'el viejo sigue valiendo');
  assert.equal(c.mirar('ia.index/1', 'ia.index/1'), true);
  assert.equal(c.mirar('ia.index/1', 'vcp.index/1'), false, 'y la dirección sigue siendo una sola');
});

test('el resumen se lee sin hacer la cuenta mentalmente, y dice cuándo se puede retirar', () => {
  const c = contarLegado();
  assert.match(c.resumen(), /nada que contar/iu, 'sin lecturas no se inventa un porcentaje');

  c.mirar('ia.receipt/v3', 'ia.receipt/v3');
  c.mirar('ia.receipt/v3', 'ia.receipt/v3');
  assert.match(c.resumen(), /0 de 2/u);
  assert.match(c.resumen(), /Cero acá/u, 'cero es el dato, y el mensaje no lo confunde con «nadie lo usa»');

  c.mirar('vcp.receipt/v3', 'ia.receipt/v3');
  assert.match(c.resumen(), /1 de 3/u);
  assert.doesNotMatch(c.resumen(), /Cero acá/u);
});

test('el contador COMPARTIDO acumula entre gates, que es el unico numero que sirve', () => {
  // Un contador por gate diria «este gate leyo 2 artefactos viejos» y nadie sumaria los 29. Lo que
  // se quiere saber es del protocolo entero, asi que `mismoSchema` alimenta uno compartido.
  const antes = leidosConNombreViejo().total;
  mismoSchema('vcp.intake/1', 'ia.intake/1');
  mismoSchema('ia.intake/1', 'ia.intake/1');
  const despues = leidosConNombreViejo();
  assert.equal(despues.total, antes + 2);
  assert.ok(despues.legado >= 1);
});

// --- La fecha de corte ---------------------------------------------------------------------------

test('la compatibilidad declara una fecha de corte real', () => {
  // Una tolerancia sin vencimiento es permanente aunque nadie lo haya decidido. La fecha es lo que
  // convierte «por ahora» en algo que alguien puede comprobar.
  assert.match(CORTE, /^\d{4}-\d{2}-\d{2}$/u);
  const d = new Date(`${CORTE}T00:00:00Z`);
  assert.equal(d.toISOString().slice(0, 10), CORTE, 'la fecha tiene que existir de verdad, no rodar de mes');
});

test('el estado de la compatibilidad depende del día, y tiene tres valores', () => {
  assert.equal(estadoDeCompatibilidad('2026-09-16').estado, 'vigente');
  assert.equal(estadoDeCompatibilidad(CORTE).estado, 'por_vencer', 'el día del corte todavía se acepta: vence DESPUÉS');
  const [a, m, d] = CORTE.split('-').map(Number);
  const despues = new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
  assert.equal(estadoDeCompatibilidad(despues).estado, 'vencida');
  assert.equal(typeof estadoDeCompatibilidad('2026-09-16').dias, 'number');
  assert.equal(estadoDeCompatibilidad('2026-09-16').corte, CORTE);
});

test('por_vencer empieza a avisar antes del corte, no el mismo día', () => {
  // Avisar el día del vencimiento no sirve para migrar nada. El aviso tiene que llegar con tiempo.
  const [a, m, d] = CORTE.split('-').map(Number);
  const treintaAntes = new Date(Date.UTC(a, m - 1, d - 30)).toISOString().slice(0, 10);
  assert.equal(estadoDeCompatibilidad(treintaAntes).estado, 'por_vencer');
  const cienAntes = new Date(Date.UTC(a, m - 1, d - 100)).toISOString().slice(0, 10);
  assert.equal(estadoDeCompatibilidad(cienAntes).estado, 'vigente');
});

test('leer el nombre viejo NO deja de funcionar después del corte', () => {
  // A propósito, y es la decisión que más importa de todo esto: la evidencia sellada de
  // docs/discovery/** declara el prefijo viejo y es append-only. Un corte que apague la lectura
  // invalidaría la historia del repositorio un martes cualquiera. Lo que vence es el permiso de
  // seguir PRODUCIENDO artefactos viejos, y eso lo escala el gate, no el lector.
  assert.equal(mismoSchema('vcp.receipt/v3', 'ia.receipt/v3'), true);
});

test('el resumen dice en qué estado está la compatibilidad y hasta cuándo', () => {
  const c = contarLegado();
  c.mirar('vcp.receipt/v3', 'ia.receipt/v3');
  const r = c.resumen('2026-09-16');
  assert.match(r, new RegExp(CORTE, 'u'), r);
  const [a, m, d] = CORTE.split('-').map(Number);
  const despues = new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
  assert.match(c.resumen(despues), /venció|vencida/iu);
});

test('vencida y sin un solo nombre viejo dice que la tolerancia ya se puede retirar', () => {
  const c = contarLegado();
  c.mirar('ia.receipt/v3', 'ia.receipt/v3');
  const [a, m, d] = CORTE.split('-').map(Number);
  const despues = new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
  assert.match(c.resumen(despues), /se puede retirar/iu);
});

test('en `por_vencer` el resumen dice cuántos días quedan, que es lo único que sirve para migrar', () => {
  const [a, m, d] = CORTE.split('-').map(Number);
  const faltan10 = new Date(Date.UTC(a, m - 1, d - 10)).toISOString().slice(0, 10);
  const c = contarLegado();
  c.mirar('vcp.receipt/v3', 'ia.receipt/v3');
  assert.match(c.resumen(faltan10), /quedan 10 día\(s\)/u, c.resumen(faltan10));
  // Y en cero, el mismo plazo: el aviso no depende de que todavía haya artefactos viejos.
  const limpio = contarLegado();
  limpio.mirar('ia.receipt/v3', 'ia.receipt/v3');
  assert.match(limpio.resumen(faltan10), /quedan 10 día\(s\)/u);
});

test('leidosConNombreViejo trae el estado además del conteo', () => {
  const leido = leidosConNombreViejo('2026-09-16');
  assert.equal(leido.corte, CORTE);
  assert.equal(leido.estado, 'vigente');
  assert.equal(typeof leido.dias, 'number');
});
