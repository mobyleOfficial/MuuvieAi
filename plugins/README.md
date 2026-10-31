# Plugins

Claude Code plugins and MCP (Model Context Protocol) servers to extend Claude's capabilities.

## Available Plugins

### repo-management
Git and repository management for Muuvie ecosystem. Handles submodule syncing, branch creation, PR management.

**Tools:**
- `sync-submodule` — Update submodule to latest remote
- `create-feature-branch` — Sync and create feature branch
- `create-release-branch` — Sync and create release branch
- `open-pull-request` — Create PR with auto-detected base branch
- `check-status` — Show submodule sync status

See [repo-management/README.md](repo-management/README.md) for details.

## Registration

Register plugins in `.claude/settings.json`:
```json
{
  "mcpServers": {
    "repo-management": {
      "command": "node",
      "args": ["/absolute/path/to/plugins/repo-management/dist/index.js"]
    }
  }
}
```

See Claude Code docs: https://claude.ai/code
