---
date: 2026-05-15
author: Claude Opus 4.7
status: approved
related:
  - 2026-05-14-api-versioning
tags: [claude-code, mcp, plugins, skills, config, devtools, security]
decisions:
  - Adopt Option 2 (all 5 phases; Phase 6 added post-merge for pipeline cleanup)
  - Phase 2 skill layout: Layout A (.claude/skills/)
  - Linear token rotation deferred (risk accepted by maintainer 2026-05-15)
  - Commands kept, skills/new-* dropped (resolved 2026-05-15)
  - Hooks + task/ moved to .claude/hooks/ and .claude/task/ (resolved 2026-05-15)
  - .claude/CLAUDE.md kept and rewritten as Claude/tooling-specific behavior (resolved 2026-05-15)
  - muuvie-research-format skill updated to allow research subdirs (resolved 2026-05-15)
  - Linear MCP fix folded into Phase 1, not this PR (resolved 2026-05-15)
---

# Claude Code Configuration Audit & Reset Plan

## Executive Summary

This audit reviews the `.claude/`, `skills/`, `plugins/`, `rules/`, and `agents/` configuration of the MuuvieAi meta-repo against three failure reports from the maintainer: (1) skills are not loading, (2) rules are being ignored, (3) plugin status is unverified. Root cause is a layered configuration mismatch: skills are placed in a non-standard directory shape, MCP servers are declared in two competing files with divergent relative paths, rules exist only as Markdown with one of four enforced by a hook, and no bootstrap script exists to make the repo reproducible after a fresh clone. **Recommendation:** Consolidate to a single MCP config at repo root, restructure `skills/` to match Claude Code's expected plugin-marketplace layout, expand hook coverage so each rule has an enforcement mechanism, and ship a `bootstrap.sh` that installs all dependencies (root `npm install`, plugin build, submodule init, hook permissions, settings.local.json template) in one command.

## Problem Statement

The MuuvieAi meta-repo aims to be a portable "AI-assisted development hub" that any contributor can clone and use immediately. Today, after a fresh clone, the following fail or are unverifiable without manual debugging:

1. **Skills do not surface** in Claude Code's skill picker despite `extraKnownMarketplaces.local-skills` declaration in `.claude/settings.json` [Source: .claude/settings.json, lines 50-57].
2. **Three of four rule files are unenforced** — only `LOCAL_CLAUDE_CONFIG.md` is verified by `validate-config.sh`; `AI_AGNOSTIC_SUBMODULES`, `NO_COAUTHORS`, and `PYTHON_ENVS` rely on Claude reading CLAUDE.md and choosing to comply [Source: .claude/validate-config.sh, lines 11-22].
3. **MCP server config is duplicated** across `.claude/settings.json` and `.claude/.mcp.json` with conflicting relative paths (`../plugins/...` vs `./plugins/...`) [Source: .claude/settings.json line 5; .claude/.mcp.json line 5].
4. **No setup script** exists; a fresh clone produces a non-functional environment (root `package.json` missing from git, plugin needs `npm install` + build, no hook permission setup) [Source: git status output, "?? package.json"].
5. **Linear API token committed in plain text** in `.claude/settings.local.json` line 3 — file gitignored, but token now lives in conversation history of any session that reads it [Source: .claude/settings.local.json, line 3].

Scope: All Claude Code integration files in the repo root and `.claude/`. Out of scope: child submodule contents (per `AI_AGNOSTIC_SUBMODULES` rule).

Why now: The maintainer is unable to validate that ecosystem rules ship correctly to new clones, blocking onboarding of other contributors.

## Current State Inventory

### `.claude/` directory contents
| File | Purpose | Status |
|------|---------|--------|
| `settings.json` | Project-level Claude Code config | Committed, modified |
| `settings.local.json` | Personal overrides + secrets | Gitignored, contains Linear token |
| `.mcp.json` | MCP server registration (non-standard location) | Committed |
| `statusline.sh` | Context % statusline | Executable, working |
| `validate-config.sh` | UserPromptSubmit hook — portable path check | Executable, enforces 1 rule |
| `verify-docs.sh` | Manual pre-PR doc check | Executable, invoked via skill |

[Source: `ls -la .claude/`]

### Skills declared
| Path | Format | Loaded? |
|------|--------|---------|
| `skills/verify-docs-before-pr.md` | Flat `.md` with frontmatter | No — wrong location for flat-file skills |
| `skills/setting-up-linear-mcp/SKILL.md` | Subdir with SKILL.md | No — marketplace structure missing |
| `skills/muuvie-research-format/SKILL.md` | Subdir with SKILL.md | No — marketplace structure missing |

[Source: `ls -la skills/`]

### Plugins declared
| Plugin | Path | Built? | Registered |
|--------|------|--------|-----------|
| `repo-management` | `plugins/repo-management/dist/index.js` | Yes (committed) | Twice — settings.json AND .mcp.json |

