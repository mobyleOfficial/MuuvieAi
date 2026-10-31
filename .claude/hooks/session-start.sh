#!/bin/bash
# .claude/hooks/session-start.sh
# Emits a brief summary at session start: rules, skills, MCP servers.
# Register as SessionStart hook in .claude/settings.json.
# Keep output short — every session opens with this.

set -eu

# Locate repo root so the hook works regardless of the session's cwd.
repo_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

# Defensive: bail silently if this looks like the wrong repo.
[ -f "$repo_root/.mcp.json" ] || exit 0
[ -f "$repo_root/CLAUDE.md" ] || exit 0

shopt -s nullglob
# Rules live one level down, under rules/{common,frontend,backend}/. Glob both
# levels so a rule added at either depth is counted.
rule_files=("$repo_root"/rules/*.md "$repo_root"/rules/*/*.md)
skill_dirs=("$repo_root"/.claude/skills/*/)
command_files=("$repo_root"/.claude/commands/*.md)
shopt -u nullglob

# Filter out README.md (directory readme, not a rule). Iterate without :-
# default expansion, which would otherwise inject an empty entry on an empty
# array and produce off-by-one counts + a leading bare comma in output.
# Tally per category so the summary stays one line as the rule set grows.
# One counter per category: macOS /bin/bash is 3.2, which has no associative arrays.
n_common=0 n_frontend=0 n_backend=0 n_uncategorized=0
filtered_rules=()
for f in "${rule_files[@]}"; do
  name=$(basename "$f" .md)
  [ "$name" = "README" ] && continue
  filtered_rules+=("$name")
  cat=$(basename "$(dirname "$f")")
  case "$cat" in
    common) n_common=$((n_common + 1)) ;;
    frontend) n_frontend=$((n_frontend + 1)) ;;
    backend) n_backend=$((n_backend + 1)) ;;
    *) n_uncategorized=$((n_uncategorized + 1)) ;;
  esac
done

rule_count=${#filtered_rules[@]}
skill_count=${#skill_dirs[@]}
command_count=${#command_files[@]}

mcp_count=0
if command -v jq >/dev/null 2>&1; then
  mcp_count=$(jq -r '.mcpServers | length' "$repo_root/.mcp.json" 2>/dev/null || echo 0)
fi

# Summarize rules by category rather than listing all 15+ names, so the banner
# stays to one line per resource type.
rule_names=""
for cat in common frontend backend uncategorized; do
  case "$cat" in common) n=$n_common ;; frontend) n=$n_frontend ;; backend) n=$n_backend ;; *) n=$n_uncategorized ;; esac
  [ "$n" -eq 0 ] && continue
  rule_names="${rule_names:+$rule_names, }${n} ${cat}"
done

skill_names=""
for d in "${skill_dirs[@]}"; do
  name=$(basename "$d")
  skill_names="${skill_names:+$skill_names, }$name"
done

echo "MuuvieAi session — ${rule_count} rules, ${skill_count} skills, ${command_count} commands, ${mcp_count} MCP servers loaded."
[ -n "$rule_names" ] && echo "  Rules: $rule_names"
[ -n "$skill_names" ] && echo "  Skills: $skill_names"

exit 0
