#!/bin/bash
# .claude/hooks/verify-koin-di-registration.sh
# Stop hook for the backend-implementer agent (SubagentStop when declared in
# the agent's frontmatter). Checks that what the change touched in the backend
# submodule is wired into Koin (rules/backend/backend-architecture.md
# § Dependency Injection). "Registered" = the class name is used in a Koin
# module file (a main source defining `module { }`: di/AppModule.kt,
# data/di/DataModule.kt), directly or through an `import … as Alias`.
#
#   - every public concrete top-level class in domain/usecase/ (exceptions
#     aside) is registered — normally `factory { X(...) }` in appModule
#   - every class in data/{repository,local,remote,service}/ named *DataSource,
#     *Repository or *Impl, or implementing an org.mobyle.domain.repository
#     interface, is registered — normally `single<Iface> { X(...) }` in dataModule
#   - every `injection<T>()` / `inject<T>()` in routing/ and Main.kt names a
#     registered type
#   - every `val x = module { }` is installed (used outside its definition,
#     i.e. in `modules(...)` in Main.kt)
#
# Scope: the changed main-source files; all main sources when a module file or
# Main.kt changed, since a removed binding can break any injection point.
# "Changed" = .kt files changed in backend/: uncommitted (staged, unstaged,
# untracked) plus commits ahead of origin/dev. Nothing changed -> exit 0.
# BACKEND_HOOK_SCOPE=all judges every tracked + untracked .kt file instead.
#
# Exit 2 with the problems on stderr (fed back to the agent); exit 0 otherwise.
# Exits 0 when stop_hook_active is true, so a failing check cannot loop.
# bash 3.2 compatible; awk is the BSD/POSIX subset.

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

MAIN=src/main/kotlin/org/mobyle

# Koin module files: main sources that define a `module { }`.
MODULE_FILES=$(cd "$BACKEND" && grep -rlE '(^|[^A-Za-z0-9_])module[[:space:]]*\{' "$MAIN" --include='*.kt' 2>/dev/null | sort)
[ -z "$MODULE_FILES" ] && exit 0  # no Koin setup to check against
MODULE_FILES_NL="
$MODULE_FILES
"

# Registered names: every identifier used in a module body (comments and
# imports aside), plus the real class name behind `import a.b.Name as Alias`
# when Alias is used. One name per line.
REGISTERED=$(
  cd "$BACKEND" || exit 0
  idents=$(printf '%s\n' "$MODULE_FILES" | while IFS= read -r m; do
    grep -vE '^[[:space:]]*(import|package)[[:space:]]' "$m" | sed -E 's#//.*$##'
  done | grep -oE '[A-Za-z_][A-Za-z0-9_]*' | sort -u)
  printf '%s\n' "$idents"
  printf '%s\n' "$MODULE_FILES" | while IFS= read -r m; do
    grep -E '^[[:space:]]*import[[:space:]]+[A-Za-z0-9_.]+[[:space:]]+as[[:space:]]+[A-Za-z0-9_]+' "$m"
  done | sed -E 's/^[[:space:]]*import[[:space:]]+([A-Za-z0-9_.]+)[[:space:]]+as[[:space:]]+([A-Za-z0-9_]+).*/\1 \2/' |
    while read -r fqn alias; do
      printf '%s\n' "$idents" | grep -qxF "$alias" && printf '%s\n' "${fqn##*.}"
    done
)
REGISTERED_NL="
$REGISTERED
"
is_registered() {
  case $REGISTERED_NL in *"
$1
"*) return 0 ;; esac
  return 1
}

