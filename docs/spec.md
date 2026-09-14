# Spec: eleccion-de-stack

**Fecha:** 2026-09-14 · **Estado:** propuesta
La spec anterior (`lanzamiento-ia-stack`, implementada) se recupera con `git show 7d98266:docs/spec.md`.

## Problem / Problema

El protocolo detecta el stack y no lo elige. Un proyecto nuevo no tiene qué detectar, así que arranca
sobre lo que el agente supuso, y ese supuesto no queda escrito. Y el gate de test rojo acepta un solo
runner, de modo que elegir un stack que no sea Node deja al proyecto sin poder cumplir LAW 1.

## Discovery / Investigación previa

Cuatro ejes contra documentación oficial, cada afirmación con URL y fecha de consulta. Doce claims
atados a la decisión `d002` de `run-001`. Lo medido:

| Hallazgo | Consecuencia para esta spec |
|---|---|
| `typescript@latest` es 7.0.2 y `typescript-eslint` lo excluye por rango de pares | La matriz fija versiones exactas, nunca «la última estable» |
| pytest y vitest se falsificaron: cero pruebas fallando, evidencia coherente, salida 1 | Los adaptadores entran con garantía declarada como menor |
| La firma de código en Windows exige token físico, y la opción barata excluye regiones | El costo de escalar se declara por servicio, no se infiere |
| El expediente de candidatos no acepta fuente documental; el packet de Discovery sí | Se declara el desacuerdo, no se unifica en este ciclo |

## Target Users / Usuarios

| Quién | Cuándo |
|---|---|
| Quien instala el protocolo en su repositorio | Al arrancar algo nuevo, antes de escribir una línea |
| Quien retoma un ciclo ajeno | Al abrir la sesión, para entender por qué ese stack |
| Quien mantiene el protocolo | Cuando la captura vence y hay que revalidarla |

## Acceptance Criteria / Criterios de aceptación

El pedazo mínimo es AC1 más AC2: que declarar un tipo de producto devuelva un stack con fuente,
fecha y costo de escalar. Si eso solo no ahorra trabajo, el resto no lo salva.

- [ ] **AC1:** GIVEN un expediente de Intake, WHEN declara `tipo_de_producto` con código fuera del enum A-H o sin motivo real, THEN `verify-intake.mjs` sale 1 nombrando la clave.
- [ ] **AC2:** GIVEN la matriz, WHEN algún tipo de producto no tiene fila, THEN `verify-stack-matrix.mjs` sale 1 y nombra el tipo faltante.
- [ ] **AC3:** GIVEN un servicio referenciado por la matriz, WHEN no declara qué evento saca del plan gratuito, THEN el gate sale 1 y nombra el servicio.
- [ ] **AC4:** GIVEN el contrato de límites, WHEN su fecha de captura supera el período declarado, THEN el gate sale 1 en vez de aceptarla.
- [ ] **AC5:** GIVEN un directorio sin matriz, WHEN corre el gate, THEN escribe `VACÍO:` y sale 0, y la prueba de vacío lo acepta como tal y no como aprobación.
- [ ] **AC6:** GIVEN un runner no declarado, WHEN se pide el gate de test rojo, THEN sale 1 nombrando el comando, sin adivinar adaptador.
- [ ] **AC7:** GIVEN un reporte de pytest cuya línea señalada no contiene una aserción, WHEN corre el adaptador, THEN sale 1; y su límite honesto declara que un reporte forjado que sí la contenga pasa igual.
- [ ] **AC8:** THE SYSTEM SHALL registrar en el receipt con qué adaptador se obtuvo cada verde, de modo que el de garantía menor no se lea igual que el nativo.
- [ ] **AC9:** GIVEN lo versionado, WHEN contiene una ruta absoluta de directorio personal, THEN el gate de repositorio limpio sale 1 antes de que la traza se selle.
- [ ] **AC10:** GIVEN un frontmatter de skill, WHEN declara una cantidad de fases distinta de la canónica, THEN la suite sale 1 nombrando el archivo.

