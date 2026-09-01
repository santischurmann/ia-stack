# Síntesis funcional del corpus externo — 2026-09-01

Este informe resume **14.897** entradas PENDING verificadas 1:1: **14.710** procesadas con escaneo funcional determinista y **187** cerradas como artefactos opacos/estáticos.

> Importante: los grupos y “señales de adopción” son filtros lexicales respaldados por citas. No son una aprobación semántica automática ni una orden de copiar código externo.

## Cobertura por fuente

| Fuente | Entradas | Escaneo funcional | Estático | Señal lexical | DEFER |
|---|---:|---:|---:|---:|---:|
| AgriciDaniel/claude-obsidian | 192 | 192 | 0 | 143 | 49 |
| anthropics/claude-plugins-official | 441 | 439 | 2 | 317 | 124 |
| ComposioHQ/awesome-claude-skills | 1080 | 1080 | 0 | 937 | 143 |
| ConardLi/garden-skills | 586 | 585 | 1 | 147 | 439 |
| DietrichGebert/ponytail | 148 | 147 | 1 | 86 | 62 |
| garrytan/gstack | 1419 | 1418 | 1 | 1280 | 139 |
| google/googletest | 249 | 249 | 0 | 225 | 24 |
| K-Dense-AI/scientific-agent-skills | 2435 | 2271 | 164 | 1761 | 674 |
| marin-community/marin | 3530 | 3527 | 3 | 2209 | 1321 |
| msitarzewski/agency-agents | 339 | 339 | 0 | 335 | 4 |
| Panniantong/agent-reach | 104 | 104 | 0 | 87 | 17 |
| rohitg00/ai-engineering-from-scratch | 2982 | 2982 | 0 | 2380 | 602 |
| thedotmack/claude-mem | 1022 | 1011 | 11 | 770 | 252 |
| tt-a1i/archify | 370 | 366 | 4 | 335 | 35 |

## Señales adversariales agregadas

- **security_or_maintenance_risk_signal**: 4566
- **external_or_persistent_side_effect_signal**: 3673
- **sparse_semantic_surface**: 2991
- **claims_without_test_signal**: 1696
- **non_textual_or_opaque**: 187

## Capacidades que merecen priorización humana