# Prints "<name>\t<line>\t<supertypes>" for each public, concrete, top-level
# class (`class X` / `public class X` at column 0; data, sealed, enum, open,
# abstract, private and internal classes are skipped). Supertypes are the
# simple names after the constructor's `:`, space-separated.
top_level_classes() {
  awk '
    function flush(   h, sup, n, parts, i, p) {
      if (name == "") return
      h = hdr
      while (gsub(/\([^()]*\)/, "", h)) ;
      while (gsub(/<[^<>]*>/, "", h)) ;
      sup = ""
      if (match(h, /class[ \t]+[A-Za-z0-9_]+[^:{]*:/)) {
        h = substr(h, RSTART + RLENGTH)
        sub(/[{].*$/, "", h)
        sub(/[ \t]where[ \t].*$/, "", h)
        n = split(h, parts, ",")
        for (i = 1; i <= n; i++) {
          p = parts[i]; sub(/[ \t]+by[ \t].*$/, "", p); gsub(/[ \t]/, "", p)
          sub(/^.*\./, "", p)
          if (p != "") sup = sup (sup == "" ? "" : " ") p
        }
      }
      printf "%s\t%d\t%s\n", name, line, sup
      name = ""
    }
    collecting {
      hdr = hdr " " $0
      if (index($0, "{") || $0 ~ /^[ \t]*$/ || ++taken > 30) { collecting = 0; flush() }
      next
    }
    /^(public[ \t]+)?(final[ \t]+)?class[ \t]+[A-Z]/ {
      name = $0; sub(/^(public[ \t]+)?(final[ \t]+)?class[ \t]+/, "", name); sub(/[^A-Za-z0-9_].*$/, "", name)
      line = NR; hdr = $0; taken = 0
      if (index($0, "{") || $0 !~ /[(:,][ \t]*$/ && $0 !~ /\([^)]*$/) flush(); else collecting = 1
    }
    END { if (collecting) flush() }
  ' "$1"
}

# Scope: the changed main files; every main file when a module file or
# Main.kt changed (a removed binding can break any injection point).
SCOPE=$(printf '%s\n' "$CHANGED" | grep -E "^$MAIN/" )
[ -z "$SCOPE" ] && exit 0
full=0
while IFS= read -r f; do
  [ "$f" = "$MAIN/Main.kt" ] && full=1
  printf '%s\n' "$MODULE_FILES" | grep -qxF "$f" && full=1
done <<< "$SCOPE"
[ $full = 1 ] && SCOPE=$(cd "$BACKEND" && find "$MAIN" -name '*.kt' -type f | sort)

errors=""
add_error() {
  errors="$errors
  - $1"
}

while IFS= read -r rel; do
  file="$BACKEND/$rel"
  layer=${rel#$MAIN/}

  # Use cases and data-layer implementations must be registered.
  case $layer in
    domain/usecase/*|data/repository/*|data/local/*|data/remote/*|data/service/*)
      classes=$(top_level_classes "$file")
      while IFS="$(printf '\t')" read -r name line supers; do
        [ -z "$name" ] && continue
        required=0; hint=""
        case $layer in
          domain/usecase/*)
            case " $supers " in
              *Exception\ *|*Throwable\ *|*Error\ *) ;;
              *) required=1; hint="add \`factory { $name(...) }\` to appModule (src/main/kotlin/org/mobyle/di/AppModule.kt)" ;;
            esac
            ;;
          *)
            iface=""
            case $name in
              *DataSource|*Repository|*Impl) required=1 ;;
              *)
                for s in $supers; do
                  if grep -qE "^[[:space:]]*import[[:space:]]+org\.mobyle\.domain\.repository\.$s([[:space:]]|$)" "$file"; then
                    iface=$s; required=1; break
                  fi
                done ;;
            esac
            if [ $required = 1 ]; then
              [ -z "$iface" ] && iface=$(printf '%s\n' "$supers" | awk '{print $1}')
              if [ -n "$iface" ]; then
                hint="add \`single<$iface> { $name(...) }\` to dataModule (src/main/kotlin/org/mobyle/data/di/DataModule.kt)"
              else
                hint="add \`single { $name(...) }\` to dataModule (src/main/kotlin/org/mobyle/data/di/DataModule.kt)"
              fi
            fi
            ;;
        esac
        if [ $required = 1 ] && ! is_registered "$name"; then
          add_error "backend/$rel:$line: \`$name\` is not registered in any Koin module; injecting it fails at runtime. Fix: $hint."
        fi
      done <<< "$classes"
      ;;
  esac

  # Injection points must resolve to a registered type.
  case $layer in
    routing/*|Main.kt)
      hits=$(grep -noE '(injection|inject)<[A-Za-z0-9_.]+>' "$file")
      while IFS= read -r hit; do
        [ -z "$hit" ] && continue
        type=$(printf '%s\n' "${hit#*:}" | sed -E 's/^[a-z]+<(.*)>$/\1/'); type=${type##*.}
        if ! is_registered "$type"; then
          add_error "backend/$rel:${hit%%:*}: injects \`$type\` but no Koin module provides it. Fix: register it (\`factory { $type(...) }\` in di/AppModule.kt for a use case, \`single<$type> { ... }\` in data/di/DataModule.kt for a data type)."
        fi
      done <<< "$hits"
      ;;
  esac

  # A new module must be installed.
  case $MODULE_FILES_NL in *"
$rel
"*) ;; *) continue ;; esac
  defs=$(grep -nE '^[[:space:]]*((private|internal)[[:space:]]+)?val[[:space:]]+[A-Za-z0-9_]+[[:space:]]*=[[:space:]]*module[[:space:]]*\{' "$file")
  while IFS= read -r def; do
    [ -z "$def" ] && continue
    mod=$(printf '%s\n' "${def#*:}" | sed -E 's/^[[:space:]]*((private|internal)[[:space:]]+)?val[[:space:]]+([A-Za-z0-9_]+).*/\3/')
    uses=$(cd "$BACKEND" && grep -rnwE "$mod" "$MAIN" --include='*.kt' | grep -vE "val[[:space:]]+$mod([^A-Za-z0-9_]|$)" | grep -vE ':[[:space:]]*import[[:space:]]')
    if [ -z "$uses" ]; then
      add_error "backend/$rel:${def%%:*}: Koin module \`$mod\` is never installed. Fix: add it to \`modules(...)\` in configureKoin() (src/main/kotlin/org/mobyle/Main.kt)."
    fi
  done <<< "$defs"
done <<< "$SCOPE"

if [ -n "$errors" ]; then
  printf 'Koin DI registration problems in the files you changed:%s\n\nFix them, then finish. Conventions: rules/backend/backend-architecture.md § Dependency Injection\n' "$errors" >&2
  exit 2
fi
exit 0
