#!/bin/bash
# .claude/hooks/lib-hook.sh
# Shared helpers for the PreToolUse Bash hooks. Source it; don't run it:
#   . "$(dirname "$0")/lib-hook.sh"
#
# Written for bash 3.2 (macOS /bin/bash): no associative arrays, no globstar.
#
# Why this exists: every hook used to grep the raw command text, so a commit
# message, a heredoc body or a quoted string that merely *mentioned*
# `git push --force` or `pip install` was treated as running it. These helpers
# reduce a command to the words that actually execute.

# Reads the hook JSON from stdin. Sets:
#   HOOK_INPUT    the raw JSON
#   HOOK_COMMAND  tool_input.command (empty for non-Bash tools)
#   HOOK_CWD      the session's working directory (.cwd), falling back to $PWD
hook_read_input() {
  HOOK_INPUT=$(cat)
  HOOK_COMMAND=$(printf '%s' "$HOOK_INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
  HOOK_CWD=$(printf '%s' "$HOOK_INPUT" | jq -r '.cwd // empty' 2>/dev/null)
  [ -d "$HOOK_CWD" ] || HOOK_CWD=$PWD
}

# Drops heredoc bodies (data, not commands). A here-string (<<<) is not a
# heredoc. The terminator may be followed by `)` or quotes, as in
# "$(cat <<'EOF' ... EOF)".
strip_heredocs() {
  printf '%s\n' "$1" | awk '
    in_doc {
      line = $0
      sub(/^\t+/, "", line)
      sub(/[)"\047 \t;]+$/, "", line)
      if (line == tag) in_doc = 0
      next
    }
    {
      print
      if (match($0, /(^|[^<])<<-?[ \t]*["\047]?[A-Za-z_][A-Za-z0-9_]*["\047]?/)) {
        tag = substr($0, RSTART, RLENGTH)
        sub(/^[^<]*<<-?[ \t]*/, "", tag)
        gsub(/["\047]/, "", tag)
        in_doc = 1
      }
    }'
}

# Empties quoted strings ('…' and "…", with backslash escapes in "…"), keeping
# the quotes so word positions survive: `git commit -m "never push --force"`
# becomes `git commit -m ""`.
strip_quotes() {
  printf '%s\n' "$1" | awk '
    {
      out = ""; n = length($0); i = 1
      while (i <= n) {
        c = substr($0, i, 1)
        if (c == "\047") {
          j = index(substr($0, i + 1), "\047")
          if (j == 0) { out = out "\047\047"; break }
          out = out "\047\047"; i += j + 1; continue
        }
        if (c == "\"") {
          k = i + 1
          while (k <= n) {
            d = substr($0, k, 1)
            if (d == "\\") { k += 2; continue }
            if (d == "\"") break
            k++
          }
          out = out "\"\""; i = k + 1; continue
        }
        out = out c; i++
      }
      print out
    }'
}

# The command reduced to what executes: heredoc bodies and quoted text removed.
executable_text() {
  strip_quotes "$(strip_heredocs "$1")"
}

# One simple command per line: splits on ; && || | & ( ) newlines, backticks
# and $( — then trims leading whitespace and VAR=value prefixes. Feed it
# executable_text output.
command_segments() {
  printf '%s\n' "$1" | awk '
    {
      gsub(/\$\(/, "\n")
      gsub(/&&|\|\||[;|&()`]/, "\n")
      print
    }' | awk '
    {
      sub(/^[ \t]+/, ""); sub(/[ \t]+$/, "")
      while (match($0, /^[A-Za-z_][A-Za-z0-9_]*=[^ \t]*[ \t]+/)) $0 = substr($0, RLENGTH + 1)
      if ($0 != "") print
    }'
}

# Exit status 0 when some segment runs `git <subcommand>` (any of the
# alternatives in $2, an ERE like 'commit|push'), allowing git's global
# options (-C dir, -c key=val, --no-pager, …) before the subcommand.
runs_git() {
  command_segments "$1" | grep -qE "^git([[:space:]]+(-C|-c)[[:space:]]+[^[:space:]]+|[[:space:]]+--[a-z-]+(=[^[:space:]]+)?)*[[:space:]]+($2)([[:space:]]|\$)"
}

# Exit status 0 when the command changes into, or points git at, a directory
# inside a different git repository than $3 (e.g. a submodule): `cd muuvie`,
# `cd /abs/muuvie`, `git -C ./backend …`. Targets are resolved with git.
targets_other_repo() {
  local cmd=$1 cwd=$2 root=$3 targets target top
  targets=$(printf '%s\n' "$cmd" | grep -oE "(cd|git[[:space:]]+-C)[[:space:]]+(\"[^\"]*\"|'[^']*'|[^[:space:];&|)]+)" |
    sed -E "s/^(cd|git[[:space:]]+-C)[[:space:]]+//; s/^[\"']//; s/[\"']\$//")
  while IFS= read -r target; do
    [ -z "$target" ] && continue
    top=$(git -C "$cwd" -C "$target" rev-parse --show-toplevel 2>/dev/null) || continue
    [ "$top" != "$root" ] && return 0
  done <<< "$targets"
  return 1
}

# The meta-repo root for directory $1: its git toplevel, or the superproject's
# when $1 is inside a submodule. Exit status 1 outside any repo.
meta_root() {
  local top super
  top=$(git -C "$1" rev-parse --show-toplevel 2>/dev/null) || return 1
  super=$(git -C "$top" rev-parse --show-superproject-working-tree 2>/dev/null)
  printf '%s\n' "${super:-$top}"
}

# Exit status 0 when a Stop hook is already re-running because a Stop hook
# blocked: such hooks must then let the agent stop, or it loops forever.
stop_hook_active() {
  [ "$(printf '%s' "$HOOK_INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)" = "true" ]
}
