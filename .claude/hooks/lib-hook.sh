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

# Drops heredoc bodies (data, not commands). Tracks quotes and comments, so
# `python3 -c "print(1 << n)"` or `echo 'a << EOF'` is not a heredoc, and a
# here-string (<<<) is not one either. The terminator may be followed by `)`
# or quotes, as in "$(cat <<'EOF' ... EOF)". Fails closed: a heredoc that never
# terminates (e.g. an arithmetic `$((1 << n))` mistaken for one) is re-emitted,
# so its lines are still checked.
strip_heredocs() {
  printf '%s\n' "$1" | awk '
    in_doc {
      line = $0
      sub(/^\t+/, "", line)
      sub(/[)"\047 \t;]+$/, "", line)
      if (line == tag) { in_doc = 0; body = ""; next }
      body = body $0 "\n"
      next
    }
    {
      print
      n = length($0); i = 1
      while (i <= n) {
        c = substr($0, i, 1)
        if (q != "") {
          if (c == "\\" && q == "\"") { i += 2; continue }
          # "$(…)" opens an unquoted context inside double quotes.
          if (q == "\"" && substr($0, i, 2) == "$(") { stack = stack "\""; q = ""; i += 2; continue }
          if (c == q) q = ""
          i++; continue
        }
        if (c == "\\") { i += 2; continue }
        if (c == ")" && substr(stack, length(stack)) == "\"") { stack = substr(stack, 1, length(stack) - 1); q = "\""; i++; continue }
        if (c == "\047" || c == "\"") { q = c; i++; continue }
        if (c == "#" && (i == 1 || substr($0, i - 1, 1) ~ /[ \t;&|(]/)) break
        if (substr($0, i, 2) == "<<" && substr($0, i + 2, 1) != "<" && (i == 1 || substr($0, i - 1, 1) != "<") && substr($0, i - 2, 2) != "$(") {
          rest = substr($0, i + 2)
          sub(/^-?[ \t]*/, "", rest)
          if (match(rest, /^["\047]?[A-Za-z_][A-Za-z0-9_]*/)) {
            tag = substr(rest, RSTART, RLENGTH)
            gsub(/["\047]/, "", tag)
            in_doc = 1; body = ""
            break
          }
        }
        i++
      }
    }
    END { if (in_doc) printf "%s", body }'
}

# Joins backslash-newline continuations, drops # comments, and empties quoted
# strings ('…', "…", $'…', spanning lines), keeping the quotes so word
# positions survive: `git commit -m "never push --force"` becomes
# `git commit -m ""`. Inside "…", a $(…) or `…` command substitution still
# runs, so its (stripped) body is checked too: bodies are printed after the
# whole command, on their own lines, so the command around them stays intact
# (`git push origin "$(…)" --force` keeps its --force). Unquoted substitutions
# are handled the same way, leaving the placeholder word SUBST in their place.
# Escapes outside quotes (don\'t) are honoured. Fails closed: from an
# unterminated quote on, the text is kept as-is rather than hidden.
strip_quotes() {
  printf '%s\n' "$1" | awk '
    # Index of the ) closing the $( that ends just before position i of s.
    function close_paren(s, i,   n, depth, c, q) {
      n = length(s); depth = 1; q = ""
      while (i <= n) {
        c = substr(s, i, 1)
        if (q != "") { if (c == "\\" && q == "\"") { i += 2; continue } if (c == q) q = ""; i++; continue }
        if (c == "\\") { i += 2; continue }
        if (c == "\047" || c == "\"") q = c
        else if (c == "(") depth++
        else if (c == ")") { depth--; if (depth == 0) return i }
        i++
      }
      return 0
    }
    function strip(s,   out, n, i, c, j, k, d, inner, e) {
      out = ""; n = length(s); i = 1
      while (i <= n) {
        c = substr(s, i, 1)
        if (c == "\\") { out = out substr(s, i, 2); i += 2; continue }
        if (c == "#" && (i == 1 || substr(s, i - 1, 1) ~ /[ \t\n;&|(]/)) {
          j = index(substr(s, i), "\n"); if (j == 0) break
          i += j - 1; continue
        }
        # Unquoted $(…) / `…`: one placeholder word, body checked after the command.
        if (c == "$" && substr(s, i + 1, 1) == "(" && substr(s, i + 2, 1) != "(") {
          e = close_paren(s, i + 2)
          if (e == 0) return out substr(s, i)
          inner = strip(substr(s, i + 2, e - i - 2)); subs = subs "\n" inner
          out = out "SUBST"; i = e + 1; continue
        }
        if (c == "`") {
          e = index(substr(s, i + 1), "`")
          if (e == 0) return out substr(s, i)
          inner = strip(substr(s, i + 1, e - 1)); subs = subs "\n" inner
          out = out "SUBST"; i += e + 1; continue
        }
        if (c == "$" && substr(s, i + 1, 1) == "\047") {
          k = i + 2
          while (k <= n) { d = substr(s, k, 1); if (d == "\\") { k += 2; continue } if (d == "\047") break; k++ }
          if (k > n) return out substr(s, i)
          out = out "\047\047"; i = k + 1; continue
        }
        if (c == "\047") {
          j = index(substr(s, i + 1), "\047")
          if (j == 0) return out substr(s, i)
          out = out "\047\047"; i += j + 1; continue
        }
        if (c == "\"") {
          k = i + 1
          while (k <= n) {
            d = substr(s, k, 1)
            if (d == "\\") { k += 2; continue }
            if (d == "\"") break
            if (d == "$" && substr(s, k + 1, 1) == "(") {
              e = close_paren(s, k + 2)
              if (e == 0) return out substr(s, i)
              inner = substr(s, k + 2, e - k - 2)
              inner = strip(inner); subs = subs "\n" inner
              k = e + 1; continue
            }
            if (d == "`") {
              e = index(substr(s, k + 1), "`")
              if (e == 0) return out substr(s, i)
              inner = strip(substr(s, k + 1, e - 1)); subs = subs "\n" inner
              k += e + 1; continue
            }
            k++
          }
          if (k > n) return out substr(s, i)
          out = out "\"\""; i = k + 1; continue
        }
        out = out c; i++
      }
      return out
    }
    { buf = buf $0 "\n" }
    END {
      gsub(/\\\n/, " ", buf)
      subs = ""
      out = strip(buf)
      sub(/\n$/, "", out)
      print out subs
    }'
}

# The command reduced to what executes: heredoc bodies and quoted text removed.
executable_text() {
  strip_quotes "$(strip_heredocs "$1")"
}

# One simple command per line: splits on ; && || | & ( ) newlines, backticks
# and $( — then peels what precedes the command word: whitespace, shell
# keywords (then, do, if, while, …), braces, `!`, `env` and VAR=value
# assignments. Feed it executable_text output.
command_segments() {
  printf '%s\n' "$1" | awk '
    {
      gsub(/\$\(/, "\n")
      gsub(/&&|\|\||[;|&()`]/, "\n")
      print
    }' | awk '
    {
      sub(/^[ \t]+/, ""); sub(/[ \t]+$/, "")
      do {
        changed = 0
        if (match($0, /^(then|do|else|elif|if|while|until|time|!|\{|\})([ \t]+|$)/)) { $0 = substr($0, RLENGTH + 1); changed = 1 }
        if (match($0, /^env([ \t]+-[^ \t]+)*[ \t]+/)) { $0 = substr($0, RLENGTH + 1); changed = 1 }
        if (match($0, /^[A-Za-z_][A-Za-z0-9_]*=[^ \t]*([ \t]+|$)/)) { $0 = substr($0, RLENGTH + 1); changed = 1 }
      } while (changed)
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
