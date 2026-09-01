/**
 * Los verificadores de research leen expedientes que NO están en git: el corpus pesa cientos de
 * megas y se regenera, así que `.gitignore` los deja afuera a propósito. La consecuencia medida el
 * 2026-09-01 sobre un clon limpio: tres de los cuatro verificadores que el protocolo manda correr
 * reventaban con un stack trace de `node:fs` en vez de rechazar. Los dos casos salen con código 1,
 * pero no dicen lo mismo: un rechazo dice "falta este insumo y así se regenera"; un stack trace deja
 * a quien lo lee sin saber si el gate está roto o si el archivo no estaba.
 *
 * LÍMITE: esto convierte un insumo ausente en un rechazo legible. No verifica el contenido del
 * insumo ni que el comando que se sugiere lo regenere igual — eso lo comprueba cada verificador.
 */
import { readFileSync } from 'node:fs';
import { relative, sep } from 'node:path';

/** Rutas siempre con barra normal: el mensaje lo lee una persona, no el sistema de archivos. */
const toPosix = (value) => value.split(sep).join('/');

export const MISSING_ARTIFACT = 'RESEARCH_ARTIFACT_MISSING';
export const UNREADABLE_ARTIFACT = 'RESEARCH_ARTIFACT_UNREADABLE';

export class ResearchArtifactError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ResearchArtifactError';
    this.code = code;
  }
}

/** Texto de un expediente local. Un archivo ausente es un rechazo con instrucciones, no una excepción. */
export function loadTextArtifact(file, regenerate, io = {}) {
  const read = io.read ?? readFileSync;
  const root = io.root ?? process.cwd();
  const shown = toPosix(relative(root, file));
  try {
    return read(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new ResearchArtifactError(MISSING_ARTIFACT, `falta ${shown}. No está en git a propósito: es una salida regenerable del corpus. Regeneralo con: ${regenerate}`);
    }
    throw new ResearchArtifactError(UNREADABLE_ARTIFACT, `no se pudo leer ${shown}: ${error.message}`);
  }
}

/** Lo mismo, ya parseado. Un JSON roto se nombra con su archivo, no con un offset suelto. */
export function loadJsonArtifact(file, regenerate, io = {}) {
  const text = loadTextArtifact(file, regenerate, io);
  const root = io.root ?? process.cwd();
  const shown = toPosix(relative(root, file));
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ResearchArtifactError(UNREADABLE_ARTIFACT, `${shown} no es JSON válido: ${error.message}`);
  }
}

/**
 * Escribe el rechazo si el problema es de expediente y devuelve true. Si el error es otro devuelve
 * false, para que el llamador lo deje explotar: tragarse un error desconocido es peor que el crash.
 */
export function reportArtifactProblem(error, writeError) {
  if (!(error instanceof ResearchArtifactError)) return false;
  writeError(`REJECTED: ${error.code}: ${error.message}`);
  return true;
}
