# MuuvieAi

Meta-repository for the Muuvie ecosystem. Central hub for shared resources, AI-assisted development, and automated repository management.

## Quick Start

Clone with submodules and run the bootstrap script:
```bash
git clone --recurse-submodules https://github.com/mobyleOfficial/MuuvieAi
cd MuuvieAi
./bootstrap.sh
```

The bootstrap initializes submodules, installs root + plugin npm dependencies (re-applies the `linear-mcp` patch via `patch-package`), marks every `.claude/**/*.sh` script executable, and seeds `.claude/settings.local.json` + `.claude/task/pipeline-queue.json` from templates. Idempotent — safe to re-run.

**Required system tools:** `git`, `npm`, `jq`, `gh`. The script aborts early if any are missing.

After bootstrap, set `LINEAR_ACCESS_TOKEN` in `.claude/settings.local.json` (gitignored) before using the Linear MCP server. See [`.claude/skills/setting-up-linear-mcp/SKILL.md`](.claude/skills/setting-up-linear-mcp/SKILL.md).

## Structure

- **[muuvie/](muuvie)** — Flutter frontend (Android, iOS, Web)
- **[backend/](backend)** — Kotlin/Ktor API server
- **[research/](research)** — Design docs, API specs, architecture decisions
- **[plugins/](plugins)** — Claude Code MCP servers (e.g. `repo-management`)
- **[rules/](rules)** — Ecosystem policies (NO_COAUTHORS, AI_AGNOSTIC_SUBMODULES, DOCS_UP_TO_DATE, etc.) + lint rules
- **[.claude/skills/](.claude/skills)** — Project-level Claude Code skills (auto-discovered)
- **[.claude/hooks/](.claude/hooks)** — Pre/Post/Session hooks that enforce rules
- **[.claude/CLAUDE.md](.claude/CLAUDE.md)** — Claude/tooling-specific behavior (companion to root `CLAUDE.md`)
- **[.claude/agents/](.claude/agents)** — Pipeline agents (`pm-spec`, `architect-review`, `implementer-tester`, `validator`, `reviewer`)
- **[.claude/commands/](.claude/commands)** — Slash commands (`/new-usecase`, `/new-datasource`, `/new-repository`, `/new-ui-module`, `/review-pr`, `/ultimate-feature`)
- **[patches/](patches)** — npm patches applied by `patch-package` on install (e.g. `linear-mcp+1.2.0.patch`)

See [CLAUDE.md](CLAUDE.md) for architecture, conventions, and complete development guide. See [`.claude/CLAUDE.md`](.claude/CLAUDE.md) for Claude Code tool preferences, hook expectations, and subagent dispatch rules.

## Claude Code Integration

This repo includes **Claude Code features** for streamlined development:

### Statusline Context Tracker

Real-time context usage monitoring in the status bar:
- Current model name
- Context window usage % (color-coded warnings)
- Session and weekly rate limit usage (Pro/Max plans)

Helps identify when to compact conversations. No setup needed.

### Repo Management Plugin

Automates repository operations:

```bash
# Available tools in Claude Code sessions:
- sync-submodule <name>     # Update submodule to latest remote
- create-feature-branch     # Create feature branch with auto-sync
- create-release-branch     # Create release branch with auto-sync
- open-pull-request         # Create PR (auto-targets develop or main)
- check-status              # Show which submodules are stale
```

**Setup:** Plugin is pre-registered in `.mcp.json` (loaded automatically by Claude Code at session start). Bootstrap builds the TypeScript source to `plugins/repo-management/dist/index.js`. No additional config needed.

## Linear MCP Integration

Connect Linear to Claude Code for issue management in development sessions.

**Setup:** Run `/setting-up-linear-mcp` for one-time configuration. Default project: MOO (Muuvie).

### Pipeline Agents

Feature-development pipeline lives in [`.claude/agents/`](.claude/agents). Dispatched via the `Task` tool (Markdown files are auto-discovered — no registration in `settings.json`):

