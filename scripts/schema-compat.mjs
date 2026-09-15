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
// no migrar nunca y nada se lo va a decir. Lo que SÍ hay desde el 2026-09-15 es un contador, y es
// la diferencia entre una deuda eterna y una retirable: `leidosConNombreViejo()` dice cuántos de
// los schemas leídos en esta corrida traían el nombre viejo. Es una foto del proceso, no un
// histórico — se reinicia en cada corrida —, así que responde «se usa acá y ahora», nunca «nadie lo
// usa en ningún lado».

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
  return COMPARTIDO.mirar(valor, esperado);
}

/**
 * UNA COMPATIBILIDAD QUE NO SE PUEDE MEDIR SE QUEDA PARA SIEMPRE. Este modulo declara por escrito
 * que no sabe cuando termina la tolerancia; el contador es lo que hace falta para poder retirarla:
 * sin un numero, dentro de un ano nadie va a poder decir si todavia sirve o si ya no la usa nadie.
 *
 * NO CAMBIA NINGUN VEREDICTO. Cuenta, y nada mas. Y cuenta solo lo que COINCIDIO: sumar los
 * rechazos inflaria el uso del nombre viejo con artefactos que ni siquiera son de esa familia.
 */
export function contarLegado() {
  return {
    total: 0,
    legado: 0,
    mirar(valor, esperado) {
      if (!esCadena(valor) || !esCadena(esperado) || !esperado.startsWith(PREFIJO)) return false;
      const viejo = aLegado(esperado);
      if (valor !== esperado && valor !== viejo) return false;
      this.total += 1;
      if (valor === viejo && viejo !== esperado) this.legado += 1;
      return true;
    },
    resumen() {
      if (this.total === 0) return 'compatibilidad de nombre: nada que contar todavía, ningún schema se comparó.';
      const base = `compatibilidad de nombre: en esta corrida, ${this.legado} de ${this.total} schema(s) leído(s) traían el prefijo viejo ${LEGADO}`;
      // NO se dice «nadie la usa». Una corrida que leyo un schema no habla del mundo: habla de esa
      // corrida. Para retirar la tolerancia hace falta que el numero sea cero SOSTENIDO, no una foto.
      return this.legado === 0
        ? `${base}. Cero acá: para retirarla hace falta que siga en cero corrida tras corrida, no una sola vez.`
        : `${base}. Mientras ese número no sea cero, retirarla rompe artefactos que todavía existen.`;
    },
  };
}

/**
 * El contador COMPARTIDO, que es el unico numero que sirve. Uno por gate diria «este gate leyo dos
 * artefactos viejos» y nadie sumaria los 29; lo que se quiere saber es del protocolo entero.
 */
const COMPARTIDO = contarLegado();

/** Lo leido hasta ahora en este proceso. Es una foto, no un historico: se reinicia en cada corrida. */
export function leidosConNombreViejo() {
  return { total: COMPARTIDO.total, legado: COMPARTIDO.legado, resumen: COMPARTIDO.resumen() };
}
