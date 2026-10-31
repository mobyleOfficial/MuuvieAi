---
date: 2026-05-16
author: Claude Opus 4.7 (via ultimate-developer brainstorm)
status: draft
related:
  - agents/pm-spec.md
  - agents/architect-review.md
  - agents/implementer-tester.md
  - agents/validator.md
  - agents/reviewer.md
tags: [agent, pipeline, automation, autonomous]
---

# Ultimate Developer Agent — Design Spec

## Executive Summary

`ultimate-developer` is an autonomous end-to-end feature builder for the MuuvieAi ecosystem. After a single brainstorm at kickoff, it writes a spec, plans the implementation (with research delegated to a new per-topic `researcher` sub-agent — one file per topic, linked from the plan), implements the code, and drives a multi-pass review-and-iterate loop on each phase's PR — all without further user input until merge or escalation. It reuses the existing pipeline agents (`pm-spec`, `architect-review`, `implementer-tester`, `validator`, `reviewer`) via a new `mode: "audit-only"` flag that suppresses their GitHub-writing behavior so ultimate-developer owns every PR comment, reply, and resolution. The agent merges autonomously when each phase's review loop converges; it pauses only on iteration-cap, hard safety boundaries, or unrecoverable errors.

**Recommendation:** ship as a thin orchestrator (Approach C) that wraps existing agents, plus a new `backend-implementer` for cross-repo features and a new `researcher` sub-agent for plan-phase investigation. v1 scope: full spec→plan→impl cycle for muuvie, backend, or both; configurable per-phase iteration caps; per-feature documentation folder under `research/features/<slug>/` with a `research/` subfolder holding one file per researcher invocation; plan doc links to those files via `## Research References`.

## Problem Statement

Current pipeline (pm-spec → architect-review → implementer-tester → validator → reviewer) requires the user to manually sequence each phase, open PRs, decide when to merge, manage reviewer feedback threads, and bump submodule refs. Cross-repo features need the user to coordinate two repos by hand. Plan-phase research is informal and inconsistent across features.

Goal: collapse this orchestration into a single agent invocation. User provides the feature idea + answers kickoff questions; agent handles everything else end-to-end, including responding to reviewer feedback (fix-or-justify per comment), until each phase's PR converges and merges.

Scope boundaries:
- Single-user, single feature per invocation (no parallel features)
- Spec/plan PRs land in meta-repo; impl PRs in submodules; final submodule-ref bump in meta-repo
- User-chosen target branch (main / develop / epic/<x>), not hardcoded
- Fully autonomous merging — no human gates between iterations or phases
- Hard safety boundaries (no force push, no main writes unless explicit, no hook bypass, no secret commits)

## Options Evaluated

### Option A: Monolithic Agent
**Description**: Single `ultimate-developer.md` (~600 lines) containing all logic inline — brainstorm Q&A, spec writing, plan writing, branch ops, PR ops, review loop, GH thread management, autonomous merge. No sub-agent dispatch beyond reviewer for findings.

**Pros**:
- One file, fully self-contained [Source: Analysis]
- No flag plumbing across sub-agents [Source: Analysis]

**Cons**:
- Massive prompt prone to context-window pressure on long runs [Source: Analysis]
- Duplicates `pm-spec`, `architect-review`, `implementer-tester` responsibilities, creating drift risk [Source: agents/pm-spec.md, agents/architect-review.md, agents/implementer-tester.md]
- Fragile to edits — single file change affects all phases [Source: Analysis]

**Verdict**: Rejected — duplication and fragility outweigh self-containment benefit.

### Option B: Phase-Runner Sub-Agents
**Description**: Thin `ultimate-developer` orchestrator + three new sub-agents (`ud-spec-runner`, `ud-plan-runner`, `ud-impl-runner`) each owning one phase end-to-end (write artifact, open PR, run review loop, merge). Orchestrator sequences them.

