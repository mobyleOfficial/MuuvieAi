#!/bin/bash
# .claude/hooks/check-feature-map.sh
# Blocks `gh pr create` and `git push` in the meta-repo when the branch moves a
# submodule ref or edits the feature map and the map no longer matches the code.
# Enforces rules/common/FEATURE_MAP.md.
# Register as PreToolUse hook on the Bash tool in .claude/settings.json.

input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty')
# The session's working directory, which is where the command will run.
cwd=$(echo "$input" | jq -r '.cwd // empty')
[ -d "$cwd" ] || cwd=$PWD

if [ -z "$command" ]; then
  exit 0
fi

# Heredoc bodies are data, not commands: drop them before matching, so a script
# that merely mentions "git push" doesn't trigger the check. A here-string (<<<)
# is not a heredoc.
command=$(printf '%s\n' "$command" | awk '
  in_doc {
    line = $0
    sub(/^\t+/, "", line)
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
  }')

# Same matching as check-docs-sync.sh: a real `gh pr create` / `git push`, at the
# start of a pipeline, after a chain operator, or after env-var prefixes.
PR_PATTERN='(^|[;&|][[:space:]]*)([A-Z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+)*gh[[:space:]]+pr[[:space:]]+create'
PUSH_PATTERN='(^|[;&|][[:space:]]*)([A-Z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+)*git[[:space:]]+push'

if ! echo "$command" | grep -qE "$PR_PATTERN" && ! echo "$command" | grep -qE "$PUSH_PATTERN"; then
  exit 0
fi

repo_root=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null) || exit 0
cli="$repo_root/.claude/skills/muuvie-feature-map/bin/feature-map-check"

# Only the meta-repo has the map; a session whose cwd is a submodule skips.
if [ ! -f "$cli" ] || ! command -v node >/dev/null 2>&1; then
  exit 0
fi

# A push or PR from inside another repo (a submodule, by any path) is that repo's
# business, not the map's: resolve every `cd` / `git -C` target with git.
targets=$(echo "$command" | grep -oE "(cd|git[[:space:]]+-C)[[:space:]]+(\"[^\"]*\"|'[^']*'|[^[:space:];&|]+)" |
  sed -E "s/^(cd|git[[:space:]]+-C)[[:space:]]+//; s/^[\"']//; s/[\"']$//")
while IFS= read -r target; do
  [ -z "$target" ] && continue
  top=$(git -C "$cwd" -C "$target" rev-parse --show-toplevel 2>/dev/null) || continue
  [ "$top" != "$repo_root" ] && exit 0
done <<< "$targets"

base=""
for candidate in origin/dev origin/main; do
  if git -C "$repo_root" rev-parse --verify --quiet "$candidate" >/dev/null; then
    base="$candidate"
    break
  fi
done
[ -z "$base" ] && exit 0

changed=$(git -C "$repo_root" diff --name-only "$base...HEAD" 2>/dev/null)
if ! echo "$changed" | grep -qE '^(muuvie|backend)$|^\.claude/skills/muuvie-feature-map/'; then
  exit 0
fi

tmpfile=$(mktemp -t check-feature-map.XXXXXX) || exit 0
trap 'rm -f "$tmpfile"' EXIT

node "$cli" check --strict --root "$repo_root" >"$tmpfile" 2>/dev/null
status=$?

# 2 = environment problem (e.g. submodules not checked out) or a checker crash:
# don't block on that. Nor on output that isn't the checker's JSON.
if [ "$status" -ne 1 ] || ! node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$tmpfile" 2>/dev/null; then
  exit 0
fi

echo "❌ FEATURE_MAP rule violation: the feature map does not match the recorded submodule commits." >&2
node -e '
  const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  for (const p of r.problems.slice(0, 15)) console.error(`   ${p.file}:${p.line} ${p.kind} ${p.ref}\n     → ${p.fix}`);
  if (r.problems.length > 15) console.error(`   … and ${r.problems.length - 15} more problems`);
  const u = [...r.uncovered.endpoints.map((e) => `${e.key}  (${e.file}:${e.line})`), ...r.uncovered.routes.map((x) => `${x.name}  (${x.file}:${x.line})`)];
  if (u.length) console.error(`   Not on any page (${u.length}):\n` + u.slice(0, 15).map((s) => `     ${s}`).join("\n") + (u.length > 15 ? "\n     …" : ""));
' "$tmpfile" >&2
echo "" >&2
echo "   Run /map-features (or dispatch the feature-mapper agent), then retry." >&2
echo "   Details: .claude/skills/muuvie-feature-map/bin/feature-map-check --strict. See rules/common/FEATURE_MAP.md." >&2
exit 2
