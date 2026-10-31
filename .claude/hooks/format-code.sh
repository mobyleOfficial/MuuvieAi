#!/bin/bash
# .claude/hooks/format-code.sh
# Runs `dart format` on the file the agent just touched.
# Registered as a PostToolUse hook on Edit|Write in .claude/settings.json.
# Tests: .claude/tests/review-findings-2.test.mjs.
# Never blocks — formatting failure is reported as a warning only.

set -e

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

if [ -z "$file_path" ]; then
  exit 0
fi

case "$file_path" in
  *.dart) ;;
  *) exit 0 ;;
esac

# Skip generated files — `dart format` works on them but formatting them is wasteful
case "$file_path" in
  *.g.dart|*.gr.dart|*.freezed.dart|*.config.dart|*app_localizations*) exit 0 ;;
esac

if [ ! -f "$file_path" ]; then
  # File was deleted or doesn't exist — nothing to format
  exit 0
fi

if ! command -v dart >/dev/null 2>&1; then
  exit 0
fi

if ! dart format "$file_path" >/dev/null 2>&1; then
  echo "Warning: dart format failed on $file_path" >&2
fi

exit 0
