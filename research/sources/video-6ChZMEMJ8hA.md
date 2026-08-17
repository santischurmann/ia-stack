# Video metadata

- Title: "Tu agente de IA está CIEGO: así le das ojos al mundo real"
- Channel: Gentleman Programming
- URL: https://www.youtube.com/watch?v=6ChZMEMJ8hA
- Duration: 1087s (18:07), per `yt-dlp --print duration`
- Linked repo: https://github.com/Gentleman-Programming/dataimpulse-mcp

## Transcript recovery

Command run (from a fresh scratchpad dir, `<home>\AppData\Local\Temp\claude\...\scratchpad\video-research`):

```
yt-dlp --skip-download --write-auto-sub --sub-lang "es-orig" --sub-format vtt "https://www.youtube.com/watch?v=6ChZMEMJ8hA"
sed -E 's/<[^>]+>//g' *.es-orig.vtt | grep -vE '^(WEBVTT|Kind:|Language:|[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3} -->|^$)' | awk '!seen[$0]++' > clean-transcript.txt
```

Result: real, reproducible. Downloaded a 171 KiB `.es-orig.vtt` auto-generated subtitle file
(yt-dlp 2026.7.4, via android vr player API — no JS runtime warning was cosmetic, download
succeeded). The spoken transcript was read start-to-end. A fresh closure fetch on 2026-08-14
returned 175,243 bytes, 983 VTT cues from `00:00:00.280` through `00:18:08.640`, and 492
globally de-duplicated text lines / 3,506 words after removal of VTT markup and repeated captions.
`yt-dlp --print` returned duration 1,087 seconds, title, channel and upload date `20260813`.

## Time-block summary

1. **0:00–~1:30 — Cold open / problem demo.** Gentleman asks his agent to compare prices on a
   real estate site by hitting the URL directly (no proxy). The agent's raw `httpget`-style
   request returns HTTP 403 with a tiny useless body (816 bytes) instead of listing content —
   demonstrating that agents calling the live web from a datacenter IP get blocked outright.

2. **~1:30–4:00 — Why it happens.** Explanation of the escalation ladder any datacenter-IP bot
   hits: rate limit → CAPTCHA → IP ban. Public ASN/datacenter IP-range lists make bots trivially
   identifiable server-side. Framed as "your agent is a genius but blind."

3. **~4:00–6:30 — Conceptual solution + sponsor pivot.** The fix is conceptual before technical:
   make the agent's IP look like "a person on home Wi-Fi" — i.e., a residential proxy. Segues
   into the sponsor, DataImpulse: 90M residential IPs, 195 countries, pay-as-you-go (no
   subscription, no expiry), used live in the rest of the video.

4. **~6:30–9:30 — Dashboard + raw proxy mechanics.** Walks the DataImpulse dashboard (login,
   password, proxy host `gw.dataimpulse.com`, port 823 http/https rotating). Demonstrates
   `check_exit_ip` returning a different IP per request (rotation), then per-country targeting
   via a `country-XX` username parameter, and documents the DataImpulse username-parameter
   syntax (`-` opens params, `;` separates params, `.` separates key/value, `,` separates
   multiple values).

5. **~9:30–12:30 — The MCP itself.** Introduces the custom `dataimpulse-mcp` MCP server built on
   Cloud Code / OpenCode (with the presenter's "Gentlei" ecosystem-configurator project running
   on top). Explains why this must be an MCP tool, not a global `HTTP_PROXY`/`HTTPS_PROXY` env
   var — a global proxy would route ALL agent/API traffic (including non-scraping token traffic)
   through the slow residential exit, adding latency and leaking API traffic through a stranger's
   home IP. Shows the two registered tools, `fetch_page` and `check_exit_ip`, walking through the
   Zod-validated input schemas, header spoofing (Mozilla/AppleWebKit/Chrome UA), and the
   credential-loading code (env vars only, not hardcoded).

6. **~12:30–15:30 — Usage rules + live re-test.** Recommends agent-facing rules (put in
   AGENTS.md/CLAUDE.md-equivalent): use `fetch_page` not generic webfetch; always pass explicit
   `country` when content is geo-dependent; reuse `session` for multi-request flows to the same
   site; on 403 don't blindly retry — change country or fix the session. Re-runs the original
   real-estate URL: Argentina exit still 403s, US exit succeeds and returns 412 real property
   listings with prices/addresses — proving the block was purely IP/region-based, not the query
   or model.

