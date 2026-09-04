# Research: investigar antes de especificar

Este documento vivía adentro del README. Se mudó para que el README pueda enseñar en cinco
minutos sin dejar de ser la superficie donde los contratos están clavados.

**No se borró ninguna ancla:** cada frase que un contrato exige sigue existiendo, con su campo
`file` apuntando acá.
Para un cambio que no sea claramente trivial, VCP no empieza escribiendo código ni una spec a
ciegas. Primero hace una pasada de **Discovery**. Su salida es la evidencia que alimenta la spec;
no es un reporte decorativo al final.

1. **Research trazable:** fuentes, versión/fecha, límites de lectura y claims que sí o no sostienen
   una decisión.
2. **Diagnóstico CAIO:** doce dimensiones —proceso roto, información perdida, trabajo repetido,
   bucles abiertos, decisiones sin dueño, estados no medidos, handoffs defectuosos, errores que
   se repiten, ausencia de aprendizaje, costos ocultos, riesgos de seguridad y dependencia de
   memoria conversacional—, cada hallazgo clasificado como observado, hipótesis, inferencia o
   dato faltante. **Un observado sin evidencia se rechaza**, y una dimensión sin hallazgos tiene
   que decir si se miró y no había nada o si no se miró: el silencio no pasa por diagnóstico.
   Límite: **el gate no abre el locator de una evidencia**, así que un observado con una cita
   inventada pasa igual. Comprueba que la etiqueta cargue lo que su nombre exige, no que sea cierta.
3. **Mapa de bucle:** trece campos por flujo —entrada, transformación, actor, decisión, quién
   decide, acción, métrica, control, evidencia, aprendizaje, siguiente iteración, condición de
   salida y condición de bloqueo— más un `delta` entre el flujo de hoy y el objetivo.
   **El delta se verifica contra el documento**: declarar un cambio en un campo que quedó
   idéntico rechaza, y omitir uno que sí cambió también. Los otros doce campos son prosa que el
   gate no puede juzgar. El primer bucle declara rollback y señales de fallo.
4. **PRD y planes:** veintiuna secciones —incluidas seguridad, privacidad, observabilidad, datos,
   arquitectura, métricas, rollout y rollback como campos propios— y criterios de aceptación de
   seis partes: evento, precondición, acción, resultado observable, test y evidencia esperada.
   **Un criterio en prosa no alcanza**, porque no deja ver cuál de las seis partes falta.
5. **Adopción y recurrencia:** quién sostiene el cambio y quién lo ejecuta todos los días son
   dos personas distintas, y las dos se declaran. La adopción trae checklist y una métrica con
   línea de base, no sólo una señal. La recurrencia declara cuándo se promueve una mejora y
   **cuándo se retira**: sin criterio de retiro, una mejora que dejó de servir se sostiene por
   inercia.

Cada decisión se guarda como JSON inmutable bajo
`docs/discovery/<feature>/runs/run-NNN/{decisions,packets}/`. Un packet completed conserva su
snapshot de research y hash; la validación nunca relee un ledger mutable para reinterpretar la
historia. Las vistas Markdown bajo `docs/discovery/<feature>/views/` son derivadas, no fuente de
verdad: se regeneran y se comparan byte a byte.

El corpus externo puede auditarse con `research/build-complete-review-index.mjs`: abre y hashea
cada entrada materializada, y registra señales estructurales sin confundirlas con comprensión
semántica. El ledger profundo mantiene separado lo que fue leído funcionalmente de lo que sólo fue
revisado estáticamente; VCP nunca presenta un barrido automático como lectura humana.

Los lotes de lectura profunda se validan con `research/verify-semantic-deep-evidence.mjs`: cada fila
debe conservar el commit, SHA-256 y cantidad de líneas del manifest, y sus citas deben apuntar a
líneas reales del archivo pineado. Este gate valida la evidencia; no promociona por sí solo una fila
del ledger estricto a `READ`.

Para comprobar que no quedó ninguna entrada sin abrir, ejecutá `node research/build-full-evidence-pass.mjs`
y luego `node research/verify-full-evidence-pass.mjs`. El resultado cubre cada pendiente por hash y
bytes, pero conserva un estado asistido: una lectura física completa no reemplaza una interpretación
semántica funcional.

### Diagnóstico antes de construir

Después de entender qué quiere construir la persona, pero antes de escribir la Spec, VCP guarda
seis piezas de Discovery en `docs/discovery/<feature>/diagnostics/`: CAIO (proceso roto), mapa de
bucle (hoy y objetivo), PRD, plan de implementación, plan de adopción y plan de recurrencia. Son
la entrada de la Spec: obligan a declarar quién decide, qué se mide, qué se construye, cómo se
adopta y cuál es el siguiente bucle de mejora. El gate nativo comprueba campos, IDs, dependencias,
evidencia y referencias:

```bash
node .vibe/vcp-runtime/scripts/verify-product-diagnostics.mjs check <feature-slug> --require-inputs
```

**Los diagnósticos comprueban forma e invariantes, nunca verdad semántica.** Una fila puede tener
fuente y locator válidos y aun así interpretar mal el negocio; eso sigue siendo revisión humana.

El cierre funcional reproducible de esas entradas usa el ledger nativo:

```bash
node research/build-semantic-functional-ledger.mjs
node research/verify-semantic-functional-ledger.mjs research/semantic-functional-evidence-2026-09-01.ndjson.gz
node research/build-semantic-functional-synthesis.mjs
```

Cada fila queda `FUNCTIONAL_SCAN` si se recorrió todo el texto con interfaces, señales y citas de
línea, o `STATIC_REVIEWED` si es un artefacto binario/opaco con locator de bytes. No quedan
pendientes ilegibles, pero esto no convierte señales lexicales en aprobación: `FUNCTIONAL_SCAN`
es observación determinista (`semantic_claim: false`), no comprensión humana; la síntesis es una
cola de candidatos y cada adopción vuelve a pasar por el ciclo completo y un menú
🔵. El loop de aprendizaje y deduplicación se describe en
`skills/vibe-memory.md` (§ RESEARCH SELF-IMPROVEMENT LOOP).

Los `.ndjson` y `.gz` son salidas generadas e ignoradas por Git por su tamaño; el resumen, la
síntesis y los builders/verificadores sí viajan con la skill y permiten regenerarlos en un checkout
que tenga el corpus materializado.

```bash
# Verifica la cadena inmutable de decisiones y snapshots.
node .vibe/vcp-runtime/scripts/verify-discovery-core.mjs check --feature <feature-slug>

# Resuelve cada fuente citada contra el árbol: el archivo existe y su huella sigue siendo la declarada.
node .vibe/vcp-runtime/scripts/verify-discovery-core.mjs sources --feature <feature-slug>

# Ancla externa: el expediente solo crecio a lo largo de la historia de git.
node .vibe/vcp-runtime/scripts/verify-discovery-core.mjs history --feature <feature-slug>

# Genera y luego comprueba vistas reproducibles (sin timestamps ni paths del entorno).
node .vibe/vcp-runtime/scripts/verify-discovery-views.mjs render --feature <feature-slug>
node .vibe/vcp-runtime/scripts/verify-discovery-views.mjs check --feature <feature-slug>
```

Discovery puede terminar en `completed`, `skipped` u `overridden`, siempre con evidencia y motivo.
No prueba que una fuente sea suficiente semánticamente ni sustituye a quien decide el producto:
hace visible qué evidencia se usó, qué quedó fuera y qué decisión humana falta antes de pasar a
Spec.