[Source: `ls plugins/repo-management/dist/`; `.claude/settings.json` lines 3-6; `.claude/.mcp.json` lines 3-6]

### Rules declared vs enforced
| Rule | File | Enforcement |
|------|------|-------------|
| `LOCAL_CLAUDE_CONFIG` | `rules/LOCAL_CLAUDE_CONFIG.md` | `validate-config.sh` via UserPromptSubmit hook |
| `AI_AGNOSTIC_SUBMODULES` | `rules/AI_AGNOSTIC_SUBMODULES.md` | None — relies on CLAUDE.md guidance |
| `NO_COAUTHORS` | `rules/NO_COAUTHORS.md` | None — relies on CLAUDE.md guidance |
| `PYTHON_ENVS` | `rules/PYTHON_ENVS.md` | None — relies on CLAUDE.md guidance |

[Source: `.claude/settings.json` lines 62-71; manual scan of `rules/` directory]

### Hooks declared
| Hook | Event | Command |
|------|-------|---------|
| `validate-config.sh` | `UserPromptSubmit` | Portable-path check on settings files |

[Source: `.claude/settings.json` lines 62-71]

## Issues Identified

### Issue 1 — Skills not surfacing in skill picker
**Symptom:** `Skill("muuvie-research-format")` or `/verify-docs-before-pr` does not resolve to available skills.

**Root cause:** `extraKnownMarketplaces.local-skills` in `.claude/settings.json` points to `./skills`, which is a Claude Code **plugin marketplace** discovery mechanism, not a project-level skill loader. A plugin marketplace requires a `marketplace.json` at the root of the declared path that enumerates plugins, each of which then ships its own `skills/` subdirectory. The current `skills/` directory has no `marketplace.json` and is not structured as a plugin marketplace [Source: claude-code-plugin-marketplace conventions; absence of `skills/marketplace.json`].

**Impact:** All three custom skills (`verify-docs-before-pr`, `setting-up-linear-mcp`, `muuvie-research-format`) are invisible to Claude Code, even though CLAUDE.md instructs Claude to invoke them.

### Issue 2 — Duplicate, conflicting MCP server registration
**Symptom:** Unclear which `repo-management` config Claude Code uses; `linear` MCP server is only in one of two files.

**Root cause:**
- `.claude/settings.json` declares `mcpServers.repo-management` with args `../plugins/repo-management/dist/index.js` (relative to `.claude/`, not repo root) [Source: .claude/settings.json line 5].
- `.claude/.mcp.json` declares `mcpServers.repo-management` with args `./plugins/repo-management/dist/index.js` (relative to repo root) [Source: .claude/.mcp.json line 5].
- Claude Code's documented MCP discovery is `.mcp.json` at **repo root**, not under `.claude/`.
- `linear` MCP exists only in `.claude/settings.json`, missing from `.claude/.mcp.json`.

**Impact:** Two competing configs. Path resolution is ambiguous. `repo-management` may launch from the wrong working directory. Linear MCP may not auto-load.

### Issue 3 — Rules without enforcement mechanism
**Symptom:** Rules referenced in CLAUDE.md are routinely ignored across sessions.

**Root cause:** Three of four rule files have no hook enforcement:
- `NO_COAUTHORS` — no pre-commit/commit-msg hook to strip `Co-Authored-By` trailers
- `AI_AGNOSTIC_SUBMODULES` — no hook checks submodules for `.claude/` or `CLAUDE.md` files
- `PYTHON_ENVS` — no hook intercepts global `pip install` commands

Claude reads CLAUDE.md and the rule files as context, but compliance depends entirely on the model remembering and following them — a soft enforcement that drifts across long sessions or context compaction.

**Impact:** Rules ship as documentation, not as gates. Violations slip through unless Claude proactively re-checks.

### Issue 4 — No reproducibility bootstrap
**Symptom:** A fresh `git clone --recurse-submodules` does not produce a working Claude Code environment.

**Root cause:** Missing setup automation. Required manual steps after clone:
1. `npm install` at repo root (linear-mcp dep)
2. `cd plugins/repo-management && npm install && npm run build`
3. `chmod +x .claude/*.sh` (if extraction stripped exec bits)
4. Generate or paste Linear token into `.claude/settings.local.json`
5. Verify submodules initialized (`git submodule status`)

Root `package.json` is **untracked** (`?? package.json` per `git status`) — a fresh clone will not even have the `linear-mcp` dependency declaration [Source: `git status -s`].

**Impact:** Onboarding requires tribal knowledge. The repo's stated goal ("portable AI dev hub") fails on first contact.

### Issue 5 — Secret leakage path
**Symptom:** Linear API token in `.claude/settings.local.json` is plain text.

