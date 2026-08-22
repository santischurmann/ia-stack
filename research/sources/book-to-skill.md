# Fuente: virgiliojr94/book-to-skill

**URL:** https://github.com/virgiliojr94/book-to-skill
**SHA pineado:** `3a97a7115ab3c82edf47f315b544fbcefdd8559c`
**Estado: PARCIAL — total corregido.** El conteo original de "51 archivos" era falso — `find`
directo sobre el clone da **85 archivos reales** (error de 34, no detectado hasta esta auditoría
de corrección). ~19 archivos con lectura completa (15 ronda 1 + 2 completos + `validate_skill.py`/
`utils.py` en ronda 2), 24 test files confirmados por nombre+docstring (no cuerpo completo), resto
(~42 archivos: parsers de formato, `docs/assets/*` binarios, workflows CI, `.github/`
scaffolding) sin leer — parcialmente justificado por spot-check, no archivo por archivo.

## Qué es

Herramienta chica (51 archivos) de conversión libro→skill (parsing PDF/EPUB/DOCX, detección de
estructura de capítulos). Dominio distinto al de VCP — pocos candidatos honestos, sin relleno.

## Manifiesto

**Leídos completos:** `SKILL.md`/`README.md`/`architecture.md`/`how-it-works.md`,
`sanitize.py`, `scan_generated_skill.py`, `discovery_tax.py`, `tools/validate_skill.py`
(ronda 2), `book_to_skill/utils.py` (ronda 2, función `estimate_tokens` completa).
**24 test files** confirmados por nombre+clase/docstring en ronda 2 (no cuerpo completo) — lista
completa: `test_batch_resilience_unreadable.py`, `test_book_to_skill.py`,
`test_chapter_method_reported.py`, `test_cjk_supplementary_plane.py`, `test_discovery_tax.py`,
`test_epub_image_reporting.py`, `test_html_block_boundaries.py`,
`test_html_boilerplate_extraction.py`, `test_intro_and_support_note.py`,
`test_isolated_install_hint.py`, `test_metadata_encoding.py`, `test_multi_source_toc.py`,
`test_numbered_headings.py`, `test_output_dir_security.py`,
`test_pdftotext_edge_only_boilerplate.py`, `test_pdf_page_number_detection.py`,
`test_publish_visibility_gate.py`, `test_repo_hygiene.py`, `test_rtf_destination_groups.py`,
`test_sanitize_bidi_controls.py`, `test_sanitize_extracted_text.py`, `test_scan_coverage.py`,
`test_scan_generated_skill.py`, `test_tilde_expansion.py`, `test_tool_call_token_vs_prose.py`,
`test_unbalanced_code_fence.py`.

**Excluido (confirmado, no solo inferido):** parsers específicos de formato (pdf.py/epub.py/
docx.py/rtf.py/html.py/calibre.py/text.py — lógica de extracción, sin contenido de proceso),
`dependencies.py`/`config.py`/`cli.py`/`exceptions.py` (plumbing), scaffolding de repo.

## Candidatos (evidencia real, ronda 1 + ronda 2)

1. **Sanitización de Unicode invisible / inyección en texto ingresado** — `sanitize.py:1-97`,
   `scan_generated_skill.py:1-98`. **Score inicial: 4.**
2. **Validador multi-lente de compatibilidad de SKILL.md** — `tools/validate_skill.py:56-85`
   (dict `LENSES` para claude/copilot/amp). Lint de frontmatter contra reglas por-host de 3
   runtimes distintos, separa ERROR (rompe el skill en ese host) de WARN (solo guía). **Nuevo,
   ronda 2 — Score inicial: 5.**
3. **Scan advisory de output generado por inyección/exfiltración** —
   `tests/test_scan_generated_skill.py:97,129,150` (flags de claims de autoridad de prompt,
   Unicode oculto, tokens de control de modelo, patrones de exfiltración; nunca hace echo del
   texto atacante detectado). **Nuevo, ronda 2 — Score inicial: 4.** Aplicable directo: si las
   fases de VCP producen artefactos que una fase posterior vuelve a consumir (specs, `.vibe/`),
   un scan de "qué acabamos de generar antes de confiar en él" cierra un gap real.
4. **Gate de estimación de costo/tokens pre-generación** — `SKILL.md` Step 2.5. **Score
   inicial: 3.**
5. **Lectura acotada tipo REPL para archivos grandes** — `SKILL.md` Step 2.6. **Score inicial: 2**
   (higiene estándar, no distintiva).
6. **Estimador de tokens CJK-aware** — `book_to_skill/utils.py:80-96`. **Score inicial: 0** — no
   transferible (detalle de implementación de extracción PDF/EPUB, no práctica de VCP).

**Pendiente de verificación adversarial independiente** — ver workflow `wf_d9e7e4ef-67c`.
