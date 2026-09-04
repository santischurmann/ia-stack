# Spec — ia-stack

> Estado: **borrador para decidir**. Nada de acá está construido todavía.
> Fecha: 2026-09-04 · commit `2c1e9ff`
> Método: 28 agentes en dos rondas — investigación, cinco lentes ciegas de auditoría,
> brainstorming divergente y una pasada adversarial que intentó matar cada diseño.

---

## 1. Qué queremos

Que **ia-stack** sea un protocolo de trabajo que cualquiera entienda en cinco minutos, que no
arrastre datos de otros proyectos, y que tenga su propio tablero local para ver en qué se trabajó,
cuánto costó y cómo va cada cosa.

En una frase: **hoy el proyecto es riguroso pero ilegible, y se rompe apenas alguien lo instala.**

---

## 2. Lo que el research encontró, medido

Esto no es opinión. Cada punto se reprodujo con un comando.

### 2.1 Los tres defectos que hay que arreglar antes de mostrar el proyecto a nadie

**🔴 Correr las pruebas te pisa tu configuración global de Claude Code.**
`scripts/install.sh` escribe por defecto en `$HOME/.claude/skills` y `$HOME/.claude/vcp-runtime`.
La opción `--project` **no** cambia eso. La suite llama al instalador, así que
`git clone && node --test` le sobrescribe la configuración a quien lo corra.
Confirmado con la fecha de modificación del archivo en esta máquina.

**🔴 El repositorio está verde y toda instalación nace en rojo.**
Instalar en un proyecto limpio y correr la suite daba **42 fallos sobre 1090**. Ya bajó a **26**
con la separación de self-checks, y quedan 26 por la misma causa: pruebas que leen archivos del
checkout que el instalador no copia.

**🔴 El repositorio publica datos de otro proyecto tuyo.**
`docs/ablation.json` explica en dos líneas cómo está estructurado el licenciamiento de otro producto
tuyo. `SKILL.md` fase 8.2 nombra una subcarpeta de tu Obsidian personal y exige una herramienta
externa que no es dependencia declarada. Tres líneas de `.vibe/AUDIT.md` enumeran categorías de ese
otro árbol, y una trae fragmentos literales.

### 2.2 Los datos que existen, y los que no

| Qué | Dónde | Estado |
|---|---|---|
| Tokens y marcas de tiempo por turno | `~/.claude/projects/*.jsonl` | **Existe.** 22 proyectos, 5.010 archivos, 1.434 MB |
| Traza de trabajo con fecha y actor | `.vibe/AUDIT.md` | Existe. 139 líneas, tres formatos mezclados |
| Recibos de tareas cerradas | `.vibe/receipts/*.json` | Existe. 15, esquema estable |
| Historia con fechas | git | Existe. 170 commits |
| **Precio en dinero** | — | **No existe.** Ningún dato de tarifas en disco |
| **Horas trabajadas** | — | **No existe.** Sólo hay reloj de pared: 447,9 h que no son horas de trabajo |
| `.vibe/counters.json` | repo | Existe pero **vacío** |
| `docs/specs/`, `docs/plans/` | repo | **No existen**, aunque los documentos los nombran |

### 2.3 Lo que el protocolo se documenta mal a sí mismo

- **Son once fases, no diez.** Falta `1.5 INTAKE` en tu lista, y Bootstrap es la 1, no la 0.
- **Hay tres vocabularios de fases distintos en el repo y ninguno coincide** con los otros.
- El README tiene **446 líneas** y el 60 % es una tabla que repite 14 entradas.
- **El README no es texto libre:** 77 anclas mecánicas lo leen del disco. Acortarlo sin tocar los
  contratos pone gates en rojo.

---

## 3. Qué se va a construir

Cinco piezas. El adversarial **mató dos** de los cinco diseños originales y obligó a cambiar los
otros tres. Lo que sigue es lo que sobrevivió.

### 3.1 El tablero local

**Qué hace.** Un comando genera una página que abrís con doble clic. Muestra tus proyectos, las
sesiones de trabajo, en qué fase quedó cada una, cuántos tokens se gastaron, y qué se hizo.

**Por qué así y no un servidor.** Enumerar los 5.010 archivos cuesta 387 ms; leerlos cuesta 24 s.
Esa diferencia de 60 veces dice que hay que leer una vez y guardar el resultado, no releer al
mostrar. Una página generada no deja ningún proceso corriendo, se archiva, se compara con la del mes
pasado y se puede leer con un editor de texto.

**Lo que el adversarial mató, y cómo se salva.** El diseño original escribía la página **dentro del
repositorio**, con datos agregados de tus 22 proyectos — exactamente la contaminación que pediste
evitar, y el gate de seguridad del propio repo **daba verde** sobre eso.
La corrección es dura y no se negocia:

