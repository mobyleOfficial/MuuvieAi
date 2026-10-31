# Ultimate Developer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `ultimate-developer` agent — autonomous end-to-end feature builder that drives spec → plan → impl phases via review-and-iterate loops on GitHub PRs, with all sub-agent GH writes suppressed via a `mode: "audit-only"` flag.

**Architecture:** Orchestrator agent (Approach C in spec) wrapping existing pipeline (`pm-spec`, `architect-review`, `implementer-tester`, `validator`, `reviewer`) plus two new agents (`researcher`, `backend-implementer`). The orchestrator owns: branch/PR ops, review loop driver, GitHub thread authoring (replies + resolves), cross-repo coordination, autonomous merging, safety circuits.

**Tech Stack:** Markdown prompts (agents), Bash + jq + `gh` CLI + GraphQL (PR ops), `Task` tool (sub-agent dispatch), `WebSearch` / `WebFetch` (researcher), GitHub REST + GraphQL APIs.

**Spec reference:** `research/features/ultimate-developer/spec.md` — every decision below traces to a spec section.

---

## File Structure

| Path | Action | Purpose |
|---|---|---|
| `agents/ultimate-developer.md` | Create | Main orchestrator |
| `agents/researcher.md` | Create | Per-topic research sub-agent |
| `agents/backend-implementer.md` | Create | Kotlin/Ktor mirror of `implementer-tester` |
| `agents/reviewer.md` | Modify | Add `mode: "audit-only"` handling (skip Steps 2 + 9) |
| `agents/validator.md` | Modify | Add `mode: "audit-only"` handling + JSON output schema |
| `agents/architect-review.md` | Modify | Add `mode: "audit-only"` handling + JSON schema + per-pass file naming |
| `agents/pm-spec.md` | Modify | Accept `slug=<slug>` arg, default write path → `research/features/<slug>/spec.md` |
| `agents/implementer-tester.md` | Modify | Accept `slug=<slug>` arg, read from `research/features/<slug>/` |
| `agents/README.md` | Modify | Document new agents + flow |
| `rules/backend-architecture.md` | Create | Backend module layout, Ktor routing, Koin DI |
| `rules/backend-testing.md` | Create | Backend test conventions (JUnit/Kotest, Ktor test harness) |
| `rules/README.md` | Modify | Register backend rules |
| `commands/ultimate-feature.md` | Create | Slash command entry point |
| `CLAUDE.md` | Modify | Document ultimate-developer + /ultimate-feature |
| `.claude/CLAUDE.md` | Modify | Note `audit-only` flag convention |
| `.claude/hooks/validate-audit-only.sh` | Create | Optional shell helper used by smoke tests to verify `mode` flag parsing |
| `research/features/ultimate-developer/spec.md` | Already exists | Source of truth |
| `research/features/ultimate-developer/plan.md` | Create (this file) | This plan |

**Implementation order:** Backend rules → Audit-only flag rollout → Slug-arg updates → Researcher → Backend implementer → Ultimate developer → Slash command → Docs sync → End-to-end smoke test. Order chosen so each phase's outputs are consumed by later phases without rework.

---

## Conventions Used Throughout

- **Working directory:** All commands assume PWD = meta-repo root (`MuuvieAi/`). Set once at start: `cd <path-to-MuuvieAi>`. The plan uses relative paths thereafter (e.g., `rules/backend-architecture.md`, not absolute `/Users/.../MuuvieAi/rules/...`). Submodule commands explicitly note when to `cd <submodule>`.
- **Repo variable:** Set `REPO=mobyleOfficial/MuuvieAi` once at top of any shell session that uses `gh api` raw calls (calls without `gh pr`/`gh repo` shortcuts). Use `gh api repos/${REPO}/...` thereafter so this plan is reusable in forks.
- **Temp files:** Use `mktemp` for scratch files (`SMOKE=$(mktemp -t ud-smoke.XXXXXX); trap 'rm -f "$SMOKE"' EXIT`), never hardcoded `/tmp/test-*.sh` (multi-user collision risk). The X's MUST be the trailing characters of the template — GNU mktemp rejects templates like `ud-smoke.XXXXXX.sh` where extra characters follow the X's. The `trap ... EXIT` ensures cleanup even on early script failure or Ctrl-C; explicit `rm "$SMOKE"` at end of task remains as belt-and-suspenders and becomes a no-op if trap already fired.
- **Branch:** Stay on the user's current working branch unless explicitly told to cut a new one. The execution model is: this is a feature branch in the meta-repo; we are implementing the feature in-place.
- **Commits:** Conventional Commits (`feat:`, `doc:`, `chore:`, `fix:`, `test:`). No co-author trailers (NO_COAUTHORS rule).
- **File-staging:** `git add` named files, never `-A` or `.`.
- **"Smoke test"** for agent prompt files = grep for required sections and frontmatter. We cannot execute an agent during build; the actual behavioral test is the end-to-end run in Phase 9.

---

## Phase 0 — Pre-flight

### Task 0.1: Verify environment

**Files:** None modified.

- [ ] **Step 1: Confirm working directory + branch**

Run:
```bash
pwd
git status --short
git branch --show-current
```
Expected: working dir = meta-repo root (`MuuvieAi/`), branch reported, status may show the existing `research/features/` from spec.

- [ ] **Step 2: Confirm required tools available**

Run:
```bash
which jq gh git && gh auth status
```
Expected: all three present; `gh auth status` shows authenticated to `mobyleOfficial/MuuvieAi`. If `gh` not authed → stop, escalate to user.

- [ ] **Step 3: Confirm submodules initialized**

Run:
```bash
git submodule status
```
Expected: lines for `muuvie` and `backend` (no leading `-` indicating uninitialized). If uninitialized → run `git submodule update --init --recursive`.

- [ ] **Step 4: No commit. Move on.**

---

## Phase 1 — Backend Rules

### Task 1.1: Audit existing `backend/` structure

**Files:** None modified — read-only audit. Notes captured inline (not saved) and used to inform Tasks 1.2–1.3.

- [ ] **Step 1: Enumerate backend source tree**

Run:
```bash
find backend/src -type f -name '*.kt' | head -50
ls backend
```
Capture: top-level layout, package structure under `src/main/kotlin/`, presence of Application.kt, routing files, Koin modules.

- [ ] **Step 2: Read top-level Kotlin entry + one routing module**

```bash
# Locate entry
grep -rn "fun main" backend/src/main/kotlin/ | head -5
# Inspect Application.kt and the first routing file we find
```
Use the `Read` tool on each file located (not `cat`). Note: package conventions, plugin install pattern (`install(ContentNegotiation)`), serialization choice, DI module shape, error handling.

- [ ] **Step 3: Read `build.gradle.kts` for dependency pinning**

Read `backend/build.gradle.kts`. Note Ktor version, Kotlin version, Koin version, serialization library, test deps (JUnit / Kotest), HTTP client used for TMDB calls.

- [ ] **Step 4: No commit. Findings feed the next two tasks.**

### Task 1.2: Write `rules/backend-architecture.md`

**Files:**
- Create: `rules/backend-architecture.md`

- [ ] **Step 1: Write the smoke test for backend-architecture rule**

Create the smoke test in a `mktemp` file (avoids `/tmp/*` collisions when multiple users run the plan on a shared host):
```bash
SMOKE=$(mktemp -t ud-smoke.XXXXXX)
trap 'rm -f "$SMOKE"' EXIT
chmod +x "$SMOKE"
cat > "$SMOKE" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
F=rules/backend-architecture.md
[ -f "$F" ] || { echo "FAIL: file missing"; exit 1; }
for section in "## Module Layout" "## Routing" "## Dependency Injection" "## Error Handling" "## TMDB Integration"; do
  grep -qF "$section" "$F" || { echo "FAIL: missing section: $section"; exit 1; }
done
echo "PASS"
EOF
"$SMOKE"
```
Expected: FAIL (file missing).

- [ ] **Step 2: Write the rule file**

Create the file with five required sections. Each section captures the OBSERVED pattern from Task 1.1, not invented practice. Template (fill `<observed>` slots from Task 1.1 notes):

```markdown
# Backend Architecture Rule

Applies to: `backend/` submodule. Kotlin 2.0.20 + Ktor 2.3.0 + Koin 3.5.6 (or as observed in build.gradle.kts).

## Module Layout

Source root: `backend/src/main/kotlin/<root-package>/`. Sub-packages:

- `<root>/Application.kt` — entry point, `embeddedServer(Netty, ...)` + module install
- `<root>/plugins/` — Ktor plugin installation (ContentNegotiation, StatusPages, Routing, etc.)
- `<root>/routes/` — Route definitions, one file per resource (e.g. `MovieRoutes.kt`, `WatchProvidersRoutes.kt`)
- `<root>/services/` — Business logic; receives DI-injected dependencies
- `<root>/data/` — TMDB client wrappers, DTOs, mappers from TMDB → internal domain
- `<root>/di/` — Koin modules (`module { single<X> { ... } }`)
- `<root>/models/` — Internal domain types serialized to JSON responses

`backend/src/test/kotlin/<root-package>/` mirrors `main/` exactly.

## Routing

- One route file per top-level resource path
- Routes installed via `Application.module()` → `routing { ... }`
- Each route extracts inputs, calls a service method, returns `call.respond(...)` with a typed body
- No business logic in route bodies — delegate to services

Example shape:
```kotlin
fun Route.movieRoutes() {
    val service: MovieService by inject()
    get("/movies/{id}") {
        val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest)
        call.respond(service.fetchMovie(id))
    }
}
```

## Dependency Injection

- All services + clients registered as Koin `single { }`
- Routes use `by inject()` for dependencies
- One Koin module per logical area (e.g., `movieModule`, `httpClientModule`)
- All modules installed in `Application.module()` via `install(Koin) { modules(...) }`
- TMDB API key injected via `environment.config.property("ktor.tmdb.apiKey").getString()` — never hard-coded

## Error Handling

- Service layer throws domain exceptions (`MovieNotFoundException`, `TmdbRateLimitedException`, etc.)
- A single `StatusPages` plugin maps exceptions → HTTP responses:
  - `MovieNotFoundException` → 404 + error JSON
  - `TmdbRateLimitedException` → 503 + Retry-After
  - `IllegalArgumentException` → 400
  - Else → 500 + opaque message (no stack trace leak)
- Never `try/catch` inside route handlers — let exceptions propagate to `StatusPages`

## TMDB Integration

- Single HTTP client (`HttpClient(CIO)` or `OkHttp`) injected via Koin
- Bearer auth header set globally on client install
- All TMDB endpoints accessed via typed wrappers in `data/tmdb/`, never raw HttpClient calls from services
- TMDB DTOs (`*.tmdb.dto.kt`) `@Serializable`; mapper functions convert to internal models before returning from data layer
- Rate-limit handling: catch 429 → throw `TmdbRateLimitedException` with Retry-After value
```

Use the `Write` tool to create the file. Adjust `<root-package>` placeholder to the actual observed package from Task 1.1.

- [ ] **Step 3: Re-run the smoke test**

```bash
"$SMOKE"
```
Expected: `PASS`.

- [ ] **Step 4: Commit + cleanup**

```bash
git add rules/backend-architecture.md
git commit -m "doc: add backend-architecture rule for Ktor/Koin/TMDB patterns"
rm "$SMOKE"
```

### Task 1.3: Write `rules/backend-testing.md`

**Files:**
- Create: `rules/backend-testing.md`

- [ ] **Step 1: Smoke test**

Create the smoke test (mktemp pattern, per Conventions):
```bash
SMOKE=$(mktemp -t ud-smoke.XXXXXX)
trap 'rm -f "$SMOKE"' EXIT
chmod +x "$SMOKE"
cat > "$SMOKE" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
F=rules/backend-testing.md
[ -f "$F" ] || { echo "FAIL: missing"; exit 1; }
for s in "## Test Structure" "## Unit Tests" "## Route Tests" "## TMDB Mocking" "## Coverage Expectations"; do
  grep -qF "$s" "$F" || { echo "FAIL: $s"; exit 1; }
done
echo PASS
EOF
"$SMOKE"
```
Expected: FAIL.

- [ ] **Step 2: Write the rule**

