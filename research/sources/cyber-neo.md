# cyber-neo — revisión exhaustiva y trazable

## Snapshot fijado

- **Repositorio:** `Hainrixz/cyber-neo`
- **Commit revisado:** `dcac0a8f111954e543e1e66e02a222c0c489ca74`
  (`docs: add Claw'd mascot artwork to README + social preview`)
- **Checkout:** detached HEAD en ese SHA; no se usó el `main` mutable como evidencia.
- **Manifiesto:** `git ls-tree -r --name-only HEAD` = **28 blobs**.
- **Integridad reproducible:** SHA-256 de cada entrada `path + NUL + sha256(bytes) + NUL + size`
  = `705aab78e43a8063f4c941d392dfb5e4398b77030a96f36e047db9f7dc33c101`.

## Cobertura completa

Los **22 archivos textuales UTF-8** fueron leídos íntegramente: 338.094 bytes y 10.981
saltos de línea físicos. Los seis PNG también se inspeccionaron técnicamente y de forma visual;
no se los trató como una exclusión silenciosa.

| Grupo | Archivos revisados | Cobertura / resultado |
|---|---|---|
| Raíz y configuración | `.claude-plugin/plugin.json`, `.gitignore`, `CLAUDE.md`, `LICENSE`, `README.md` | 5/5 íntegros. El manifiesto declara el plugin `cyber-neo` v0.1.0; README y CLAUDE.md describen el producto, contribución y límites. |
| Orquestación | `skills/cyber-neo/SKILL.md` | 1/1 íntegro. Define las siete fases, el contrato read-only, cinco subagentes y el informe final. |
| Base de conocimiento | `references/{auth-authz-patterns,cicd-security,crypto-patterns,cwe-top-25,error-handling-patterns,iac-docker,lang-javascript,lang-python,logging-patterns,owasp-top-10,report-template,secrets-patterns,supply-chain,web-security-patterns}.md` | 14/14 íntegros. Son catálogos de señales, CWE/OWASP, severidades, ejemplos vulnerables y remediaciones. |
| Automatización | `scripts/check_lockfiles.py`, `scripts/scan_secrets.py` | 2/2 íntegros; ambos inspeccionados por función y compilados con Python. |
| Arte visual | `assets/claw-d-{architecture,community,scanner,shield}.png`, `assets/cyber-neo-hero.png`, `assets/social-preview.png` | 6/6. Cuatro PNG 2048×2048 y dos 2688×1520, RGB de 8 bits; todos muestran la mascota Claw'd y comunican, respectivamente, arquitectura, comunidad, escaneo, escudo, portada y preview social. No contienen lógica ejecutable. |

No hay tests versionados en este snapshot. La ausencia se consigna: no se confundió con una
suite verde.

## Qué implementa la fuente

### Orquestador de seguridad

`SKILL.md` es el producto principal. Resuelve primero el directorio objetivo y declara una
**iron law**: no modificar ni ejecutar código del proyecto auditado, ni instalar paquetes;
la única escritura permitida es el reporte en el escritorio. Después:

1. Hace reconocimiento de stack, infraestructura, `.env` y CI/CD; clasifica el alcance en
   pequeño (<1.000 archivos), mediano (1.000–10.000) o grande (10.000+).
2. Carga las referencias pertinentes y detecta herramientas externas opcionales
   (Semgrep, Trivy, Gitleaks, npm/pip/cargo audit).
3. Despacha cinco análisis read-only en paralelo: SCA, SAST, secretos, configuración/infra y
   supply-chain/CI-CD.
4. Fusiona resultados, desduplica por `file + line + CWE`, pide evidencia contextual y clasifica
   por CVSS/CWE/OWASP.
5. Emite un informe con IDs `CN-XXX`, acciones prioritarias, cobertura y herramientas usadas.

La taxonomía de referencias cubre OWASP 2025 A01–A10 —incluidas A03 supply chain y A10
exceptional conditions— y una selección del CWE Top 25. Los mapas incluyen inyección, acceso,
autenticación, criptografía, integridad, logging y manejo de errores.

### Base de conocimiento: contenido efectivamente cubierto

| Archivos | Contenido operativo leído |
|---|---|
| `owasp-top-10.md`, `cwe-top-25.md` | Definiciones, patrones y guía de severidad para OWASP A01–A10 y 25 CWE (SQLi, un hallazgo de seguridad, auth, path traversal, deserialización, SSRF, crypto, logging, DoS, etc.). |
| `auth-authz-patterns.md` | Middleware ausente, JWT (algoritmo/expiración/storage), sesiones, hashing de passwords, OAuth/OIDC, MFA, rate limiting, IDOR y escalación horizontal/vertical/RBAC. |
| `crypto-patterns.md`, `secrets-patterns.md` | Hash/cifrado/TLS/aleatoriedad/keys débiles; 81 patrones de secretos con proveedor, regex, severidad y notas de falsos positivos. |
| `lang-javascript.md`, `lang-python.md` | Detección de framework y señales/remediaciones de SQL/NoSQL injection, un hallazgo de seguridad, command/code injection, traversal, deserialización, SSRF, configuración, sesiones, dependencias y particularidades Express/Next/React/Electron y Django/Flask/FastAPI. |
| `web-security-patterns.md` | CSP, CORS, HSTS, frame/content/referrer/permissions policy, CSRF, SSRF/metadata cloud, uploads, redirects y flags Secure/HttpOnly/SameSite. |
| `error-handling-patterns.md`, `logging-patterns.md` | Stack traces, catches silenciosos, debug de producción, error boundaries; secretos e inyección en logs, eventos de seguridad y rotación/permisos/transporte de logs. |
| `cicd-security.md`, `supply-chain.md` | Inyección en GitHub Actions, `pull_request_target`, permisos, SHA pinning, secretos de CI, instalaciones y runners; dependency confusion, typosquatting, lockfiles, salud e integridad/SRI. |
| `iac-docker.md` | Dockerfile, Compose e imágenes: root, tags, `ADD`, secretos, `.dockerignore`, multi-stage, socket Docker, mounts, límites, puertos y hardening completo. |
| `report-template.md` | Estructura de informe, orden de findings, deduplicación, metadata/cobertura y fórmula de risk score. |

