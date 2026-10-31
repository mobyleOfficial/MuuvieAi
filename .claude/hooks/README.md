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

## 2. Per-agent hooks (agent frontmatter)

Declared in the `hooks:` block of an agent's frontmatter in `.claude/agents/<name>.md`, so they run only while that agent is active. A `Stop` hook there runs as `SubagentStop`. Commands use `"$CLAUDE_PROJECT_DIR"/.claude/hooks/…` because agents `cd` into the submodules. Claude Code skips frontmatter hooks until the folder is trusted.

Claude Code runs the hooks of one event **in parallel**. So chained steps (regenerate → DI check → analyze → test) live inside one script, `validate-implementation.sh`, rather than as separate entries. Every `Stop` hook exits 0 when `stop_hook_active` is set, so an agent can't loop forever on a check it can't satisfy.

| Agent | Event | Hook | Purpose |
|-------|-------|------|---------|
| `implementer-tester` | PreToolUse `Edit\|Write\|MultiEdit\|NotebookEdit` | `enforce-path-restrictions.sh implementer-tester` | Only `muuvie/{features,ui,lib,test}/**` and the app's config files. Never secrets, `.env*`, build output or generated files |
| `implementer-tester` | PreToolUse `Edit\|Write\|MultiEdit\|NotebookEdit` | `block-cross-feature-data-imports.sh` | No import/export of another feature's `data/` (or its barrel, which re-exports it); use `<feature>_domain` |
| `implementer-tester` | Stop | `validate-implementation.sh` | For a muuvie change: `regenerate-generated-files.sh` → `verify-di-registration.sh` → `flutter analyze` (fails on errors) → `flutter test` for the touched packages |
| `implementer-tester` | Stop | `validate-localization.sh` | ARB key parity across `app_en` / `app_es` / `app_pt` |
| `implementer-tester` | Stop | `validate-module-structure.sh` | Touched feature/UI modules have their pubspec, barrel and (new pages) the four UI files |
| `backend-implementer` | PreToolUse `Edit\|Write\|MultiEdit\|NotebookEdit` | `enforce-path-restrictions.sh backend-implementer` | Only `backend/src/{main,test}/kotlin/**` and `backend/build.gradle.kts` |
| `backend-implementer` | Stop | `validate-backend-structure.sh` | Changed `.kt` files: layer directories, package = directory, domain imports no data/routing/di/Ktor/Exposed |
| `backend-implementer` | Stop | `validate-kotlin-code.sh` | No `Thread.sleep` / `runBlocking` in suspend functions or routing, no `Future`, no Koin outside `data/di` |
| `backend-implementer` | Stop | `verify-koin-di-registration.sh` | New use cases, data sources, repositories and `injection<T>()` calls resolve to a Koin binding |
| `pm-spec` | Stop | `validate-spec.sh` | The in-progress queue spec has every required section (no queue → no-op) |
| `architect-review` | Stop | `human-gate-review.sh` | Blocks a rejected design, prints the human gate on approval (no queue → no-op) |

The frontend and backend checks look only at what the change touched: uncommitted files, plus commits ahead of `origin/dev` in that submodule. On a clean tree they cost nothing.

### Not wired, run by hand

| Script | Why | How |
|--------|-----|-----|
| `regenerate-generated-files.sh`, `verify-di-registration.sh` | Steps inside `validate-implementation.sh` (parallel Stop hooks would race) | Run through `validate-implementation.sh` |
| `pipeline-coordinator.sh <agent>` | Advances the manual queue. As a parallel Stop hook it could advance a stage that a gate in the same event is blocking | `echo '{}' \| .claude/hooks/pipeline-coordinator.sh <agent>` after a stage is accepted |
| `validate-audit-only.sh <agent>…` | A CLI check, not a hook: confirms the agents honour `mode: "audit-only"` | Run by `ultimate-developer` in spec/plan phases |

`lib-hook.sh` is not a hook. It holds the shared helpers the hooks source: `executable_text` (drops heredoc bodies and quoted text), `command_segments`, `runs_git`, `targets_other_repo`, `meta_root` and `stop_hook_active`.

## Pipeline State

Runtime state lives in `.claude/task/pipeline-queue.json` (gitignored). The empty starting state lives in `.claude/task/pipeline-queue.template.json` (committed). `bootstrap.sh` seeds the queue from the template on fresh clones.

---

## Writing New Hooks

### Hook Template

```bash
#!/bin/bash
# .claude/hooks/<name>.sh
# <What it blocks and which rule it enforces.>
# Registered in .claude/settings.json (or <agent>'s frontmatter).
# Tests: .claude/tests/<name>.test.mjs.

. "$(dirname "$0")/lib-hook.sh"
hook_read_input                      # sets HOOK_INPUT, HOOK_COMMAND, HOOK_CWD
[ -z "$HOOK_COMMAND" ] && exit 0

# Judge what runs, not what is mentioned: no heredoc bodies, no quoted text.
text=$(executable_text "$HOOK_COMMAND")
runs_git "$text" push || exit 0

root=$(meta_root "$HOOK_CWD") || exit 0   # the session's repo, not the hook's cwd

if <violation>; then
  echo "❌ <RULE> violation: <what is wrong>." >&2
  echo "   <what to do instead>. See rules/common/<RULE>.md." >&2
  exit 2                             # 2 blocks; any other non-zero does not
fi
exit 0
```

For a `Stop` hook, add `stop_hook_active && exit 0` right after `hook_read_input`.

### Hook Guidelines

- ✅ **bash 3.2** — `#!/bin/bash` is 3.2 on macOS: no `declare -A`, no `shopt -s globstar`, no `${var,,}`. The tests run every hook under `/bin/bash`.
- ✅ **Judge what runs** — use `executable_text` / `command_segments`, never grep the raw command: a commit message or a heredoc that mentions `git push --force` is not a force push.
- ✅ **Resolve paths from `HOOK_CWD`** (or the file path) with `meta_root`, never from the hook process's cwd. Skip commands aimed at another repo (`targets_other_repo`).
- ✅ **Exit 2 to block**, with a message that says what to do instead. Exit 0 when the context doesn't apply, including environment problems (no `node`, no checkout): a hook must not block unrelated work.
- ✅ **Silent on success**, idempotent, and only as slow as it has to be: check what changed, not the whole tree.
- ✅ **Test it** — add cases to `.claude/tests/` for what it must block and, just as important, what it must let through.
- ❌ **No `set -e`** — a failing `grep` or `git` then exits 1, which neither blocks nor passes cleanly.

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

Run the whole suite with `npm run test:hooks` (hooks under `/bin/bash` 3.2, fed crafted hook JSON). Hooks are not run by CI — they fire inside Claude Code sessions only.

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
  printf "❌ Title:%b\n" "$errors" >&2
  exit 2
fi
```