| Agent | Role |
|-------|------|
| `pm-spec` | Writes the feature spec / design doc |
| `architect-review` | Reviews spec for feasibility against ecosystem architecture |
| `implementer-tester` | Implements the feature (Flutter/Dart) + tests inside the `muuvie` submodule |
| `validator` | Read-only quality + correctness check across submodules; surfaces inline PR comments |
| `reviewer` | Multi-pass PR reviewer; aggregates `reviewers/security`, `reviewers/bug-finder`, `reviewers/architecture` into one batched GitHub review |

### Slash Commands

Scaffolding + review shortcuts in [`.claude/commands/`](.claude/commands):

- `/new-usecase <feature> <usecase> [params] [response]` — scaffold a domain use case
- `/new-datasource <feature> <datasource> <type>` — scaffold a data-layer data source
- `/new-repository <feature> <repository>` — scaffold a repository contract + implementation
- `/new-ui-module <module>` — scaffold a UI module under `ui/`
- `/review-pr <PR-number>` — run the `reviewer` agent against a GitHub PR

### Hooks

`.claude/settings.json` wires `PreToolUse` + `PostToolUse` + `SessionStart` hooks that enforce repo rules — they block the offending tool call before it runs:

| Event | Hook | Blocks on |
|-------|------|-----------|
| `SessionStart` | `session-start.sh` | (informational) summarizes rules / skills / MCP servers |
| `UserPromptSubmit` | `validate-config.sh` | non-portable paths (`~/`, `/Users/…`) in `.claude/settings*.json` or `.mcp.json` |
| `PreToolUse:Bash` | `block-destructive-commands.sh` | `rm -rf`, `git push --force`, `git reset --hard`, etc. |
| `PreToolUse:Bash` | `check-coauthor.sh` | `git commit` containing `Co-Authored-By` trailers |
| `PreToolUse:Bash` | `check-python-env.sh` | `pip` / `uv pip` / `poetry` / `conda install` outside an active virtualenv |
| `PreToolUse:Bash` | `check-submodule-ai.sh` | `git commit` / `git push` when a submodule contains AI-tooling files |
| `PreToolUse:Bash` | `check-docs-sync.sh` | `gh pr create` / `git push` when critical files change without a doc update |
| `PostToolUse:Edit\|Write` | `format-code.sh` | (formatter) runs `dart format` on `.dart` files |

Pipeline agents declare per-agent hooks in their frontmatter: `implementer-tester` (path allowlist, cross-feature import guard, `validate-implementation.sh`, localization and module-structure checks), `backend-implementer` (path allowlist, structure, Kotlin and Koin checks), `pm-spec` (`validate-spec.sh`) and `architect-review` (`human-gate-review.sh`). All hooks live in `.claude/hooks/`; see its README, and run `npm run test:hooks` to test them.

## Frontend (Muuvie)

**Tech:** Flutter, Dart, BLoC, Clean Architecture

```bash
cd muuvie
bundle install              # Install Ruby dependencies (Fastlane)
flutter pub get             # Install Flutter dependencies
dart run build_runner build --delete-conflicting-outputs  # Code generation
bundle exec fastlane ios dev   # Run on iOS
bundle exec fastlane android dev  # Run on Android
```

See [muuvie/README.md](muuvie/README.md) for details.

## Backend (MuuvieBackend)

**Tech:** Kotlin, Ktor, Koin, TMDB API

```bash
cd backend
export TMDB_API_KEY="your_bearer_token"
./gradlew run
```

Server runs on `http://localhost:8080`. See [backend/README.md](backend/README.md) for details.

## Ecosystem Conventions

- **Commits:** Conventional Commits format (`fix:`, `feat:`, `chore:`, `doc:`)
- **Branches:** `feature/*`, `release/*`, `fix/*`
- **PRs:** Auto-target `develop` (feature/fix) or `main` (release)
- **Template:** Standardized PR template with Task, Summary, Changes, Technical Details, Testing

