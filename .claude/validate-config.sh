#!/bin/bash
# .claude/validate-config.sh
# Checks that shared Claude Code config uses only portable, repo-relative paths.
# Enforces rules/common/LOCAL_CLAUDE_CONFIG.md. Registered as a UserPromptSubmit
# hook in .claude/settings.json, so it runs on every prompt.
#
# Shared files (.claude/settings.json, .mcp.json) block the prompt (exit 2).
# .claude/settings.local.json is personal and gitignored: a violation there is
# only a warning. Tests: .claude/tests/config-hooks.test.mjs.

repo_root=$(cd "$(dirname "$0")/.." && pwd)
RULE_FILE="rules/common/LOCAL_CLAUDE_CONFIG.md"

FORBIDDEN_PATTERNS=(
  '~/'          # home-relative path
  '/Users/'     # absolute user path (macOS)
  '/home/'      # absolute user path (Linux)
  '/root/'      # root's home
  '\$HOME'      # home variable
)

# Prints "file:line: pattern" for each violation in $1.
scan() {
  local file=$1 line_num=0 line pattern
  [ -f "$repo_root/$file" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    line_num=$((line_num + 1))
    for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
      if printf '%s\n' "$line" | grep -qE -- "$pattern"; then
        printf '%s:%d: forbidden path pattern %s\n  > %s\n' "$file" "$line_num" "$pattern" "$line"
      fi
    done
  done < "$repo_root/$file"
}

shared=$(scan .claude/settings.json; scan .mcp.json)
personal=$(scan .claude/settings.local.json)

if [ -n "$personal" ]; then
  echo "⚠️  .claude/settings.local.json has non-portable paths (personal file, not blocking):" >&2
  echo "$personal" >&2
fi

if [ -n "$shared" ]; then
  echo "❌ LOCAL_CLAUDE_CONFIG violation in shared config:" >&2
  echo "$shared" >&2
  echo "" >&2
  echo "Use repo-relative paths (./.claude/…). See $RULE_FILE." >&2
  exit 2
fi
exit 0
