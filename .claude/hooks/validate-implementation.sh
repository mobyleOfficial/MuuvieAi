#!/bin/bash
# .claude/hooks/validate-implementation.sh
# Stop hook for implementer-tester (SubagentStop when declared in agent
# frontmatter). Leaves muuvie/ in a healthy state before the agent stops:
#   1. regenerate-generated-files.sh  (build_runner / gen-l10n as needed)
#   2. verify-di-registration.sh      (injection.config.dart present and fresh)
#   3. flutter analyze --no-fatal-infos --no-fatal-warnings  (errors block)
#   4. flutter test in every touched package that has a test/ dir, and in the
#      root package when lib/ or test/ changed or a touched package keeps its
#      tests in the root test/ (true of every muuvie package today)
# Steps 1-2 run here, in order, because Stop hooks declared side by side run
# in parallel; wire only this script, not those two as well.
#
# Usage: .claude/hooks/validate-implementation.sh   (no arguments)
# "Touched" = uncommitted files in muuvie/ (incl. every untracked file) plus
# commits ahead of origin/dev. Exits 0 without running anything when
# stop_hook_active is set, when nothing relevant changed, or when flutter is
# not on PATH. Blocks with exit 2 and the failing output.

input=$(cat)
[ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false' 2>/dev/null)" = true ] && exit 0
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
[ -d "$cwd" ] || cwd=$PWD
meta=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null) || exit 0
while super=$(git -C "$meta" rev-parse --show-superproject-working-tree 2>/dev/null) && [ -n "$super" ]; do
  meta=$super
done
app="$meta/muuvie"
[ -f "$app/pubspec.yaml" ] || exit 0

changed_files() {
  {
    git -C "$app" -c core.quotepath=off diff --name-only HEAD 2>/dev/null
    git -C "$app" -c core.quotepath=off ls-files --others --exclude-standard 2>/dev/null
    if git -C "$app" rev-parse -q --verify origin/dev >/dev/null 2>&1; then
      git -C "$app" -c core.quotepath=off diff --name-only origin/dev...HEAD 2>/dev/null
    fi
  } | sort -u
}
changed=$(changed_files | grep -E '^(lib|test|features|ui|core)/|^(pubspec\.yaml|analysis_options\.yaml|l10n\.yaml)$')
[ -z "$changed" ] && exit 0

if ! command -v flutter >/dev/null 2>&1; then
  echo "Warning: flutter not on PATH — skipping analyze/test validation" >&2
  exit 0
fi

hooks_dir=$(cd "$(dirname "$0")" && pwd)
for step in regenerate-generated-files.sh verify-di-registration.sh; do
  printf '%s' "$input" | /bin/bash "$hooks_dir/$step" || exit 2
done

log=$(mktemp)
trap 'rm -f "$log"' EXIT

if ! (cd "$app" && flutter analyze --no-fatal-infos --no-fatal-warnings) >"$log" 2>&1; then
  {
    echo "Blocked: flutter analyze reported errors in muuvie/:"
    if grep -qE '^[[:space:]]*error ' "$log"; then
      grep -E '^[[:space:]]*error ' "$log" | head -n 30
    else
      tail -n 30 "$log"
    fi
  } >&2
  exit 2
fi

# Owning package of each touched file (relative to muuvie/, "." = root).
packages=""
run_root=false
while IFS= read -r file; do
  case "$file" in
    lib/* | test/*) run_root=true; continue ;;
  esac
  dir=$(dirname "$file")
  while [ "$dir" != . ] && [ ! -f "$app/$dir/pubspec.yaml" ]; do
    dir=$(dirname "$dir")
  done
  if [ "$dir" = . ]; then
    run_root=true
  elif [ -d "$app/$dir/test" ]; then
    case "
$packages
" in
      *"
$dir
"*) ;;
      *) packages="$packages
$dir" ;;
    esac
  else
    run_root=true
  fi
done <<< "$changed"
[ "$run_root" = true ] && packages="$packages
."

failed=""
for pkg in $packages; do
  if ! (cd "$app/$pkg" && flutter test) >"$log" 2>&1; then
    failed="$failed muuvie/$pkg"
    {
      echo "flutter test failed in muuvie/$pkg:"
      tail -n 40 "$log"
    } >&2
  fi
done
if [ -n "$failed" ]; then
  echo "Blocked: flutter test failed in:$failed" >&2
  exit 2
fi

# Generated files are rebuilt by tooling; a tracked one in the diff is suspect.
hand_edited=$(printf '%s\n' "$changed" | grep -E '(\.g\.dart|\.gr\.dart|app_localizations.*\.dart|objectbox-model\.json)$')
if [ -n "$hand_edited" ]; then
  echo "Warning: generated files are in the diff — make sure they came from build_runner / flutter gen-l10n, not hand edits:" >&2
  printf '%s\n' "$hand_edited" >&2
fi
exit 0