### Binding Rules

Project-wide rules live in [`rules/`](rules). Each rule is enforced by a hook listed in the [Hooks](#hooks) section above.

| Rule | Summary |
|------|---------|
| [NO_COAUTHORS](rules/common/NO_COAUTHORS.md) | Single author per commit. No `Co-Authored-By` trailers in commits / PRs / issues. |
| [AI_AGNOSTIC_SUBMODULES](rules/common/AI_AGNOSTIC_SUBMODULES.md) | Child repos (`muuvie`, `backend`) must remain AI-agnostic. No `CLAUDE.md`, `.claude/`, `.cursorrules`, `copilot-instructions.md`, `AGENTS.md` inside submodules. |
| [LOCAL_CLAUDE_CONFIG](rules/common/LOCAL_CLAUDE_CONFIG.md) | All `.claude/` + `.mcp.json` config uses portable relative paths. No `~/` or absolute user paths. |
| [PYTHON_ENVS](rules/common/PYTHON_ENVS.md) | All Python `pip` / `uv` / `poetry` / `conda install` calls must run inside an active virtualenv. |
| [DOCS_UP_TO_DATE](rules/common/DOCS_UP_TO_DATE.md) | Public-surface changes must update docs in the same PR. Enforced by `check-docs-sync.sh` on `gh pr create` / `git push`. |

Lint rules (Flutter-side, applied by `implementer-tester` agent): [`accessibility`](rules/frontend/accessibility.md), [`feature-architecture`](rules/frontend/feature-architecture.md), [`feature-implementation`](rules/frontend/feature-implementation.md), [`feature-testing`](rules/frontend/feature-testing.md), [`localization`](rules/frontend/localization.md), [`ui-architecture`](rules/frontend/ui-architecture.md), [`variable-naming`](rules/common/variable-naming.md).

See [CLAUDE.md](CLAUDE.md) § Critical Rules for enforcement details and [rules/README.md](rules/README.md) for the enforcement map.

## Research Documentation

All research docs follow a standardized format:

```
---
date: YYYY-MM-DD
author: Name
status: draft|approved|archived
---

# Title

## Executive Summary
## Problem Statement
## Options Evaluated
## Recommended Approach
## Next Steps
```

See [.claude/skills/muuvie-research-format/](.claude/skills/muuvie-research-format/SKILL.md) for full specification.

## Submodule Workflows

**Update to latest:**
```bash
git submodule update --remote
```

**Develop in a submodule:**
```bash
cd muuvie  # or backend
git checkout main && git pull
cd ..
git add muuvie
git commit -m "chore: update muuvie reference"
git push
```

**Or use the plugin** (from Claude Code):
```
Create feature branch "auth-flow"
→ Auto-syncs submodules, creates feature/auth-flow, targets develop
```

## Contributing

1. Make changes in child repos (muuvie/ or backend/)
2. Commit with Conventional Commits format
3. Open PR (manually or via Claude Code plugin)
4. Use standardized PR template
5. Update submodule references if needed

For Claude Code assisted work:
- Research docs: Use muuvie-research-format skill
- Branch workflows: Use repo-management plugin
- Standardized tools already allowlisted (git, npm, flutter, bundle, fastlane, etc.)

## Permissions & Tooling

Pre-authorized (no prompts):
- **Git:** status, log, diff, branch, checkout, pull, fetch, add
- **npm:** install, run, test, ls, audit
- **Node:** node, npx
- **Mobile:** flutter, dart, bundle, fastlane, rbenv
- **Inspection:** ls, find, pwd, which

See `.claude/settings.json` for full allowlist.

## Resources

- **TMDB API:** https://developer.themoviedb.org/
- **Flutter:** https://flutter.dev/
- **Ktor:** https://ktor.io/
- **BLoC:** https://bloclibrary.dev/
- **Conventional Commits:** https://www.conventionalcommits.org/

## License

See LICENSE file in each repo.