**Root cause:** File is gitignored [Source: `.gitignore` line 44, "Local overrides"], so the token never reaches the remote. However, any conversation that reads this file ingests the token into chat history, transcripts, or telemetry. Current session has already done so.

**Impact:** Token exposure to external systems (LLM provider logs, screenshare, copy-paste). Token must be rotated.

### Issue 6 — Hook coverage gap
**Symptom:** Only `UserPromptSubmit` is hooked; no `SessionStart`, no `PreToolUse` for git commits, no `PostToolUse` for file edits.

**Root cause:** `.claude/settings.json` declares one hook entry [Source: .claude/settings.json lines 62-71]. CLAUDE.md says "Load Rules, Plugins, and Skills (Every Session)" — but no `SessionStart` hook emits the rule list or reminders. No `PreToolUse` matcher catches `git commit` to strip coauthors. No `PostToolUse` catches `pip install` outside a venv.

**Impact:** "Every session" guidance in CLAUDE.md is aspirational, not enforced.

### Issue 7 — Stale documentation in subdirectory READMEs
**Symptom:** `skills/README.md` and `agents/README.md` list example files that don't exist.

**Root cause:** READMEs were templated before implementation. Reference `feature-scaffold.md`, `ci-deployment.md`, `frontend-specialist.md`, etc. that were never created [Source: `skills/README.md`, `agents/README.md`].

**Impact:** Misleading for new contributors. Suggests features that are absent.

## Options Evaluated

### Option 1: Minimal patch — fix paths only
**Description:** Keep current structure. Fix MCP path bug, deduplicate config, leave skills/rules untouched.

**Pros:**
- Smallest diff
- Lowest risk of breakage [Analysis: only file path changes]

**Cons:**
- Skills still won't load (root cause unaddressed)
- Rules still unenforced
- No reproducibility for clones [Source: this audit, Issue 4]

**Verdict:** Rejected — does not solve stated problem (skills not loading, rules ignored).

### Option 2: Full restructure with bootstrap script (recommended)
**Description:** Restructure `skills/` as a proper plugin marketplace (or move to `.claude/skills/` flat layout), consolidate MCP config to single repo-root `.mcp.json`, add per-rule enforcement hooks, ship `bootstrap.sh` for clones.

**Pros:**
- Solves all five issues identified [Source: this audit]
- Makes repo's stated goal (portable AI hub) actually work
- Setup script enables team scaling — documented in README

**Cons:**
- Larger diff (~6–8 files touched, 1 new script)
- Risk of breaking maintainer's current session if hooks misfire [Analysis: mitigated by staged rollout]

**Verdict:** **Recommended.** Aligns with stated repo purpose.

### Option 3: Use upstream `superpowers` plugin marketplace instead
**Description:** Delete custom `skills/` directory. Adopt the public `superpowers` skill pack and let maintainer install via standard marketplace command. Keep only the truly Muuvie-specific rules locally.

**Pros:**
- Zero maintenance burden for skill plumbing
- Skills already battle-tested by Anthropic [Source: superpowers skill catalog visible in this session]

**Cons:**
- Loses ecosystem-specific skills (`muuvie-research-format`, `setting-up-linear-mcp` are Muuvie-specific) [Source: skill purpose statements]
- Doesn't solve MCP duplication or hook gaps

**Verdict:** Rejected as primary path. Useful complement — superpowers can live alongside custom Muuvie skills.

## Recommended Approach

**Adopt Option 2 with a five-phase implementation.** Phases are ordered so each is verifiable in isolation; later phases assume earlier phases land cleanly.

### Phase 1 — MCP consolidation (low risk)
1. Move `.claude/.mcp.json` to repo root as `.mcp.json`.
2. Add `linear` server entry to root `.mcp.json`.
3. Remove `mcpServers` block from `.claude/settings.json`.
4. Verify paths: all relative to repo root (`./plugins/...`).
5. Reload Claude Code and confirm both servers respond.

### Phase 2 — Skill restructure
Pick one of two layouts:

**Layout A — Project-level skills (simplest):**
- Move `skills/<name>/SKILL.md` and `skills/<name>.md` into `.claude/skills/<name>/SKILL.md` (single SKILL.md per skill with frontmatter).
- Delete `extraKnownMarketplaces.local-skills` from settings.
- Claude Code auto-loads `.claude/skills/*/SKILL.md` per project [Source: Claude Code skill discovery convention].

**Layout B — Plugin marketplace (more work, supports versioning):**
- Add `skills/marketplace.json` declaring each skill as a plugin.
- Each subdirectory needs `plugin.json` manifest.
- Keep `extraKnownMarketplaces.local-skills` declaration.

**Recommendation: Layout A** — simpler, fewer files, no marketplace overhead. Versioning is a non-need for in-repo skills.

### Phase 3 — Rule enforcement hooks
Add hooks to `.claude/settings.json`:

