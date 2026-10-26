## PHASE 5.5 — TRIANGULATE (antes de refactorizar)

Existía como una instrucción de prosa adentro del bucle de Build, y por eso no dejaba rastro:
quien refactorizaba decidía solo qué vectores buscó, y nadie podía leer después cuáles miró.
**Sin una lista fija se revisa lo que uno ya sabe buscar**, que es justo lo que no encuentra
nada nuevo.

Los vectores viven en `contracts/triangulate-vectors.json` —hoy 26, cada uno con el motivo por
el que está—. El expediente de la funcionalidad declara **cada uno** con uno de tres estados:
`covered` nombra la prueba que lo cubre, `not_applicable` y `pending` traen motivo escrito. Un
vector que falta rechaza, y uno que el contrato no declara también.

```bash
node .vibe/ia-stack-runtime/scripts/verify-triangulate.mjs check docs/triangulate/<feature-slug>.json
node .vibe/ia-stack-runtime/scripts/verify-triangulate.mjs check docs/triangulate/<feature-slug>.json --require-complete
```

Sin la bandera informa cuántos quedan pendientes y sale `0`: sirve mientras se trabaja. Con
`--require-complete` **un pendiente frena el cierre**, que es la regla del protocolo: no se
refactoriza hasta cerrar TRIANGULATE.

**El gate verifica que cada vector esté declarado, nunca que la prueba nombrada lo ejercite.**
Un `covered` que apunta a un archivo cualquiera pasa igual, y la lista de vectores es fija: su
completitud es una decisión humana, no un resultado del gate.

🔵 **Triangulación cerrada — ¿se refactoriza?**

- **A)** Sí, pasar a REFACTOR — *(recomendado si `--require-complete` sale en verde)*. Los vectores
  declarados quedaron cubiertos, así que refactorizar tiene contra qué chocar.
- **B)** Faltan vectores — [decime cuáles]. Se derivan y se cubren primero: refactorizar con
  vectores abiertos es mover código que nada vigila.
- **C)** Un vector no aplica a este cambio — [decime cuál y por qué]. Queda escrito como exclusión
  con su motivo, que es distinto de darlo por cubierto.

Esperando tu respuesta antes de continuar.

---
