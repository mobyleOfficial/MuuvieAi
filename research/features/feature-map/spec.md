---
date: 2026-10-31
author: Claude Opus 5.5 (autonomous session for EdYuTo)
status: approved
related:
  - research/features/ultimate-developer/spec.md
  - rules/common/DOCS_UP_TO_DATE.md
  - rules/common/AI_AGNOSTIC_SUBMODULES.md
tags: [agents, skills, documentation, verification, cross-repo]
---

# Muuvie Feature Map — Design Spec

## Executive Summary

The meta-repo gets a **feature map**: one Markdown file per user-facing Muuvie feature, each tying what a user does (screens, taps, deep links) to the code that does it in **both** submodules — the Flutter route and UI package in `muuvie/`, and the Ktor endpoints and use cases in `backend/`. A small dependency-free Node CLI (`feature-map-check`) checks the map against the submodules: every endpoint, route, path and l10n key the map names must exist, and every endpoint and route the code has must be named by some feature file. Each page records the submodule commits it was read at, so the CLI can also list the pages whose code has changed since. A `feature-mapper` agent and a `/map-features` command write and repair the files; a `PreToolUse` hook and a rule keep the map from drifting when submodule refs move.

**Recommendation:** ship the map as a project skill (`.claude/skills/muuvie-feature-map/`) with the check CLI inside it, populated for the current `dev` tips of both submodules, and wire it into the existing pipeline agents. Driving the Flutter app from an agent (a `topfood-ctl`-style CLI) is the natural next step and is out of scope here.

The plan was reviewed by two independent agents before it was built (design against the prior maps; feasibility against the code). Their changes are folded in below and listed under *Review outcomes*.

## Problem Statement

Agents working on Muuvie start every task by rediscovering the product: which of the 18 UI packages and 13 feature packages owns a screen, which of the ~175 backend routes it calls, and how a user reaches it. That costs tokens, and it costs correctness — an agent that changes `ShelvesRouting.kt` has no cheap way to learn that the app's *Add to shelves* sheet, the profile, and the movie detail all depend on it.

The idea comes from the *Feature Map* in pstack ([Source: "The Complete Guide to pstack Pt. 1", lauren (@poteto), 31 Aug 2026]): an index plus one file per feature with *Sub-features*, *How to get to it (user POV)*, *Driving it*, and *Gotchas*, described as "materialized memory" — a compact projection of the code. The author already runs two such maps:

- **AbbayiOS** (`.claude/skills/verify-abbay/features/`, 18 files, ~3,000 lines). Strong id discipline (every id is a code constant, marked verified or not), a `verified-unreachable` table for Siri/CarPlay/lock screen, and a CLAUDE.md rule that a page out of sync with the app is a bug. But the driver CLI it specifies does not exist, and files have grown long (`player.md` is 337 lines). [Source: AbbayiOS/.claude/skills/verify-abbay/features/README.md]
- **TopFood** (`.claude/skills/verify-topfood/`). The complete form: `SKILL.md`, a tested `topfood-ctl` CLI with JSON output and `doctor`, and compact feature files (`cart.md` ≈ 40 lines). Drift is caught only by periodic manual maintenance passes (commit `aabeeda`, "feature map drift"). [Source: Toptal/.claude/skills/verify-topfood/SKILL.md]

Muuvie adds two things neither had:

1. **Two repos.** A feature spans a Flutter screen and Ktor endpoints. Only the meta-repo sees both.
2. **The map cannot live next to the code.** `rules/common/AI_AGNOSTIC_SUBMODULES.md` forbids AI tooling in the submodules, so submodule PRs never touch the map. Drift is guaranteed unless something mechanical notices it.

Scope: the map, its check CLI, the mapper agent and command, a hook and rule, pipeline-agent wiring, docs. Not in scope: driving the app (no Flutter driver exists; the app has no `integration_test`, Maestro or Patrol setup [Source: muuvie/pubspec.yaml]), adding accessibility identifiers to the app, CI.

## Options Evaluated

### Option 1: Hand-written map only (the Abbay/TopFood shape)
**Description**: Markdown files plus a rule saying "update the page in the same PR".

**Pros**:
- Proven twice by the author [Source: both maps above].
- Zero tooling.

**Cons**:
- Drift is caught only by periodic passes [Source: TopFood commit aabeeda]. Here the code changes in other repos, so the rule has no natural moment to fire.

**Verdict**: Rejected alone — kept as the content format.

### Option 2: Fully generated map
**Description**: A script walks `app_router.dart` and `routing/*.kt` and emits the files.

**Pros**:
- Never drifts on what it extracts.

**Cons**:
- It can extract names, not behaviour. *How to get to it*, sub-features and gotchas — the parts that save an agent the most — are exactly what a parser cannot produce.

**Verdict**: Rejected — but the extraction is the right *check*.