```json
"hooks": {
  "UserPromptSubmit": [
    { "matcher": ".*", "hooks": [{ "type": "command", "command": "./.claude/validate-config.sh" }] }
  ],
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [{ "type": "command", "command": "./.claude/check-coauthor.sh" }]
    },
    {
      "matcher": "Bash",
      "hooks": [{ "type": "command", "command": "./.claude/check-python-env.sh" }]
    }
  ],
  "SessionStart": [
    { "matcher": ".*", "hooks": [{ "type": "command", "command": "./.claude/session-start.sh" }] }
  ]
}
```

New scripts needed:
- `check-coauthor.sh` — Scan `git commit -m` invocations for `Co-Authored-By`; block if present.
- `check-python-env.sh` — Scan `pip install` invocations; block if `VIRTUAL_ENV` is unset.
- `session-start.sh` — Emit one-line summary: rule list + skill list + MCP status, so each session opens with explicit context.

### Phase 4 — Bootstrap script
Create `bootstrap.sh` at repo root:

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Initialize submodules
git submodule update --init --recursive

# 2. Root deps (linear-mcp)
npm install

# 3. Plugin deps + build
( cd plugins/repo-management && npm install && npm run build )

# 4. Make hooks executable
chmod +x .claude/*.sh

# 5. Template settings.local.json if missing
if [ ! -f .claude/settings.local.json ]; then
  cp .claude/settings.local.template.json .claude/settings.local.json
  echo "Edit .claude/settings.local.json to add your Linear token."
fi

echo "Bootstrap complete. Open Claude Code in this directory."
```

Companion file `.claude/settings.local.template.json`:
```json
{
  "env": { "LINEAR_ACCESS_TOKEN": "" }
}
```

Commit `package.json` to the repo (currently untracked).

**Sub-step — unignore `package-lock.json`:** `.gitignore` line 3 currently lists `package-lock.json` under `# Dependencies`. Remove that line. Rationale: locked dependency versions are required for the bootstrap script's reproducibility goal stated in Issue 4 — without a tracked lockfile, `npm install` on a fresh clone resolves whatever satisfies the semver ranges in `package.json` at install time, breaking determinism. After removal, commit `package-lock.json` alongside `package.json`.

### Phase 5 — Doc cleanup
- Update `skills/README.md` to list only real skills.
- Update `agents/README.md` to either list real agents or mark as placeholder.
- Update root `README.md` to instruct: `./bootstrap.sh` as first step after clone.
- Update `CLAUDE.md` to reflect new skill location and bootstrap step.

## Implementation Plan

| Phase | Files Touched | Verifiable via |
|-------|---------------|----------------|
| 1 — MCP consolidation | `.claude/settings.json`, `.claude/.mcp.json` → `.mcp.json` | Claude Code MCP server status |
| 2 — Skill restructure | `skills/**` → `.claude/skills/**`, `.claude/settings.json` | `/skill` picker lists 3 skills |
| 3 — Rule hooks | 3 new `.claude/*.sh`, `.claude/settings.json` | Hook fires on `git commit` with coauthor → blocks |
| 4 — Bootstrap script | new `bootstrap.sh`, new `.claude/settings.local.template.json`, unignore `package-lock.json` in `.gitignore`, track `package.json` + `package-lock.json` | Fresh clone + `./bootstrap.sh` → functional Claude Code |
| 5 — Doc cleanup | `README.md`, `CLAUDE.md`, `skills/README.md`, `agents/README.md` | Manual read-through |

Estimated effort: 2–3 hours focused work. No code changes to submodules.

### Success criteria
- [ ] Fresh clone followed by `./bootstrap.sh` produces a Claude Code session where:
  - All 3 custom skills appear in skill picker.
  - `repo-management` and `linear` MCP servers both connect.
  - `git commit -m "x\n\nCo-Authored-By: y"` is blocked by hook.
  - `pip install` outside a venv is blocked by hook.
  - `SessionStart` echoes rule + skill + MCP summary.
- [ ] `validate-config.sh` continues to pass on all settings files.
- [ ] Linear token is never committed; template uses empty string.

### Known risks
- **Hook chaining cost.** Multiple `PreToolUse` hooks add latency per Bash call. Mitigate by keeping each script <50ms; use early exits when matcher doesn't apply.
- **`SessionStart` noise.** If output is verbose, every session opens with a wall of text. Keep to ≤3 lines.
- **Submodule rule conflict.** `AI_AGNOSTIC_SUBMODULES` says no `.claude/` in submodules. Bootstrap script must not touch submodule directories.

## Alternative Approaches (not chosen)

- **Option 1 (minimal patch):** Rejected because it leaves skills broken — the maintainer's primary complaint.
- **Option 3 (superpowers-only):** Rejected as sole strategy because ecosystem-specific skills must live in-repo. Acceptable as a complement: install `superpowers` on top of the custom Muuvie skill set.
- **Globally installed Claude config:** Rejected — violates `LOCAL_CLAUDE_CONFIG.md` rule [Source: rules/LOCAL_CLAUDE_CONFIG.md].

## Next Steps / Action Items

- [x] ~~**Rotate Linear API token.** Owner: maintainer. By: immediately. Token in `settings.local.json` is in session history.~~ **Deferred 2026-05-15 per Decision gate — risk accepted by maintainer.** Re-flag if session transcript is shared externally.
- [ ] **Approve plan.** Owner: maintainer. By: before Phase 1 starts.
- [ ] **Execute Phase 1 (MCP consolidation).** Owner: Claude. By: same session. Dependency: approval.
- [ ] **Execute Phase 2 (skill restructure).** Owner: Claude. By: same session.
- [ ] **Execute Phase 3 (rule hooks).** Owner: Claude. By: same session.
- [ ] **Execute Phase 4 (bootstrap script).** Owner: Claude. By: same session.
- [ ] **Execute Phase 5 (doc cleanup).** Owner: Claude. By: same session.
- [ ] **Verify on fresh clone.** Owner: maintainer. By: after merge. Dependency: all phases complete.
- [ ] **Run `/ultrareview` against this branch.** Owner: maintainer. By: post-implementation. Use this doc as the briefing.

### Decision gate
**Resolved 2026-05-15** by maintainer:
- Option 2 approved, all 5 phases authorized.
- Phase 2 skill layout: **Layout A** (`.claude/skills/<name>/SKILL.md`). Reasoning: single-repo distribution scope, sibling Mobyle repos are submodules under `AI_AGNOSTIC_SUBMODULES` rule — no external skill consumers.
- Linear token rotation: **deferred, risk accepted.** Token remains in session history. Re-flag if shared in future external context.

Next gate: maintainer runs `/ultrareview` against the branch hosting this doc. This audit serves as the briefing. Implementation begins after `/ultrareview` results are reviewed.

## Ultrareview Outcomes (2026-05-15)

`/ultrareview` run against PR #4 returned 4 findings. All in-scope corrections applied to this doc; out-of-scope items mapped to implementation phases.

| ID | Severity | Status | Disposition |
|----|----------|--------|-------------|
| `bug_019` | nit | Fixed in this PR | Internal contradiction on Linear token rotation — action item marked deferred to align with Decision gate. |
| `bug_032` | normal | Fixed in this PR | (a) Issue 5 citation `.gitignore` line 51 → corrected to line 44 (file is 44 lines). (b) Phase 4 sub-step added: unignore `package-lock.json` before committing it, with reproducibility rationale. |
| `bug_002` | pre_existing nit | Deferred to Phase 1 | CLAUDE.md line 291 says `linear` configured in `.mcp.json` but it's in `.claude/settings.json`. Phase 1 (MCP consolidation) makes the statement accurate by moving config to a single repo-root `.mcp.json`. |
| `merged_bug_006` | nit | Deferred to Phase 1/2 | `.claude/settings.json` and `skills/setting-up-linear-mcp/SKILL.md` diverge on `LINEAR_WORKSPACE_ID` / `LINEAR_PROJECT_ID` placement. Both files are uncommitted modifications outside this PR's scope. Phase 1 consolidation + Phase 2 skill restructure must align them — note: `linear-mcp` (dvcrn) only consumes `LINEAR_ACCESS_TOKEN`, so the scoping vars are inert today; pick one placement for documentation consistency. |

**Validation of audit thesis:** No findings contradicted the audit's 7 identified issues or the recommended Option 2 + Layout A path. Findings refined precision (line numbers, internal consistency) and surfaced one implementation conflict (`.gitignore` vs Phase 4 commit list) that is now explicitly resolved in the plan.

---

## Post-Merge Update (2026-05-15, after PR #3)

While this audit was in review, `main` advanced by 3 commits (`2f5934a`, `06d4497`, `db5b3c8` — PR #3 "Add new rules and subagents" + "[task] Update skills"). This branch was merged with `origin/main` to incorporate the new state. 39 net-new files were added across **6 top-level concerns** not present when the original audit was written:

| Concern | Files | Location | Status |
|---------|-------|----------|--------|
| Pipeline agents | 5 (`pm-spec`, `architect-review`, `implementer-tester`, `code-review`, `validator`) | `agents/*.md` | Added |
| Scaffolding commands | 4 (`new-datasource`, `new-repository`, `new-usecase`, `new-ui-module`) | `commands/*.md` | Added |
| Scaffolding skills (duplicate of commands) | 4 (same names as commands) | `skills/*.md` (flat) | Added |
| Pipeline / safety hooks | 13 (`pipeline-coordinator`, `block-destructive-commands`, `enforce-path-restrictions`, etc.) | `hooks/*.sh` | Added but unregistered |
| Flutter-specific rules | 7 (`feature-architecture`, `feature-implementation`, `feature-testing`, `ui-architecture`, `localization`, `accessibility`, `variable-naming`) | `rules/*.md` | Added |
| Pipeline state | 2 (`pipeline-queue.json`, `template.md`) | `task/*` | Added (with completed snapshot for `movie-details-update`) |
| Secondary CLAUDE.md | 1 | `.claude/CLAUDE.md` | Added (content is wrong — see Issue 14) |
| Research subdirs | 4 (`specs/`, `reviews/`, `requests/`, `archive/`) | `research/*/` | Added (deviates from `muuvie-research-format`) |

The pipeline architecture is designed as a 5-stage AI feature-development workflow (pm-spec → architect-review → implementer-tester → code-review → validator), with `task/pipeline-queue.json` tracking stage state and hooks coordinating transitions. One feature (`movie-details-update`) has been run through it end-to-end [Source: task/pipeline-queue.json].

### Additional Issues Identified (Post-Merge)

Eight new issues found. Numbering continues from the original 7.

#### Issue 8 — `hooks/` directory is orphaned (not registered)
**Symptom:** 13 hook scripts exist as executable shell files; none fire.

**Root cause:** `.claude/settings.json` declares only one hook (`UserPromptSubmit` → `./.claude/validate-config.sh`) [Source: `.claude/settings.json` lines 62-71]. None of the 13 scripts in `hooks/` are referenced. Without registration in `settings.json` (`PreToolUse`, `Stop`, `PostToolUse`, etc.), Claude Code does not invoke them.

**Impact:** Pipeline coordination is non-functional. Safety hooks (`block-destructive-commands`, `enforce-path-restrictions`) provide no protection. Format-on-save and DI-verification hooks never run.

#### Issue 9 — Hook script paths reference wrong location
**Symptom:** Hook comments say `# .claude/hooks/<name>.sh` but files live at `hooks/<name>.sh` (repo root).

