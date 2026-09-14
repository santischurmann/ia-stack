# Python de cómputo pesado y stacks de escritorio — consultado el 2026-09-14

**Método.** Documentación oficial, PyPI, crates.io y releases de GitHub, leídos ese día. Los claims
de un proveedor sobre su propio producto se marcan como tales. Lo que no se pudo verificar está en la
sección final.

---

# Eje C — Python

## uv

**0.12.13** (2026-09-10), sigue en 0.x. Política declarada: *"uv is widely used in production and is
stable software"*; el **minor** es donde viven los cambios que rompen. `uv.lock` es **API pública**;
la API de Rust y el formato de caché **no tienen garantía de estabilidad**.

**Qué no cubre, verificado:**

| Hueco | Evidencia |
|---|---|
| conda y dependencias no-Python | Las fuentes documentadas son índice, Git, URL, path y workspace. Cero menciones a conda, CUDA toolkit, MKL o compiladores |
| PyTorch con CUDA | *"Most wheels live on dedicated PyTorch indexes rather than PyPI"*; `--torch-backend=auto` existe sólo en la interfaz `uv pip`, no en la de proyecto |
| Pythons «oficiales» | Usa `python-build-standalone`: *"These distributions have some behavior quirks, generally as a consequence of portability"* |
| Compatibilidad con pip | No lee `pip.conf` ni variables `PIP_*`; índice *first-match*, no combina candidatos |
| PEP 751 | **Exportar** a `pylock.toml` sí; **instalar desde** él está en preview. El lockfile nativo sigue siendo `uv.lock` |

**Contraejemplo:** un stack que depende de binarios sólo disponibles en conda —GDAL/PROJ, MKL, un
toolkit CUDA administrado por conda— o un equipo que ya usa conda para dependencias no-Python. Ahí
uv no aporta y terminás con dos gestores.

## Qué versión de Python fijar

| Rama | Estado | Fin de soporte |
|---|---|---|
| **3.14.7** (2026-08-05) | **bugfix — la estable** | 2030-10 |
| 3.13 | bugfix | 2029-10 |
| 3.12 | sólo seguridad | 2028-10 |
| 3.15 | prerelease, final el 2026-10-01 | — |

**Fijar 3.14.** Es el único punto donde *todas* las librerías del eje tienen wheels: NumPy 2.5.3 y
SciPy 1.18.1 exigen `>=3.12`, y Numba 0.67 corta en `<3.15`. **No fijar 3.15** aunque salga en
octubre: Numba, pandas, PyArrow y DuckDB no la soportan.

**Contraejemplo:** una librería de nicho sin wheels cp314 obliga a compilar desde fuente, que en
Windows significa MSVC Build Tools. Ahí bajar a 3.13.

**Windows:** el instalador completo está **deprecado desde 3.14** y no se va a producir para 3.16+.
El camino oficial es el Python Install Manager (`py install 3.14`).

### Free-threading: todavía no, y no por CPython

*"PEP 779: Free-threaded Python is officially supported"* en 3.14, con una penalización single-thread
de **1% a 8%** según plataforma (pyperformance). El problema es el ecosistema: **DuckDB y Polars no
publican wheels free-threaded** — Polars por usar `abi3`, que no cubre builds `t`. NumPy, SciPy,
pandas, PyArrow, Numba y statsmodels sí los tienen. Y la documentación avisa que *"Some third-party
packages… will re-enable the GIL"*.

**Contraejemplo:** un pipeline puramente NumPy/SciPy/Numba con paralelismo por hilos y sin
DuckDB ni Polars. Ahí free-threading ya rinde hoy.

## Matriz de versiones

| Librería | Versión | Fecha | Python | cp314t | Restricción sobre NumPy |
|---|---|---|---|---|---|
| NumPy | 2.5.3 | 2026-09-06 | `>=3.12` | sí | — |
| SciPy | 1.18.1 | 2026-08-21 | `>=3.12` | sí | **`>=2.0.0,<2.8`** |
| pandas | 3.0.5 | 2026-07-22 | `>=3.11` | sí | `>=2.3.3` si Python ≥3.14 |
| PyArrow | 25.0.1 | 2026-08-10 | `>=3.10` | sí | opcional |
| Numba | 0.67.0 | 2026-08-11 | `>=3.10` | sí | **`>=1.22,<1.27` ∪ `>=2.0,<2.6`** |
| statsmodels | 0.15.0 | 2026-08-27 | `>=3.10` | sí | `>=1.23.5,<3` |
| DuckDB | 1.5.5 | 2026-07-22 | `>=3.10` | **no** | — |
| Polars | 1.44.2 | 2026-09-09 | `>=3.10` | **no** | extra |

