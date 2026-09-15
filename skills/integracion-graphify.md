# Integración opcional con un grafo externo

**Esto NO es parte del camino obligatorio del protocolo.** VCP cierra la fase 8 sin ninguna
herramienta de grafo: para eso está `verify-ia-stack-index.mjs`, que es Node y git y nada más.

Durante un tiempo estos pasos estaban en la fase 8.2 **sin marcarse como opcionales**, y encima un
gate estaba cableado a la salida de esa CLI. Quien instalara VCP sin ella no podía cerrar la fase,
y el documento no se lo decía. Eso era una dependencia no declarada presentada como requisito.

Si tenés la herramienta y la querés usar, los pasos son estos.
- **Integración opcional con un grafo externo.** Si usás una herramienta de grafo, su paso está en
  `skills/integracion-graphify.md` (este archivo). **No es parte del camino
  obligatorio**: el protocolo cierra la fase 8 sin ella.
  Ese gate verifica que el destino de la exportación esté dentro del proyecto, que sea un árbol
  regular y sin symlinks, y que contenga un `graph.canvas` JSON válido con `nodes` y `edges` más al
  menos una nota Markdown;
  No juzga la semántica de las notas ni si Graphify interpretó correctamente cada nota.
  El manifiesto va a `graphify-out/`, que está ignorado por git **a propósito**: si se commiteara,
  el propio commit del sello movería HEAD y lo dejaría viejo al instante. Por eso el sello es lo
  último de la fase, después del último commit.
  Ese respaldo generado se ata al árbol commiteado: queda viejo si HEAD, el informe o el grafo
  changes. El orden es **commit → graphify → record → check**, y no es cosmético: `record` sella el
  HEAD real leyéndolo con `git rev-parse`, así que registrar antes de commitear ata el receipt al
  commit anterior y `check` lo rechaza.
  ```bash
  node .vibe/ia-stack-runtime/scripts/verify-backup-state.mjs record \
    --report graphify-out/GRAPH_REPORT.md --graph graphify-out/graph.json \
    --manifest graphify-out/backup-state.json
  node .vibe/ia-stack-runtime/scripts/verify-backup-state.mjs check graphify-out/backup-state.json
  ```
  **El sello lo registra el protocolo, no Graphify.** El gate no lee el `- Built from commit:` del
  `GRAPH_REPORT.md`, y la razón es concreta: Graphify sólo reescribe ese reporte cuando cambia la
  **topología** del código, así que un commit de sólo documentación deja ese sello apuntando a un
  ancestro para siempre aunque el contenido del grafo esté al día, y no hay forma de regenerarlo
  (`GRAPHIFY_FORCE=1` no alcanza sin cambios de topología y `graphify label` pide una API key). Lo
  que el receipt prueba es que el reporte y el grafo registrados no cambiaron desde que se
  registraron sobre ese HEAD; **no prueba que el grafo se haya construido en ese commit**. Esa otra
  mitad —que el grafo cubra los archivos del commit actual— la prueba `verify-graphify-manifest.mjs`
  contra `git ls-files`, acá abajo.
  Después del reindexado, probá que la cobertura declarada del grafo sea honesta:
  ```bash
  node .vibe/ia-stack-runtime/scripts/verify-graphify-manifest.mjs check
  ```
  Cada archivo rastreado debe estar en `graphify-out/manifest.json` o llevar una exclusión con
  razón en `contracts/graphify-exclusions.json`; una entrada del manifest que Git ya no rastrea es
  un fantasma y se rechaza.
  **Viejo y deshonesto no son lo mismo, y la edad se lee de la fecha de modificación.** Un archivo
  rastreado que el manifiesto no tiene significa una de dos cosas opuestas: si ya existía cuando el
  grafo se construyó, la declaración de cobertura es falsa y el gate rechaza; si nació después, el
  grafo no miente, está viejo, y el gate escribe `DESACTUALIZADO:` con los nombres y sale `0` —
  porque el reindexado va al publicar, en este orden, y no en cada archivo que se agrega. Una
  exclusión que termina en `/` es una carpeta y cubre lo que viva abajo, para que archivar un
  expediente o una sesión no exija reindexar; un prefijo sin archivos abajo sigue siendo exclusión
  muerta. **Límite:** `git checkout` y un clon reescriben las fechas de modificación, así que la
  clasificación puede correrse hacia «desactualizado» después de una operación de Git que toque el
  árbol. El error cae del lado seguro: reporta de más, nunca aprueba una cobertura mentida. El gate prueba contabilidad, no comprensión: un archivo indexado
  todavía puede haber producido cero nodos, así que "cubierto" nunca significa "entendido".

## El export a Obsidian

Si además exportás a un vault, el gate comprueba la forma de lo exportado:

```bash
node .vibe/ia-stack-runtime/scripts/verify-obsidian-export.mjs check graphify-out/obsidian
```

Verifica que el destino esté dentro del proyecto, que sea un árbol regular y sin symlinks, y que
contenga un `graph.canvas` válido con `nodes` y `edges` más al menos una nota Markdown.

**Límite:** comprueba destino y forma. No juzga la semántica de las notas ni si la herramienta
interpretó correctamente su contenido.