**Root cause:** Comment-headers were written assuming hooks would be under `.claude/hooks/`, but the actual files were committed to `hooks/` at repo root [Source: `hooks/block-destructive-commands.sh` line 2; `hooks/pipeline-coordinator.sh` line 2]. Worse, `pipeline-coordinator.sh` line 10 reads from `.claude/task/pipeline-queue.json` — a path that does not exist (the file is at `task/pipeline-queue.json` repo-root). The hook exits cleanly with no error because the missing-file branch returns 0 [Source: `hooks/pipeline-coordinator.sh` lines 12-15].

**Impact:** Even if hooks were registered, `pipeline-coordinator.sh` reads from a path that does not exist → silently exits with status 0 → pipeline progression breaks with no error surface.

#### Issue 10 — `.claude/CLAUDE.md` content is wrong
**Symptom:** Secondary CLAUDE.md in `.claude/` describes a Flutter app called "moowvies", lists `flutter pub get` as the build command, and declares "Never ask for permission to apply changes — just do it" as a project-wide override.

**Root cause:** File appears to have been authored for the `muuvie/` submodule (Flutter app) but was placed in the meta-repo's `.claude/` directory [Source: `.claude/CLAUDE.md` lines 5, 8-13, 16-19]. Frontmatter uses `alwaysApply: true` — a non-standard field outside Claude Code's documented frontmatter schema [Source: `.claude/CLAUDE.md` lines 1-3].