### Scripts: comportamiento y límites verificados

- `check_lockfiles.py` detecta package manager JavaScript dinámicamente (npm/yarn/pnpm/bun),
  y revisa pip, pipenv, poetry, cargo, bundler, composer y Go. Busca lockfiles ausentes o
  ignorados, versiones sin fijar y lifecycle hooks npm. Sólo lee; devuelve JSON y `1` cuando
  tiene findings.
- `scan_secrets.py` recorre archivos no excluidos, limita tamaño/línea, omite dependencias y
  binarios, aplica regex, allowlist y rebaja severidad para paths de test. Tiene modo normal y
  `--staged-only` (en este último devuelve `2` para bloquear un hook).

## Verificación ejecutada sobre el checkout

| Comando | Exit | Resultado |
|---|---:|---|
| `python -m py_compile scripts/check_lockfiles.py scripts/scan_secrets.py` | 0 | Sintaxis Python válida en ambos helpers. |
| `python scripts/check_lockfiles.py <checkout>` | 0 | JSON sin findings; este repo no declara package manager. |
| `python scripts/scan_secrets.py <checkout> --summary` | 1 | 21 archivos escaneados, 6 omitidos, 29 coincidencias potenciales (18 critical, 11 high). |

El último resultado no prueba secretos reales: las 29 coincidencias están en los propios
ejemplos/documentación (`auth-authz`, `crypto`, `lang-javascript`, `lang-python`,
`secrets-patterns`) y en el texto de `scan_secrets.py`. Es una evidencia concreta de que el
scanner regex requiere revisión contextual antes de bloquear o reportar un secreto como real.

## Correlación verificable con VibeCodeProtocols

### Ya aplicado en VCP

1. **Security gate siempre presente y read-only.** `skills/security-baseline.md:9-14` define
   un fallback autocontenido, explícitamente más angosto que cyber-neo, y `SKILL.md:257-263`
   usa cyber-neo sólo si ya está disponible. Eso conserva el requisito de VCP de no necesitar
   instalar otro skill para tener un gate.
2. **Severidad y bloqueo.** VCP comparte los niveles Critical/High/Medium/Low
   (`skills/security-baseline.md:11,29,34`) y obliga a corregir/re-escanear Critical o High
   (`SKILL.md:260-263`).
3. **Separación de facultades.** El rol `Security-Officer` queda read-only y no puede
   autoaprobar (`skills/orchestrator-opus.md:27,55`), una versión más limitada y compatible
   con el flujo de implementación posterior de VCP.

### Deliberadamente no portado

- Las cinco ramas de auditoría, las catorce referencias, los scripts y las integraciones con
  scanners externos no se incluyeron en VCP: el fallback tiene sólo seis categorías
  documentadas (`skills/security-baseline.md:16-23`) y se presenta honestamente como no-SAST.
- No existe en VCP un `Risk Score` numérico ni scope tiering por cantidad de archivos; el grep
  en `SKILL.md`, `skills/`, `templates/` y `scripts/` no encontró esas reglas. VCP usa
  `risk_level` basado en evidencia del changeset (`SKILL.md:230-255`).
- VCP tampoco afirma soportar la taxonomía completa OWASP/CWE ni CVE lookups sin herramienta
  externa; su baseline evita inventar CVEs (`skills/security-baseline.md:22,38-41`).

## Hallazgos útiles y límites al reutilizar la fuente

- **Útil:** el patrón de degradación explícita es bueno: si existe un scanner real se lo trata
  como upgrade; si no, el gate interno no queda vacío. Es exactamente el uso que VCP ya hace.
- **No copiar a ciegas:** la propia prueba del scanner encontró sus ejemplos como secretos;
  cualquier uso futuro de regex debe mantener redacción, contexto y revisión humana.
- **No usar su score como decisión de VCP:** `SKILL.md` mapea 1–20/21–50/51–80, mientras
  `report-template.md` mapea 1–15/16–40/41–70. Esa divergencia interna hace que trasladar la
  fórmula sin reconciliar bandas sea incorrecto.
- **Límite de garantía:** el contrato read-only es una instrucción del prompt y su
  `allowed-tools` aún incluye `Write` para generar el reporte externo. No equivale a un sandbox
  que técnicamente impida escribir fuera del objetivo.

## Estado

**EXHAUSTIVA para el snapshot fijado.** Se cubrieron 28/28 blobs: texto, configuración,
funciones de los dos scripts y los seis PNG. Esta conclusión no dice que cyber-neo sea un SAST
completo ni que sus detecciones estén validadas; sólo que todo su contenido versionado en el SHA
indicado fue leído, inspeccionado y distinguido de sus límites reales.
