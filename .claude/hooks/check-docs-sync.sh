#!/bin/bash
# .claude/hooks/check-docs-sync.sh
# Blocks `gh pr create` and `git push` in the meta-repo when critical files
# changed without a doc update. Enforces rules/common/DOCS_UP_TO_DATE.md by
# running .claude/verify-docs.sh.
# Registered as a PreToolUse hook on the Bash tool in .claude/settings.json.
#
# Judges the repo the command runs in (the session's cwd), skips pushes made
# from inside another repo (a submodule), and ignores mentions in messages,
# quotes and heredocs. Tests: .claude/tests/command-hooks.test.mjs.

. "$(dirname "$0")/lib-hook.sh"
hook_read_input
[ -z "$HOOK_COMMAND" ] && exit 0

text=$(executable_text "$HOOK_COMMAND")
if ! runs_git "$text" push && ! command_segments "$text" | grep -qE '^gh[[:space:]]+pr[[:space:]]+create([[:space:]]|$)'; then
  exit 0
fi

repo_root=$(git -C "$HOOK_CWD" rev-parse --show-toplevel 2>/dev/null) || exit 0
verify="$repo_root/.claude/verify-docs.sh"
# No verifier means this isn't the meta-repo (e.g. the session is in a submodule).
[ -x "$verify" ] || exit 0
targets_other_repo "$HOOK_COMMAND" "$HOOK_CWD" "$repo_root" && exit 0

tmpfile=$(mktemp -t check-docs-sync.XXXXXX) || exit 0
trap 'rm -f "$tmpfile"' EXIT

if ! (cd "$repo_root" && "$verify") >"$tmpfile" 2>&1; then
  echo "❌ DOCS_UP_TO_DATE rule violation:" >&2
  cat "$tmpfile" >&2
  echo "" >&2
  echo "   Update README.md / CLAUDE.md / the relevant subdir README in this branch before pushing or opening a PR." >&2
  echo "   See rules/common/DOCS_UP_TO_DATE.md." >&2
  exit 2
fi
exit 0
