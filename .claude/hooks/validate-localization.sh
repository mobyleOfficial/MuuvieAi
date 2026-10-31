#!/bin/bash
# .claude/hooks/validate-localization.sh
# Stop hook for implementer-tester (SubagentStop when declared in agent
# frontmatter). Enforces ARB key parity: every translatable key (not starting
# with @) in muuvie/ui/common/lib/l10n/app_en.arb must also exist in app_es.arb
# and app_pt.arb.
#
# Usage: .claude/hooks/validate-localization.sh   (no arguments)
# Paths resolve from the hook JSON's `cwd` (meta-repo root or anywhere inside
# it, including muuvie/). Exits 0 when stop_hook_active is set, so a block can
# never loop. Cheap: reads three JSON files, runs nothing else.

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

l10n_dir="$app/ui/common/lib/l10n"
en_arb="$l10n_dir/app_en.arb"
[ -f "$en_arb" ] || exit 0
command -v jq >/dev/null 2>&1 || { echo "Warning: jq not installed — skipping ARB parity check" >&2; exit 0; }

# Translatable keys of an ARB file, one per line; fails on invalid JSON.
arb_keys() {
  jq -r 'keys[] | select(startswith("@") | not)' "$1" 2>/dev/null | sort -u
  return "${PIPESTATUS[0]}"
}

en_keys=$(arb_keys "$en_arb") || {
  echo "Blocked: muuvie/ui/common/lib/l10n/app_en.arb is not valid JSON." >&2
  exit 2
}
[ -z "$en_keys" ] && exit 0

problems=""
for locale in es pt; do
  file="$l10n_dir/app_$locale.arb"
  name="app_$locale.arb"
  if [ ! -f "$file" ]; then
    problems="$problems
  muuvie/ui/common/lib/l10n/$name is missing."
    continue
  fi
  if ! keys=$(arb_keys "$file"); then
    problems="$problems
  $name is not valid JSON."
    continue
  fi
  missing=$(printf '%s\n' "$en_keys" | grep -vxF -f <(printf '%s\n' "$keys") || true)
  if [ -n "$missing" ]; then
    problems="$problems
  $name is missing:"
    while IFS= read -r key; do
      problems="$problems
    - $key"
    done <<< "$missing"
  fi
done

if [ -n "$problems" ]; then
  {
    echo "Blocked: ARB key parity broken — every key in app_en.arb must be translated in app_es.arb and app_pt.arb (muuvie/ui/common/lib/l10n/).$problems"
    echo "After adding the translations, run from muuvie/: flutter gen-l10n"
  } >&2
  exit 2
fi
exit 0
