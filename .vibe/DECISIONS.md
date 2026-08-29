# Architectural Decisions

Append-only log. One entry per decision.
Format: ## [YYYY-MM-DD] Decision: <title>

---

## [YYYY-MM-DD] Decision: (first decision here)

**Context:**
**Options considered:**
- Option A:
- Option B:
**Decision:** Option A
**Reason:**
**Consequences:**

---

## [2026-08-29] Decisión: no reconstruir las 8 decisiones de la noche del 2026-08-28

**Qué se decidió:** `docs/phase-decisions.json` se crea con las decisiones que se pueden sostener
con evidencia, y **no** con las ocho de la sesión nocturna del 28.

**Por qué:** `SESSION.md` registró de esas ocho sólo la opción elegida —una tabla
"Decisión | Elegido"—. No guardó el menú que se mostró ni las marcas de tiempo, que es justo lo que
el gate exige. Reconstruirlas significaba inventar ocho menús y dieciséis timestamps **dentro del
archivo que respalda la afirmación de consentimiento del protocolo**. El propio gate declara que no
puede detectar eso: "detecta lo imposible, no lo mentiroso". Un registro de consentimiento
fabricado es peor que ninguno, porque el segundo se nota y el primero no.

**Qué queda:** las ocho siguen documentadas en `.vibe/SESSION.md` como narración, que es lo que
son. No se promueven a registro verificable.

**Corrección al proceso:** el hueco no fue de las personas, fue del protocolo — pedía mostrar el
menú 🔵 pero no obligaba a escribirlo en ninguna parte en el momento. Corregido en `SKILL.md`:
la decisión se registra cuando ocurre, con su menú y su hora, o no se registra nunca.

## [2026-08-29] Decisión: alcance de la adopción de shadcn/ui e instatic

**Elegido:** contrato + gate + restyle, sobre las alternativas de sólo-gate, sólo-restyle y
sólo-informe. Registrado con su menú completo en `docs/phase-decisions.json`.

**Por qué:** adoptar convenciones de diseño sin un detector las deja como decoración, que es
exactamente lo que este proyecto persigue. Y no se adoptó el stack —React, Tailwind, Radix— porque
VCP declara cero dependencias: lo que transfiere es el modelo de contrato declarado, no la
tecnología.
