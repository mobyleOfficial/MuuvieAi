---
name: verify-docs-before-pr
description: Use before opening a PR or pushing in the meta-repo, to check that README.md / CLAUDE.md / other docs were updated alongside changes to .claude/, plugins/, agents/, rules/, submodule refs or dependencies. A manual pre-flight for the check-docs-sync.sh hook.
---

Check whether documentation is in sync with the branch's changes before opening a pull request.

The `.claude/hooks/check-docs-sync.sh` hook already runs this check on `gh pr create` / `git push` and blocks on failure, so this skill is a pre-flight: run it to find out before the hook stops you.

## Usage

```
/verify-docs-before-pr
```

Runs `.claude/verify-docs.sh` from the repo root.

## What it checks

The branch's changes against its base (`git diff <base>...HEAD`), where the base is:

| Current branch | Base |
|---|---|
| `release/*`, `dev`, `develop`, `main` | `main` |
| anything else (`feature/*`, `fix/*`, …) | `dev`, falling back to `develop` (local first, then `origin/`) |

If any of these changed:

- `.claude/` config, skills, hooks, commands
- `plugins/`, `agents/`, `rules/`
- the `muuvie` or `backend` submodule refs
- dependencies or setup (`package.json`, gradle, `pubspec.yaml`, `Gemfile`, `.env`, docker)

…then at least one doc must have changed too: a `README.md` or `CLAUDE.md` (any level), or a Markdown file under `agents/`, `rules/`, `.claude/` or `research/`.

## Output

- **Pass:** exit 0, usually silent (or "No changes detected" / "no base ref … skipping").
- **Fail:** exit 1, printing `⚠️  Documentation out of sync` and the critical files that changed. Update the docs that describe those files, then re-run.

## What it does not check

- Whether the docs you changed are the *right* ones, or accurate. It only checks that some doc moved with the code.
- The feature map. A branch that moves a submodule ref or edits `.claude/skills/muuvie-feature-map/` is checked separately by `.claude/hooks/check-feature-map.sh` (run `.claude/skills/muuvie-feature-map/bin/feature-map-check --strict` to pre-flight it).
