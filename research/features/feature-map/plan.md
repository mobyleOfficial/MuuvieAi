# Muuvie Feature Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A cross-repo feature map for Muuvie in the meta-repo, kept honest by a two-way check CLI, maintained by a mapper agent, command, hook and rule.

**Architecture:** Markdown feature files under `.claude/skills/muuvie-feature-map/features/`; a dependency-free Node CLI extracts the backend endpoint and app route inventory from the submodules and checks the map against it both ways; agents write the prose and loop on the CLI.

**Tech Stack:** Node ≥ 18 (ESM, `node:test`, no dependencies), Bash hooks, Markdown agents/commands.

**Spec:** `research/features/feature-map/spec.md`

## Execution notes (after plan review)

Two reviewers read this plan before it ran; the spec's *Review outcomes* lists what changed. For this plan that means:

- Task 6 Step 1 (the submodule ref bump) ran **first**, so the map describes the recorded commits.
- Task 4's `feature-mapper` agent was written **before** Task 3 and used to populate the map (five mappers in parallel).
- Task 1 grew: `l10n:` refs, the required `> Mapped at` header, `stale`, `--strict`, warnings vs problems, `route(` blocks reported, getters skipped, unknown `*Tab` names treated as prose.
- Task 3's slug table is superseded by `features/README.md` (22 pages, partitioned from the code).

## Global Constraints

- No AI tooling inside `muuvie/` or `backend/` (`rules/common/AI_AGNOSTIC_SUBMODULES.md`). The map, CLI and tests live in the meta-repo only.
- No `Co-Authored-By` trailers; no AI attribution in commits or the PR body.
- All `.claude/` config uses repo-relative paths (`rules/common/LOCAL_CLAUDE_CONFIG.md`).
- CLI prints exactly one JSON object on stdout; exit 0 ok, 1 map problems, 2 usage/environment error.
- Endpoint paths in the map are relative to `/api/v1`; methods are `GET POST PUT PATCH DELETE WS`.
- Feature files: sections `Sub-features`, `How to get to it (user POV)`, `Where it lives`, `Driving it`, `Gotchas`, in that order; target ≤ 120 lines, hard ceiling ~150.
- PR targets `dev`. Branch `feature/feature-map`.

## Review Focus

1. A route declared with a non-literal path (`get(somePath)`) or split across lines — must surface in `inventory.unparsed`, never be silently dropped. → Task 1 test `reports unparsed route declarations`.
2. Path params with different names (`{id}` in map vs `{shelfId}` in code) — must match. → Task 1 test `matches endpoints ignoring param names`.
3. A backticked word that merely ends in `Route` in prose (e.g. `` `AutoRoute` ``) — must not be reported as a missing app route unless it looks like a page name. → Task 1: ignore the framework names `AutoRoute`, `CustomRoute`, `RootStackRouter`; test `ignores framework route class names`.
4. Missing submodule checkout (fresh clone without `--recurse-submodules`) — exit 2 with a `fix` telling the user to run `git submodule update --init`, and the hook must not block. → Task 1 test `exits 2 when a submodule is not checked out`; Task 4 manual check.
5. Same endpoint listed in two feature files — allowed, counted once for coverage. → Task 1 test `counts an endpoint referenced twice once`.

---

### Task 1: `feature-map-check` CLI

**Files:**
- Create: `.claude/skills/muuvie-feature-map/bin/feature-map-check` (shebang `#!/usr/bin/env node`, imports `../lib/cli.mjs`)
- Create: `.claude/skills/muuvie-feature-map/lib/inventory.mjs`, `lib/references.mjs`, `lib/check.mjs`, `lib/cli.mjs`
- Create: `.claude/skills/muuvie-feature-map/package.json` (`{"type":"module","private":true,"scripts":{"test":"node --test test/"}}`, no deps)
- Test: `.claude/skills/muuvie-feature-map/test/{inventory,references,check,cli}.test.mjs`, fixtures in `test/fixtures/<case>/` shaped like the meta-repo (`backend/src/main/kotlin/org/mobyle/routing/*.kt`, `muuvie/lib/routes/app_router.dart`, `.claude/skills/muuvie-feature-map/features/*.md`).

