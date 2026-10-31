#!/bin/bash
# .claude/hooks/validate-backend-structure.sh
# Stop hook for the backend-implementer agent (SubagentStop when declared in
# the agent's frontmatter). Judges the Kotlin files the change touched in the
# backend submodule against rules/backend/backend-architecture.md:
#
#   - Kotlin sources live under src/{main,test}/kotlin/org/mobyle/
#   - the `package` declaration matches the directory
#   - file names are PascalCase.kt
#   - main sources sit in a known layer: Main.kt, routing/, di/, model/,
#     domain/{model,repository,policy}/, domain/usecase/<feature>/,
#     data/{repository,local,remote,service,di}/
#   - domain/ imports nothing from data/, routing/, di/, Ktor or Exposed;
#     data/ imports nothing from routing/
#
# "Touched" = .kt files changed in backend/: uncommitted (staged, unstaged,
# untracked) plus commits ahead of origin/dev. Nothing touched -> exit 0.
# BACKEND_HOOK_SCOPE=all judges every tracked + untracked .kt file instead
# (used by the tests to prove the rules hold on the current codebase).
#
# Exit 2 with the problems on stderr (fed back to the agent); exit 0 otherwise.
# Exits 0 when stop_hook_active is true, so a failing check cannot loop.
# bash 3.2 compatible.

. "$(dirname "$0")/lib-hook.sh"

# --- shared backend-hook preamble (kept identical across the three backend hooks) ---
hook_read_input
[ "$(printf '%s' "$HOOK_INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)" = true ] && exit 0

# Resolves <meta>/backend from the session cwd (meta root, backend/ or any
# other submodule). Sets BACKEND or exits 0 when there is no backend checkout.
resolve_backend() {
  local top super meta real
  top=$(git -C "$HOOK_CWD" rev-parse --show-toplevel 2>/dev/null) || exit 0
  super=$(git -C "$top" rev-parse --show-superproject-working-tree 2>/dev/null)
  meta=${super:-$top}
  if [ ! -d "$meta/backend" ] && [ "$(basename "$top")" = backend ]; then
    meta=$(dirname "$top")
  fi
  [ -d "$meta/backend" ] || exit 0
  BACKEND=$(cd "$meta/backend" && pwd -P)
  # An uninitialised submodule is an empty directory inside the meta repo.
  real=$(git -C "$BACKEND" rev-parse --show-toplevel 2>/dev/null)
  [ "$real" = "$BACKEND" ] || exit 0
}

# Prints the .kt files (relative to backend/) the change touched.
bgit() { git -c core.quotepath=off -C "$BACKEND" "$@"; }
changed_kt_files() {
  if [ "${BACKEND_HOOK_SCOPE:-}" = all ]; then
    bgit ls-files --cached --others --exclude-standard -- '*.kt' 2>/dev/null
  else
    {
      bgit diff --name-only --diff-filter=d -- '*.kt' 2>/dev/null
      bgit diff --name-only --diff-filter=d --cached -- '*.kt' 2>/dev/null
      bgit ls-files --others --exclude-standard -- '*.kt' 2>/dev/null
      if bgit rev-parse -q --verify origin/dev >/dev/null 2>&1; then
        bgit diff --name-only --diff-filter=d origin/dev...HEAD -- '*.kt' 2>/dev/null
      fi
    }
  fi | sort -u | while IFS= read -r f; do
    [ -f "$BACKEND/$f" ] && printf '%s\n' "$f"
  done
}

resolve_backend
CHANGED=$(changed_kt_files)
[ -z "$CHANGED" ] && exit 0
# --- end preamble ---

errors=""
add_error() {
  errors="$errors
  - $1"
}

