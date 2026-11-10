#!/usr/bin/env node
// migrar.mjs — pasa la carpeta de estado del nombre anterior (`.vibe/`) a `.ia-stack/`.
//
// Uso: node scripts/migrar.mjs <proyecto>
//
// Qué hace, en este orden, y no hace nada más:
//   1. Si <proyecto>/.vibe no existe: dice «nada que migrar» y sale 0. Por eso correrlo dos veces
//      no cambia nada la segunda.
//   2. Si <proyecto>/.ia-stack ya existe: no pisa nada, sale 1.
//   3. Copia de respaldo entera: <proyecto>/.vibe.respaldo-DD-MM-AAAA (con -HHMM si ese día ya hay uno).
//   4. Renombra .vibe a .ia-stack, y adentro `ia-stack-runtime` a `runtime` e `ia-stack-archive`
//      a `archivo`.
//   5. Arma .ia-stack/ESTADO.md (≤60 líneas: ## Fase, ## Cola, ## Cómo retomar) con lo útil de
//      SESSION.md, y manda el resto de SESSION.md a .ia-stack/historial.md. SESSION.md queda donde
//      estaba: los gates leen el slug de la feature de ahí.
//   APROBACIONES.md no se toca: viaja con la carpeta, byte a byte.
//
// Este archivo y tests/migrar.test.mjs son los únicos del repositorio que nombran la carpeta anterior.

import { cpSync, existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const CARPETA_ANTERIOR = '.vibe';
export const CARPETA_NUEVA = '.ia-stack';
export const MAX_LINEAS_ESTADO = 60;

const dos = (n) => String(n).padStart(2, '0');
const fechaDDMMAAAA = (d) => `${dos(d.getDate())}-${dos(d.getMonth() + 1)}-${d.getFullYear()}`;
const horaHHMM = (d) => `${dos(d.getHours())}${dos(d.getMinutes())}`;

/**
 * Separa SESSION.md en lo que entra en ESTADO.md y el resto. Devuelve índices de línea usados, así
 * que el historial es exactamente lo que ESTADO.md no muestra.
 */
export function armarEstado(texto) {
  const lineas = texto.split(/\r?\n/u);
  const usadas = new Set();
  const tomar = (indices) => { for (const i of indices) usadas.add(i); return indices.map((i) => lineas[i].trimEnd()); };

  const indicesDe = (re) => lineas.map((l, i) => (re.test(l) ? i : -1)).filter((i) => i >= 0);

  // Fase: la cabecera de la sesión y el último renglón que habla de una fase.
  const cabecera = indicesDe(/^\*\*(?:Feature slug|Goal|Status):\*\*/u).slice(0, 6);
  const progreso = indicesDe(/\b(?:fase|phase)\s*\d+/iu).filter((i) => !cabecera.includes(i));
  const ultimaFase = progreso.length > 0 ? [progreso[progreso.length - 1]] : [];
  const fase = tomar([...cabecera, ...ultimaFase]);

  // Cola: lo pendiente. Los últimos 20, que son los más cercanos al presente.
  const cola = tomar(indicesDe(/^\s*[-*]\s*\[ \]/u).slice(-20));

  // Cómo retomar: la sección «Interrumpido en» si existe; si no, el final de la sesión.
  let retomar = [];
  const inicio = lineas.findIndex((l) => /^##\s+Interrumpido en\s*$/u.test(l));
  if (inicio >= 0) {
    const resto = lineas.slice(inicio + 1);
    const fin = resto.findIndex((l) => /^##\s/u.test(l));
    const indices = (fin < 0 ? resto : resto.slice(0, fin))
      .map((l, k) => (l.trim() === '' ? -1 : inicio + 1 + k)).filter((i) => i >= 0);
    retomar = tomar(indices.slice(0, 12));
  } else {
    const ultimas = lineas.map((l, i) => (l.trim() === '' || usadas.has(i) ? -1 : i)).filter((i) => i >= 0).slice(-8);
    retomar = tomar(ultimas);
  }

  const seccion = (titulo, contenido, vacio) => [titulo, '', ...(contenido.length > 0 ? contenido : [vacio]), ''];
  const estado = [
    '# Estado del proyecto', '',
    ...seccion('## Fase', fase, '(sin fase registrada: completala a mano)'),
    ...seccion('## Cola', cola, '(sin tareas pendientes registradas)'),
    ...seccion('## Cómo retomar', retomar, '(sin punto de retome registrado)'),
  ];
  while (estado.length > 0 && estado[estado.length - 1] === '') estado.pop();

  const historial = lineas.filter((_, i) => !usadas.has(i));
  return { estado: `${estado.join('\n')}\n`, historial: historial.join('\n') };
}

export function migrar(proyecto, ahora = new Date()) {
  const raiz = resolve(proyecto);
  if (!existsSync(raiz) || !statSync(raiz).isDirectory()) {
    return { codigo: 1, salida: '', error: `la carpeta del proyecto no existe: ${raiz}` };
  }
  const vieja = join(raiz, CARPETA_ANTERIOR);
  const nueva = join(raiz, CARPETA_NUEVA);
  if (!existsSync(vieja)) return { codigo: 0, salida: 'nada que migrar', error: '' };
  if (existsSync(nueva)) {
    return { codigo: 1, salida: '', error: `${CARPETA_NUEVA} ya existe junto a ${CARPETA_ANTERIOR}: no se pisa nada. Resolvelo a mano.` };
  }

  let respaldo = join(raiz, `${CARPETA_ANTERIOR}.respaldo-${fechaDDMMAAAA(ahora)}`);
  if (existsSync(respaldo)) respaldo = `${respaldo}-${horaHHMM(ahora)}`;
  if (existsSync(respaldo)) return { codigo: 1, salida: '', error: `ya existe el respaldo ${respaldo}` };
  cpSync(vieja, respaldo, { recursive: true, errorOnExist: true });

  renameSync(vieja, nueva);
  for (const [de, a] of [['ia-stack-runtime', 'runtime'], ['ia-stack-archive', 'archivo']]) {
    if (existsSync(join(nueva, de)) && !existsSync(join(nueva, a))) renameSync(join(nueva, de), join(nueva, a));
  }

  const sesion = join(nueva, 'SESSION.md');
  const texto = existsSync(sesion) ? readFileSync(sesion, 'utf8') : '';
  const { estado, historial } = armarEstado(texto);
  writeFileSync(join(nueva, 'ESTADO.md'), estado);
  writeFileSync(join(nueva, 'historial.md'), `# Historial\n\nLo que ESTADO.md no muestra, tomado de SESSION.md al migrar.\n\n${historial.replace(/^\n+/u, '')}\n`);

  return {
    codigo: 0,
    salida: `migrado: ${CARPETA_ANTERIOR} -> ${CARPETA_NUEVA}. Respaldo en ${respaldo}. Estado en ${CARPETA_NUEVA}/ESTADO.md, resto en ${CARPETA_NUEVA}/historial.md.`,
    error: '',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const proyecto = process.argv[2];
  if (!proyecto) {
    console.error('Uso: node scripts/migrar.mjs <proyecto>');
    process.exit(2);
  }
  const r = migrar(proyecto);
  if (r.salida) console.log(r.salida);
  if (r.error) console.error(r.error);
  process.exit(r.codigo);
}