```markdown
# Backend Testing Rule

Applies to: `backend/src/test/kotlin/`. Aligns with `rules/backend-architecture.md`.

## Test Structure

`backend/src/test/kotlin/<root-package>/` mirrors `main/`:
- `routes/MovieRoutesTest.kt` tests `routes/MovieRoutes.kt`
- `services/MovieServiceTest.kt` tests `services/MovieService.kt`
- `data/tmdb/MovieTmdbClientTest.kt` tests `data/tmdb/MovieTmdbClient.kt`

One test class per production class. File naming: `*Test.kt`.

## Unit Tests

- Service-layer tests use plain JUnit 5 (no Ktor harness needed)
- Mock injected dependencies via MockK (`val client = mockk<TmdbClient>()`)
- Each public function gets ≥ 1 test covering the happy path + ≥ 1 covering the failure path

## Route Tests

Use Ktor's `testApplication { ... }` harness:
```kotlin
@Test
fun `GET movies returns 200 with body`() = testApplication {
    application { module() }
    val response = client.get("/movies/123")
    assertEquals(HttpStatusCode.OK, response.status)
    val body = Json.decodeFromString<Movie>(response.bodyAsText())
    assertEquals(123, body.id)
}
```
Inject test doubles via a test-only Koin module override.

## TMDB Mocking

- Never call real TMDB in tests
- Mock `TmdbClient` via MockK; return DTO fixtures from `src/test/resources/tmdb/<endpoint>.json`
- For HTTP-level tests, use Ktor's `MockEngine` with canned responses

## Coverage Expectations

- All route handlers: 1 happy-path + 1 error-path test
- All service methods: ≥ 1 unit test each
- All TMDB client wrappers: 1 success + 1 rate-limit test (429 → `TmdbRateLimitedException`)
- `./gradlew test` must pass before any PR opens

No coverage percentage gate — gate is on the per-class expectations above.
```

Create with `Write`.

- [ ] **Step 3: Re-run smoke test**

```bash
"$SMOKE"
```
Expected: PASS.

- [ ] **Step 4: Commit + cleanup**

```bash
git add rules/backend-testing.md
git commit -m "doc: add backend-testing rule for Ktor/JUnit/MockK patterns"
rm "$SMOKE"
```

### Task 1.4: Register backend rules in `rules/README.md`

**Files:**
- Modify: `rules/README.md`

- [ ] **Step 1: Read current `rules/README.md` to locate the enforcement-map table**

- [ ] **Step 2: Add two new rows to the table**

Add (immediately after the row for `variable-naming` or whatever is the last Flutter rule):

| Rule | Applies to | Enforced by |
|------|------------|-------------|
| `backend-architecture` | `backend/` submodule | `backend-implementer` agent + reviewer architecture sub-reviewer |
| `backend-testing` | `backend/src/test/` | `backend-implementer` agent (test scaffolding) |

Use the `Edit` tool — find the existing table and add the two rows.

- [ ] **Step 3: Commit**

```bash
git add rules/README.md
git commit -m "doc: register backend-architecture + backend-testing rules"
```

---

## Phase 2 — Audit-Only Flag Rollout

### Task 2.1: Shared `mode` parsing helper for smoke tests

**Files:**
- Create: `.claude/hooks/validate-audit-only.sh`

- [ ] **Step 1: Write helper**

```bash
#!/usr/bin/env bash
# Used by smoke tests to verify each audit-only-aware agent declares the contract.
# Usage: validate-audit-only.sh <agent-md-path>
set -euo pipefail
F="${1:?agent file path required}"
[ -f "$F" ] || { echo "FAIL: $F missing"; exit 1; }
# Lenient detector — matches mode: "audit-only" / mode=audit-only / MODE : 'audit-only' / etc.
# Case-insensitive; tolerates whitespace and either quote style. Same regex the agents use at runtime,
# so the smoke test catches drift (e.g., if someone writes mode='audit_only' with underscore).
grep -qiE 'mode[[:space:]]*[:=][[:space:]]*["'"'"']*audit-only["'"'"']*' "$F" \
  || { echo "FAIL: $F missing audit-only contract (regex: mode[:=]\"?audit-only\"?)"; exit 1; }
grep -qF 'STRICT JSON' "$F" || { echo "FAIL: $F missing JSON output contract"; exit 1; }
echo "PASS: $F"
```

- [ ] **Step 2: chmod + commit**

```bash
chmod +x .claude/hooks/validate-audit-only.sh
git add .claude/hooks/validate-audit-only.sh
git commit -m "chore: add smoke-test helper for audit-only flag contract"
```

### Task 2.2: Add audit-only mode to `agents/reviewer.md`

**Files:**
- Modify: `agents/reviewer.md`

- [ ] **Step 1: Smoke test fails initially**

```bash
.claude/hooks/validate-audit-only.sh agents/reviewer.md
```
Expected: FAIL.

- [ ] **Step 2: Add the audit-only section**

Append to `agents/reviewer.md`, between the existing "Workflow" section and "Strict Rules":

```markdown
## Audit-Only Mode

Detection (use this exact regex; matches canonical `mode: "audit-only"` plus lenient variants like `mode=audit-only`, `MODE: 'audit-only'`, etc.):

```
echo "$PROMPT" | grep -qiE 'mode[[:space:]]*[:=][[:space:]]*["'\'']*audit-only["'\'']*'
```

When the regex matches:

1. **SKIP Step 2** entirely — do not reply to or resolve any prior threads. Leave thread state untouched.
2. **SKIP Step 9** entirely — do not POST a review. Return the STRICT JSON summary from Step 10 to stdout as the sole output.
3. All other steps (1, 3–8) run unchanged.

Rationale: the caller (typically `ultimate-developer`) owns all GitHub thread management and posts comments under its own authorship. This mode lets `reviewer` act as a pure analyzer.

The Step 10 JSON schema is the contract — do not add or remove fields. Callers parse `posted_comments: 0` and the `comments` array to know what to post themselves.

Default behavior (no `mode` flag) is unchanged: full GH-writing pipeline as documented above.
```

- [ ] **Step 3: Re-run smoke test**

```bash
.claude/hooks/validate-audit-only.sh agents/reviewer.md
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add agents/reviewer.md
git commit -m "feat(reviewer): add audit-only mode for orchestrator callers"
```

### Task 2.3: Add audit-only mode to `agents/validator.md`

**Files:**
- Modify: `agents/validator.md`

- [ ] **Step 1: Smoke test fails**

```bash
.claude/hooks/validate-audit-only.sh agents/validator.md
```
Expected: FAIL.

- [ ] **Step 2: Add audit-only section**

Append to `agents/validator.md` (after "PR Inline-Comment Mode" section):

```markdown
## Audit-Only Mode

When the invoking prompt contains `mode: "audit-only"`:

1. **SKIP the PR Inline-Comment Mode section entirely** — do not detect PRs, do not dispatch `reviewer` subagent.
2. Still write the local validation report to `research/features/<slug>/review-log.md` if `slug=<slug>` is also provided (otherwise the legacy path).
3. Append a STRICT JSON summary to stdout as the sole structured output:

```json
{
  "status": "PASS" or "FAIL",
  "summary": "<one-paragraph overall assessment>",
  "findings": [
    {
      "severity": "critical" | "important" | "minor",
      "category": "architecture" | "security" | "testing" | "performance" | "localization" | "accessibility" | "code-quality" | "correctness",
      "title": "<short>",
      "location": "<path:line>",
      "impact": "<why this matters>",
      "recommendation": "<concrete fix>"
    }
  ],
  "positive_notes": ["<string>", "..."]
}
```

Severity mapping (validator → ultimate-developer thread treatment):
- `critical` → must-fix, agent treats as HIGH-priority fix
- `important` → fix unless cheap reject
- `minor` → fix-or-reject judgment per heuristic

Default behavior (no `mode` flag) unchanged.
```

- [ ] **Step 3: Smoke test PASS**

- [ ] **Step 4: Commit**

```bash
git add agents/validator.md
git commit -m "feat(validator): add audit-only mode with STRICT JSON output schema"
```

### Task 2.4: Add audit-only mode to `agents/architect-review.md`

**Files:**
- Modify: `agents/architect-review.md`

- [ ] **Step 1: Smoke test fails**

- [ ] **Step 2: Append audit-only section**

```markdown
## Audit-Only Mode

When the invoking prompt contains `mode: "audit-only"`:

1. **DO NOT write the decision file to `research/reviews/`.** Instead, write a per-pass artifact at `research/features/<slug>/architect-review-pass-<N>.md` where `<slug>` is provided in the prompt and `<N>` is the iteration counter (also provided).
2. Return STRICT JSON to stdout as the sole structured output:

```json
{
  "decision": "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED",
  "summary": "<one-paragraph rationale>",
  "blockers": [
    {"criterion": "<which review criterion>", "issue": "<what's wrong>", "fix": "<what spec must change>"}
  ],
  "recommendations": [
    {"area": "<what>", "guidance": "<concrete advice>"}
  ],
  "cross_repo_impact": "<sentence describing muuvie/backend split or 'none'>",
  "findings": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "category": "architecture" | "security" | "performance" | "ecosystem-fit" | "feasibility",
      "title": "<short>",
      "explanation": "<why this is a problem>",
      "suggestion": "<concrete fix>"
    }
  ]
}
```

The `findings` array mirrors `reviewer`'s schema so callers can merge findings across reviewers uniformly.

Default behavior unchanged.
```

- [ ] **Step 3: Smoke test PASS**

- [ ] **Step 4: Commit**

```bash
git add agents/architect-review.md
git commit -m "feat(architect-review): add audit-only mode with STRICT JSON + per-pass artifact"
```

---

## Phase 3 — Slug-Arg Updates to Existing Agents

### Task 3.1: `agents/pm-spec.md` accepts `slug=` and writes to per-feature folder

**Files:**
- Modify: `agents/pm-spec.md`

- [ ] **Step 1: Smoke test**

Create the smoke test (mktemp pattern):
```bash
SMOKE=$(mktemp -t ud-smoke.XXXXXX)
trap 'rm -f "$SMOKE"' EXIT
chmod +x "$SMOKE"
cat > "$SMOKE" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
F=agents/pm-spec.md
grep -qF 'slug=' "$F" || { echo FAIL: missing slug arg; exit 1; }
grep -qF 'research/features/' "$F" || { echo FAIL: missing per-feature path; exit 1; }
echo PASS
EOF
"$SMOKE"
```
Expected: FAIL.

- [ ] **Step 2: Edit `agents/pm-spec.md`**

Replace the "Where to Store Specs" section:

```markdown
## Where to Store Specs

When the invoking prompt provides `slug=<feature-slug>`:
- Default path: `research/features/<slug>/spec.md`
- This is the path ultimate-developer uses; it co-locates spec + plan + research + review-log per feature.

When no `slug` is provided (legacy/manual invocation):
- Use the original convention: `research/specs/<feature>.md` for feature specs
- `research/decisions/` for RFCs / architecture decisions
- `research/analysis/` for performance / user research

Use descriptive filenames with dates if helpful when in legacy mode (e.g., `research/specs/movie-search-20260515.md`).
```

- [ ] **Step 3: Smoke test PASS**

- [ ] **Step 4: Commit + cleanup**

```bash
git add agents/pm-spec.md
git commit -m "feat(pm-spec): accept slug= arg, default write to research/features/<slug>/spec.md"
rm "$SMOKE"
```

### Task 3.2: `agents/implementer-tester.md` accepts `slug=` and reads from per-feature folder

**Files:**
- Modify: `agents/implementer-tester.md`

- [ ] **Step 1: Smoke test**

```bash
grep -qF 'slug=' agents/implementer-tester.md && grep -qF 'research/features/' agents/implementer-tester.md && echo PASS || echo FAIL
```
Expected: FAIL.

- [ ] **Step 2: Add a "Reading the Spec / Plan" section near the top of the agent prompt (after "Context: MuuvieAi Ecosystem")**

```markdown
## Reading the Spec & Plan

When the invoking prompt provides `slug=<feature-slug>`:
- Read the spec from `research/features/<slug>/spec.md`
- Read the plan from `research/features/<slug>/plan.md`
- Read each research file linked from the plan's `## Research References` section, located under `research/features/<slug>/research/`

When no `slug` is provided (legacy manual invocation):
- The invoker provides explicit paths to spec and plan in the prompt body.

