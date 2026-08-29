# Spec: integridad-verificable

**Date:** 2026-08-27
**Version:** 1.0
**Author:** Opus (VibeCodeProtocols)
**Status:** Cumplida — 12/12 criterios con prueba, cerrada el 2026-08-29

---

## Problem / Problema

Cuatro reglas del protocolo existen sólo como texto. VCP declara que una regla sin detector es
decorativa; estas cuatro no lo tienen.

---

## Discovery / Investigación previa

- **Fuentes:** `runs/run-001/packets/d003.json` — 4 claims `SUPPORTED` con archivo, línea y sha256.
- **CAIO:** proceso roto y pérdida de información **observados**; retrabajo es **hipótesis**;
  bucle abierto en `verify-receipt.mjs:421`.
- **Bucle:** hoy un gate verde autoriza escribir y nada controla hasta el commit. Objetivo:
  re-verificar al escribir y encadenar la traza.
- **PRD:** violar cualquiera falla con exit 1.
- **Adopción:** dueño = operador único. Señal: líneas selladas en `.vibe/AUDIT.md`.

---

## Target Users / Usuarios

El orquestador de la próxima sesión y quien audite el repo después.

---

## Acceptance Criteria / Criterios de aceptación

**T01 — hash-chain de `AUDIT.md`** (slice mínimo: se valida primero)

- [x] **AC1:** GIVEN un `AUDIT.md` cuyas líneas encadenan cada hash con el de su predecesora, WHEN
      se corre el gate, THEN exit 0 informando cuántas verificó.
- [x] **AC2 (error):** GIVEN una línea ya escrita fue editada, WHEN se corre el gate, THEN exit 1
      nombrando la línea donde se rompe la cadena.
- [x] **AC3 (edge):** GIVEN un `AUDIT.md` vacío o inexistente, WHEN se corre el gate, THEN exit 0.
- [x] **AC4 (compat):** GIVEN líneas heredadas sin hash, WHEN se corre el gate, THEN las acepta y
      encadena desde la primera línea que declara hash.
- [x] **AC11 (escritor):** GIVEN una línea nueva, WHEN se la agrega con el subcomando `append`,
      THEN queda sellada y el gate la verifica. Escritor y verificador comparten la función de
      sellado: no pueden divergir.
- [x] **AC12:** GIVEN una línea con sello mal formado, WHEN se corre el gate, THEN exit 1: un
      sello borrado es manipulación, no una línea heredada.

**T02 — baseline de findings de seguridad**

- [x] **AC5:** GIVEN un hallazgo ya registrado en el baseline, WHEN se escanea, THEN no falla.
- [x] **AC6 (error):** GIVEN un hallazgo ausente del baseline, WHEN se escanea, THEN exit 1.
- [x] **AC7 (edge):** GIVEN una entrada del baseline sin hallazgo real, WHEN se escanea, THEN
      exit 1: las entradas muertas ocultan cobertura.

**T03 — commit atómico con receipt revalidado**

- [x] **AC8:** GIVEN un receipt aprobado y el árbol sin cambios, WHEN se pide el commit atómico,
      THEN revalida y commitea en una sola invocación.
- [x] **AC9 (error):** GIVEN el árbol cambió tras escribir el receipt, WHEN se pide el commit,
      THEN aborta sin commitear y explica qué cambió.

**T04 — microtests de wording crítico**

- [x] **AC10:** THE SYSTEM SHALL fallar si una frase de límite honesto desaparece o se debilita en
      `README.md`, `SKILL.md` o `SECURITY.md`.

---

## Constraints / Restricciones

- Node nativo, cero dependencias nuevas, ninguna llamada de red en ningún gate.
- Ningún gate cambia el default de otro: se agregan o se activan por flag, así revertir es un
  `git revert` de un commit.
- Compatibilidad con las líneas de `AUDIT.md` ya escritas.

---

## Non-Goals / No-Goals

This spec does NOT cover:
- Cerrar la ventana entre validar y escribir: haría falta un lock o firma externa. Se angosta.
- Resistir a quien controle el disco y recalcule la cadena, borre los sellos enteros o recorte el
  final. Los tres exigen un ancla fuera del archivo; quedan declarados.
- Probar suficiencia semántica: los gates prueban forma, cadena y estado.

---

## Stack & Dependencies

- **Stack:** Node v24.13.1 nativo, sin manifiesto de paquetes
- **Test runner:** `node --test` + `--experimental-test-coverage`
- **New dependencies:** none

---

> Marcado 2026-08-29. Procedencia y límites: `.vibe/DECISIONS.md`.

## Definition of Done (DoD)

- [x] Forcing Questions: 6/6
- [x] Cada AC con test
- [x] Cobertura 100% (líneas/ramas/funciones)
- [x] CHANGELOG
- [x] `.vibe/` al día