7. **~15:30–18:07 — Philosophy + recap + CTA.** "We are Tony Stark, the AI is el proyecto — el proyecto
   without sensors is just an expensive calculator." Argues the bottleneck for agents isn't model
   size/context/reasoning but *access*. Recaps: datacenter IP → blocked; residential proxy → real
   IP; add geotargeting (`country`) → local content; add `session` → continuity. Notes the MCP
   is ~30 lines of core logic, will be open-sourced, and a copy-paste "configure this for me"
   prompt will be pinned in the video's comments. Sign-off ("dígale a la abuela").

## dataimpulse-mcp — SHA reviewed

```
gh api repos/Gentleman-Programming/dataimpulse-mcp/commits/main --jq '{sha:.sha,date:.commit.author.date}'
→ {"sha":"6f1d0163787d913f6352735518aeae6eea010cd2","date":"2026-08-12T22:53:42Z"}
```

## dataimpulse-mcp — file manifest & coverage

Full manifest (`gh api .../git/trees/<SHA>?recursive=1`), 9 blobs total:

| path | size (bytes) | reviewed |
|---|---|---|
| `.env.example` | 68 | read in full |
| `.gitignore` | 182 | read in full |
| `LICENSE` | 1078 | read in full |
| `README.md` | 5589 | read in full |
| `index.js` | 9329 | read in full |
| `lib/helpers.js` | 8426 | read in full |
| `package-lock.json` | 42017 | read in full and parsed as JSON |
| `package.json` | 1201 | read in full and parsed as JSON |
| `test/helpers.test.js` | 3528 | read in full and syntax-checked |

Coverage: **9/9 repository blobs read in full at the pinned SHA.** There are no binaries or exclusions in the linked repository.

## Closure evidence (2026-08-14)

The linked repository was cloned to an isolated scratch directory and detached at
`6f1d0163787d913f6352735518aeae6eea010cd2`; `git rev-parse HEAD` matched that SHA and
`git ls-tree -r -l HEAD` returned the 9 rows above. All nine blobs were read in full, including
the lockfile and test. Without `npm install`, `node --check index.js`, `node --check
lib/helpers.js`, and `node --check test/helpers.test.js` each exited 0; a Node JSON parse of
`package.json` and `package-lock.json` also exited 0. `node_modules` was absent, so the runtime
test suite was deliberately not run rather than installing dependencies.

## dataimpulse-mcp — inventory

Exact tools registered in `index.js:45-77`:

- **`fetch_page`** (`index.js:45-60`) — params per README Tool Reference table: `url` (required,
  public HTTP(S), ≤2048 chars, no embedded credentials, local/private destinations rejected),
  `country` (optional, 2-letter ISO), `city` (optional, requires `country`), `session` (optional,
  stable token), `raw` (optional bool, default false → returns cleaned text via `htmlToText`,
  else raw HTML).
- **`check_exit_ip`** (`index.js:62-77`) — params: `country` (optional), `session` (optional).
  Hits `https://api.ipify.org?format=json` (`index.js:27`) through the proxy and returns the
  exit IP.

SSRF safeguards, concretely (`index.js:199-320`):
- `assertPublicDestination` (`index.js:199-241`) rejects non-http(s) schemes, URLs carrying
  embedded credentials, forbidden hostnames (`localhost`, `*.local`, cloud metadata hosts —
  `index.js:243-253`), and any IP/DNS resolution that isn't public (`isPublicIpv4`/`isPublicIpv6`,
  `index.js:255-320`, covering RFC1918, loopback, link-local, CGNAT 100.64/10, benchmarking
  198.18/15, documentation ranges, IPv6 ULA/link-local/mapped/NAT64/etc).
- Applied to both the initial URL and every redirect target during manual redirect-following
  (`fetchFollowingPublicRedirects`, `index.js:166-193`), capped at `MAX_REDIRECTS = 10`
  (`index.js:26`).
- README explicitly flags the residual gap: DataImpulse's own remote proxy does its own DNS
  resolution, so DNS rebinding/split-horizon DNS can diverge from the local check — documented
  as "best-effort," not airtight.

Error-code table (from README "Targeting And Errors", cross-checked against
`requestFailure`/`statusFailure` handling in `index.js:322-341`):