Follow the plan task-by-task. Cross-reference acceptance criteria from the spec when ambiguous.
```

- [ ] **Step 3: Smoke test PASS**

- [ ] **Step 4: Commit**

```bash
git add agents/implementer-tester.md
git commit -m "feat(implementer-tester): accept slug= arg, read from research/features/<slug>/"
```

---

## Phase 4 — Researcher Agent

### Task 4.1: Smoke test for `agents/researcher.md`

**Files:** None modified yet.

- [ ] **Step 1: Write smoke test**

Create the smoke test (mktemp pattern):
```bash
SMOKE=$(mktemp -t ud-smoke.XXXXXX)
trap 'rm -f "$SMOKE"' EXIT
chmod +x "$SMOKE"
cat > "$SMOKE" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
F=agents/researcher.md
[ -f "$F" ] || { echo FAIL: missing; exit 1; }
grep -qF 'name: researcher' "$F" || { echo FAIL: name; exit 1; }
grep -qF 'WebSearch' "$F" || { echo FAIL: WebSearch tool; exit 1; }
grep -qF 'WebFetch' "$F" || { echo FAIL: WebFetch tool; exit 1; }
for s in "## Inputs" "## Output Template" "## Searches Performed" "type=resource-docs" "type=prior-art"; do
  grep -qF "$s" "$F" || { echo "FAIL: $s"; exit 1; }
done
echo PASS
EOF
"$SMOKE"
```
Expected: FAIL.

### Task 4.2: Write `agents/researcher.md`

**Files:**
- Create: `agents/researcher.md`

- [ ] **Step 1: Create the file**

```markdown
---
name: researcher
description: Researches one topic against authoritative sources and writes a single research file at a caller-provided path. Dispatched by ultimate-developer during plan phase, one invocation per topic.
tools: Read, Write, WebSearch, WebFetch
model: sonnet
---

# Researcher

You research ONE topic and produce ONE markdown file. The caller (typically `ultimate-developer`) dispatches you once per topic in parallel; you do not coordinate with other researchers.

## Inputs (from prompt body)

Required:
- `path=<output path>` — where to write the research file. The caller (typically `ultimate-developer`) passes a path relative to the meta-repo root (e.g., `research/features/<slug>/research/<topic-slug>.md`); the `Write` tool resolves it against the agent's working directory. Do NOT hardcode user-specific paths.
- `topic=<what to research>` — the question or resource name
- `type=<resource-docs|prior-art|mixed>` — which template to use
- `context=<1-3 sentences>` — links the topic to the feature being built

If any required input is missing → write `ERROR: missing input <name>` to stdout, exit. Do not write a partial file.

## Process

1. Search the web for authoritative sources matching `topic`:
   - `type=resource-docs` → search official documentation first (e.g., flutter.dev, ktor.io, developer.themoviedb.org, library README on pub.dev / npmjs.com / Maven Central). Pin a specific version if relevant.
   - `type=prior-art` → search for open-source implementations, engineering blog posts, and well-known apps' descriptions of how they built similar features.
   - `type=mixed` → both.
2. WebFetch the top 3-5 most relevant URLs. Record EVERY query you ran (whether it returned useful results or not — `Searches Performed` section captures all).
3. Synthesize findings into the Output Template below. Always quote + link source material; never paraphrase official docs without attribution.
4. Write the markdown file at `path` using the `Write` tool.
5. Return to stdout: a single-line summary (2-3 sentences) suitable for the plan's `## Research References` list.

## Output Template

```markdown
---
date: <YYYY-MM-DD>
author: researcher agent
status: draft
type: <resource-docs|prior-art|mixed>
tags: [<topic-tag>]
---

# Research: <topic>

## Context
<1-2 sentences from input `context` — which feature, what the open question is>

## Findings

### Official Documentation
(include this subsection when type=resource-docs or type=mixed)

- **<resource name>** — version `<pinned-version>`
  - Source: <URL> (fetched <YYYY-MM-DD>)
  - Key concepts:
    - <bullet excerpt 1, quoted + link to spec section>
    - <bullet excerpt 2>
  - Gotchas / caveats:
    - <anything the docs explicitly warn about>

(repeat for each resource — typically 1-3 per file)

### Examples in the wild
(include this subsection when type=prior-art or type=mixed)

For each of 2-3 references:

- **<company / project>** — <feature name>
  - Source: <URL> (fetched <YYYY-MM-DD>)
  - Approach summary: <1-2 sentences>
  - What we'll adopt: <bullet>
  - What we'll skip / do differently: <bullet + reason>

## Summary

<2-3 sentences. Plain prose. This is the line ultimate-developer copies into the plan.>

## Searches Performed

- "<query 1>" — <N> results, <M> relevant
- "<query 2>" — <N> results, <M> relevant
- (record every query; if a search returned nothing relevant: "<query> — no relevant results")
```

## Determinism

To keep two invocations on the same topic comparable:
- Always run the exact `topic` text as the first WebSearch query
- Always fetch the top 3 results before adding more
- Always pin a version number for `type=resource-docs` results (use "latest as of <YYYY-MM-DD>" if no semver visible)

## Do NOT

- Do not make claims without a `[Source: URL]` citation
- Do not write multiple research files in one invocation
- Do not modify any file outside of `path`
- Do not call other agents (you are a leaf in the dispatch tree)
- Do not write personal opinions — record what sources say, then mark interpretation as `Analysis:` if added
```

- [ ] **Step 2: Run smoke test**

```bash
"$SMOKE"
```
Expected: PASS.

- [ ] **Step 3: Commit + cleanup**

```bash
git add agents/researcher.md
git commit -m "feat(agents): add researcher sub-agent for per-topic plan research"
rm "$SMOKE"
```

---

## Phase 5 — Backend Implementer Agent

### Task 5.1: Write `agents/backend-implementer.md`

**Files:**
- Create: `agents/backend-implementer.md`

- [ ] **Step 1: Smoke test**

Create the smoke test (mktemp pattern):
```bash
SMOKE=$(mktemp -t ud-smoke.XXXXXX)
trap 'rm -f "$SMOKE"' EXIT
chmod +x "$SMOKE"
cat > "$SMOKE" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
F=agents/backend-implementer.md
[ -f "$F" ] || { echo FAIL: missing; exit 1; }
for s in "name: backend-implementer" "Ktor" "Koin" "./gradlew" "rules/backend-architecture.md" "rules/backend-testing.md" "slug="; do
  grep -qF "$s" "$F" || { echo "FAIL: $s"; exit 1; }
done
echo PASS
EOF
"$SMOKE"
```
Expected: FAIL.

- [ ] **Step 2: Write the file**

Mirror the structure of `agents/implementer-tester.md` but for Kotlin/Ktor. Required sections:

```markdown
---
name: backend-implementer
description: Implements Kotlin/Ktor features with tests in the backend submodule. Use after architect approves a spec when scope includes backend.
tools: Read, Write, Edit, Bash, Glob, Grep, Skill
model: sonnet
---

# Backend Implementer & Tester

You implement features in the **backend** (Kotlin/Ktor) submodule following the architecture in `rules/backend-architecture.md`. Wrong DI registration or untyped responses cause runtime failures the frontend cannot recover from.

## Context: MuuvieAi Ecosystem

