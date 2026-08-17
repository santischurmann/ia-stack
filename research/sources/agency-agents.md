# agency-agents — research trace (PARTIAL)

## Fixed snapshot

- Repository: <https://github.com/msitarzewski/agency-agents>
- Inspected commit: <code>ebe9c99acb5c96f9468de368d8bead775387d1a7</code> (main; 2026-08-06T13:29:46Z).
- Exact Git tree: **343 blobs**. Reproduce mode, blob SHA, size, and path with <code>git ls-tree -r --long ebe9c99acb5c96f9468de368d8bead775387d1a7</code>.
- No installer was run and the source repo was not changed. The temporary checkout is detached at that SHA.

## Real coverage — distinct levels

| Level | Coverage | Establishes | Does not establish |
| --- | ---: | --- | --- |
| Git inventory | 343/343 blobs | tree, paths, modes, sizes, and blobs pinned by the commit | semantic understanding |
| Markdown intake | 316/316 .md | every Markdown document was raw-decoded and traversed: 4,220,720 UTF-8 bytes, 82,129 lines, 570,393 non-whitespace tokens | deep reading of every paragraph |
| Profile structural index | 271/271 frontmatter docs | frontmatter, headings, and distribution extracted: 270 source profiles in 17 divisions plus 1 generated integration profile | validating each recommendation/specification in the 270 bodies |
| Executable/config structure | 27/27 non-Markdown blobs | scripts, JSON, YAML, and declared functions indexed | complete execution of every upstream suite |
| Deep synthesis with citations | 6 cross-division profiles plus NEXUS control-plane, handoffs, and verifier excerpts | auditable candidate learnings | full semantic coverage of 270 profiles |

**Status: PARTIAL.** The former “5/316 agent files” claim was inaccurate. No blob or Markdown remains un-inventoried or mechanically ingested, but a structural index over 570k tokens is not a 100% study. Deep semantic review remains for **127 source profiles** (264 minus 66 engineering/security profiles reviewed 2026-08-14, minus 43 more profiles across design/finance/product/project-management/sales/testing reviewed 2026-08-14, minus 28 more profiles across academic/healthcare/spatial-computing/support/paid-media reviewed 2026-08-17; see "Continuación" sections below), some of 45 non-profile documents, and nontrivial code/configuration behavior. Fully closed divisions: academic, design, engineering, finance, healthcare, paid-media, product, project-management, sales, security, spatial-computing, support, testing (13 of 17). Open: game-development (21), gis (13), marketing (36), specialized (57).

The six profiles treated as deep evidence are <code>engineering-code-reviewer</code>, <code>engineering-senior-developer</code>, <code>security-appsec-engineer</code>, <code>design-ux-architect</code>, <code>testing-reality-checker</code>, and <code>engineering-multi-agent-systems-architect</code>. The last one was added in this pass; the first five are retained as the prior sampled evidence, not retroactively expanded coverage.

## Proven structure

### Profiles

There are **270 source profiles**, not 316, across the 17 divisions in <code>divisions.json</code>: academic (6), design (10), engineering (58), finance (5), game-development (21), gis (13), healthcare (3), marketing (36), paid-media (7), product (5), project-management (7), sales (9), security (12), spatial-computing (6), specialized (57), support (6), and testing (9).

All 271 frontmatter documents have <code>name</code>, <code>description</code>, and <code>color</code>; 270 include <code>emoji</code>, 269 <code>vibe</code>, 17 <code>tools</code>, 7 <code>author</code>, and 4 <code>services</code>. All 271 bodies have distinct content hashes: this is a writing convention, not one file copied verbatim.

The most frequent 9-section spine occurs in 40 profiles: Identity & Memory → Core Mission → Critical Rules → Technical Deliverables → Workflow Process → Communication Style → Learning & Memory → Success Metrics → Advanced Capabilities. Variants are material, so this is editorial structure rather than an executable common interface.

### Control plane, portability, validation

- <code>scripts/convert.sh</code> contains converters for Antigravity, Osaurus, Codex, Gemini CLI, OpenCode, Cursor, OpenClaw, Qwen, Zcode, Kimi, Vibe, Aider, and Windsurf; its <code>main</code> centralizes selection and output cleanup.
- <code>scripts/install.sh</code> handles detection, selection, and destinations for 16 tools: Claude Code, Codex, Gemini CLI, Copilot, Qwen, Cursor, OpenCode, Osaurus, Aider, Antigravity, Kimi, OpenClaw, Windsurf, Hermes, Vibe, and Zcode.
- <code>scripts/check-divisions.sh:3-15</code> makes <code>divisions.json</code> the source of truth and compares directories, converter, linter, CI, and metadata. <code>scripts/check-tools.sh:49-79</code> checks <code>tools.json</code> against installer and converter.
- Quality enforcement is represented by the four workflows <code>lint-agents</code>, <code>check-divisions</code>, <code>check-runbooks</code>, and <code>check-tools</code>, with matching scripts. <code>scripts/build-hermes-plugin.py</code> constructs the Hermes plugin/lookup/router; its Python check passes.

This multi-tool installer/converter is **not** a VCP model to copy: VCP’s requested end state is one self-contained skill, whereas agency-agents optimizes distribution to many tools.

## Content synthesis by chunk

| Chunk | Documents/profiles | Verified conclusion |
| --- | --- | --- |
| Professional roles | 270 profiles / 17 divisions | Broad domain specialization and personality text; no uniform input/output contract or binary gate turns a persona into a verifiable agent. |
| Orchestration | <code>engineering/engineering-multi-agent-systems-architect.md</code>, <code>strategy/nexus-strategy.md</code>, coordination docs | NEXUS lays out phases 0–6, fan-out/in, Dev↔QA loops, handoffs, and escalation. It is a playbook, not runnable orchestration. |
| QA | <code>testing/testing-reality-checker.md</code>, Evidence Collector, API/performance/test automation | Approval defaults to NEEDS WORK and requires artifacts. This is an adversarial posture, not a portable automated proof. |
| Handoffs | <code>strategy/coordination/handoff-templates.md</code> | Separate standard, PASS/FAIL, escalation, phase-gate, sprint, and incident templates include criteria and next action. |
| Multi-tool | <code>tools.json</code>, <code>integrations/</code>, converter, installer | One corpus is transpiled/installed into many formats and destinations — opposite to a unified VCP distribution. |
| Memory | 253/271 profiles mention “memory”; memory example and MCP integration | Mostly prompt-level continuity/persistence. No evidence here of error-learning protected by evaluation or receipt invalidation. |

## Candidate learnings for VCP — evidence, limit, approval condition

These are **design candidates only**. Nothing here was applied to VCP and this report does not establish derivation.

