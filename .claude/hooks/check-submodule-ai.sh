#!/bin/bash
# .claude/hooks/check-submodule-ai.sh
# Blocks `git commit` / `git push` when the operation involves a submodule
# (muuvie, backend) whose tracked files include AI tooling. Enforces
# rules/common/AI_AGNOSTIC_SUBMODULES.md.
# Registered as a PreToolUse hook on the Bash tool in .claude/settings.json.
#
# A submodule is involved when:
#   - the session is inside it, or the command cd's / `git -C`s into it, or
#   - the meta-repo operation carries a change to it: staged, unstaged, or
#     committed since the upstream (or since origin/dev when there is none yet,
#     as on a branch's first push).
# Tracked files only: an untracked leftover on someone's disk isn't in history.
# Tests: .claude/tests/command-hooks.test.mjs.

. "$(dirname "$0")/lib-hook.sh"
hook_read_input
[ -z "$HOOK_COMMAND" ] && exit 0

text=$(executable_text "$HOOK_COMMAND")
runs_git "$text" 'commit|push' || exit 0

AI_TOOLING='(^|/)(\.claude([/.]|$)|CLAUDE\.md$|GEMINI\.md$|AGENTS\.md$|AI_SETUP\.md$|\.cursorrules$|\.copilot(/|$)|\.github/copilot-instructions\.md$)'
SUBMODULES="muuvie backend"

toplevel=$(git -C "$HOOK_CWD" rev-parse --show-toplevel 2>/dev/null) || exit 0
super=$(git -C "$toplevel" rev-parse --show-superproject-working-tree 2>/dev/null)
meta=${super:-$toplevel}

involved=""
add_involved() { case " $involved " in *" $1 "*) ;; *) involved="$involved $1" ;; esac; }

# The session sits inside a submodule.
if [ -n "$super" ]; then
  add_involved "${toplevel#"$super"/}"
fi

# The command cd's / git -C's into a submodule.
for sub in $SUBMODULES; do
  [ -d "$meta/$sub" ] || continue
  sub_top=$(git -C "$meta/$sub" rev-parse --show-toplevel 2>/dev/null) || continue
  [ "$sub_top" = "$meta" ] && continue
  targets=$(printf '%s\n' "$HOOK_COMMAND" | grep -oE "(cd|git[[:space:]]+-C)[[:space:]]+(\"[^\"]*\"|'[^']*'|[^[:space:];&|)]+)" |
    sed -E "s/^(cd|git[[:space:]]+-C)[[:space:]]+//; s/^[\"']//; s/[\"']\$//")
  while IFS= read -r target; do
    [ -z "$target" ] && continue
    top=$(git -C "$HOOK_CWD" -C "$target" rev-parse --show-toplevel 2>/dev/null) || continue
    [ "$top" = "$sub_top" ] && add_involved "$sub"
  done <<< "$targets"
done

# The meta-repo operation carries a submodule change.
if [ -z "$super" ]; then
  changes=$(
    git -C "$meta" diff --cached --name-only 2>/dev/null
    git -C "$meta" diff --name-only 2>/dev/null
    if git -C "$meta" rev-parse --verify --quiet '@{u}' >/dev/null 2>&1; then
      git -C "$meta" diff --name-only '@{u}...HEAD' 2>/dev/null
    else
      for base in origin/dev origin/main; do
        if git -C "$meta" rev-parse --verify --quiet "$base" >/dev/null; then
          git -C "$meta" diff --name-only "$base...HEAD" 2>/dev/null
          break
        fi
      done
    fi
  )
  for sub in $SUBMODULES; do
    printf '%s\n' "$changes" | grep -qE "^${sub}(/|\$)" && add_involved "$sub"
  done
fi

[ -z "$involved" ] && exit 0

violations=""
for sub in $involved; do
  [ -d "$meta/$sub" ] || continue
  matches=$(git -C "$meta/$sub" ls-files 2>/dev/null | grep -E "$AI_TOOLING")
  while IFS= read -r f; do
    [ -n "$f" ] && violations="$violations  $sub/$f"$'\n'
  done <<< "$matches"
done

[ -z "$violations" ] && exit 0
echo "❌ AI_AGNOSTIC_SUBMODULES rule violation: a submodule tracks AI-tooling files." >&2
echo "" >&2
printf '%s' "$violations" >&2
echo "" >&2
echo "   Submodules must stay AI-agnostic: remove these from the submodule (git rm), and keep AI config" >&2
echo "   in the meta-repo (.claude/, root CLAUDE.md, rules/). See rules/common/AI_AGNOSTIC_SUBMODULES.md." >&2
exit 2