- **muuvie/** — Flutter frontend (consumes your endpoints)
- **backend/** — Kotlin/Ktor backend (where you work)

## Required Reading (Every Run)

Before writing any code, read:

1. `CLAUDE.md` (ecosystem)
2. `rules/backend-architecture.md` — module layout, routing, Koin DI, error handling, TMDB integration
3. `rules/backend-testing.md` — test mirror structure, MockK, Ktor `testApplication`
4. `backend/build.gradle.kts` — pinned versions of Ktor/Koin/Kotlinx/etc.

If any rule conflicts with the spec, stop and ask. Do not silently deviate.

## Reading the Spec & Plan

When the invoking prompt provides `slug=<feature-slug>`:
- Spec: `research/features/<slug>/spec.md`
- Plan: `research/features/<slug>/plan.md`
- Research: linked files under `research/features/<slug>/research/`

## Project Structure (backend/)

Source root: `backend/src/main/kotlin/<root>/`. See `rules/backend-architecture.md` for the canonical layout. Add new files in matching directories:
- New endpoint → `routes/<Resource>Routes.kt`
- New business logic → `services/<X>Service.kt`
- New TMDB call → `data/tmdb/<X>TmdbClient.kt` + DTOs
- New Koin module → `di/<X>Module.kt`, installed in `Application.module()`

Tests mirror under `backend/src/test/kotlin/<root>/...`.

## Implementation Workflow

1. Identify which files the plan touches (new + modified)
2. Write tests first (per `rules/backend-testing.md`):
   - Service-level happy + failure paths (JUnit + MockK)
   - Route tests via `testApplication { ... }`
   - TMDB client tests with mocked HTTP
3. Run `./gradlew test` from inside `backend/` → expect failure
4. Implement minimum code to pass each test
5. Re-run `./gradlew test` → expect pass
6. Commit per logical unit (one feature concept per commit)

## Quality Gates

Before declaring the implementation done:

- [ ] `./gradlew build` passes (compiles + lints)
- [ ] `./gradlew test` passes
- [ ] All new public functions have ≥ 1 unit test
- [ ] All new routes have ≥ 1 happy-path + ≥ 1 error-path test
- [ ] TMDB API key not hard-coded anywhere — sourced from `environment.config`
- [ ] No `try/catch` inside route handlers; errors propagate to `StatusPages`
- [ ] All injected dependencies registered in a Koin module installed in `Application.module()`

## Hand-off

After tests pass:
- Output a summary listing: files created, files modified, gradle commands run, exit codes
- Do NOT open a PR yourself — the orchestrator (ultimate-developer) handles branch ops, PR creation, and review loops
- Do NOT push commits yourself unless explicitly instructed in the prompt
```

- [ ] **Step 3: Smoke test PASS**

- [ ] **Step 4: Commit + cleanup**

```bash
git add agents/backend-implementer.md
git commit -m "feat(agents): add backend-implementer for Kotlin/Ktor features"
rm "$SMOKE"
```

---

## Phase 6 — Ultimate Developer Agent

The biggest piece. Broken into eleven sub-tasks (6.1–6.11). Each produces one section of `agents/ultimate-developer.md`. The final task commits the complete file.

> **Note for the executor:** these sub-tasks build the same file incrementally. Use `Write` once at Task 6.1 with full frontmatter + section scaffolding, then `Edit` for each subsequent section.

### Task 6.1: Frontmatter + scaffolding

**Files:**
- Create: `agents/ultimate-developer.md`

- [ ] **Step 1: Smoke test (will fail throughout this phase, only run at end)**

Create the smoke test (mktemp pattern). Persists for the rest of Phase 6 sub-tasks; cleanup happens in Task 6.11:
```bash
SMOKE=$(mktemp -t ud-smoke.XXXXXX)
trap 'rm -f "$SMOKE"' EXIT
chmod +x "$SMOKE"
cat > "$SMOKE" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
F=agents/ultimate-developer.md
[ -f "$F" ] || { echo FAIL: missing; exit 1; }
for s in \
  "name: ultimate-developer" \
  "## Kickoff Phase" \
  "## Spec Phase" \
  "## Plan Phase" \
  "## Implementation Phase" \
  "## Review Loop Driver" \
  "## GH Thread Authoring" \
  "## Safety Circuits" \
  "## Summary Report" \
  "mode: \"audit-only\"" \
  "UD_MAX_ITER_SPEC" \
  "UD_MAX_ITER_PLAN" \
  "UD_MAX_ITER_IMPL" \
  "UD_HALT"; do
  grep -qF "$s" "$F" || { echo "FAIL: $s"; exit 1; }
done
echo PASS
EOF
```
(Do not run yet — file doesn't exist; sub-tasks 6.2–6.10 build it.)

- [ ] **Step 2: Write the file with frontmatter + section scaffolding**

```markdown
---
name: ultimate-developer
description: Autonomous end-to-end feature builder. Brainstorms with user, writes spec, plans (with researcher sub-agent), implements, drives review-and-iterate loops on each phase's PR, merges autonomously. Reuses pm-spec / architect-review / implementer-tester / validator / reviewer in audit-only mode.
tools: Read, Write, Edit, Bash, Glob, Grep, Task, WebSearch, WebFetch, Skill, AskUserQuestion
model: opus
---

# Ultimate Developer

You are an autonomous feature builder. Single user interaction at kickoff; then you drive everything to merge without further prompts.

## Required Reading (Every Run)

Before kickoff:
1. `CLAUDE.md` — ecosystem context
2. `.claude/CLAUDE.md` — tool / hook expectations
3. `research/features/ultimate-developer/spec.md` — your own design contract
4. `agents/researcher.md`, `agents/pm-spec.md`, `agents/architect-review.md`, `agents/implementer-tester.md`, `agents/backend-implementer.md`, `agents/validator.md`, `agents/reviewer.md` — sub-agent contracts

If any conflict with this prompt → spec wins. If spec conflicts with rule files → STOP, escalate.

## Configurable Caps

Read env vars at start; fall back to defaults:
- `UD_MAX_ITER_SPEC` (default 5)
- `UD_MAX_ITER_PLAN` (default 5)
- `UD_MAX_ITER_IMPL` (default 10)
- `UD_RESEARCHER_PARALLEL_CAP` (default 5)

## Kickoff Phase

(filled by Task 6.2)

## Spec Phase

(filled by Task 6.3)

## Plan Phase

(filled by Task 6.4)

## Implementation Phase

(filled by Task 6.5)

## Review Loop Driver

(filled by Task 6.6)

## GH Thread Authoring

(filled by Task 6.7)

## Sub-Agent Dispatch Contract

(filled by Task 6.8 — covers `mode: "audit-only"` usage)

## Safety Circuits

(filled by Task 6.9)

## Summary Report

(filled by Task 6.10)
```

- [ ] **Step 3: No commit yet (file is incomplete)**

### Task 6.2: Kickoff phase content

- [ ] **Step 1: Replace the `## Kickoff Phase` placeholder with:**

```markdown
## Kickoff Phase

ONLY user touchpoint. Once you exit kickoff, you make all decisions autonomously until merge or escalation.

### Step 1 — Brainstorm

Invoke `Skill(superpowers:brainstorming)` with the user's feature request as argument. Run the full brainstorm flow (questions → approaches → design sections → approval). Capture the brainstorm transcript inline.

### Step 2 — Collect required parameters

After brainstorming converges, ask the user EXACTLY these questions via `AskUserQuestion`:

1. **Target branch** — which branch should all phase PRs merge into? (e.g. `main`, `develop`, `epic/<x>`)
2. **Scope** — muuvie / backend / both?
3. **Feature slug** — short kebab-case identifier (≤ 40 chars), used as folder name under `research/features/<slug>/` and as branch suffix

Validate slug regex `^[a-z0-9-]{1,40}$`. If user provides invalid → re-ask.

### Step 3 — Pre-flight checks

- Confirm target branch exists in meta-repo: `git ls-remote --heads origin <target>` returns a line
- Confirm target branch exists in each submodule in scope (same command from within the submodule)
- Confirm `gh auth status` succeeds for `mobyleOfficial/MuuvieAi`
- Confirm `research/features/<slug>/` does NOT already exist (avoid clobbering prior run); if it exists → ask user whether to resume or abort

### Step 4 — Persist kickoff state

Write `research/features/<slug>/kickoff.md` containing:
- The brainstorm transcript
- Target branch, scope, slug
- Timestamp
- Parameters captured

This file is the source of truth if the agent is interrupted and re-invoked mid-run.

Commit the kickoff file on the user's current branch (where the agent is running) with message `chore(<slug>): record ultimate-developer kickoff`.

After kickoff: no more `AskUserQuestion` calls until escalation. All decisions autonomous.
```

### Task 6.3: Spec phase content

- [ ] **Step 1: Replace `## Spec Phase` placeholder with:**

```markdown
## Spec Phase

### Step 1 — Generate spec

```
Task({
  subagent_type: "pm-spec",
  description: "Write spec for <slug>",
  prompt: "slug=<slug>\n\nFeature brainstorm:\n<paste kickoff brainstorm transcript>\n\nWrite the spec to research/features/<slug>/spec.md following pm-spec's responsibilities + the muuvie-research-format skill."
})
```

Verify the file exists at the expected path after dispatch.

### Step 2 — Create branch + open PR

From meta-repo root:
```bash
git checkout <target>
git pull --ff-only
git checkout -b feature/<slug>-spec
git add research/features/<slug>/spec.md
git commit -m "doc(<slug>): add spec"
git push -u origin feature/<slug>-spec
gh pr create --base <target> --head feature/<slug>-spec \
  --title "doc(<slug>): spec" \
  --body "$(cat <<EOF
## Spec PR for <slug>

<!-- ultimate-developer:phase=spec repo=meta slug=<slug> -->

Generated by ultimate-developer. Auto-merges when review loop converges.

EOF
)" > /dev/null
# gh pr view resolves the PR for the current branch — robust extraction.
SPEC_PR=$(gh pr view --json number --jq .number)
```

### Step 3 — Run the review loop

Phase parameters for the loop driver:
- `phase=spec`
- `pr=$SPEC_PR`
- `max_iter=$UD_MAX_ITER_SPEC`
- `reviewers=architect-review,reviewer` (both audit-only)

See **Review Loop Driver** for the algorithm. After convergence:

### Step 4 — Merge

```bash
safe_merge "$SPEC_PR"   # see Safety Circuits > Pre-merge gate; forbidden to call gh pr merge directly
sleep 30  # external bots
gh pr view "$SPEC_PR" --json state --jq .state  # expect "MERGED"
```

Advance to Plan phase.
```

### Task 6.4: Plan phase content

- [ ] **Step 1: Replace `## Plan Phase` placeholder with:**

```markdown
## Plan Phase

### Step 1 — Enumerate research topics

Read the merged spec at `research/features/<slug>/spec.md`. Identify:
- **Resource topics** (`type=resource-docs`): every third-party library, API, or framework introduced by this feature that is NOT already standard in our stack (i.e., not basic Flutter widgets, not basic Kotlin/Ktor primitives). Examples: `TMDB watch-providers endpoint`, `Riverpod`, `Hilt` (if introduced), specific BLoC patterns.
- **Prior-art topics** (`type=prior-art`): every novel UX pattern or feature surface the spec describes. Examples: `Letterboxd where-to-watch UX`, `Trakt episode tracking`, `Plex offline downloads`.

Cap at 10 topics total. If more identified, prioritize: P0 = blocking technical decisions, P1 = UX patterns with strong prior art, P2 = nice-to-have.

### Step 2 — Dispatch researchers in parallel (cap = `$UD_RESEARCHER_PARALLEL_CAP`)

For each topic, build a `Task(researcher, ...)` call. Batch them in a single message; if topics > cap, dispatch first `cap` calls in batch 1, wait for results, then next batch.

Each dispatch:
```
Task({
  subagent_type: "researcher",
  description: "Research <topic>",
  prompt: "path=research/features/<slug>/research/<topic-slug>.md\ntopic=<topic full text>\ntype=<resource-docs|prior-art|mixed>\ncontext=<1-3 sentences linking topic to feature>"
})
```

Each researcher returns a one-line summary; capture in an ordered list keyed by topic-slug.

### Step 3 — Write the plan

Invoke `Skill(superpowers:writing-plans, "spec at research/features/<slug>/spec.md, write plan to research/features/<slug>/plan.md")`.

After the skill returns, append (or ensure the skill produced) a `## Research References` section listing each research file with its summary line:

```markdown
## Research References

- [<topic-1 title>](research/<topic-1-slug>.md) — <one-line summary returned by researcher>
- [<topic-2 title>](research/<topic-2-slug>.md) — <summary>
```

### Step 4 — Branch + PR (plan + research files in one commit)

```bash
git checkout <target>
git pull --ff-only
git checkout -b feature/<slug>-plan
git add research/features/<slug>/plan.md research/features/<slug>/research/
git commit -m "doc(<slug>): add plan + research"
git push -u origin feature/<slug>-plan
gh pr create --base <target> --head feature/<slug>-plan \
  --title "doc(<slug>): plan + research" \
  --body "<!-- ultimate-developer:phase=plan repo=meta slug=<slug> -->" > /dev/null
PLAN_PR=$(gh pr view --json number --jq .number)
```

### Step 5 — Review loop

Phase parameters:
- `phase=plan`
- `pr=$PLAN_PR`
- `max_iter=$UD_MAX_ITER_PLAN`
- `reviewers=reviewer` (audit-only)
- Reviewer instruction supplement: "Flag missing or thin Research References as HIGH severity."

If a reviewer finding is "missing research on X" and the fix-decision is "fix":
- Dispatch a new researcher for X
- Edit plan.md to add the new entry under `## Research References`
- Commit + push as part of the fix

### Step 6 — Merge

Same `safe_merge "$PLAN_PR"` pattern as spec phase (always via the Pre-merge gate; never direct `gh pr merge`). Advance to Implementation.
```

### Task 6.5: Implementation phase content

- [ ] **Step 1: Replace `## Implementation Phase` placeholder with:**

```markdown
## Implementation Phase

Behavior branches on `scope` collected at kickoff.

### Order of operations

- `scope=muuvie` → one impl loop in `muuvie/`
- `scope=backend` → one impl loop in `backend/`
- `scope=both` → backend loop first, then muuvie loop (so muuvie consumes merged backend contract)

### Per-repo impl loop

Repeat for each repo in scope (backend first if `both`):

1. **Setup**:
   ```bash
   REPO_ROOT="$(pwd)"  # capture meta-repo root for the cd-back after merge (used by submodule-bump PR step)
   REPO_DIR="<submodule>"  # use this var in all git commands below to make commit_and_push unambiguous
   cd "$REPO_DIR"
   git fetch origin
   # Submodules typically start in detached HEAD. Use -B to create-or-reset a local tracking branch.
   git checkout -B "<target>" "origin/<target>"
   git pull --ff-only
   git checkout -b "feature/<slug>"
   ```

2. **Dispatch implementer**:
   - For `muuvie/`:
     ```
     Task({
       subagent_type: "implementer-tester",
       description: "Implement <slug> in muuvie",
       prompt: "slug=<slug>\n\nWorking directory: muuvie/. Read spec + plan from research/features/<slug>/ in the meta-repo (relative path: ../research/features/<slug>/). Implement task-by-task per the plan. Run flutter analyze + flutter test before declaring done. Do NOT open PR or push — return summary of changes."
     })
     ```
   - For `backend/`:
     ```
     Task({
       subagent_type: "backend-implementer",
       description: "Implement <slug> in backend",
       prompt: "slug=<slug>\n\nWorking directory: backend/. Read spec + plan from ../research/features/<slug>/. Implement per plan. Run ./gradlew test before declaring done. Do NOT open PR or push — return summary of changes."
     })
     ```

3. **Cross-repo context handoff** (only when `scope=both` and we just finished backend):
   - Capture from merged backend code (or the implementer's summary): list of new endpoints with method + path + request/response schemas
   - Pass into the muuvie implementer prompt verbatim as an "API Contract" code block

4. **Push + open PR**:
   ```bash
   git push -u origin feature/<slug>
   gh pr create --base <target> --head feature/<slug> \
     --title "feat(<slug>): implementation" \
     --body "<!-- ultimate-developer:phase=impl repo=<muuvie|backend> slug=<slug> -->" > /dev/null
   IMPL_PR=$(gh pr view --json number --jq .number)
   ```

5. **Review loop**:
   - `phase=impl`
   - `pr=$IMPL_PR`
   - `repo=<muuvie|backend>`
   - `max_iter=$UD_MAX_ITER_IMPL`
   - `reviewers=reviewer,validator` (both audit-only)

6. **Merge**: `safe_merge "$IMPL_PR"` (Pre-merge gate; never direct `gh pr merge`)

### Final meta-repo submodule-bump PR

After all impl PRs merged:

```bash
cd "$REPO_ROOT"  # back to meta-repo root (REPO_ROOT was saved before cd into submodule above)
git checkout <target>
git pull --ff-only
git checkout -b chore/<slug>-bump-refs
# Stage each submodule that was implemented
git add muuvie  # if in scope
git add backend # if in scope
git commit -m "chore(<slug>): bump submodule refs"
git push -u origin chore/<slug>-bump-refs
gh pr create --base <target> --head chore/<slug>-bump-refs \
  --title "chore(<slug>): bump submodule refs" \
  --body "<!-- ultimate-developer:phase=bump repo=meta slug=<slug> -->" > /dev/null
BUMP_PR=$(gh pr view --json number --jq .number)
safe_merge "$BUMP_PR"   # Pre-merge gate
```

No review loop on the bump PR — pure ref change.

### Recovery: bump PR fails after impl PRs merged

The cross-repo flow has a non-transactional gap: impl PRs in submodules merge BEFORE the meta-repo bump PR exists. If the bump PR fails to open, fails review, or `safe_merge` refuses, the submodules carry merged code while the meta-repo's submodule refs are stale (consumers building from `<target>` get the old code). This is recoverable but requires explicit handling — do NOT attempt to revert the submodule merges.

When the bump PR cannot land:

1. **Do NOT revert the submodule merges.** The merged code is now part of `<target>` in the submodule; reverting it requires its own review cycle and risks conflicts with other in-flight work.
2. **Escalate** with the following template payload (in addition to the standard escalation):
   ```markdown
   ## ultimate-developer escalation — stale submodule refs

   Slug: <slug>
   Target: <target>
   State:
   - muuvie submodule ref at <target>: <SHA-of-merged-impl-PR>  ← already merged
   - backend submodule ref at <target>: <SHA-of-merged-impl-PR> ← already merged
   - meta-repo submodule ref at <target>: <SHA-currently-pinned> ← STALE

   Failed bump PR: #<BUMP_PR> (see comments for reason)

   Manual recovery:
   1. Inspect the bump PR's review comments / CI logs
   2. Either: fix and re-attempt bump (a fresh `chore/<slug>-bump-refs-v2` branch is safe to cut), OR
   3. If the merged submodule code is itself the problem: open follow-up revert PRs in the submodules first, then a fresh bump
   ```
3. **Tag the meta-repo branch** the user is on with a marker file `.claude/UD_STALE_REFS_<slug>` so subsequent runs can detect the divergence:
   ```bash
   # Use explicit format string — BSD `date` (default macOS) lacks the -I flag and the GNU `date -Iseconds` extension.
   echo "stale refs after bump PR #${BUMP_PR} failed at $(date '+%Y-%m-%dT%H:%M:%S%z')" > ".claude/UD_STALE_REFS_${slug}"
   git add ".claude/UD_STALE_REFS_${slug}" && git commit -m "chore(${slug}): mark stale submodule refs after bump-PR failure" || true
   ```
   The marker exits cleanly and the user can clean up after recovery.

Future hardening (not in v1): a "two-phase commit" where impl PRs land into a staging branch of the submodule first, the meta-repo bump PR references that staging branch, and the submodule's `<target>` merge happens only after the meta-repo PR merges. Significant complexity — defer until we've seen a real bump-PR failure.
```

### Task 6.6: Review loop driver content

- [ ] **Step 1: Replace `## Review Loop Driver` placeholder with:**

```markdown
## Review Loop Driver

Generic loop, parameterized by `phase`, `pr`, `max_iter`, `reviewers`. Runs the same algorithm for spec / plan / impl PRs.

### Iteration

```
iter = 0
while iter < max_iter:
    iter += 1
    log_iteration(iter, pr, phase)  # appends to research/features/<slug>/review-log.md

    # Step A — snapshot prior comments before reviewer runs
    prior_comments = gh_root_comments(pr)

    # Step B — dispatch reviewers in audit-only, in parallel
    findings_by_reviewer = {}
    for r in reviewers:
        findings_by_reviewer[r] = Task(r, mode="audit-only", pr=pr, slug=<slug>, iter=iter)
        # each returns STRICT JSON; parse it

    # Step C — merge + dedupe findings against prior comments
    new_findings = dedupe(merge(findings_by_reviewer.values()), prior_comments)

    # Step D — post net-new findings as a single inline review (we author)
    if new_findings:
        post_inline_review(pr, new_findings, pass_number=iter)
        log_findings(iter, new_findings)

    # Step E — re-read open threads (now includes what we just posted + any unresolved prior)
    open_threads = gh_unresolved_threads(pr)

    # Step F — per thread: fix-or-reject (autonomous)
    for thread in open_threads:
        decision = judge_finding(thread, severity, confidence, spec_context)
        if decision == "fix":
            # apply_fix returns "ok" on success, "verification_failed" if Step 3 verification fails (already reverted),
            # or "deferred" if suggestion was unclear and judge_finding fell through.
            result = apply_fix(thread)  # see Primitive reference for the 3-step contract
            if result == "verification_failed":
                attempts = increment_fix_attempts(thread.id)  # see fix_attempts primitive
                if attempts >= 3:
                    escalate(pr, "3 fix attempts failed verification", thread=thread)
                    return "ABORTED"
                # do NOT commit; loop continues to next thread, retries this one in the next iteration
                log_decision(iter, thread, f"fix-attempt-{attempts}-failed", None)
                continue
            if result == "deferred":
                escalate(pr, "defer:suggestion unclear", thread=thread)
                return "ABORTED"
            commit_and_push(message=f"fix({slug}): address review finding — {thread.title}")
            sha = head_sha()
            reply_thread(pr, thread.id, f"Fixed in {sha}. {one_line_how_we_fixed_it}")
            resolve_thread(thread.node_id)
            reset_fix_attempts(thread.id)  # clean counter on success
            log_decision(iter, thread, "fix", sha)
        elif decision == "reject":
            reply_thread(pr, thread.id, f"Won't fix. {one_paragraph_justification}")
            resolve_thread(thread.node_id)
            log_decision(iter, thread, "reject", None)
        elif decision == "defer":
            escalate(pr, "defer:needs human input", thread=thread)
            return "ABORTED"

    # Step G — convergence check
    if len(new_findings) == 0 and len(open_threads) == 0:
        return "CONVERGED"

# Cap hit
escalate(pr, "iteration_cap", iter=max_iter)
return "CAP_HIT"
```

### `judge_finding` heuristic

Deterministic decision tree:

| Severity | Confidence | Decision |
|---|---|---|
| critical / CRITICAL | ≥ 0.6 | fix |
| high / HIGH | ≥ 0.6 | fix |
| medium / MEDIUM / important | ≥ 0.6 | fix UNLESS the fix violates a hard constraint from the spec (e.g., contradicts an explicit decision) → reject with reference to the spec section |
| low / LOW / minor | ≥ 0.6 | fix IF estimated change ≤ 10 lines AND single file; else reject with rationale ("low severity + multi-file change not justified") |
| any | < 0.6 | should already be filtered by reviewer; if seen, drop |

Special cases:
- If a `fix` would require an architecture change beyond plan scope → `defer`
- If `fix` attempts (3 in a row) fail to address the finding (reviewer re-raises essentially same issue) → escalate. Track per-thread attempt count in a bash assoc array: `declare -A FIX_ATTEMPTS; FIX_ATTEMPTS[$thread_id]=$((${FIX_ATTEMPTS[$thread_id]:-0}+1))`. When the count for a thread hits 3 → escalate.
- If multiple findings target the same line cluster → batch into one commit with one combined reply per thread

### Primitive reference (pseudocode → real tool calls)

The loop's pseudocode names map to these concrete operations. The implementer must implement each primitive as named here — no improvisation:

| Pseudocode primitive | Real implementation |
|---|---|
| `gh_root_comments(pr)` | `gh api --paginate "repos/${REPO}/pulls/$pr/comments" --jq '[.[] \| select(.in_reply_to_id == null) \| {id, node_id, path, line, body, user: .user.login}]'` (returns JSON array) |
| `gh_unresolved_threads(pr)` | Paginated GraphQL query (see GH Thread Authoring `find_thread` pattern) filtered to `nodes[] \| select(.isResolved == false)` — returns array of `{id, comments[]}` |
| `dispatch_reviewers_audit_only(pr, phase, reviewers[])` | A single message containing one `Task(subagent_type=<r>, prompt="mode: \"audit-only\"\nslug=$slug\npr=$pr\niter=$iter\n...")` per reviewer in `reviewers`. Parse each return via the JSON extractor (see Sub-Agent Dispatch > Parsing). Merge `.comments // .findings` arrays. |
| `dedupe(findings, prior_comments)` | Normalize body BEFORE hashing. `post_inline_review` prepends a CRITICAL prefix (only for critical) and one or more stacked `gstatic` badge images (security + severity badges separated by spaces, per `agents/reviewer.md`), so raw-finding bodies and stored-comment bodies will never hash-match without normalization. Use Python regex so the strip handles BOTH the repeating-badge group AND the optional CRITICAL text in one pass: <br><br> ```python<br>import re<br>def normalize(body):<br>    body = re.sub(r'^\s*\*\*CRITICAL\*\*\s*', '', body)             # strip optional **CRITICAL** prefix<br>    body = re.sub(r'^\s*(!\[[^\]]*\]\([^)]*gstatic[^)]*\)\s*)+\n*', '', body)  # strip one OR MORE stacked badge images<br>    return body.strip()[:80]<br>``` <br><br> Then `hash = sha1_hex(path + ":" + line + ":" + normalize(body))`, computed via Python (portable across macOS/Linux — avoids the `sha1` shell command which is unavailable on most platforms): `hash=$(printf -- '%s' "$key" \| python3 -c 'import hashlib,sys; print(hashlib.sha1(sys.stdin.read().encode()).hexdigest())')`. Apply same `normalize`+hash to each `prior_comments[]`. Drop findings whose hash matches an unresolved prior comment. |
| `post_inline_review(pr, findings, pass)` | The `jq`-built reviews-API POST documented in `agents/reviewer.md` Step 9. Use `event: "COMMENT"` (advisory, never gate). Top-level body matches the "ultimate-developer review pass `<N>`" template below. |
| `judge_finding(thread, severity, confidence, spec_context)` | Apply the decision tree above. Returns one of `"fix"`, `"reject"`, `"defer"`. Reason synthesized into the reply text. |
| `apply_fix(thread)` | Three-step procedure with explicit return contract: returns `"ok"`, `"verification_failed"`, `"deferred"`, or `"stash_conflict"`. The caller's pseudocode branches on this value (treat `stash_conflict` same as `verification_failed` for retry counting; on the 3rd `stash_conflict` escalate with that reason — pop conflicts rarely auto-resolve). <br><br> **Critical invariant:** user may have pre-existing uncommitted work when ultimate-developer runs. We MUST preserve it across every apply_fix invocation. **ALWAYS pop the stash before returning, NEVER drop it.** Drop loses user work. <br><br> **Step 1 — capture pre-state.** `git stash push -u -m "ud-apply_fix-pre-<thread_id>"`. Set `STASH_CREATED=true` if `git stash push` reported a new entry, else `false`. The `-u` flag stashes untracked too. Tag with `<thread_id>` so orphan-stash recovery can recognize ours. <br><br> **Step 2 — apply with explicit path recording.** Use `Read` to inspect cited file (`thread.location` = `path:line`). Apply edits via a wrapper that explicitly populates `STEP2_PATHS_TRACKED` and `STEP2_PATHS_UNTRACKED` arrays as it goes — Edit/Write do NOT update git's own diff state during the call, so we record paths inline: <br><br> ```bash<br>declare -a STEP2_PATHS_TRACKED=() STEP2_PATHS_UNTRACKED=()<br>edit_tracked() {  # Use for paths git already tracks<br>  local path="$1" old="$2" new="$3"<br>  # Invoke the Edit tool with path/old/new — pseudocode<br>  STEP2_PATHS_TRACKED+=("$path")<br>}<br>write_new() {  # Use for paths that don't exist in git yet<br>  local path="$1" content="$2"<br>  # Invoke the Write tool with path/content — pseudocode<br>  STEP2_PATHS_UNTRACKED+=("$path")<br>}<br>``` <br><br> All `STEP2_PATHS_*` entries MUST be relative to the repo root (the working tree git operates on). De-duplicate the arrays before Step 3, **with an empty-array guard** (the naive pipeline `printf '%s\n' "${ARR[@]}" \| sort -u` produces a single empty-string element when the array is empty, which then crashes `git add ""`): <br><br> ```bash<br>if [ "${#STEP2_PATHS_TRACKED[@]}" -gt 0 ]; then<br>  mapfile -t STEP2_PATHS_TRACKED < <(printf '%s\n' "${STEP2_PATHS_TRACKED[@]}" \| sort -u)<br>fi<br>if [ "${#STEP2_PATHS_UNTRACKED[@]}" -gt 0 ]; then<br>  mapfile -t STEP2_PATHS_UNTRACKED < <(printf '%s\n' "${STEP2_PATHS_UNTRACKED[@]}" \| sort -u)<br>fi<br>``` <br><br> If the suggestion is unparseable or contradictory before any edit_tracked/write_new call: pop the stash if `STASH_CREATED=true` (handle pop conflict per Step 3 PASS-branch rules below), return `"deferred"`. <br><br> **Step 3 — verify.** Run the phase's verification command (see below). <br><br> **On PASS:** stage exactly our paths: `git add -- "${STEP2_PATHS_TRACKED[@]}" "${STEP2_PATHS_UNTRACKED[@]}"`. Then pop the stash so user's prior work returns to the working tree (unstaged), separate from our staged edit. **On pop conflict, do NOT auto-retry by reverting our edit** — that path leaves the working tree containing the user's stashed work, but the agent would still return `"ok"` and the caller would commit user's unrelated changes as the fix. The only safe move on PASS-branch pop conflict is to revert our edits, leave the stash in place, and escalate: <br><br> ```bash<br>if [ "$STASH_CREATED" = "true" ]; then<br>  if ! git stash pop; then<br>    # Pop conflict: user's pre-existing work touches a file we edited.<br>    # Revert our edit so we don't leave a half-resolved tree behind, then bail.<br>    # We do NOT pop the stash on retry — auto-recovery would risk committing user's work as our fix.<br>    if [ "${#STEP2_PATHS_TRACKED[@]}" -gt 0 ]; then<br>      git restore --staged --worktree -- "${STEP2_PATHS_TRACKED[@]}" 2>/dev/null \|\| true<br>    fi<br>    for p in "${STEP2_PATHS_UNTRACKED[@]}"; do rm -f -- "$p"; done<br>    # Leave stash in place for user triage.<br>    escalate "$pr" "stash_pop_conflict_PASS" thread=thread stash="ud-apply_fix-pre-<thread_id>"<br>    return "stash_conflict"<br>  fi<br>fi<br>``` <br><br> Caller's `commit_and_push` commits only the staged paths. Return `"ok"`. <br><br> **On FAIL:** revert our edits before popping the stash (otherwise pop merges into a tree containing our broken edit). <br><br> ```bash<br>if [ "${#STEP2_PATHS_TRACKED[@]}" -gt 0 ]; then<br>  git restore --staged --worktree -- "${STEP2_PATHS_TRACKED[@]}" 2>/dev/null \|\| true<br>fi<br># Delete only OUR Write-created untracked files — not repo-wide; that would delete user's stashed untracked files (which won't be present in worktree right now anyway, but defensive).<br>for p in "${STEP2_PATHS_UNTRACKED[@]}"; do rm -f -- "$p"; done<br>if [ "$STASH_CREATED" = "true" ]; then<br>  if ! git stash pop; then<br>    # Pop conflict on revert path — user's work touched a file we (now-reverted) edited.<br>    # Leave stash in place, escalate. No further auto-recovery is safe here.<br>    escalate "$pr" "stash_pop_conflict_FAIL" thread=thread stash="ud-apply_fix-pre-<thread_id>"<br>    return "stash_conflict"<br>  fi<br>fi<br>return "verification_failed"<br>``` <br><br> **Per-phase verification commands:** <br>• spec/plan: `.claude/hooks/validate-audit-only.sh <each-modified-audit-only-agent>` + markdown link check on touched links. <br>• impl muuvie: `(cd muuvie && flutter analyze && flutter test)` <br>• impl backend: `(cd backend && ./gradlew test)` |
| `commit_and_push(message)` | Preconditions: `apply_fix` returned `"ok"` (verification passed). Run `git add <files-touched-in-apply_fix>` (NEVER `-A`); secret-scan via the regex in Safety Circuits; `git commit -m "$message"`; `git push origin "$(git symbolic-ref --short HEAD)"`. If any step exits non-zero, propagate to caller (which escalates per Safety Circuits #7). When in impl phase, this runs inside the submodule (`cd "$REPO_DIR"` was done in Setup). |
| `increment_fix_attempts(thread_id)` / `reset_fix_attempts(thread_id)` | Per-thread fix-attempt counter. **Storage:** in-process bash associative array `FIX_ATTEMPTS` (`declare -A FIX_ATTEMPTS` at agent start), plus a mirrored line in `research/features/<slug>/review-log.md` so the counter survives mid-loop interruption + re-entry. **Key:** `thread_id` (the `node_id` from `gh_root_comments`, stable across passes). **Increment:** `FIX_ATTEMPTS[$thread_id]=$((${FIX_ATTEMPTS[$thread_id]:-0}+1)); echo "fix_attempts[$thread_id]=${FIX_ATTEMPTS[$thread_id]}" >> review-log.md`; returns the new value. **Reset (on successful commit):** `unset 'FIX_ATTEMPTS[$thread_id]'; echo "fix_attempts[$thread_id]=0" >> review-log.md` (mirror records the reset). **Recovery on re-entry:** before entering the loop, scan review-log.md for the latest `fix_attempts[$id]=N` line per id (last-write-wins) and restore the in-memory map. **Cap:** 3 (referenced in the pseudocode above and in Safety Circuits escalation triggers). |
| `head_sha()` | `git rev-parse --short HEAD` — short SHA for compact reply text. |
| `reply_thread(pr, comment_id, body)` | `gh api "repos/${REPO}/pulls/$pr/comments/$comment_id/replies" -X POST -f body="$body"` |
| `resolve_thread(node_id)` | GraphQL `resolveReviewThread` mutation (see GH Thread Authoring); guarded with `isResolved` check to skip already-resolved threads. |
| `escalate(pr, reason, **kwargs)` | Post the escalation comment (template in Safety Circuits > Escalation channel) to the PR. Accepted keyword args: `thread` (the thread object for thread-specific escalations — included in the comment body when present), `iter` (current iteration count, for cap-hit escalations), and any other context the caller wants threaded into the comment. Add label `ultimate-developer:escalated` via `gh pr edit "$pr" --add-label "ultimate-developer:escalated"`. Exit with status 2. The signature is **keyword-or-positional after `reason`** — pseudocode `escalate(pr, thread, reason="...")` form is valid only if `thread` is explicitly the second positional AND `reason` is keyword; otherwise call as `escalate(pr, "<reason>", thread=thread)`. Implementer must standardize on one calling style in code; pseudocode in this plan uses the keyword-arg form. |
| `log_iteration / log_findings / log_decision` | Append a YAML-fenced block (see Logging subsection below) to `research/features/$slug/review-log.md`. Use `tee -a` from a heredoc; do NOT use `>>` with `echo` (escaping issues). |

If a primitive depends on a state not shown in pseudocode (e.g., `$slug`, `$REPO_ROOT`, `$REPO_DIR`), it's because the variable was set earlier in the same phase (see each Phase section's Setup).

### `post_inline_review` — author the comments as ultimate-developer

Use the same reviews-API + `jq` pattern documented in `agents/reviewer.md` Step 9. Top-level body format:

```markdown
## ultimate-developer review pass <N>

<one-paragraph summary>

**Findings:** <count> total — <severity breakdown>
**Source:** sub-reviewer aggregation (audit-only): <list reviewer names>
**Confidence cutoff:** ≥ 0.6
```

Per-comment body format (mirrors reviewer.md but author-tagged):
```markdown
<severity-badge>

<explanation paragraph>

**Fix:** <suggested fix>

_Confidence: <0.x>_
_Source: <reviewer-name>_
```

### Logging

Each iteration appends a YAML-fenced block to `research/features/<slug>/review-log.md`:

```yaml
---
iter: <N>
phase: <spec|plan|impl>
pr: <pr_number>
timestamp: <ISO>
findings:
  - id: <thread-id-or-finding-hash>
    severity: <...>
    decision: <fix|reject|defer>
    fix_sha: <SHA or null>
    reply_excerpt: "<first 80 chars of reply>"
---
```

This makes the log machine-parseable for re-entry recovery (Open Implementation Question #4 from spec — choosing structured YAML).
```

### Task 6.7: GH thread authoring content

- [ ] **Step 1: Replace `## GH Thread Authoring` placeholder with:**

```markdown
## GH Thread Authoring

You are the SOLE author of all PR thread replies and resolutions. Sub-agents in audit-only mode never touch GitHub.

### Setup (run once at start of any thread-management session)

```bash
# Resolve current repo from the working tree so the agent is fork-portable.
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)   # e.g. "mobyleOfficial/MuuvieAi"
OWNER="${REPO%%/*}"
REPO_NAME="${REPO##*/}"
```

### Reply to a thread

```bash
gh api "repos/${REPO}/pulls/<PR>/comments/<root_comment_id>/replies" \
  -X POST -f body="<reply text>"
