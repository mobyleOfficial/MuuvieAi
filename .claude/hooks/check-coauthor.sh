#!/bin/bash
# .claude/hooks/check-coauthor.sh
# Blocks `git commit` whose message carries a Co-Authored-By trailer.
# Enforces rules/common/NO_COAUTHORS.md across all sessions.
# Registered as a PreToolUse hook on the Bash tool in .claude/settings.json.
#
# A trailer is "Co-Authored-By: Name <email>". A message that merely mentions
# the words (a commit about this very hook, or a `grep -v Co-Authored-By` that
# strips one) is allowed. The message is read wherever it lives: -m strings,
# a heredoc fed to -F-, or a file given to -F / --file.
# Tests: .claude/tests/command-hooks.test.mjs.

. "$(dirname "$0")/lib-hook.sh"
hook_read_input
[ -z "$HOOK_COMMAND" ] && exit 0

text=$(executable_text "$HOOK_COMMAND")
runs_git "$text" commit || exit 0

TRAILER='Co-?Authored-?By:[[:space:]]*[^<>[:cntrl:]]*<[^<>@[:space:]]+@[^<>[:space:]]+>'

found=0
if printf '%s\n' "$HOOK_COMMAND" | grep -qiE "$TRAILER"; then
  found=1
else
  # -F <file> / --file <file> / --file=<file>: read the file, relative to the session's cwd.
  for file in $(printf '%s\n' "$text" | grep -oE '(-F|--file)[[:space:]=]+[^[:space:]]+' | sed -E 's/^(-F|--file)[[:space:]=]+//'); do
    [ "$file" = "-" ] && continue
    case "$file" in /*) path=$file ;; *) path="$HOOK_CWD/$file" ;; esac
    if [ -f "$path" ] && grep -qiE "$TRAILER" "$path"; then found=1; fi
  done
fi

if [ "$found" -eq 1 ]; then
  echo "❌ NO_COAUTHORS rule violation: the commit message contains a Co-Authored-By trailer." >&2
  echo "   Remove the trailer — single author per commit, always. See rules/common/NO_COAUTHORS.md." >&2
  exit 2
fi
exit 0
