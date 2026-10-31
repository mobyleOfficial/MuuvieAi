#!/bin/bash
# .claude/hooks/validate-module-structure.sh
# Stop hook for implementer-tester (SubagentStop when declared in agent
# frontmatter). Checks the structure of the modules the change touched, per
# rules/frontend/feature-architecture.md and ui-architecture.md:
#   - every touched feature features/<f>/ keeps its packages and barrels:
#     pubspec.yaml, lib/<f>.dart, domain/{pubspec.yaml,lib/domain.dart},
#     data/{pubspec.yaml,lib/data.dart}  (directories that may legitimately be
#     empty are not required — git does not track them)
#   - every UI page set with a newly added file (<x>_state / _bloc|_cubit /
#     _page / _screen .dart) has all four files side by side; legacy page sets
#     that are only modified are left alone
#   - a newly added UI module ui/<m>/ has pubspec.yaml, a barrel lib/<m>.dart
#     (or lib/<package name>.dart), and no `_ui` folder suffix
#   - touched .dart filenames are snake_case
#
# Usage: .claude/hooks/validate-module-structure.sh   (no arguments)
# "Touched" = uncommitted files in muuvie/ (incl. every untracked file) plus
# commits ahead of origin/dev; "added" = new in that set. Exits 0 when
# stop_hook_active is set or nothing changed. Runs only git and file tests.

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

# changed_files [<diff-filter>]: uncommitted (incl. every untracked file) +
# commits ahead of origin/dev, optionally filtered (A = added).
changed_files() {
  local filter=${1:+--diff-filter=$1}
  {
    git -C "$app" -c core.quotepath=off diff --name-only $filter HEAD 2>/dev/null
    git -C "$app" -c core.quotepath=off ls-files --others --exclude-standard 2>/dev/null
    if git -C "$app" rev-parse -q --verify origin/dev >/dev/null 2>&1; then
      git -C "$app" -c core.quotepath=off diff --name-only $filter origin/dev...HEAD 2>/dev/null
    fi
  } | sort -u
}
changed=$(changed_files)
[ -z "$changed" ] && exit 0
added=$(changed_files A)

errors=""
err() {
  errors="$errors
  - $1"
}

# Features touched.
for feature in $(printf '%s\n' "$changed" | sed -n -E 's#^features/([^/]+)/.*#\1#p' | sort -u); do
  dir="features/$feature"
  [ -d "$app/$dir" ] || continue
  for required in pubspec.yaml "lib/$feature.dart" domain/pubspec.yaml domain/lib/domain.dart data/pubspec.yaml data/lib/data.dart; do
    [ -f "$app/$dir/$required" ] || err "$dir is missing $required"
  done
done

# UI page sets with a new file.
for set in $(printf '%s\n' "$added" | sed -n -E 's#^(ui/[^/]+/lib/(.*/)?[[:lower:][:digit:]_]+)_(state|bloc|cubit|page|screen)\.dart$#\1#p' | sort -u); do
  [ -d "$app/$(dirname "$set")" ] || continue
  base=$(basename "$set")
  for part in state page screen; do
    [ -f "$app/${set}_$part.dart" ] || err "$(dirname "$set")/ is missing ${base}_$part.dart (UI modules are state + bloc + page + screen)"
  done
  [ -f "$app/${set}_bloc.dart" ] || [ -f "$app/${set}_cubit.dart" ] ||
    err "$(dirname "$set")/ is missing ${base}_bloc.dart (UI modules are state + bloc + page + screen)"
done

# New UI modules.
for module in $(printf '%s\n' "$added" | sed -n -E 's#^ui/([^/]+)/pubspec\.yaml$#\1#p'); do
  dir="ui/$module"
  [ -f "$app/$dir/pubspec.yaml" ] || continue
  package=$(sed -n -E 's/^name:[[:space:]]*([A-Za-z0-9_]+).*/\1/p' "$app/$dir/pubspec.yaml" | head -n 1)
  [ -f "$app/$dir/lib/$module.dart" ] || [ -f "$app/$dir/lib/$package.dart" ] ||
    err "$dir is missing its barrel lib/$module.dart"
  case "$module" in
    *_ui) err "$dir: UI folders take no _ui suffix (the package name may)" ;;
  esac
done

# snake_case filenames.
while IFS= read -r file; do
  case "$file" in
    *.dart) ;;
    *) continue ;;
  esac
  [ -f "$app/$file" ] || continue
  case "$(basename "$file")" in
    *[[:upper:]-]*) err "$file: Dart filenames must be snake_case" ;;
  esac
done <<< "$changed"

if [ -n "$errors" ]; then
  {
    echo "Blocked: module structure in muuvie/ does not match rules/frontend/feature-architecture.md and ui-architecture.md:$errors"
    echo "Scaffold modules with /new-datasource, /new-repository, /new-usecase, /new-ui-module."
  } >&2
  exit 2
fi
exit 0
