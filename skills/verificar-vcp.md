# Verificar el propio VCP

Este documento vivía adentro del README. Se mudó para que el README pueda enseñar en cinco
minutos sin dejar de ser la superficie donde los contratos están clavados.

**No se borró ninguna ancla:** cada frase que un contrato exige sigue existiendo, con su campo
`file` apuntando acá.
Antes de publicar cambios en este repositorio corré:

```bash
node --test --test-concurrency=32
node scripts/verify-vcp-coverage.mjs
node scripts/verify-vcp-contract.mjs check
node scripts/verify-security-baseline.mjs check --base origin/main
git diff --check
```

El segundo comando no informa un porcentaje: exige que **algún proceso de la suite haya ejecutado
cada función y cada rama** de los scripts que mide, y si falta alguna la nombra con archivo y
línea. Mide ejecución, no aserción: una rama que corrió dentro de una prueba que no afirma nada
cuenta igual que una verificada.

**Qué mide y qué no.** Mide `scripts/`. No mide `tests/` (son el instrumento) ni `research/`
(herramientas de un solo uso que leen un corpus que no está en git). El recorte está escrito en
`contracts/coverage-scope.json` con su motivo, y `tests/coverage-scope.test.mjs` rechaza que
aparezca un directorio con código Node que el contrato no mencione. Ahí también queda declarado
que cuatro verificadores de `research/` que el protocolo manda correr **no tienen prueba propia**:
es deuda escrita, no cobertura. Los scripts Bash y PowerShell se validan aparte, con
`verify-shell-coverage.mjs` y sus fixtures.

<!-- concurrencia: histórico -->
**Sobre la concurrencia.** Durante un tiempo este bloque decía `--test-concurrency=1`. Serializar
no arreglaba nada: tapaba una suite inestable, y de paso escondía los huecos de cobertura. El
defecto se cerró —la medición está en `tests/spawn-budget.mjs`—, así que el valor volvió a 32.
`VCP_TEST_CONCURRENCY` existe para una máquina con menos núcleos, no para volver a esconder un
rojo. **Diez corridas en verde no demuestran que la suite sea determinista**: son la ausencia de
un contraejemplo en diez intentos.

Una prueba compara cada número que este archivo afirma como el default contra la constante real
del script, porque la fila de la tabla de gates llegó a decir lo contrario que el párrafo de más
arriba, en la misma página. El párrafo anterior cita el valor viejo a propósito, así que lleva la
marca `<!-- concurrencia: histórico -->`, que exime el párrafo siguiente y termina en la línea en
blanco. **La marca es una declaración, no una prueba:** puesta encima de una afirmación viva apaga
la comprobación sin avisar. Lo que la sostiene es que es literal y buscable —
`grep -rn "concurrencia: histórico" README.md` lista todas las excepciones del archivo.

Para crear un paquete distribuible:

```bash
./scripts/build-zip.sh
```

El empaquetador arma el paquete desde `git ls-files`, **archivo por archivo**, acotado a la
allowlist de distribución: lo que no está versionado no viaja, ni siquiera si está adentro de un
directorio incluido. Si el árbol no es un repositorio **falla cerrado**, porque publicar sin
poder distinguir lo versionado de lo local es peor que no publicar. Rechaza paths inseguros y
genera el SHA-256 del ZIP.

