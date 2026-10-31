#!/bin/bash
# .claude/hooks/block-cross-feature-data-imports.sh
# PreToolUse hook (matcher Edit|Write|MultiEdit) for implementer-tester.
# Blocks Dart code that reaches into another feature's data layer.
# rules/frontend/feature-architecture.md: "Never import from another feature's
# data/ layer directly — use the domain/ layer as the contract boundary."
#
# Checks the text being written: Write `content`, Edit `new_string`, and every
# MultiEdit `edits[].new_string`. Flags, in any .dart file:
#   - an import or export of package:<x>_data/... unless the file belongs to
#     <x>'s own data package (features/<x>/data/), its barrel
#     (features/<x>/lib/), its tests (test/features/<x>/), or the app's DI
#     composition root (lib/di/);
#   - inside features/<owner>/, an import of another feature's barrel
#     package:<x>/..., because the barrel re-exports <x>_data too.
# The fix in both cases is package:<x>_domain/domain.dart.

input=$(cat)
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
content=$(printf '%s' "$input" | jq -r '[.tool_input.content, .tool_input.new_string, (.tool_input.edits // [] | .[].new_string)] | map(select(. != null)) | join("\n")' 2>/dev/null)

[ -z "$file_path" ] || [ -z "$content" ] && exit 0
case "$file_path" in
  *.dart) ;;
  *) exit 0 ;;
esac

# Path inside the Flutter app (strip everything up to the last /muuvie/).
case "$file_path" in
  */muuvie/*) app_rel=${file_path##*/muuvie/} ;;
  *) app_rel=$file_path ;;
esac
features_dir=${file_path%"$app_rel"}features

owner=""
case "$app_rel" in
  features/*) owner=${app_rel#features/}; owner=${owner%%/*} ;;
esac

imports=$(printf '%s\n' "$content" | grep -oE "^[[:space:]]*(import|export)[[:space:]]+['\"]package:[a-zA-Z0-9_]+/" |
  sed -E "s/.*package:([a-zA-Z0-9_]+)\/.*/\1/" | sort -u)
[ -z "$imports" ] && exit 0

violations=""
for pkg in $imports; do
  case "$pkg" in
    *_data)
      feature=${pkg%_data}
      case "$app_rel" in
        features/"$feature"/data/* | features/"$feature"/lib/* | test/features/"$feature"/* | lib/di/*) continue ;;
      esac
      violations="$violations
  - imports package:${pkg}/... — depend on package:${feature}_domain/domain.dart instead."
      ;;
    *)
      # Another feature's barrel, imported from inside a feature package.
      if [ -n "$owner" ] && [ "$pkg" != "$owner" ] && [ -f "$features_dir/$pkg/pubspec.yaml" ] &&
        grep -qE "^name:[[:space:]]*$pkg[[:space:]]*\$" "$features_dir/$pkg/pubspec.yaml"; then
        violations="$violations
  - imports package:${pkg}/..., the feature barrel, which re-exports ${pkg}_data — depend on package:${pkg}_domain/domain.dart instead."
      fi
      ;;
  esac
done

if [ -n "$violations" ]; then
  {
    echo "Blocked: $app_rel reaches into another feature's data layer.$violations"
    echo "Rule (rules/frontend/feature-architecture.md): features/<x>/data/ is private; cross-feature contracts go through features/<x>/domain/."
  } >&2
  exit 2
fi
exit 0
