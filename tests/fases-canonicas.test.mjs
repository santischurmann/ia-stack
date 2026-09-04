// Un solo vocabulario de fases, para humanos.
//
// El repositorio tenía CINCO vocabularios y ninguno coincidía con otro. `SKILL.md` declara once
// fases; la tabla del README declaraba seis empezando en cero, sin que ningún número coincidiera;
// `AGENTS.md` decía nueve. Uno de los cinco llegaba a asignar el número 4 a dos fases distintas
// dentro del mismo checklist.
//
// Eso no es un detalle de redacción. Quien lee el README aprende una numeración, abre `SKILL.md` y
// encuentra otra, y a partir de ahí ninguna instrucción que diga «volvé a la fase 4» significa algo.
//
// LO QUE ESTA COMPROBACIÓN CUBRE Y LO QUE NO, dicho de frente:
//   - Cubre la documentación para humanos: `SKILL.md` es el canónico, y el README y `AGENTS.md`
//     tienen que coincidir con él.
//   - NO toca los espacios de nombres de las máquinas —`templates/phase-plan.json`,
//     `phase-decisions`, el `I0..I3` de Discovery—. Son internos, consistentes entre sí, y ya
//     tienen sus propios gates. Alinearlos con la prosa no le sirve a ningún lector y sí arriesga
//     sellos: `verify-phase-decisions.mjs` mete el prefijo del orden dentro del hash de cada
//     decisión, así que reordenar invalida lo ya sellado.
//   - NO comprueba que la descripción de cada fase sea correcta. Compara identidad y orden, no
//     contenido: una tabla con los once nombres bien y las explicaciones cambiadas pasa igual.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// `SKILL.md` SÍ viaja al runtime instalado, pero el README no. La comprobación cruzada sólo tiene
// sentido en el checkout fuente.
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};

/** Las fases tal como las declara el canónico: `## PHASE <n> — <NOMBRE>`. No hay lista escrita a
 * mano: si mañana se agrega una fase al documento, esta función la ve sola. */