**Incompatibilidades reales:**

1. **Numba contra NumPy: el techo existe pero hoy no bloquea.** Numba 0.67 acepta `numpy<2.6` y lo
   último es 2.5.3. Su bloqueo real hoy es **Python 3.15**, no NumPy.
2. **SciPy 1.18.1 exige `numpy>=2.0.0`**: NumPy 1.x quedó fuera del stack.
3. **pandas 3.0 ya salió** (3.0.0, 2026-01-21). Copy-on-Write **forzado**, `pytz` reemplazado por
   `zoneinfo`, `inplace=True` ahora devuelve `self`, dtype de string dedicado por default **pero
   PyArrow no es dependencia dura** (cae a `object` si no está).
4. **Polars 2.0.0rc1 salió el 2026-09-02** con cambios fuertes: motor de streaming por default en
   `collect()`, que **puede cambiar el orden de filas** en `unpivot` y `join`; se eliminan
   `profile()` y `melt()`; coerción numérica distinta. La guía advierte que algunos cambios *"may
   silently impact the results of your pipelines"*. **Para quant eso es una bomba: no adoptar 2.0
   sin pruebas de paridad numérica.**

## Criterio medible para escalar el cómputo

Primero se instrumenta, después se mueve. **py-spy** da `%GIL` en su vista `top` y separa frames
Python de nativos con `--native`; corre en Windows. **Scalene** *"separates out time spent in Python
from time in native code"* y tiene una columna `Copy (MB/s)` que hace visible el copiado accidental
al cruzar la frontera Python/librería.

| Paso | Señal que lo justifica | Número |
|---|---|---|
| Quedarse en NumPy | Más del 80% del tiempo ya está en código nativo, con `Copy (MB/s)` bajo | — |
| → Polars / DuckDB | Pico de memoria residente ≥ ~50% de la RAM, o directamente falta de memoria. O leer una tabla ancha usando pocas columnas: `read_parquet(columns=…)` usa **una décima parte** de la memoria | Dimensionado de DuckDB: 1–4 GB por hilo; agregación 1–2, **joins 3–4**; mínimo duro 125 MB |
| → Numba | El tiempo está en **frames Python**, en un loop numérico con dependencia secuencial que no se puede vectorizar | Oficial: *"one to two orders of magnitude"*. Compilación medida: **0,33 s** la primera llamada contra **6,68 µs** cacheada. **Si el job entero corre menos de 1 s, no amortiza** |
| | **Anti-señal dura:** si el hot path es pandas, la documentación oficial dice que Numba **empeora** — *"Pandas is not understood by Numba… would simply run this code via the interpreter but with the added cost of the Numba internal overheads"* | |
| → Multiproceso | Un solo core saturado con `%GIL` alto y trabajo limitado por CPU | **Granularidad ≥ ~0,5 s por tarea**: joblib ajusta el lote *"to keep the time on the order of half a second"* y advierte que con evaluaciones muy rápidas el despacho es más lento que hacerlo secuencial |
| | **Penalización de Windows, medible antes de decidir:** `spawn` es el **único** método disponible y *"rather slow compared to fork"* — cada worker reimporta el módulo. Medir con `python -X importtime` primero. Payloads de más de ~32 MiB pueden lanzar `ValueError` | |
| → Extensión nativa | `Copy (MB/s)` alto **y** mucho tiempo en frames Python que Numba no puede compilar: strings, diccionarios, objetos, parsing | Costo por cruce de frontera: llamada Cython **30 ns**, Python **62,5 ns**, C nativo **~3 ns**. **Nunca diseñar una API con una llamada por fila** |
| | **Anti-señal (Amdahl):** si el tiempo ya está mayoritariamente en código nativo, reescribir compra casi nada | |

## Qué cuesta Rust de verdad en un proyecto Python