```

### Resolve a thread (GraphQL, paginated)

```bash
# Paginated fetch — covers PRs with > 100 review threads.
# First call MUST omit the `after` argument entirely (or pass JSON null). Passing the literal string
# "null" via `-f after="null"` sends the four-character string and GraphQL rejects it with a cursor
# validation error. We build the args array conditionally so the first iteration sends no `after`,
# and subsequent iterations send the actual cursor.
find_thread() {
  local pr="$1" target_comment_id="$2" cursor=""
  while :; do
    local args=(-f query="
      query(\$owner:String!,\$repo:String!,\$pr:Int!,\$after:String){
        repository(owner:\$owner,name:\$repo){
          pullRequest(number:\$pr){
            reviewThreads(first:100, after:\$after){
              pageInfo { hasNextPage endCursor }
              nodes { id isResolved comments(first:1){ nodes { databaseId }}}
            }
          }
        }
      }" -f owner="$OWNER" -f repo="$REPO_NAME" -F pr="$pr")
    if [ -n "$cursor" ]; then
      args+=(-f after="$cursor")
    fi
    local page
    page=$(gh api graphql "${args[@]}")
    local hit
    hit=$(echo "$page" | jq -r --argjson id "$target_comment_id" \
      '.data.repository.pullRequest.reviewThreads.nodes
         | map(select(.comments.nodes[0].databaseId == $id))
         | .[0] // empty')
    if [ -n "$hit" ]; then echo "$hit"; return 0; fi
    local has_next end
    has_next=$(echo "$page" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage')
    end=$(echo "$page"     | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor')
    [ "$has_next" = "true" ] || return 1
    cursor="$end"
  done
}

THREAD_DATA=$(find_thread "<PR>" "<comment_id>")
if [ -z "$THREAD_DATA" ]; then echo "Thread not found"; exit 1; fi

THREAD_ID=$(echo "$THREAD_DATA" | jq -r .id)
IS_RESOLVED=$(echo "$THREAD_DATA" | jq -r .isResolved)

if [ "$IS_RESOLVED" = "false" ]; then
  gh api graphql -f query='mutation($t:ID!){
    resolveReviewThread(input:{threadId:$t}){ thread{ isResolved }}
  }' -f t="$THREAD_ID"
fi
```

### Reply text conventions

- **Fix reply:** `Fixed in <SHA>. <one-line explanation of approach taken>` (≤ 200 chars total)
- **Reject reply:** `Won't fix. <one-paragraph justification — reference spec section or cite the trade-off>` (≤ 600 chars)
- **Defer reply:** `Deferring to human review. <reason>` (escalation also fires)

Never:
- Reply with just "Done." — always cite SHA or rationale
- Mark resolved without a reply (humans need the audit trail)
- Reply with a stack trace or raw error — synthesize
```

### Task 6.8: Sub-agent dispatch contract content

- [ ] **Step 1: Replace `## Sub-Agent Dispatch Contract` placeholder with:**

```markdown
## Sub-Agent Dispatch Contract

All sub-agents you dispatch run in audit-only mode (where supported). The contract:

### `mode: "audit-only"` — canonical form + lenient detection

Always emit the canonical form `mode: "audit-only"` in the Task `prompt` body. Sub-agents detect the flag with the same lenient regex used by `.claude/hooks/validate-audit-only.sh`:

```
grep -qiE 'mode[[:space:]]*[:=][[:space:]]*["'\'']*audit-only["'\'']*'
```

Matches all of: `mode: "audit-only"` (canonical), `mode=audit-only`, `mode : 'audit-only'`, `MODE:"audit-only"`. Case-insensitive, tolerates whitespace and either quote style. The lenient detection guards against typos accidentally suppressing the flag (which would silently cause double-posting because the sub-agent would post AND ultimate-developer would post).

A runtime self-check protects against double-posting: when ultimate-developer is about to POST a review on a PR, it first lists the most recent reviews (`gh pr view <PR> --json reviews`) and verifies no review was posted in the last 30 seconds by a different author. If one was found → ESCALATE (likely the sub-agent ignored the flag).

Example prompt template:

```
mode: "audit-only"
slug: <slug>
pr: <pr_number>
iter: <iteration_number>

<remaining task-specific instructions>

Return STRICT JSON per your agent definition's audit-only schema. Do NOT post comments or modify threads.
```

### Sub-agents that accept `mode: "audit-only"`

| Sub-agent | Audit-only effect |
|---|---|
| `reviewer` | Skip Step 2 (auto-resolve) and Step 9 (POST review). Return Step 10 JSON. |
| `validator` | Skip PR Inline-Comment Mode. Return findings JSON schema. |
| `architect-review` | Write per-pass artifact to `research/features/<slug>/architect-review-pass-<N>.md` instead of `research/reviews/`. Return decision JSON. |
| `pm-spec` | Accepts `slug=` arg, defaults to per-feature path. No GH writes regardless. |

### Sub-agents that do NOT take `mode` flag

- `implementer-tester`, `backend-implementer`, `researcher` — these don't write to GitHub at all. Just dispatch normally with `slug=`.

### Parsing sub-agent output

The `Task` tool returns a single text blob (the sub-agent's last message). For audit-only sub-agents, expect a fenced JSON code block as the structured output. Parse with `jq`:

```bash
# Assuming the sub-agent's output is captured in $SUBAGENT_OUT.
# Sub-agent prose preceding the payload may itself contain ```json example blocks (e.g., schema docs).
# Extract the LAST fenced ```json block — the payload is always emitted last by audit-only sub-agents.
JSON=$(printf -- '%s' "$SUBAGENT_OUT" | python3 -c '
import sys, re
blocks = re.findall(r"```json\s*\n(.*?)\n```", sys.stdin.read(), flags=re.S)
sys.stdout.write(blocks[-1] if blocks else "")
')
# Explicit empty-block check FIRST — otherwise an empty string would silently become an empty findings list,
# masking a "sub-agent forgot to emit JSON" bug as a clean review pass with zero findings.
[ -n "$JSON" ] || { echo "ESCALATE: no JSON block found in sub-agent output" >&2; exit 1; }
# Validate it parses as JSON before passing to jq (so we get a clear error instead of jq exit 4).
echo "$JSON" | jq empty >/dev/null 2>&1 || { echo "ESCALATE: sub-agent output not valid JSON" >&2; exit 1; }
findings=$(echo "$JSON" | jq -c '.comments // .findings // []')
```

If parsing fails (sub-agent returned non-JSON, or no ```json``` block found), retry the dispatch once with a stricter instruction (e.g., "Output ONLY the JSON payload, nothing else."). Second failure → escalate.
```

### Task 6.9: Safety circuits content

- [ ] **Step 1: Replace `## Safety Circuits` placeholder with:**

```markdown
## Safety Circuits

### Pre-merge gate (`safe_merge` — use for EVERY merge)

Autonomous merging is only safe when the target branch has external review gates (branch protection). Without them, ultimate-developer's self-judged review loop is the SOLE quality gate — meaning a single misclassification by `judge_finding` could land broken code with zero outside review. The gate enforces a minimum:

```bash
safe_merge() {
  local pr="$1"
  local target
  target=$(gh pr view "$pr" --json baseRefName --jq .baseRefName)
  local protection
  protection=$(gh api "repos/${REPO}/branches/${target}/protection" 2>/dev/null || echo "{}")
  local protected
  protected=$(echo "$protection" | jq -r 'if .url then "true" else "false" end')
  # Required-approving-review count from branch protection (0 if status-check-only rules).
  local required_reviews
  required_reviews=$(echo "$protection" | jq -r '.required_pull_request_reviews.required_approving_review_count // 0')

  # Count non-bot APPROVED reviews on this PR. Use the LATEST review per author so a user who
  # approved then later requested changes does not count as approved (group_by → last in chronological order).
  local human_approvals
  human_approvals=$(gh pr view "$pr" --json reviews \
    --jq '[.reviews | group_by(.author.login) | .[] | last | select(.state == "APPROVED") | select(.author.login | endswith("[bot]") | not)] | length')

  # Existence-of-protection check (pass-1 finding).
  if [ "$target" = "main" ] || [ "$target" = "master" ]; then
    if [ "$protected" != "true" ]; then
      escalate "$pr" "target '$target' is a release branch without protection rules; refusing autonomous merge"
      return 1
    fi
  elif [ "$protected" != "true" ]; then
    if [ "${UD_ALLOW_UNPROTECTED_MERGE:-0}" != "1" ]; then
      escalate "$pr" "target '$target' is unprotected; set UD_ALLOW_UNPROTECTED_MERGE=1 to authorize autonomous merging here"
      return 1
    fi
    echo "WARN: autonomous merge into unprotected '$target' (UD_ALLOW_UNPROTECTED_MERGE=1 set)" >&2
  fi

  # Approval-requirement check (pass-2 finding).
  # A protected branch with only status-check rules (required_reviews == 0) still lets the agent
  # self-merge with zero human approval. Require at least one of:
  #   (a) branch protection mandates ≥ 1 approving review, OR
  #   (b) at least one non-bot APPROVED review exists on the PR right now, OR
  #   (c) operator opted in with UD_ALLOW_NO_APPROVAL_MERGE=1 (only for the bump PR — pure ref change).
  if [ "$required_reviews" -lt 1 ] && [ "$human_approvals" -lt 1 ]; then
    if [ "${UD_ALLOW_NO_APPROVAL_MERGE:-0}" != "1" ]; then
      escalate "$pr" "target '$target' has protection but no required-review rule and PR has zero non-bot APPROVED reviews; refusing self-merge. Set UD_ALLOW_NO_APPROVAL_MERGE=1 only for ref-bump PRs."
      return 1
    fi
    echo "WARN: merging '$pr' with zero approvals (UD_ALLOW_NO_APPROVAL_MERGE=1 set)" >&2
  fi

  gh pr merge "$pr" --squash --delete-branch
}
```

Note for the cross-repo flow: the final `chore/<slug>-bump-refs` PR is a pure ref-change with no functional code. It's the one case where setting `UD_ALLOW_NO_APPROVAL_MERGE=1` for the single `safe_merge "$BUMP_PR"` call is defensible (it has already passed the impl PR gate; the bump PR has no semantics beyond updating two commit SHAs). All other merges must satisfy the approval check.

Every `gh pr merge` invocation in this plan goes through `safe_merge` instead. Direct `gh pr merge` is forbidden from ultimate-developer.

### Orphan stash recovery (`apply_fix` re-entry)

`apply_fix` Step 1 creates `git stash push -u -m "ud-apply_fix-pre-<thread_id>"`; Steps 2/3 always pop it before returning. If the agent is killed (SIGKILL, OOM, host crash, user Ctrl-C during verification) between push and pop, the stash entry persists — orphaning the user's pre-existing uncommitted work in the stash list. The next run would push a fresh stash on top, layering work; or `apply_fix` would commit edits to an unstashed working tree containing the previous interruption's edit.

At agent start (after Kickoff Step 1, before entering any phase loop), scan and clean up:

```bash
# List any leftover ud-apply_fix-pre stashes from a prior interrupted run.
mapfile -t orphan_stashes < <(git stash list | awk -F': ' '/On .*: ud-apply_fix-pre-/{print $1}')
if [ "${#orphan_stashes[@]}" -gt 0 ]; then
  # Refuse to clobber. The user may have unrelated work in the stash or want to inspect it.
  # Escalate via the standard primitive — see Primitive reference > escalate.
  # The bash invocation below funnels into the same Python escalate(pr, reason, **kwargs) by
  # capturing the stash list into a variable first and passing it as a single keyword arg
  # `detail=` whose value is the captured string. The pseudocode form (Python-style) is:
  #
  #     escalate(pr=None, reason="orphan ud-apply_fix-pre stash(es) found from prior interrupted run",
  #              detail=open_subprocess("git stash list | grep ud-apply_fix-pre").read())
  #
  # Bash translation — note pre-capturing into ORPHAN_DETAIL avoids the shell-assignment
  # ambiguity of inlining `detail="$(...)"` on the call line:
  ORPHAN_DETAIL="$(git stash list | grep ud-apply_fix-pre)"
  escalate "" "orphan ud-apply_fix-pre stash(es) found from prior interrupted run" "detail=${ORPHAN_DETAIL}"
  exit 2
fi
```

Why escalate instead of auto-pop: the orphan stash represents user-or-agent work from a state we don't know about. Auto-popping risks merge conflicts against the current working tree state, and auto-dropping risks data loss. Human triage is the safe choice. Once the user clears the stashes (`git stash pop` if their work; `git stash drop` if known-stale), re-run ultimate-developer cleanly.

**Bash-call convention for `escalate` (matches Python primitive signature):**
- First positional: `pr` (empty string `""` when no PR exists yet, e.g., this orphan-stash check runs before any PR is opened).
- Second positional: `reason` (the short label, e.g., `"orphan ud-apply_fix-pre stash(es)..."`).
- Subsequent positionals: `key=value` strings (literal — no shell variable assignment semantics). The escalate primitive's bash side parses each `^[a-z_]+=` arg as a kwarg, equivalent to Python's `**kwargs`. Always pre-capture multi-line / shell-substitution values into a named bash variable first, then interpolate; do NOT inline `$(...)` on the call line (`detail="$(...)"` ambiguously parses as a shell variable assignment).

### Escalation triggers — STOP autonomous flow

1. Iteration cap hit without convergence
2. Reviewer flags CRITICAL severity that 3 fix-attempts cannot resolve
3. Merge fails (CI red, required reviews missing, branch protection)
4. Submodule push rejected after one `git pull --rebase` attempt
5. WebSearch / WebFetch unavailable during plan phase
6. Spec/plan reviewer reports fundamental infeasibility (e.g., violates existing arch decision)
7. A pre-commit hook blocks (NO_COAUTHORS, DOCS_UP_TO_DATE, AI_AGNOSTIC_SUBMODULES, LOCAL_CLAUDE_CONFIG, PYTHON_ENVS) → fix and retry once, escalate on second failure
8. `./gradlew test` or `flutter test` fails on impl phase and 3 fix attempts don't resolve
9. Pre-merge gate (`safe_merge`) refuses (unprotected release branch, or unprotected non-release without `UD_ALLOW_UNPROTECTED_MERGE=1`)

### Escalation channel

Post a comment on the affected PR (or write to stdout if no PR exists yet):

```markdown
## ultimate-developer escalation

Phase: <spec|plan|impl>
PR: #<N> (or "none")
Slug: <slug>
Reason: <enum>
Context: <2-3 sentences>
Suggested action: <what user should decide>

(autonomous flow halted; agent will exit after posting this)
```

Then `exit` (or return) — do not continue.

### Hard safety boundaries (NEVER, regardless of reasoning)

- Never `git push --force` or `--force-with-lease`
- Never `git reset --hard` on a shared branch
- Never merge into `main` or `master` unless the user's chosen `<target>` is explicitly that branch — and post a warning on the PR before merging
- Never `--no-verify` on any git command
- Never bypass branch protection (don't use admin merge)
- Never delete a branch you did not create (only delete `feature/<slug>*` and `chore/<slug>-bump-refs` branches that you opened)
- Never modify `.github/`, `Dockerfile`, `Jenkinsfile`, or any CI config unless the user's feature request explicitly mentions CI
- Never commit files matching: `.env`, `*.env.local`, `credentials*.json`, `*.pem`, `*.key`, `secrets/*`, `.aws/`, `gha-creds-*`, `id_rsa`, `*.p12`, `*.pfx`, `*.keystore`, `*.jks` — scan `git diff --cached` before every commit. Patterns are anchored to basename or path so they don't false-positive on `.envrc` config or `dev.env.example` templates, and don't miss `.aws/config` (the original regex omitted `.aws/`):

```bash
# Anchor patterns to basename boundaries so '.env' matches '.env'/'.env.local' but not 'dev.env.example' or '.envrc'.
# Path patterns (.aws/, secrets/) match anywhere in the path.
if git diff --cached --name-only | grep -E \
  '(^|/)\.env(\..*)?$|(^|/)credentials.*\.json$|\.pem$|\.key$|(^|/)secrets/|(^|/)\.aws/|(^|/)gha-creds-|(^|/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$|\.p12$|\.pfx$|\.keystore$|\.jks$' ; then
  echo "ESCALATE: secret-pattern file staged"
  git diff --cached --name-only | grep -E \
    '(^|/)\.env(\..*)?$|(^|/)credentials.*\.json$|\.pem$|\.key$|(^|/)secrets/|(^|/)\.aws/|(^|/)gha-creds-|(^|/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$|\.p12$|\.pfx$|\.keystore$|\.jks$'
  exit 1
fi
```

If a file genuinely should be committed despite matching (e.g., an `example.env` template), the user must un-stage and re-stage explicitly with a `git commit --no-verify`-equivalent override — which ultimate-developer is forbidden from using. Escalate to user instead.

### Kill switch — `UD_HALT` sentinel

Between every phase transition (Kickoff → Spec, Spec → Plan, Plan → Impl, before submodule-bump):

```bash
if [ -f .claude/UD_HALT ]; then
  # Post status comment on most recent PR + exit cleanly
  echo "Halted by UD_HALT sentinel"
  exit 0
fi
```

Do NOT merge an in-progress PR when halting. Leave it open for the user to inspect.
```

### Task 6.10: Summary report content

- [ ] **Step 1: Replace `## Summary Report` placeholder with:**

```markdown
## Summary Report

After all phases complete (or on escalation), print a final report to stdout:

```markdown
# ultimate-developer run summary

**Slug:** <slug>
**Target branch:** <target>
**Scope:** <muuvie|backend|both>
**Status:** COMPLETE | ESCALATED (<reason>)

## Phases

| Phase | PR | Iterations | Outcome | Merge commit |
|-------|----|-----------|---------|--------------|
| Spec  | #<N> | <i> | merged | <SHA> |
| Plan  | #<N> | <i> | merged | <SHA> |
| Impl (backend) | #<N> | <i> | merged | <SHA> |
| Impl (muuvie)  | #<N> | <i> | merged | <SHA> |
| Submodule bump | #<N> | — | merged | <SHA> |

## Artifacts

- Spec: research/features/<slug>/spec.md
- Plan: research/features/<slug>/plan.md
- Research files: <count> under research/features/<slug>/research/
- Review log: research/features/<slug>/review-log.md
- Kickoff transcript: research/features/<slug>/kickoff.md

## Totals

- Commits authored: <count>
- Sub-agent dispatches: <count> (<breakdown by agent>)
- WebSearch / WebFetch calls: <count>
- Review iterations across all phases: <count>
- Escalations: <count>

## Follow-ups

- (any deferred findings, manual checks recommended, etc.)
```
```

### Task 6.11: Final smoke test + commit

- [ ] **Step 1: Run the full smoke test**

```bash
"$SMOKE"
```
Expected: PASS.

- [ ] **Step 2: Spot-check the file**

```bash
wc -l agents/ultimate-developer.md  # expect ~400-500 lines
grep -cF '## ' agents/ultimate-developer.md  # expect ≥ 10
```

- [ ] **Step 3: Commit + cleanup**

```bash
git add agents/ultimate-developer.md
git commit -m "feat(agents): add ultimate-developer orchestrator"
rm "$SMOKE"
```

---

## Phase 7 — Slash Command

### Task 7.1: `commands/ultimate-feature.md`

**Files:**
- Create: `commands/ultimate-feature.md`

- [ ] **Step 1: Write the file**

```markdown
---
description: Build a feature end-to-end autonomously — spec, plan, implementation with multi-pass review loops on each phase's PR.
argument-hint: "<feature request as plain text>"
---

# /ultimate-feature

Dispatches the `ultimate-developer` agent with the user's feature request.

The agent will:
1. Brainstorm with you (kickoff — the only user touchpoint)
2. Ask for target branch, scope, and slug
3. Write spec → open PR → review loop → merge
4. Plan with research → open PR → review loop → merge
5. Implement → open PR → review loop → merge
6. Bump submodule refs if cross-repo

After kickoff, the agent makes all decisions autonomously until merge or escalation. See `agents/ultimate-developer.md` for the full contract.

Invoke `Task(ultimate-developer, prompt="<user's request>")`.
```

- [ ] **Step 2: Commit**

```bash
git add commands/ultimate-feature.md
git commit -m "feat(commands): add /ultimate-feature slash command"
```

---

## Phase 8 — Docs Sync

### Task 8.1: Update `agents/README.md`

**Files:**
- Modify: `agents/README.md`

- [ ] **Step 1: Add new agents to the "Available Agents" sections**

Use `Edit` to add under "Feature Pipeline" section:

```markdown
- **ultimate-developer** — Autonomous end-to-end orchestrator. Brainstorms with the user once at kickoff; then drives spec → plan → impl phases via review-and-iterate loops on GitHub PRs and merges autonomously. Reuses every other pipeline agent in audit-only mode. Invoke via `/ultimate-feature`.
- **researcher** — Per-topic research sub-agent. Receives a `path` + `topic` + `type` from `ultimate-developer` during plan phase and produces one research markdown file using `WebSearch` + `WebFetch`.
- **backend-implementer** — Kotlin/Ktor mirror of `implementer-tester`. Implements features in the `backend/` submodule per `rules/backend-architecture.md` + `rules/backend-testing.md`.
```

Also append a new section:

```markdown
## Audit-Only Mode

`ultimate-developer` dispatches `reviewer`, `validator`, and `architect-review` in **audit-only mode** (literal string `mode: "audit-only"` in the prompt body). In audit-only mode these agents return STRICT JSON findings and do not write to GitHub. `ultimate-developer` owns all PR replies and thread resolutions. Humans invoking `/review-pr` directly get the default (non-audit-only) behavior.
```

- [ ] **Step 2: Commit**

```bash
git add agents/README.md
git commit -m "doc(agents): document ultimate-developer, researcher, backend-implementer, audit-only mode"
```

### Task 8.2: Update root `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Edits**

- Under "Pipeline agents" bullet list (in the `agents/` section): add the 3 new agents
- Under "Slash commands" bullet list (in the `commands/` section): add `/ultimate-feature`
- Add a brief subsection "## Autonomous Feature Pipeline" near the bottom of the "Development Workflows" section:

```markdown
### Autonomous Feature Pipeline (`/ultimate-feature`)

`/ultimate-feature "<request>"` invokes the `ultimate-developer` agent. After a single kickoff brainstorm, the agent autonomously:
1. Writes the spec, opens a PR, drives a review loop, merges
2. Researches resources + prior art, writes the plan, opens a PR, drives a review loop, merges
3. Implements code in the relevant submodule(s), opens a PR per submodule, drives review loops, merges
4. Bumps submodule refs if cross-repo

All phase docs live under `research/features/<slug>/`. See `agents/ultimate-developer.md` and `research/features/ultimate-developer/spec.md` for the full design.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "doc(claude-md): document autonomous feature pipeline + new agents"
```

### Task 8.3: Update `.claude/CLAUDE.md`

**Files:**
- Modify: `.claude/CLAUDE.md`

- [ ] **Step 1: Add subsection "## Audit-Only Convention" under "Subagent Dispatch" section**

```markdown
## Audit-Only Convention

When dispatching `reviewer`, `validator`, or `architect-review` from an orchestrator agent (e.g. `ultimate-developer`), include the literal string `mode: "audit-only"` in the Task `prompt` body. The sub-agent suppresses all GitHub writes and returns STRICT JSON findings. The orchestrator is then responsible for posting comments, replying to threads, and resolving them.

Default invocation (no `mode` flag) keeps full GH-writing behavior — used by `/review-pr` and direct human invocations.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/CLAUDE.md
git commit -m "doc(claude-md-local): document audit-only sub-agent convention"
```

---

## Phase 9 — End-to-End Smoke Test

### Task 9.1: Pick a small smoke-test feature

**Files:** None modified.

- [ ] **Step 1: Define a deliberately small muuvie-only feature**

Suggested: "Add a 'Refresh' icon button to the movie list screen that re-fetches the current view's data."

Constraints:
- muuvie-only (no backend changes needed; uses existing endpoint)
- One new UI element, one bloc event, one existing-repo use case reuse — small surface
- Acceptance: button visible, tappable, triggers a fresh fetch, shows loading state

- [ ] **Step 2: No commit. Move to invocation.**

### Task 9.2: Run `/ultimate-feature`

**Files:** None modified directly; outputs land under `research/features/<smoke-slug>/`.

- [ ] **Step 1: Invoke**

In a fresh Claude Code session in this repo:

```
/ultimate-feature "Add a Refresh icon button to the movie list screen that re-fetches the current view's data."
```

- [ ] **Step 2: Answer kickoff questions exactly once**

- Target branch: `dev`
- Scope: `muuvie`
- Slug: `movie-list-refresh-button`

- [ ] **Step 3: Observe phase progression**

Watch each phase in turn. Don't intervene unless escalation fires.

### Task 9.3: Verify per-phase outputs

**Files:** None modified; verification only.

- [ ] **Step 1: Verify spec phase**

```bash
# gh pr list --search treats ( ) : as operators; use --json + jq to filter on exact title prefix instead.
ls research/features/movie-list-refresh-button/
gh pr list --state merged --json title,number --jq '.[] | select(.title | startswith("doc(movie-list-refresh-button): spec"))'
```
Expected: `spec.md` + `kickoff.md` present; spec PR shows as merged.

- [ ] **Step 2: Verify plan phase**

```bash
ls research/features/movie-list-refresh-button/research/
gh pr list --state merged --json title,number --jq '.[] | select(.title | startswith("doc(movie-list-refresh-button): plan"))'
```
Expected: 2-5 research files; plan PR merged.

- [ ] **Step 3: Verify impl phase**

```bash
cd muuvie
git log --oneline | head -20
gh pr list --state merged --json title,number --jq '.[] | select(.title | startswith("feat(movie-list-refresh-button)"))'
flutter test
```
Expected: feature commits present; impl PR merged; tests pass.

- [ ] **Step 4: Verify submodule bump**

```bash
cd "$REPO_ROOT"  # back to meta-repo root
git log --oneline | grep "bump submodule refs" | head -3
```
Expected: bump commit on `dev`.

### Task 9.4: Verify cap behavior (manual stress test, optional)

**Files:** None.

- [ ] **Step 1: Trigger an intentionally cap-hitting run**

Re-invoke with a deliberately ambiguous request that will produce many conflicting reviewer findings. Set `UD_MAX_ITER_IMPL=2` so the cap fires quickly.

- [ ] **Step 2: Verify escalation behavior**

Confirm: escalation comment posted on the impl PR; agent exited; PR left open (not merged).

### Task 9.5: Capture lessons learned

**Files:**
- Create: `research/features/ultimate-developer/smoke-test-log.md`

- [ ] **Step 1: Write the log**

Capture: which phases worked first time, which needed prompt tuning, which judge_finding decisions surprised you, total iterations per phase, total tokens consumed (if visible), follow-ups to file as separate plan items.

- [ ] **Step 2: Commit**

```bash
git add research/features/ultimate-developer/smoke-test-log.md
git commit -m "doc(ultimate-developer): record smoke-test lessons learned"
```

---

## Self-Review

After completing all phases (or before invoking subagent-driven-development to execute), verify:

1. **Spec coverage** — every spec section maps to at least one task:
   - Workflow state machine → Phases 6.3 / 6.4 / 6.5
   - Branch + PR conventions → Tasks 6.3 / 6.4 / 6.5 (each phase's PR ops)
   - Review loop driver → Task 6.6
   - `mode: "audit-only"` sub-agent contract → Tasks 2.2 / 2.3 / 2.4 + 6.8
   - Research enforcement + researcher agent → Tasks 4.1 / 4.2 + 6.4
   - Cross-repo handling → Task 6.5
   - Safety circuits + escalation → Task 6.9
   - File list (15 paths) → all referenced in tasks above
   - Open implementation questions → resolved within plan: JSON schemas (Task 2.3 / 2.4), JSON parsing (Task 6.8), backend rules (Tasks 1.2 / 1.3), review-log format (Task 6.6), cross-repo handoff (Task 6.5), topic enumeration heuristics + parallel cap + determinism (Tasks 4.2 / 6.4)

2. **Placeholder scan** — no "TBD", "implement later", "appropriate error handling", or empty test blocks. Open Implementation Questions in the spec are explicitly resolved by tasks above; nothing remains as a placeholder in the plan.

3. **Type consistency** — `mode: "audit-only"` literal text is identical across all sub-agent files and ultimate-developer's dispatch contract. `<slug>` convention identical across all agent files. `feature/<slug>-spec`, `feature/<slug>-plan`, `feature/<slug>`, `chore/<slug>-bump-refs` branch names referenced consistently.

---

## Execution Handoff

Plan complete. Saved to `research/features/ultimate-developer/plan.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.

2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Pick one to proceed.