export function fasesCanonicas(texto) {
  return [...texto.matchAll(/^## PHASE ([0-9.]+) — ([A-ZÁÉÍÓÚÑ]+)/gmu)]
    .map((m) => ({ numero: m[1], nombre: m[2] }));
}

/** Las filas de la tabla de flujo del README: `| <n>. <Nombre> | … |`. */
export function fasesDelReadme(texto) {
  return [...texto.matchAll(/^\|\s*([0-9.]+)\.\s*([^|]+?)\s*\|/gmu)]
    .map((m) => ({ numero: m[1], nombre: m[2].trim() }));
}

test('SKILL.md declara once fases y ninguna se repite', SOLO_FUENTE, () => {
  const fases = fasesCanonicas(readFileSync(join(repoRoot, 'SKILL.md'), 'utf8'));
  assert.equal(fases.length, 11, `el canónico declara ${fases.length} fases: ${fases.map((f) => f.numero).join(', ')}`);
  assert.deepEqual(
    fases.map((f) => f.numero),
    ['1', '1.5', '2', '3', '4', '5', '5.5', '6', '7', '8', '9'],
  );
  const nombres = fases.map((f) => f.nombre);
  assert.equal(new Set(nombres).size, nombres.length, 'dos fases con el mismo nombre no son dos fases');
});

test('la tabla del README nombra las mismas fases que el canónico, con los mismos números', SOLO_FUENTE, () => {
  const canonicas = fasesCanonicas(readFileSync(join(repoRoot, 'SKILL.md'), 'utf8'));
  const readme = fasesDelReadme(readFileSync(join(repoRoot, 'README.md'), 'utf8'));
  assert.ok(readme.length > 0, 'no se encontró ninguna fila de fase en el README: la comprobación no midió nada');
  assert.deepEqual(
    readme.map((f) => f.numero),
    canonicas.map((f) => f.numero),
    'los números del README no son los del canónico',
  );
  // El nombre se compara sin distinguir caja ni acentos del canónico, que va en mayúsculas.
  const normal = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  assert.deepEqual(readme.map((f) => normal(f.nombre)), canonicas.map((f) => normal(f.nombre)));
});

const PALABRA = { nueve: 9, diez: 10, once: 11, doce: 12, trece: 13 };

/** Todo documento que afirme cuántas fases son, dónde sea. No hay lista de archivos: se busca la
 * FORMA «son N fases» en lo versionado. Empezó nombrando `AGENTS.md` y se descubrió que el puntero
 * de Codex —que el instalador copia a cada proyecto— decía otro número. */
export function cuentasDeFases(archivos, leer) {
  const dichas = [];
  for (const archivo of archivos) {
    let texto;
    try { texto = leer(archivo); } catch { continue; }
    for (const m of texto.matchAll(/son\s+([\wáéíóú]+)\s+fases/giu)) {
      dichas.push({ archivo, dicho: m[1], valor: PALABRA[m[1].toLowerCase()] ?? Number(m[1]) });
    }
  }
  return dichas;
}

test('todo documento que dice cuántas fases son coincide con el canónico', SOLO_FUENTE, () => {
  const canonicas = fasesCanonicas(readFileSync(join(repoRoot, 'SKILL.md'), 'utf8'));
  const versionados = spawnSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
    .stdout.split('\n').map((l) => l.trim()).filter((f) => f.endsWith('.md'));
  assert.ok(versionados.length > 0, 'git ls-files vino vacío: la comprobación no midió nada');
  // El CHANGELOG y la traza sellada quedan afuera: son registro histórico y nombran lo que se creía
  // entonces. Reescribirlos sería falsear el registro, que es la regla que este repositorio ya tiene.
  const vivos = versionados.filter((f) => f !== 'CHANGELOG.md' && !f.startsWith('.vibe/'));
  const dichas = cuentasDeFases(vivos, (f) => readFileSync(join(repoRoot, f), 'utf8'));
  assert.ok(dichas.length > 0, 'ningún documento dice cuántas fases son: sin eso no hay nada que comparar');
  assert.deepEqual(
    dichas.filter((d) => d.valor !== canonicas.length).map((d) => `${d.archivo} dice «${d.dicho}»`),
    [],
    `el canónico declara ${canonicas.length} fases`,
  );
});

test('FALSIFICACIÓN · la cuenta se lee en número y en palabra, y sólo donde se afirma', () => {
  const leer = (f) => ({
    'a.md': 'son once fases con gates',
    'b.md': 'son 9 fases encadenadas',
    'c.md': 'las fases son varias y no dice cuántas',
  }[f]);
  const r = cuentasDeFases(['a.md', 'b.md', 'c.md'], leer);
  assert.deepEqual(r.map((d) => [d.archivo, d.valor]), [['a.md', 11], ['b.md', 9]]);
});

test('FALSIFICACIÓN · el lector de fases distingue un encabezado de fase de cualquier otro', () => {
  const texto = [
    '## PHASE 1 — BOOTSTRAP',
    'texto suelto',
    '## PHASE 1.5 — INTAKE (antes de Research)',
    '## Otra sección — QUE NO ES FASE',
    '### PHASE 9 — NO CUENTA porque es h3',
  ].join('\n');
  assert.deepEqual(fasesCanonicas(texto), [
    { numero: '1', nombre: 'BOOTSTRAP' },
    { numero: '1.5', nombre: 'INTAKE' },
  ]);
});

test('FALSIFICACIÓN · el lector de la tabla del README no confunde una fila cualquiera', () => {
  const tabla = [
    '| Fase | Pregunta | Resultado |',
    '|---|---|---|',
    '| 1. Bootstrap | ¿qué proyecto? | contexto |',
    '| 1.5. Intake | ¿alcanza? | triage |',
    '| algo sin número | x | y |',
  ].join('\n');
  assert.deepEqual(fasesDelReadme(tabla), [
    { numero: '1', nombre: 'Bootstrap' },
    { numero: '1.5', nombre: 'Intake' },
  ]);
});

// --- Números que envejecen -----------------------------------------------------------------------
//
// El README decía «los 36 chequeos» y eran 42. Nadie lo notó porque ningún gate mira ese número: es
// prosa. La misma clase de defecto que tenía la descripción del repositorio en GitHub, que hablaba
// de garantías vencidas — con el agravante de que ahí ningún gate del proyecto puede llegar.
//
// La regla no exige que el número esté bien: exige que NO HAYA número. Un conteo que hay que
// mantener a mano se desactualiza; la tabla de `skills/gates.md` ya es la fuente, y hay una prueba
// que la obliga a nombrar todos los gates que existen.

export function conteosDeChequeos(texto) {
  const encontrados = [];
  for (const m of texto.matchAll(/\b(\d+)\s+(chequeos|gates|checks|verificaciones|pruebas)\b/giu)) {
    encontrados.push(m[0]);
  }
  return encontrados;
}

test('el README no afirma cuántos chequeos hay: ese número se desactualiza solo', SOLO_FUENTE, () => {
  assert.deepEqual(conteosDeChequeos(readFileSync(join(repoRoot, 'README.md'), 'utf8')), []);
});

test('FALSIFICACIÓN · la regla ve el conteo y no confunde una cifra cualquiera', () => {
  assert.deepEqual(conteosDeChequeos('Los 36 chequeos que trae'), ['36 chequeos']);
  assert.deepEqual(conteosDeChequeos('42 gates declarados'), ['42 gates']);
  assert.deepEqual(conteosDeChequeos('once fases, 7 días, 100 % de cobertura'), []);
});