### Option 3: Hand-written map + mechanical two-way check (chosen)
**Description**: Agents write the prose; a CLI extracts the ground-truth inventory (backend endpoints, app routes) and checks the map both ways: every reference resolves (no stale names), every inventory item is referenced (no unmapped features).

**Pros**:
- New endpoints or routes in a submodule bump fail the check, which names the uncovered items: a precise to-do list for the mapper agent.
- The check is the "lever" pstack recommends over more Markdown [Source: pstack Pt. 1, "Build the Lever"].

**Cons**:
- The check cannot see behavioural drift (a changed validation message). Periodic `/map-features --audit` still matters.

**Verdict**: Chosen.

## Recommended Approach

### Layout

```
.claude/skills/muuvie-feature-map/
├── SKILL.md                 # when and how agents use the map; the update rule
├── features/
│   ├── README.md            # the index: preconditions, proof rules, sweep order, "Not mapped"
│   └── <feature>.md         # one per feature
├── bin/feature-map-check    # executable entry (node)
├── lib/*.mjs                # inventory extraction, parsing, checking, output
└── test/*.test.mjs          # node:test, fixtures under test/fixtures/
```

Named `muuvie-feature-map`, not `verify-muuvie`: there is no app driver, and a skill named *verify* that cannot drive the app repeats the Abbay gap. When a driver exists it becomes `verify-muuvie` and links this map.

### Feature file format

Every file has the same sections, in this order. Target ≤ 120 lines; split a feature rather than grow past ~150.

```markdown
# <Feature name>

> Mapped at backend@<sha> muuvie@<sha> · source: code

One paragraph: what it is, for whom, and which tab or entry it lives under.

## Sub-features
- **<slug>:** behaviour, states (loading, empty, error), rules a user can observe.

## How to get to it (user POV)
Tab › button › screen, using the app's own (pt-BR) labels with their `l10n:` keys. Deep links if any.

## Where it lives
### App
- Routes: `ShelfDetailRoute`, `AddToShelvesRoute`
- Code: `muuvie/ui/profile/lib/tabs/shelves`, `muuvie/features/shelves`
### Backend
| Endpoint | Use case |
|---|---|
| `GET /shelves/{id}` | `backend/src/main/kotlin/org/mobyle/domain/usecase/shelves/GetShelf.kt` |

## Driving it
Backend: curl recipes against a local backend (`http://localhost:8080/api/v1`).
App: route or deep link to reach it. No app driver exists yet — say so instead of inventing commands.

