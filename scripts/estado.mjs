// estado.mjs — lectura de `.ia-stack/ESTADO.md` y fechas argentinas, compartidas por los scripts del
// protocolo (arranque, tamano, aprobar, metricas, leccion). Sin dependencias.
//
// Formato de ESTADO.md (≤60 líneas): `## Fase`, `## Tamaño`, `## Cola` con líneas
// `- [estado] tarea — dueño`, `## Cómo retomar`. Lo viejo se mueve a `historial.md`.

export const MAX_LINEAS = 60;
export const ESTADOS_TAREA = ['pendiente', 'en curso', 'en pausa', 'hecha'];
export const TAMANOS = ['chico', 'medio', 'grande'];

const TAREA = /^-\s*\[([^\]]+)\]\s*(.+?)(?:\s+[—–]\s+(.*))?$/u;

function seccionesDe(texto) {
  const secciones = new Map();
  let actual = null;
  for (const linea of texto.split(/\r?\n/u)) {
    const h = /^##\s+(.+?)\s*$/u.exec(linea);
    if (h) {
      actual = h[1];
      secciones.set(actual, []);
    } else if (actual !== null) secciones.get(actual).push(linea);
  }
  return secciones;
}

const util = (lineas) => lineas.map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('<!--') && !l.startsWith('**Feature slug:**'));

export function parseEstado(texto) {
  const lineas = texto.split(/\r?\n/u);
  const total = texto.endsWith('\n') ? lineas.length - 1 : lineas.length;
  const secciones = seccionesDe(texto);
  const fase = util(secciones.get('Fase') ?? [])[0] ?? null;
  const tam = (util(secciones.get('Tamaño') ?? [])[0] ?? '').toLowerCase();
  const cola = [];
  const invalidas = [];
  for (const l of util(secciones.get('Cola') ?? [])) {
    const m = TAREA.exec(l);
    if (m && ESTADOS_TAREA.includes(m[1].trim().toLowerCase())) {
      cola.push({ estado: m[1].trim().toLowerCase(), tarea: m[2].trim(), dueno: (m[3] ?? '').trim() });
    } else invalidas.push(l);
  }
  return {
    lineas: total,
    fase,
    tamano: TAMANOS.includes(tam) ? tam : null,
    cola,
    invalidas,
    retomar: util(secciones.get('Cómo retomar') ?? []).join(' '),
  };
}

const ZONA = 'America/Argentina/Buenos_Aires';

/** `DD-MM-AAAA HH:MM`, 24 h, hora argentina. */
export function fechaAR(fecha = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hourCycle: 'h23', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      .formatToParts(fecha).map((x) => [x.type, x.value]),
  );
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`;
}
