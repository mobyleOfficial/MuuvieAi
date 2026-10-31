# Local Claude Code Configuration Rule

**RULE:** All Claude Code configuration in `.claude/` MUST use portable, relative paths. No global (`~/`) or absolute user paths allowed.

## Why

- **Portability:** Any team member cloning the repo gets identical setup
- **Reproducibility:** No hardcoded user paths breaking on different machines
- **Version control:** Team can review and maintain config together
- **Consistency:** `.gitignore` handles secrets; `.claude/` stays portable

## What's Forbidden in `.claude/`

### ❌ Never Use Global Paths

```json
{
  "statusLine": {
    "command": "~/.claude/statusline.sh"  // ❌ Global path
  },
  "hooks": {
    "PreCompact": [{
      "hooks": [{
        "command": "/Users/edyuto/scripts/compact.sh"  // ❌ Absolute user path
      }]
    }]
  }
}
```

### ✅ Always Use Relative Paths

```json
{
  "statusLine": {
    "command": "./.claude/statusline.sh"  // ✅ Relative to project root
  },
  "mcpServers": {
    "local": {
      "command": "node",
      "args": ["./plugins/my-plugin/dist/index.js"]  // ✅ Relative to project root
    }
  }
}
```

## Enforcement

- `UserPromptSubmit` hook (`.claude/validate-config.sh`) runs on every prompt
- Scans `.claude/settings.json`, `.claude/settings.local.json`, and `.mcp.json` (repo root) for forbidden patterns
- Blocks the prompt if any file contains `~/`, `/Users/`, `/home/`, `/root/`, or `$HOME`
- Hook error message shows exact violations and locations
- Secrets go in `.claude/settings.local.json` (gitignored)

## Exceptions

None. All configs must be portable.

---

See also: [AI_AGNOSTIC_SUBMODULES.md](AI_AGNOSTIC_SUBMODULES.md), [NO_COAUTHORS.md](NO_COAUTHORS.md)
