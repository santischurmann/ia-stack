# Spec: User Authentication — JWT Login

**Date:** 2026-06-19
**Version:** 1.0
**Author:** Opus (VibeCodeProtocols)
**Status:** Approved

---

## Problem / Problema

Users cannot log in to the application. We need a secure JWT-based authentication
system with access tokens (15 min) and refresh tokens (7 days).

---

## Target Users / Usuarios

Registered users who need to authenticate to access protected routes.

---

## Acceptance Criteria / Criterios de aceptación

- [ ] **AC1:** GIVEN a valid email + password, WHEN POST /auth/login, THEN returns { accessToken, refreshToken } with 200
- [ ] **AC2:** GIVEN an invalid password, WHEN POST /auth/login, THEN returns 401 with message "Invalid credentials"
- [ ] **AC3:** GIVEN a valid accessToken in Authorization header, WHEN GET /auth/me, THEN returns user profile
- [ ] **AC4:** GIVEN an expired accessToken, WHEN GET /auth/me, THEN returns 401 with message "Token expired"
- [ ] **AC5:** GIVEN a valid refreshToken, WHEN POST /auth/refresh, THEN returns new { accessToken }
- [ ] **AC6:** GIVEN a non-existent email, WHEN POST /auth/login, THEN returns 401 (same message as wrong password — no user enumeration)

---

## Constraints / Restricciones

- JWT secret must come from environment variable JWT_SECRET (never hardcoded)
- Passwords stored as bcrypt hashes (cost factor 12)
- No user enumeration: identical error messages for wrong email and wrong password
- Access token: 15 minutes. Refresh token: 7 days.

---

## Non-Goals / No-Goals

- Social login (OAuth) — future feature
- Password reset flow — separate spec
- 2FA — separate spec

---

## Stack & Dependencies

- **Stack:** TypeScript / Node.js / Express
- **Test runner:** vitest
- **New dependencies:** jsonwebtoken@9, bcryptjs@2 (both well-audited, MIT)

---

## Definition of Done (DoD)

- [ ] All 6 ACs: unit + integration + e2e tests
- [ ] Coverage 100% for every metric the runner measures (lines/branches/functions)
- [ ] Lint: 0 errors | Typecheck: 0 errors
- [ ] JWT_SECRET never appears in logs or responses
- [ ] CHANGELOG entry added
- [ ] .vibe/ updated