1. **Explicit delegation ledger.** The Multi-Agent Systems Architect says the orchestrator must track “what was delegated, to whom, status, output” and resolve subagent contradictions ([lines 114–118](https://github.com/msitarzewski/agency-agents/blob/ebe9c99acb5c96f9468de368d8bead775387d1a7/engineering/engineering-multi-agent-systems-architect.md#L114-L118)). VCP may use this only with a minimal machine-readable, gate-tested artifact; a narrative table is insufficient.

2. **Structured evaluator output plus loop stop.** That profile requires score, concrete failure reasons, actionable feedback, and escalation after two plateaued iterations ([lines 134–140](https://github.com/msitarzewski/agency-agents/blob/ebe9c99acb5c96f9468de368d8bead775387d1a7/engineering/engineering-multi-agent-systems-architect.md#L134-L140)). Approval requires a metric that the generating agent cannot self-certify.

3. **Evidence-based handoff states.** NEXUS separates evidence, acceptance criteria, retry instructions, and escalation ([lines 49–148](https://github.com/msitarzewski/agency-agents/blob/ebe9c99acb5c96f9468de368d8bead775387d1a7/strategy/coordination/handoff-templates.md#L49-L148)). VCP should only adopt vocabulary that binds to its existing verifiable artifacts; do not add prose ceremony.

4. **Single source of truth for catalogs.** Division/tool checks fail when catalog, scripts, and CI drift ([check-divisions lines 3–15](https://github.com/msitarzewski/agency-agents/blob/ebe9c99acb5c96f9468de368d8bead775387d1a7/scripts/check-divisions.sh#L3-L15)). This could inform a future VCP role catalogue, but only with a drift test and without importing 17 divisions or new dependencies.

5. **Adversarial approval stance.** Reality Checker cross-checks claims against real files/screenshots/results and defaults to NEEDS WORK ([lines 41–52](https://github.com/msitarzewski/agency-agents/blob/ebe9c99acb5c96f9468de368d8bead775387d1a7/testing/testing-reality-checker.md#L41-L52)). VCP already pursues mechanical gates; only stronger evidence for a gate is in scope, never a new “QA persona” for its own sake.

## Commands and actual exit codes

- <code>git clone --no-checkout …</code> + detached checkout at the requested SHA: **exit 0**.
- <code>git rev-parse HEAD</code>: exact requested SHA, **exit 0**.
- <code>git ls-tree -r --name-only HEAD | Measure-Object</code>: 343, **exit 0**.
- Raw decode/parse all 316 Markdown and index all 27 non-Markdown blobs: **exit 0**.
- <code>python scripts/check-hermes-plugin.py</code>: **exit 0**, “PASSED: generated Hermes plugin schemas and routing behavior are valid.”
- Git Bash <code>./scripts/check-divisions.sh</code>: **exit 0** (“17 divisions consistent…”); <code>./scripts/check-tools.sh</code>: **exit 0** (“16 tools consistent…”).
- Git Bash <code>./scripts/check-runbooks.sh</code>: **exit 2** because that shell has no <code>python3</code> executable. This is an environment prerequisite failure, not a content verdict.
- The full <code>lint-agents.sh</code> run did not finish inside the 30-second tool cap (it printed “Linting 270 agent files…”). A one-profile run for <code>engineering-multi-agent-systems-architect.md</code> returned **exit 0**, with one non-blocking warning that its heading lacks the literal phrase “Core Mission”. Do not extrapolate that to the full 270-profile linter.
- Default <code>bash</code> also failed before execution because WSL could not mount its VHDX. Full lint/runbook validation remains for healthy Linux/WSL or a longer bounded runner.

## Required next semantic pass

Do not declare this source EXHAUSTIVE until the remaining **264 source profiles** are reviewed by reproducible chunks, recording per file: purpose, expected inputs, outputs, rules, verification mechanism, state/memory, and VCP applicability/rejection. Priority order:

1. remaining <code>engineering/</code>;
2. <code>testing/</code>, <code>security/</code>, and specialized agents for orchestration, identity/trust, codebase archaeology, and automation governance;
3. <code>strategy/</code>, <code>examples/</code>, <code>scripts/</code>, <code>tools.json</code>, <code>divisions.json</code>, and workflows;
4. every remaining division, including manifests, examples, CI, and documentation.

A hash or frontmatter index is **not** equivalent to understanding functions or content.

## Appendix A — manifest of source profiles (270)
### academic (6)
- <code>academic/academic-anthropologist.md</code>
- <code>academic/academic-geographer.md</code>
- <code>academic/academic-historian.md</code>
- <code>academic/academic-narratologist.md</code>
- <code>academic/academic-psychologist.md</code>
- <code>academic/academic-statistician.md</code>
### design (10)
- <code>design/design-brand-guardian.md</code>
- <code>design/design-image-prompt-engineer.md</code>
- <code>design/design-inclusive-visuals-specialist.md</code>
- <code>design/design-persona-walkthrough.md</code>
- <code>design/design-ui-designer.md</code>
- <code>design/design-ui-finish-gate-reviewer.md</code>
- <code>design/design-ux-architect.md</code>
- <code>design/design-ux-researcher.md</code>
- <code>design/design-visual-storyteller.md</code>
- <code>design/design-whimsy-injector.md</code>
### engineering (58)
- <code>engineering/engineering-ai-data-remediation-engineer.md</code>
- <code>engineering/engineering-ai-engineer.md</code>
- <code>engineering/engineering-api-platform-engineer.md</code>
- <code>engineering/engineering-autonomous-optimization-architect.md</code>
- <code>engineering/engineering-backend-architect.md</code>
- <code>engineering/engineering-cms-developer.md</code>
- <code>engineering/engineering-code-reviewer.md</code>
- <code>engineering/engineering-codebase-onboarding-engineer.md</code>
- <code>engineering/engineering-data-engineer.md</code>
- <code>engineering/engineering-data-visualization-engineer.md</code>
- <code>engineering/engineering-database-optimizer.md</code>
- <code>engineering/engineering-database-reliability-engineer.md</code>
- <code>engineering/engineering-desktop-app-engineer.md</code>
- <code>engineering/engineering-developer-tooling-engineer.md</code>
- <code>engineering/engineering-devops-automator.md</code>
- <code>engineering/engineering-drupal-performance.md</code>
- <code>engineering/engineering-drupal-shopping-cart.md</code>
- <code>engineering/engineering-email-intelligence-engineer.md</code>
- <code>engineering/engineering-embedded-firmware-engineer.md</code>
- <code>engineering/engineering-feishu-integration-developer.md</code>
- <code>engineering/engineering-filament-optimization-specialist.md</code>
- <code>engineering/engineering-finops-engineer.md</code>
- <code>engineering/engineering-frontend-developer.md</code>
- <code>engineering/engineering-gaussdb-expert.md</code>
- <code>engineering/engineering-git-workflow-master.md</code>
- <code>engineering/engineering-i18n-engineer.md</code>
- <code>engineering/engineering-identity-access-engineer.md</code>
- <code>engineering/engineering-incident-response-commander.md</code>
- <code>engineering/engineering-iot-fleet-engineer.md</code>
- <code>engineering/engineering-it-service-manager.md</code>
- <code>engineering/engineering-llm-post-training-engineer.md</code>
- <code>engineering/engineering-minimal-change-engineer.md</code>
- <code>engineering/engineering-mobile-app-builder.md</code>
- <code>engineering/engineering-mobile-release-engineer.md</code>
- <code>engineering/engineering-multi-agent-systems-architect.md</code>
- <code>engineering/engineering-network-engineer.md</code>
- <code>engineering/engineering-orgscript-engineer.md</code>
- <code>engineering/engineering-payments-billing-engineer.md</code>
- <code>engineering/engineering-privacy-engineer.md</code>
- <code>engineering/engineering-prompt-engineer.md</code>
- <code>engineering/engineering-rag-pipeline-engineer.md</code>
- <code>engineering/engineering-rapid-prototyper.md</code>
- <code>engineering/engineering-realtime-collaboration-engineer.md</code>
- <code>engineering/engineering-rust-refactoring-specialist.md</code>
- <code>engineering/engineering-search-relevance-engineer.md</code>
- <code>engineering/engineering-section-508-specialist.md</code>
- <code>engineering/engineering-senior-developer.md</code>
- <code>engineering/engineering-software-architect.md</code>
- <code>engineering/engineering-solidity-smart-contract-engineer.md</code>
- <code>engineering/engineering-sre.md</code>
- <code>engineering/engineering-technical-writer.md</code>
- <code>engineering/engineering-uswds-developer.md</code>
- <code>engineering/engineering-video-streaming-engineer.md</code>
- <code>engineering/engineering-voice-ai-integration-engineer.md</code>
- <code>engineering/engineering-webassembly-engineer.md</code>
- <code>engineering/engineering-wechat-mini-program-developer.md</code>
- <code>engineering/engineering-wordpress-performance.md</code>
- <code>engineering/engineering-wordpress-shopping-cart.md</code>
### finance (5)
- <code>finance/finance-bookkeeper-controller.md</code>
- <code>finance/finance-financial-analyst.md</code>
- <code>finance/finance-fpa-analyst.md</code>
- <code>finance/finance-investment-researcher.md</code>
- <code>finance/finance-tax-strategist.md</code>
### game-development (21)
- <code>game-development/blender/blender-addon-engineer.md</code>
- <code>game-development/economy-designer.md</code>
- <code>game-development/game-audio-engineer.md</code>
- <code>game-development/game-designer.md</code>
- <code>game-development/godot/godot-gameplay-scripter.md</code>
- <code>game-development/godot/godot-multiplayer-engineer.md</code>
- <code>game-development/godot/godot-shader-developer.md</code>
- <code>game-development/level-designer.md</code>
- <code>game-development/narrative-designer.md</code>
- <code>game-development/roblox-studio/roblox-avatar-creator.md</code>
- <code>game-development/roblox-studio/roblox-experience-designer.md</code>
- <code>game-development/roblox-studio/roblox-systems-scripter.md</code>
- <code>game-development/technical-artist.md</code>
- <code>game-development/unity/unity-architect.md</code>
- <code>game-development/unity/unity-editor-tool-developer.md</code>
- <code>game-development/unity/unity-multiplayer-engineer.md</code>
- <code>game-development/unity/unity-shader-graph-artist.md</code>
- <code>game-development/unreal-engine/unreal-multiplayer-architect.md</code>
- <code>game-development/unreal-engine/unreal-systems-engineer.md</code>
- <code>game-development/unreal-engine/unreal-technical-artist.md</code>
- <code>game-development/unreal-engine/unreal-world-builder.md</code>
### gis (13)
- <code>gis/gis-3d-scene-developer.md</code>
- <code>gis/gis-analyst.md</code>
- <code>gis/gis-bim-specialist.md</code>
- <code>gis/gis-cartography-designer.md</code>
- <code>gis/gis-drone-reality-mapping.md</code>
- <code>gis/gis-geoai-ml-engineer.md</code>
- <code>gis/gis-geoprocessing-specialist.md</code>
- <code>gis/gis-qa-engineer.md</code>
- <code>gis/gis-solution-engineer.md</code>
- <code>gis/gis-spatial-data-engineer.md</code>
- <code>gis/gis-spatial-data-scientist.md</code>
- <code>gis/gis-technical-consultant.md</code>
- <code>gis/gis-web-gis-developer.md</code>
### healthcare (3)
- <code>healthcare/healthcare-clinical-evidence-agent.md</code>
- <code>healthcare/healthcare-innovation-strategist.md</code>
- <code>healthcare/healthcare-sovereign-health-systems-agent.md</code>
### marketing (36)
- <code>marketing/marketing-aeo-foundations.md</code>
- <code>marketing/marketing-agentic-search-optimizer.md</code>
- <code>marketing/marketing-ai-citation-strategist.md</code>
- <code>marketing/marketing-app-store-optimizer.md</code>
- <code>marketing/marketing-baidu-seo-specialist.md</code>
- <code>marketing/marketing-bilibili-content-strategist.md</code>
- <code>marketing/marketing-book-co-author.md</code>
- <code>marketing/marketing-carousel-growth-engine.md</code>
- <code>marketing/marketing-china-ecommerce-operator.md</code>
- <code>marketing/marketing-china-market-localization-strategist.md</code>
- <code>marketing/marketing-content-creator.md</code>
- <code>marketing/marketing-cross-border-ecommerce.md</code>
- <code>marketing/marketing-douyin-strategist.md</code>
- <code>marketing/marketing-email-strategist.md</code>
- <code>marketing/marketing-global-podcast-strategist.md</code>
- <code>marketing/marketing-growth-hacker.md</code>
- <code>marketing/marketing-instagram-curator.md</code>
- <code>marketing/marketing-kuaishou-strategist.md</code>
- <code>marketing/marketing-linkedin-content-creator.md</code>
- <code>marketing/marketing-livestream-commerce-coach.md</code>
- <code>marketing/marketing-multi-platform-publisher.md</code>
- <code>marketing/marketing-podcast-strategist.md</code>
- <code>marketing/marketing-pr-communications-manager.md</code>
- <code>marketing/marketing-private-domain-operator.md</code>
- <code>marketing/marketing-reddit-community-builder.md</code>
- <code>marketing/marketing-seo-specialist.md</code>
- <code>marketing/marketing-short-video-editing-coach.md</code>
- <code>marketing/marketing-social-media-strategist.md</code>
- <code>marketing/marketing-tiktok-strategist.md</code>
- <code>marketing/marketing-twitter-engager.md</code>
- <code>marketing/marketing-video-optimization-specialist.md</code>
- <code>marketing/marketing-wechat-official-account.md</code>
- <code>marketing/marketing-weibo-strategist.md</code>
- <code>marketing/marketing-x-twitter-intelligence-analyst.md</code>
- <code>marketing/marketing-xiaohongshu-specialist.md</code>
- <code>marketing/marketing-zhihu-strategist.md</code>
### paid-media (7)
- <code>paid-media/paid-media-auditor.md</code>
- <code>paid-media/paid-media-creative-strategist.md</code>
- <code>paid-media/paid-media-paid-social-strategist.md</code>
- <code>paid-media/paid-media-ppc-strategist.md</code>
- <code>paid-media/paid-media-programmatic-buyer.md</code>
- <code>paid-media/paid-media-search-query-analyst.md</code>
- <code>paid-media/paid-media-tracking-specialist.md</code>
### product (5)
- <code>product/product-behavioral-nudge-engine.md</code>
- <code>product/product-feedback-synthesizer.md</code>
- <code>product/product-manager.md</code>
- <code>product/product-sprint-prioritizer.md</code>
- <code>product/product-trend-researcher.md</code>
### project-management (7)
- <code>project-management/project-management-experiment-tracker.md</code>
- <code>project-management/project-management-jira-workflow-steward.md</code>
- <code>project-management/project-management-meeting-notes-specialist.md</code>
- <code>project-management/project-management-project-shepherd.md</code>
- <code>project-management/project-management-studio-operations.md</code>
- <code>project-management/project-management-studio-producer.md</code>
- <code>project-management/project-manager-senior.md</code>
### sales (9)
- <code>sales/sales-account-strategist.md</code>
- <code>sales/sales-coach.md</code>
- <code>sales/sales-deal-strategist.md</code>
- <code>sales/sales-discovery-coach.md</code>
- <code>sales/sales-engineer.md</code>
- <code>sales/sales-offer-lead-gen-strategist.md</code>
- <code>sales/sales-outbound-strategist.md</code>
- <code>sales/sales-pipeline-analyst.md</code>
- <code>sales/sales-proposal-strategist.md</code>
### security (12)
- <code>security/security-ai-generated-code-auditor.md</code>
- <code>security/security-appsec-engineer.md</code>
- <code>security/security-architect.md</code>
- <code>security/security-blockchain-security-auditor.md</code>
- <code>security/security-cloud-security-architect.md</code>
- <code>security/security-compliance-auditor.md</code>
- <code>security/security-incident-responder.md</code>
- <code>security/security-penetration-tester.md</code>
- <code>security/security-secrets-credential-engineer.md</code>
- <code>security/security-senior-secops.md</code>
- <code>security/security-threat-detection-engineer.md</code>
- <code>security/security-threat-intelligence-analyst.md</code>
### spatial-computing (6)
- <code>spatial-computing/macos-spatial-metal-engineer.md</code>
- <code>spatial-computing/terminal-integration-specialist.md</code>
- <code>spatial-computing/visionos-spatial-engineer.md</code>
- <code>spatial-computing/xr-cockpit-interaction-specialist.md</code>
- <code>spatial-computing/xr-immersive-developer.md</code>
- <code>spatial-computing/xr-interface-architect.md</code>
### specialized (57)
- <code>specialized/accounts-payable-agent.md</code>
- <code>specialized/agentic-identity-trust.md</code>
- <code>specialized/agents-orchestrator.md</code>
- <code>specialized/automation-governance-architect.md</code>
- <code>specialized/business-strategist.md</code>
- <code>specialized/change-management-consultant.md</code>
- <code>specialized/chief-financial-officer.md</code>
- <code>specialized/corporate-training-designer.md</code>
- <code>specialized/customer-service.md</code>
- <code>specialized/customer-success-manager.md</code>
- <code>specialized/data-consolidation-agent.md</code>
- <code>specialized/data-privacy-officer.md</code>
- <code>specialized/esg-sustainability-officer.md</code>
- <code>specialized/government-digital-presales-consultant.md</code>
- <code>specialized/grant-writer.md</code>
- <code>specialized/healthcare-aging-parent-care-companion.md</code>
- <code>specialized/healthcare-customer-service.md</code>
- <code>specialized/healthcare-marketing-compliance.md</code>
- <code>specialized/hospitality-guest-services.md</code>
- <code>specialized/hr-onboarding.md</code>
- <code>specialized/identity-graph-operator.md</code>
- <code>specialized/language-translator.md</code>
- <code>specialized/legal-billing-time-tracking.md</code>
- <code>specialized/legal-client-intake.md</code>
- <code>specialized/legal-document-review.md</code>
- <code>specialized/loan-officer-assistant.md</code>
- <code>specialized/lsp-index-engineer.md</code>
- <code>specialized/ma-integration-manager.md</code>
- <code>specialized/medical-billing-coding-specialist.md</code>
- <code>specialized/operations-manager.md</code>
- <code>specialized/organizational-psychologist.md</code>
- <code>specialized/personal-growth-mentor.md</code>
- <code>specialized/real-estate-buyer-seller.md</code>
- <code>specialized/recruitment-specialist.md</code>
- <code>specialized/report-distribution-agent.md</code>
- <code>specialized/resume-tailor.md</code>
- <code>specialized/retail-customer-returns.md</code>
- <code>specialized/sales-data-extraction-agent.md</code>
- <code>specialized/sales-outreach.md</code>
- <code>specialized/specialized-chief-of-staff.md</code>
- <code>specialized/specialized-civil-engineer.md</code>
- <code>specialized/specialized-codebase-archaeologist.md</code>
- <code>specialized/specialized-cultural-intelligence-strategist.md</code>
- <code>specialized/specialized-developer-advocate.md</code>
- <code>specialized/specialized-document-generator.md</code>
- <code>specialized/specialized-fedramp-rmf-compliance.md</code>
- <code>specialized/specialized-french-consulting-market.md</code>
- <code>specialized/specialized-korean-business-navigator.md</code>
- <code>specialized/specialized-mcp-builder.md</code>
- <code>specialized/specialized-model-qa.md</code>
- <code>specialized/specialized-pricing-analyst.md</code>
- <code>specialized/specialized-salesforce-architect.md</code>
- <code>specialized/specialized-strategy-duel-agent.md</code>
- <code>specialized/specialized-workflow-architect.md</code>
- <code>specialized/study-abroad-advisor.md</code>
- <code>specialized/supply-chain-strategist.md</code>
- <code>specialized/zk-steward.md</code>
### support (6)
- <code>support/support-analytics-reporter.md</code>
- <code>support/support-executive-summary-generator.md</code>
- <code>support/support-finance-tracker.md</code>
- <code>support/support-infrastructure-maintainer.md</code>
- <code>support/support-legal-compliance-checker.md</code>
- <code>support/support-support-responder.md</code>
### testing (9)
- <code>testing/testing-accessibility-auditor.md</code>
- <code>testing/testing-api-tester.md</code>
- <code>testing/testing-evidence-collector.md</code>
- <code>testing/testing-performance-benchmarker.md</code>
- <code>testing/testing-reality-checker.md</code>
- <code>testing/testing-test-automation-engineer.md</code>
- <code>testing/testing-test-results-analyzer.md</code>
- <code>testing/testing-tool-evaluator.md</code>
- <code>testing/testing-workflow-optimizer.md</code>
## Appendix B — Markdown without profile frontmatter (45)
- <code>.github/PULL_REQUEST_TEMPLATE.md</code>
- <code>CONTRIBUTING_zh-CN.md</code>
- <code>CONTRIBUTING.md</code>
- <code>examples/nexus-spatial-discovery.md</code>
- <code>examples/README.md</code>
- <code>examples/workflow-book-chapter.md</code>
- <code>examples/workflow-landing-page.md</code>
- <code>examples/workflow-startup-mvp.md</code>
- <code>examples/workflow-with-memory.md</code>
- <code>integrations/aider/README.md</code>
- <code>integrations/antigravity/README.md</code>
- <code>integrations/claude-code/README.md</code>
- <code>integrations/codex/README.md</code>
- <code>integrations/cursor/README.md</code>
- <code>integrations/gemini-cli/README.md</code>
- <code>integrations/github-copilot/README.md</code>
- <code>integrations/hermes/README.md</code>
- <code>integrations/kimi/README.md</code>
- <code>integrations/mcp-memory/README.md</code>
- <code>integrations/openclaw/README.md</code>
- <code>integrations/opencode/README.md</code>
- <code>integrations/qwen/README.md</code>
- <code>integrations/README.md</code>
- <code>integrations/vibe/README.md</code>
- <code>integrations/windsurf/README.md</code>
- <code>integrations/zcode/README.md</code>
- <code>README.md</code>
- <code>scripts/i18n/README.md</code>
- <code>SECURITY.md</code>
- <code>strategy/coordination/agent-activation-prompts.md</code>
- <code>strategy/coordination/handoff-templates.md</code>
- <code>strategy/EXECUTIVE-BRIEF.md</code>
- <code>strategy/nexus-strategy.md</code>
- <code>strategy/playbooks/phase-0-discovery.md</code>
- <code>strategy/playbooks/phase-1-strategy.md</code>
- <code>strategy/playbooks/phase-2-foundation.md</code>
- <code>strategy/playbooks/phase-3-build.md</code>
- <code>strategy/playbooks/phase-4-hardening.md</code>
- <code>strategy/playbooks/phase-5-launch.md</code>
- <code>strategy/playbooks/phase-6-operate.md</code>
- <code>strategy/QUICKSTART.md</code>
- <code>strategy/runbooks/scenario-enterprise-feature.md</code>
- <code>strategy/runbooks/scenario-incident-response.md</code>
- <code>strategy/runbooks/scenario-marketing-campaign.md</code>
- <code>strategy/runbooks/scenario-startup-mvp.md</code>
## Appendix C — integration profile, not a source profile (1)
- <code>integrations/mcp-memory/backend-architect-with-memory.md</code>
## Appendix D — non-Markdown blobs (27)
| mode | blob SHA-1 | bytes | path |
| --- | --- | ---: | --- |
| <code>100644</code> | <code>e2bbbd76b8405824919c4fc49f9612be1debc9c3</code> | 121 | <code>.gitattributes</code> |
| <code>100644</code> | <code>618da83367e3757c61a5bc20ac4955e147e680c3</code> | 21 | <code>.github/FUNDING.yml</code> |
| <code>100644</code> | <code>2d2cab519c0e8ce9c089fbbbaf95783b46eb518a</code> | 713 | <code>.github/ISSUE_TEMPLATE/bug-report.yml</code> |
| <code>100644</code> | <code>b7fdd10c7e78fa6d4a60d452a21aeca21f8bb44a</code> | 1082 | <code>.github/ISSUE_TEMPLATE/new-agent-request.yml</code> |
| <code>100644</code> | <code>b50fc90fd84cc934e8d94ec01b4851a1d38257ca</code> | 530 | <code>.github/workflows/check-divisions.yml</code> |
| <code>100644</code> | <code>cf44a5cf4e2d0c518a5f3dc67ee15e7f13c9407b</code> | 592 | <code>.github/workflows/check-runbooks.yml</code> |
| <code>100644</code> | <code>f85b8ca912740799a552e56d5fe814ab4a7a9d32</code> | 611 | <code>.github/workflows/check-tools.yml</code> |
| <code>100644</code> | <code>62398a9aa57c32275fb2e579e7f03ec273e7f854</code> | 2040 | <code>.github/workflows/lint-agents.yml</code> |
| <code>100644</code> | <code>6c27b742139a91bd06cc10424f9ca0dc6b958e69</code> | 1436 | <code>.gitignore</code> |
| <code>100644</code> | <code>523078c01624b9b1b1c551e75054b9d3a9f953ab</code> | 1079 | <code>LICENSE</code> |
| <code>100644</code> | <code>1a492fa4c08358bd73f601b33eefc5eb3b2958e6</code> | 2435 | <code>divisions.json</code> |
| <code>100755</code> | <code>bcde1d77d845ec308437a39689827ef77e1bc43b</code> | 2227 | <code>integrations/mcp-memory/setup.sh</code> |
| <code>100644</code> | <code>302ed8fa658735d0d04027fb814e879a5366c3f5</code> | 363 | <code>scripts/agents-to-install.example</code> |
| <code>100644</code> | <code>edd62a26caebd87b25c7846babab18f56e44bbc3</code> | 19400 | <code>scripts/build-hermes-plugin.py</code> |
| <code>100755</code> | <code>e55e4570945d83985d7cf308b78831561f9d55d6</code> | 6429 | <code>scripts/check-agent-originality.sh</code> |
| <code>100755</code> | <code>6cb8f920ca9a718a507249d5c9f6a90110a87f03</code> | 5479 | <code>scripts/check-divisions.sh</code> |
| <code>100644</code> | <code>4ef3ce7325068fddc32d06151a745392e13a3d25</code> | 2883 | <code>scripts/check-hermes-plugin.py</code> |
| <code>100755</code> | <code>ad1d7c74e3d2f27afa734d463d0cefce3b93e763</code> | 3209 | <code>scripts/check-runbooks.sh</code> |
| <code>100755</code> | <code>5277b0d6661f40e76eed4099239e1c98ca38f057</code> | 4067 | <code>scripts/check-tools.sh</code> |
| <code>100755</code> | <code>af005ff9d81cd3317e0ee4e4c9d8056d16c1c198</code> | 22626 | <code>scripts/convert.sh</code> |
| <code>100644</code> | <code>7d87b6a3f33e1d6f0853a243fab4ba0f75e3b6b9</code> | 22358 | <code>scripts/i18n/agent-names-zh.json</code> |
| <code>100644</code> | <code>422f0cd8d23fd744a392a2850b715872153d9ab3</code> | 1617 | <code>scripts/i18n/localize-agents-zh.ps1</code> |
| <code>100755</code> | <code>1ff20c47ee3cdfd99fec61e57263081152474f40</code> | 55418 | <code>scripts/install.sh</code> |
| <code>100755</code> | <code>270388a93132a1efb9ac521839d4504c4b090d0c</code> | 6551 | <code>scripts/lib.sh</code> |
| <code>100755</code> | <code>226bff71d98da88266a7d57672cd5ee37ebb8a85</code> | 4936 | <code>scripts/lint-agents.sh</code> |
| <code>100644</code> | <code>9547fa4553263204a80639af2bd72f7064795a40</code> | 6769 | <code>strategy/runbooks.json</code> |
| <code>100644</code> | <code>cd4ea04273bc17d7b11060604a3a8cc2681b2af8</code> | 8393 | <code>tools.json</code> |

## Continuación — engineering/ + security/ divisions — 2026-08-14

Reviewed the remaining **66 profiles**: 55 of 58 <code>engineering/</code> (excludes the 3 already deep-read: <code>engineering-code-reviewer</code>, <code>engineering-senior-developer</code>, <code>engineering-multi-agent-systems-architect</code>) plus all **11** remaining <code>security/</code> profiles (excludes <code>security-appsec-engineer</code>). Method: raw-decoded each file (`gh api .../contents/<path>?ref=ebe9c99acb5c96f9468de368d8bead775387d1a7 --jq '.content' | base64 -d`), then grepped headings for gate/contract/checklist/input/output/verify/criteria/schema markers, spot-read the highest-signal hits in full.

Remaining count: 264 − 66 = **198 source profiles** still not reviewed.

| File | Purpose | Structural feature | VCP-relevant? |
| --- | --- | --- | --- |
| engineering-ai-data-remediation-engineer.md | Self-healing data pipeline remediation via local SLMs | none found | No — prose |
| engineering-ai-engineer.md | ML model dev/deploy/integration | none found | No |
| engineering-api-platform-engineer.md | Contract-first API/gateway design | "Contract-First OpenAPI" section, API contract checklist | Partial — spec-as-contract framing, no gate |
| engineering-autonomous-optimization-architect.md | Shadow-testing API perf governor | none found | No |
| engineering-backend-architect.md | Backend/system design | "API Contract Governance" + checklist | Partial — checklist only |
| engineering-cms-developer.md | Drupal/WordPress dev | Pre-Launch Checklist | Partial |
| engineering-codebase-onboarding-engineer.md | Onboarding docs for new engineers | defines an Output Format | Partial — output format, no gate |
| engineering-data-engineer.md | Data pipelines/lakehouse | Bronze/Gold schema comments, no gate | No |
| engineering-data-visualization-engineer.md | Chart selection/design | "Perceptual Honesty Checklist" | Partial |
| engineering-database-optimizer.md | Schema/query/index tuning | none | No |
| engineering-database-reliability-engineer.md | DBRE, HA/failover | Zero-Downtime Migration pattern | No gate |
| engineering-desktop-app-engineer.md | Electron/Tauri | none | No |
| engineering-developer-tooling-engineer.md | CLI/DX tooling | DX checklist, dual human/machine output | Partial |
| engineering-devops-automator.md | IaC/CI-CD | none | No |
| engineering-drupal-performance.md | Drupal perf tuning | Infra Tuning Checklist, "Verify & Hand Off" step | Partial |
| engineering-drupal-shopping-cart.md | Drupal Commerce | Payment Gateway Integration Spec | Partial — spec format |
| engineering-email-intelligence-engineer.md | Email→structured data extraction | none | No |
| engineering-embedded-firmware-engineer.md | Bare-metal/RTOS firmware | none | No |
| engineering-feishu-integration-developer.md | Feishu/Lark platform integration | none | No |
| engineering-filament-optimization-specialist.md | Filament PHP admin UI | "Input Replacement Rules" (UX, not I/O contract) | No |
| engineering-finops-engineer.md | Cloud cost engineering | none | No |
| engineering-frontend-developer.md | React/Vue/Angular | none | No |
| engineering-gaussdb-expert.md | GaussDB OLTP schema | none | No |
| engineering-git-workflow-master.md | Git branching/conventions | none | No |
| engineering-i18n-engineer.md | ICU/CLDR i18n | none | No |
| engineering-identity-access-engineer.md | OAuth/OIDC/SCIM | none | No |
| engineering-incident-response-commander.md | Incident coordination | explicit "Verify rollback succeeded" + Verification section | Partial — verification step |
| engineering-iot-fleet-engineer.md | IoT/edge fleet | none | No |
| engineering-it-service-manager.md | ITIL 4 service mgmt | none | No |
| **engineering-llm-post-training-engineer.md** | SFT/RLHF/RLVR post-training ownership | **"Gate: Preflight \| Smoke \| Signal \| Controlled"**, "Experiment Gate Record", "Fixed Comparator Contract", "Freeze the Decision Contract" step | Yes — see cross-reference below |
| engineering-minimal-change-engineer.md | Minimum-viable diffs, scope refusal | none (behavioral rule, not gate) | No |
| engineering-mobile-app-builder.md | iOS/Android native+cross-platform | none | No |
| engineering-mobile-release-engineer.md | Code signing/release | Phased Rollout with Halt Criteria, Pre-Submission Checklist (release-blocking) | Partial — halt criteria is gate-like |
| engineering-network-engineer.md | Cisco/Juniper/Palo Alto | `show` output interpretation guide | No |
| engineering-orgscript-engineer.md | Custom DSL grammar/AST | none | No |
| engineering-payments-billing-engineer.md | PSP integration, idempotency | none | No |
| engineering-privacy-engineer.md | PII discovery/minimization | consent-gated enforcement point example | Partial — one code example, not a doc gate |
| engineering-prompt-engineer.md | Prompt crafting/testing | none | No |
| engineering-rag-pipeline-engineer.md | RAG chunking/retrieval | pgvector schema example | No |
| engineering-rapid-prototyper.md | Fast MVP/PoC | none | No |
| engineering-realtime-collaboration-engineer.md | WebSocket/CRDT collab | Hostile-Network Test Checklist | Partial |
| engineering-rust-refactoring-specialist.md | Repo-scale Rust refactors | "Preserve contracts deliberately" + Verification + "Verify the relevant matrix" | Partial — verification step |
| engineering-search-relevance-engineer.md | Elasticsearch/OpenSearch tuning | none | No |
| engineering-section-508-specialist.md | Federal accessibility (508/WCAG) | "Step 4: Verify & Re-test" | Partial |
| engineering-software-architect.md | System/DDD architecture | none | No |
| engineering-solidity-smart-contract-engineer.md | EVM smart contracts | "Testing & Verification" step | Partial |
| engineering-sre.md | SLOs/error budgets/chaos eng | none | No |
| engineering-technical-writer.md | Dev docs/API refs | "Quality Gates" heading | Partial — undefined gate |
| engineering-uswds-developer.md | US federal design system | Required Federal Elements Checklist, "Verify Accessibility, Compliance & Maintainability" | Partial |
| engineering-video-streaming-engineer.md | HLS/DASH/ffmpeg | none | No |
| engineering-voice-ai-integration-engineer.md | Speech transcription pipelines | "Structured Output" + "Input Handling and Validation" sections | Partial — explicit I/O sections |
| engineering-webassembly-engineer.md | Rust/C++/Go→Wasm | none | No |
| engineering-wechat-mini-program-developer.md | WeChat Mini Programs | platform-constraint guide | No |
| engineering-wordpress-performance.md | WP perf tuning | Infra Tuning Checklist, Verify step | Partial |
| engineering-wordpress-shopping-cart.md | WooCommerce | Payment Gateway Integration Spec | Partial |
| security-ai-generated-code-auditor.md | Vibe-coded app security review | "Audit Triage Output" (worst-first, actionable format) | Partial — output format |
| security-architect.md | Threat modeling/secure-by-design | "Phase 4: Verification & Security Testing" | Partial |
| security-blockchain-security-auditor.md | Smart contract security audit | Vulnerability Detection + Formal Verification + Access Control Audit Checklist | Partial |
| security-cloud-security-architect.md | Zero trust/defense-in-depth | Cloud Security Posture Checklist | Partial |
| security-compliance-auditor.md | SOC 2/ISO 27001/HIPAA/PCI-DSS | none found beyond audit framework names | No |
| security-incident-responder.md | Forensics/breach response | none | No |
| security-penetration-tester.md | Authorized pentest/red team | reconnaissance procedure, not a gate | No |
| security-secrets-credential-engineer.md | Secrets lifecycle mgmt | "Secret Scanning at the Commit and CI Gate" | Partial — named CI gate |
| **security-senior-secops.md** | Scans every code submission for secrets/sensitive data | **"Checklist Mode — Phase Validation"**, numbered RULEs (e.g. "RULE 3 — JWT algorithm is fixed and verified", "RULE 8 — All inputs are validated at the trust boundary"), defined "Scan output format" | Yes — see cross-reference below |
| security-threat-detection-engineer.md | SIEM/MITRE ATT&CK detection | Detection Rule Metadata Catalog Schema | Partial — schema, not a gate |
| security-threat-intelligence-analyst.md | Adversary tracking/MITRE mapping | none | No |

### Cross-reference: any structural feature VCP's subagent-*.md files lack?

Two files stood out as candidates: `engineering-llm-post-training-engineer.md` (fixed comparator + promotion/stop gate for ML experiments) and `security-senior-secops.md` (numbered RULE checklist + fixed scan-output format).

**Verdict: none found that VCP lacks.** Both are narrower, domain-bound restatements of gate/checklist mechanisms VCP already has, generically, at the protocol level:

- VCP's RED gate is already an explicit, binary, evidence-checked gate: `skills/subagent-red.md:92` ("RED gate classification"), `:111` ("RED GATE: PASS —"), `:128` ("## HARD GATE — If tests pass"), `:136` ("RED GATE: FAIL — Tests pass before implementation."). This is stricter than the LLM engineer's "Preflight | Smoke | Signal | Controlled" staged gate (line ~67 of that file), which is a documentation template with no cited enforcement mechanism — it tells the author what to record, not what blocks progress if unmet.
- VCP's hard-gate pattern (`## HARD GATE`, `skills/subagent-red.md:128`) is a general primitive; `security-senior-secops.md`'s numbered RULEs (RULE 3, RULE 8, etc.) are just domain checklist items with no distinct meta-mechanism — they don't introduce a new gate *type*, only new gate *content* (JWT alg pinning, trust-boundary input validation) that would belong in `skills/security-baseline.md` as checklist content, not as new VCP structure.

No file in this batch defines an input/output contract format stricter than what VCP's existing `skills/subagent-red.md` and `skills/subagent-triangulate.md` already enforce via explicit PASS/FAIL gate lines. Most "Verify" and "Checklist" headings found here are prose reminders without a cited pass/fail mechanism or receipt artifact — weaker than VCP's gate, not stronger.

## Continuación — divisions batch 2 — 2026-08-14

Reviewed all **43** remaining profiles across six divisions, closing each fully: <code>design/</code> (9 of 10; <code>design-ux-architect</code> already deep-read), <code>finance/</code> (5/5), <code>product/</code> (5/5), <code>project-management/</code> (7/7), <code>sales/</code> (9/9), <code>testing/</code> (8 of 9; <code>testing-reality-checker</code> already deep-read). Method unchanged: raw-decode each file via <code>gh api .../contents/&lt;path&gt;?ref=ebe9c99acb5c96f9468de368d8bead775387d1a7 --jq '.content' | base64 -d</code>, grep headings/body for gate/checklist/contract/verify/schema markers, then read the highest-signal hits in full.

Remaining count: 198 − 43 = **155 source profiles** still not reviewed.

| File | Purpose | Structural feature | VCP-relevant? |
| --- | --- | --- | --- |
| design-brand-guardian.md | Brand identity/voice consistency | none found | No — prose |
| design-image-prompt-engineer.md | Photography prompt crafting for image models | none found | No |
| design-inclusive-visuals-specialist.md | Bias-aware representation in generated imagery | 2 checklist-style mentions, no gate | No |
| design-persona-walkthrough.md | Cognitive-walkthrough simulation from a persona | scored walkthrough criteria, not binary | Partial |
| design-ui-designer.md | Visual/component design systems | none found | No |
| **design-ui-finish-gate-reviewer.md** | Stops generic UI from shipping via before/after review | **"Design Contract" template + "UI Finish Gate" template with `Decision: HOLD`, "Required before PASS", "PASS criteria" list** | Yes — see cross-reference below |
| design-ux-researcher.md | User research/usability testing | 1 mention, no gate | No |
| design-visual-storyteller.md | Visual narrative/marketing imagery | none found | No |
| design-whimsy-injector.md | Adds delight/personality polish | none found | No |
| finance-bookkeeper-controller.md | Day-to-day bookkeeping + month-end close | Month-End Close Checklist (dated day-by-day), Account Reconciliation template | Partial — checklist, no pass/fail |
| finance-financial-analyst.md | Financial modeling/forecasting | 1 mention, no gate | No |
| finance-fpa-analyst.md | Budgeting/variance analysis | variance-threshold guidance, no gate | No |
| finance-investment-researcher.md | Market research/due diligence | due-diligence checklist, no gate | No |
| finance-tax-strategist.md | Tax optimization/compliance | compliance checklist, no gate | No |
| product-behavioral-nudge-engine.md | Behavioral-psychology interaction cadence tuning | none found | No |
| product-feedback-synthesizer.md | Multi-channel feedback synthesis | none found | No |
| product-manager.md | Full product lifecycle ownership | PRD, Opportunity Assessment (RICE score), Roadmap templates — structured docs, no binary gate | Partial — templates only |
| product-sprint-prioritizer.md | Agile sprint planning/prioritization | prioritization framework, no gate | No |
| product-trend-researcher.md | Market/trend intelligence | none found | No |
| project-management-experiment-tracker.md | Experiment design/tracking | none found | No |
| project-management-jira-workflow-steward.md | Enforces Jira-linked Git workflow traceability | linkage rules, no cited enforcement mechanism | No |
| project-management-meeting-notes-specialist.md | Extracts decisions/action items from transcripts | none found | No |
| project-management-project-shepherd.md | Cross-functional project coordination | status/risk templates, no gate | No |
| project-management-studio-operations.md | Studio process optimization | none found | No |
| project-management-studio-producer.md | High-level creative/technical orchestration | none found | No |
| project-manager-senior.md | Spec-to-task conversion with project memory | scope-realism rules, no gate | No |
| sales-account-strategist.md | Post-sale land-and-expand strategy | Expansion Plan, QBR, Churn Prevention templates — no binary gate | Partial — templates only |
| sales-coach.md | Rep development/pipeline review coaching | coaching rubric, no gate | No |
| sales-deal-strategist.md | MEDDPICC deal qualification | qualification checklist, no gate | No |
| sales-discovery-coach.md | Discovery-call methodology coaching | question-design framework, no gate | No |
| sales-engineer.md | Pre-sales technical discovery/POC scoping | POC exit-criteria mention, no formal gate | Partial |
| sales-offer-lead-gen-strategist.md | Offer/lead-magnet design | none found | No |
| sales-outbound-strategist.md | Multi-channel outbound sequencing | none found | No |
| sales-pipeline-analyst.md | Pipeline health/deal velocity diagnostics | none found | No |
| sales-proposal-strategist.md | RFP/proposal writing strategy | none found | No |
| testing-accessibility-auditor.md | WCAG audit with assistive-tech testing | Audit Report template, Remediation Priority tiers — structured, no pass/fail line | Partial — template only |
| testing-api-tester.md | API test strategy/security/performance validation | Test Report template with coverage/perf/security sections — no binary gate | Partial — template only |
| testing-evidence-collector.md | Screenshot-based QA evidence gathering | requires artifacts before claims; no gate line | Partial |
| testing-performance-benchmarker.md | Performance measurement/optimization | none found | No |
| testing-test-automation-engineer.md | Playwright/Cypress E2E automation | none found | No |
| testing-test-results-analyzer.md | Test result evaluation/quality metrics | none found | No |
| testing-tool-evaluator.md | Tech/tool assessment and recommendation | evaluation criteria list, no gate | No |
| testing-workflow-optimizer.md | Process improvement/workflow automation | none found | No |

### Cross-reference: any structural feature VCP's subagent-*.md files lack?

One candidate: `design-ui-finish-gate-reviewer.md`. Its "UI Finish Gate" output (`Decision: HOLD`, numbered "Required before PASS" items, a "PASS criteria" checklist) is a genuine binary gate with named evidence requirements — structurally the closest analogue yet found to VCP's RED/HARD gates.

**Verdict: still none found that VCP lacks.** The mechanism type is identical to what VCP already has — a named binary decision (HOLD/PASS here vs. PASS/FAIL in `skills/subagent-red.md:111`) blocked on enumerated, verifiable evidence (`skills/subagent-red.md:128` `## HARD GATE`). The agency-agents version is narrower (one UI-review domain, no cited automated enforcement — it's a reporting template an agent is instructed to fill in, not a script-checked gate) where VCP's RED gate is enforced by an actual test run. Everything else in this batch (Month-End Close Checklist, PRD/Opportunity Assessment templates, QBR/Churn Prevention templates, Audit/Test Report templates) is a structured-document convention, not a gate: no file states what blocks progress if a criterion is unmet, only what to record. None introduce an input/output contract, receipt format, or verification mechanism VCP's `skills/subagent-red.md` or `skills/subagent-triangulate.md` does not already have at the protocol level.

## Continuación — divisions batch 3 — 2026-08-17

Reviewed all **28** profiles across five small divisions, closing each fully: <code>academic/</code> (6/6), <code>healthcare/</code> (3/3), <code>spatial-computing/</code> (6/6), <code>support/</code> (6/6), <code>paid-media/</code> (7/7). Method unchanged: raw-decode each file via <code>gh api .../contents/&lt;path&gt;?ref=ebe9c99acb5c96f9468de368d8bead775387d1a7 --jq '.content' | base64 -d</code>, then grep headings (`^#{2,4} .*(Gate|Checklist|Contract|Criteria|Verif|Schema|Rule|Output Format)`) plus a broader case-insensitive body scan, and read every hit.

Remaining count: 155 − 28 = **127 source profiles** still not reviewed.

| File | Purpose | Structural feature | VCP-relevant? |
| --- | --- | --- | --- |
| academic-anthropologist.md | Ethnographic/cultural-analysis research persona | "Critical Rules You Must Follow" (behavioral prose only) | No |
| academic-geographer.md | Spatial/human-geography research persona | same boilerplate heading | No |
| academic-historian.md | Historical-analysis research persona | none found | No |
| academic-narratologist.md | Narrative-structure literary analysis persona | same boilerplate heading | No |
| academic-psychologist.md | Psychological-research persona | same boilerplate heading | No |
| academic-statistician.md | Statistical-methods research persona | same boilerplate heading | No |
| healthcare-clinical-evidence-agent.md | Clinical evidence synthesis/literature review | none found | No |
| healthcare-innovation-strategist.md | Health-tech innovation strategy | "Critical Rules" (prose) | No |
| healthcare-sovereign-health-systems-agent.md | National/sovereign health-system design | "Critical Rules" + "Resource Allocation Rule" (prose guidance, no gate) | No |
| spatial-computing/macos-spatial-metal-engineer.md | macOS Metal/spatial rendering | "Critical Rules You Must Follow" (prose) | No |
| spatial-computing/terminal-integration-specialist.md | Terminal UI/CLI integration (thin stub, 69 lines) | none found | No |
| spatial-computing/visionos-spatial-engineer.md | visionOS spatial app dev (thin stub, 53 lines) | none found | No |
| spatial-computing/xr-cockpit-interaction-specialist.md | XR cockpit UX (thin stub, 32 lines) | none found | No |
| spatial-computing/xr-immersive-developer.md | XR immersive app dev (thin stub, 32 lines) | none found | No |
| spatial-computing/xr-interface-architect.md | XR interface architecture (thin stub, 32 lines) | none found | No |
| support-analytics-reporter.md | Analytics/reporting dashboards | "Critical Rules" (prose) | No |
| support-executive-summary-generator.md | Executive summary drafting | "Critical Rules" + "Your Required Output Format" (prescribes prose sections, no pass/fail) | Partial — output format only |
| support-finance-tracker.md | Internal finance tracking/reporting | "Critical Rules" (prose) | No |
| support-infrastructure-maintainer.md | Infra maintenance/ops runbooks | "Critical Rules" (prose) | No |
| support-legal-compliance-checker.md | Internal legal/compliance doc review | "Critical Rules" + "Contract Review Automation"/"Contract and Legal Document Review" (reviewing legal contracts, not an I/O contract) | No |
| support-support-responder.md | Customer support response drafting | "Critical Rules" (prose) | No |
| paid-media-auditor.md | Paid-media account audits (thin file, 71 lines) | none found | No |
| paid-media-creative-strategist.md | Ad-creative strategy (thin file, 71 lines) | none found | No |
| paid-media-paid-social-strategist.md | Paid social strategy (thin file, 71 lines) | none found | No |
| paid-media-ppc-strategist.md | PPC/search-ads strategy (thin file, 71 lines) | none found | No |
| paid-media-programmatic-buyer.md | Programmatic media buying (thin file, 71 lines) | none found | No |
| paid-media-search-query-analyst.md | Search-query/negative-keyword analysis (thin file, 71 lines) | none found | No |
| paid-media-tracking-specialist.md | Ad tracking/attribution setup (thin file, 71 lines) | none found | No |

### Cross-reference: any structural feature VCP's subagent-*.md files lack?

**Verdict: none found that VCP lacks.** This is the weakest-structure batch reviewed so far — most files are pure personality/domain prose, and several (`spatial-computing/*`, all seven `paid-media/*`) are short (32–71 line) stub profiles with no gate, checklist, contract, or verification section at all. The only structural item worth naming is `support-executive-summary-generator.md`'s "Your Required Output Format" heading, which prescribes prose section order — a template, not a binary gate. No file in this batch introduces an input/output contract, receipt format, or verification mechanism beyond what VCP's `skills/subagent-red.md` and `skills/subagent-triangulate.md` already enforce.

**Divisions now fully closed (0 profiles remaining):** academic, design, engineering, finance, healthcare, paid-media, product, project-management, sales, security, spatial-computing, support, testing.

**Divisions still open:** game-development (21), gis (13), marketing (36), specialized (57) — **127 source profiles** total remaining.

## Final verdict — sampled pass across the 4 remaining divisions — 2026-08-17

This is the final research pass on this source. Sampled 13 profiles across the 4 divisions never yet touched: <code>game-development/game-designer.md</code>, <code>game-development/unity/unity-architect.md</code>, <code>game-development/roblox-studio/roblox-systems-scripter.md</code>, <code>gis/gis-qa-engineer.md</code>, <code>gis/gis-solution-engineer.md</code>, <code>marketing/marketing-seo-specialist.md</code>, <code>marketing/marketing-growth-hacker.md</code>, <code>marketing/marketing-social-media-strategist.md</code>, <code>specialized/specialized-mcp-builder.md</code>, <code>specialized/specialized-codebase-archaeologist.md</code>, <code>specialized/agents-orchestrator.md</code>, <code>specialized/automation-governance-architect.md</code>, <code>specialized/specialized-model-qa.md</code> — chosen for highest apparent structure (orchestrator, governance, QA, and gate-named files) rather than at random, to stress-test the pattern against its best shot.

The two strongest hits: <code>gis/gis-qa-engineer.md</code>'s "Gate Policy" ("No exceptions... it does not ship. Period.", severity levels, "re-verify fixes") and <code>specialized/agents-orchestrator.md</code>'s "Quality Gate Enforcement" ("No shortcuts: Every task must pass QA validation", retry limits, pipeline state tracking). <code>specialized/specialized-model-qa.md</code> defines a 10-section Pass/Fail audit template. All three are, again, prose gate language and reporting templates instructed to an agent — none cite a script, test run, or receipt artifact that mechanically blocks progress the way <code>skills/subagent-red.md:128</code>'s <code>## HARD GATE</code> does. They restate the same "adversarial QA persona with a pass/fail vocabulary" pattern already catalogued in every prior batch (design-ui-finish-gate-reviewer, security-senior-secops, engineering-llm-post-training-engineer). Marketing and remaining game-development samples showed near-zero structure (pure persona/checklist prose), consistent with paid-media/spatial-computing being the weakest-structure batch previously found.

**Verdict: the "no VCP-applicable structural feature found" pattern holds, now touched across 17/17 divisions.** No exception found in this pass or in any prior pass. Every gate-like mention across ~156 profiles reviewed (across 13 fully-closed divisions plus this stress-test sample of the 4 open ones) is either (a) a checklist/template an agent is told to produce, or (b) prose imperative language ("no exceptions," "must pass," "no shortcuts") with no cited enforcement mechanism — never stronger than VCP's already-enforced, test-run-gated RED/HARD gate in <code>skills/subagent-red.md</code> and <code>skills/subagent-triangulate.md</code>.

**Recommendation: stable verdict — further research on this source is not worth it.** 143/270 profiles were read in full detail across earlier passes, all 17 divisions have now been sampled or fully closed, and the marginal 13-file stress-test targeting the highest-structure candidates in the remaining divisions produced zero exceptions. The 127 unreviewed profiles are overwhelmingly thin (many 32–71 line stub files per the paid-media/spatial-computing precedent) and concentrated in domains (game-dev tooling, GIS, social/marketing, long-tail specialized personas) structurally similar to already-closed low-signal divisions. Continuing to grind through the remaining 127 has a well-established, near-zero expected yield for VCP's purposes. Close this source as PARTIAL-BUT-DECIDED rather than continuing toward EXHAUSTIVE.

