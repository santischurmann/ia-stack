import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkPhaseMenu, checkPlan, main } from '../scripts/verify-phase-menu.mjs';
import { hashDecision } from '../scripts/verify-phase-decisions.mjs';

const ORDER = ['intake', 'research'];
function row(id, previous = '', offset = 0) {
  const decision = {
    phase_id: id, phase_name: id[0].toUpperCase() + id.slice(1),
    options: ['A) conservar', 'B) cambiar'], recommendation: 'A) conservar', selected_option: 'A) conservar',
    reason: 'se elige por compatibilidad y evidencia', shown_at: `2026-09-01T10:0${offset}:00Z`,
    timestamp: `2026-09-01T10:0${offset + 1}:00Z`, input_hash: 'a'.repeat(64), status: 'decided',
    previous_hash: previous, current_hash: '',
  };
  decision.current_hash = hashDecision(previous, decision, ORDER);
  return decision;
}
function valid() { const first = row('intake', '', 0); const second = row('research', first.current_hash, 2); return { schema: 'vcp.phase-decisions/1', phase_order: ORDER, decisions: [first, second] }; }
const plan = { schema: 'vcp.phase-plan/1', feature: 'demo-feature', phase_order: ORDER };

test('accepts complete decisions against canonical plan', () => assert.equal(checkPhaseMenu(valid(), plan).ok, true));
test('rejects self-declared order mismatch', () => {
  const decisions = valid();
  assert.equal(checkPhaseMenu(decisions, { ...plan, phase_order: ['research', 'intake'] }).violations[0].code, 'PHASE_MENU_PLAN_MISMATCH');
});
test('rejects a plan with duplicate phases', () => assert.equal(checkPlan({ ...plan, phase_order: ['intake', 'intake'] })[0].code, 'PHASE_PLAN_SCHEMA_INVALID'));
test('rejects every malformed plan shape', () => {
  assert.ok(checkPlan(null).length); assert.ok(checkPlan({ ...plan, extra: true }).length);
  assert.ok(checkPlan({ ...plan, schema: 'wrong' }).length); assert.ok(checkPlan({ ...plan, feature: '' }).length);
  assert.ok(checkPlan({ ...plan, phase_order: [] }).length); assert.ok(checkPlan({ ...plan, phase_order: [''] }).length);
  assert.ok(checkPlan({ ...plan, phase_order: 'intake' }).length);
  assert.ok(checkPhaseMenu({}, { ...plan, schema: 'wrong' }).violations.length);
});
test('rejects incomplete decisions in strict mode', () => {
  const decisions = valid(); decisions.decisions.pop();
  assert.equal(checkPhaseMenu(decisions, plan).violations[0].code, 'PHASE_DECISION_PHASE_MISSING');
});
test('rejects malformed decisions document', () => assert.equal(checkPhaseMenu({}, plan).violations[0].code, 'PHASE_DECISION_SCHEMA_INVALID'));
test('main returns usage for invalid args', () => { const errors = []; assert.equal(main(['check', 'x'], () => {}, (m) => errors.push(m)), 2); assert.match(errors[0], /usage:/); });
test('main rejects missing inputs', () => assert.equal(main(['check', 'no-decisions.json', '--plan', 'no-plan.json'], () => {}, () => {},), 1));
test('main covers malformed, unreadable, and successful files', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-phase-menu-')); const errors = []; const output = [];
  try {
    const decisions = join(root, 'decisions.json'); const planPath = join(root, 'plan.json');
    writeFileSync(decisions, '{bad'); writeFileSync(planPath, JSON.stringify(plan));
    assert.equal(main(['check', decisions, '--plan', planPath], output.push.bind(output), errors.push.bind(errors)), 1);
    writeFileSync(decisions, JSON.stringify(valid())); writeFileSync(planPath, '{bad');
    assert.equal(main(['check', decisions, '--plan', planPath], output.push.bind(output), errors.push.bind(errors)), 1);
    assert.equal(main(['check', join(root, 'missing.json'), '--plan', planPath], output.push.bind(output), errors.push.bind(errors)), 1);
    writeFileSync(planPath, JSON.stringify(plan));
    assert.equal(main(['check', join(root, 'missing.json'), '--plan', planPath], output.push.bind(output), errors.push.bind(errors)), 1);
    writeFileSync(join(root, 'bad-decisions.json'), JSON.stringify({}));
    assert.equal(main(['check', join(root, 'bad-decisions.json'), '--plan', planPath], output.push.bind(output), errors.push.bind(errors)), 1);
    assert.equal(main(['check', decisions, '--plan', planPath], output.push.bind(output), errors.push.bind(errors)), 0);
    assert.equal(main(['check', decisions, '--plan', join(root, 'missing-plan.json')], output.push.bind(output), errors.push.bind(errors)), 1);
    assert.equal(main(['check', decisions, '--plan', planPath, '--bad'], output.push.bind(output), errors.push.bind(errors)), 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