## Gotchas
- Things that surprise: auth required, pagination, pt-BR only strings, side effects.
```

### Checkable references

The CLI only trusts what it can parse. Inside backticks:

| Kind | Syntax | Resolves when |
|---|---|---|
| Endpoint | `` `GET /shelves/{id}` `` — method `GET POST PUT PATCH DELETE WS`, path relative to `/api/v1` | a route with the same method and path (param names ignored) exists in `backend/.../routing/*.kt` |
| App route | `` `ShelfDetailRoute` `` — an identifier ending in `Route` or `Tab` | it appears as `<Name>.page` in `muuvie/lib/routes/app_router.dart` |
| Path | `` `muuvie/…` `` or `` `backend/…` `` — real paths, no ellipses or globs | the file or directory exists |
| l10n key | `` `l10n:searchHint` `` | the key exists in `muuvie/ui/common/lib/l10n/app_pt.arb` |

App routes are only *checked* inside *Where it lives*, and a `*Tab` name counts only when the router registers it (13 widget classes end in `Tab`), so Flutter class names in prose never produce false failures. Fenced code blocks are skipped. Everything else in backticks is prose to the checker.

The `> Mapped at` header is required. Its shas let `feature-map-check stale` list, per page, the submodule commits since mapping that touch the paths the page cites — the input for an audit.

### The check CLI

`feature-map-check [check|inventory|uncovered|stale] [--strict] [--root <meta-repo>] [--help]`. Prints one JSON object; exit 0 when `ok`, 1 when the map has problems, 2 on usage or environment errors (missing submodule checkout). `problems` fail the check; `warnings` (page over 150 lines, sections out of order, a submodule checked out off the commit the meta-repo records) don't, except that `--strict` makes the submodule mismatch a problem — the hook uses it, so a push is judged against the code it actually records. A route declaration the checker can't read (a nested `route(...)` block, a non-literal path) is a problem, never silently dropped. Each finding carries `file`, `line`, `kind`, `ref`, `message` and a `fix` sentence telling the agent what to do. `inventory` dumps every extracted endpoint and route with its source file and line — the mapper's ground truth. The README's `## Not mapped` section lists inventory items deliberately left out (`/health/*`, `/metrics`, which are root-mounted rather than under `/api/v1`), each with a reason; those count as covered.

Node ≥ 18, standard library only: the meta-repo already needs Node for `plugins/repo-management`.

### The mapper

- `agents/feature-mapper.md` — writes or repairs feature files. Input: a feature slug, a list of uncovered refs, or `--audit <slug>`. Reads both submodules, writes only under `features/`, and loops on `feature-map-check` until its files are clean.
- `.claude/commands/map-features.md` — `/map-features [<slug>…|--drift|--audit]`. `--drift` (default) runs the check, groups uncovered items by likely feature, and dispatches one `feature-mapper` per file in parallel; `--audit` re-reads the code behind every file for behavioural drift. It plays the role of pstack's `/maintain-verification-skill` for the map.

### Keeping it current

- **Rule** `rules/common/FEATURE_MAP.md`: a meta-repo change that moves a submodule ref, or changes the map, must leave `feature-map-check` passing; behaviour changes update the matching page in the same meta-repo PR; a page that no longer matches the app is a bug.
- **Hook** `.claude/hooks/check-feature-map.sh` (`PreToolUse` Bash, on `git push` / `gh pr create` in the meta-repo): when the branch changes `muuvie`, `backend` or the map against `origin/dev` (else `origin/main`), run `check --strict` and block with its problems. It ignores pushes from inside a submodule and text inside heredoc bodies, and skips when Node, a base ref or a submodule checkout is missing.
- **Pipeline**: `implementer-tester` and `backend-implementer` read the relevant feature file before changing a feature and report which pages need updating; `ultimate-developer` dispatches `feature-mapper` before its submodule-ref bump PR; `validator` runs the check (the hook only gates Claude sessions, so the validator is the backstop).

### Success criteria

1. `feature-map-check` exits 0 on this branch, with every backend endpoint and app route covered or listed in *Not mapped*.
2. Its unit tests pass.
3. Bumping a submodule to a commit that adds a route makes the check fail and name it (shown by a fixture test).
4. Every feature file follows the section format and stays ≤ ~150 lines.

### Known risks

- Behavioural drift is invisible to the check — mitigated by `--audit`, not solved.
- Feature boundaries are a judgement call; an endpoint used by two features may be listed in both.
- The route regex can miss a route declared with a non-literal path; those are reported as unparsed problems rather than dropped.
- Screens reached without a router route (about 13 bottom sheets, ~16 dialogs, two `MaterialPageRoute` pushes) are outside the inventory; pages describe them under the screen that opens them.

## Review outcomes

Changes made after the two plan reviews:

- **Recorded commit, not checkout.** The submodules were bumped first so the map describes the recorded commits; `--strict` fails when a checkout differs from the recorded commit.
- **Provenance.** The `> Mapped at` header and the `stale` command, borrowed from Abbay's verified/not-verified markers but tied to commits.
- **Checkable labels.** `l10n:<key>` refs against `app_pt.arb`, the Muuvie equivalent of Abbay's id constants.
- **Fewer false failures.** Getters (`get() = …`) are not routes; unknown `*Tab` names and Flutter route classes are prose; query strings are ignored; length and section order only warn.
- **Unreachable surfaces table** in the index (push, WebSocket events, deep links, sheets and dialogs), as in Abbay.
- **Page partition from the code**, not guesses: shelf screens live in `ui/profile`, watch parties and the poster game are one `games` page (`GamesRouting`), the diary is gamification, comments fold into watch-logs (no entry point in the app), `settings` and `follows` split out of profile.
- **Local-run preconditions verified**: `JWT_SECRET` is required but missing from `.env.example`; `./gradlew run` doesn't read `.env`; there is no `fastlane ios dev` lane. `CLAUDE.md` was corrected.
- **`verify-docs.sh` fixed**: it resolved its base to `develop`, which doesn't exist here, so it skipped every check.
- **Order**: `feature-mapper` was written before the map and used to populate it.
- **Found while building**: the hook first fired on a heredoc that merely contained the words it matches; it now drops heredoc bodies before matching (regression-tested).

Deferred: an app-side endpoint cross-check. The app's datasource URLs can be extracted (about 134 paths), but only path-level and with per-file prefix substitution. It would turn "not called by the app" into a checked fact.

## Alternative Approaches

Covered under Options. Also rejected: putting the map in each submodule (forbidden by `AI_AGNOSTIC_SUBMODULES`), and generating OpenAPI from Ktor as the backend half (a large backend change for a fraction of the value).

## Next Steps / Action Items

1. Build the check CLI test-first; then the skill, the map, the mapper, hook, rule and docs (see `plan.md`).
2. Follow-up, not this PR: a Flutter app driver (`muuvie-ctl`) so *Driving it* can name real commands — likely Flutter web + Playwright or Maestro — and semantic identifiers in the app for it to address.
3. Follow-up: an advisory app-side endpoint cross-check (see *Review outcomes*).