**Pros**:
- Clean separation per phase [Source: Analysis]
- Each runner testable independently [Source: Analysis]

**Cons**:
- 4 new agent files instead of 1 [Source: Analysis]
- Shared logic (PR ops, loop driver, GH thread management) duplicates across runners [Source: Analysis]
- Parallel sub-agent dispatch increases token cost per run [Source: Analysis]

**Verdict**: Rejected — duplication tax outweighs separation benefit when phases are sequential anyway.

### Option C: Orchestrator over Existing Pipeline (Recommended)
**Description**: `ultimate-developer` wraps existing pipeline agents. Spec phase → dispatch `pm-spec` + `architect-review` (audit-only). Plan phase → dispatch new `researcher` agent per topic in parallel, then write plan inline (no existing plan-writer agent today) linking to research files + dispatch `reviewer` (audit-only). Impl phase → dispatch `implementer-tester` (muuvie) and/or new `backend-implementer` (backend) + dispatch `reviewer` + `validator` (both audit-only). Ultimate-developer owns branch ops, PR ops, review loop driver, GH thread authoring, cross-repo coordination, autonomous merging.

**Pros**:
- Smallest diff to existing pipeline [Source: agents/README.md, agents/*.md]
- Sub-agents stay independently testable and human-invokable [Source: agents/reviewer.md, agents/validator.md]
- `/review-pr` slash command unaffected — humans still get default behavior [Source: commands/]
- New logic confined to: loop driver, GH thread author, branch/PR ops, research enforcement, cross-repo coordination [Source: Analysis]
- Audit-only flag is a small, reusable addition [Source: Analysis]

**Cons**:
- Needs `mode` flag plumbed through 4 agents [Source: Analysis]
- Ultimate-developer still ~400 lines [Source: Analysis]

**Verdict**: **Chosen** — best balance of reuse, separation, and incremental change.

## Recommended Approach

Approach C — orchestrator wrapping existing pipeline + new `backend-implementer` agent + `mode: "audit-only"` flag on 4 existing agents.

### Workflow State Machine

```
[INVOKE] /ultimate-feature "<request>"
    │
    ▼
PHASE 0 — Kickoff (ONLY user touchpoint)
    • Skill(superpowers:brainstorming) → user Q&A
    • Ask: target branch (main / develop / epic/<x>)
    • Ask: scope (muuvie / backend / both)
    • Output: brainstorm transcript + parameters
    │
    ▼
PHASE 1 — Spec
    • Task(pm-spec, slug=<slug>) → research/features/<slug>/spec.md
    • Branch feature/<slug>-spec from <target> (meta-repo)
    • Commit + push + open PR → <target>
    • Review loop:
        - Task(architect-review, mode="audit-only") → JSON
        - Task(reviewer, mode="audit-only", pr=<N>) → JSON
        - Aggregate, dedupe, post inline comments as ultimate-developer
        - Per thread: fix-or-reject decision (autonomous), commit fixes, reply, resolve
        - Converge OR cap (default 5) → escalate if cap hit
    • Merge with squash + delete branch
    │
    ▼
PHASE 2 — Plan
    • Enumerate research topics (resources + prior-art patterns) from merged spec
    • Task(researcher, ...) per topic in parallel → research/features/<slug>/research/*.md
    • Skill(superpowers:writing-plans, slug=<slug>) with overridden output path
    • Plan doc includes mandatory ## Research References section linking the files
    • Branch feature/<slug>-plan from <target> (meta-repo)
    • Commit + push + open PR → <target> (plan + research files in one atomic commit)
    • Review loop (reviewer audit-only, cap default 5)
        - If reviewer flags "missing research on X" → dispatch new researcher(topic=X), link, push, re-run
    • Merge
    │
    ▼
PHASE 3 — Implementation
    • If scope == both: backend first
    • For each repo in scope:
        - cd <submodule>, checkout <target> branch in submodule, pull
        - git checkout -b feature/<slug>
        - Task(implementer-tester|backend-implementer, slug=<slug>) → code + tests
        - Push + open PR → <target> in submodule
        - Review loop (reviewer + validator audit-only, cap default 10)
        - Merge submodule PR
    • Meta-repo: chore/<slug>-bump-refs branch
        - git add <submodule(s)>, commit, push, PR → <target>
        - Merge (no review loop — ref bump only)
    │
    ▼
[DONE] Summary: feature, PRs, commits, iterations per phase
```

### Branch + PR Conventions

| Phase | Branch (repo) | PR base |
|-------|---------------|---------|
| Spec | `feature/<slug>-spec` (meta-repo) | `<target>` |
| Plan | `feature/<slug>-plan` (meta-repo) | `<target>` |
| Impl (muuvie) | `feature/<slug>` (muuvie submodule) | `<target>` in muuvie |
| Impl (backend) | `feature/<slug>` (backend submodule) | `<target>` in backend |
| Submodule ref bump | `chore/<slug>-bump-refs` (meta-repo) | `<target>` |

`<slug>` = kebab-case of feature title, max 40 chars.

Each PR body includes a marker comment for re-entry recovery:
```
<!-- ultimate-developer:phase=spec|plan|impl repo=meta|muuvie|backend slug=<slug> -->
```

### Review Loop Driver (Per Phase)

```
iter = 0
MAX_ITER = phase_cap()  // spec=5, plan=5, impl=10 (env-overridable)
while iter < MAX_ITER:
    iter += 1

    prior_comments = gh_list_root_comments(pr)
    findings = dispatch_reviewers_audit_only(pr, phase)  // returns aggregated JSON
    new_findings = dedupe(findings, prior_comments)

    if new_findings:
        post_inline_review(pr, new_findings)  // ultimate-developer authors

    open_threads = gh_list_unresolved_threads(pr)

    for thread in open_threads:
        decision = judge_finding(thread)  // autonomous: fix | reject | defer
        if decision == "fix":
            apply_fix(thread)
            commit_and_push(f"fix: address review finding — {thread.title}")
            sha = head_sha()
            reply_thread(thread, f"Fixed in {sha}. {one_line_how}")
            resolve_thread(thread)
        elif decision == "reject":
            reply_thread(thread, f"Won't fix. {justification}")
            resolve_thread(thread)
        elif decision == "defer":
            escalate(pr, thread)
            return ABORTED  // only fix-path that exits

    if len(new_findings) == 0 and len(open_threads) == 0:
        break  // converged

if iter == MAX_ITER and not converged:
    escalate(pr, reason="iteration_cap")
    return CAP_HIT

merge_pr(pr, "squash --delete-branch")
sleep_30s_for_external_bots()
verify_merge()
```

**Per-phase caps (env-overridable):**

| Phase | Default | Env var |
|-------|---------|---------|
| Spec | 5 | `UD_MAX_ITER_SPEC` |
| Plan | 5 | `UD_MAX_ITER_PLAN` |
| Impl | 10 | `UD_MAX_ITER_IMPL` |

**Audit log** appended each iteration to `research/features/<slug>/review-log.md`: iteration #, phase, findings JSON, decisions per thread, SHAs of fix commits. Durable trail outside GitHub.

### `mode: "audit-only"` Sub-Agent Contract

Flag communicated via `Task` prompt body (Task tool has no formal arg passing). Each agent gates its side-effecting steps when `mode=audit-only` is present.

**`reviewer`** — skip Step 2 (auto-resolve threads) and Step 9 (POST inline review). Still run Steps 1, 3–8. Return STRICT JSON per Step 10 schema.

**`validator`** — skip PR Inline-Comment Mode section entirely (no dispatch to reviewer). Still write local report. Return new JSON summary schema (TBD — to be defined in agent prompt edit).

**`architect-review`** — write per-pass file `research/features/<slug>/architect-review-pass-<N>.md` instead of `research/reviews/<feature>.md`. Return STRICT JSON `{decision, blockers[], recommendations[], findings[]}`.

**`pm-spec`** — accept `slug=<slug>` arg, write to `research/features/<slug>/spec.md`. No behavior change beyond path override (already returns spec doc, no GH writes). Reserved for future symmetry.

Default behavior (without `mode` flag) unchanged — humans calling `/review-pr` get full GH-writing behavior.

### Research Enforcement (Plan Phase) — `researcher` sub-agent

Plan doc does NOT embed research content (would bloat the doc). Instead, ultimate-developer dispatches a new `researcher` sub-agent once per topic; each invocation produces a standalone research file. The plan doc links to those files in a `## Research References` section.

**`researcher` agent contract:**
- Inputs (passed via Task prompt): `path=<absolute output path>`, `topic=<what to research>`, `type=<resource-docs|prior-art|mixed>`, `context=<1-3 sentences linking topic to the feature>`
- Tools: `Read, Write, WebSearch, WebFetch`
- Behavior: invokes `WebSearch` + `WebFetch` against authoritative sources, writes a single markdown file at `<path>` following the template below, then returns a one-line summary suitable for the plan's reference list
- Default model: `sonnet` (research is read+synthesize, doesn't need opus orchestration)

**Researcher output template** (file format, with YAML header per muuvie-research-format):

```markdown
---
date: YYYY-MM-DD
author: researcher agent
status: draft
type: resource-docs | prior-art | mixed
tags: [...]
---

# Research: <topic>

## Context
<1-2 sentences: which feature, what the open question is>

## Findings

### (type=resource-docs) Official Documentation
- **<resource name>** — version `<pinned-version>`
  - Source: <URL> (fetched YYYY-MM-DD)
  - Key concepts: <2-5 bullet excerpts relevant to the feature>
  - Gotchas / caveats: <any from docs>
  - Quote + link, no unattributed paraphrase

### (type=prior-art) Examples in the wild
For each of 2-3 references:
- **<company / project>** — <feature name>
  - Source: <URL> (fetched YYYY-MM-DD)
  - Approach summary: <1-2 sentences>
  - What we'll adopt: <bullet>
  - What we'll skip / do differently: <bullet + reason>

(type=mixed → include both subsections)

## Summary
<2-3 sentences. This is what ultimate-developer copies into the plan's reference list.>

## Searches Performed
- "<query 1>" — N results, M relevant
- "<query 2>" — ...

(If a search returned nothing relevant, record `no relevant results` so reviewers can verify research was attempted.)
```

**Per-feature layout:**

```
research/features/<slug>/
  spec.md
  plan.md                          ← has ## Research References linking ↓
  research/
    <topic-slug-1>.md              ← one file per researcher invocation
    <topic-slug-2>.md
    ...
  review-log.md
```

**Plan-phase workflow:**

1. Ultimate-developer reads merged spec
2. Enumerates resources (libraries / APIs / frameworks the plan will introduce) and patterns (similar features worth studying) → topic list
3. Dispatches `researcher` per topic in parallel (single message, multiple `Task` calls)
4. Each researcher writes `research/features/<slug>/research/<topic-slug>.md`, returns summary line
5. Ultimate-developer drafts `plan.md`. Its `## Research References` section lists each research file with the summary line + relative link:
   ```markdown
   ## Research References
   - [TMDB watch-providers endpoint](research/tmdb-watch-providers.md) — Endpoint returns per-region streaming availability; rate-limited to 40 req/10s; requires bearer auth.
   - [Letterboxd "where to watch" UX](research/letterboxd-where-to-watch.md) — Inline chips below film header; per-region filter via user setting.
   ```
6. Plan PR opens; review loop runs

**Enforcement:**
- Plan template includes `## Research References` as required H2 — empty list = block before push
- If reviewer (audit-only) flags "missing research on X", ultimate-developer's fix-path dispatches a new `researcher(topic=X)`, links the resulting file in plan, pushes, re-runs review pass
- All research files committed alongside plan in the same PR (single atomic plan PR with all referenced research)

### Cross-Repo Handling

User picks scope at kickoff: `muuvie` / `backend` / `both`.

**Single-repo flow** — checkout submodule's `<target>` branch, create `feature/<slug>`, dispatch matching implementer, PR + loop + merge, then meta-repo bump PR.

**Cross-repo flow** (both) — backend first:
1. Backend impl phase A: branch, dispatch `backend-implementer`, PR + loop + merge in backend
2. Capture merged backend API contract (endpoints, request/response shapes) from spec or merged code → pass to muuvie implementer prompt
3. Muuvie impl phase B: branch, dispatch `implementer-tester` (with backend SHA + contract in prompt), PR + loop + merge in muuvie
4. Final meta-repo `chore/<slug>-bump-refs` PR bumps BOTH submodule refs in one commit

### Safety Circuits + Escalation

**Escalate to user (stop autonomous flow) when:**
1. Iteration cap hit without convergence on any phase
2. Reviewer flags CRITICAL finding agent cannot resolve in 3 fix attempts
3. Merge fails (CI red, required reviews missing, branch protection)
4. Submodule push rejected after one rebase attempt
5. WebSearch / WebFetch unavailable during plan phase → can't satisfy research requirement
6. Spec/plan PR review surfaces fundamental infeasibility (e.g., violates ecosystem arch)
7. Hook blocks commit (NO_COAUTHORS, DOCS_UP_TO_DATE, etc.) — fix and retry once, escalate if still blocked
8. Test failures during impl phase agent cannot resolve in 3 attempts

**Escalation channel:** stdout message + PR comment with structured payload:
```
## ultimate-developer escalation
Phase: <spec|plan|impl>
PR: #<N>
Reason: <enum>
Context: <2-3 sentences>
Suggested action: <what user should decide>
```

**Hard safety boundaries (NEVER, regardless of decision):**
- Force push (`--force`, `--force-with-lease`)
- `git reset --hard` on shared branches
- Merge to `main` / `master` unless `<target>` is explicitly that branch (and warn in escalation)
- Skip hooks (`--no-verify`)
- Bypass branch protection
- Delete branches user did not authorize (only own feature branches post-merge)
- Modify CI/CD config without explicit user request
- Commit secrets / `.env` / credentials files — scan staged diff for common patterns before every commit

**Kill switch:** check for `.claude/UD_HALT` sentinel file between phase transitions. If present, stop cleanly (don't merge in-progress PR, post status comment, exit).

## Implementation

### Files Created

| Path | Purpose | ~Size |
|------|---------|-------|
| `agents/ultimate-developer.md` | Main orchestrator agent | ~400 lines |
| `agents/backend-implementer.md` | Kotlin/Ktor mirror of implementer-tester | ~250 lines |
| `agents/researcher.md` | Per-topic research agent (path + topic + type) → writes one research file | ~120 lines |
| `rules/backend-architecture.md` | Backend module layout, routing, Koin DI patterns | ~150 lines |
| `rules/backend-testing.md` | Backend test conventions (JUnit/Kotest, Ktor test harness) | ~100 lines |
| `commands/ultimate-feature.md` | Slash command `/ultimate-feature "<request>"` | ~30 lines |
| `research/features/` | New folder for per-feature docs (each `<slug>/` holds spec.md, plan.md, research/, review-log.md) | — |
| `research/features/ultimate-developer/spec.md` | This document | — |

### Files Modified

| Path | Change |
|------|--------|
| `agents/reviewer.md` | Add `mode: "audit-only"` handling: skip Steps 2 + 9 |
| `agents/validator.md` | Add `mode: "audit-only"` handling: skip PR Inline-Comment Mode; add JSON output schema |
| `agents/architect-review.md` | Add `mode: "audit-only"` handling: per-pass file naming, JSON output schema |
| `agents/pm-spec.md` | Accept `slug=<slug>` arg, default write path to `research/features/<slug>/spec.md` |
| `agents/implementer-tester.md` | Accept `slug=<slug>` arg, read spec/plan from `research/features/<slug>/` |
| `agents/README.md` | Document `ultimate-developer` + `backend-implementer` + new flow |
| `CLAUDE.md` | Mention `ultimate-developer` in pipeline section, add `/ultimate-feature` to commands list |
| `.claude/CLAUDE.md` | Note the `audit-only` flag convention; add to skill autoload mentions |
| `rules/README.md` | Register `backend-architecture` + `backend-testing` rules |

### Hook Impact

- `check-docs-sync.sh` may flag new agent files as needing docs updates → satisfied by README/CLAUDE updates above [Source: rules/DOCS_UP_TO_DATE.md]
- `check-coauthor.sh` already blocks co-author trailers → ultimate-developer must omit them [Source: rules/NO_COAUTHORS.md]
- `check-submodule-ai.sh` already blocks AI-tooling files in submodules → backend-implementer must not write CLAUDE.md / .claude/ to backend [Source: rules/AI_AGNOSTIC_SUBMODULES.md]
- No new hooks required

### Open Implementation Questions (resolve during writing-plans phase)

1. JSON output schemas for `validator` and `architect-review` audit-only modes — exact field names and required fields
2. How ultimate-developer reads JSON output of Task-dispatched sub-agents — Task tool returns a single message; parse JSON from stdout/last message
3. Backend rules content — what exactly goes in `rules/backend-architecture.md` and `rules/backend-testing.md`; may require a small upfront audit of existing `backend/` code
4. Whether `research/features/<slug>/review-log.md` should be machine-parseable (structured YAML/JSON appended per iteration) or free-form markdown — affects re-entry recovery if agent is interrupted mid-loop
5. Cross-repo API contract handoff — exact format for passing backend endpoint contract to muuvie implementer (likely embed in muuvie implementer-tester prompt as a code block)
6. Researcher topic enumeration heuristics — how does ultimate-developer decide which topics warrant their own research file? Proposed: every new third-party resource (library, API, framework) introduced in the plan + every "novel UX/pattern" the spec references gets one file. Need explicit rule to avoid over-research (e.g., don't research Flutter `Text` widget).
7. Researcher parallel-dispatch cap — what if topic list grows to 20+? Proposed: cap parallel `Task(researcher)` calls at 5, queue the rest.
8. Researcher output deterministic-ness — two invocations on same topic should produce reasonably similar files; need a stable template + prompt phrasing in `agents/researcher.md` to make this true.

## Alternative Approaches

Approach A (Monolithic) rejected — duplication + fragility.
Approach B (Phase-runners) rejected — shared-logic duplication tax outweighs separation.
Trade-offs accepted by choosing C: must maintain `mode` flag plumbing across 4 agents; ultimate-developer is still a large file (~400 lines); cross-repo coordination logic lives in ultimate-developer rather than dedicated agent.

## Next Steps

- [ ] User reviews this spec → approves or requests changes (gate before next step)
- [ ] Invoke `superpowers:writing-plans` to produce detailed implementation plan with research section (target: research/features/ultimate-developer/plan.md)
- [ ] Plan covers: file-by-file edits, ordering of mode-flag rollout across agents, backend rules content, JSON schemas for audit-only outputs, test strategy for ultimate-developer's loop driver
- [ ] After plan approved → implement in order: backend rules → audit-only flags on existing agents → backend-implementer → ultimate-developer → slash command → docs sync
- [ ] First real run: pick a small muuvie-only feature as smoke test; verify each phase + cap behavior
