## PHASE 7 — SIMPLIFY

Sacar lo que sobra, recién ahora: simplificar antes de que la revisión adversarial haya corrido
es reordenar código que todavía puede estar mal.

**7.1 Risk classification + Simplify** — antes de tocar un solo archivo, clasificá el
changeset. Mecánico, basado en evidencia — nunca "se ve grande":

```
risk_reasons:
- simplify_ignore_touch — alguna línea cambiada cae dentro de un bloque `simplify-ignore`
  existente (grep del marcador, comparar el rango contra `git diff -U0`)
- sensitive_path        — el diff toca un path listado en `.vibe/PROJECT.md` § Risk-sensitive
  paths. Si el repo contiene fuentes que NO versiona y esa sección está VACÍA → tratar como
  `sensitive_path` igual (fail-safe: vacío no es "sin riesgo", es "sin configurar")
- large_change          — >400 líneas cambiadas. NUNCA promueve a `alto` por sí sola —
  solo cuenta si coincide con otra reason (evita penalizar un refactor mecánico grande
  igual que un cambio chico en license.py)
- debt_reopened         — el diff toca un file:line ya logueado en `.vibe/DEBT.md`

risk_level:
- critico:  sensitive_path junto con otra reason cualquiera (2+ reasons donde una es
            sensitive_path) — OR 6.2 encontró un finding Critical que requirió fix.
- alto:     simplify_ignore_touch OR sensitive_path (solas) OR 2+ reasons sin sensitive_path.
- estandar: exactamente 1 reason no-`large_change` (incluye large_change solo si acompaña otra).
- bajo:     0 reasons.
```

Boy Scout (dead code, dup, premature abstraction, no new features) corre como antes — excepto:
las líneas dentro de un `simplify_ignore_touch` son de solo lectura, nunca se tocan. Tests
en verde después de cada archivo. El resumen del diff, el `risk_level` y los `risk_reasons` van a
`.vibe/SESSION.md`.

**7.2 Re-verificar después de simplificar** — la suite completa vuelve a correr sobre el estado
ya simplificado:

```bash
<test_command_with_coverage>
```

No es ceremonia. Simplificar toca código que ya estaba verde, y **simplificar sin volver a
verificar es exactamente cómo se rompe algo en silencio**. Si esto sale rojo, la fase no cerró:
se reporta qué se rompió y se arregla antes de tocar la Fase 8.

**7.3 La decisión de la fase.**

🔵 **Simplificación hecha — ¿se publica esto?**

- **A)** Sí, pasar a DEPLOY — *(recomendado si la suite volvió a salir verde sobre el estado ya
  simplificado)*. El diff que se publica es el simplificado, no el de antes.
- **B)** Revertir la simplificación y publicar lo anterior — [decime qué te preocupa]. Es una
  salida legítima: un cambio de forma que nadie pidió no vale un riesgo en producción.
- **C)** Simplificar más — [decime qué quedó dando vueltas]. Vuelve a 7.1 con el `risk_level` ya
  declarado, y la suite vuelve a correr después.

Esperando tu respuesta antes de continuar.

---