**Impact (severe):** The `Never ask for permission` line overrides Claude Code's default safety posture for *every* session in this repo, including destructive operations. The Flutter-specific build/test commands mislead any session that reads this file as ecosystem guidance. The non-standard frontmatter is silently ignored — its presence implies enforcement that does not exist.

#### Issue 11 — Skills and commands duplicate for 4 scaffolders
**Symptom:** `commands/new-datasource.md` and `skills/new-datasource.md` both exist (and analogous pairs for `new-repository`, `new-usecase`, `new-ui-module`).

**Root cause:** Slash commands and skills are two distinct Claude Code mechanisms. Both files contain similar scaffolding instructions for the same feature [Source: `commands/new-datasource.md` lines 1-40; `skills/new-datasource.md` lines 1-40]. Maintenance burden doubles; divergence is inevitable.

**Impact:** Edits to one file are not reflected in the other. Users invoking `/new-datasource` (command) get one set of instructions; `Skill("new-datasource")` (skill) gets another. Already drifts in details.

#### Issue 12 — Skills directory mixes flat-file and subdirectory layouts
**Symptom:** `skills/` contains a mix of structures:
- Subdirectory + `SKILL.md`: `muuvie-research-format/`, `setting-up-linear-mcp/`
- Flat `.md`: `verify-docs-before-pr.md`, `new-datasource.md`, `new-repository.md`, `new-usecase.md`, `new-ui-module.md`

