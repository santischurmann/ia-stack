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
// LA FECHA DE CORTE, y por qué NO apaga la lectura. Desde el 2026-09-16 la tolerancia vence: el
// `CORTE` de abajo dice cuándo, y `estadoDeCompatibilidad()` lo convierte en `vigente`,
// `por_vencer` —los últimos 60 días, para que el aviso llegue con tiempo de migrar— o `vencida`.
// Lo que vence es el permiso de **seguir produciendo** artefactos con el nombre viejo, nunca el de
// leerlos: la evidencia sellada de `docs/discovery/**` declara el prefijo viejo y es append-only
// por invariante del protocolo, así que un corte que devolviera `false` a partir de cierto día
// invalidaría la historia entera del repositorio un martes cualquiera. `mismoSchema` no mira el
// calendario y no lo va a mirar. Quien escala es el gate que ya imprimía el contador.
//
// LÍMITE HONESTO. Esto hace que un artefacto viejo **se lea**, no que sea correcto: lo que el gate
// comprueba después es exactamente lo mismo que antes. Y el corte prueba que la tolerancia se pueda
// retirar, no que alguien la retire: lo que hay es un contador y una fecha. `leidosConNombreViejo()`
// dice cuántos de los schemas leídos en esta corrida traían el nombre viejo, y es una foto del
// proceso, no un histórico — se reinicia en cada corrida —, así que responde «se usa acá y ahora»,
// nunca «nadie lo usa en ningún lado»: retirarla pide cero sostenido, no un cero suelto.

/** El prefijo vigente. Todo artefacto nuevo lo escribe. */
export const PREFIJO = 'ia.';

/** El prefijo anterior al cambio de nombre. Se acepta al leer, nunca se escribe. */
export const LEGADO = 'vcp.';

/**
 * Cuando vence la tolerancia. Seis meses desde el renombre del 2026-09-15: alcanza para que
 * cualquier proyecto vivo migre sus artefactos y es corto como para que «transitoria» signifique
 * algo. Es una fecha escrita, no una promesa: `estadoDeCompatibilidad()` la compara contra el día.
 */
export const CORTE = '2027-03-15';

/** Cuántos días antes del corte empieza a avisar. Avisar el mismo día no alcanza para migrar nada. */
const AVISO_DIAS = 60;
const DIA_MS = 86_400_000;

const enUTC = (iso) => Date.parse(`${iso}T00:00:00Z`);
const hoyISO = () => new Date().toISOString().slice(0, 10);

/**
 * ¿En qué punto de su vida está la compatibilidad? Tres estados y no dos, por el mismo motivo que
 * el resto del protocolo: `por_vencer` es el que sirve, porque es el único que todavía da tiempo.
 *
 * El día exacto del corte cuenta como `por_vencer` y no como `vencida`: un vencimiento se cumple
 * DESPUÉS de la fecha, y hacer que el propio día ya rechace convierte un plazo en una trampa.
 */
export function estadoDeCompatibilidad(hoy = hoyISO()) {
  const dias = Math.round((enUTC(CORTE) - enUTC(hoy)) / DIA_MS);
  const estado = dias < 0 ? 'vencida' : dias <= AVISO_DIAS ? 'por_vencer' : 'vigente';
  return { estado, dias, corte: CORTE };
}

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
    resumen(hoy = hoyISO()) {
      const { estado, dias, corte } = estadoDeCompatibilidad(hoy);
      if (this.total === 0) return `compatibilidad de nombre: nada que contar todavía, ningún schema se comparó. Vence el ${corte}.`;
      const base = `compatibilidad de nombre: en esta corrida, ${this.legado} de ${this.total} schema(s) leído(s) traían el prefijo viejo ${LEGADO}`;
      // NO se dice «nadie la usa». Una corrida que leyo un schema no habla del mundo: habla de esa
      // corrida. Para retirar la tolerancia hace falta que el numero sea cero SOSTENIDO, no una foto.
      if (estado === 'vencida') {
        return this.legado === 0
          ? `${base}. La tolerancia venció el ${corte} y acá no se leyó ninguno: se puede retirar, y conviene hacerlo antes de que vuelva a aparecer.`
          : `${base}. La tolerancia venció el ${corte} hace ${Math.abs(dias)} día(s) y todavía se están leyendo artefactos viejos: hay que migrarlos, no correr la fecha.`;
      }
      const plazo = estado === 'por_vencer'
        ? ` Vence el ${corte}: quedan ${dias} día(s).`
        : ` Vence el ${corte}.`;
      return this.legado === 0
        ? `${base}. Cero acá: para retirarla hace falta que siga en cero corrida tras corrida, no una sola vez.${plazo}`
        : `${base}. Mientras ese número no sea cero, retirarla rompe artefactos que todavía existen.${plazo}`;
    },
  };
}

/**
 * El contador COMPARTIDO, que es el unico numero que sirve. Uno por gate diria «este gate leyo dos
 * artefactos viejos» y nadie sumaria los 29; lo que se quiere saber es del protocolo entero.
 */
const COMPARTIDO = contarLegado();

/** Lo leido hasta ahora en este proceso. Es una foto, no un historico: se reinicia en cada corrida. */
export function leidosConNombreViejo(hoy = hoyISO()) {
  return { total: COMPARTIDO.total, legado: COMPARTIDO.legado, ...estadoDeCompatibilidad(hoy), resumen: COMPARTIDO.resumen(hoy) };
}
