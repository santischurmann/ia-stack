// Esfuerzo low obligatorio, presupuesto de tokens y detector de complejidad (regla).
//
// POR QUE EXISTE. La escalera de 8 peldaños decía qué modelo usar pero no cuánto esfuerzo por
// defecto ni cuánto cupo gastar por día y por hora; cada sesión elegía `effort` a ojo y el cupo
// de la ventana de 5 h se iba antes de tiempo. La regla: low siempre, Opus medium
// sólo para el orquestador que habla con la persona, presupuesto 14 %/día y 20 %/hora, freno al 85 %.
//
// LO QUE NO CUBRE: que la sesión efectivamente llame set_session_effort o get_usage; eso pasa en la
// conversación y ninguna prueba portable lo ve.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { clasificarTarea, esfuerzoPermitido, ritmoPresupuesto } from '../scripts/clasificar-tarea.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const contrato = () => JSON.parse(readFileSync(join(repoRoot, 'contracts/model-routing.json'), 'utf8'));
const script = join(repoRoot, 'scripts/clasificar-tarea.mjs');

test('el contrato fija esfuerzo low en todos los niveles y roles', () => {
  for (const [id, nivel] of Object.entries(contrato().niveles)) assert.equal(nivel.esfuerzo, 'low', id);
  for (const [id, rol] of Object.entries(contrato().roles)) assert.equal(rol.esfuerzo, 'low', id);
});

test('el contrato fija el presupuesto diario, horario y el freno', () => {
  const p = contrato().presupuesto;
  assert.equal(p.por_dia, 0.14);
  assert.equal(p.por_hora_ventana_5h, 0.2);
  assert.equal(p.freno_ventana_5h, 0.85);
  assert.match(p.medir_con, /get_usage/u);
});

test('el contrato declara el encargo: modo breve, brief, reporte y handoff', () => {
  const a = contrato().encargo;
  assert.equal(a.modo_breve_entre_agentes, 'full');
  assert.equal(a.brief_max_tokens, 4000);
  assert.equal(a.brief_max_archivos, 3);
  assert.equal(a.reporte_max_lineas, 40);
  assert.equal(a.handoff_desde, contrato().contexto.aviso_desde);
});

test('esfuerzoPermitido: sólo low; medium y high no existen', () => {
  assert.equal(esfuerzoPermitido({ modelo: 'haiku', esfuerzo: 'low' }), true);
  assert.equal(esfuerzoPermitido({ modelo: 'sonnet', esfuerzo: 'high' }), false);
  assert.equal(esfuerzoPermitido({ modelo: 'opus', esfuerzo: 'medium' }), false);
  assert.equal(esfuerzoPermitido({ modelo: 'opus', esfuerzo: 'medium', primerNivel: true }), false);
});

test('clasificarTarea: piso por riesgo manda a opus aunque el texto parezca mecánico', () => {
  for (const t of ['renombrar variable en el webhook de pagos', 'migración de la tabla users',
    'tocar la auth del login', 'revisar RLS y seguridad', 'cobrar la factura al cliente', 'guardar el secret en el vault']) {
    const r = clasificarTarea(t);
    assert.equal(r.clase, 'alto_requisito', t);
    assert.equal(r.nivel, 'fuerte', t);
    assert.equal(r.modelo, 'opus', t);
    assert.equal(r.esfuerzo, 'low', t);
    assert.equal(r.por_riesgo, true, t);
  }
});

test('clasificarTarea: alto requisito sin riesgo (revisión adversarial, diseño) va a opus', () => {
  const r = clasificarTarea('revisión adversarial del diff');
  assert.deepEqual([r.clase, r.modelo, r.por_riesgo], ['alto_requisito', 'opus', false]);
});

test('clasificarTarea: mecánico va a haiku y patrón conocido a sonnet', () => {
  assert.equal(clasificarTarea('leer logs y resumir git status').modelo, 'haiku');
  assert.equal(clasificarTarea('buscar dónde se define foo').nivel, 'barato');
  assert.equal(clasificarTarea('escribir tests de la pantalla de perfil').modelo, 'sonnet');
  assert.equal(clasificarTarea('algo sin señales claras').nivel, 'medio', 'sin señal: patrón conocido');
});

test('ritmoPresupuesto: dentro, encima del ritmo y freno', () => {
  assert.equal(ritmoPresupuesto({ semanal: 0.10, dias: 1, ventana: 0.1, horas: 1 }).estado, 'ok');
  assert.equal(ritmoPresupuesto({ semanal: 0.30, dias: 1, ventana: 0.1, horas: 1 }).estado, 'encima');
  assert.equal(ritmoPresupuesto({ semanal: 0.10, dias: 1, ventana: 0.5, horas: 1 }).estado, 'encima');
  assert.equal(ritmoPresupuesto({ semanal: 0.10, dias: 1, ventana: 0.86, horas: 5 }).estado, 'freno');
});

test('CLI: clasifica el texto y sale 0; sin texto sale 2', () => {
  const out = JSON.parse(execFileSync(process.execPath, [script, 'migración de pagos'], { encoding: 'utf8' }));
  assert.equal(out.modelo, 'opus');
  assert.throws(() => execFileSync(process.execPath, [script], { stdio: 'pipe' }), (e) => e.status === 2);
});

test('clasificarTarea: las áreas de riesgo salen de contracts/tamano.json y son genéricas', () => {
  const tam = JSON.parse(readFileSync(join(repoRoot, 'contracts/tamano.json'), 'utf8'));
  assert.deepEqual(Object.keys(tam.reglas.palabras_riesgo).sort(), [...tam.reglas.riesgos].sort());
  const fuente = readFileSync(script, 'utf8');
  assert.doesNotMatch(fuente, /RIESGO = \//u, 'las palabras de riesgo no se escriben en el script');
  assert.equal(clasificarTarea('backtest de la estrategia').por_riesgo, false);
});

test('siguienteNivel: una falla sube un nivel según escalada.por_falla del contrato', async () => {
  const { siguienteNivel } = await import('../scripts/clasificar-tarea.mjs');
  assert.equal(siguienteNivel('barato'), 'medio');
  assert.equal(siguienteNivel('medio'), 'fuerte');
});

test('siguienteNivel: sin siguiente devuelve null (frenar y preguntarle a la persona)', async () => {
  const { siguienteNivel } = await import('../scripts/clasificar-tarea.mjs');
  for (const n of ['fuerte', 'x', undefined, '__proto__', 'constructor']) assert.equal(siguienteNivel(n), null);
});

test('siguienteNivel: un contrato sin escalada.por_falla lanza', async () => {
  const { siguienteNivel } = await import('../scripts/clasificar-tarea.mjs');
  assert.throws(() => siguienteNivel('barato', { escalada: {} }), /contrato sin escalada\.por_falla/u);
  assert.throws(() => siguienteNivel('barato', {}), /contrato sin escalada\.por_falla/u);
});

test('skills/encargo.md trae la plantilla de falla para subir de nivel', () => {
  const texto = readFileSync(new URL('../skills/encargo.md', import.meta.url), 'utf8');
  for (const campo of ['comando:', 'salida:', 'archivo:línea:', 'ya probado:']) assert.ok(texto.includes(campo), `falta ${campo}`);
});