**Root cause:** No enforced convention. Original 3 ecosystem skills used subdir layout; the 4 scaffolders added in PR #3 used flat-file layout.

**Impact:** When Phase 2 moves skills to `.claude/skills/`, the target layout (subdir + SKILL.md per Claude Code convention) must be uniformly applied. 5 flat files must be promoted to subdirectories.

#### Issue 13 — Pipeline queue snapshot committed as runtime state
**Symptom:** `task/pipeline-queue.json` is committed with a completed snapshot of one specific feature (`movie-details-update`) including timestamps and stage history.

**Root cause:** Pipeline state is runtime artifact tracking the *current* feature being worked on. Committing it pins one feature's history to the repo, conflates state with code, and makes the file unsuitable for next-feature reuse [Source: `task/pipeline-queue.json`].

**Impact:** Next contributor to start a pipeline run must either edit/overwrite this committed state (polluting git history with stage transitions) or duplicate the file elsewhere. Should be gitignored with a template (`task/template.md` already exists as the per-feature task template — same idea applies to queue).

#### Issue 14 — New Flutter-specific rules unenforced (same gap as original 4)
**Symptom:** 7 new rules added in PR #3 (`feature-architecture`, `feature-implementation`, `feature-testing`, `ui-architecture`, `localization`, `accessibility`, `variable-naming`) are markdown-only.

**Root cause:** Same enforcement pattern as the original 4 rules from the audit's Issue 3 — rules live as documentation, compliance relies on Claude reading them. Several of the 13 added hooks (`validate-implementation.sh`, `validate-localization.sh`, `validate-module-structure.sh`, `verify-di-registration.sh`) appear designed to enforce these rules, but they are not registered (Issue 8) so enforcement is theoretical.

**Impact:** Existing audit Issue 3 expands from 4 unenforced rules to 11.

