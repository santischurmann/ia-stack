# Verificar el propio VCP

Este documento vivía adentro del README. Se mudó para que el README pueda enseñar en cinco
minutos sin dejar de ser la superficie donde los contratos están clavados.

**No se borró ninguna ancla:** cada frase que un contrato exige sigue existiendo, con su campo
`file` apuntando acá.
Antes de publicar cambios en este repositorio corré:

```bash
node --test --test-concurrency=32
node scripts/verify-ia-stack-coverage.mjs
node scripts/verify-ia-stack-contract.mjs check
node scripts/verify-security-baseline.mjs check --base origin/main
node scripts/verify-gate-docs.mjs check
node scripts/verify-design-tokens.mjs check contracts/design-tokens.json
git diff --check
```

**El cuarto comando es el que impide que este documento se despegue de la máquina.** Comprueba que
cada gate de `scripts/` se pueda correr desde algún documento del protocolo —un comando copiable
adentro de un bloque de código— o esté declarado en `contracts/gate-docs.json` como uno que no se
invoca a mano, diciendo quién lo invoca y por qué. Se midió el 2026-09-15 que **ocho no tenían un
solo comando copiable en ninguna parte**, y seis de ésos ni siquiera aparecían en `SKILL.md`:
estaban nombrados sólo en la tabla de gates, que dice qué hacen y nunca cómo se corren. La batería
seguía verde —los gates andaban—, sólo que nadie afuera sabía invocarlos.

El quinto valida el sistema de diseño de las superficies visuales que este repositorio declara.
**Verifica forma y coherencia, nunca contraste ni legibilidad**: dos tokens que cumplen todas las
reglas pueden ser gris sobre gris.

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
`IA_STACK_TEST_CONCURRENCY` existe para una máquina con menos núcleos, no para volver a esconder un
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

## Las carpetas que una corrida interrumpida deja tiradas

```bash
node scripts/limpiar-temporales.mjs listar
node scripts/limpiar-temporales.mjs listar --borrar
```

**El primer comando no borra nada**: lista. El segundo saca sólo lo que la lista mostró. Medido el
2026-09-15: 198 carpetas de un solo prefijo, todas del mismo día. No faltaba ningún `rmSync` — el
delta de una suite completa es cero—: salen de corridas matadas, y un proceso que muere nunca
ejecuta su `finally`. Una carpeta con un `.mq5`, `.ex5`, `.env`, `.key` o `.pem` adentro **no se
toca**, aunque el nombre coincida.