**Interfaces:**
- Produces:
  - `extractInventory(root: string) → { endpoints: Endpoint[], routes: AppRoute[], unparsed: {file,line,text}[] }` where `Endpoint = {method, path, key, file, line}`, `key = METHOD + ' ' + path with every {param} replaced by {}`; `AppRoute = {name, file, line}`.
    Backend: scan `backend/src/main/kotlin/org/mobyle/routing/*.kt` for `\b(get|post|put|patch|delete|webSocket)\(\s*"([^"]*)"`; `webSocket` → method `WS`. Lines that contain `\b(get|post|put|patch|delete|webSocket)\(` (as a Ktor call — preceded by start/whitespace) but no literal path go to `unparsed`. HealthRouting is included (it is listed under *Not mapped*).
    App: scan `muuvie/lib/routes/app_router.dart` for `\b([A-Z]\w*)\.page\b`, unique by name.
  - `parseFeatureFile(path: string, text: string) → { refs: Ref[], sections: string[] }`; `Ref = {kind: 'endpoint'|'route'|'path', value, key?, line}`. Only backtick spans; endpoint regex `^(GET|POST|PUT|PATCH|DELETE|WS) (/\S*)$`; route regex `^[A-Z]\w*(Route|Tab)$` minus `AutoRoute|CustomRoute|RootStackRouter`; path regex `^(muuvie|backend)/`.
  - `parseNotMapped(readmeText) → Ref[]` — refs inside the `## Not mapped` section of `features/README.md`.
  - `check(root) → { ok, files, problems: Problem[], uncovered: {endpoints, routes}, stats }`; `Problem = {file, line, kind: 'missing-endpoint'|'missing-route'|'missing-path'|'missing-section'|'section-order'|'too-long', ref, message, fix}`. `too-long` when a feature file exceeds 150 lines. Section checks skip `README.md`. `ok` is false when there are problems or uncovered items.
  - CLI: `feature-map-check [check|inventory|uncovered] [--root <dir>] [--help]`; default `check`; `--root` defaults to `git rev-parse --show-toplevel` from the script's own directory. Exit 2 with `{ok:false,error,fix}` when `backend/src/main/kotlin/org/mobyle/routing` or `muuvie/lib/routes/app_router.dart` is missing.

- [ ] **Step 1: Write failing tests** — `inventory.test.mjs`: `extracts get/post/put/patch/delete/webSocket routes with file and line`, `reports unparsed route declarations`, `extracts app routes from .page references once each`. `references.test.mjs`: `parses endpoint, route and path refs inside backticks only`, `ignores framework route class names`, `reads Not mapped refs from README`. `check.test.mjs`: `matches endpoints ignoring param names`, `reports missing endpoint/route/path with fix text`, `reports uncovered inventory items`, `treats Not mapped items as covered`, `counts an endpoint referenced twice once`, `reports missing or out-of-order sections`, `reports files over 150 lines`, `a new route in the backend fixture fails the check and is named`. `cli.test.mjs` (spawn the bin): `prints JSON and exits 0 on a clean fixture`, `exits 1 with problems`, `exits 2 when a submodule is not checked out`, `--help exits 0 and lists subcommands`.
- [ ] **Step 2: Run** `cd .claude/skills/muuvie-feature-map && npm test` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the four modules per Interfaces.
- [ ] **Step 4: Run** `npm test` — Expected: all pass. Then `bin/feature-map-check inventory` on the real repo: Expected endpoints ≈ 174+ and `unparsed` lists the remaining declarations (≈ 3) with their lines.
- [ ] **Step 5: Commit** `feat(feature-map): add feature-map-check CLI`.

### Task 2: Skill and index

