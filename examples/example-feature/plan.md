# Plan: User Authentication — JWT Login

**Date:** 2026-06-19
**Spec:** spec.md
**Status:** Approved

---

## Task Breakdown

| ID | Description | Files | Depends on |
|----|-------------|-------|------------|
| T01 | createTokens(userId) — generate access + refresh JWT | src/auth/tokens.ts | — |
| T02 | hashPassword / verifyPassword — bcrypt wrappers | src/auth/password.ts | — |
| T03 | login endpoint POST /auth/login | src/auth/routes.ts | T01, T02 |
| T04 | authenticateToken middleware | src/auth/middleware.ts | T01 |
| T05 | GET /auth/me protected route | src/auth/routes.ts | T04 |
| T06 | POST /auth/refresh endpoint | src/auth/routes.ts | T01 |
| T07 | E2E: full login + refresh + protected route flow | e2e/auth.e2e.test.ts | T03-T06 |

---

## Execution Order (topological)

1. **T01** — token generation (no deps)
2. **T02** — password utils (no deps) ← parallel with T01
3. **T03** — login endpoint (requires T01, T02)
4. **T04** — middleware (requires T01)
5. **T05** — me endpoint (requires T04)
6. **T06** — refresh endpoint (requires T01)
7. **T07** — e2e (requires all above)

Note: T01 and T02 can be run in parallel (no overlap).

---

## Risk Notes

- T03: test must use test DB or mock user store — do NOT use production DB
- JWT_SECRET: set JWT_SECRET=test-secret-for-tests in test environment
- T07: needs a running Express app — use supertest for in-process HTTP

---

## Subagent assignments

Each task: RED → GREEN → TRIANGULATE → REFACTOR
After all tasks: DOCS (update README auth section) + CHORE (lint + typecheck + coverage + build)
