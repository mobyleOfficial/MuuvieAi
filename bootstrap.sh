#!/usr/bin/env bash
# bootstrap.sh
# Sets up the MuuvieAi meta-repo for a fresh clone:
#   1. Initialize git submodules (muuvie + backend)
#   2. Install root npm deps (linear-mcp)
#   3. Install + build the repo-management MCP plugin
#   4. Make every .claude/**/*.sh shell script executable
#   5. Seed .claude/settings.local.json from the template if missing
#   6. Seed .claude/task/pipeline-queue.json from the template if missing
#
# Re-runnable: each step is idempotent.

set -euo pipefail

# Resolve repo root regardless of cwd
repo_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$repo_root"

log() {
  printf '\n→ %s\n' "$*"
}

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'ERROR: required command not found: %s\n' "$1" >&2
    exit 1
  fi
}

require git
require npm
require jq
require gh    # used by the repo-management MCP plugin's open-pull-request tool

# --- 1. Submodules ------------------------------------------------------------

log "Initializing submodules (muuvie, backend)..."
git submodule update --init --recursive

# --- 2. Root npm deps ---------------------------------------------------------

if [ -f package.json ]; then
  log "Installing root npm dependencies..."
  if [ -f package-lock.json ]; then
    npm ci --silent
  else
    npm install --silent
  fi
fi

# --- 3. Plugin deps + build ---------------------------------------------------

if [ -d plugins/repo-management ]; then
  log "Building repo-management MCP plugin..."
  (
    cd plugins/repo-management
    if [ -f package.json ]; then
      if [ -f package-lock.json ]; then
        npm ci --silent
      else
        npm install --silent
      fi
    fi
    if [ -f package.json ] && jq -e '.scripts.build' package.json >/dev/null 2>&1; then
      npm run build --silent
    fi
  )
fi

# --- 4. Shell-script executability --------------------------------------------

if [ -d .claude ]; then
  log "Marking .claude/**/*.sh executable..."
  find .claude -type f -name '*.sh' -exec chmod +x {} + 2>/dev/null || true
fi

# --- 5. settings.local.json ---------------------------------------------------

if [ ! -f .claude/settings.local.json ]; then
  if [ -f .claude/settings.local.template.json ]; then
    log "Seeding .claude/settings.local.json from template..."
    cp .claude/settings.local.template.json .claude/settings.local.json
    printf '   ↳ Edit .claude/settings.local.json and set LINEAR_ACCESS_TOKEN before using the Linear MCP server.\n'
  else
    log "WARNING: .claude/settings.local.template.json missing — skipping seed step."
  fi
fi

# --- 6. Pipeline queue --------------------------------------------------------

if [ ! -f .claude/task/pipeline-queue.json ]; then
  if [ -f .claude/task/pipeline-queue.template.json ]; then
    log "Seeding .claude/task/pipeline-queue.json from template..."
    cp .claude/task/pipeline-queue.template.json .claude/task/pipeline-queue.json
  fi
fi

# --- Done ---------------------------------------------------------------------

log "Bootstrap complete."
cat <<'EOF'

Next steps:
  • Open this directory in Claude Code — the session-start hook will summarize
    rules, skills, and MCP servers.
  • If you have not yet, set LINEAR_ACCESS_TOKEN in
    .claude/settings.local.json (gitignored).
  • Verify with: ./.claude/validate-config.sh

EOF
