# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

MuuvieAi is a **meta-repository** that serves as the central hub for the Muuvie ecosystem. It contains:

- **Shared resources** for AI-assisted development (plugins, rules, skills)
- **Research and documentation** about the ecosystem
- **Git submodules** linking to child repositories (frontend and backend)

Child repositories do not need their own AI-specific documentation — they inherit guidance from this meta-repo.

---

## Repository Structure

```
MuuvieAi/
├── muuvie/           # Git submodule: Flutter frontend app
├── backend/          # Git submodule: Kotlin/Ktor backend
├── research/         # Research docs, analysis, design docs
├── plugins/          # Claude Code MCP servers (e.g. repo-management)
├── rules/            # Ecosystem policies + lint rules
├── patches/          # npm patches applied by patch-package on install
├── .claude/commands/ # Slash commands (/new-usecase, /review-pr, /ultimate-feature, ...)
├── .claude/agents/           # Pipeline + reviewer agents (auto-discovered Markdown)
├── .claude/skills/   # Project-level Claude Code skills (auto-discovered), incl. the feature map
├── .claude/hooks/    # Pre/Post/SessionStart hooks enforcing rules
├── .claude/CLAUDE.md # Claude/tooling-specific behavior (companion to this file)
├── .mcp.json         # MCP server registry (repo-management + linear)
└── CLAUDE.md         # This file
```

---

## Child Repositories

### Muuvie (Flutter Frontend)

**Path:** `./muuvie`  
**Tech Stack:** Flutter, Dart, BLoC, Clean Architecture  
**Platforms:** Android, iOS, Web  
**Key Features:**
- Multi-package monorepo with independently versioned feature packages
- Internationalization (English, Spanish, Portuguese)
- Light/dark theme support
- TMDB API integration via custom backend

**Setup:**
```bash
cd muuvie
rbenv local 3.2.0
bundle install
flutter pub get
dart run build_runner build --delete-conflicting-outputs
bundle exec fastlane setup_ide
```

