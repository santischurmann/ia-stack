// schema-compat.mjs — el protocolo cambió de nombre y los artefactos ya escritos siguen valiendo.
//
// EL PROBLEMA, medido el 2026-09-15 antes de tocar nada: **42 familias de schema** llevaban el
// prefijo `vcp.`, y cada artefacto que el protocolo produce lo declara — recibos, contratos,
// paquetes de Discovery, planes de fase—. Los gates lo comparan por igualdad exacta, que es
// correcto: un schema es un identificador, no una descripción. Renombrarlo de golpe convertiría en
// inválido todo lo que este repositorio y cualquier instalación produjeron hasta hoy, y el registro
// de lo que pasó no se reescribe para que cierre con el nombre nuevo.
//
// LA SALIDA: **aceptar el viejo, escribir el nuevo**. Es la migración de siempre, y lo único que
// importa es que la tolerancia viva en UN SOLO LUGAR con su límite escrito. Si cada gate hiciera su
// propia excepción, en seis meses habría 42 reglas distintas sobre qué se acepta y nadie sabría cuál
// es la vigente — el mismo error que este repositorio ya evitó reusando la redacción de
// `validateDeclaredField` en vez de escribirla dos veces.
//
// LO QUE NO ES. No es un traductor de versiones: `ia.receipt/v2` y `ia.receipt/v3` siguen siendo
// distintos y ninguno acepta al otro. La equivalencia es **sólo del prefijo**, con la misma familia
// y la misma versión. Y va en una sola dirección: un artefacto con el nombre nuevo no pasa por un
// gate que todavía espera el viejo, porque eso sería aceptar un futuro que nadie escribió.
//
// LÍMITE HONESTO. Esto hace que un artefacto viejo **se lea**, no que sea correcto: lo que el gate
// comprueba después es exactamente lo mismo que antes. Y no sabe cuándo termina la compatibilidad —
// no hay fecha de corte ni aviso: mientras esta función acepte el prefijo viejo, un proyecto puede
// no migrar nunca y nada se lo va a decir.

/** El prefijo vigente. Todo artefacto nuevo lo escribe. */
export const PREFIJO = 'ia.';

/** El prefijo anterior al cambio de nombre. Se acepta al leer, nunca se escribe. */
export const LEGADO = 'vcp.';

const esCadena = (v) => typeof v === 'string' && v.length > 0;

/** La forma vieja de un schema, para poder nombrarla en un mensaje de rechazo. */
export function aLegado(schema) {
  if (!esCadena(schema) || !schema.startsWith(PREFIJO)) return schema;
  return LEGADO + schema.slice(PREFIJO.length);
}

/**
 * ¿`valor` es el schema `esperado`, con cualquiera de los dos prefijos?
 *
 * `esperado` es siempre el nombre nuevo: es lo que los gates declaran. Un `esperado` sin el prefijo
 * vigente no se compara contra nada — se devuelve `false` en vez de caer a una igualdad simple,
 * porque un gate que se olvidó de migrar su constante tiene que fallar ruidoso y no seguir andando
 * con una comparación que parece funcionar.
 */
export function mismoSchema(valor, esperado) {
  if (!esCadena(valor) || !esCadena(esperado) || !esperado.startsWith(PREFIJO)) return false;
  return valor === esperado || valor === aLegado(esperado);
}
