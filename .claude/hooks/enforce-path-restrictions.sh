#!/bin/bash
# .claude/hooks/enforce-path-restrictions.sh
# PreToolUse hook (matcher Edit|Write|MultiEdit|NotebookEdit) for the pipeline
# agents that write code. Rejects writes outside the agent's "Allowed Paths".
#
# Usage (agent frontmatter):
#   .claude/hooks/enforce-path-restrictions.sh implementer-tester
#   .claude/hooks/enforce-path-restrictions.sh backend-implementer
# Any other agent name (or none) is a no-op.
#
# The allowlists mirror the "Allowed Paths" section of .claude/agents/<agent>.md
# (pinned by .claude/tests/frontend-hooks.test.mjs). Paths are matched
# relative to the meta-repo root, found from the file's own directory: its git
# toplevel, then that repo's superproject while it is a submodule. Written for
# bash 3.2: `case` globs (where `*` crosses `/`), no globstar.

agent=${1:-}
case "$agent" in
  implementer-tester | backend-implementer) ;;
  *) exit 0 ;;
esac

deny() {
  echo "Blocked ($agent): $1" >&2
  exit 2
}

command -v jq >/dev/null 2>&1 || deny "jq is not installed, so the path restriction cannot be checked."

input=$(cat)
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' 2>/dev/null)
[ -z "$file_path" ] && exit 0

case "$file_path" in
  /*) ;;
  *)
    cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
    [ -d "$cwd" ] || cwd=$PWD
    file_path="$cwd/$file_path"
    ;;
esac

case "/$file_path/" in
  */../* | */./*) deny "$file_path is not a normalized path; use one without '.' or '..' segments." ;;
esac

# Physical path of the nearest existing ancestor, plus the part not yet created.
dir=$(dirname "$file_path")
rest=$(basename "$file_path")
while [ ! -d "$dir" ]; do
  rest="$(basename "$dir")/$rest"
  dir=$(dirname "$dir")
done
physical_dir=$(cd "$dir" 2>/dev/null && pwd -P) || deny "cannot resolve $file_path."
physical="${physical_dir%/}/$rest"

meta=$(git -C "$physical_dir" rev-parse --show-toplevel 2>/dev/null) ||
  deny "$file_path is outside the meta-repo; this agent may only write inside it."
while super=$(git -C "$meta" rev-parse --show-superproject-working-tree 2>/dev/null) && [ -n "$super" ]; do
  meta=$super
done

case "$physical" in
  "$meta"/*) rel=${physical#"$meta"/} ;;
  *) deny "$file_path is outside the meta-repo; this agent may only write inside it." ;;
esac

# Never writable, by any agent: secrets, env files, build output, tool caches.
case "$rel" in
  muuvie/secrets/* | .env | .env.* | */.env | */.env.* | */build/* | */.dart_tool/* | */.gradle/*)
    deny "$rel is a secret, env file or build output and may not be written." ;;
esac

if [ "$agent" = implementer-tester ]; then
  # Generated files: regenerate them, never hand-edit.
  case "$rel" in
    *.g.dart | *.gr.dart | *.config.dart | */app_localizations*.dart | */objectbox-model.json)
      deny "$rel is generated. Regenerate it (dart run build_runner build --delete-conflicting-outputs, or flutter gen-l10n) from muuvie/ instead of editing it." ;;
  esac
  case "$rel" in
    muuvie/features/* | muuvie/ui/* | muuvie/lib/* | muuvie/test/* | \
      muuvie/pubspec.yaml | muuvie/analysis_options.yaml | muuvie/l10n.yaml)
      exit 0 ;;
  esac
  deny "$rel is outside the allowed paths: muuvie/{features,ui,lib,test}/**, muuvie/pubspec.yaml, muuvie/analysis_options.yaml, muuvie/l10n.yaml (.claude/agents/implementer-tester.md)."
fi

# backend-implementer
case "$rel" in
  backend/src/main/kotlin/* | backend/src/test/kotlin/* | backend/build.gradle.kts)
    exit 0 ;;
esac
deny "$rel is outside the allowed paths: backend/src/main/kotlin/**, backend/src/test/kotlin/**, backend/build.gradle.kts (.claude/agents/backend-implementer.md)."