### gates-and-evidence
- `marin-community/marin` — `experiments/datakit/scripts/verify_fuzzy_dups_testbed.py` (score lexical 22; citas: experiments/datakit/scripts/verify_fuzzy_dups_testbed.py:1, experiments/datakit/scripts/verify_fuzzy_dups_testbed.py:784, experiments/datakit/scripts/verify_fuzzy_dups_testbed.py:2, experiments/datakit/scripts/verify_fuzzy_dups_testbed.py:137)
- `marin-community/marin` — `infra/pulumi/iam_audit.py` (score lexical 22; citas: infra/pulumi/iam_audit.py:1, infra/pulumi/iam_audit.py:238, infra/pulumi/iam_audit.py:2, infra/pulumi/iam_audit.py:3)
- `garrytan/gstack` — `lib/code-intelligence/contract.ts` (score lexical 22; citas: lib/code-intelligence/contract.ts:1, lib/code-intelligence/contract.ts:201, lib/code-intelligence/contract.ts:164, lib/code-intelligence/contract.ts:178)
- `garrytan/gstack` — `lib/egress-receipt.ts` (score lexical 22; citas: lib/egress-receipt.ts:1, lib/egress-receipt.ts:392, lib/egress-receipt.ts:104, lib/egress-receipt.ts:110)
- `marin-community/marin` — `lib/finelog/rust/src/query/exact_aggregate.rs` (score lexical 22; citas: lib/finelog/rust/src/query/exact_aggregate.rs:1, lib/finelog/rust/src/query/exact_aggregate.rs:1149, lib/finelog/rust/src/query/exact_aggregate.rs:84, lib/finelog/rust/src/query/exact_aggregate.rs:98)
### orchestration-and-agents
- `Panniantong/agent-reach` — `agent_reach/cli.py` (score lexical 22; citas: agent_reach/cli.py:1, agent_reach/cli.py:2350, agent_reach/cli.py:20, agent_reach/cli.py:251)
- `tt-a1i/archify` — `archify/renderers/workflow/render-workflow.mjs` (score lexical 22; citas: archify/renderers/workflow/render-workflow.mjs:1, archify/renderers/workflow/render-workflow.mjs:749, archify/renderers/workflow/render-workflow.mjs:69, archify/renderers/workflow/render-workflow.mjs:80)
- `DietrichGebert/ponytail` — `benchmarks/agentic/run.py` (score lexical 22; citas: benchmarks/agentic/run.py:1, benchmarks/agentic/run.py:471, benchmarks/agentic/run.py:44, benchmarks/agentic/run.py:45)
- `DietrichGebert/ponytail` — `benchmarks/agentic/tasks.py` (score lexical 22; citas: benchmarks/agentic/tasks.py:1, benchmarks/agentic/tasks.py:968, benchmarks/agentic/tasks.py:26, benchmarks/agentic/tasks.py:27)
- `garrytan/gstack` — `browse/src/terminal-agent-control.ts` (score lexical 22; citas: browse/src/terminal-agent-control.ts:1, browse/src/terminal-agent-control.ts:150, browse/src/terminal-agent-control.ts:30, browse/src/terminal-agent-control.ts:54)
### research-and-citations
- `marin-community/marin` — `experiments/datakit/reference_pipeline.py` (score lexical 22; citas: experiments/datakit/reference_pipeline.py:1, experiments/datakit/reference_pipeline.py:1131, experiments/datakit/reference_pipeline.py:2, experiments/datakit/reference_pipeline.py:186)
- `garrytan/gstack` — `hosts/claude/hooks/question-preference-hook.ts` (score lexical 22; citas: hosts/claude/hooks/question-preference-hook.ts:1, hosts/claude/hooks/question-preference-hook.ts:506, hosts/claude/hooks/question-preference-hook.ts:68, hosts/claude/hooks/question-preference-hook.ts:76)
- `marin-community/marin` — `infra/grafana/src/iris_source.py` (score lexical 22; citas: infra/grafana/src/iris_source.py:1, infra/grafana/src/iris_source.py:185, infra/grafana/src/iris_source.py:2, infra/grafana/src/iris_source.py:32)
- `marin-community/marin` — `infra/grafana/src/k8s_source.py` (score lexical 22; citas: infra/grafana/src/k8s_source.py:1, infra/grafana/src/k8s_source.py:1274, infra/grafana/src/k8s_source.py:2, infra/grafana/src/k8s_source.py:55)
- `marin-community/marin` — `infra/grafana/src/wandb_source.py` (score lexical 22; citas: infra/grafana/src/wandb_source.py:1, infra/grafana/src/wandb_source.py:299, infra/grafana/src/wandb_source.py:2, infra/grafana/src/wandb_source.py:41)
### testing-and-quality
- `DietrichGebert/ponytail` — `benchmarks/agentic/run.py` (score lexical 22; citas: benchmarks/agentic/run.py:1, benchmarks/agentic/run.py:471, benchmarks/agentic/run.py:44, benchmarks/agentic/run.py:45)
- `DietrichGebert/ponytail` — `benchmarks/agentic/tasks.py` (score lexical 22; citas: benchmarks/agentic/tasks.py:1, benchmarks/agentic/tasks.py:968, benchmarks/agentic/tasks.py:26, benchmarks/agentic/tasks.py:27)
- `ComposioHQ/awesome-claude-skills` — `document-skills/pdf/scripts/check_bounding_boxes_test.py` (score lexical 22; citas: document-skills/pdf/scripts/check_bounding_boxes_test.py:1, document-skills/pdf/scripts/check_bounding_boxes_test.py:226, document-skills/pdf/scripts/check_bounding_boxes_test.py:7, document-skills/pdf/scripts/check_bounding_boxes_test.py:10)
- `marin-community/marin` — `experiments/benchmarks/fa4/tile_sweep.py` (score lexical 22; citas: experiments/benchmarks/fa4/tile_sweep.py:1, experiments/benchmarks/fa4/tile_sweep.py:325, experiments/benchmarks/fa4/tile_sweep.py:2, experiments/benchmarks/fa4/tile_sweep.py:55)
- `marin-community/marin` — `experiments/datakit/cluster/quality/fast_transformer/train.py` (score lexical 22; citas: experiments/datakit/cluster/quality/fast_transformer/train.py:1, experiments/datakit/cluster/quality/fast_transformer/train.py:349, experiments/datakit/cluster/quality/fast_transformer/train.py:2, experiments/datakit/cluster/quality/fast_transformer/train.py:44)
### memory-and-learning
- `garrytan/gstack` — `bin/gstack-brain-context-load.ts` (score lexical 22; citas: bin/gstack-brain-context-load.ts:1, bin/gstack-brain-context-load.ts:482, bin/gstack-brain-context-load.ts:78, bin/gstack-brain-context-load.ts:97)
- `garrytan/gstack` — `bin/gstack-memory-ingest.ts` (score lexical 22; citas: bin/gstack-memory-ingest.ts:1, bin/gstack-memory-ingest.ts:2447, bin/gstack-memory-ingest.ts:202, bin/gstack-memory-ingest.ts:226)
- `rohitg00/ai-engineering-from-scratch` — `certifications/claude/lessons/02-model-selection-and-token-economics/code/main.py` (score lexical 22; citas: certifications/claude/lessons/02-model-selection-and-token-economics/code/main.py:1, certifications/claude/lessons/02-model-selection-and-token-economics/code/main.py:338, certifications/claude/lessons/02-model-selection-and-token-economics/code/main.py:22, certifications/claude/lessons/02-model-selection-and-token-economics/code/main.py:60)
- `rohitg00/ai-engineering-from-scratch` — `certifications/claude/lessons/08-messages-api-and-application-lifecycle/code/main.py` (score lexical 22; citas: certifications/claude/lessons/08-messages-api-and-application-lifecycle/code/main.py:1, certifications/claude/lessons/08-messages-api-and-application-lifecycle/code/main.py:367, certifications/claude/lessons/08-messages-api-and-application-lifecycle/code/main.py:40, certifications/claude/lessons/08-messages-api-and-application-lifecycle/code/main.py:60)
- `rohitg00/ai-engineering-from-scratch` — `certifications/claude/lessons/13-application-security-and-secrets/code/main.py` (score lexical 22; citas: certifications/claude/lessons/13-application-security-and-secrets/code/main.py:1, certifications/claude/lessons/13-application-security-and-secrets/code/main.py:126, certifications/claude/lessons/13-application-security-and-secrets/code/main.py:40, certifications/claude/lessons/13-application-security-and-secrets/code/main.py:44)
### security-and-boundaries
- `garrytan/gstack` — `browse/src/file-permissions.ts` (score lexical 22; citas: browse/src/file-permissions.ts:1, browse/src/file-permissions.ts:244, browse/src/file-permissions.ts:53, browse/src/file-permissions.ts:85)
- `garrytan/gstack` — `browse/src/security.ts` (score lexical 22; citas: browse/src/security.ts:1, browse/src/security.ts:328, browse/src/security.ts:124, browse/src/security.ts:148)
- `garrytan/gstack` — `browse/src/token-registry.ts` (score lexical 22; citas: browse/src/token-registry.ts:1, browse/src/token-registry.ts:719, browse/src/token-registry.ts:109, browse/src/token-registry.ts:130)
- `rohitg00/ai-engineering-from-scratch` — `certifications/claude/lessons/02-model-selection-and-token-economics/code/main.py` (score lexical 22; citas: certifications/claude/lessons/02-model-selection-and-token-economics/code/main.py:1, certifications/claude/lessons/02-model-selection-and-token-economics/code/main.py:338, certifications/claude/lessons/02-model-selection-and-token-economics/code/main.py:22, certifications/claude/lessons/02-model-selection-and-token-economics/code/main.py:60)
- `rohitg00/ai-engineering-from-scratch` — `certifications/claude/lessons/13-application-security-and-secrets/code/main.py` (score lexical 22; citas: certifications/claude/lessons/13-application-security-and-secrets/code/main.py:1, certifications/claude/lessons/13-application-security-and-secrets/code/main.py:126, certifications/claude/lessons/13-application-security-and-secrets/code/main.py:40, certifications/claude/lessons/13-application-security-and-secrets/code/main.py:44)
### graph-and-backup
- `AgriciDaniel/claude-obsidian` — `claude_obsidian/capture.py` (score lexical 22; citas: claude_obsidian/capture.py:1, claude_obsidian/capture.py:2231, claude_obsidian/capture.py:63, claude_obsidian/capture.py:64)
- `AgriciDaniel/claude-obsidian` — `claude_obsidian/checkpoint.py` (score lexical 22; citas: claude_obsidian/checkpoint.py:1, claude_obsidian/checkpoint.py:1385, claude_obsidian/checkpoint.py:62, claude_obsidian/checkpoint.py:69)
- `AgriciDaniel/claude-obsidian` — `claude_obsidian/cli.py` (score lexical 22; citas: claude_obsidian/cli.py:1, claude_obsidian/cli.py:1274, claude_obsidian/cli.py:61, claude_obsidian/cli.py:72)
- `AgriciDaniel/claude-obsidian` — `claude_obsidian/legacy_lock.py` (score lexical 22; citas: claude_obsidian/legacy_lock.py:1, claude_obsidian/legacy_lock.py:689, claude_obsidian/legacy_lock.py:64, claude_obsidian/legacy_lock.py:76)
- `AgriciDaniel/claude-obsidian` — `claude_obsidian/lint_engine.py` (score lexical 22; citas: claude_obsidian/lint_engine.py:1, claude_obsidian/lint_engine.py:1279, claude_obsidian/lint_engine.py:50, claude_obsidian/lint_engine.py:51)
### product-and-communication
- `garrytan/gstack` — `design/src/compare.ts` (score lexical 22; citas: design/src/compare.ts:1, design/src/compare.ts:639, design/src/compare.ts:20, design/src/compare.ts:401)
- `garrytan/gstack` — `design/src/daemon-client.ts` (score lexical 22; citas: design/src/daemon-client.ts:1, design/src/daemon-client.ts:419, design/src/daemon-client.ts:77, design/src/daemon-client.ts:89)
- `garrytan/gstack` — `design/src/daemon-state.ts` (score lexical 22; citas: design/src/daemon-state.ts:1, design/src/daemon-state.ts:220, design/src/daemon-state.ts:29, design/src/daemon-state.ts:46)
- `garrytan/gstack` — `design/src/daemon.ts` (score lexical 22; citas: design/src/daemon.ts:1, design/src/daemon.ts:582, design/src/daemon.ts:92, design/src/daemon.ts:102)
- `rohitg00/ai-engineering-from-scratch` — `phases/11-llm-engineering/13-production-app/code/production_app.py` (score lexical 22; citas: phases/11-llm-engineering/13-production-app/code/production_app.py:1, phases/11-llm-engineering/13-production-app/code/production_app.py:713, phases/11-llm-engineering/13-production-app/code/production_app.py:23, phases/11-llm-engineering/13-production-app/code/production_app.py:74)

## Regla de uso

Cada candidato útil debe entrar en un ciclo VCP propio: SPEC → PLAN → 🔵 elección → RED → BUILD → TRIANGULATE → VERIFY → seguridad → receipt → 🔵 publicación. El presente informe no salta ningún gate.

Huella del insumo: `91645dca4a275f037083c75f8c53c7731246c679176a83e1b93aae2dce09e924`.