| Dimensión | Evidencia |
|---|---|
| Distribución | `pydantic-core` 2.49.0 publica **~143 archivos wheel**, de ~2–2,5 MB cada uno, cubriendo cp310–cp315, builds free-threaded, PyPy, GraalPy, manylinux/musllinux y siete arquitecturas |
| Piso de plataforma | maturin exige **manylinux2014 como mínimo**, *"due to Rust compiler requirements"* |
| Churn del binding | La guía de migración de PyO3 tiene **16 secciones versión a versión**. El salto 0.20→0.21 fue la reescritura de la *Bound API*; 0.22→0.23 cambió todas las conversiones. **No elegís cuándo: cada Python nuevo te obliga a subir PyO3** |
| `abi3` reduce wheels pero cobra | Perdés text signatures, dict/weakref en clases, Buffer API, subclasear tipos nativos, y *"optimizations which rely on being compiled against a known exact Python version"*. **Consecuencia visible hoy: Polars usa abi3 y por eso no tiene wheels free-threaded** |
| Windows | Requiere Microsoft C++ Build Tools con *"Desktop development with C++"* |

**Tres casos donde no valió la pena, con evidencia:**

- **`cryptography` 3.4** (2021-02-07) sumó Rust como dependencia de build y rompió builds sin
  compilador. **Cinco arquitecturas sin soporte upstream de Rust**; Gentoo evaluó *"entirely drop
  support"*. Que fuera *"solely a build-time dependency"* no alcanzó.
- **Prisma removió su motor Rust** (2025-01-30): *"Each operating system and OpenSSL library version
  needs its own binary, complicating deployments"* y *"Contributing… requires a combination of Rust
  and TypeScript proficiency"*. Al sacarlo: bundle de **14 MB a 1,6 MB** y una consulta de 25k filas
  **3,4× más rápida**. El cruce de lenguajes costaba más de lo que el Rust ganaba.
- **SciPy**, el proyecto numérico más grande de Python, **no usa Rust**: su toolchain admite C17,
  C++17, Fortran, Cython y Pythran.

**Regla operativa:** Rust paga cuando el kernel se llama **pocas veces con mucho trabajo por
llamada** y el wheel se publica **para uno mismo, no para PyPI**.
**Contraejemplo:** una librería para terceros con soporte amplio de plataformas, o un kernel llamado
millones de veces con poco trabajo — ahí los 30 ns por llamada se comen todo.

---

# Eje D — Escritorio e híbrido

## Versiones

| | Versión | Fecha |
|---|---|---|
| Tauri | **2.11.5** (crate), CLI 2.11.4 | 2026-07-01 |
| **Tauri 3.0.0-alpha.0** | alpha | **2026-09-13** |
| Electron | **44.3.0** — Chromium 152, Node 24.20 | 2026-09-08 |
| PySide6 | **6.11.2** — Python `>=3.10,<3.15` | 2026-08-18 |
| Qt | 6.11.2 — **no es LTS** | — |

**Churn:** Electron soporta *"the latest three stable major versions"* con cadencia de **8 semanas**,
o sea que cada major vive **~6 meses** y son ~6 subidas por año. Tauri 2.x está estable desde 2024.
Qt da 5 años de LTS, pero *"immediate access to LTS releases is limited to commercial customers"*:
con PySide6 gratuito los parches LTS llegan **con 12 meses de retraso**.

**Licencias:** **PySide6 es LGPL y sí permite distribuir código cerrado.** PyQt6 es GPL v3 o
**USD 670 por desarrollador**, con renovación de ~60% anual, y encima *"You must obtain a separate
Qt license"*.

## Tamaño y memoria — el dato que rompe la narrativa

| Medición | Tauri | Electron | Quién |
|---|---|---|---|
| Claim del proveedor | *"as little as 600KB"* | — | **Tauri sobre sí mismo** |
| Bundle, macOS | 8,6 MiB | 244 MiB | Tercero, **una sola medición**, el autor dice *"take with a grain of salt"* |
| RAM, 6 ventanas, macOS | ~172 MB | ~409 MB | idem |
| Build en frío | 1:20.94 | 15,8 s (**5× más rápido**) | idem |
| **RAM, Windows 10, postman.com** | **399 MB** | **318 MB** | **Issue en el repo de Tauri** |
| **RAM, Windows 10, vscode.dev** | **370 MB** | **312 MB** | idem |

**En Windows, Tauri usa WebView2, que ES Chromium.** No estás evitando Chromium: lo estás
compartiendo con el sistema operativo. El ahorro grande de RAM es real en Linux y macOS, donde el
motor es WebKit, **no necesariamente en Windows 11**. La ventaja de **tamaño de instalador** sí es
real, con una salvedad: si querés renderizado determinista (`fixedVersion` de WebView2, ~180 MB),
Tauri deja de ser más chico que Electron.

PySide6 en Windows: los wheels suman **~245 MB comprimidos** (Essentials 76,9 + Addons 168,2). El
tamaño de una app mínima empaquetada y su RAM en reposo **no se verificaron**: el único dato
disponible es de PySide2 de 2021 y no es extrapolable.

