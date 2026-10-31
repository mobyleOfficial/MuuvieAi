# .claude/hooks/

Shell hooks invoked by Claude Code. Flat directory — one script per file, no subdirectories.

Two registration models:

## 1. Project-level hooks (auto-registered)

Wired into `.claude/settings.json` under the `hooks` block. Fire on every session, regardless of agent.

| Hook | Event | Behavior |
|------|-------|----------|
| `session-start.sh` | `SessionStart` | One-line summary of rules / skills / commands / MCP servers |
| `block-destructive-commands.sh` | `PreToolUse` Bash | Blocks `rm -rf`, `git push --force`, `git reset --hard`, etc. |
| `check-coauthor.sh` | `PreToolUse` Bash | Blocks `git commit` containing `Co-Authored-By` trailers (enforces `rules/common/NO_COAUTHORS.md`) |
| `check-python-env.sh` | `PreToolUse` Bash | Blocks `pip` / `uv pip` / `poetry` / `conda install` outside an active virtualenv (enforces `rules/common/PYTHON_ENVS.md`) |
| `check-submodule-ai.sh` | `PreToolUse` Bash | Blocks `git commit` / `git push` when the operation actually involves `muuvie/` or `backend/` AND that submodule's *tracked* files include AI-tooling paths — at any depth, including archives such as `.claude.rar` (enforces `rules/common/AI_AGNOSTIC_SUBMODULES.md`). No-op when the change set does not touch a submodule path. |
| `check-docs-sync.sh` | `PreToolUse` Bash | Blocks `gh pr create` / `git push` when critical files change vs the appropriate base branch without a corresponding doc update. Base branch is inferred from `HEAD`: `release/*`, `dev` and `develop` target `main`, everything else targets `dev` (falling back to `develop`) (enforces `rules/common/DOCS_UP_TO_DATE.md`). |
| `check-feature-map.sh` | `PreToolUse` Bash | On `gh pr create` / `git push` in the meta-repo, when the branch changes `muuvie`, `backend` or `.claude/skills/muuvie-feature-map/` against `origin/dev` (else `origin/main`), runs `feature-map-check --strict` and blocks with its problems and uncovered items. Skips pushes from inside a submodule, and skips when Node, a base ref or a submodule checkout is missing (enforces `rules/common/FEATURE_MAP.md`). Tested by `.claude/skills/muuvie-feature-map/test/hook.test.mjs`. |
| `format-code.sh` | `PostToolUse` Edit\|Write | Runs `dart format` on `.dart` files (filters by extension internally) |

Plus `.claude/validate-config.sh` (one level up, `UserPromptSubmit` matcher) which enforces `rules/common/LOCAL_CLAUDE_CONFIG.md`.

## 2. Per-agent hooks (NOT auto-registered)

These hooks are designed to run as `Stop` or `PreToolUse` hooks scoped to specific pipeline agents (e.g. `pm-spec` → `validate-spec.sh`). Claude Code's current subagent frontmatter does **not** accept a `hooks:` field, so these are not wired automatically.

### Common

| Hook | Agent | Event | Purpose |
|------|-------|-------|---------|
| `validate-spec.sh` | `pm-spec` | Stop | Verify spec is complete before stage progression |
| `validate-audit-only.sh` | `reviewer`, `validator`, `architect-review` | Stop | Verify the agent honored `mode: "audit-only"` and suppressed GitHub writes |
| `pipeline-coordinator.sh` | every pipeline agent | Stop | Advance pipeline queue, hand off to next agent |
| `human-gate-review.sh` | `architect-review` | Stop | Human approval gate after architect review |
| `enforce-path-restrictions.sh` | `implementer-tester`, `backend-implementer` | PreToolUse Edit\|Write | Reject writes outside the agent's allowed paths |

### Frontend (Flutter/Dart) — `implementer-tester`

