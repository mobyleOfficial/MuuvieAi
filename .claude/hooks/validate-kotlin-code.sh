#!/bin/bash
# .claude/hooks/validate-kotlin-code.sh
# Stop hook for the backend-implementer agent (SubagentStop when declared in
# the agent's frontmatter). Judges the main-source Kotlin files the change
# touched in the backend submodule against rules/backend/backend-implementation.md:
#
#   - no Thread.sleep() inside a suspend function, nor anywhere in routing/
#     (route handlers are suspend lambdas)
#   - runBlocking only to bridge non-suspend code to suspend code: never inside
#     a suspend function, never in routing/. Use case invoke() bridges and
#     non-suspend data-layer methods (e.g. MaratonaCatalogImpl) are allowed.
#   - no Future / CompletableFuture / FutureTask: expose suspend funs
#   - no Koin imports in domain/ or data/ outside data/di/ (no service locator;
#     constructor injection only)
#
# Tests (src/test) are not judged: runBlocking { } test bodies are idiomatic.
# "Touched" = .kt files changed in backend/: uncommitted (staged, unstaged,
# untracked) plus commits ahead of origin/dev. Nothing touched -> exit 0.
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

# Scans one Kotlin file. Strings, char literals and comments are blanked first
# so that braces and keywords inside them do not count. A line is "inside a
# suspend function" from a `suspend fun` declaration through the end of its
# body (brace-delimited, or a single-line / `=`-continued expression body).
# Prints "<line>\t<message>" per problem.
scan_kotlin() {
  awk -v routing="$2" -v koin_banned="$3" '
    function sanitize(s,   out, i, n, c, j, k, d) {
      out = ""; n = length(s); i = 1
      while (i <= n) {
        if (inblock) {
          j = index(substr(s, i), "*/")
          if (j == 0) return out
          inblock = 0; i += j + 1; continue
        }
        if (inraw) {
          j = index(substr(s, i), "\"\"\"")
          if (j == 0) return out
          inraw = 0; i += j + 2; out = out "\"\""; continue
        }
        c = substr(s, i, 1)
        if (c == "/" && substr(s, i + 1, 1) == "/") return out
        if (c == "/" && substr(s, i + 1, 1) == "*") { inblock = 1; i += 2; continue }
        if (substr(s, i, 3) == "\"\"\"") { inraw = 1; i += 3; continue }
        if (c == "\"") {
          k = i + 1
          while (k <= n) {
            d = substr(s, k, 1)
            if (d == "\\") { k += 2; continue }
            if (d == "\"") break
            k++
          }
          out = out "\"\""; i = k + 1; continue
        }
        if (c == "\047") {
          k = i + 1
          if (substr(s, k, 1) == "\\") k += 2; else k += 1
          while (k <= n && substr(s, k, 1) != "\047" && k - i < 8) k++
          if (substr(s, k, 1) == "\047") { out = out "\047\047"; i = k + 1; continue }
        }
        out = out c; i++
      }
      return out
    }
    function report(msg) { printf "%d\t%s\n", NR, msg }
    {
      line = sanitize($0)
      if (line ~ /^[ \t]*import[ \t]/) {
        if (koin_banned && line ~ /^[ \t]*import[ \t]+org\.koin\./)
          report("imports Koin (" substr(line, index(line, "org.koin")) ") outside the DI modules. Use constructor injection and register the class in a Koin module instead (rules/backend/backend-implementation.md § Constructor Injection).")
        next
      }

      if (!active && !pending && line ~ /(^|[^A-Za-z0-9_])suspend([ \t]+(operator|inline|infix|override|open|final|abstract|tailrec|external|actual|expect|private|public|internal|protected))*[ \t]+fun([ \t]|$)/) {
        pending = 1; start = depth; parens = 0
      }
      in_suspend = active || pending
      n = length(line)
      for (i = 1; i <= n; i++) {
        c = substr(line, i, 1)
        if (c == "(") parens++
        else if (c == ")") parens--
        else if (c == "{") {
          depth++
          if (pending && parens <= 0) { pending = 0; active = 1 }
        } else if (c == "}") {
          depth--
          if (active && depth <= start) active = 0
        }
      }
      # A declaration with no body (interface member) or a one-line expression
      # body ends here unless its parameter list or `=` continues.
      if (pending && parens <= 0 && line !~ /=[ \t]*$/) pending = 0

      if (line ~ /(^|[^A-Za-z0-9_])Thread[ \t]*\.[ \t]*sleep[ \t]*\(/) {
        if (routing) report("Thread.sleep() in routing. Route handlers run as coroutines; use kotlinx.coroutines.delay() instead.")
        else if (in_suspend) report("Thread.sleep() inside a suspend function blocks the coroutine thread. Use kotlinx.coroutines.delay() instead.")
      }
      if (line ~ /(^|[^A-Za-z0-9_])runBlocking([ \t]*[({<]|[ \t]*$)/) {
        if (routing) report("runBlocking in routing. Route handlers already run in a coroutine; call the use case directly (rules/backend/backend-implementation.md § runBlocking Only for Bridging).")
        else if (in_suspend) report("runBlocking inside a suspend function. Call the suspend function directly; runBlocking is only for bridging non-suspend code (a use case invoke) to suspend code.")
      }
      if (line ~ /CompletableFuture|FutureTask|(^|[^A-Za-z0-9_])Future[ \t]*</)
        report("Future/CompletableFuture. Expose a suspend fun instead (bridge a Java future with kotlinx.coroutines.future.await()).")
    }
  ' "$1"
}

errors=""
while IFS= read -r rel; do
  case $rel in
    src/main/kotlin/*) ;;
    *) continue ;;  # tests may block (runBlocking { } test bodies are idiomatic)
  esac
  layer=${rel#src/main/kotlin/org/mobyle/}
  routing=0; koin_banned=0
  case $layer in
    routing/*) routing=1 ;;
    data/di/*) ;;
    domain/*|data/*) koin_banned=1 ;;
  esac
  hits=$(scan_kotlin "$BACKEND/$rel" "$routing" "$koin_banned")
  while IFS= read -r hit; do
    [ -z "$hit" ] && continue
    errors="$errors
  - backend/$rel:$(printf '%s' "$hit" | cut -f1): $(printf '%s' "$hit" | cut -f2-)"
  done <<< "$hits"
done <<< "$CHANGED"

if [ -n "$errors" ]; then
  printf 'Kotlin coroutine/DI problems in the files you changed:%s\n\nFix them, then finish. Conventions: rules/backend/backend-implementation.md\n' "$errors" >&2
  exit 2
fi
exit 0