**Files:**
- Create: `.claude/skills/muuvie-feature-map/SKILL.md` — frontmatter `name: muuvie-feature-map`, description triggering on "before changing, reviewing, verifying or explaining any user-facing Muuvie feature, or when a submodule ref moves". Body: what the map is; open the index, then only the file you need; reference syntax table (from spec); the CLI and its subcommands; the update rule; that there is no app driver yet.
- Create: `.claude/skills/muuvie-feature-map/features/README.md` — baseline preconditions (local backend: `cd backend && ./gradlew run`, env vars it needs — read `backend/README.md`/`docker-compose.yml` for the real list; app: `bundle exec fastlane ios dev`), proof and skip reporting, *Full sweep* index grouped by the five tabs (Atts=SocialTab, Catálogo=SearchTab, Programação, Notícias, Perfil) plus *Shell and account* and *Cross-cutting*, and `## Not mapped` (`GET /health/live`, `GET /health/ready`, `GET /metrics`, each with reason).

- [ ] **Step 1:** Write both files.
- [ ] **Step 2: Run** `bin/feature-map-check` — Expected: exit 1, with `uncovered` listing every endpoint/route except the *Not mapped* ones, and no problems for README.
- [ ] **Step 3: Commit** `feat(feature-map): add muuvie-feature-map skill and index`.

### Task 3: Populate the map

Feature files (slug → primary sources). Boundaries may be adjusted by the writer; every inventory item must end up in some file.

| Slug | App | Backend routing |
|---|---|---|
| app-shell | `muuvie/lib/routes/*`, `lib/push/*`, `lib/firebase/*`, `ui/common` | `WebSocketRouting.kt` (shared parts) |
| auth | `ui/auth`, `features/auth` | `AuthRouting.kt`, `UsersRouting.kt` (account parts) |
| onboarding | `ui/onboarding`, `features/onboarding` | relevant `UsersRouting`/`ProfileRouting` |
| profile | `ui/profile`, `features/profile` | `ProfileRouting.kt`, `UsersRouting.kt` |
| public-profile-and-follows | `ui/public_profile` | `SocialRouting.kt` (follow), `UsersRouting.kt` |
| catalog-search | `ui/search`, `ui/movies_ui` (browse) | `MoviesRouting.kt` (lists), `DiscoverRouting.kt` |
| movie-detail | `ui/movies_ui`, `features/movies` | `MoviesRouting.kt`, `PersonsRouting.kt` |
| comments | wherever comments render | `CommentsRouting.kt` |
| shelves | `ui/shelves`, `features/shelves` | `ShelvesRouting.kt` |
| locadoras | `ui/locadoras` | `LocadorasRouting.kt` |
| watch-logs | `ui/watch_logs`, `features/watch_logs` | `WatchRouting.kt` (logs, ratings, diary) |
| watch-party | `ui/watch_logs` or owner package | `WatchRouting.kt` (parties), `WebSocketRouting.kt` |
| imports | `ui/imports`, `features/imports` | `ImportsRouting.kt` |
| social-feed | `ui/social`, `features/social_network` | `FeedRouting.kt`, `SocialRouting.kt` (activities) |
| whispers | `ui/whispers` | `MessagesRouting.kt` |
| maratonas | `ui/maratonas`, `features/maratonas` | `MaratonasRouting.kt` |
| cineclubes | `ui/cineclubes`, `features/cineclubes` | `CineClubesRouting.kt` |
| programacao | `ui/programacao` | whichever endpoints it calls |
| news | `ui/news`, `features/news` | `ArticlesRouting.kt` |
| gamification | `ui/gamification`, `features/gamification` | `GamificationRouting.kt`, `GamesRouting.kt` |
| stats | `features/stats`, retrospective | `StatsRouting.kt` |

