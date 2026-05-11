# PromptLedger Advanced Product Roadmap

## 1) Product Direction

PromptLedger should evolve from a manual eval runner into a full PromptOps platform:
- Source prompts from GitHub and track behavior per commit.
- Continuously evaluate quality, robustness, safety, and cost.
- Detect and explain regressions before production impact.
- Govern promotion across environments with policy + human review.

## 2) North-Star User Flow (Target)

1. Team connects GitHub repository.
2. Prompt changes are detected from PRs/commits.
3. PromptLedger builds candidate prompt versions automatically.
4. System runs:
   - Standard evals
  - Mutation/adversarial evals
   - Guardrail checks
   - Shadow comparisons (if enabled)
5. If drift/regression appears, root cause is identified (including bisect).
6. If quality passes thresholds + policy + human review (if needed), prompt is promoted Dev -> Staging -> Prod.

## 3) Delivery Strategy (Phased)

## Phase 0: Foundations Hardening (1 week)

Goals:
- Stabilize current eval pipeline.
- Add observability for future advanced workflows.

Deliverables:
- Structured event table for every eval run and decision.
- Version lineage metadata (`parent_version_id`, `source`, `source_ref`).
- Reliable run state machine (`pending`, `running`, `degraded`, `failed`, `passed`, `blocked`, `approved`).
- Baseline dashboards: run latency, success rate, queue depth.

Why first:
- Every advanced feature depends on trustworthy run orchestration and traceability.

## Phase 1: GitHub PromptOps Integration (1-2 weeks)

Goals:
- Make GitHub the source of truth for prompt artifacts.

Feature scope:
- Connect repo/org with OAuth app.
- Ingest prompt files from configured paths (e.g. `prompts/**`, `system_prompts/**`).
- Trigger pipeline on:
  - Pull request opened/updated
  - Push to tracked branches
  - Merge to main
- Store mappings:
  - `repo`, `branch`, `commit_sha`, `file_path`, `prompt_component_id`.

Core outputs:
- `BehaviorVersion` auto-created from commit.
- PR status checks posted back to GitHub (`PromptLedger / Eval`, `PromptLedger / Policy`).

## Phase 2: Robustness & Regression Intelligence (2-3 weeks)

### 2.1 Prompt Mutation Testing (Feature #1)

What to build:
- Mutation generator service with strategies:
  - Rephrase/paraphrase
  - Edge-case expansion
  - Jailbreak injection patterns
  - Constraint inversion (tone/format conflicts)
- Mutation pack linked to each eval set.
- Robustness score = weighted aggregate of original + mutated performance.

MVP:
- 4 mutation types, 10 mutants per case, deterministic seed support.

### 2.2 Behavioral Regression Bisect (Feature #2)

What to build:
- Auto-bisect engine across version history for a behavior unit.
- Binary search over commit/version graph to find first bad version.
- Output includes suspected commit and changed prompt components.

MVP:
- Linear history bisect using commit timestamps.
- Trigger only when degradation > threshold.

### 2.3 Regression Heatmap by Input Category (Feature #7)

What to build:
- Input clustering by embedding + optional user-defined category tags.
- Compare baseline vs candidate category-level score deltas.
- Heatmap UI with severity coloring.

MVP:
- Top 10 categories with delta and confidence.

## Phase 3: Safe Rollout & Dependency Intelligence (2-3 weeks)

### 3.1 Shadow Mode Testing (Feature #3)

What to build:
- Live request mirror pipeline (async tee):
  - Primary response goes to user from active version.
  - Candidate version runs in background.
- Output comparison metrics:
  - Similarity, policy compliance, latency, cost.
- Promotion gate based on shadow thresholds.

MVP:
- Percentage sampling (e.g. 10% traffic mirrored).
- No user-visible impact path guaranteed.

### 3.2 Prompt Dependency Graph (Feature #4)

What to build:
- Prompt component model:
  - Shared system instructions
  - Template fragments
  - Task-specific wrappers
- DAG visualization of dependencies.
- Change impact engine reruns downstream evals automatically.

MVP:
- Graph from static references and file imports.
- Re-eval dependents on shared node change.

### 3.3 Eval Coverage Heatmap (Feature #5)

What to build:
- Coverage analyzer using embedding clustering + metadata heuristics.
- Blind spot detection (language, sentiment, scenario type, complexity).
- Suggestions to generate missing cases.

MVP:
- Coverage score with 3 blind spots surfaced per eval set.

## Phase 4: Governance & Enterprise Controls (2 weeks)

### 4.1 Policy Guardrail Engine (Feature #8)

What to build:
- Policy DSL / rule builder:
  - Required phrases/disclaimers
  - Forbidden entities/topics
  - Max length/style constraints
- Hard gates independent of aggregate eval score.

MVP:
- YAML-backed policy rules + pre-deploy enforcement.

### 4.2 Human-in-the-Loop Review Queue (Feature #9)

