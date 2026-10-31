#!/bin/bash
# .claude/hooks/regenerate-generated-files.sh
# Stop hook for implementer-tester (SubagentStop when declared in agent
# frontmatter). Regenerates code-gen outputs the change set needs:
#   - a changed .dart file with @RoutePage / @AutoRouterConfig / DI annotations
#     / @Entity / @JsonSerializable / `part '*.g.dart'`  -> build_runner in its
#     package (when that pubspec uses build_runner)
#   - DI annotations, or lib/di/injection.config.dart missing -> build_runner in
#     the muuvie/ root package (owner of injection.config.dart)
#   - a changed ARB file under ui/common/lib/l10n/ -> flutter gen-l10n in muuvie/
# A failing generator blocks (exit 2) with the tail of its output.
#
# Usage: .claude/hooks/regenerate-generated-files.sh   (no arguments)
# validate-implementation.sh runs it first, so wire it on its own only if
# validate-implementation.sh is not wired (Stop hooks run in parallel).
# Exits 0 without running anything when stop_hook_active is set, when nothing
# changed in muuvie/ (uncommitted incl. untracked, or commits ahead of
# origin/dev), or when dart/flutter are not on PATH.

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
changed=$(changed_files)
[ -z "$changed" ] && exit 0

if ! command -v dart >/dev/null 2>&1 || ! command -v flutter >/dev/null 2>&1; then
  echo "Warning: dart/flutter not on PATH — skipping code generation" >&2
  exit 0
fi

DI_RE='@(module|injectable|lazySingleton|singleton|Injectable|LazySingleton|Singleton)([^A-Za-z0-9_]|$)'
CODEGEN_RE="@(RoutePage|AutoRouterConfig|Entity|JsonSerializable|module|injectable|lazySingleton|singleton|Injectable|LazySingleton|Singleton)([^A-Za-z0-9_]|\$)|^part ['\"][^'\"]+\\.(g|gr)\\.dart['\"]"

packages=""   # newline-separated package dirs relative to muuvie/ ("." = root)
add_package() {
  case "
$packages
" in
    *"
$1
"*) ;;
    *) packages="$packages
$1" ;;
  esac
}

regen_l10n=false
while IFS= read -r file; do
  [ -f "$app/$file" ] || continue
  case "$file" in
    ui/common/lib/l10n/*.arb) regen_l10n=true; continue ;;
    *.g.dart | *.gr.dart | *.config.dart | */app_localizations*.dart) continue ;;
    *.dart) ;;
    *) continue ;;
  esac
  grep -qE "$CODEGEN_RE" "$app/$file" || continue
  dir=$(dirname "$file")
  while [ "$dir" != . ] && [ ! -f "$app/$dir/pubspec.yaml" ]; do
    dir=$(dirname "$dir")
  done
  grep -q build_runner "$app/$dir/pubspec.yaml" 2>/dev/null && add_package "$dir"
  grep -qE "$DI_RE" "$app/$file" && add_package .
done <<< "$changed"

if [ ! -f "$app/lib/di/injection.config.dart" ] &&
  grep -rqE --include='*.dart' --exclude-dir=.dart_tool --exclude-dir=build "$DI_RE" "$app/lib" "$app/features" 2>/dev/null; then
  add_package .
fi

failed=0
log=$(mktemp)
trap 'rm -f "$log"' EXIT

# run <label> <dir> <command...>: runs in muuvie/<dir>, reports failures.
run() {
  local label=$1 dir=$2 status
  shift 2
  echo "Regenerating: $label in muuvie/$dir"
  (cd "$app/$dir" && "$@") >"$log" 2>&1
  status=$?
  if [ "$status" -ne 0 ]; then
    failed=1
    {
      echo "Blocked: $label failed in muuvie/$dir (exit $status). Fix the cause and rerun it there:"
      echo "  cd muuvie/$dir && $*"
      tail -n 30 "$log"
    } >&2
  fi
}

# Feature/UI packages first, the root package (injection.config.dart) last.
for pkg in $(printf '%s\n' "$packages" | grep -v '^\.\{0,1\}$' | sort) $(printf '%s\n' "$packages" | grep -x '\.'); do
  run build_runner "$pkg" dart run build_runner build --delete-conflicting-outputs
done
[ "$regen_l10n" = true ] && run gen-l10n . flutter gen-l10n

[ "$failed" -eq 0 ] || exit 2
exit 0