## Constraints / Restricciones

| Restricción | Por qué |
|---|---|
| Presupuesto cero, sin crear ni ampliar recursos cloud | El research se hace leyendo documentación, no aprovisionando |
| El repositorio publicado queda limpio de datos del autor | Se instala en máquinas de terceros; ya falló antes |
| No se toca traza sellada | Es append-only y LAW 5 lo prohíbe; por eso AC9 corre **antes** de sellar |
| Cero dependencias externas nuevas | Node nativo, como el resto del protocolo |
| Versiones exactas, nunca por rango | Medido: resolver por caret lleva a un árbol que no compila |

## Non-Goals / No-Goals

| Qué no entra | Por qué queda cerca y aun así afuera |
|---|---|
| Generar el proyecto | Esto elige el stack; no crea archivos ni instala nada |
| La tabla navegable de la matriz | Se construye después, desde el mismo dato, nunca a mano |
| Adaptadores para otros runners | Cada uno necesita su propio clasificador y su falsificación |
| El camino greenfield completo | El resto del protocolo sigue asumiendo un repositorio con historia |
| Unificar candidatos y packet de Discovery | Se declara el desacuerdo; unificarlo es otro ciclo |
| Prometer vigencia futura | Lo que se promete es la fecha de captura, no que siga siendo cierta |

## Stack & Dependencies

Node 24 LTS nativo, cero dependencias. Dos archivos de datos declarativos, nunca ejecutables:
`contracts/free-tier-limits.json` y la matriz en Discovery. Cuatro scripts nuevos, cada uno con su
prueba espejo, su entrada en la prueba de vacío y su límite honesto.

## Security surface / Superficie de ataque

Declarada en `docs/discovery/eleccion-de-stack/diagnostics/threat.json`: tres activos, dos actores,
dos entradas. La entrada `E2` —el proyecto bajo prueba, cuya configuración el runner ejecuta— queda
**aceptada sin control**, con el motivo medido y el dueño escritos. Ningún gate abre un puerto ni
sale a la red.

## Definition of Done (DoD)

| Término | Cómo se comprueba |
|---|---|
| Cobertura | Cada función y cada rama de los scripts nuevos, medida sobre la suite entera |
| Lint y tipos | Cero, con la suite en verde |
| Documentación | Cada gate con su fila en la referencia y su límite honesto verificado literalmente |
| Memoria | Bitácora, decisión de fase sellada y línea de traza encadenada |
| Seguridad | Barrido de repositorio limpio en cero, y cada control con su criterio de aceptación |
| Adversarial | Ronda con refutador, con los conteos cerrando contra lo propuesto |
| Soporte | Los cuatro campos declarados, cada uno con valor real o con su motivo escrito |

## Riesgos

| Riesgo | Qué lo acota |
|---|---|
| Datos privados en el repositorio publicado | AC9, corriendo antes de sellar. Límite: alcanza para rutas, no para nombres de proyecto |
| La matriz envejece y sigue recomendando lo viejo | AC4: rechazo por antigüedad, sin aviso blando |
| Un verde débil se lee como uno fuerte | AC8 más el límite honesto de cada adaptador |
| La matriz se llena de opinión en vez de fuentes | AC3: una fila sin servicio que resuelva no pasa |
| La tabla navegable empuja el cierre | Queda en Non-Goals y se genera desde el dato |
| Medición de adaptadores hecha en entorno no limpio | Declarado como límite en su ficha; repetir en entorno virgen antes de construir |
| Los criterios de esta spec dan verde contra pruebas de otra funcionalidad | Los identificadores no llevan el slug y la plantilla numera desde AC1, así que el solapamiento es la regla. Declarado como límite el 2026-09-14; **el verde de `evidence-trace criteria` no cuenta como cobertura de estos criterios hasta que exista la prueba nombrada en cada uno** |
