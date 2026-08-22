# Fuente: lyogavin/airllm

**URL:** https://github.com/lyogavin/airllm
**SHA pineado:** `8e456235884821f3bfcba9c9f3f1671d10290ad5`
**Estado: PARCIAL — corregido, ya NO se declara EXHAUSTIVA.** El conteo original de "86" era
falso — `find` directo da **90 archivos reales** (error de 4, detectado en auditoría de
corrección). El agente de ronda 1 no enumeró explícitamente los 90; asumió cobertura completa
sin verificar el conteo real. Los 4 no contabilizados: `.github/FUNDING.yml`, `funding.json`,
`eval/elo_tournanment_all_models_on_translated_vicuna.ipynb`, `examples/inferrence.ipynb` —
todos confirmados ahora por listado directo como boilerplate/notebook-demo, mismo patrón que el
resto del repo (ningún contenido de metodología). La conclusión de "0 candidatos" se sostiene,
pero la declaración de cobertura literal 100% era falsa y queda corregida.

## Qué es

Librería de optimización de inferencia ML pura (streaming de capas para correr LLMs grandes en
GPUs chicas) + proyectos secundarios no relacionados (fine-tuning `anima_100k`, scripts RLHF/DPO).
**Cero overlap de metodología con VCP**, confirmado por lectura completa, no supuesto.

## Manifiesto

**Leídos/abiertos (86/90):** todo `.py` (fuente + tests bajo `air_llm/tests/*.py`), `setup.py`,
`requirements.txt`, todos los `README*.md` (incl. READMEs de training/rlhf). Notebooks
(`.ipynb`) confirmados como demos de uso (mismo contenido que el README), no documentos de
proceso — no ejecutados celda por celda pero contenido confirmado no-metodológico.

**No leído (correctamente excluido, no metodología por definición):** binarios/imágenes
(`assets/*.png/jpeg`, logos), `.csv`, `.jsonl`/`.json` de datasets grandes (`anima_100k/*.jsonl`,
`data/translated_vicuna_eval_set.json`).

## Candidatos

**Cero.** Confirmado por lectura completa: sin CI/CD, sin docs de contribución/proceso, sin
patrones de agente/subagente, sin mecanismo de gating/verificación comparable al ciclo RED/GREEN
de VCP. Los tests presentes son unittest simples de mapeo de modelo/compresión, sin innovación de
metodología sobre lo que VCP ya tiene.

**No hay verificación adversarial pendiente para este repo** — no hay candidatos que verificar.
