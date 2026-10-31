#!/bin/bash
# hooks/backend/validate-kotlin-code.sh
# Validates Kotlin code follows backend-implementation.md patterns.
# Checks for common mistakes: blocking coroutines, Result wrappers, wrong DI patterns.
# Define this as a Stop hook in the backend-implementer agent's frontmatter.

set -e

input=$(cat)

# Check if we're in backend directory
if ! grep -q "backend" <<< "$(pwd)"; then
  exit 0
fi

file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")

if [ -z "$file_path" ] || [[ ! "$file_path" =~ \.kt$ ]]; then
  exit 0
fi

errors=""
warnings=""

# ===== ERROR CHECKS (block) =====

# Check for Thread.sleep() in suspend functions
if grep -q "Thread.sleep" "$file_path"; then
  if grep -B5 "Thread.sleep" "$file_path" | grep -q "suspend fun"; then
    errors="$errors\nDO NOT use Thread.sleep() in suspend functions — use delay() or restructure"
  fi
fi

# Check for runBlocking outside of usecase bridge
if grep -q "runBlocking" "$file_path"; then
  if ! [[ "$file_path" =~ domain/usecase/ ]]; then
    errors="$errors\nrunBlocking should only appear in usecases (bridging suspend to non-suspend)"
  fi
fi

# Check for Result<T> wrapper in suspend functions (Dart pattern, not Kotlin)
if grep -q "Result<" "$file_path" && grep -q "suspend fun" "$file_path"; then
  errors="$errors\nDO NOT wrap suspend functions in Result<T> — let exceptions bubble up naturally"
fi

# Check for CompletableFuture/Future in Kotlin code (should use suspend fun)
if grep -qE "CompletableFuture|Future<.*>" "$file_path" && [[ ! "$file_path" =~ test ]]; then
  errors="$errors\nUse suspend fun instead of Future/CompletableFuture in Kotlin"
fi

# ===== WARNING CHECKS (inform) =====

# Check for var (prefer val)
var_count=$(grep -c "var " "$file_path" || echo "0")
if [ "$var_count" -gt 3 ]; then
  warnings="$warnings\n  - Many mutable variables (${var_count}) - prefer val where possible"
fi

# Check for callback style (function with lambda parameter, not suspend)
if grep -qE "fun [a-zA-Z]+\(.*: \(.*\) -> " "$file_path" && [[ ! "$file_path" =~ test ]]; then
  warnings="$warnings\n  - Callback-style function detected - consider using suspend fun instead"
fi

# Check for String concatenation in URLs
if grep -qE '\$\{.*\}.*http|"http.*\$' "$file_path"; then
  warnings="$warnings\n  - URL string concatenation - consider using path parameters or constants"
fi

# Check for magic numbers (no explanation for version numbers, timeouts, etc.)
if grep -qE "= [0-9]{4,}" "$file_path" && [[ ! "$file_path" =~ test ]]; then
  warnings="$warnings\n  - Magic number detected - extract to named constant (e.g., const val TIMEOUT_MS)"
fi

# Check for single-letter variable names (except in loops)
single_letter=$(grep -oE '\b[a-z]\s*=' "$file_path" | grep -v "i =" | grep -v "j =" | wc -l || echo "0")
if [ "$single_letter" -gt 0 ]; then
  warnings="$warnings\n  - Single-letter variables found - use descriptive names (e.g., movieId not m)"
fi

# ===== OUTPUT =====

if [ -n "$errors" ]; then
  echo -e "❌ Kotlin Code Issues:$errors" >&2
  exit 1
fi

if [ -n "$warnings" ]; then
  echo -e "⚠️  Kotlin Code Suggestions:$warnings" >&2
fi

exit 0