1. La salida y la caché van a `%LOCALAPPDATA%\ia-stack\`, **nunca** dentro del repo.
2. El generador **se niega a escribir** si la carpeta cae dentro del repositorio git.
3. Una prueba, vista en rojo primero, recorre lo versionado y falla si aparece un dato de sesión.

**Límites honestos que el tablero va a mostrar en pantalla:**
- **No dice cuánta plata gastaste** salvo que vos escribas una tabla de precios. Vacía por defecto.
  Sin ella muestra tokens y dice por qué no muestra dinero.
- **Las horas son una estimación**, no una medición. El reloj de pared incluye ratos en que no
  estabas. Se calcula con un umbral de inactividad y se muestra el umbral usado.
- La página es del último build. Lleva la fecha del build bien grande.

### 3.2 El «cerebro» propio, sin depender de herramientas externas

**El hallazgo que cambia todo:** ningún script del protocolo **lee** el contenido del grafo. Sólo le
calculan un hash o leen su índice. O sea que el proyecto no necesita un grafo — necesita saber qué
archivos cubre y cuáles no.

**Entonces la etapa 1 no es un grafo, es un índice.** Un archivo de ~10 KB con las 282 rutas
rastreadas y sus exclusiones, en vez de 375 KB de grafo. Eso rompe la dependencia con la herramienta
externa y con Obsidian.

**Después, encima de ese índice**, una vista HTML navegable. Y sólo si hace falta, las relaciones.
Publicado por etapas: primero lo que quita la dependencia, después lo lindo.

### 3.3 Memoria entre sesiones y bucle de auto-mejora

**Memoria.** Ya existe y funciona: `.vibe/` guarda estado, decisiones, lecciones y una traza sellada.
Lo que falta es explicarlo y ponerle un tope para que no crezca para siempre.

**Auto-mejora.** Un «sereno» que, **al arrancar**, mira si pasaron 7 días y si es así lee lo que se
hizo y propone **como mucho 4 mejoras**, cada una con la cita de dónde salió. No ejecuta nada: vos
aplicás, salteás o copiás. No hace falta ningún cron: el protocolo ya resuelve esto igual en la
fase 9, leyendo una fecha.

**Lo que el adversarial mató:** la idea de rotar `.vibe/AUDIT.md` cuando crezca. Viola un contrato
vivo del repo, y **dejaría el chequeo de historia en rojo permanente o desarmaría el ancla para
siempre**. Se reemplaza por un tope de largo de línea **hacia adelante**, sin mover un byte ya
sellado.

### 3.4 La documentación didáctica

**El problema real no es que el README sea largo.** Es que hace dos trabajos que se estorban:
enseñarle a alguien que llega, y ser la superficie donde 77 anclas mecánicas están clavadas.

**Entonces se separan.** El README queda corto y didáctico. La tabla de gates se muda a un documento
de referencia propio. Las anclas se mueven con la prosa, no se borran.

**Contenido del README nuevo:**
- Qué es esto y qué **no** promete, en cinco líneas.
- Un diagrama de las once fases en Mermaid — GitHub lo renderiza solo, sin subir imágenes.
- Una línea por fase, en castellano llano: qué hace y para qué sirve.
- Memoria entre sesiones y bucle de auto-mejora, explicados con un diagrama cada uno.
- Instalación en tres comandos.

**Primero se arregla el mapa de fases**, que hoy se contradice en tres lugares. Un diagrama lindo
sobre un vocabulario roto sólo hace más visible la contradicción.

### 3.5 El lanzamiento

**El adversarial mató el plan de lanzamiento entero,** y con razón: proponía publicar «26 de 1096
pruebas en rojo» como carta de presentación, con un número que ya había cambiado, en un lugar
—la descripción de GitHub— que **ningún gate del proyecto puede verificar**.

**Lo que queda:** no se lanza nada hasta que los tres defectos rojos de la sección 2.1 estén
cerrados. Recién ahí: descripción nueva, topics, homepage, y el primer minuto de lectura.

---

## 4. Orden de trabajo

El orden **no** es negociable, porque cada etapa evita rehacer la siguiente.

| # | Etapa | Por qué va acá |
|---|---|---|
| 1 | La suite deja de tocar `$HOME` | Es un daño activo a quien clone. Nada se muestra antes |
| 2 | Los 26 rojos de instalación restantes | La portada real del proyecto |
| 3 | Limpiar los datos del otro proyecto | Está publicado ahora mismo |
| 4 | Unificar el vocabulario de fases | El README nuevo se escribe sobre esto |
| 5 | README corto y didáctico + diagramas | Lo que pediste, ya sobre base firme |
| 6 | El índice propio, sin herramienta externa | Corta la dependencia no declarada |
| 7 | El tablero local | Lo más grande; se apoya en 4 y 6 |
| 8 | Memoria explicada + sereno de auto-mejora | Se apoya en el tablero |
| 9 | Lanzamiento | Último, y sólo con 1-3 cerrados |

---

## 5. Cómo se sabe que está bien

Cada uno es un comando, no una opinión.

1. Correr la suite **no modifica nada** fuera del repositorio. Prueba que compara el estado de
   `~/.claude/` antes y después.
2. Instalar en un proyecto limpio y correr la suite: **cero rojos**.
3. Un barrido por forma —no por lista de nombres— no encuentra rutas ni datos ajenos en lo versionado.
4. Los tres vocabularios de fases son **uno solo**, comprobado por una prueba.
5. El README baja de 446 líneas a menos de 150, **y los 77 anclajes siguen verdes**.
6. El protocolo corre entero **sin la herramienta externa instalada**.
7. El generador del tablero **se niega** a escribir dentro del repositorio, con su prueba en rojo primero.
8. El tablero no muestra un número que no midió: sin tabla de precios, no habla de dinero.

---

## 6. Lo que este spec NO promete

- **No promete llegar a trending.** Se pueden arreglar los defectos y escribir mejor; que la gente
  mire eso no depende del repositorio.
- **No promete horas exactas.** Ese dato no existe; se va a mostrar una estimación que dice que lo es.
- **No copia nada del motor de Benjamin Cordero.** Se estudiaron sus ideas —tablero local, sólo
  lectura, sugerir sin ejecutar— y se implementan de cero con Node nativo.
- **No sabemos el 100 % de sus funciones.** Se documentó lo verificable de un video de 26 minutos y
  su descripción. Su producto terminado se distribuye en una comunidad paga y no se compró.