What to build:
- Triage queue for ambiguous/degraded runs.
- Case-level approve/reject/annotate.
- Reviewer decisions stored as labels for future model calibration.

MVP:
- Queue for runs with score in configurable gray zone (e.g. 0.60-0.75).

### 4.3 Multi-Environment Promotion Pipeline (Feature #10)

What to build:
- Version lifecycle: Dev -> Staging -> Prod.
- Environment-specific eval sets + thresholds + policies.
- Promotion logs and rollback action.

MVP:
- Manual approval between environments with mandatory checks.

## Phase 5: Optimization & Decision Intelligence (1-2 weeks)

### 5.1 Cost-Quality Tradeoff Analyzer (Feature #6)

What to build:
- Benchmark runner across model/provider matrix.
- Cost estimator (per 1K requests / tokens).
- Pareto chart (quality vs cost vs latency).

MVP:
- Compare 3-5 model configs per behavior unit.
- Recommendation output like: best budget / balanced / best quality.

## 4) Data Model Additions

Add (or equivalent) entities:
- `prompt_components` (shared blocks)
- `prompt_component_links` (dependency edges)
- `github_integrations` and `github_sync_events`
- `mutation_strategies` and `mutation_runs`
- `shadow_runs` and `shadow_comparisons`
- `policy_rules` and `policy_violations`
- `review_queue_items` and `review_decisions`
- `promotion_pipelines` and `promotion_events`
- `category_clusters` and `coverage_reports`
- `cost_benchmarks`

## 5) API Surface (Planned)

- GitHub:
  - `POST /integrations/github/connect`
  - `POST /integrations/github/webhook`
  - `GET /integrations/github/repos`
- Mutation:
  - `POST /evals/{eval_set_id}/mutate-run`
- Bisect:
  - `POST /units/{unit_id}/bisect`
- Shadow:
  - `POST /units/{unit_id}/shadow/start`
  - `POST /units/{unit_id}/shadow/stop`
- Dependency graph:
  - `GET /units/{unit_id}/dependencies`
- Coverage:
  - `GET /evals/{eval_set_id}/coverage`
- Policy:
  - `POST /policies`
  - `POST /versions/{version_id}/policy-check`
- Review:
  - `GET /reviews/queue`
  - `POST /reviews/{item_id}/decision`
- Promotion:
  - `POST /versions/{version_id}/promote`
- Cost-quality:
  - `POST /benchmarks/cost-quality`

## 6) UI Modules (Planned)

- GitHub Integration wizard
- Mutation Testing dashboard
- Regression Bisect explorer
- Shadow Mode compare view
- Prompt Dependency graph page
- Eval Coverage heatmap page
- Category Regression heatmap page
- Policy Guardrail manager
- Human Review queue
- Promotion Pipeline board
- Cost-Quality analyzer chart

## 7) KPIs / Success Metrics

- Regression detection precision >= 85%
- Mean time to root cause (with bisect) < 30 minutes
- Shadow-mode promotion confidence rate >= 90%
- Coverage blind-spot reduction >= 40% over 2 months
- Production incident rate from prompt regressions reduced month-over-month
- Cost per 1K requests reduced without quality drop > 3%

## 8) Recommended Implementation Order (Execution Sequence)

1. Phase 0 foundation hardening
2. Phase 1 GitHub integration
3. Feature #1 Mutation testing
4. Feature #8 Guardrail engine (prevents unsafe releases early)
5. Feature #10 Multi-env promotion
6. Feature #3 Shadow mode
7. Feature #2 Bisect + Feature #7 regression heatmap
8. Feature #4 dependency graph + Feature #5 coverage heatmap
9. Feature #6 cost-quality analyzer
10. Feature #9 human review loop refinement

## 9) Risks and Mitigations

- Risk: LLM-as-judge variance
  - Mitigation: deterministic scoring mode, calibration sets, reviewer overrides.
- Risk: Expensive or slow evaluation explosion from mutation + shadow
  - Mitigation: adaptive sampling, budget caps, async queues.
- Risk: False positives in policy checks
  - Mitigation: severity levels and exception workflows.
- Risk: GitHub mono-repo complexity
  - Mitigation: configurable path selectors and component ownership mapping.

## 10) Immediate Next Sprint (Start Here)

Sprint Goal: GitHub-driven automated evaluation baseline.

Sprint backlog:
1. Implement GitHub integration entities + webhook endpoint.
2. Auto-create `BehaviorVersion` from prompt file changes in tracked paths.
3. Trigger standard eval run on PR update.
4. Publish PR check status (`pass/degraded/fail`) back to GitHub.
5. Add initial Mutation Testing (rephrase + jailbreak-only MVP).

Definition of done:
- A PR changing a prompt file automatically runs eval + mutation eval.
- Results appear in PromptLedger UI and as GitHub status checks.
- Team can block merge when policy/eval gates fail.
