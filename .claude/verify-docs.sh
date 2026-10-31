#!/bin/bash
# Verifies README.md and CLAUDE.md are updated when relevant code changes
# Triggered before PR creation to catch out-of-sync documentation.
#
# Base branch convention (matches CLAUDE.md; the integration branch is `dev`,
# with `develop` accepted for older clones):
#   feature/* | fix/*  -> dev
#   release/*          -> main
#   dev | develop      -> main (release PR)
#   anything else      -> dev (default)

set -euo pipefail

# Determine target base branch from current HEAD
current_branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
case "$current_branch" in
  release/*|dev|develop|main) base_ref="main" ;;
  *)                          base_ref="dev" ;;
esac

# Resolve a usable ref: prefer local, fall back to origin/, then bail out
resolved_base=""
candidates=("$base_ref" "origin/$base_ref")
[ "$base_ref" = "dev" ] && candidates+=("develop" "origin/develop")
for candidate in "${candidates[@]}"; do
  if git rev-parse --verify --quiet "$candidate" >/dev/null; then
    resolved_base="$candidate"
    break
  fi
done

if [ -z "$resolved_base" ]; then
  # No merge base available (fresh clone / orphan branch). Don't gate.
  echo "verify-docs: no base ref for '$base_ref' — skipping doc-sync check."
  exit 0
fi

# Diff this branch against its base. Use merge-base form so commits already on
# base don't get re-flagged.
CHANGED_FILES=$(git diff --name-only "${resolved_base}...HEAD" 2>/dev/null || echo "")

if [ -z "$CHANGED_FILES" ]; then
  echo "No changes detected. Documentation check skipped."
  exit 0
fi

VIOLATIONS=0
DOCS_MODIFIED=0

# Check if any documentation file was modified. Per rules/DOCS_UP_TO_DATE.md
# a doc update can land in README/CLAUDE.md (root or subdir), an agent spec
# (agents/*.md), a rule definition (rules/*.md), a skill (.claude/skills/),
# a hook README, or the audit/research docs (research/*.md). Any .md change
# under those paths satisfies the rule — the underlying intent is that human-
# readable behavior documentation stays in sync with code.
if echo "$CHANGED_FILES" | grep -qE '(^|/)(README|CLAUDE)\.md$|^agents/.*\.md$|^rules/.*\.md$|^\.claude/.*\.md$|^research/.*\.md$|^commands/.*\.md$'; then
  DOCS_MODIFIED=1
fi

# Patterns that should trigger doc updates
CRITICAL_CHANGES=(
  "^\.claude/"                          # Claude config + skills + hooks
  "^plugins/"                           # Plugin changes
  "^agents/"                            # Agents changes
  "^rules/"                             # Rules changes
  "^muuvie/" "^backend/"                # Submodule structure changes
)

HAS_CRITICAL_CHANGE=0
for pattern in "${CRITICAL_CHANGES[@]}"; do
  if echo "$CHANGED_FILES" | grep -qE "$pattern"; then
    HAS_CRITICAL_CHANGE=1
    break
  fi
done

# Check for setup/dependency changes
if echo "$CHANGED_FILES" | grep -qE "(package\.json|gradle|pubspec\.yaml|Gemfile|\.env|docker)"; then
  HAS_CRITICAL_CHANGE=1
fi

if [ "$HAS_CRITICAL_CHANGE" -eq 1 ] && [ "$DOCS_MODIFIED" -eq 0 ]; then
  echo "⚠️  Documentation out of sync"
  echo ""
  echo "Critical files changed:"
  echo "$CHANGED_FILES" | grep -E "^\.claude/|^plugins/|^agents/|^rules/|^muuvie/|^backend/|package\.json|gradle|pubspec\.yaml|Gemfile|\.env|docker" | sed 's/^/  - /'
  echo ""
  echo "README.md and/or CLAUDE.md should be updated."
  echo "Update docs before opening PR to keep team in sync."
  exit 1
fi

exit 0
