# Rules

Binding policies for work in this repo. Each rule is a single Markdown file. Rules override default Claude behavior and the `.claude/CLAUDE.md` defaults; they yield only to explicit user instructions.

## Project-wide Rules (hook-enforced)

These rules fire automatically on every applicable action.

| Rule | Hook | Trigger |
|------|------|---------|
| [LOCAL_CLAUDE_CONFIG](common/LOCAL_CLAUDE_CONFIG.md) | `.claude/validate-config.sh` | `UserPromptSubmit` — scans `.claude/settings*.json` + `.mcp.json` for non-portable paths |
| [NO_COAUTHORS](common/NO_COAUTHORS.md) | `.claude/hooks/check-coauthor.sh` | `PreToolUse` Bash — blocks `git commit` with `Co-Authored-By` trailers |
| [PYTHON_ENVS](common/PYTHON_ENVS.md) | `.claude/hooks/check-python-env.sh` | `PreToolUse` Bash — blocks `pip` / `uv` / `poetry` / `conda install` outside an active venv |
| [AI_AGNOSTIC_SUBMODULES](common/AI_AGNOSTIC_SUBMODULES.md) | `.claude/hooks/check-submodule-ai.sh` | `PreToolUse` Bash — blocks `git commit` / `git push` when submodule contains `.claude/`, `CLAUDE.md`, `.cursorrules`, copilot instructions, or `AGENTS.md` |
| [DOCS_UP_TO_DATE](common/DOCS_UP_TO_DATE.md) | `.claude/hooks/check-docs-sync.sh` | `PreToolUse` Bash — blocks `gh pr create` / `git push` when critical files change without a doc update |
| [FEATURE_MAP](common/FEATURE_MAP.md) | `.claude/hooks/check-feature-map.sh` | `PreToolUse` Bash — blocks `gh pr create` / `git push` when a branch moving a submodule ref or editing the feature map leaves `feature-map-check --strict` failing |

## Flutter / Submodule-scoped Rules (per-agent enforcement)

These rules apply when working inside the `muuvie/` submodule. They are enforced by hooks in the `implementer-tester` agent's frontmatter (`.claude/agents/implementer-tester.md`): `PreToolUse` hooks stop writes outside its allowed paths and cross-feature `data/` imports, and `Stop` hooks run `flutter analyze` + `flutter test` + structural validators on what the agent changed. They run only while that agent is active.

| Rule | Enforcement |
|------|-------------|
| [feature-architecture](frontend/feature-architecture.md) | `block-cross-feature-data-imports.sh` + `validate-module-structure.sh` |
| [feature-implementation](frontend/feature-implementation.md) | `validate-implementation.sh` (`flutter analyze` + tests) |
| [feature-testing](frontend/feature-testing.md) | `validate-implementation.sh` (`flutter test`) |
| [ui-architecture](frontend/ui-architecture.md) | `validate-module-structure.sh` |
| [localization](frontend/localization.md) | `validate-localization.sh` (ARB key parity) |
| [accessibility](frontend/accessibility.md) | `flutter analyze` lints + manual review (no shell hook — WCAG / contrast / 48dp checks are not shell-enforceable) |
| [variable-naming](common/variable-naming.md) | `flutter analyze` lints + manual review |

## Backend / Submodule-scoped Rules (per-agent enforcement)

These rules apply when working inside the `backend/` submodule. They are enforced by hooks in the `backend-implementer` agent's frontmatter — a path allowlist on writes, and `Stop` checks on the changed `.kt` files (`validate-backend-structure.sh`, `validate-kotlin-code.sh`, `verify-koin-di-registration.sh`) — and by the `reviewers/architecture` sub-reviewer.

(Scope column added for backend rules to disambiguate submodule vs. subdirectory enforcement.)

| Rule | Scope | Enforcement |
|------|-------|-------------|
| [backend-architecture](backend/backend-architecture.md) | `backend/` submodule | `validate-backend-structure.sh` + `verify-koin-di-registration.sh` (backend-implementer Stop) + reviewer architecture sub-reviewer |
| [backend-testing](backend/backend-testing.md) | `backend/src/test/` | `backend-implementer` agent (test scaffolding) |

See [`.claude/hooks/README.md`](../.claude/hooks/README.md) for the full registration model.

## How to Add a Rule

1. Create `rules/<RULE_NAME>.md` with sections: `RULE`, `Why`, `What's Forbidden / Required`, `Enforcement`, `Exceptions`, `Common Mistakes`.
2. If hook-enforceable: write `.claude/hooks/<check-name>.sh` (must read JSON tool input from stdin, exit `2` to block).
3. Register the hook in `.claude/settings.json` under the appropriate event matcher.
4. Update this README's table.
5. Mention the rule under "Critical Rules" in root [`CLAUDE.md`](../CLAUDE.md).
6. Per [`DOCS_UP_TO_DATE`](common/DOCS_UP_TO_DATE.md): keep all of the above in the same PR.

## Per-Tool Lint Configurations

Per-language linting (`flutter analyze`, `dart format`, `eslint`, `ktlint`, etc.) lives inside the submodule that owns the language stack — not here. This directory is for meta-repo ecosystem policy only.