**Development:**
- Run: `flutter run --flavor dev --dart-define=FLAVOR=dev --dart-define-from-file=secrets/.env` (needs `secrets/.env` with `DEV_BACKEND_URL`; see the feature map's preconditions)
- Tests: `flutter test`
- Code generation: `dart run build_runner build --delete-conflicting-outputs`
- Linting: `flutter analyze`

**Structure:**
- `lib/` — Main app code
- `features/` — Feature modules (BLoC pattern)
- `core/` — Shared utilities and base classes
- `ui/` — UI components and shared widgets
- `ios/` / `android/` — Platform-specific code
- `web/` — Web flavor
- `test/` — Integration and unit tests

---

### MuuvieBackend (Kotlin/Ktor)

**Path:** `./backend`  
**Tech Stack:** Kotlin 2.0.20, Ktor 2.3.0, Koin 3.5.6  
**Database:** TMDB API integration  
**Deployment:** Docker, Gradle

**Setup:**
```bash
cd backend
export TMDB_API_KEY="your_bearer_token"
./gradlew run
```

**Development:**
- Run: `./gradlew run` (starts on `http://localhost:8080`)
- Build fat JAR: `./gradlew buildFatJar`
- Docker: `docker build -t muuvie-backend . && docker run -p 8080:8080 -e TMDB_API_KEY="..." muuvie-backend`

**Structure:**
- `src/` — Kotlin source code
- `build.gradle.kts` — Build configuration
- `Dockerfile` — Container configuration

---

## Working with Git Submodules

Submodules are frozen at specific commits. When cloning or pulling this repo:

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/mobyleOfficial/MuuvieAi

# Or if already cloned, initialize submodules
git submodule update --init --recursive

# Update to latest remote commits
git submodule update --remote
```

**For development in a submodule:**
```bash
cd muuvie  # or backend
git checkout main  # or your branch
git pull
cd ..
# Commit the submodule reference change
git add muuvie
git commit -m "chore: update muuvie submodule reference"
```

---

## Folder Usage

### `research/`
Design docs, architecture decisions, API specs, performance analysis, user research. Reference these when understanding system-wide decisions or context for features.

### `plugins/`
Claude Code MCP servers (e.g. `repo-management`). Registered in `.mcp.json` at repo root — Claude Code loads them automatically each session. Bootstrap builds the TypeScript source to `plugins/repo-management/dist/`.

### `rules/`
Linting configurations, formatter rules, and architecture policies organized into three categories:

**Common Rules (Both Frontend & Backend):**
- `common/AI_AGNOSTIC_SUBMODULES.md` — Child repos must remain AI-agnostic
- `common/LOCAL_CLAUDE_CONFIG.md` — Config must use portable relative paths
- `common/NO_COAUTHORS.md` — Never use Co-Authored-By trailers
- `common/PYTHON_ENVS.md` — All Python in local venv
- `common/FEATURE_MAP.md` — The feature map must match the recorded submodule commits
- `common/variable-naming.md` — Naming conventions

**Frontend Rules (Flutter/Dart):**
- `frontend/feature-architecture.md` — Feature module structure
- `frontend/feature-implementation.md` — Dart code style
- `frontend/feature-testing.md` — Testing patterns
- `frontend/ui-architecture.md` — UI module structure
- `frontend/accessibility.md` — WCAG AA compliance
- `frontend/localization.md` — Multi-language support

**Backend Rules (Kotlin/Ktor):**
- `backend/backend-architecture.md` — Clean architecture
- `backend/backend-implementation.md` — Kotlin code style
- `backend/backend-testing.md` — Testing patterns

### `.claude/skills/`
Project-level Claude Code skills, auto-discovered each session from `.claude/skills/<name>/SKILL.md`. Use when implementing repetitive patterns or cross-repo concerns.

**Available Skills:**
- `muuvie-research-format` — Standardized format for design docs, architecture decisions, and research documentation
- `setting-up-linear-mcp` — Configure Linear MCP and securely store token
- `verify-docs-before-pr` — Documentation verification before opening a PR
- `muuvie-feature-map` — Map of every user-facing feature across both submodules, checked by `bin/feature-map-check`

### `.claude/agents/`
Auto-discovered Markdown agent definitions (no registration needed). Dispatched via the `Task` tool's `subagent_type` parameter.

**Pipeline agents** (feature development):
- `pm-spec` — writes feature specs / design docs
- `architect-review` — reviews specs for ecosystem feasibility
- `implementer-tester` — implements + tests features inside the `muuvie` submodule
- `validator` — read-only quality + correctness check across submodules; surfaces inline PR comments
- `ultimate-developer` — autonomous end-to-end orchestrator; drives spec → plan → impl phases via PR review loops; invoke via `/ultimate-feature`
- `researcher` — per-topic research sub-agent dispatched by `ultimate-developer` during plan phase
- `feature-mapper` — writes and repairs feature-map pages by tracing a feature through both submodules; dispatched by `/map-features`
- `backend-implementer` — Kotlin/Ktor mirror of `implementer-tester`; implements features in the `backend/` submodule

**Reviewer agents** (PR review):
- `reviewer` — orchestrator; dispatches the three sub-reviewers, dedupes, posts one batched GitHub review with severity badges
- `reviewers/security`, `reviewers/bug-finder`, `reviewers/architecture` — scoped sub-reviewers, one domain each

### `.claude/commands/`
Slash commands invoked via `/<name>`. Claude Code auto-discovers files from this path; no registration needed. (Repo-root `commands/` and `skills/` are NOT discovery paths — files there are not callable.)

**Frontend scaffolding (Flutter/Dart):**
- `/new-usecase` — Scaffold a domain usecase with `Result<T>` error handling
- `/new-datasource` — Scaffold a remote/local datasource (Dio HTTP or local)
- `/new-repository` — Scaffold domain/data repository pair
- `/new-ui-module` — Scaffold a complete UI module (state/bloc/page/screen)

**Backend scaffolding (Kotlin/Ktor):**
- `/new-kotlin-usecase` — Scaffold a business logic usecase with `operator fun invoke()`
- `/new-kotlin-datasource` — Scaffold a Ktor HTTP client datasource
- `/new-kotlin-repository` — Scaffold domain/data repository pair with DTO mapping
- `/new-ktor-endpoint` — Scaffold an API endpoint with routing and DI

**Pipeline:**
- `/review-pr <PR#>` — invokes the `reviewer` agent
- `/ultimate-feature "<request>"` — invokes the `ultimate-developer` agent for autonomous end-to-end delivery
- `/map-features [<slug>…|--drift|--audit]` — dispatches `feature-mapper` agents to bring the feature map in line with the submodules

The scaffolding commands feed into `implementer-tester` (frontend) and `backend-implementer` (backend).

### `.claude/hooks/`
Pre/Post/SessionStart hooks wired in `.claude/settings.json`. Flat directory — one script per file, no subdirectories. Each rule in `rules/` is backed by a hook here; see [.claude/CLAUDE.md § Hook Expectations](.claude/CLAUDE.md#hook-expectations) for the full table and [.claude/hooks/README.md](.claude/hooks/README.md) for per-hook detail.

**Always-on** (wired in `settings.json`): `session-start.sh`, `block-destructive-commands.sh`, `check-coauthor.sh`, `check-python-env.sh`, `check-submodule-ai.sh`, `check-docs-sync.sh`, `check-feature-map.sh`, `format-code.sh`.

**Per-agent** (declared in the `hooks:` frontmatter of the agent they guard):
- `implementer-tester`: `enforce-path-restrictions.sh`, `block-cross-feature-data-imports.sh`, `validate-implementation.sh` (runs `regenerate-generated-files.sh` and `verify-di-registration.sh`), `validate-localization.sh`, `validate-module-structure.sh`
- `backend-implementer`: `enforce-path-restrictions.sh`, `validate-backend-structure.sh`, `validate-kotlin-code.sh`, `verify-koin-di-registration.sh`
- `pm-spec`: `validate-spec.sh`; `architect-review`: `human-gate-review.sh`
- Run by hand: `pipeline-coordinator.sh <agent>` (manual queue), `validate-audit-only.sh` (used by `ultimate-developer`)

`lib-hook.sh` holds the helpers every hook sources. Tests: `npm run test:hooks` runs each hook under macOS's bash 3.2 with crafted hook JSON.

---

## Key Architecture Patterns

### Frontend (Muuvie)
- **State Management:** BLoC pattern for clean separation of business logic
- **Structure:** Feature-based packages with core utilities
- **Routing:** Code-generated (build_runner)
- **Dependency Injection:** GetIt or manual injection per feature
- **Testing:** Unit tests in feature packages, integration tests in root

### Backend (MuuvieBackend)
- **Framework:** Ktor for lightweight, composable HTTP routing
- **DI:** Koin modules for clean dependency management
- **Serialization:** Kotlinx for JSON (no reflection overhead)
- **API Integration:** TMDB API with custom wrapper endpoints

### Communication
- Frontend calls backend at configurable endpoint
- Backend proxies TMDB API and applies business logic
- Shared error handling and HTTP status conventions

---

## Development Workflows

### Adding a Feature
1. **Frontend:** Create feature package in `muuvie/features/`
2. **Backend:** Add endpoint in `backend/src/`
3. **Documentation:** Update research/ with API contract if complex
4. **Testing:** Write tests in respective repos

### Making Cross-Repo Changes
1. Update backend first
2. Update frontend to consume new API
3. Commit both submodule references in MuuvieAi, with the feature-map pages the change affects (`/map-features`; enforced by `check-feature-map.sh`)

### Debugging Integration Issues
- Check `muuvie/secrets/.env` for correct backend URL
- Verify `TMDB_API_KEY` in backend environment
- Review backend logs: `./gradlew run` (verbose output)
- Check frontend logs: Flutter DevTools or `flutter logs`

### Autonomous Feature Pipeline (`/ultimate-feature`)

`/ultimate-feature "<request>"` invokes the `ultimate-developer` agent. After a single kickoff brainstorm, the agent autonomously:
1. Writes the spec, opens a PR, drives a review loop, merges
2. Researches resources + prior art, writes the plan, opens a PR, drives a review loop, merges
3. Implements code in the relevant submodule(s), opens a PR per submodule, drives review loops, merges
4. Bumps submodule refs if cross-repo

All phase docs live under `research/features/<slug>/`. See `.claude/agents/ultimate-developer.md` and `research/features/ultimate-developer/spec.md` for the full design.

---

## Common Commands Across the Ecosystem

**Muuvie (Flutter):**
```bash
cd muuvie
flutter pub get                                    # Install dependencies
dart run build_runner build --delete-conflicting-outputs  # Code generation
flutter test                                       # Run tests
flutter analyze                                    # Lint
flutter run --flavor dev --dart-define=FLAVOR=dev --dart-define-from-file=secrets/.env  # Run (dev flavor)
```

**MuuvieBackend (Kotlin):**
```bash
cd backend
./gradlew run                                      # Run locally
./gradlew buildFatJar                              # Build production jar
./gradlew test                                     # Run tests
```

---

## Resources

- **TMDB API Docs:** https://developer.themoviedb.org/docs
- **Flutter Docs:** https://flutter.dev/docs
- **Ktor Docs:** https://ktor.io/docs
- **BLoC Pattern:** https://bloclibrary.dev/

---

## Critical Rules

**AI-Agnostic Submodules:** Child repos (muuvie, backend) MUST remain AI-agnostic. No CLAUDE.md, .claude/, or AI-specific references in submodules. All AI integration lives in this meta-repo. Single human author per commit (no Claude co-authors). See [rules/common/AI_AGNOSTIC_SUBMODULES.md](rules/common/AI_AGNOSTIC_SUBMODULES.md).

**No Coauthors:** Never use `Co-Authored-By` trailers in commits, PR descriptions, or issues in any child repository. Single author per commit always. See [rules/common/NO_COAUTHORS.md](rules/common/NO_COAUTHORS.md).

**Python Environments:** All Python dependencies MUST be installed in a local, project-specific Python environment. Never install globally. See [rules/common/PYTHON_ENVS.md](rules/common/PYTHON_ENVS.md).

**Local Claude Config:** All `.claude/` configuration MUST use portable, relative paths. No global (`~/`) or absolute user paths. Enables config reuse across team. Validated on every prompt. See [rules/common/LOCAL_CLAUDE_CONFIG.md](rules/common/LOCAL_CLAUDE_CONFIG.md).

**Docs Up To Date:** Every change affecting user-facing behavior, public interfaces, configuration, or directory structure MUST update the corresponding documentation (README.md, CLAUDE.md, subdir READMEs) in the same PR. Enforced by `.claude/hooks/check-docs-sync.sh` on `gh pr create` / `git push`. See [rules/common/DOCS_UP_TO_DATE.md](rules/common/DOCS_UP_TO_DATE.md).

**Feature Map:** `.claude/skills/muuvie-feature-map/` maps every user-facing feature across both submodules. A meta-repo change that moves a submodule ref or edits the map must leave `feature-map-check --strict` passing; a page that no longer matches the app is a bug. Enforced by `.claude/hooks/check-feature-map.sh` on `gh pr create` / `git push`. See [rules/common/FEATURE_MAP.md](rules/common/FEATURE_MAP.md).

## Conventions

### Commit Messages
All commits across child repos follow Conventional Commits format:
- `fix:` — bug fixes
- `feat:` — new features
- `chore:` — maintenance, dependency updates, tooling
- `doc:` — documentation

Example: `fix: correct auth token expiry logic`

### Branch Naming
- **Feature branches:** `feature/<description>` (target: `dev`)
- **Release branches:** `release/<version>` (target: `main`)
- **Bugfix branches:** `fix/<description>` (target: `dev`)

### Pull Requests
- Feature/bugfix PRs target `dev`
- Release PRs target `main`
- Use Conventional Commits format in PR title
- No coauthors in PR descriptions
- **Docs sync is hook-enforced:** `.claude/hooks/check-docs-sync.sh` blocks `gh pr create` / `git push` when public-surface changes are missing matching doc updates — fix the docs before retrying. The `verify-docs-before-pr` skill is available for a manual pre-flight check but is not required.

### Submodule Operations
Handled by `repo-management` MCP server:
- `sync-submodule <name>` — update to latest remote
- `create-feature-branch <name>` — sync first, then create `feature/<name>`
- `create-release-branch <version>` — sync first, then create `release/<version>`
- `open-pull-request` — auto-detects branch type, targets correct base branch
- `check-status` — show stale/dirty submodules

---

## Setup for New Sessions

### Context Tracking (Statusline)

The project includes a **context usage statusline** showing:
- Model name
- Context usage % (color-coded: green <70%, yellow 70-89%, red 90%+)
- Session & weekly rate limit usage (Pro/Max plans)

Displays automatically in the bottom right. Helps identify when to compact conversations. No setup needed — included in `.claude/settings.json`.

### Load Rules, Plugins, and Skills (Every Session)

At the start of each session, load these resources:

**1. Rules** — Organizational policies that govern all work. Rules live under `rules/{common,frontend,backend}/`.

**Critical policies (all development, each backed by a hook):**
- [`rules/common/NO_COAUTHORS.md`](rules/common/NO_COAUTHORS.md) — never use `Co-Authored-By` trailers in commits, single author always
- [`rules/common/AI_AGNOSTIC_SUBMODULES.md`](rules/common/AI_AGNOSTIC_SUBMODULES.md) — child repos (`muuvie`, `backend`) must remain AI-agnostic, no `CLAUDE.md` / `.claude/` / `.cursorrules` / `copilot-instructions.md` / `AGENTS.md` in submodules
- [`rules/common/LOCAL_CLAUDE_CONFIG.md`](rules/common/LOCAL_CLAUDE_CONFIG.md) — all `.claude/` + `.mcp.json` config must use portable relative paths, no `~/` or absolute user paths
- [`rules/common/PYTHON_ENVS.md`](rules/common/PYTHON_ENVS.md) — all Python `pip` / `uv` / `poetry` / `conda install` must run inside an active virtualenv
- [`rules/common/DOCS_UP_TO_DATE.md`](rules/common/DOCS_UP_TO_DATE.md) — public-surface changes must update docs in the same PR (blocked by `check-docs-sync.sh` on `gh pr create` / `git push`)
- [`rules/common/FEATURE_MAP.md`](rules/common/FEATURE_MAP.md) — the feature map must match the recorded submodule commits (blocked by `check-feature-map.sh` on `gh pr create` / `git push`)
- [`rules/common/variable-naming.md`](rules/common/variable-naming.md) — naming conventions across both stacks

**Frontend-specific:** `rules/frontend/` — `feature-architecture`, `feature-implementation`, `feature-testing`, `ui-architecture`, `accessibility`, `localization`

**Backend-specific:** `rules/backend/` — `backend-architecture`, `backend-implementation`, `backend-testing`

Lint rules (Flutter-side, applied by `implementer-tester` agent): `accessibility`, `feature-architecture`, `feature-implementation`, `feature-testing`, `localization`, `ui-architecture`, `variable-naming`. See [`rules/README.md`](rules/README.md) for the full enforcement map.

**2. Plugins** — MCP servers registered in `.mcp.json`:
- `repo-management` — manage submodules, branches, PRs
- `linear` — Linear workspace integration (token in gitignored `.claude/settings.local.json`)

**3. Skills** — auto-discovered from `.claude/skills/<name>/SKILL.md`:
- `setting-up-linear-mcp` — configure Linear MCP and securely store the token
- `muuvie-research-format` — standardized format for design docs / architecture decisions / research
- `muuvie-feature-map` — map of every user-facing feature across both submodules; open its index before touching a feature
- `verify-docs-before-pr` — manual docs check (the `check-docs-sync.sh` hook already blocks PRs / pushes that fall out of sync — invoke this skill only for a pre-flight self-check)

**4. Slash commands** — invoked via `/<name>`, defined under `.claude/commands/`:
- `/new-usecase`, `/new-datasource`, `/new-repository`, `/new-ui-module` — Flutter scaffolding, feeds into the `implementer-tester` agent
- `/new-kotlin-usecase`, `/new-kotlin-datasource`, `/new-kotlin-repository`, `/new-ktor-endpoint` — Kotlin/Ktor scaffolding, feeds into the `backend-implementer` agent
- `/review-pr <PR#>` — runs the `reviewer` agent against a GitHub PR
- `/ultimate-feature "<request>"` — runs the `ultimate-developer` agent for autonomous end-to-end feature delivery
- `/map-features` — runs `feature-mapper` agents to repair the feature map after a submodule ref moves

**5. Agents** — dispatched via the `Task` tool's `subagent_type` parameter, auto-discovered from `.claude/agents/`:
- `implementer-tester` — Flutter/Dart feature implementation
- `backend-implementer` — Kotlin/Ktor backend feature implementation
- `architect-review` — spec feasibility review
- `reviewer` — code quality validation (orchestrates `reviewers/security`, `reviewers/bug-finder`, `reviewers/architecture`)
- `validator` — final pre-merge validation
- `feature-mapper` — writes and repairs feature-map pages

These resources are binding for all work in this repo. Obey rules before suggesting code.

### Linear MCP (First Time)

Run `/setting-up-linear-mcp` — guides secure project-level setup with workspace scoping + token storage.

Default project: MOO (Muuvie). Token stored in `.claude/settings.local.json` (gitignored).

---

## Notes for Claude Instances

When working in child repos (muuvie or backend):
- Refer back to this CLAUDE.md for ecosystem context
- Check `research/` for design decisions that affect your changes
- Use `plugins/` and `.claude/skills/` resources for repeated tasks
- Update submodule references in the meta-repo after merging changes
- **Follow NO_COAUTHORS rule strictly** — single author on all commits
- If adding new shared resources, document them here

When using Linear in Claude Code:
- Linear MCP defaults to MOO project (Muuvie)
- Create issue references: `MOO-123`, `MOO-456`
- Link issues in PRs via description: "Closes MOO-123"
