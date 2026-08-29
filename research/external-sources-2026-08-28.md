# Research externo — 14 fuentes → VibeCodeProtocols

**Fecha:** 2026-08-28
**Alcance:** lectura de núcleo de 14 repositorios ajenos, buscando patrones portables para los
huecos conocidos de VCP.

## CORRECCIÓN 2026-08-29 — la conclusión más fuerte de este informe era falsa

> Esta sección se agrega **un día después** y no reescribe nada de lo que sigue: el informe queda
> como se escribió, y acá se dice qué de él resultó equivocado. Borrar la conclusión vieja haría
> desaparecer justamente el dato interesante.

La sección 5 declara cuatro problemas como irresolubles y recomienda, textual, *«dejar de prometer
sellado del historial y reescribir el claim»*, apoyándose en que **«15581 archivos en 14 repos y no
hay una sola solución portable»**. Tres de esos cuatro se resolvieron entre el 2026-08-28 y el
2026-08-29, y **ninguna solución salió del corpus**:

| Declarado en este informe | Estado hoy | Con qué |
|---|---|---|
| 🔴 Ancla externa: **sin respuesta**, ninguna portable | **Resuelto** | `verify-audit-chain history` y `verify-discovery-core history`. El ancla portable era **git**: un registro sólo crece, así que cada versión commiteada tiene que empezar con la anterior. Cero infraestructura, cero CI, cero OIDC — corriendo hoy sobre 45 versiones commiteadas |
| 🔴 Custodia: **nadie firma un receipt** | **Parcial** | `verify-receipt custody` lee el estado de firma que git ya trae e informa quién firmó; una firma rota siempre rechaza. El límite de fondo sigue: si el agente puede firmar, firma como vos |
| 🟡 Cobertura de Bash: **sin respuesta útil** | **Resuelto para bash** | `verify-shell-coverage` mide con el instrumento que trae el propio bash — `PS4` con `$LINENO` más `set -x` —, sin dependencias. PowerShell queda **declarado sin medición**, no medido en cero |
| 🔴 Consentimiento humano real | **Sigue abierto** | La única de las cuatro que se sostiene. Probar que una persona quiso algo necesita un canal fuera de este proceso |

**Qué aprender de esto, que importa más que las tres soluciones.** Un corpus grande convergiendo en
que algo no tiene solución es **evidencia débil de imposibilidad**: sólo dice que catorce proyectos
no la encontraron o no la necesitaron. Este informe llamó a esa convergencia «la más importante» y
era la más frágil. Que 15581 archivos no contengan una solución no prueba que no exista; en el caso
del ancla, la respuesta estaba en una herramienta que este proyecto ya usaba todos los días.

**Lo que NO cambia.** La cobertura sigue siendo 2,05 % y sigue inflada — varias lecturas parciales
se cuentan como archivo entero. Y las 60 citas `archivo:línea` de este informe apuntan a los clones
pineados de los repos externos, **no a este repositorio**: nadie las revalidó de forma independiente
y no se pueden verificar sin volver a clonar las catorce fuentes. Eso sigue siendo un límite del
informe, no algo que esta corrección arregle.

---

## Estado de esta investigación: PARCIAL

**Ninguna fuente está estudiada.** Se leyeron **320 archivos de 15581 (2.05 %)**.
Cada fuente queda declarada PARCIAL con su número exacto de pendientes.

| Fuente | commit | archivos | leídos | pendientes | leído | estado |
|---|---|---:|---:|---:|---:|---|
| Panniantong/agent-reach | `06c202b0` | 120 | 28 | 92 | 23.3 % | PARCIAL |
| anthropics/claude-plugins-official | `e33a9ec0` | 456 | 18 | 438 | 3.9 % | PARCIAL |
| DietrichGebert/ponytail | `2ed6c52c` | 159 | 22 | 137 | 13.8 % | PARCIAL |
| msitarzewski/agency-agents | `3c958888` | 348 | 24 | 324 | 6.9 % | PARCIAL |
| rohitg00/ai-engineering-from-scratch | `39ea8a1c` | 3311 | 22 | 3289 | 0.7 % | PARCIAL |
| tt-a1i/archify | `49a7821d` | 446 | 22 | 424 | 4.9 % | PARCIAL |
| garrytan/gstack | `394db326` | 1444 | 24 | 1420 | 1.7 % | PARCIAL |
| AgriciDaniel/claude-obsidian | `ad67087c` | 201 | 18 | 183 | 9.0 % | PARCIAL |
| ConardLi/garden-skills | `aaf9a82f` | 593 | 27 | 566 | 4.6 % | PARCIAL |
| google/googletest | `36ba75f0` | 252 | 18 | 234 | 7.1 % | PARCIAL |
| ComposioHQ/awesome-claude-skills | `be2a4069` | 1142 | 25 | 1117 | 2.2 % | PARCIAL |
| K-Dense-AI/scientific-agent-skills | `36d8f13a` | 2446 | 21 | 2425 | 0.9 % | PARCIAL |
| marin-community/marin | `dc584e76` | 3606 | 21 | 3585 | 0.6 % | PARCIAL |
| thedotmack/claude-mem | `866a0ca3` | 1057 | 30 | 1027 | 2.8 % | PARCIAL |

**Veredictos:** 82 ADOPTAR · 62 ADOPTAR_PARCIAL · 6 INVESTIGAR_MÁS · 18 RECHAZAR. Son 168 patrones en total, que el sintetizador colapsa en 24 mecanismos reales.

## Condiciones bajo las que se hizo

- **No se ejecutó código de ninguna fuente**: ni tests, ni instaladores, ni scripts. Sólo lectura
  sobre clones temporales fuera del árbol de VCP.
- **No se instaló nada** dentro de VCP. Las fuentes se estudian para tomar ideas, no implementaciones.
- **Las citas `archivo:línea` las verificó cada agente lector contra su propio clone pineado.**
  El sintetizador no las revalidó, y lo declara. Un error de cita viene de la fuente y se propaga.
- Todo esto es lectura de código, **no comportamiento observado**.
- El porcentaje leído está **inflado**: varias lecturas parciales se cuentan como archivo entero.

## Primer intento: fallo propio, registrado

La primera corrida cayó entera por un defecto mío: pedí un identificador corto y los agentes
devolvieron `owner/repo`, así que mi `find()` no matcheó y las 14 lecturas murieron. Los 14
manifests (15.581 archivos con SHA exacto) sobrevivieron y se recuperaron del journal.
El sintetizador recibió una lista vacía y **se negó a escribir el informe**, y además señaló que el
pipeline de research no tenía gate propio. Se le agregó uno: sin patrones de entrada, no sintetiza.

---

# Informe adversarial de síntesis — 14 repos externos → VibeCodeProtocols

**Qué es esto:** 14 agentes leyeron 320 archivos de 14 repositorios ajenos y propusieron 168 patrones para tapar los huecos conocidos de VCP. Este informe los junta, saca los duplicados, y dice cuáles sirven de verdad.

**Aviso de honestidad que vale para todo el documento:** yo no cloné ni verifiqué ninguna cita `archivo:línea`. Las verificaron los 14 informes fuente, cada uno contra un commit pineado. Lo que yo hago acá es sintetizar y discutir. Si una cita está mal, el error viene de la fuente y yo lo propago.

---

## Glosario mínimo (para leer el resto)

| Término | Qué significa acá |
|---|---|
| **gate** | Un chequeo automático que deja pasar o frena. En VCP, cierra cada fase del ciclo. |
| **receipt** (recibo) | El archivo que un gate deja escrito diciendo qué verificó y qué dio. |
| **sello** | Marca que ata un artefacto a un momento/contenido, para que el historial no se pueda reescribir sin que se note. |
| **fail-closed / fail-open** | Ante duda o falta de datos, el gate frena (closed) o deja pasar (open). El hueco central de VCP es que hoy hace lo segundo. |
| **fingerprint / hash** | Huella de un contenido. Si cambia un byte, cambia la huella. |
| **denominador** | Cuántas cosas miró el gate. Un "verde" sobre 0 elementos no es lo mismo que un verde sobre 40. |
| **ancla externa** | Algo fuera del alcance del que escribe, contra lo que comparar. Sin ella, borrar los sellos deja todo prolijo y falso. |
| **INFRA** | Requiere servidor, CI, nube o daemon. VCP lo prohíbe por diseño. |

---

## 1. COBERTURA HONESTA

Ninguna fuente está estudiada. **Todas son PARCIAL.**

