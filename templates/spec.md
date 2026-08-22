# Spec: <feature-name>

**Date:** <YYYY-MM-DD>
**Version:** 1.0
**Author:** Opus (VibeCodeProtocols)
**Status:** Draft
**Word cap:** ~650 words for this document (excl. tables/code blocks). A spec nobody reads
poisons every phase that follows — tables before narration, headers organize, they don't explain.
(source: `research/sources/protocolo-muralla.md` point #8)

---

## Problem / Problema

<1-3 sentences: what problem does this solve and why it matters.>

---

## Target Users / Usuarios

<Who uses this? Role, context, how often.>

---

## Acceptance Criteria / Criterios de aceptación

- [ ] **AC1:** GIVEN <state>, WHEN <action>, THEN <result>
- [ ] **AC2:** GIVEN <state>, WHEN <action>, THEN <result>
- [ ] **AC3 (edge):** GIVEN <edge condition>, WHEN <action>, THEN <result>
- [ ] **AC4 (error):** GIVEN <invalid input>, WHEN <action>, THEN <error type + message>

**Requirement grammar and ambiguity gate:** write every event-driven AC as
`GIVEN …, WHEN …, THEN …`; write invariants as `THE SYSTEM SHALL …`. During drafting only, an
unresolved requirement must be written verbatim as `[NEEDS CLARIFICATION: <specific question>]`.
A spec containing that marker cannot move to **Approved**, Plan, or Build — resolve it with the
user or explicitly remove the affected scope first.

---

## Constraints / Restricciones

- <Must use X>
- <Must not break Y>
- <Performance requirement>

---

## Non-Goals / No-Goals

This spec does NOT cover:
- <Exclusion 1>
- <Exclusion 2>

---

## Stack & Dependencies

- **Stack:** <auto-detected>
- **Test runner:** <detected>
- **New dependencies:** none | <package@version — reason>

---

## Definition of Done (DoD)

- [ ] Forcing Questions: 6/6 respondidas, o "skipped(N)" (ambos son estados válidos)
- [ ] All ACs: unit + integration + e2e tests
- [ ] Coverage 100% for every metric the runner measures (lines/branches/functions)
- [ ] Lint: 0 errors | Typecheck: 0 errors
- [ ] README updated (if user-facing)
- [ ] CHANGELOG entry added
- [ ] .vibe/ updated