while IFS= read -r rel; do
  file="$BACKEND/$rel"
  case $rel in
    src/main/kotlin/*) tree=main; sub=${rel#src/main/kotlin/} ;;
    src/test/kotlin/*) tree=test; sub=${rel#src/test/kotlin/} ;;
    src/*)
      add_error "backend/$rel: Kotlin sources belong under src/main/kotlin/org/mobyle/ (tests under src/test/kotlin/org/mobyle/). Move the file."
      continue ;;
    *) continue ;;  # build scripts and other non-source Kotlin
  esac

  case $sub in
    org/mobyle/*) ;;
    *)
      add_error "backend/$rel: outside the org.mobyle package root. Move it under src/$tree/kotlin/org/mobyle/."
      continue ;;
  esac

  name=${sub##*/}
  if ! [[ $name =~ ^[A-Z][A-Za-z0-9]*\.kt$ ]]; then
    add_error "backend/$rel: file name must be PascalCase.kt (e.g. GetTrendingMovies.kt, MoviesRouting.kt). Rename it."
  fi

  dir=${sub%/*}
  expected=${dir//\//.}
  pkg_line=$(grep -n -m1 -E '^[[:space:]]*package[[:space:]]' "$file")
  if [ -z "$pkg_line" ]; then
    add_error "backend/$rel:1: no package declaration. Add \`package $expected\`."
  else
    lineno=${pkg_line%%:*}
    pkg=${pkg_line#*:}
    pkg=${pkg#"${pkg%%package*}"}; pkg=${pkg#package}
    pkg=$(printf '%s' "$pkg" | tr -d ' \t;\r')
    if [ "$pkg" != "$expected" ]; then
      add_error "backend/$rel:$lineno: declares \`package $pkg\` but lives in $dir/. Change it to \`package $expected\` or move the file to match the package."
    fi
  fi

  [ "$tree" = main ] || continue
  layer=${sub#org/mobyle/}

  case $layer in
    Main.kt|routing/*|di/*|model/*|domain/model/*|domain/repository/*|domain/policy/*|domain/usecase/*/*|data/repository/*|data/local/*|data/remote/*|data/service/*|data/di/*) ;;
    domain/usecase/*)
      add_error "backend/$rel: use cases go in a feature sub-package, domain/usecase/<feature>/ (e.g. domain/usecase/movies/). Move it and update the package." ;;
    *)
      add_error "backend/$rel: not in a known layer. Use routing/, di/, model/, domain/{model,repository,usecase/<feature>,policy}/ or data/{repository,local,remote,service,di}/ (rules/backend/backend-architecture.md § Module Layout)." ;;
  esac

  case $layer in
    domain/*)
      bad=$(grep -n -E '^[[:space:]]*import[[:space:]]+(org\.mobyle\.(data|routing|di)\.|io\.ktor\.|org\.jetbrains\.exposed\.)' "$file")
      while IFS= read -r hit; do
        [ -z "$hit" ] && continue
        what=$(printf '%s\n' "${hit#*:}" | sed -E 's/^[[:space:]]*import[[:space:]]+//')
        add_error "backend/$rel:${hit%%:*}: the domain layer must not depend on \`$what\`. Depend on a domain/repository interface (implemented in data/) or a domain/model type instead."
      done <<< "$bad"
      ;;
    data/*)
      bad=$(grep -n -E '^[[:space:]]*import[[:space:]]+org\.mobyle\.routing\.' "$file")
      while IFS= read -r hit; do
        [ -z "$hit" ] && continue
        what=$(printf '%s\n' "${hit#*:}" | sed -E 's/^[[:space:]]*import[[:space:]]+//')
        add_error "backend/$rel:${hit%%:*}: the data layer must not depend on routing (\`$what\`). Move the shared type to domain/model/ or model/."
      done <<< "$bad"
      ;;
  esac
done <<< "$CHANGED"

if [ -n "$errors" ]; then
  printf 'Backend structure problems in the files you changed:%s\n\nFix them, then finish. Conventions: rules/backend/backend-architecture.md\n' "$errors" >&2
  exit 2
fi
exit 0