| Hook | Event | Purpose |
|------|-------|---------|
| `validate-implementation.sh` | Stop | `flutter analyze` + `flutter test`, block on errors |
| `validate-localization.sh` | Stop | Enforce ARB key parity across `app_en.arb` / `app_es.arb` / `app_pt.arb` |
| `validate-module-structure.sh` | Stop | Verify required feature/UI module file layout |
| `verify-di-registration.sh` | Stop | Confirm `@module` files are wired into `injection.config.dart` |
| `regenerate-generated-files.sh` | Stop | Run `build_runner` / `flutter gen-l10n` when source changes warrant |
| `block-cross-feature-data-imports.sh` | PreToolUse Edit\|Write | Reject imports of another feature's `data/` layer (per `rules/frontend/feature-architecture.md`) |

### Backend (Kotlin/Ktor) — `backend-implementer`

| Hook | Event | Purpose |
|------|-------|---------|
| `validate-backend-structure.sh` | Stop | Files in correct `domain/` / `data/` / `routing/` directories; package names match directory structure |
| `validate-kotlin-code.sh` | Stop | No `Thread.sleep()` in suspend functions; `runBlocking` only in use cases; no `Future`/`CompletableFuture` |
| `verify-koin-di-registration.sh` | Stop | All use cases / datasources / repositories registered in `dataModule` / `appModule` |

**Until Claude Code supports per-agent hook registration**, each agent's documentation (`agents/<name>.md`) describes which hooks should run and the agent is expected to invoke them manually via `Bash` before returning. The pipeline queue tracks stage state via `pipeline-coordinator.sh`, which agents are instructed to invoke on completion.

## Pipeline State

Runtime state lives in `.claude/task/pipeline-queue.json` (gitignored). The empty starting state lives in `.claude/task/pipeline-queue.template.json` (committed). `bootstrap.sh` seeds the queue from the template on fresh clones.

---

## Writing New Hooks

### Hook Template

```bash
#!/bin/bash
# .claude/hooks/<name>.sh
# <Description>
# Registered in .claude/settings.json, or invoked manually by <agent>

set -e

input=$(cat)

# Extract from JSON input
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
command=$(echo "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)

if [ -z "$file_path" ]; then
  exit 0  # No-op if no relevant input
fi

errors=""

# Validation logic here

if [ -n "$errors" ]; then
  echo -e "❌ Error Title:$errors" >&2
  exit 1
fi

exit 0
```

### Hook Guidelines

- ✅ **Silent on success** — Exit 0, no output unless warning
- ✅ **Clear error messages** — Describe what's wrong and how to fix
- ✅ **Defensive checks** — Exit early if context doesn't apply
- ✅ **Idempotent** — Safe to run multiple times
- ✅ **cwd-independent** — Resolve the repo root via `git rev-parse --show-toplevel`; never assume the session's working directory
- ❌ **Don't block on warnings** — Exit 0, output to stderr
- ❌ **Don't make assumptions** — Check directory structure, file existence

### Registering a new project-level hook

Add it to the relevant event array in `.claude/settings.json`, using a repo-relative path:

```json
{ "type": "command", "command": "./.claude/hooks/<name>.sh" }
```

Paths must stay relative — `.claude/validate-config.sh` blocks absolute or `~/` paths on every prompt (`rules/common/LOCAL_CLAUDE_CONFIG.md`). Then `chmod +x` the script, or Claude Code reports it as missing.

---

## Running Hooks Locally

```bash
# Test a hook with sample input
echo '{"tool": "Edit", "tool_input": {"file_path": "path/to/file.dart"}}' | \
  ./.claude/hooks/format-code.sh
```

Hooks are not run by CI — they fire inside Claude Code sessions only.

---

## Common Hook Patterns

### Check File Exists
```bash
if [ ! -f "$file_path" ]; then
  exit 0  # File doesn't exist, nothing to check
fi
```

### Extract Variable from Input
```bash
variable=$(echo "$input" | jq -r '.path.to.value // empty' 2>/dev/null)
if [ -z "$variable" ]; then
  exit 0  # No value provided
fi
```

### Search for Pattern in File
```bash
if grep -q "forbidden_pattern" "$file_path"; then
  errors="$errors\nError: forbidden_pattern found"
fi
```

### Report Multiple Errors
```bash
if [ -n "$errors" ]; then
  echo -e "❌ Title:$errors" >&2
  exit 1
fi
```