## Firma de código en Windows — el dato más accionable

| Hecho | Fuente |
|---|---|
| **Desde junio de 2023 la clave privada va en HSM o token físico.** *"the CA/Browser Forum requires private keys for OV certificates to be stored on a hardware security module (HSM) or hardware token"*. **Aplica a OV y a EV** | Microsoft, act. 2026-08-29 |
| **EV ya no saltea SmartScreen.** Textual: *"EV certificates no longer bypass SmartScreen… Paying a premium for EV solely to avoid SmartScreen warnings is no longer justified."* La reputación se gana con *"several weeks and hundreds of clean installs"* | Microsoft, act. 2026-08-17 |
| **Windows 11:** *"Smart App Control will block execution of unsigned files unless the file has a positive reputation"* — a todos los ejecutables, no sólo los descargados | idem |
| Desde febrero de 2026 la validez máxima de un certificado bajó a **458–459 días** | Certum |

| Opción | Precio |
|---|---|
| Azure Artifact Signing Basic | USD 9,99/mes — **pero:** *"available to organizations in the USA, Canada, the European Union, and the United Kingdom. Individual developers are currently limited to the USA and Canada."* |
| Certum Open Source | EUR 25–69, sólo si el proyecto califica |
| Certum Standard OV | **EUR 139 / 169 / 209** |
| Sectigo OV / EV | USD 219 / 287 por año |
| Rango que declara Microsoft | OV USD 150–300/año · EV USD 400+/año |

**Consecuencia concreta para quien trabaje desde fuera de esas regiones: Azure Artifact Signing no
está disponible.** El piso real es un **OV en HSM: ~EUR 139–209 o USD 219 por año.**

**Discrepancia detectada:** la documentación de **Electron** sobre firma contradice a Microsoft en
dos puntos —que junio de 2023 exige EV, y que Azure Artifact Signing elimina SmartScreen—. Microsoft
dice explícitamente que **no**. Vale la fuente del sistema operativo, no la del framework.

## Auto-update

| | Tauri 2 | Electron | Python |
|---|---|---|---|
| Oficial | Plugin `updater` de primera parte | `autoUpdater` + electron-updater | **nada** |
| Firma del artefacto | **Obligatoria**: *"This cannot be disabled."* | Valida firma de código en Windows y macOS | — |
| Trampa | *"On Windows the application is automatically exited when the install step is executed due to a limitation of Windows installers"* | `update.electronjs.org` exige **repositorio público** | PyUpdater **archivado en 2022**; el sucesor de facto tiene un mantenedor |

## Acceso al sistema, y el caso de un terminal de trading local

| Capacidad | Tauri 2 | Electron | Python |
|---|---|---|---|
| Filesystem | Plugin `fs` **deny-by-default** con scope obligatorio | `fs` de Node completo, **sin modelo de permisos** | total |
| **Socket crudo o named pipe a un tercero** | **Ningún plugin oficial** de los 30 lo cubre. Desde JS: imposible. Desde Rust: sí | **Nativo**: *"The `node:net` module supports IPC with named pipes on Windows"* | `socket`, `pywin32` |
| Módulos nativos | — | *"Electron has a different ABI from a given Node.js binary"* → recompilar tras **cada** major, y son ~6 por año | — |

**El dato que decide ese caso:** el cliente oficial de MetaTrader 5 es **un paquete de Python,
sólo Windows** (5.0.6180, 2026-09-05, todos los wheels `win_amd64`, sin sdist), que hace
*"interprocessor communication directly from the MetaTrader 5 terminal"*.

**Ni Tauri ni Electron pueden usarlo directamente.** En los dos terminás lanzando un proceso
auxiliar de Python y hablándole por stdio o TCP — o sea que **ya tenés Python en el stack igual, más
una capa de plumbing que no existiría si la aplicación fuera Python**.

Y el navegador tampoco: Direct Sockets sigue siendo borrador de la WICG y en Chrome *"it is
restricted to Isolated Web Apps"*. Una página no abre un socket al terminal; **el servidor Python que
la sirve, sí**. Esa es toda la distinción.

## Cuánto Rust hace falta de verdad

El blog oficial dice *"No Rust Skills Needed! You don't need to write Code in Rust… in most cases"*.
Un reporte de migración de Electron a Tauri (2026-05-30) dice *"all code directly using `fs` or
`child_process` must be ported to Rust"*.

