// schema-compat.mjs — los schemas de los artefactos del protocolo, en UN solo lugar.
//
// Cada artefacto que el protocolo produce (recibos, contratos, paquetes de Discovery, planes de
// fase) declara un `schema` con el prefijo `ia.`. Los gates lo comparan por igualdad exacta: un
// schema es un identificador, no una descripción. `ia.receipt/v2` y `ia.receipt/v3` son distintos y
// ninguno acepta al otro.
//
// No hay compatibilidad con prefijos anteriores: un artefacto con otro prefijo se rechaza.

/** El prefijo de todo schema. */
export const PREFIJO = 'ia.';

/**
 * ¿`valor` es exactamente el schema `esperado`?
 *
 * Un `esperado` sin el prefijo `ia.` nunca coincide: un gate que declara mal su constante tiene que
 * fallar ruidoso y no seguir andando con una comparación que parece funcionar.
 */
export function mismoSchema(valor, esperado) {
  const esCadena = (v) => typeof v === 'string' && v.length > 0;
  if (!esCadena(valor) || !esCadena(esperado) || !esperado.startsWith(PREFIJO)) return false;
  return valor === esperado;
}