- [ ] **Step 1:** Run `bin/feature-map-check inventory > /tmp/feature-map-inventory.json` and split the table among parallel writers (≈ 4 slugs each). Each writer gets: the spec's format and reference syntax, `features/README.md`, the TopFood `cart.md` as a style sample (compact, observable behaviour, exact values), the inventory file, and their slugs. Each writer must trace the app side from route → page → BLoC → repository → datasource URL so every endpoint a screen calls is listed, and must run `bin/feature-map-check` and leave no `problems` in its own files.
- [ ] **Step 2:** Merge, update the README index links, run `bin/feature-map-check`. Expected: `ok: true`. Assign any leftover `uncovered` items to the right file (or *Not mapped* with a reason) until it is.
- [ ] **Step 3:** Spot-check three files against the code by hand (one backend-heavy, one app-heavy, one cross-cutting): every claimed label, rule and endpoint is real.
- [ ] **Step 4: Commit** `feat(feature-map): map every Muuvie feature across app and backend`.

### Task 4: Mapper agent, command, rule, hook

**Files:**
- Create: `agents/feature-mapper.md` — frontmatter like the other agents (`name`, `description`, `tools: Read, Grep, Glob, Bash, Edit, Write`). Inputs: slugs, uncovered refs, or `--audit <slug>`. Writes only under `.claude/skills/muuvie-feature-map/features/`. Loop: inventory → trace code → write → `feature-map-check` until its files are clean. Output: files changed, refs added/removed, anything it could not place.
- Create: `.claude/commands/map-features.md` — `/map-features [<slug>…|--drift|--audit]` per spec; dispatches `feature-mapper` agents in parallel, one per file; finishes with the check output.
- Create: `rules/common/FEATURE_MAP.md` — rule text per spec, enforcement section naming the hook.
- Create: `.claude/hooks/check-feature-map.sh` — same matching as `check-docs-sync.sh` (`gh pr create` / `git push`); base = first of `origin/dev`, `origin/main` that resolves; trigger when `git diff --name-only <base>...HEAD` includes `muuvie`, `backend` or `.claude/skills/muuvie-feature-map/`; skip silently when `node` is missing or the CLI exits 2; on exit 1 print the problems/uncovered summary to stderr and `exit 2`.
- Modify: `.claude/settings.json` — add the hook after `check-docs-sync.sh`.

- [ ] **Step 1:** Write the files.
- [ ] **Step 2: Verify the hook** by piping JSON: `echo '{"tool_input":{"command":"git push"}}' | .claude/hooks/check-feature-map.sh; echo $?` → 0 on the clean branch; temporarily add a bogus `` `GET /nope` `` to a feature file → exit 2 naming it; revert. `echo '{"tool_input":{"command":"ls"}}' | …` → 0 without running the CLI.
- [ ] **Step 3: Commit** `feat(feature-map): add feature-mapper agent, /map-features, rule and hook`.

### Task 5: Pipeline wiring and docs

**Files:**
- Modify: `agents/implementer-tester.md`, `agents/backend-implementer.md` — before changing a feature, read its feature file; in the final report, list feature-map pages that need updating.
- Modify: `agents/ultimate-developer.md` — before the submodule-ref bump PR, run `/map-features --drift` (or dispatch `feature-mapper`) and include the map changes in that PR.
- Modify: `agents/validator.md` — run `feature-map-check` and report problems as findings.
- Modify docs: `CLAUDE.md` (structure tree, skills, agents, commands, hooks, critical rules), `.claude/CLAUDE.md` (hook table), `agents/README.md`, `.claude/skills/README.md`, `.claude/hooks/README.md`, `rules/README.md`.

- [ ] **Step 1:** Make the edits, matching each file's existing style.
- [ ] **Step 2: Run** `.claude/verify-docs.sh` and `bin/feature-map-check` and `npm test` — Expected: all succeed.
- [ ] **Step 3: Commit** `doc(feature-map): wire the map into pipeline agents and docs`.

### Task 6: Submodule refs and PR

- [ ] **Step 1:** Commit the `muuvie` and `backend` ref bumps to their current `dev` tips (the commits the map describes): `chore: bump muuvie and backend to dev tips mapped by the feature map`.
- [ ] **Step 2:** Whole-branch review by a fresh agent; fix findings.
- [ ] **Step 3:** Push, `gh pr create --base dev` with a body documenting what shipped, how it was verified (test counts, check output), what is knowingly left (app driver, behavioural drift), and what comes next. No AI attribution.