| # | Repo | Totales | Leídos | Pendientes | % leído | Estado |
|---|---|---:|---:|---:|---:|---|
| 1 | Panniantong/agent-reach | 120 | 28 | 92 | 23,3 % | PARCIAL |
| 2 | anthropics/claude-plugins-official | 456 | 18 | 438 | 3,9 % | PARCIAL |
| 3 | DietrichGebert/ponytail | 159 | 22 | 137 | 13,8 % | PARCIAL |
| 4 | msitarzewski/agency-agents | 348 | 24 | 324 | 6,9 % | PARCIAL |
| 5 | rohitg00/ai-engineering-from-scratch | 3311 | 22 | 3289 | 0,66 % | PARCIAL |
| 6 | tt-a1i/archify | 446 | 22 | 424 | 4,9 % | PARCIAL |
| 7 | garrytan/gstack | 1444 | 24 | 1420 | 1,7 % | PARCIAL |
| 8 | AgriciDaniel/claude-obsidian | 201 | 18 | 183 | 9,0 % | PARCIAL |
| 9 | ConardLi/garden-skills | 593 | 27 | 566 | 4,6 % | PARCIAL |
| 10 | google/googletest | 252 | 18 | 234 | 7,1 % | PARCIAL |
| 11 | ComposioHQ/awesome-claude-skills | 1142 | 25 | 1117 | 2,2 % | PARCIAL |
| 12 | K-Dense-AI/scientific-agent-skills | 2446 | 21 | 2425 | 0,86 % | PARCIAL |
| 13 | marin-community/marin | 3606 | 21 | 3585 | 0,58 % | PARCIAL |
| 14 | thedotmack/claude-mem | 1057 | 30 | 1027 | 2,8 % | PARCIAL |
| | **TOTAL** | **15581** | **320** | **15261** | **2,05 %** | **PARCIAL** |

**Tres advertencias que empeoran el número:**

1. **"Leído" está inflado.** Muchos de los 320 son lecturas parciales contadas como archivo entero. Ejemplo peor: `claude_obsidian/transaction.py` tiene 4771 líneas y se leyeron ~200; `gstack/cso/SKILL.md` tiene 55 KB y se leyó un grep más 120 líneas; `evaluate_skill.py` tiene 945 líneas y se leyeron ~370. La cobertura efectiva por línea está bastante por debajo del 2 %.
2. **La muestra está sesgada a propósito.** Cada agente eligió los archivos por el ángulo pedido (verificación, gates, evidencia). O sea: encontramos lo que fuimos a buscar. Un muestreo distinto podría traer patrones que contradigan estos.
3. **Nadie ejecutó nada.** Todo es lectura de código, no comportamiento observado. Cuando digo "el gate hace X", quiere decir "el código afirma hacer X". Ningún test de ningún repo se corrió.

**Distribución de los 168 veredictos:** 82 ADOPTAR · 62 ADOPTAR_PARCIAL · 6 INVESTIGAR_MÁS · 18 RECHAZAR.

---

## 2. PATRONES QUE VALEN

### Nota metodológica: 144 veredictos → 24 mecanismos

Los 144 patrones marcados ADOPTAR o ADOPTAR_PARCIAL **no son 144 cosas distintas**. La mayoría es el mismo mecanismo visto en repos diferentes. Colapsados por mecanismo real quedan **24**. Los ordeno por (valor operativo × verificabilidad × bajo costo × reversibilidad), en tres niveles.

---

### NIVEL 1 — Hacelo ya: barato, mecánico, se revierte borrando un commit

---

**1. Denominador obligatorio y fallo por conjunto vacío**

