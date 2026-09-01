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

## [2026-08-29] Decisión: NO recapturar las huellas del expediente de Discovery

**Qué se decidió:** los 4 claims del run-001 figuran como derivados —sus fuentes cambiaron desde el
2026-08-27— y se dejan así. No se crea una decisión de corrección que recapture los sha256.

**Por qué:** tres de los cuatro claims describen problemas que la propia feature
`integridad-verificable` resolvió: que no existía un verificador de `AUDIT.md`, que no había
registro de hallazgos de seguridad conocidos, y que los límites honestos no estaban cubiertos de
forma sistemática. Los tres son hoy falsos como descripción del árbol, y son verdaderos como
descripción del estado que motivó el trabajo. **La deriva ahí es evidencia de éxito, no de
obsolescencia.** Recapturar las huellas atestiguaría que esos claims describen el árbol de hoy, y
no lo hacen.

**Corrección a un diagnóstico previo:** en el inventario de lo abierto se listó "4 de 4 fuentes
derivadas" como si fuera un gate sin entrada real. Es incorrecto: `sources` tiene una entrada real,
la resuelve y responde bien. Lo que faltaba no era el dato sino la frase que explica qué significa
una deriva, declarada ahora como límite honesto.

## [2026-08-29] Decisión: cerrar spec.md y plan.md con la evidencia que había, no con una firma

**Qué se decidió:** `docs/spec.md` pasa a `Cumplida` con sus 17 casillas tildadas, y `docs/plan.md`
a `Ejecutado` incorporando las nueve tareas que nunca habían entrado.

**Procedencia de cada tilde, para que no sea una firma en blanco:**

- **Los 12 criterios** se tildaron con la salida de
  `verify-evidence-trace.mjs criteria --spec docs/spec.md --tests tests`, que devolvió «12
  criterio(s) nombrados por al menos una prueba». **Ese gate declara su propio límite: prueba
  trazabilidad, no suficiencia** — que exista una prueba que nombre el criterio, no que esa prueba
  lo compruebe. Tildar sobre esa base es lo más fuerte que el repositorio puede sostener hoy, y no
  es lo mismo que haber revisado los doce a mano.
- **La Definition of Done** se tildó contra evidencia corrida el mismo día: cobertura 100 % sobre 26
  scripts, 683 pruebas en verde, CHANGELOG y `.vibe/` al día. Las Forcing Questions (6/6) salen de
  `SESSION.md`.

**Las nueve tareas tardías:** T05–T13 se construyeron durante la sesión sin pasar por el plan. Sus
escritores se recuperaron de `docs/tasks.json`, que sí los registró en el momento — o sea que el
dato existía y lo que faltaba era el documento. Se corrió el preflight de conflictos **después** de
ejecutarlas: 13 tareas, 32 rutas declaradas, 392 solapamientos serializados, cero conflictos sin
orden. Que pase retroactivamente es tranquilizador, **no equivale a haberlo corrido antes**: si
hubiera encontrado un conflicto, ya estaría cometido.

**Lo que este cierre NO arregla:** el protocolo no tiene ningún gate que mire el campo `Status` de
la spec ni del plan, así que ambos pudieron quedar en borrador con el trabajo terminado sin que
nada lo notara. Eso sigue abierto.

---

## 2026-09-01 — Bloque A: la suite, el clon y el gate que se vigila a sí mismo

Cuatro decisiones 🔵 del usuario, con la evidencia que se le mostró antes de cada una.

**Fase 0 → opción B: corregir F1 antes que nada.** Se le mostró que 2 de 5 corridas de
`node --test --test-concurrency=32` salían rojas y que los 20 gates estaban verdes. Eligió arreglar
la intermitencia primero. El motivo se sostiene solo: un gate que responde distinto sobre el mismo
árbol no autoriza nada de lo que venga después.

**Worktree residual → inspeccionar y reportar.** No borrar, no integrar a ciegas. La inspección
encontró un receipt `approved` que nunca entró a `main` y cuyos `test_hash_sha256` coinciden con los
archivos preservados. Eso convirtió una decisión de limpieza en una de contenido.

**F13 → arreglarlo antes de seguir.** Se le mostró que un clon limpio de `af55a45` no estaba verde
en Windows: 215 de 229 archivos llegaban CRLF y la cadena de hashes de Discovery se rompía. Eligió
cerrarlo antes que avanzar. **Costo aceptado:** `* text=auto eol=lf` reescribe finales de línea en
los árboles de trabajo de otras máquinas Windows en su próximo checkout. Acá no cambia nada porque
el índice ya estaba en LF.

**A2 → portar el gate huérfano con ciclo completo**, no cerrar los huecos por separado. La
alternativa barata —escribir pruebas para los 6 huecos dejando el gate como estaba— se descartó con
un argumento explícito: el gate seguiría sin poder verlos, así que el próximo hueco tampoco
aparecería. **Costo aceptado:** se tocó el verificador del que dependen todos los demás veredictos.

**F14 → arreglarlo ahora.** Tres bytes NUL crudos en dos gates. Cambio chico con impacto medible:
`grep` los trataba como binarios y escondía sus líneas.

**Qué NO se decidió acá:** si el resto de `research/` alguna vez se prueba. Quedó como deuda escrita
en `contracts/coverage-scope.json`, no como problema resuelto.
