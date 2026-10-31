#!/bin/bash
# .claude/hooks/check-feature-map.sh
# Blocks `gh pr create` and `git push` in the meta-repo when the branch moves a
# submodule ref or edits the feature map and the map no longer matches the code.
# Enforces rules/common/FEATURE_MAP.md.
# Registered as a PreToolUse hook on the Bash tool in .claude/settings.json.
# Tests: .claude/skills/muuvie-feature-map/test/hook.test.mjs.

. "$(dirname "$0")/lib-hook.sh"
hook_read_input
[ -z "$HOOK_COMMAND" ] && exit 0

# A real `git push` / `gh pr create`, not a mention in a message, quote or heredoc.
text=$(executable_text "$HOOK_COMMAND")
if ! runs_git "$text" push && ! command_segments "$text" | grep -qE '^gh[[:space:]]+pr[[:space:]]+create([[:space:]]|$)'; then
  exit 0
fi

repo_root=$(git -C "$HOOK_CWD" rev-parse --show-toplevel 2>/dev/null) || exit 0
cli="$repo_root/.claude/skills/muuvie-feature-map/bin/feature-map-check"

# Only the meta-repo has the map; a session whose cwd is a submodule skips.
if [ ! -f "$cli" ] || ! command -v node >/dev/null 2>&1; then
  exit 0
fi

# A push or PR from inside another repo (a submodule, by any path) is that repo's business.
targets_other_repo "$HOOK_COMMAND" "$HOOK_CWD" "$repo_root" && exit 0

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
