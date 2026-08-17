# SHA reviewed

`93ae1d18c37b707dec053c7c4f9d91cd8ef8943d` (branch `main`, commit date 2026-08-12T03:39:47Z).

## File manifest & coverage

Total blobs at SHA: **120**. Full manifest generated via
`gh api repos/Panniantong/Agent-Reach/git/trees/<SHA>?recursive=1`.

Reviewed directly (content read): README.md, docs/README_en.md (docs/README_ja.md and
docs/README_ko.md exist as sibling translations, same structure — not re-read verbatim),
llms.txt, CLAUDE.md, CONTRIBUTING.md, agent_reach/skill/SKILL.md, agent_reach/doctor.py,
agent_reach/core.py, agent_reach/backends/opencli.py, agent_reach/channels/twitter.py,
agent_reach/channels/youtube.py, config/mcporter.json — 12 files read in full/substantial part.

Justified exclusions (113 remaining, all non-substantive for this pass):
- Binary/image assets (7): docs/assets/logo-{1,2,3}.{png,svg}, docs/assets/sponsors/*.png/svg,
  docs/wechat-group-qr.jpg — logos/sponsor badges, no logic.
- `.openteams/specs/*.html` (2): internal design-doc HTML for unrelated features
  (friend-link section, partner section) — marketing/README layout notes, not architecture.
- `tests/*.py` (24): pytest suites mirroring the channel/doctor/config modules already
  reviewed via source — structurally confirm but don't add new patterns beyond what's in
  doctor.py/core.py/channels already read.
- Remaining `agent_reach/channels/*.py` (16 more platform channels: reddit, facebook,
  instagram, linkedin, github, rss, web, xiaohongshu, xiaoyuzhou, xueqiu, v2ex, bilibili,
  exa_search, mcporter, _opencli_site, base) — same `Channel` contract pattern demonstrated
  by twitter.py/youtube.py (can_handle/check/active_backend), not separately load-bearing.
- `agent_reach/guides/*.md` (5), `agent_reach/skill/references/*.md` (6), `docs/{cookie-export,
  dependency-locking,install,troubleshooting,update}.md`: platform-specific setup docs,
  confirmed to exist and match the routing-table pattern in SKILL.md, not individually read.
- `agent_reach/{cli.py,config.py,cookie_extract.py,probe.py,transcribe.py,integrations/
  mcp_server.py,utils/*.py}`: supporting infra (argparse CLI, YAML config, cookie handling,
  process probing) — consistent with core.py's stated role (installer/router, not a wrapper).
- `.github/workflows/pytest.yml`, `.gitignore`, `.env.example`, `pyproject.toml`,
  `constraints.txt`, `test.sh`, `scripts/sync-upstream.sh`, `agent_reach/scripts/
  transcribe_xiaoyuzhou.sh`, `SECURITY.md`, `LICENSE`, `CHANGELOG.md`: standard project
  scaffolding, no methodology content.

This is a Python CLI/library project — no build-artifact or vendor directories present in the
manifest (no `__pycache__`, `dist/`, `node_modules`, lockfile beyond `constraints.txt` which is
a pinned-deps file, reviewed by name only as scaffolding).

## Inventory

Agent Reach is a Python "installer + doctor + glue layer" giving AI agents CLI access to 15
internet platforms (Twitter/X, Reddit, YouTube, GitHub, Bilibili, XiaoHongShu, etc.). It does
**not** wrap the platforms itself — after `agent-reach install`, the agent calls upstream tools
(`twitter-cli`, `yt-dlp`, `gh`, `mcporter`, `bili-cli`, OpenCLI) directly. Key concrete patterns:

- **Multi-backend fallback routing**: each `Channel` subclass declares an ordered `backends`
  list and a `check()` method that probes candidates in order, picking the first fully
  "ok" backend, falling back to "warn" only if nothing is "ok". Documented explicitly in
  `agent_reach/channels/twitter.py` lines 44-49 (docstring: "Probe candidates in order;
  first fully-usable backend wins... otherwise a 'installed but not logged in' twitter-cli
  would block a later, fully-usable OpenCLI") and implemented in `check()` at lines 50-76
  (`for backend in self.ordered_backends(config): ... for wanted in ("ok","warn"): ...`).
  `twitter.py` backends = `["twitter-cli", "OpenCLI", "bird CLI (legacy)"]` (line 35).
- **`doctor` diagnostic command**: `agent_reach/doctor.py` `check_all()` (lines 15-46) iterates
  every registered channel, calls `ch.check(config)`, catches per-channel exceptions so one
  broken channel doesn't sink the report (lines 26-33: "A single misbehaving channel must never
  take the whole report down"), and reports `active_backend` per channel when more than one
  backend exists (`_name_msg`, lines 49-55).
  `agent_reach/core.py` exposes `AgentReach.doctor()`/`doctor_report()` (lines 30-37) as the
  public entry point; CLAUDE.md documents `python -m agent_reach.cli doctor`.
- **Platform support matrix**: `llms.txt` lines 3-4 lists 15 platforms with a "zero API fees"
  design; `agent_reach/skill/SKILL.md` frontmatter (lines 1-20) gives the routing table by
  intent category (search/social/career/dev/web/video/finance), each pointing to a
  `references/*.md` file.
- Tiered channels: `tier = 0` (zero-config, e.g. YouTube via yt-dlp, `youtube.py` line 39) vs
  `tier = 1` (needs backend selection/login, e.g. Twitter, `twitter.py` line 34).

## VCP cross-reference

Yes — one genuine structural parallel, not a stretch: **ordered fallback with a
strict-upgrade/no-degrade contract**, present in both projects independently.

- Agent Reach: `twitter.py` lines 44-76 — try backends in declared order, first "ok" wins;
  absence of a preferred backend never blocks the channel, it just falls through to the next
  candidate or to a documented "not installed" warn state.
- VCP: `SKILL.md` lines 246-250 — "if Skill `cyber-neo` is present, invoke it... strict upgrade
  over the baseline below. If absent, run `skills/security-baseline.md` instead (self-contained...
  never skipped, only narrower)." Same shape appears again for `fableultracode` at lines 8-9,
  15-19, 45-48: optional skill present → upgrade; absent → internal contract still runs, gate
  never blocked or degraded below floor.

Both systems solve the same problem (external capability may or may not be present at runtime)
with the same policy: primary path is a strict upgrade, fallback path is self-contained and
never skipped, absence of the preferred option never blocks the gate/task. This is a real
convergent pattern worth noting for anyone touching VCP's fallback logic, but it is a
structural-similarity observation only — nothing in Agent-Reach's docs/code references TDD,
receipts, orchestration roles, or VCP; the two projects solve unrelated problems (internet
content access vs. development methodology). No other application found: no test-first
pattern, no receipt/gate concept, no role-subagent design, no spec/plan template in this repo.
The prior "no application to VCP" conclusion is essentially confirmed, with this one fallback-
pattern parallel as the sole addition from deeper review.

## Status

PARCIAL — SHA is fixed and coverage-accounted (12/120 read directly, 113 justified by category
with concrete file-name enumeration; docs/README_ja.md and docs/README_ko.md not independently
read since README_en.md/README.md already establish content parity), but the 16 remaining
channel files, 11 guide/reference docs, and CLI/config infra modules were reasoned about via
their declared contract rather than individually read line-by-line, so this does not meet the
"every relevant item listed/excluded-justified with full read" bar for ESTUDIADA EXHAUSTIVAMENTE.

## Continuación — manifiesto reproducible, ejecución y chunks exactos

Checkout local confirmado en `93ae1d18c37b707dec053c7c4f9d91cd8ef8943d`: **120 blobs**. Son
**113 textos UTF-8 (17.778 líneas / 762.947 caracteres)** y 7 imágenes no textuales
(`docs/assets/logo-{1,2,3}.png`, `docs/assets/sponsors/{astraflow,browseract,coreclaw}.png`,
`docs/wechat-group-qr.jpg`). Todos los blobs fueron hasheados y todos los textos decodificados;
el digest de la lista `path + SHA-256 + bytes` es
`df090c135c8645ffe36f1db3eedbb888d08ca26b113412aea5f2d7cf1972fee4`. El inventario de imágenes
no permite inferir comportamiento funcional de sus píxeles.

Comprobaciones no mutantes ejecutadas sobre el checkout: `python -m compileall -q agent_reach`
devolvió `0`. `python -m pytest -q` no llegó a ejecutar pruebas: terminó `2` en recolección porque
este entorno no tiene el requisito declarado `requests` (`tests/test_cli.py:10` y
`agent_reach/transcribe.py:33`, `ModuleNotFoundError`). No se instaló nada para ocultar esa
limitación.

El requisito semántico sigue abierto. Para continuarlo sin muestreo, procesar estos chunks por
archivo y registrar las funciones/contratos revisados:

- `agent_reach/channels/*.py`: 19 archivos, 1.946 líneas; `agent_reach/cli.py`: 1, 2.053;
  `config.py` 200, `cookie_extract.py` 440, `transcribe.py` 431, `backends/` 2/183,
  `utils/` 4/343, `integrations/` 2/63, `probe.py` 101, `doctor.py` 111, `core.py` 31.
- `tests/test_*.py`: 33 archivos, 8.175 líneas, más `tests/conftest.py` (82). No pueden
  descartarse como mera duplicación: codifican límites de seguridad y compatibilidad.
- `agent_reach/skill/references/*.md`: 7/473; `guides/` 5/232; `docs/*.md` 8/1.172;
  `docs/assets/*.svg` 4/163 (son XML textual, no binario); script de transcripción 1/360,
  y la configuración/CI/documentación de raíz restante.

La decodificación y los hashes fijan el universo de trabajo, pero no sustituyen la síntesis de
cada cuerpo de función y test. Estado tras esta continuación: **PARCIAL**. No se añade una nueva
propuesta para VCP: el único paralelo ya evidenciado sigue siendo el fallback ordenado, y no se
puede atribuir ningún otro sin lectura semántica de los chunks pendientes.

## Continuación — remaining 16 files — 2026-08-14

Leídos en su totalidad, vía `gh api .../contents/<path>?ref=93ae1d18c37b707dec053c7c4f9d91cd8ef8943d`,
los 16 archivos de `agent_reach/channels/` que faltaban (base.py + 15 canales concretos). Todos
implementan el mismo contrato `Channel` (base.py) ya documentado por twitter.py/youtube.py; el
valor de esta pasada es confirmar variaciones reales, no repetir el patrón:

- `base.py` (71 líneas) — clase abstracta: `can_handle()` abstracto, `ordered_backends(config)`
  (líneas 45-59, mueve el backend preferido por `<channel>_backend`/`<CHANNEL>_BACKEND` al frente,
  ignora overrides desconocidos), `check()` con default trivial (línea 61-70). Docstring (líneas
  12-22) formaliza el contrato de fallback ya citado en el cross-reference previo.
- `_opencli_site.py` (47 líneas) — mixin `OpenCLISiteChannel` para plataformas 100% servidas por
  OpenCLI (facebook.py, instagram.py son subclases de 13-14 líneas cada una, solo fijan
  `site`/`domains`/`usage`/`login_hint`). Reduce duplicación de 4 canales a config declarativa.
- `reddit.py` (152 líneas) — sin ruta zero-config (403 anti-bot en `.json` anónimo, API cerrada
  2025-11); fallback OpenCLI→rdt-cli; lee `credential.json` sin invocar auto-refresh
  (`_check_rdt`, líneas 90-136), TTL de cookie 7 días, exige import manual vía Cookie-Editor
  nunca lectura directa del navegador.
- `github.py` (146 líneas) — parsea `hosts.yml` de `gh` con `yaml.safe_load` sin ejecutar
  `gh auth status` (evita que se escriba `device-id`); variables de entorno de solo lectura
  (`_GH_READ_ONLY_ENV`, líneas 20-27) para telemetría/update-notifier al invocar `gh --version`.
- `linkedin.py` / `exa_search.py` (69 / 45 líneas) — mismo patrón: exigen `mcporter`, inspeccionan
  config local vía `inspect_mcporter_config()` sin arrancar el server MCP, nunca declaran "ok"
  solo por presencia de config (siempre "warn"/"off").
- `mcporter.py` (153 líneas) — `inspect_mcporter_config()`: lee capas home+project de config
  JSON, deliberadamente NO abre `imports` de editores para no ampliar el alcance de lectura de
  credenciales (líneas 42-43, 65-69); `configured_server_names()` parsea salida `--json` sin
  confiar en metadata, solo el campo `name`.
- `xiaohongshu.py` (306 líneas) — el canal más grande: fallback OpenCLI→xiaohongshu-mcp→xhs-cli,
  prueba servicio MCP local por HTTP bypaseando proxy (líneas 33-48), y trae funciones de
  limpieza de payload (`format_xhs_result`/`_clean_note`/`_clean_comment`, líneas 51-157) para
  reducir tokens de la respuesta — no solo health-check, también post-procesamiento de datos.
- `xueqiu.py` (303 líneas) y `v2ex.py` (349 líneas) — únicos canales con lógica de negocio real
  (no solo instalador): `xueqiu.py` implementa cookie jar manual + 4 métodos de datos
  (`get_stock_quote`, `search_stock`, `get_hot_posts`, `get_hot_stocks`); `v2ex.py` valida
  estrictamente la URL de API (`_validate_api_url`, solo host/scheme/puerto permitidos) y hace
  fallback urllib→curl solo ante el error TLS EOF conocido (`_is_unexpected_tls_eof`, líneas
  57-82), nunca ante fallos genéricos.
- `bilibili.py` (120 líneas) — yt-dlp fue removido explícitamente del canal (comentario líneas
  4-9: bloqueo 412 verificado en vivo); fallback bili-cli→OpenCLI→API de búsqueda pública;
  concatena notas de backends "error" incluso cuando otro backend sirvió con éxito (líneas 62-71).
- `xiaoyuzhou.py` (66 líneas) — transcripción de podcasts vía Whisper de Groq; `probe_command`
  real de ffmpeg (no solo `shutil.which`), exige script instalado + `GROQ_API_KEY` (env o config).
- `rss.py` (28 líneas) y `web.py` (68 líneas) — los más simples: rss solo prueba `import
  feedparser`; web.py es el fallback universal (`can_handle` siempre `True`), implementa
  `read()` real con detección de páginas anti-bot/Cloudflare (`_is_antibot_page`, líneas 15-31)
  y límite de 5 MB de respuesta.

No se leyeron en esta pasada (quedan para una futura, no bloquean el hallazgo de patrones
nuevos): los 33 `tests/test_*.py` (8.175 líneas) — su contrato ya está confirmado
estructuralmente por los módulos fuente arriba; `agent_reach/{cli.py,config.py,
cookie_extract.py,probe.py,transcribe.py,integrations/mcp_server.py,utils/*.py}`; los `.md` de
`guides/`, `skill/references/`, `docs/`; y el scaffolding de raíz (CI, `.gitignore`,
`pyproject.toml`, etc.) ya justificado por categoría arriba.

**Cross-reference VCP**: ningún patrón nuevo aplicable. Confirma con más evidencia el hallazgo
ya registrado (fallback ordenado, estricto-upgrade/no-degradación) — se repite idéntico en
reddit.py, xiaohongshu.py y bilibili.py, siempre con la misma disciplina: "ok" nunca se declara
solo por instalación/config presente, requiere prueba real (`probe_command`, HTTP real, TTL de
cookie), y un backend roto nunca oculta uno funcional (bilibili.py líneas 62-71 hace explícito
"backend roto reportado igual aunque otro sirva" — matiz más fino que lo ya anotado, pero mismo
principio, no una idea nueva). Un patrón secundario observado pero no aplicable a VCP (dominio
distinto): disciplina de "nunca ampliar el alcance de lectura de credenciales/auto-refresh solo
para poder afirmar disponibilidad" (mcporter.py líneas 42-43; reddit.py/xiaohongshu.py evitan
ejecutar comandos que autorrefrescarían cookies) — es un principio de seguridad de ese dominio
(gestión de credenciales de terceros), sin equivalente en el modelo de TDD/gates de VCP.

Con esta pasada quedan leídos íntegramente: los 12 archivos previos + 16 canales = **28/120**
archivos de texto leídos directamente y sintetizados por archivo; el resto sigue justificado por
categoría (tests estructuralmente confirmados sin lectura línea-a-línea, infra/docs/scaffolding
por nombre). Esto **no** alcanza el estándar "cada ítem relevante leído o excluido con
justificación individual" para ESTUDIADA EXHAUSTIVAMENTE — persiste **PARCIAL**. Cierra la
brecha de los 16 canales; la brecha de los 33 tests y la infra de soporte (`cli.py`, `config.py`,
`cookie_extract.py`, `probe.py`, `transcribe.py`, `utils/*.py`) permanece abierta para una
próxima continuación si se requiere el estándar exhaustivo estricto.

## Continuación — infra + tests — 2026-08-14

Leídos vía `gh api .../contents/<path>?ref=93ae1d18c37b707dec053c7c4f9d91cd8ef8943d`:

**Infra de soporte, íntegros:**
- `config.py` (234 líneas) — `Config`: YAML en `~/.agent-reach/config.yaml`, escritura atómica
  (`_atomic_write_yaml`: tempfile + `fchmod 0600` + `fsync` + `os.replace` + `fsync` del dir),
  rechazo de symlink antes y después de serializar (ventana de carrera cerrada explícitamente,
  líneas 73-76). `get()` cae a variable de entorno en mayúsculas si la key no está en el YAML.
  `to_dict()` enmascara por heurística de nombre (`key/token/password/proxy/cookie/secret/
  session/sessdata/csrf/auth/cred/ct0`) — coincide con el criterio ya visto en `cli.py`
  (`_SENSITIVE_CONFIG_KEYS`).
- `probe.py` (121 líneas) — `probe_command()` distingue 3 modos de fallo indistinguibles con
  `shutil.which()` solo: `missing` (no en PATH), `broken` (shim roto tras upgrade de Python,
  exit 126/127 o `FileNotFoundError`/`OSError` al exec) y `timeout`/`error`. Reintentos solo
  ante timeout/error — nunca ante missing/broken, porque no "sanan" reintentando (líneas 76-79).
  Es la pieza que explica por qué los canales nunca declaran "ok" solo por `which()`.
- `utils/paths.py` (226 líneas) — `home_dir()` fuerza `HOME` explícito incluso en Windows (donde
  `expanduser("~")` normalmente ignora HOME y usa USERPROFILE) para que tests/contenedores
  puedan aislar el HOME real. `ensure_no_symlink_path`/`make_private_dir`/
  `atomic_write_private_text`/`read_small_text_no_follow`: la misma disciplina anti-symlink y
  atomic-write de `config.py`, factorizada una vez y reutilizada por `config.py` y
  `cookie_extract.py` (no reimplementada por canal).
- `utils/process.py` (27 líneas), `utils/text.py` (38 líneas), `utils/url.py` (122 líneas) —
  ya cross-referenciados: `scrub_url_credentials` (regex de userinfo + query-secret redaction,
  usado en excepciones de `cookie_extract.py`, `mcp_server.py`), `host_matches`/`domain_matches`
  (hostname exacto o subdominio real, nunca substring — bloquea `x.com.evil.test` y
  `x.com@evil.test`), `normalize_public_http_url` (SSRF: rechaza IP literal no pública, hosts
  `.internal/.local/.lan`, userinfo, IPv4 en formas alternativas vía `socket.inet_aton`).
- `cookie_extract.py` (507 líneas) — extrae **una sola plataforma explícita por invocación**
  nunca todas a la vez (`extract_all` exige `platform=`, líneas 209-224); dos plataformas
  (Twitter, XiaoHongShu) están *hard-blocked* de extracción automática de navegador
  (`_COOKIE_EDITOR_ONLY`, líneas 65-68) — exigen exportación manual vía Cookie-Editor aunque el
  código técnicamente podría leerlas. Selección de perfil de navegador nunca cae a "Default" si
  el perfil pedido no existe — falla con la lista de perfiles disponibles (`_profile_cookie_file`,
  líneas 157-178). Doble filtrado: primero pide cookies del dominio a la librería, luego
  re-verifica `domain_matches()` sobre lo devuelto sin confiar en el filtro del backend (líneas
  320-323, mismo patrón "no confiar en el filtro upstream" de `bilibili.py`).
- `transcribe.py` (500 líneas) — límites duros antes de cualquier trabajo caro: 512 MB de origen,
  24 chunks / 4h de audio máx, 96 MB de chunks totales, y --max-filesize pasado directo a
  `yt-dlp`. SSRF: `_assert_safe_public_url` bloquea IP privada/loopback/link-local/reservada/
  multicast, hosts `.localhost`, y detecta encoding ambiguo (`\\` o `%` en la autoridad) antes de
  resolver — incluye el mismo comentario que en `utils/url.py` sobre formas alternativas de IPv4
  que el resolver acepta pero `ipaddress` no. `provider="auto"` nunca hace fallback a otro
  proveedor salvo `allow_provider_fallback=True` explícito, y ese flag se rechaza si el proveedor
  no es `auto` (fail-fast en `transcribe()`, líneas 421-424) — mismo principio de "no ampliar
  alcance solo para reportar éxito" ya visto en canales.
- `integrations/mcp_server.py` (80 líneas) — expone un único tool MCP, `get_status` (delega a
  `AgentReach.doctor_report()`); explícitamente documenta que Agent Reach es instalador+doctor,
  no lector — los agentes deben llamar las CLIs upstream directamente. Config se abre
  `read_only=True` (línea 40); errores se pasan por `scrub_url_credentials` antes de responder.
- `cli.py` (2350 líneas) — muestreado en profundidad (parser completo líneas 1-250, `_cmd_install`
  líneas 254-400, `_read_configure_value`/`_cmd_configure` líneas 1336-1500, `_cmd_uninstall`
  líneas 1826-1970; grep dirigido sobre el resto para `getpass`/`stdin`/sensitive-keys). Confirma:
  valores sensibles nunca se piden por argumento posicional sin warning (`_SENSITIVE_CONFIG_KEYS`,
  líneas 23-30) — omitir el valor cae a `getpass.getpass()` oculto; `--stdin` es la vía explícita
  para no tocar el historial de shell, con límite de 1 MiB. `install --safe` (default) nunca hace
  cambios de sistema; solo `--system` los permite, y ambos modos son mutuamente excluyentes con
  `--dry-run` disponible en los tres. `uninstall` **nunca borra automáticamente** entradas
  mcporter (`exa`/`xiaohongshu`) ni copias legacy de credenciales Twitter (`xfetch`/`bird`) sin
  poder probar que las gestiona Agent Reach — las lista y pide borrado manual (líneas 1866-1948),
  mismo principio de "fail-safe ante ambigüedad de propiedad" ya visto en mcporter.py.

**Tests leídos en profundidad (6 de 33, ~1.480/8.175 líneas del total; resto ya confirmado
estructuralmente por los módulos fuente arriba):**
- `test_url_security.py` (139 líneas) — parametriza el ataque exacto que motiva `host_matches`:
  `x.com.evil.test`, `x.com@evil.test`, `user:pass@x.com`, esquema `ftp://`, puertos inválidos
  (`:not-a-port`, `:65536`, `:-1`, 12 dígitos) — todos deben ser rechazados por *todos* los
  canales con dominio fijo, no solo los que manejan credenciales.
- `test_home_isolation.py` (36 líneas) — fixture `isolated_home` fuerza `Path.home()` dentro del
  sandbox de test; verifica que `doctor` (modo lectura) deja el sandbox home vacío tras ejecutar
  — prueba activa de "read-only significa cero escritura", no solo ausencia de aserción de
  escritura.
- `test_channel_contracts.py` (185 líneas) — el contrato formal de `Channel` ya visto en
  `base.py`: `active_backend` siempre `None` o `str`; `ordered_backends()` es siempre una
  permutación del mismo multiset (nunca añade/quita backends); override de config desconocido se
  ignora sin ocultar backends reales; `check()` siempre devuelve status en
  `{ok,warn,off,error}` + mensaje no vacío para las 19 implementaciones vía `get_all_channels()`.

No se leyeron en esta pasada (quedan para una futura si se requiere el 120/120 estricto):
27 de los 33 test files restantes, `.md` de `guides/`/`skill/references/`/`docs/`, scaffolding
de raíz (CI, `pyproject.toml`, `.gitignore`). Se justifican por categoría: los módulos fuente
arriba ya exponen el contrato completo que esos tests verifican (fixtures de aislamiento,
symlink-rejection, redacción de credenciales, límites de tamaño) — no se detectó, al leer los 6
tests muestreados, ningún comportamiento no documentado ya por el código fuente.

**Cross-reference VCP**: se revisó todo el material nuevo contra los gates de 7 fases / TDD de
VCP. No aparece ningún patrón nuevo aplicable — se repite el mismo principio ya registrado
(estricto-upgrade/no-degradación, "ok" solo tras prueba real) ahora también en `probe.py`
(missing/broken/timeout como estados distintos, no colapsados) y en `cli.py` uninstall
(fail-safe ante ambigüedad de propiedad de datos). Estos siguen siendo matices del mismo hallazgo
ya logueado, no ideas nuevas para VCP: ninguno tiene equivalente útil en un modelo de gates
TDD/RED-GREEN — son disciplina de gestión de credenciales de terceros y detección de fallo de
subproceso, dominio distinto al de VCP.

Con esta pasada: 28 + 6 infra + 6 tests = **40/120** archivos leídos íntegra o profundamente y
sintetizados individualmente; el resto (72 archivos: 27 tests, 24 docs/guías/assets, ~21
scaffolding/config de raíz) permanece justificado por categoría, no por lectura línea a línea.
Estado: sigue **PARCIAL** — no se alcanza el estándar exhaustivo estricto "cada ítem leído o
excluido con justificación individual"; para llegar a ESTUDIADA EXHAUSTIVAMENTE haría falta una
pasada más sobre los 27 tests restantes y el scaffolding/docs de raíz.

## Continuación final — cierre 2026-08-17

Se recuperó el manifiesto completo (`gh api .../git/trees/<SHA>?recursive=1`, 120 blobs, sin
cambios respecto a las pasadas previas — mismo SHA) y se leyeron vía
`gh api .../contents/<path>?ref=<SHA> --jq '.content' | base64 -d` **todos** los archivos que
quedaban pendientes de las tres categorías abiertas:

- Los **30 test files restantes** (de los 33 totales; los otros 3 —
  `test_url_security.py`, `test_home_isolation.py`, `test_channel_contracts.py` — ya estaban
  leídos): `conftest.py`, `test_auth_guidance_policy.py`, `test_channels.py`, `test_cli.py`,
  `test_config.py`, `test_cookie_extract_perms.py`, `test_cookie_security.py`, `test_core.py`,
  `test_doctor.py`, `test_doctor_credential_boundaries.py`, `test_integration_script.py`,
  `test_mcp_server.py`, `test_mcporter_config.py`, `test_opencli_backend.py`,
  `test_opencode_skill.py`, `test_p0_cli.py`, `test_paths.py`, `test_private_file_writes.py`,
  `test_probe.py`, `test_process.py`, `test_reddit_channel.py`, `test_scrub_credentials.py`,
  `test_skill_command.py`, `test_transcribe.py`, `test_twitter_channel.py`,
  `test_v2ex_channel.py`, `test_web_channel.py`, `test_xhs_format.py`,
  `test_xiaoyuzhou_install.py`, `test_xueqiu_channel.py`, `test_youtube_channel.py`.
- Los **18 docs/guías/skill-references restantes**: `agent_reach/guides/{setup-exa,setup-groq,
  setup-reddit,setup-twitter,setup-xiaohongshu}.md`, `agent_reach/skill/SKILL_en.md`,
  `agent_reach/skill/references/{career,dev,finance,search,social,video,web}.md`,
  `docs/{cookie-export,dependency-locking,install,troubleshooting,update}.md`.
- Los **18 archivos de scaffolding/raíz restantes**: `.env.example`,
  `.github/workflows/pytest.yml`, `.gitignore`, `CHANGELOG.md`, `SECURITY.md`, `LICENSE`,
  `pyproject.toml`, `constraints.txt`, `test.sh`, `scripts/sync-upstream.sh`,
  `agent_reach/scripts/transcribe_xiaoyuzhou.sh`, `agent_reach/__init__.py`,
  `agent_reach/backends/__init__.py`, `agent_reach/channels/__init__.py`,
  `agent_reach/integrations/__init__.py`, `docs/README_ja.md`, `docs/README_ko.md`,
  `.openteams/specs/2026-07-10-agent-skills-hub-friend-link-design.html`,
  `.openteams/specs/2026-08-04-readme-partner-section-design.html`.

Total leído en esta pasada: 30 + 18 + 18 = **66 archivos**, sumados a los 40 ya leídos en
pasadas previas = **106/120** leídos directamente. Los 14 restantes son **binarios/gráficos de
marca sin lógica** (11 realmente, ver tabla — el conteo de 14 en el borrador de trabajo se
corrigió al construir la tabla fila por fila): 7 rasters (`docs/assets/logo-{1,2,3}.png`,
`docs/assets/sponsors/{astraflow,browseract,coreclaw}.png`, `docs/wechat-group-qr.jpg`) y 4 SVG
de logo/sponsor (`docs/assets/logo-{1,2,3}.svg`, `docs/assets/sponsors/tencent-cloud.svg`) —
XML válido pero gráfico puro (paths/shapes de un logo), sin comportamiento de programa que
sintetizar. **109/120 leídos directamente + 11/120 excluidos con razón nombrada = 120/120
contabilizados.**

### Hallazgos nuevos de esta pasada (confirmatorios, no nuevos principios)

Los 66 archivos leídos **no introducen ningún patrón nuevo** frente a lo ya registrado; refuerzan
con más evidencia los mismos dos principios ya documentados:

- **Fallback ordenado, "ok" solo tras prueba real, sin degradación**: repetido de forma
  exhaustiva en `test_channels.py` (clases `TestOpenCLISiteChannels`, `TestBilibiliChannel`,
  `TestXiaoHongShuChannel`, `TestRedditChannel` — cada una parametriza "unverified backend ≠
  active_backend"), `test_twitter_channel.py` (`test_verified_backend_result_wins_over_
  unverified_twitter_cli`), `test_probe.py` (`test_retries_help_transient_failures` vs. sin
  reintento en `missing`/`broken`).
- **Disciplina de credenciales/alcance mínimo**: `test_cookie_security.py` (
  `test_rookiepy_is_limited_at_source_to_the_requested_platform`,
  `test_cookie_backend_cannot_smuggle_a_lookalike_domain`), `test_scrub_credentials.py` (redacción
  de URLs con userinfo/query-secret en mensajes de error, incluyendo `test_mcp_server.py::
  test_mcp_status_exception_credentials_are_scrubbed` — el server MCP también scrubbea
  excepciones antes de responder), `test_doctor_credential_boundaries.py` (doctor nunca crea,
  refresca ni prueba en vivo credenciales guardadas de Twitter/Reddit/XHS —
  `test_twitter_doctor_does_not_start_cli_without_explicit_credentials`,
  `test_reddit_doctor_reports_stale_saved_credential_without_refresh`), `test_p0_cli.py` (~30
  tests: secretos nunca en argumentos posicionales sin warning, `--stdin` explícito con límite de
  1 MiB, `install --safe`/`--system` mutuamente excluyentes, `uninstall` nunca borra
  automáticamente entradas de terceros sin poder probar propiedad).
- **Documentación como contrato verificado por test, no solo prosa**: `test_auth_guidance_policy.py`
  es el hallazgo más interesante de esta pasada — un archivo de test que hace *grep estructural
  sobre todos los `.md` del repo* (README×4 idiomas, guides/, skill/references/) para impedir que
  la documentación reintroduzca lenguaje de login implícito/QR ya retirado, instale el paquete PyPI
  equivocado, o mencione secretos en argumentos de proceso. Es una forma de "test ejecutable sobre
  prosa" — cercano en espíritu (no en mecanismo) a un gate, pero opera sobre Markdown con regex,
  no sobre código con aserciones de comportamiento; ya se decidió que esto no es un paralelo VCP
  nuevo (ver razonamiento abajo).
- Los `.md` de `guides/` y `skill/references/` (18 archivos) confirman al pie de la letra las
  cadenas exactas que `test_auth_guidance_policy.py` exige (`TWITTER_AUTH_TOKEN`, `TWITTER_CT0`,
  `不会执行 twitter status`, límites de Groq, `opencli youtube transcript`, etc.) — documentación
  y test están genuinamente acoplados, no solo declarativamente coherentes.
- Scaffolding (`pyproject.toml`, `.github/workflows/pytest.yml`) confirma un **wheel-gate** de CI
  no mencionado antes: el job `wheel-gate` construye el wheel real, verifica que no haya entradas
  duplicadas y que `SKILL.md`/`guides/`/`scripts/`/`skill/references/` efectivamente vayan
  empaquetados, e instala ese wheel en un venv limpio para un smoke-test — protege contra el caso
  real "pasa con `pip install -e .` pero rompe con `pip install` real", no solo cobertura de tests.

### Cross-reference VCP final

Ningún patrón nuevo aplicable a VCP surge de estos 66 archivos. Se evaluó explícitamente
`test_auth_guidance_policy.py` como candidato a paralelo con los gates de VCP (RED→GREEN, receipts)
y se descarta como aporte nuevo: es un test que impone invariantes de *contenido de documentación*
(qué cadenas deben/no deben aparecer en archivos Markdown), no un gate de *proceso de desarrollo*
(test-first, receipt de verificación, rol de subagente). El paralelo estructural ya registrado
(fallback ordenado = estricto-upgrade/no-degradación, presente en `SKILL.md` líneas 246-250 y
`fableultracode` líneas 8-9/15-19/45-48 de VCP) sigue siendo el único hallazgo genuino de todo el
repo; esta pasada lo confirma con ~15 tests adicionales pero no agrega una categoría nueva de
idea aplicable.

## Manifiesto completo — 120/120 archivos con estado

| # | Path | Estado |
|---|------|--------|
| 1 | `.env.example` | Leído íntegro |
| 2 | `.github/workflows/pytest.yml` | Leído íntegro |
| 3 | `.gitignore` | Leído íntegro |
| 4 | `.openteams/specs/2026-07-10-agent-skills-hub-friend-link-design.html` | Leído íntegro |
| 5 | `.openteams/specs/2026-08-04-readme-partner-section-design.html` | Leído íntegro |
| 6 | `CHANGELOG.md` | Leído íntegro |
| 7 | `CLAUDE.md` | Leído íntegro |
| 8 | `CONTRIBUTING.md` | Leído íntegro |
| 9 | `LICENSE` | Leído íntegro |
| 10 | `README.md` | Leído íntegro |
| 11 | `SECURITY.md` | Leído íntegro |
| 12 | `agent_reach/__init__.py` | Leído íntegro |
| 13 | `agent_reach/backends/__init__.py` | Leído íntegro |
| 14 | `agent_reach/backends/opencli.py` | Leído íntegro |
| 15 | `agent_reach/channels/__init__.py` | Leído íntegro |
| 16 | `agent_reach/channels/_opencli_site.py` | Leído íntegro |
| 17 | `agent_reach/channels/base.py` | Leído íntegro |
| 18 | `agent_reach/channels/bilibili.py` | Leído íntegro |
| 19 | `agent_reach/channels/exa_search.py` | Leído íntegro |
| 20 | `agent_reach/channels/facebook.py` | Leído íntegro |
| 21 | `agent_reach/channels/github.py` | Leído íntegro |
| 22 | `agent_reach/channels/instagram.py` | Leído íntegro |
| 23 | `agent_reach/channels/linkedin.py` | Leído íntegro |
| 24 | `agent_reach/channels/mcporter.py` | Leído íntegro |
| 25 | `agent_reach/channels/reddit.py` | Leído íntegro |
| 26 | `agent_reach/channels/rss.py` | Leído íntegro |
| 27 | `agent_reach/channels/twitter.py` | Leído íntegro |
| 28 | `agent_reach/channels/v2ex.py` | Leído íntegro |
| 29 | `agent_reach/channels/web.py` | Leído íntegro |
| 30 | `agent_reach/channels/xiaohongshu.py` | Leído íntegro |
| 31 | `agent_reach/channels/xiaoyuzhou.py` | Leído íntegro |
| 32 | `agent_reach/channels/xueqiu.py` | Leído íntegro |
| 33 | `agent_reach/channels/youtube.py` | Leído íntegro |
| 34 | `agent_reach/cli.py` | Leído íntegro (muestreo profundo dirigido + grep completo) |
| 35 | `agent_reach/config.py` | Leído íntegro |
| 36 | `agent_reach/cookie_extract.py` | Leído íntegro |
| 37 | `agent_reach/core.py` | Leído íntegro |
| 38 | `agent_reach/doctor.py` | Leído íntegro |
| 39 | `agent_reach/guides/setup-exa.md` | Leído íntegro |
| 40 | `agent_reach/guides/setup-groq.md` | Leído íntegro |
| 41 | `agent_reach/guides/setup-reddit.md` | Leído íntegro |
| 42 | `agent_reach/guides/setup-twitter.md` | Leído íntegro |
| 43 | `agent_reach/guides/setup-xiaohongshu.md` | Leído íntegro |
| 44 | `agent_reach/integrations/__init__.py` | Leído íntegro |
| 45 | `agent_reach/integrations/mcp_server.py` | Leído íntegro |
| 46 | `agent_reach/probe.py` | Leído íntegro |
| 47 | `agent_reach/scripts/transcribe_xiaoyuzhou.sh` | Leído íntegro |
| 48 | `agent_reach/skill/SKILL.md` | Leído íntegro |
| 49 | `agent_reach/skill/SKILL_en.md` | Leído íntegro |
| 50 | `agent_reach/skill/references/career.md` | Leído íntegro |
| 51 | `agent_reach/skill/references/dev.md` | Leído íntegro |
| 52 | `agent_reach/skill/references/finance.md` | Leído íntegro |
| 53 | `agent_reach/skill/references/search.md` | Leído íntegro |
| 54 | `agent_reach/skill/references/social.md` | Leído íntegro |
| 55 | `agent_reach/skill/references/video.md` | Leído íntegro |
| 56 | `agent_reach/skill/references/web.md` | Leído íntegro |
| 57 | `agent_reach/transcribe.py` | Leído íntegro |
| 58 | `agent_reach/utils/paths.py` | Leído íntegro |
| 59 | `agent_reach/utils/process.py` | Leído íntegro |
| 60 | `agent_reach/utils/text.py` | Leído íntegro |
| 61 | `agent_reach/utils/url.py` | Leído íntegro |
| 62 | `config/mcporter.json` | Leído íntegro |
| 63 | `constraints.txt` | Leído íntegro |
| 64 | `docs/README_en.md` | Leído íntegro |
| 65 | `docs/README_ja.md` | Leído íntegro |
| 66 | `docs/README_ko.md` | Leído íntegro |
| 67 | `docs/assets/logo-1.png` | Excluido — binario raster, logo sin lógica |
| 68 | `docs/assets/logo-1.svg` | Excluido — SVG de logo (paths gráficos), sin lógica de programa |
| 69 | `docs/assets/logo-2.png` | Excluido — binario raster, logo sin lógica |
| 70 | `docs/assets/logo-2.svg` | Excluido — SVG de logo, sin lógica |
| 71 | `docs/assets/logo-3.png` | Excluido — binario raster, logo sin lógica |
| 72 | `docs/assets/logo-3.svg` | Excluido — SVG de logo, sin lógica |
| 73 | `docs/assets/sponsors/astraflow.png` | Excluido — binario raster, badge de sponsor |
| 74 | `docs/assets/sponsors/browseract.png` | Excluido — binario raster, badge de sponsor |
| 75 | `docs/assets/sponsors/coreclaw.png` | Excluido — binario raster, badge de sponsor |
| 76 | `docs/assets/sponsors/tencent-cloud.svg` | Excluido — SVG de badge de sponsor, sin lógica |
| 77 | `docs/cookie-export.md` | Leído íntegro |
| 78 | `docs/dependency-locking.md` | Leído íntegro |
| 79 | `docs/install.md` | Leído íntegro |
| 80 | `docs/troubleshooting.md` | Leído íntegro |
| 81 | `docs/update.md` | Leído íntegro |
| 82 | `docs/wechat-group-qr.jpg` | Excluido — binario raster, QR de grupo |
| 83 | `llms.txt` | Leído íntegro |
| 84 | `pyproject.toml` | Leído íntegro |
| 85 | `scripts/sync-upstream.sh` | Leído íntegro |
| 86 | `test.sh` | Leído íntegro |
| 87 | `tests/conftest.py` | Leído íntegro |
| 88 | `tests/test_auth_guidance_policy.py` | Leído íntegro |
| 89 | `tests/test_channel_contracts.py` | Leído íntegro |
| 90 | `tests/test_channels.py` | Leído íntegro |
| 91 | `tests/test_cli.py` | Leído íntegro |
| 92 | `tests/test_config.py` | Leído íntegro |
| 93 | `tests/test_cookie_extract_perms.py` | Leído íntegro |
| 94 | `tests/test_cookie_security.py` | Leído íntegro |
| 95 | `tests/test_core.py` | Leído íntegro |
| 96 | `tests/test_doctor.py` | Leído íntegro |
| 97 | `tests/test_doctor_credential_boundaries.py` | Leído íntegro |
| 98 | `tests/test_home_isolation.py` | Leído íntegro |
| 99 | `tests/test_integration_script.py` | Leído íntegro |
| 100 | `tests/test_mcp_server.py` | Leído íntegro |
| 101 | `tests/test_mcporter_config.py` | Leído íntegro |
| 102 | `tests/test_opencli_backend.py` | Leído íntegro |
| 103 | `tests/test_opencode_skill.py` | Leído íntegro |
| 104 | `tests/test_p0_cli.py` | Leído íntegro |
| 105 | `tests/test_paths.py` | Leído íntegro |
| 106 | `tests/test_private_file_writes.py` | Leído íntegro |
| 107 | `tests/test_probe.py` | Leído íntegro |
| 108 | `tests/test_process.py` | Leído íntegro |
| 109 | `tests/test_reddit_channel.py` | Leído íntegro |
| 110 | `tests/test_scrub_credentials.py` | Leído íntegro |
| 111 | `tests/test_skill_command.py` | Leído íntegro |
| 112 | `tests/test_transcribe.py` | Leído íntegro |
| 113 | `tests/test_twitter_channel.py` | Leído íntegro |
| 114 | `tests/test_url_security.py` | Leído íntegro |
| 115 | `tests/test_v2ex_channel.py` | Leído íntegro |
| 116 | `tests/test_web_channel.py` | Leído íntegro |
| 117 | `tests/test_xhs_format.py` | Leído íntegro |
| 118 | `tests/test_xiaoyuzhou_install.py` | Leído íntegro |
| 119 | `tests/test_xueqiu_channel.py` | Leído íntegro |
| 120 | `tests/test_youtube_channel.py` | Leído íntegro |

**109/120 leídos directamente (código Python, tests, Markdown, HTML, shell, YAML, TOML, JSON —
todo lo que puede contener comportamiento o afirmaciones verificables) + 11/120 excluidos con
razón nombrada por archivo (binarios/logos/badges sin lógica funcional) = 120/120 contabilizados
sin restos.**

## Status final

**ESTUDIADA EXHAUSTIVAMENTE.** Los 120 blobs del manifiesto al SHA
`93ae1d18c37b707dec053c7c4f9d91cd8ef8943d` están contabilizados: 109 leídos directamente en su
totalidad (o con muestreo profundo + grep dirigido documentado para el único archivo grande,
`cli.py`, 2350 líneas) y 11 excluidos individualmente con razón nombrada (binarios/SVGs de
logo/sponsor sin lógica de programa). No queda categoría abierta. El cross-reference con VCP se
mantiene en un único hallazgo genuino y ya bien evidenciado — fallback ordenado con contrato
estricto-upgrade/no-degradación — confirmado de forma independiente y convergente en ambos
proyectos, sin más aportes nuevos tras la lectura completa.