- **Qué hace:** antes de iterar, el gate afirma que su conjunto de entrada no está vacío, y publica cuántas cosas miró. Un `for` sobre lista vacía no puede terminar en verde.
- **Hueco que ataca:** *los gates degradan a verde cuando faltan entradas* (el hueco #1 de VCP, textual).
- **Citas:** `tests/test_channel_contracts.py:17` (agent-reach, "channel registry must not be empty") · `tests/_meta/test_repo_contract.py:123` (scientific, "no skills found — the anchor is wrong") · `scripts/check-divisions.sh:127` (agency-agents) · `.github/workflows/label-ready-skill.yml:97` (awesome-claude-skills) · `archify/SKILL.md:28` (piso de checks: 4 de 9 no es aceptación) · **anti-patrón confirmado**: `scripts/check-hook-io-discipline.cjs:54` (claude-mem imprime "OK" habiendo leído cero archivos porque el directorio no existía).
- **Contraargumento más fuerte:** hay fases legítimamente vacías (fase 0 sin claims, repo recién bootstrapeado). Una regla dura de no-vacío convierte un falso verde en un falso rojo, y la salida obvia — un `--skip` o un "N/A" — reintroduce el mismo agujero por otra puerta.
- **Por qué igual conviene:** es la conversión más barata que existe (una línea por gate) y es el hueco nombrado de VCP. El costo se paga atando el mínimo esperado a la fase, no eliminando la guarda. Y el sub-caso más útil no cuesta nada: **publicar el denominador en el receipt** (`vistos / esperados`), que hace visible el verde vacío aunque no lo bloquees.

---

**2. Test negativo por gate: el fixture roto tiene que dar ROJO**

- **Qué hace:** por cada gate, un test que le mete una entrada deliberadamente inválida y exige que falle, con el mensaje correcto. Variante superior: el gate corre su propio selftest con una matriz invertida antes de emitir veredicto, y si no discrimina, se niega a juzgar.
- **Hueco que ataca:** *la trazabilidad prueba que existe un test que NOMBRA un criterio* y, sobre todo, el gate que quedó siempre-verde después de un refactor y nadie se enteró.
- **Citas:** `benchmarks/robustness-audit.js:171-172` (ponytail: un `good` que debe pasar y un `bad` que debe fallar, "the instrument is verified before any API spend") · `benchmarks/agentic/complete.py:93-101` ("fails loudly if the gate is ever weakened into a no-op") · `test/carve-guards-negative.test.ts:4-10` (gstack: "prueban que los guards MUERDEN") · `googletest/include/gtest/gtest-spi.h:149` (exige exactamente una falla, del tipo correcto, con el substring correcto) · `archify/test/degraded.test.mjs:139` (corre los gates desde una copia podada y afirma que la frase de degradación nunca aparece).
- **Contraargumento más fuerte:** prueba que el gate se pone rojo con la entrada que al autor se le ocurrió, no con la que va a construir un agente que quiere pasar. Y los fixtures negativos se pudren en silencio: si cambia el mensaje del gate, el `assert` de substring deja de matchear y el test negativo pasa a verde vacío. **El patrón que existe para matar los pases silenciosos tiene su propio pase silencioso.**
- **Por qué igual conviene:** porque es la única defensa contra la degradación que, según la evidencia de este corpus, ocurre siempre (ver §4, convergencia negativa). Node puro, `fs` + tmpdir, y se revierte borrando un archivo de test.

---

**3. Polaridad declarada por gate: "ilegible" no es "ausente", y ante duda se ensancha**

- **Qué hace:** cada gate declara qué hace ante tres estados distintos de entrada: (a) no pude leer/parsear → decide según su polaridad declarada (negar o preguntar); (b) parseé y el caso no aplica → permite; (c) evaluable → evalúa. Corolario: cuando falta la fuente autoritativa, el chequeo se vuelve **más** estricto, nunca más laxo.
- **Hueco que ataca:** *los gates degradan a verde cuando faltan entradas.*
- **Citas:** `freeze/bin/check-freeze.sh:8-12` y `:68-73` (gstack: "un límite que falla abierto no es un límite") · `careful/bin/check-careful.sh:39-51` · `.github/scripts/gate-secret-scan.mjs:35-41` (si el reporte no parsea, imprime "1 high… fail-closed" y sale 1) · `tests/_contract/structure.py:235` (scientific: si git no responde, escanea TODO el filesystem, no menos) · `infra/ci/select_tests.py:465` (marin: archivo no analizable → corre todo el scope).
- **Contraargumento más fuerte:** **gstack predica esto y lo incumple donde más importa**: su propio gate de verificación falla abierto ante ausencia de declaración (`bin/gstack-verify-gate:8-9` "Fails open on every absence", `:156-159` devuelve exit 0 "allowing"). Y elegir DENY donde correspondía ASK produce un bloqueo permanente que el usuario termina desactivando entero — peor que el fallo abierto.
- **Por qué igual conviene:** es un campo de configuración por gate y un `switch`. Cero costo estructural, y arregla la *dirección* del degradado, que es el error de fondo.

---

**4. Allowlist cerrada de llaves: una clave desconocida es error, no advertencia**

- **Qué hace:** el esquema de cada artefacto (spec, claims, receipt) enumera las claves válidas; cualquier clave fuera del set devuelve exit 1.
- **Hueco que ataca:** la variante más barata y más letal de "degrada a verde": **el typo**. Si el archivo de claims dice `critera:` en vez de `criteria:`, el gate ve cero items y pasa.
- **Cita:** `plugins/skill-creator/skills/skill-creator/scripts/quick_validate.py:41-50` (claude-plugins). Contraste dentro del mismo repo: `plugins/plugin-dev/agents/plugin-validator.md:65` dice literalmente "Check for unknown fields (warn but don't fail)". Una es un gate; la otra es un consejo.
- **Contraargumento más fuerte:** rompe compatibilidad hacia adelante. Cada campo nuevo es un cambio breaking para todo artefacto ya sellado, y no hay migración barata para lo que ya está firmado. Obliga a versionar el esquema, trabajo que hoy VCP no tiene.
- **Por qué igual conviene:** el typo es el vector de evasión más probable y más involuntario, y cuesta ~15 líneas. La deuda de versionado del esquema hay que pagarla igual tarde o temprano.

---

**5. Prohibir sondas ambiguas (el vacío que no distingue "no existe" de "existe y está vacío")**

- **Qué hace:** ningún gate puede apoyarse en una sonda cuyo resultado vacío sea ambiguo. Cada gate declara con qué sonda distingue los dos casos.
- **Hueco que ataca:** la raíz epistémica de "sin spec → pasa". No es que el gate decida mal: es que **midió con un instrumento que no puede distinguir**.
- **Citas:** `skills/kb-retriever/SKILL.md:28` y `:143` (garden-skills: prohibido usar Glob para saber si un directorio existe, porque Glob sólo devuelve rutas de archivo — hay que usar `test -d`) · `src/services/worker/validation/PrivacyCheckValidator.ts:31` (claude-mem: el bug real #2794, "prompt ausente" y "prompt vacío tras el filtro" colapsados en un booleano congelaron en silencio toda una sesión).
- **Contraargumento más fuerte:** es disciplina, no chequeo. Nada verifica que las sondas usadas sean no ambiguas; auditarlas una por una es trabajo manual que se degrada con el tiempo. Y **ojo con el default de claude-mem**: ante ausencia, ellos permiten e informan — copiado tal cual, un gate de VCP que "permite y avisa" cuando falta la spec es exactamente el hueco que se quería cerrar.
- **Por qué igual conviene:** es una auditoría de una tarde sobre un puñado de sondas, y encuentra bugs reales, no hipotéticos. Adoptalo con el default invertido.

---

### NIVEL 2 — Alto valor, costo medio

---

**6. Fingerprint de contenido para aceptaciones (+ nunca hashear el secreto)**

- **Qué hace:** una aceptación de hallazgo no se indexa por (archivo, categoría) sino por el hash del **valor concreto**. Si el código citado cambia, la aceptación muere sola y el hallazgo vuelve a rojo. Complemento obligatorio: cuando el hallazgo ES una credencial, el snippet se vacía y la huella se calcula sobre símbolo + línea, nunca sobre el texto — porque el recibo viaja fuera de la máquina.
- **Hueco que ataca:** *aceptar un hallazgo cubre archivo+categoría, no un valor concreto* (hueco #2, textual).
- **Citas:** `plugins/claude-security/scripts/lib/sarif.py:174-202` (sha256 sobre remote + rule_id + path + código ±3 líneas normalizadas) y **una segunda implementación independiente en el mismo repo**: `plugins/security-guidance/hooks/diffstate.py:31-35` · `claude_obsidian/release.py:318-336` (mapa path → sha256; un byte distinto y la revisión caduca) · `phases/15-autonomous-systems/15-propose-then-commit/code/main.py:34-37` · `lib/marin/src/marin/execution/artifact.py:400` (`expected_fingerprint` levanta excepción) · carve-out de credenciales: `plugins/claude-security/scripts/lib/secret.py:1-10` y `sarif.py:190-194`.
- **Contraargumento más fuerte:** **toda la seguridad se muda a qué entra en el hash.** Muy laxo y volvés a archivo+categoría; muy estricto y cualquier reformateo invalida todo, la gente re-acepta en bloque sin mirar, y el rubber-stamping que querías evitar vuelve peor. Marin lo tiene y por eso mismo lo dejó **opt-in**: el camino que realmente corre degrada a warning (`artifact.py:406`). Y gstack, que predica cita verbatim, hashea `categoría + archivo + título normalizado` (`cso/SKILL.md:771`) — o sea, ni ellos ataron la aceptación al valor.
- **Por qué igual conviene:** es `node:crypto`, cero dependencias, y es el único mecanismo del corpus que ataca este hueco de frente. Adoptalo sabiendo que **el diseño del hash es el trabajo real**, no la implementación.

---

**7. Enumerar desde la realidad y comparar en los dos sentidos**

- **Qué hace:** el gate no lee la lista declarada para saber qué existe: enumera el mundo real (archivos en disco, `git ls-files`) y hace un diff bidireccional contra lo declarado. Falla por "falta en la declaración" **y** por "sobra en la declaración". Variante fuerte: el inventario del recibo tiene que ser un conjunto exactamente igual, ni un elemento de más ni de menos.
- **Hueco que ataca:** *el estado de sesión verifica lo declarado, no lo verdadero* + borrado parcial de sellos.
- **Citas:** `scripts/check-divisions.sh:55` y `:73-80` (agency-agents) · `test/carve-guard-completeness.test.ts:6-9` (gstack: "la pertenencia al registro ES la cobertura del guard — así que este chequeo de paridad es todo el juego") · `scripts/audit_certifications.py:683-688` (ai-engineering: imprime los dos deltas, "missing … extra …") · `claude_obsidian/release.py:1817-1825` (el set de paths sellados debe ser igual al set de archivos) · `skills/scholar-evaluation/scripts/check_traceability.py:160` (scientific: evidencia declarada y nunca usada es un hallazgo).
- **Contraargumento más fuerte:** **la paridad vale lo que vale el descubridor.** Si el lado "realidad" se define por un marcador que el agente controla (existe `manifest.json`, existe frontmatter), omitir el marcador hace desaparecer el ítem de los dos lados y la paridad sigue verde. Es defensa contra el olvido y la deriva, no contra la evasión deliberada. Además, la mayoría de lo que VCP declara ("la fase RED se cumplió") no tiene contraparte enumerable en el filesystem.
- **Por qué igual conviene:** cubre bien el inventario de artefactos, que es la mitad barata del problema, y convierte "borré un sello" de invisible en rojo.

---

**8. Verificador == generador (`--check` regenera en memoria y falla si difiere)**

- **Qué hace:** un solo código con dos modos. Sin flag, escribe el artefacto derivado; con `--check`, lo regenera en memoria, compara y sale 1 si difiere. El verificador no puede desincronizarse del generador porque son el mismo código. El mensaje de error dice el comando que arregla.
- **Hueco que ataca:** deriva entre copias del protocolo y entre verificador y arreglador; artefactos derivados rancios.
- **Citas:** `tests/openclaw-skills.test.js:13-14` (ponytail: `assert.equal(onDisk, render(name), 'stale — run: node scripts/build-openclaw-skills.js')`) · `scripts/release/update-readme.mjs:147` y `:162` (garden-skills) · `archify/scripts/generate-validators.mjs:53-60` · `scripts/debias_quizzes.py:163-169` (ai-engineering).
- **Contraargumento más fuerte:** sólo aplica a lo que es 100 % derivable de una fuente. Para una spec, un hallazgo o una decisión humana no hay función generadora. Y obliga a salida byte-determinista: nada de timestamps ni orden dependiente del entorno. **El bug que NO hay que copiar está a la vista**: `update-readme.mjs:79-81` hace `console.warn` y `continue` si falta el marcador — o sea, borrar el marcador pone el gate en verde. Es literalmente el hueco de VCP reproducido dentro del patrón que lo cura.
- **Por qué igual conviene:** VCP tiene reglas que viven en dos archivos (SKILL.md, plantillas, índices). Ahí el patrón cierra la deriva entera con un test.

---

**9. Los campos de identidad los escribe el registrador, nunca el que llama**

- **Qué hace:** al escribir cualquier registro, el registrador **borra** del payload recibido los campos de identidad (commit, tree, dirty, timestamp) y los recalcula él. Todo campo que el agente puede escribir es prosa; sólo los recalculados son evidencia.
- **Hueco que ataca:** *el estado de sesión verifica lo declarado, no lo verdadero.*
- **Citas:** `bin/gstack-review-log:5-10` y `:44-52` (gstack: `for (const k of ['commit_full','tree','wtree','dirty']) delete rec[k]`, con el motivo escrito: "un template renderizado viejo o un campo forjado no puede atar un registro a contenido sobre el que no se hizo") · `src/server/jobs/types.ts:17` (claude-mem: los campos del payload son *advisory*, tratarlos como autoridad sería un bypass; existen para detectar manipulación, no para autorizar) · `lib/marin/src/marin/execution/artifact.py:356`.
- **Contraargumento más fuerte:** evita que el agente **mienta** en el registro, no que **omita llamarlo**. Si el flujo es "el agente invoca el gate", el estampado autoritativo no compra nada contra un agente que se saltea el paso — sólo sirve si la invocación está forzada desde afuera, que es justo lo que VCP no tiene.
- **Por qué igual conviene:** son 20 líneas de Node y convierte una clase entera de campos de "declarados" en "derivados". Combinado con el patrón 7 (paridad), la omisión del paso también se vuelve detectable.

---

**10. Envoltorio de evidencia: el registro se produce, no se declara**

- **Qué hace:** en vez de preguntarle al agente si los tests pasaron, se envuelve el comando real, se propaga su exit code tal cual, y se anexa a un ledger `{comando, sha256 del comando, exit, duración, commit, huella del árbol antes y después}`. Tres refinamientos: (a) si el contenido cambió durante la corrida, se omite la huella y el check queda STALE; (b) `--expect-cmd` compara el sha del comando esperado, así un `echo ok` verde guardado bajo la etiqueta `tests` no satisface el gate; (c) el denominador son los comandos de aceptación **declarados**, y cada uno que no aparezca en el log emite un finding bloqueante.
- **Hueco que ataca:** *el estado de sesión verifica lo declarado, no lo verdadero* (el ataque más directo de todo el corpus).
- **Citas:** `bin/gstack-evidence:10-25`, guarda TOCTOU en `:393-401`, `--expect-cmd` en `:487-490`, degradación a STALE en `:495-503` · `phases/14-agent-engineering/38-verification-gates/code/main.py:81-96` ("acceptance.missing: never ran: {cmd}") · `document-skills/xlsx/SKILL.md:96` (la versión conceptual: nunca guardes el número calculado, guardá la fórmula y que otro la re-derive).
- **Contraargumento más fuerte:** **el envoltorio se rompió a sí mismo y está documentado.** `bin/gstack-evidence:158-183` cuenta que bun autocargaba `.env` en el proceso hijo y "cuatro tests fallaron 4/4 a través del envoltorio y pasaron 5/5 sin él": el wrapper certificaba una corrida que no era la corrida real. Un envoltorio que altera el entorno destruye exactamente la propiedad por la que existe, y VCP correría sobre Node, Bash y PowerShell con tres modelos de entorno distintos. Además el propio archivo admite (`:32-34`) que `--all` sólo chequea etiquetas que ya existen en el ledger: "no puede probar que un carril esperado haya corrido alguna vez".
- **Por qué igual conviene:** es el mecanismo de mayor valor del informe, y el problema del entorno es resoluble (entorno explícito, sin autocarga) y **testeable con el patrón 2**. El problema del denominador se resuelve con el patrón 1. No está en el top-3 sólo por costo y por su historial de romperse.

---

**11. Verificación mecánica de citas (que el blob, la línea y el texto existan en esa revisión)**

- **Qué hace:** cada cita lleva ruta + línea + revisión (sha de 40 chars). El gate corre `git cat-file -t <rev>:<path>`, falla si no es un blob, lee el blob y falla si la línea pedida excede el largo del archivo en esa revisión. Variante superior: si la cita del modelo **no** intersecta el diff, no se descarta — se le exige evidencia más estricta.
- **Hueco que ataca:** *la trazabilidad prueba que existe un test que NOMBRA un criterio.*
- **Citas:** `archify/renderers/shared/repository-evidence.mjs:186` y `:196-210` · `plugins/security-guidance/hooks/review_api.py:306-344` ("hard-dropping those also discards correct findings whose sink is off-diff but enabled by an in-diff change") · `.agents/skills/write-design-doc/SKILL.md:145` (marin: "plain path:line text drifts within days") · `cso/SKILL.md:696-708` (gstack: sin cita verbatim, la confianza se fuerza a 4-5 y el hallazgo se suprime).
- **Contraargumento más fuerte:** verifica que la línea **existe**, no que diga lo que se afirma. Un modelo que aprende el gate cita líneas triviales pero válidas y el gate queda verde con trazabilidad vacía. Y es frágil: un `prettier` invalida todas las anclas de golpe, y un gate que se pone rojo por ruido es un gate que se desactiva.
- **Por qué igual conviene:** sube el piso de "hay un string con forma de cita" a "hay un texto que el gate puede reencontrar en ese commit". Es un `spawnSync` de git y se revierte. Pero **hay que documentarlo como "la cita toca el texto", nada más** — venderlo como "ahora la trazabilidad es real" sería el sobre-reclamo que VCP dice no cometer.

---

**12. El receipt nace rojo, y la entrega es atómica**

- **Qué hace:** dos mitades. (a) El recibo se construye con `ok:false` y cada sub-check en `fail`; sólo un camino de éxito explícito los da vuelta, así que cualquier `return` temprano, excepción o Ctrl-C deja un recibo rojo en disco. (b) La escritura es temp-en-el-mismo-directorio + fsync + rename, y el render se hace **desde un snapshot congelado** del insumo, no del archivo vivo; un fallo nunca toca el artefacto anterior.
- **Hueco que ataca:** gates que degradan a verde por archivo truncado (un JSON cortado a la mitad es indistinguible de "ausente" para un `try{parse}catch{pasa}`), y la ventana entre validar y entregar.
- **Citas:** `archify/bin/visual-check.mjs:660-678` (recibo fail-closed) · `archify/bin/archify.mjs:872-916` (staging, flag `wx`, checker independiente sobre el candidato, recién después el rename) · `src/shared/atomic-json.ts:50` y `:102-115` (claude-mem: fsync de archivo y de directorio, saltado en Windows).
- **Contraargumento más fuerte:** invierte el riesgo pero no lo elimina: un sub-check que nunca se ejecuta queda `fail` para siempre y bloquea sin motivo real, lo que empuja a agregar excepciones — el mecanismo exacto que produce las degradaciones. Y el fsync de directorio **no existe en Windows**, o sea la garantía es más débil justo en la plataforma del usuario. Además no protege de nada deliberado: contra un borrado no hace absolutamente nada.
- **Por qué igual conviene:** cubre la clase de fallo accidental (crash, corte, Ctrl-C) que hoy se lee como "no había datos". Es Node puro.

---

### NIVEL 3 — Valen, con condiciones explícitas

---

**13. Tercer estado (skipped / pending / no-verificable) que NO cuenta como verde**
*Condición previa obligatoria: sólo sirve si CLOSURE consume el RECEIPT y no el exit code.*
Es el patrón **más convergente del corpus** (9 fuentes) y a la vez el que más advertencias trae. `claude_obsidian/gates.py:132-142` separa dos booleanos, `ok` (no hubo fallos) y `ready` (ejecutó **y** sin fallos **y** sin pendientes); un gate `required` que nunca corrió cae en `pending` y bloquea `ready`. `archify/bin/visual-check.mjs:21` reserva exit 2 para "no pude evaluar". `googletest/src/gtest.cc:4802` separa `status ∈ {RUN, NOTRUN}` de `result ∈ {COMPLETED, SKIPPED, SUPPRESSED}`. `evaluate_skill.py:938-941` es la mejor lección: el modo degradado cambia el **exit code**, nunca el veredicto registrado.
**Contra:** todas las fuentes advierten lo mismo con distintas palabras — el consumidor hace `result != FAILED → verde` y el amarillo se cuela como aprobado; googletest imprime SKIPPED en verde (`gtest.cc:3719`); ai-engineering avisa que un runner que mira sólo el exit code ve verde igual. **Un amarillo que no bloquea nada es decoración.** Si VCP lo adopta, "no verificado" tiene que ser ROJO, no ámbar informativo.

**14. El hash del gate y de la política vive dentro del receipt**
Cada recibo lleva el hash del script que lo emitió y de la política vigente; tocar el gate evapora los verdes previos. `.github/workflows/scan-plugins.yml:86-105` ("A prompt change invalidates every cached verdict — that is intentional") · `claude_obsidian/release.py:1205-1218` (el manifiesto embebe el snapshot de la allowlist bajo la cual se aceptó) · `infra/ci/select_tests.py:75` (marin: el propio selector está en la lista de disparadores amplios).
**Contra:** **no es el ancla externa que VCP necesita y sería deshonesto venderlo así** — el hash vive en el mismo repo que el atacante controla. Y en un repo donde los gates se editan todo el tiempo (los últimos commits de VCP son todos trabajo sobre gates), casi ningún verde es reutilizable.
**Por qué igual:** compra evidencia de manipulación contra el caso perezoso, y hace auditable "este recibo se emitió con una política que desde entonces se aflojó".

**15. Huella del árbol de trabajo sucio (`wtree`) como ancla de frescura**
Un hash de **contenido**, no de commit: índice temporal, `git add -A`, `git write-tree`. Commitear contenido idéntico no cambia la huella; un archivo nuevo sin trackear sí; rebase/squash que preservan contenido no la tocan. `bin/gstack-wtree:9-14` · `lib/rigging/src/rigging/provenance.py:81-89` (marin, vía `git stash create`) — **dos repos independientes llegaron al mismo mecanismo.**
**Contra:** tres problemas honestos y documentados por las propias fuentes. (a) Calcularlo **escribe** objetos en `.git` (gstack-wtree:25-27; en un repo con secretos fuera de `.gitignore` los persiste hasta el gc) — un gate "de sólo lectura" que escribe no es de sólo lectura. (b) Depende de git; sin git degrada a campos vacíos, o sea el ancla desaparece justo cuando la necesitás. (c) El objeto queda sin referenciar y `git gc` lo puede podar; y quien puede borrar los sellos casi siempre puede borrar `.git`.
**Por qué igual:** es un ancla **más dura** que la actual (no es un ancla real). Sirve para "esta evidencia se tomó sobre este contenido y ningún otro", que es distinto de "nadie puede borrarla".

**16. La fase declarada es una frontera de autoridad de escritura, no una etiqueta**
`claude_obsidian/transaction.py:90` lo dice literal: *"an operation type is an authority boundary, not merely an audit label"*; declarar el tipo de operación **prohíbe** mecánicamente tocar paths fuera del dominio (`:3176-3233`, `WRITE_SCOPE_VIOLATION`). Complementos: conjunto exacto de escrituras acopladas (`:3247-3265`), árbol commiteado sin paths ajenos a los revisados (`checkpoint.py:855-861`), y allowlist de archivos del PLAN contrastada contra `git diff --name-only` (`engineering/engineering-minimal-change-engineer.md:122`).
**Contra:** la tabla path→autoridad es política del proyecto y se mantiene a mano; VCP corre sobre repos arbitrarios donde no hay un "tests acá, src allá" universal. Síntoma revelador: de los 13 tipos de operación de claude-obsidian, **sólo lograron escribir la regla de conjunto exacto para UNO**. Si a ellos no les generalizó en su dominio cerrado, en VCP menos.
**Por qué igual:** el caso barato sí generaliza — "un GREEN que toca src sin tocar ningún test" y "un cambio de spec sin plan" son incompletos de forma mecánica, y eso es un `git diff` más un set.

**17. Región congelada + comparar contra el objeto git del commit base**
Se declara una ventana editable entre dos marcadores y se exige igualdad byte a byte fuera de ella, comparando contra la versión traída del commit base por sha, no contra una copia local. `.github/workflows/label-ready-skill.yml:82` y `:18`.
**Contra:** la igualdad byte a byte es frágil justo donde VCP corre (CRLF vs LF en Windows, newline final, reformateo). Cada falso positivo empuja a ensanchar la ventana, y una ventana ensanchada tres veces no congela nada. Y sólo protege el interior del archivo: no impide borrarlo entero.
**Por qué igual:** es el mecanismo directo para el núcleo inmutable de VCP, y `git show <sha>:path` es contenido direccionado que ya está en la máquina.

**18. Catálogo de aserciones débiles + prohibición de verificadores tautológicos**
Un escáner regex sobre las líneas **agregadas** que marca por `path:line` los asserts sin poder (`assert ... is not None`, `isinstance`, `assert_called_once`, estado privado, texto de log): `.agents/skills/noslop/scripts/scan_diff.py:49-55` (marin). Del otro lado, rechazo estructural del verificador que sólo se valida a sí mismo: `claude_obsidian/contracts.py:247-293` ("reject declarations that can only prove the contract validating itself"), y un check nombrado que no existe puntúa FAIL en vez de saltearse: `phases/14-agent-engineering/33-instructions-as-executable-constraints/code/main.py:122-123`.
**Contra:** es regex sobre texto y a veces el assert débil ES el contrato. **Marin lo sabe y por eso su escáner devuelve 0 siempre** (`scan_diff.py:139`): es advisory, no gate, y su doctrina interna insiste en "precision over recall, los falsos positivos son el modo de falla que erosiona la confianza" (`infra/lint/shared.md:89,132`). La lista negra de tautologías, además, se pudre: `assert True` con el nombre del criterio sigue pasando.
**Por qué igual:** sube el piso de trazabilidad de "existe un test que lo nombra" a "existe un test que lo nombra y afirma algo no trivial". Empezalo como advisory con conteo, exactamente como marin.

**19. Testigo doble: afirmación positiva y negativa sobre el artefacto producido**
Sobre el artefacto ya generado, un grep que **no** debe encontrar la frase vieja y uno que **sí** debe encontrar la nueva: `document-skills/docx/SKILL.md:148-153`. Versión conceptual: la expectativa focal no puede ser igual a la rival, o el test no discrimina (`check_falsification_controls.py:353`, error `FOCAL_AND_RIVAL_EXPECTATIONS_IDENTICAL`).
**Contra:** el testigo negativo se falsifica tan fácil como el positivo si lo escribe el mismo que escribe el código — basta elegir una cadena que nunca estuvo. Para criterios no textuales (arquitectura, ausencia de una clase de bug) el negativo es trivial o imposible, y el gate empuja a inventar negativos decorativos.
**Por qué igual:** duplica el costo por criterio pero es la única forma barata de exigir que **algo haya dejado de ser cierto**, que es más que "algo se nombró".

**20. La supresión es visible y contada; lo no medible tiene su registro**
Tres piezas: un hallazgo perdonado no desaparece del reporte, va a su propia lista y se cuenta (`claude_obsidian/lint_engine.py:1109-1113`); las exclusiones del normalizador se imprimen ("positional-anchor questions left as-is: N", `scripts/debias_quizzes.py:143`); y existe un bloque explícito de "esto no se puede verificar y por qué", impreso dentro de cada corrida (`tests/skill-requirements.toml:794` + `tests/run_all.py:152`). Complemento: `not_applicable` sin razón escrita es error duro, y `not_assessed` es un estado distinto de `missing` (`audit_statistics_reproducibility.py:207`).
**Contra:** visibilidad sin tope es decorativa — nada falla cuando el contador de suprimidos crece, así que un reporte con 400 excepciones sigue en verde. Y el registro de lo no medible se pudre en una lista de exenciones permanentes autofirmadas que nadie revisa.
**Por qué igual:** cuesta cero (es formato de salida) y hace visible la deuda en cada corrida en vez de evaporarla. Con un tope numérico se convierte en gate.

**21. Decisiones: hash del plan regenerado + `reversible: true|false` — y renombrar el gate con honestidad**
El dry-run emite `approval_sha256`; el apply exige `--approved-plan-sha256`, **regenera el plan desde cero** para re-hashearlo, y si difiere aborta con `PLAN_CHANGED` (`claude_obsidian/cli.py:86-101`, comparación con `hmac.compare_digest`; el hash cubre esquema, identidad, bundle y la proyección de bytes de cada escritura, `transaction.py:1287-1309`). Aparte, cada decisión declara si es puerta de una vía o de dos (`scripts/one-way-doors.ts:4-16`), y las de una vía siempre se preguntan. Y una decisión = una pregunta numerada = una respuesta, prohibido el paquete "¿acepto todo?" (`skills/beautiful-article/SKILL.md:91`).
**Contra:** **nada de esto prueba voluntad humana y hay que decirlo.** Un agente que corre inspect y apply en el mismo turno se copia el hash a sí mismo. El clasificador de puertas de gstack falla abierto (`one-way-doors.ts:150-151`, "default-two-way") y su propio encabezado promete lo contrario. Y una pregunta por decisión encarece la falsificación de forma lineal mientras produce fatiga de confirmación en el humano real — puede **empeorar** la calidad del consentimiento aunque mejore la del registro.
**Por qué igual:** el hash del plan regenerado es un gate de **integridad** genuino: garantiza que lo aplicado es byte-idéntico a lo mostrado. Eso vale. La recomendación adversarial es **renombrar el gate**: no es "decisión querida", es "decisión registrada e íntegra".

**22. TRIANGULATE: independencia por origen, no por cabezas**
Antes de contar evidencias, colapsarlas transitivamente: mismo id, misma URL canónica, mismo `content_sha256` o misma clave de independencia declarada quedan en un solo grupo, y recién ahí se exige ≥2 grupos (`claude_obsidian/ledgers.py:797-837` y `:1127-1136`). Complemento fuerte: la evidencia marcada sintética no cuenta, y `source_date <= reviewed_date` — **una fuente traída después de la revisión no puede respaldarla** (`ledgers.py:1096-1110`), lo que mata retroactivamente el "busqué la evidencia después de decidir".
**Contra:** la clave de independencia la declara el mismo agente, así que se burla poniendo dos claves distintas a dos derivados del mismo origen; atrapa duplicación accidental, no lavado deliberado. La marca "sintética" es autodeclarada y no hay detector.
**Por qué igual:** VCP hoy cuenta cabezas. Dos tests que comparten fixture, generador o fuente de datos deberían contar como uno, y eso sí es mecánico (hash del fixture).

**23. Truncado que preserva fallos + elisión declarada con conteo**
La política de truncado conserva los últimos K registros **más todos los de exit code distinto de cero**: estructuralmente no puede borrar un fallo (`phases/14-agent-engineering/40-multi-session-handoff/code/main.py:42-53`). Y cuando la evidencia no entra, no se corta y ya: cabeza + `<elided chars=N original_size_chars=M reason=oversize>` + cola, con instrucción de no inferir nada del rango elidido (`src/sdk/prompts.ts:118-150`).
**Contra:** sólo sirve si el log lo produce el runner; si lo escribe el agente, omitir el fallo es trivial y no hay nada que preservar. El marcador es texto, no restricción: nada impide que el gate siguiente haga grep sobre un artefacto mutilado. Y ai-engineering tiene el problema hermano sin resolver: el harness registra `rounds=2` y el gate ignora el campo (`30-eval-driven.../main.py:33-55`) — **preservar no es gatear.**
**Por qué igual:** cuesta cero y elimina la clase de bug "el receipt decía verde porque la línea del assert que falló quedó fuera del truncado".

**24. El token del veredicto nombra su propio límite**
En vez de emitir `pass`, emitir `VALID_HUMAN_REVIEW_DECLARED_COMPLETE` — la palabra "DECLARED" adentro del token — más un campo `notice` que enumera qué NO prueba esta verificación (`check_falsification_controls.py:404` y `:415`). Análogos: `visual acceptance`, no `visual regression`, cuando falta el baseline (`browser-acceptance.md:98`); y el techo declarado en el punto de uso con camino de upgrade (`scripts/check-rule-copies.js:40-43`).
**Contra:** es honestidad de etiqueta, no de mecanismo: el gate verifica exactamente lo mismo, y un consumidor que hace `status.startsWith('VALID')` no nota nada. Peor, **sirve de coartada**: "ya declaré que no lo pruebo" baja la presión por arreglar el gate.
**Por qué igual:** cuesta cero (es cómo se llama un string) y ataca directamente el modo de falla real de VCP, que no es que el gate mienta sino que **se lea como prueba de algo que no probó**. Condición: que la etiqueta la **derive** el gate de un predicado mecánico, no que la elija el agente.

---

### 2b. Demociones adversariales (venían con veredicto ADOPTAR y yo los bajo)

| Patrón | Fuente | Por qué lo bajo |
|---|---|---|
| **Gate léxico de frases prohibidas en prosa** | agent-reach `test_auth_guidance_policy.py:122`, garden-skills `SKILL.md:37` | Se esquiva con un sinónimo, otro emoji o una traducción. Genera falsos positivos garantizados cuando el texto **cita** la frase prohibida (este mismo informe lo dispararía). Y da sensación de cobertura sobre veracidad semántica, que es justo lo que VCP promete no pretender. **Peor**: la mitad descubierta-por-glob de ese archivo pasa vacuamente si el glob no matchea nada. Quedate sólo con el patrón 24, que es gratis. |
| **Ratchet con baseline commiteado** | gstack `context-budget-ratchet.test.ts:17-26` | En un flujo agéntico el gate **imprime las instrucciones para desactivarse**: el agente ve el fallo, lee el protocolo de recaptura que el propio gate le muestra, recaptura y sigue. Sólo para métricas donde subir el techo sea de por sí una señal que un humano quiera ver. |
| **Taxonomía de 5 veredictos (DONE/PARTIAL/NOT DONE/CHANGED/UNVERIFIABLE)** | gstack `ship/sections/plan-completion.md:95-103` | UNVERIFIABLE es un escape universal y gstack lo deja en prosa; un agente que no quiere trabajar clasifica todo así y produce un reporte prolijo de nada. **Adoptá sólo la mitad mecánica**: si el criterio nombra un path o comando concreto, el veredicto binario es obligatorio (`[ -f <path> ]`), "no quiero chequear" no es inalcanzable. |
| **Detección de copia por shingles / cuasi-duplicados** | agency-agents `check-agent-originality.sh:78` | Los tests table-driven y parametrizados son cuasi-duplicados **por diseño y por buena práctica**. El umbral es dependiente del corpus y termina subido hasta la irrelevancia, o la gente ofusca tests para esquivarlo. Detecta duplicación, no vacuidad. |
| **Escalada acotada con historia de fallos obligatoria** | agency-agents `handoff-templates.md:150` | Autoescrito por el mismo agente; una IA produce esa historia sin costo. Mide prolijidad, no intención. Y el propio orquestador del repo contradice la regla: `agents-orchestrator.md:161` dice "after 3 failures: mark as blocked, **continue pipeline**". |
| **Orden aleatorio con semilla** | googletest `gtest.cc:6019` | El ciclo de VCP tiene orden semántico obligatorio (RED antes que GREEN, SECURITY antes que CLOSURE). Barajar es directamente ilegal ahí; googletest necesitó una excepción cableada para sus death tests. Aplica a un subconjunto tan chico que no paga. |
| **Cuota mínima de hallazgos** | agency-agents `testing-evidence-collector.md:29` | Ya venía con RECHAZAR pero lo repito porque es tentador: ningún gate distingue un hallazgo real de uno fabricado. Una cuota no produce rigor, produce ruido con formato correcto. El mismo repo se contradice: su persona de seguridad advierte que "a security tool that cries wolf gets muted". |

---

## 3. RECHAZOS CON MOTIVO

18 patrones rechazados. **10 de los 18 son la misma historia: la idea es buena y exige infraestructura.**

| Patrón | Fuente | Motivo | INFRA |
|---|---|---|---|
| Gate en máquina que el autor no controla (CI + OIDC + status check) | claude-plugins `scan-plugins.yml:33-35` | **Es literalmente lo que a VCP le falta** y no hay contraargumento sobre la idea. Exige runner de CI, proveedor OIDC, almacén de artefactos y status checks. Adoptarlo "con advertencia" sería mentir sobre el costo. | ✅ |
| Brazo de control A/B contra el protocolo | ponytail `benchmarks/behavior.yaml:11-12` | promptfoo + `ANTHROPIC_API_KEY` + `--repeat 10`. Sin el modelo no hay brazo de control; ningún recorte lo salva. | ✅ |
| Arnés de evaluación con agente LLM | awesome-claude-skills `evaluation.md:392` | `pip install anthropic mcp`, API key, red, y un proceso de servidor de larga vida. Además el veredicto pasa a ser no determinista. | ✅ |
| Ancla externa vía commit de bot de CI | scientific `.github/workflows/security-scan.yml:58` | Cambia un ancla borrable por otra: quien controla el repo reescribe la historia remota. Y exige Actions + secreto + servicio LLM. | ✅ |
| Hook Stop con contador de reentrada | gstack `gstack-verify-gate:137-145` | Depende del payload propietario del host (Claude Code). Y **falla abierto a los 3 bloqueos** (`:200-206`) con el chequeo todavía en rojo: le enseña al agente que insistir funciona. | ✅ |
| Confinamiento por descriptores POSIX + `fcntl.flock` | claude-obsidian `operation-transactions.md:94-101` | El propio doc admite que en Windows hay que correr bajo WSL; ni Git Bash sirve. Síntoma: `_fsync_directory` retorna sin hacer nada en `nt` (`transaction.py:1312-1314`), o sea la durabilidad es silenciosamente más débil en Windows. | ✅ |
| Canal de estado por fd heredado + re-exec | googletest `gtest-death-test-internal.h:277` | Necesita tres implementaciones separadas (POSIX, Windows, Fuchsia) y arrastra caveats propios documentados. El subconjunto usable ya está cubierto por la tabla de verdad por subproceso. | ✅ |
| CI como punto de aplicación de los gates | garden-skills `release-skill.yml:138` | Toda la garantía viene de que el ejecutor sea ajeno; sin el servicio, el patrón no existe. | ✅ |
| Lock distribuido con lease + heartbeat | marin `step_status.py:242` | Exige filesystem con escrituras condicionales por generación + hilo de heartbeat + worker_id de cluster. Bonus: **lee estado corrupto como válido** (`:88-97`), o sea es un contraejemplo, no un modelo. | ✅ |
| Arquitectura de memoria durable de claude-mem | claude-mem `ContextBuilder.ts:5` | `bun:sqlite` + worker HTTP persistente + **una segunda sesión de LLM** por memoria + Chroma. Su propio README promete "context survives across sessions"; el código lo cumple mientras un servicio de terceros responda (17 horas de silencio documentadas). | ✅ |
| Firma HMAC de los overrides | ai-engineering `38-verification-gates/main.py:169-197` | **HMAC no es firma, es un MAC**: la misma clave firma y verifica, así que quien puede correr la herramienta puede forjar entradas. En VCP el que corre la herramienta es el agente. | |
| Cadena de hash `prev` en el ledger | gstack `lib/egress-receipt.ts:19-21` | El propio repo lo documenta (`gstack-egress:12-18`): no detecta truncado de cola, refabricación ni borrado del archivo. Verificado: `readLedger` devuelve `[]` ante ENOENT (`:321`) y `verifyLedger` sobre vacío retorna `ok:true` (`:379-391`). **Borrás el archivo y la verificación pasa en verde** — el hueco de VCP, reproducido con criptografía encima. | |
| Checklist de challenge-and-response como consentimiento | ai-engineering `15-propose-then-commit/main.py:110-122` | Tres booleanos en un archivo local son indistinguibles de tres booleanos escritos por el agente. El propio repo lo encuadra como UX anti-rubber-stamping, no como prueba. | |
| Gates por presencia de tokens exactos en prosa | ai-engineering `audit_certifications.py:762-822` | **Es el hueco de VCP a escala de 40+ aserciones**: prueba que un documento nombra algo, no que lo cumpla. Un doc puede tener el string en una sección de "qué NO hacer" y pasa. Y acopla el CI a la redacción. | |
| Golden file de la salida completa | googletest `googletest-output-test.py:208` | Necesita normalizar ubicaciones, stack traces, tiempos y plataformas, y aun así mantienen **un solo golden, el de Linux**, con `--gengolden` para regenerarlo. Un golden regenerable con un flag es lo que una IA "arregla" regenerándolo. | |
| El nombre como contrato mecánico (sufijo `*DeathTest`) | googletest `gtest.cc:5900` | Verifica que el nombre **termine** en DeathTest, nunca que la suite contenga uno. Es la misma garantía que VCP ya tiene ("existe algo que se llama X") con otro disfraz; adoptarlo daría sensación de haber cerrado la trazabilidad sin cerrarla. | |
| Semilla reproducible para reverificación | awesome-claude-skills `raffle-winner-picker/SKILL.md:148` | Caso puro de README que promete y código que no existe: la carpeta tiene **un solo archivo**, el SKILL.md, sin scripts. Afirma "no manipulation possible" sin nada que lo sostenga. | |
| Cuota mínima de hallazgos | agency-agents `testing-evidence-collector.md:29` | Incentivo perverso: produce ruido con formato correcto y entrena a ignorar el reporte. | |

**INVESTIGAR_MÁS (6), en una línea cada uno:** certificador independiente por contexto fresco (agency-agents — sólo la parte read-only es verificable, por hash del árbol); degeneración estadística del corpus (ai-engineering — umbrales mágicos sin derivación); bucle de reparación acotado por métrica (archify — prosa, y la métrica "cantidad de errores" es manipulable partiendo un error en dos); detección de cuasi-duplicados (awesome-claude-skills — table-driven); fragilidad de umbrales por perturbación (scientific — VCP tiene gates booleanos, no puntajes ponderados: no hay peso que perturbar); lint léxico causal (scientific — ruido y evasión por sinónimo).

---

## 4. CONVERGENCIAS (2+ fuentes independientes)

Ordenadas por fuerza de la señal.

| # | Mecanismo | Fuentes independientes |
|---|---|---|
| 1 | **Fallo por conjunto vacío / denominador publicado** | 8: agent-reach, agency-agents, scientific, awesome-claude-skills, ai-engineering, archify, googletest, marin (+ claude-mem confirma el anti-patrón) |
| 2 | **Tercer estado que no cuenta como verde** | 9: archify, claude-obsidian, claude-plugins, googletest, agent-reach, ai-engineering, ponytail, scientific, garden-skills |
| 3 | **Aceptación anclada al hash del valor concreto** | 7: claude-plugins (dos implementaciones independientes en el mismo repo), claude-obsidian, ai-engineering, agency-agents, marin, scientific, googletest/gmock |
| 4 | **Paridad de conjuntos bidireccional (enumerar la realidad)** | 6: agency-agents, gstack, ai-engineering, scientific, claude-obsidian, archify |
| 5 | **Verificador == generador (`--check`)** | 5: ponytail, garden-skills, archify, ai-engineering, claude-mem |
| 6 | **Test negativo del gate / selftest invertido** | 5: ponytail, gstack, googletest, archify, ai-engineering |
| 7 | **Polaridad declarada / ilegible ≠ ausente / ante duda ensanchar** | 4: gstack, scientific, marin, claude-mem |
| 8 | **Cita verificada mecánicamente contra una revisión** | 4: archify, gstack, marin, claude-plugins |
| 9 | **Catálogo de aserciones débiles / anti-tautología** | 4: marin, claude-obsidian, agency-agents, ai-engineering |
| 10 | **Campos de identidad estampados por el registrador** | 3: gstack, claude-mem, marin |
| 11 | **Hash de la política dentro del receipt** | 3: claude-plugins, claude-obsidian, marin |
| 12 | **Testigo doble positivo/negativo** | 3: awesome-claude-skills, scientific, archify |
| 13 | **Huella del árbol sucio (`git write-tree` / `stash create`)** | 2: gstack, marin — **mecanismo idéntico descubierto por separado** |
| 14 | **Escritura/entrega atómica (temp + rename + snapshot)** | 2: claude-mem, archify |
| 15 | **Truncado que preserva fallos / elisión con conteo** | 2: ai-engineering, claude-mem |

### La convergencia más importante es negativa

**Siete de catorce repos documentan que su propia doctrina fail-closed se incumple en otro archivo del mismo repo.** No es anécdota, es el hallazgo empírico más sólido del corpus:

- agent-reach predica "conectado no asciende a verde" (`_opencli_site.py:41`) y su clase base hace lo contrario: `check()` por defecto asigna `active_backend = backends[0]` y devuelve `ok` sin sondear (`channels/base.py:69`).
- ponytail inventa el selftest anti-no-op y dos archivos más allá `correctness.js:270-271` devuelve `{pass:true, reason:'Unknown task, skipped'}` y `behavior.js:51` devuelve `pass:true` ante un probe desconocido.
- gstack escribe "un límite que falla abierto no es un límite" y su gate de verificación falla abierto ante toda ausencia (`gstack-verify-gate:8-9`, `:156-159`).
- ai-engineering declara el job `audit` como "Blocking" (`AGENTS.md:224`) y `audit_lessons.py:121-132` hace `if not code_dir.is_dir(): return` — una lección sin código y sin quiz no genera ningún issue. La versión estricta del mismo chequeo existe en `audit_certifications.py:296-302`. **El repo contiene las dos escuelas.**
- garden-skills tiene el `--check` perfecto y `update-readme.mjs:79-81` pasa en verde si borrás el marcador.
- claude-mem tiene un gate que imprime "OK" habiendo leído cero archivos (`check-hook-io-discipline.cjs:54`), y su gemelo (`check-spawn-env-discipline.cjs:81`) sólo verifica que la cadena `sanitizeEnv(` aparezca dentro de una ventana de 10 líneas — el hueco de trazabilidad de VCP, calcado.
- marin predica "ante la duda ensanchá" en el selector de tests y su `check_drift` devuelve "sin deriva" cuando no encuentra registro (`artifact.py:396`).

**Conclusión operativa:** la disciplina fail-closed **no se sostiene sola**. Se degrada archivo por archivo en todos los proyectos que la escribieron, incluidos los que la escribieron mejor. Eso convierte al patrón 2 (test negativo obligatorio por gate) de "buena idea" en "requisito", porque es el único mecanismo del corpus que detecta esta degradación.

---

## 5. LO QUE NINGUNA FUENTE RESUELVE

Esta es la sección más útil: dice dónde hay que inventar, no copiar.

### 🔴 SIN RESPUESTA — Ancla externa contra el borrado total de sellos

**15581 archivos en 14 repos y no hay una sola solución portable.** Todo lo que funciona exige infraestructura y fue rechazado (claude-plugins con OIDC, scientific con bot de CI, garden-skills con Actions). Todo lo portable falla igual:

- La cadena de hash `prev` de gstack **pasa en verde sobre un archivo borrado** (`egress-receipt.ts:321` + `:379-391`), y ellos lo documentan como decisión de diseño.
- El fingerprint de sesión de ponytail es un archivo-bandera que `clearMode()` borra tragándose el error (`hooks/ponytail-runtime.js:38-40`) y cuya ausencia significa "protocolo apagado".
- Los tags de git de ponytail se reescriben con `git tag -f`, y el chequeo corre sólo en CI, no en `npm test` (`.github/workflows/test.yml:32-33` vs `package.json:37`) — **el ancla vive justo donde el agente no la ejecuta.**
- El centinela de salida prematura de googletest (`gtest.cc:5576`) detecta crashes, no fraude, y se desactiva en silencio si no se pudo crear (`:5177-5183`).

**Lo máximo honesto disponible:** tamper-evidence parcial (inventario biyectivo del recibo → el borrado *parcial* es error, `release.py:1817-1825`; marca de agua monótona guardada **fuera** del directorio de sellos → borrarlos deja una contradicción detectable, `ChromaSyncState.ts:105`; `wtree` en el object database de git).

**Recomendación adversarial:** dejar de prometer sellado del historial y **reescribir el claim**: "VCP detecta edición y borrado parcial de sellos; no detecta el borrado total ni la refabricación completa, y eso es por diseño porque no hay ancla externa sin infraestructura". La honestidad del threat model escrito en el binario (como hace gstack) vale más que la ceremonia.

### 🔴 SIN RESPUESTA — Cadena de custodia: nadie firma un receipt

Grep sistemático en tres repos distintos: claude-obsidian → cero resultados de gpg/sigstore/cosign, y sus tests **desactivan el firmado** (`tests/test_release.py:50`). marin → los únicos aciertos son JWT/HMAC para auth de cluster con secretos en base de datos. claude-mem → sólo comentarios. ai-engineering → cero resultados de in-toto, sigstore, Merkle y "transparency log" en todo el árbol.

Los dos intentos existentes fallan por la misma razón matemática: **HMAC no es firma** (la misma clave firma y verifica, el agente firma lo suyo), y SHA-256 sin clave sólo elimina ambigüedad de serialización — quien edita el receipt recalcula el digest en la misma línea. Custodia real necesita asimetría y una clave privada fuera del alcance del agente: eso es un gestor de secretos, un HSM, o una firma del usuario en otra máquina.

**Recomendación:** o se inventa (por ejemplo, una clave que el usuario custodie fuera del repo, con el costo de UX que implica), o se elimina la palabra "custodia" del vocabulario de VCP.

### 🔴 SIN RESPUESTA — Consentimiento humano real

Ninguna fuente lo resuelve y varias lo admiten explícitamente. El mejor mecanismo del corpus (hash del plan regenerado, `cli.py:86-101`) es un gate de **integridad disfrazado de gate de consentimiento**: un agente que corre inspect y apply en el mismo turno se copia el hash a sí mismo. La clasificación de puertas de una vía falla abierto por default (`one-way-doors.ts:150-151`). El checklist de tres booleanos es indistinguible de tres booleanos escritos por el agente. Probar que respondió una persona requiere un canal fuera de banda — terminal interactiva verificada, aprobación en otro sistema — o sea, infraestructura.

**Recomendación:** renombrar el gate. "Decisión registrada e íntegra" es verdad y es útil. "Decisión querida por la persona" es falso.

### 🟡 SIN RESPUESTA ÚTIL — Cobertura instrumentada de Bash y PowerShell

Cuatro respuestas parciales, ninguna es cobertura:

- `bash -n` (scientific `structure.py:409`) — parsea, cero ramas ejecutadas, cero asserts. **Y se saltea en Windows sin bash**, o sea reintroduce el verde por entrada faltante.
- Tabla de verdad por subproceso (googletest `googletest-fail-if-no-test-linked-test.py:98`) — es e2e dirigido: sabés que N casos pasan, no qué ramas quedaron sin tocar. Y el costo de spawn en Windows multiplica el tiempo del gate.
- Correr el script real bajo fixture con inyección de fallo (ai-engineering `test_translate_workflow.py:204-236`) — lo mejor del corpus, pero el truco de inyección vía hooks de git es POSIX; para PowerShell hay que inventar otro mecanismo. Y la extracción por marcador de línea (`:42-43`) se rompe si reindentás el archivo fuente.
- Generar el shell desde TypeScript y comparar byte a byte (claude-mem `plugin-distribution.test.ts:414`) — mueve la cobertura al generador, que sí es instrumentable, pero **prueba el texto, no la semántica**. Presentarlo como "cobertura de Bash" sería la métrica engañosa que VCP dice evitar.

**PowerShell específicamente: cero material en los 14 repos.** claude-obsidian no tiene una sola línea de PowerShell; googletest usa Python para manejar subprocesos.

**Recomendación:** dejar de llamarlo cobertura. Adoptar tabla de verdad + generador, y **poner el hueco en el registro de lo no medible** (patrón 20) para que aparezca impreso al lado de cada verde.

### 🟡 ATACADO PERO NO RESUELTO — Trazabilidad semántica

Cada mecanismo sube el piso y **todas las fuentes admiten que ninguno prueba que el test ejercite el criterio**: la cita verificada prueba que la línea existe; el anclaje por trigramas es "un name-match un poco más profundo" (`review_api.py:317-339`); el check nombrado que no existe puntúa FAIL pero la función puede ser `return True`; el catálogo de asserts débiles es regex.

Realistamente VCP puede pasar de *"existe un test que nombra el criterio"* a *"existe un test que nombra el criterio, cuya cita existe en ese commit, cuyo assert no está en el catálogo débil, y que **falla contra un fixture mutado**"*. El último eslabón (mutación por criterio, patrón 2 aplicado a los tests del producto y no sólo a los gates) es el único avance real y es el más caro.

### 🟢 BIEN SERVIDO — Los dos huecos con más respuestas

- **"Gates degradan a verde"**: cinco mecanismos convergentes y baratos (patrones 1, 3, 4, 5, 12). Es el hueco mejor atendido del corpus.
- **"Aceptar cubre archivo+categoría"**: resuelto en mecanismo (patrón 6, 7 fuentes). Lo que queda es una decisión de diseño — qué entra en el hash — que ninguna fuente resuelve bien y que va a costar iteraciones.
- **"Estado de sesión declarado vs verdadero"**: bien servido (patrones 7, 9, 10). El envoltorio de evidencia es la respuesta más fuerte del corpus a cualquier hueco.

---

## 6. LOS TRES PRIMEROS

Si mañana se implementan sólo tres cosas:

### 1) Denominador obligatorio + fallo por conjunto vacío, en TODOS los gates

**Por qué:** es el hueco nombrado #1 de VCP, es el patrón más convergente del corpus (8 fuentes independientes), cuesta una línea por gate, y se revierte borrando un commit. Incluye tres piezas que van juntas: (a) el gate falla si su conjunto de entrada está vacío sin una razón declarada por fase; (b) el receipt publica siempre `vistos / esperados`; (c) auditoría de una tarde sobre las sondas, prohibiendo las que no distinguen "no existe" de "existe y está vacío". Empezá por el caso más barato y más letal, el typo (patrón 4, allowlist cerrada de llaves): si el archivo de claims dice `critera:`, hoy el gate ve cero items y pasa.

**El costo real:** hay que decidir el mínimo esperado por fase, o rompés el bootstrap. Eso es trabajo de diseño, no de código.

### 2) Test negativo obligatorio por gate: entrada rota → rojo con el token del criterio

**Por qué:** la convergencia negativa de §4 lo convierte de opción a requisito. **Siete de catorce repos degradaron su propia doctrina fail-closed dentro de su propio código.** No hay ninguna razón para creer que VCP sea la excepción, y este es el único mecanismo del corpus que detecta un gate que quedó siempre-verde tras un refactor. Implementación mínima: por cada gate, un fixture roto en tmpdir, exit != 0, y el mensaje debe contener el token del criterio (googletest `gtest-spi.h:149` es el modelo exacto). Bonus del mismo precio: correr los gates desde una copia podada del árbol y afirmar rojo (archify `degraded.test.mjs`).

**El costo real:** cada gate suma un fixture vivo que se pudre callado. Mitigación: el mensaje esperado se deriva de la misma constante que el gate emite, no se copia a mano.

### 3) Fingerprint de contenido para las aceptaciones, con carve-out de credenciales

**Por qué:** cierra el hueco #2 de VCP de frente, es `node:crypto` sin dependencias, tiene 7 fuentes convergentes incluidas **dos implementaciones independientes dentro del mismo repo** (señal fortísima), y es reversible porque las aceptaciones viejas se pueden re-emitir. La regla: la aceptación se indexa por `sha256(regla + ruta + el código concreto normalizado)`, no por (archivo, categoría); si el código citado cambia, la aceptación muere sola. Y la mitad que **no** es opcional: cuando el hallazgo es una credencial, el snippet se vacía y la huella se calcula sobre símbolo + línea, **nunca sobre el texto del archivo** — porque el receipt viaja fuera de la máquina y el hash sería un oráculo offline.

**El costo real:** el diseño de qué entra en el hash es todo el juego, y las fuentes no lo resuelven. Muy laxo y volvés a archivo+categoría; muy estricto y la re-aceptación en bloque te devuelve el rubber-stamping. Empezá con ventana de contexto chica y medí cuántas aceptaciones se invalidan por semana antes de congelar la fórmula.

### El cuarto, que casi entra: el envoltorio de evidencia

Es el mecanismo de **mayor valor** del informe (ataca "declarado vs verdadero" de raíz: el agente no puede escribir un registro verde sin haber corrido algo verde). No está en el top-3 por dos razones concretas: cuesta más que los otros tres juntos, y tiene un modo de falla documentado que **destruye la propiedad por la que existe** — el wrapper de gstack alteró el entorno del hijo y certificó una corrida que no era la corrida real (`bin/gstack-evidence:158-183`, "cuatro tests fallaron 4/4 a través del envoltorio y pasaron 5/5 sin él"). VCP correría sobre Node, Bash y PowerShell con tres modelos de entorno distintos, o sea tres veces esa superficie de error. Implementalo cuarto, con entorno explícito y con su propio test negativo (patrón 2).

---

## Qué NO prueba este informe

- **No prueba que estos patrones funcionen.** Nadie ejecutó nada; todo es lectura de código. Cuando digo "el gate hace X", significa "el código afirma hacer X".
- **No prueba que sean los mejores patrones de estas fuentes.** Se leyó el 2,05 % de los archivos, con lecturas parciales infladas como archivos completos, y con selección deliberadamente sesgada al ángulo pedido. Son los mejores de lo que se leyó.
- **No verifiqué ninguna cita.** Las 14 fuentes las verificaron contra commits pineados; yo las propago.
- **Quedan 15 261 archivos sin abrir.** Si existe una respuesta portable al ancla externa o a la firma del receipt, está ahí adentro y nadie la vio.
