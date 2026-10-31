# Documentation Up To Date Rule

**RULE:** Every change that affects user-facing behavior, public interfaces, configuration, or directory structure MUST be accompanied by a documentation update in the same PR.

## Why

- A clone, hire, or future contributor reads docs first. Stale docs are worse than no docs.
- Past sessions repeatedly drifted: README listed paths that didn't exist, CLAUDE.md referenced commands that were renamed, agent files described skills that had been deleted.
- The cost of updating docs alongside the code is small. The cost of debugging from outdated docs compounds.

## What Counts as "Affecting Docs"

A change touches docs if it modifies any of:

- `.claude/` config, skills, hooks, or agents
- `plugins/`
- `.claude/agents/`
- `rules/`
- Public APIs in `muuvie/` or `backend/` (request/response shape, exported types, public functions)
- Build / setup commands (any `package.json`, `gradle`, `pubspec.yaml`, `Gemfile`, `.env`, docker)
- Directory structure (add / move / delete top-level dirs or feature modules)

If a change matches, the same PR MUST update at least one of: `README.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, the relevant subdirectory `README.md`, or a referenced doc.

## Enforcement

- **Manual:** run `/verify-docs-before-pr` before opening a PR.
- **Automatic:** `.claude/hooks/check-docs-sync.sh` runs as `PreToolUse` on Bash. It intercepts `gh pr create` and `git push` invocations, runs `verify-docs.sh`, and blocks the operation if critical files changed without corresponding doc updates.

## Exceptions

- Pure refactors that change neither behavior, interface, nor structure (rename internal variable, extract private function) — no doc update needed.
- Bug fixes that restore documented behavior — original doc is already correct.
- Test-only changes that touch no production paths.

Document the exception in the PR body so a reviewer can confirm.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| "I'll update docs after the PR merges" | No. Same PR. Doc update is part of the change, not a follow-up. |
| Updating only `CLAUDE.md` when a subdir `README.md` is also affected | Update every doc that describes the changed surface. |
| Hidden coupling: doc references a path you just deleted | Run `/verify-docs-before-pr` — it greps the change set for critical paths. |
| Treating `.claude/CLAUDE.md` and root `CLAUDE.md` as interchangeable | They are scoped differently. See `.claude/CLAUDE.md` for behavioral scope, root `CLAUDE.md` for project scope. |

---

See also: [LOCAL_CLAUDE_CONFIG.md](LOCAL_CLAUDE_CONFIG.md), [AI_AGNOSTIC_SUBMODULES.md](AI_AGNOSTIC_SUBMODULES.md), [NO_COAUTHORS.md](NO_COAUTHORS.md), [PYTHON_ENVS.md](PYTHON_ENVS.md)
