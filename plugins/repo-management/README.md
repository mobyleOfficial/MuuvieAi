# repo-management MCP Server

CLI and MCP tools for managing the Muuvie ecosystem repositories (submodules, branches, pull requests).

## Installation

```bash
cd plugins/repo-management
npm install
npm run build
```

## Tools

### `sync-submodule`
Update a submodule to the latest remote commit and stage the reference change.

```bash
sync-submodule --name backend
```

**Use when:** Submodule is stale and needs to be brought current.

### `create-feature-branch`
Sync all submodules, checkout dev, and create a feature branch.

```bash
create-feature-branch --name "user-authentication"
# Creates: feature/user-authentication
```

**Use when:** Starting work on a new feature.

### `create-release-branch`
Sync all submodules, checkout dev, and create a release branch.

```bash
create-release-branch --version "1.2.0"
# Creates: release/1.2.0
```

**Use when:** Preparing a release.

### `open-pull-request`
Create a PR with auto-detected base branch (feature/fix → dev, release → main).

```bash
open-pull-request --title "feat: add dark mode support" --description "Adds dark theme..."
```

**Use when:** Ready to merge changes. Requires `gh` CLI installed.

### `check-status`
Display sync status of all submodules.

```bash
check-status
# Output:
# Submodule Status:
#   muuvie:  ✓ up to date
#   backend: ⚠ STALE
```

**Use when:** Checking ecosystem health.

## Configuration

Register with Claude Code in `.claude/settings.json`:

```json
{
  "mcpServers": {
    "repo-management": {
      "command": "node",
      "args": ["/path/to/plugins/repo-management/dist/index.js"]
    }
  }
}
```

## Conventions

All tools follow ecosystem conventions defined in [CLAUDE.md](../../CLAUDE.md):

- **Commit format:** `chore:`, `feat:`, `fix:`, `doc:`
- **Branch naming:** `feature/*`, `release/*`, `fix/*`
- **PR targets:** feature/fix → dev (develop on older clones), release → main
- **No coauthors:** Single author per commit

## Requirements

- Node.js 18+
- `git` CLI
- `gh` CLI (for `open-pull-request`)