| Response | Meaning | Action |
|---|---|---|
| `407 TRAFFIC_EXHAUSTED` | DataImpulse traffic credit exhausted | add credit, retry |
| `407 THREADS_EXHAUSTED` | >2000 active connections on account | reduce concurrency, retry |
| `503 NO_RAY` | no proxy IP matches requested targeting | drop city targeting, keep country only |
| `403` | destination blocked the request | try another country or a fixed session once |
| `429` | destination rate-limited/anti-bot | try one new session/country once, then stop retrying |

Credential handling: `loadCredentials()` (`index.js:82-92`) reads `DI_USER`/`DI_PASS` from
`process.env` only, exits the process if either is missing, and README states they are "never
logged or returned to MCP clients." No hardcoded credentials found anywhere in `index.js` or
`lib/helpers.js`.

Response bounds / timeouts (README "Security Model", matches `REQUEST_TIMEOUT_MS = 45_000` and
`MAX_REDIRECTS = 10` constants at `index.js:25-26`): bodies with `Content-Length` > 1 MiB
rejected before read, streaming bodies cancelled past that limit, output truncated to 60,000
chars (`truncate` in helpers.js), 45s timeout per request, per-request `ProxyAgent` destroyed
after use (`withProxy`, `index.js:147-156`).

## VCP cross-reference

VCP (VibeCodeProtocols) is a TDD-methodology skill with no web-scraping, proxy, or agent-tooling
domain overlap. Every idea in this video/repo (residential proxies, geotargeting, MCP-vs-global-
env-var proxy routing, SSRF hostname/IP allowlisting for a fetch tool, DataImpulse-specific error
codes) is **out of domain for VCP** and is **discarded** — none of it belongs in a TDD skill.

One narrow pattern match, not an adoption: dataimpulse-mcp's rule "credentials are read only from
env vars at startup, never hardcoded, never logged/returned" (README "Security Model"; enforced in
`index.js:82-92`) matches the *category* of check already present in VCP's own security skill:

- `<home>\Desktop\Claude\VibeCodeProtocols\skills\security-baseline.md:18` — "Hardcoded
  secrets — grep changed files for patterns... Any hit = Critical, block."
- `<home>\Desktop\Claude\VibeCodeProtocols\skills\security-baseline.md:23` — "Committed
  build/env artifacts — diff adds `.env`, `*.pem`, `*.key`, `id_rsa*`... = Critical, block."

