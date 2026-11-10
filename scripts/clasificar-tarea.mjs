// Detector liviano de complejidad + reglas de esfuerzo y presupuesto.
//
// POR QUE EXISTE. El contrato dice qué modelo hay en cada nivel, pero cada sesión elegía a ojo en
// cuál arrancar. Esto clasifica el texto de la tarea en mecánica (barato), patrón conocido (medio)
// o alto requisito (fuerte), con el piso por riesgo de contracts/model-routing.json, y dice si un
// esfuerzo está permitido (sólo `low`) y si el gasto va al ritmo.
//
// LIMITE HONESTO. Son palabras clave, no un modelo: una tarea de riesgo descrita sin ninguna de las
// palabras del piso sale como patrón conocido. Sólo puede SUBIR el nivel por riesgo, nunca bajarlo;
// ante duda el orquestador decide hacia arriba. Uso: node scripts/clasificar-tarea.mjs "<tarea>"

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const contrato = JSON.parse(readFileSync(join(raiz, 'contracts/model-routing.json'), 'utf8'));

const tamano = JSON.parse(readFileSync(join(raiz, 'contracts/tamano.json'), 'utf8'));
// Áreas de riesgo genéricas (plata, seguridad, autenticación, migraciones de datos), leídas del contrato.
const RIESGO = new RegExp(tamano.reglas.riesgos.flatMap((area) => tamano.reglas.palabras_riesgo[area]).join('|'), 'iu');
const ALTO = /adversari|arquitect|diseñ|dise[nñ]o profundo|diagn[oó]stico profundo|spec|plan de/iu;
const MECANICO = /\b(leer|buscar|listar|contar|resumir|logs?|git|estado|renombr|typo|formato)\b/iu;

export function clasificarTarea(texto) {
  const porRiesgo = RIESGO.test(texto);
  let clase = 'patron_conocido';
  if (porRiesgo || ALTO.test(texto)) clase = 'alto_requisito';
  else if (MECANICO.test(texto)) clase = 'mecanica';
  const nivel = contrato.complejidad.clases[clase];
  const { modelo } = contrato.niveles[nivel];
  return { clase, nivel, modelo, esfuerzo: contrato.niveles[nivel].esfuerzo, por_riesgo: porRiesgo };
}

/** El esfuerzo es `low` siempre: no existen `medium` ni `high`. */
export function esfuerzoPermitido({ esfuerzo }) {
  return esfuerzo === 'low';
}

/** semanal/ventana: fracción gastada (0–1); dias: días de la semana transcurridos; horas: de la ventana de 5 h. */
export function ritmoPresupuesto({ semanal, dias, ventana, horas }) {
  const p = contrato.presupuesto;
  if (ventana >= p.freno_ventana_5h) return { estado: 'freno' };
  const encima = semanal > p.por_dia * dias || ventana > p.por_hora_ventana_5h * horas;
  return { estado: encima ? 'encima' : 'ok' };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const texto = process.argv.slice(2).join(' ').trim();
  if (!texto) {
    process.stderr.write('uso: node scripts/clasificar-tarea.mjs "<tarea>"\n');
    process.exit(2);
  }
  process.stdout.write(`${JSON.stringify(clasificarTarea(texto))}\n`);
}