#### Issue 15 — `agents/README.md` names mismatch agent filenames
**Symptom:** `agents/README.md` line 8 names the agent `code-reviewer` but the file is `agents/code-review.md` (agent's frontmatter name is `code-review`).

**Root cause:** README written after agent file; one of the two was not updated when the other was renamed [Source: `agents/README.md` line 8; `agents/code-review.md` frontmatter].

**Impact:** Invoking the agent by README's name fails. Documentation says one thing, runtime expects another.

#### Issue 16 — Pre-PR-#4 local working changes still match a pending fix
**Symptom:** Working tree carries uncommitted edits to `.claude/settings.json`, `CLAUDE.md`, `README.md`, `skills/setting-up-linear-mcp/SKILL.md`, plus untracked `package.json`. The diff renames the Linear MCP package from `@linear/mcp` (a non-existent package) to `linear-mcp` (the real dvcrn package) and renames `LINEAR_API_TOKEN` → `LINEAR_ACCESS_TOKEN` throughout.

**Root cause:** Main's `.claude/settings.json` ships the broken `@linear/mcp` package reference with `LINEAR_API_TOKEN` env var — the wrong package name and the wrong env var name (the real `linear-mcp` package consumes `LINEAR_ACCESS_TOKEN`). The local working changes are the unmerged fix [Source: `git diff main -- .claude/settings.json`].

**Impact:** On `main` today, Linear MCP cannot start. These working-tree edits should be folded into Phase 1 (MCP consolidation) so the fix lands as part of the canonical reset rather than as separate untracked edits.

### Revised Phase Plan

The 5 phases stand, but scope per phase expands. Phase 6 added for pipeline cleanup.

| Phase | Original Scope | Expanded Scope (decisions locked 2026-05-15) |
|-------|----------------|----------------|
| 1 — MCP consolidation | Move `.mcp.json` to root, add `linear`, dedupe | **+** Fold working-tree Linear MCP fix: rename package `@linear/mcp` → `linear-mcp`, env var `LINEAR_API_TOKEN` → `LINEAR_ACCESS_TOKEN`, remove duplicate top-level scoping vars (Issue 16) |
| 2 — Skill restructure | Move 3 skills to `.claude/skills/<name>/SKILL.md` | **+** Delete `skills/new-datasource.md`, `new-repository.md`, `new-usecase.md`, `new-ui-module.md` (duplicates of `commands/`, per Decision 1). **+** Update `muuvie-research-format` skill to permit subdir-based pipeline outputs (per Decision 4) |
| 3 — Rule + hook coverage | Add coauthor / python-env / session-start hooks | **+** Move `hooks/` → `.claude/hooks/` and `task/` → `.claude/task/` (per Decision 2). Aligns with existing comment headers and `pipeline-coordinator.sh:10` path. **+** Register all 13 hooks in `.claude/settings.json` with correct event matchers. **+** Wire rule-enforcement hooks to rules (`validate-implementation.sh` ↔ `rules/feature-implementation.md`, `validate-localization.sh` ↔ `rules/localization.md`, etc.) |
| 4 — Bootstrap script | `bootstrap.sh` + template + unignore lockfile | **+** `chmod +x .claude/hooks/*.sh` step. **+** Validate `.claude/task/` exists, seed empty queue from `template.md` if missing |
| 5 — Doc cleanup | Update `skills/README.md`, `agents/README.md`, root README, CLAUDE.md | **+** Rewrite `.claude/CLAUDE.md` per Decision 3 (split: root CLAUDE.md = human project instructions; `.claude/CLAUDE.md` = Claude/tooling-specific behavior). Remove `alwaysApply: true` non-standard frontmatter. Remove `Never ask for permission` line. Drop Flutter-app description. **+** Fix `agents/README.md` name mismatch (Issue 15: `code-reviewer` → `code-review`). **+** Update `research/README.md` for subdir conventions |
| **6 — Pipeline cleanup (new)** | n/a | Gitignore `.claude/task/pipeline-queue.json` (now relocated), commit `.claude/task/template.md` as empty-queue template (Issue 13). Verify all agent files reference `/new-*` (commands) not `Skill("new-*")` after skill deletion |

### Open Decisions — RESOLVED 2026-05-15

| # | Decision | Resolution |
|---|----------|-----------|
| 1 | Commands vs skills | **Keep `commands/`, drop `skills/new-*.md`.** Agent files (e.g. `agents/implementer-tester.md` line 42-45) reference `/new-*` slash syntax → command form is canonical. |
| 2 | Hook location | **Move to `.claude/hooks/` + `.claude/task/`.** Aligns with comment headers and `pipeline-coordinator.sh:10` which already reads from `.claude/task/pipeline-queue.json`. |
| 3 | `.claude/CLAUDE.md` disposition | **Keep both files, split responsibility.** Root `CLAUDE.md` = human-readable project instructions (architecture, conventions, workflows). `.claude/CLAUDE.md` = Claude/tooling-specific behavior (tool preferences, hook expectations, subagent overrides, output formatting). Current file content (Flutter app description, "Never ask for permission", `alwaysApply: true`) is wrong on all counts and will be rewritten from scratch. Both files stay in meta-repo only — `AI_AGNOSTIC_SUBMODULES` rule unchanged. |
| 4 | Research subdirs vs `muuvie-research-format` | **Update skill to allow subdirs.** Permit pipeline-generated docs in `specs/reviews/requests/archive/` subdirs. Keep flat `YYYY-MM-DD-topic.md` for ad-hoc research. |
| 5 | Folding Linear MCP fix into this PR | **Defer to Phase 1.** Keep this PR doc-only. Working-tree edits will land with Phase 1's branch. |

### PR Base Branch Convention (2026-05-15)

All Phase 1–6 PRs target `develop`, not `main`. `develop` is a copy of `main` at the time of this audit; landing the reset there first lets the maintainer evaluate the full sequence in isolation before promoting to `main`. Roll-back path: if any phase introduces unwanted behavior, reset `develop` to `main` and start over without touching `main`.

PR #6 (Phase 1) was retargeted to `develop` mid-flight (originally opened against `main`).

### Future Consideration — Linear Official Remote MCP

The current setup uses `linear-mcp` (dvcrn, community-maintained, npm-distributed, runs locally via `npx`). Linear ships an official remote MCP server at `https://mcp.linear.app/sse`. Pros of migration: no `npm install` requirement, no network fetch on every clone, official support, OAuth-based auth instead of static token. Cons: requires Claude Code's remote MCP config syntax (HTTP/SSE transport) and per-developer OAuth flow. Re-evaluate in Phase 4 or 5 when bootstrap script lands — if dropped, the `linear-mcp` dep + npm install step + token storage flow all simplify.

[Source: PR #6 review feedback by EdYuTo, 2026-05-15.]

### Scope of `.claude/CLAUDE.md` Rewrite (Phase 5)

Per Decision 3, `.claude/CLAUDE.md` becomes Claude/tooling behavior. Candidate contents:

- Tool preferences: prefer Read/Edit/Write over shell equivalents; default exploration scope
- Output formatting: response length defaults, no trailing summaries, no emojis unless asked
- Hook expectations: which hooks fire on which events; which are blocking
- Subagent dispatch: when to use `Plan` vs `Explore` vs `general-purpose`
- Skill autoload: which skills should be invoked proactively (e.g., `verify-docs-before-pr` before any PR)
- Safe-action defaults: must confirm destructive ops (overrides the dangerous "Never ask permission" line)

What does NOT belong: project architecture, build commands, DI checklist, Flutter-specific guidance (those stay in root `CLAUDE.md` and `rules/feature-*.md`).