**No se contradicen: «no necesitás Rust» vale mientras un plugin oficial cubra lo que hacés. El
catálogo no tiene sockets.** Para una app que habla con un proceso local: abrir y mantener el socket,
sostener la conexión entre invocaciones, y hacer el stream de datos —porque los eventos **no
sirven**: *"The event system is not designed for low latency or high throughput situations"* y
*"listeners may process events out of order"*—. No es Rust: filesystem, sidecar, notificaciones,
store, HTTP, WebSocket, autostart, logging, SQL.

## La alternativa de web local

| Paquete | Versión | Fecha |
|---|---|---|
| pywebview | 6.2.1 | 2026-04-15 |
| NiceGUI | 3.16.0 | 2026-08-12 |
| Streamlit | 1.63.0 | 2026-09-01 |
| marimo | 0.24.2 | 2026-09-11 |
| pystray (bandeja) | 0.19.5 | **2023-09-17 — tres años sin release** |

En Windows, pywebview usa el backend `edgechromium`, que es **WebView2: el mismo motor que Tauri**.

`http://localhost` cuenta como **contexto seguro**: MDN lista `localhost`, `127.0.0.0/8` y `::1/128`
como *potentially trustworthy*, así que hay WebCrypto, service workers y portapapeles **sin TLS**.
La File System Access API anda en Chrome y Edge, **Firefox la documenta como dañina y Safari no la
tiene** (~31% global). Bandeja, instancia única y notificaciones del sistema requieren librería
extra, y la de bandeja lleva tres años sin release.

Prueba de existencia: Jupyter y Open WebUI.

---

# Recomendaciones, cada una con su contraejemplo

| Recomendación | Dónde sería el error |
|---|---|
| **uv como gestor por default** | Stack con binarios sólo en conda. Terminás con dos gestores |
| **Fijar Python 3.14**, no 3.15 | Una librería de nicho sin wheels cp314 → compilar en Windows. Ahí 3.13 |
| **Free-threading: todavía no** | Pipeline puro NumPy/SciPy/Numba sin DuckDB ni Polars: ahí ya rinde |
| **Polars/DuckDB cuando el pico de memoria ≥ ~50% de la RAM** | Datasets de menos de 1 GB con mucho statsmodels encima: pandas es más simple y vas a volver a él igual |
| **Numba cuando el loop secuencial domina** y el job corre bastante más de 1 s | Hot path en pandas: la documentación oficial dice que **empeora** |
| **Rust sólo para kernels de pocas llamadas y mucho trabajo**, compilando para tu propio target | Publicar para terceros (~143 wheels, churn de PyO3), o un kernel de millones de llamadas chicas |
| **Para una app de escritorio que habla con un terminal local en Windows: Python con web local y ventana nativa.** Cero Rust, cero plumbing, el cliente del terminal corre en el mismo proceso que sirve la interfaz | Si hay que distribuirla como instalador firmado con auto-update y bandeja: **Python es el peor de los tres en distribución** — sin updater oficial, ~245 MB de Qt, firma con huecos. Ahí gana Electron, o Tauri con un proceso auxiliar de Python |
| **No pagar EV.** OV en HSM alcanza | Si el comprador es una empresa cuyo proceso de compras lo exige |
| **Tauri 2.11.5 si el peso del instalador manda** | Si necesitás `fixedVersion` de WebView2 (+180 MB), si medís RAM en Windows —donde puede consumir **más** que Electron—, o si te cae encima la migración a Tauri 3 |

---

# Lo que NO se pudo verificar

- RAM en reposo y tamaño de app mínima empaquetada de **PySide6**: el único dato medido es de
  PySide2 de 2021.
- Las cifras de Windows del benchmark **oficial** de Tauri: la página son gráficos que no renderizan
  al descargarla.
- Timeline de **Tauri 3** a estable, y política de soporte de la 2.x.
- Precios comerciales de **Qt**: no publica cifras.
- Tiempos de build **incrementales** de Tauri contra Electron. Sólo hay el de build en frío.
- Named pipes de Windows desde Rust, y FFI a DLL desde Tauri.
- Instancia única y notificaciones del sistema en el stack Python.
- Falsos positivos de antivirus con PyInstaller: hay muchos reportes de terceros, **pero no figura en
  la documentación oficial**.
- Elegibilidad exacta de SignPath Foundation, que firma gratis para open source y que Microsoft cita.
- Conteo exacto de wheels de pydantic-core: se contaron **143** hoy, un resumen secundario decía 119.
  Vale el orden de magnitud, no el número.