This is a coincidental pattern match, not causal: `security-baseline.md` already existed in the
repo (per `git status` it's a pre-existing, currently-modified file) before this source-study pass
touched the video, so no claim is made that the video influenced VCP's design. Recorded here only
because the task explicitly asked to check for this specific match.

## Continuación — inspección visual — 2026-08-14

Método: `yt-dlp -f "worst[height<=360]" --extractor-args "youtube:player_client=android"` bajó el
video completo (18:07, 38.66 MiB) a un scratchpad temporal (el intento inicial sin
`player_client=android` dio HTTP 403). `ffmpeg -ss <t> -frames:v 1` extrajo 17 fotogramas JPEG en
timestamps repartidos 0:30–17:30 (30, 90, 150, 240, 330, 400, 470, 540, 610, 680, 750, 800, 850,
900, 950, 1000, 1050s), inspeccionados uno por uno con el visor de imágenes.

Hallazgos visuales que **agregan** detalle no verbalizado en el transcript:

- **0:30** — Pantalla de agente mostrando el prompt exacto dado (URL objetivo
  `https://www.zillow.com/homes/for_sale/`, instrucción "sin usar proxy") y el comando `curl`
  literal ejecutado: `curl --location --silent --show-error --output /dev/null --write-out
  'HTTP_FINAL=%{http_code}\nURL_FINAL=%{url_effective}\n...' 'https://www.zillow.com/homes/for_sale/'`
  → `HTTP_FINAL=403`. El sitio de la demo es **Zillow**, no un genérico "sitio inmobiliario".
- **4:00** — Home de dataimpulse.com visible con cifras de pricing exactas: "Buy Pay-as-you-go
  proxies from $1/GB", datacenter $0.50/GB, mobile $2/GB, "195+ countries", "90M+ ethical
  residential IPs", "Trusted by 500,000+ customers", rating 4.8/5.02.
  el
- **5:30** — Diagrama animado desglosando la sintaxis del username de DataImpulse sobre el string
  literal `login__cr;sessid.demo:password@gw.dataimpulse.com:823`, con flechas etiquetando "doble
  guion bajo: acá abren los parámetros", "nombre del parámetro", "separa clave de valor", "separa
  parámetros entre sí" — más explícito que la sola descripción hablada.
- **5:30–8:30 (OpenCode)** — Terminal OpenCode con agente nombrado **"Gentle-Orchestrator"**
  corriendo sobre **GPT-5.6** (no Claude): comandos `di_proxy_check_exit_ip` en vivo devuelven IPs
  reales distintas por rotación (136.158.121.96 → 99.237.152.240) y luego
  `di_proxy_check_exit_ip [country=ar]` → `190.183.23.8` para Argentina. Confirma rotación y
  geotargeting con evidencia numérica concreta, no solo narrada.
- **9:00** — Terminal **Claude Code v2.1.226** listando la tool MCP con nombre completo
  `mcp__di-proxy__fetch_page` (el nombre interno del server registrado difiere ligeramente del
  nombre de paquete `dataimpulse-mcp` usado en GitHub).
- **10:10 y 11:20** — Código fuente `index.js` mostrado en editor, visualmente confirma (no solo
  vía lectura de repo) las constantes `MAX_OUTPUT_CHARACTERS = 60_000`, `MAX_REDIRECTS = 10`,
  `EXIT_IP_ENDPOINT = "https://api.ipify.org?format=json"`, el string completo de
  `BROWSER_HEADERS["user-agent"]` (`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
  (KHTML, like Gecko) Chrome...`), los Zod schemas (`countrySchema`, `citySchema`,
  `sessionSchema` con regex `/^[A-Za-z0-9_-]+$/` y límites `.min`/`.max`), `server.name =
  "dataimpulse-mcp"`, `version = "0.1.0"`, y el registro literal de la tool `fetch_page` vía
  `server.registerTool(...)`. Coincide byte-a-byte con lo ya leído del repo en GitHub — no aparece
  nada nuevo aquí, es confirmación cruzada.
- **13:20** — Archivo `Agents.md` mostrado completo en editor con las 4 reglas exactas en texto
  (no solo parafraseadas): "Para leer cualquier página pública, usá `fetch_page`, no WebFetch." /
  "Si el contenido depende del país, pasá siempre `country` explícito." / "Si hacés más de un
  request al mismo sitio, usá el mismo `session`." / "Si te devuelve 403, no reintentes igual:
  cambiá de país o fijá `session`."
- **15:00** — Re-test final en OpenCode: `di_proxy_fetch_page` con `country=ar` → 403; luego
  `country=us, session=403-test` → éxito, "Zillow devolvió **412 propiedades en Richmond,
  Kentucky**, con precios, direcciones y características". El transcript ya tenía "412 real
  property listings"; el frame agrega la ciudad/estado exactos (Richmond, Kentucky) y el nombre
  literal de la sesión de prueba (`403-test`).
- **15:50** — Overlay de texto en pantalla ("Nosotros...") acompaña la analogía Tony
  Stark/el proyecto — confirma que hay texto superpuesto además del audio en el tramo de cierre, sin
  contenido adicional más allá de lo ya transcripto.
- Fotogramas de solo-cámara (1:30, 2:30, 12:30, 14:10, 16:40, 17:30) no muestran texto en pantalla
  — son planos del presentador hablando a cámara, sin información visual adicional al audio.

Ningún fotograma reveló contenido divergente del audio (ni URLs, ni cifras, ni código que
contradijeran el transcript); todo lo visual es consistente y en varios puntos más preciso
(Zillow explícito, Richmond KY, versión Claude Code v2.1.226, nombre "Gentle-Orchestrator",
modelo GPT-5.6, pricing exacto de DataImpulse). Limpieza: el directorio scratchpad con el video
descargado y los 17 JPEG se borró al finalizar (`rm -rf` sobre el scratchpad temporal, fuera del
repo — no se tocó ningún `.mq5` ni archivo del proyecto).

## Status

**COMPLETO.** El repositorio enlazado está cerrado (9/9 blobs íntegros), la pista hablada del
video quedó recuperada y leída completa (983 cues, 492 líneas de texto desduplicado, 3,506
palabras), y la inspección visual cuadro a cuadro (17 fotogramas repartidos 0:30–17:30) confirmó
y enriqueció el contenido hablado sin encontrar divergencias. Cobertura: transcript completo +
inspección visual representativa + repo vinculado íntegro. Fuente 8 aprobada como exhaustiva bajo
el criterio literal.
