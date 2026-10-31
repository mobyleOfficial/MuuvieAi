---
name: setting-up-linear-mcp
description: Use when configuring Linear MCP for Claude Code, need to connect a workspace, or want to store the API token securely at project level
---

# Setting Up Linear MCP

Configure the Linear MCP server in this project with secure token storage.

## Overview

Linear MCP lets Claude Code read and manage Linear issues. This skill walks through project-level setup. Three moving parts:

1. **`.mcp.json`** at repo root — registers the Linear server, points at the wrapper script.
2. **`.claude/bin/linear-mcp.sh`** — wrapper that sources the token from local settings and execs the MCP server (avoids unreliable `${VAR}` expansion inside `.mcp.json`).
3. **`.claude/settings.local.json`** — gitignored, holds the actual `LINEAR_ACCESS_TOKEN`.

All three ship in the repo. Only the token in step 3 needs to be set by a clone.

## Prerequisites

Run `./bootstrap.sh` once after cloning. It installs `linear-mcp` via `npm`, validates that `jq` is available, and `chmod +x`'s the wrapper at `.claude/bin/linear-mcp.sh`. Manual installs work too but every step below assumes those three prerequisites are met.

> **Upstream patch note.** `linear-mcp@1.2.0` passes the PAT to `@linear/sdk` via the `accessToken` field, which always adds an `Authorization: Bearer …` prefix. Linear's API rejects PATs with a Bearer prefix (error: `It looks like you're trying to use an API key as a Bearer token`). We patch `node_modules/linear-mcp/build/auth.js` to use the SDK's `apiKey` field instead, via `patches/linear-mcp+1.2.0.patch`. The patch is re-applied automatically on every `npm install` by the root `postinstall` script (`patch-package`). No manual steps required. Upstream PR pending against `dvcrn/linear-mcp`; remove the patch once merged.

## When to Use

- First-time Linear MCP setup in a project
- Adding Linear integration to a clone that does not yet have a token
- Rotating an exposed token

## Quick Steps

**1. Generate API Token**

Navigate to: `https://linear.app/<workspace-name>/settings/api`

Click **Create new** → copy token (looks like `lin_api_xxx...`).

**2. Verify `.mcp.json` at repo root**

The repo ships a `.mcp.json` at the root with the Linear server already declared:

```json
{
  "mcpServers": {
    "linear": {
      "command": "./.claude/bin/linear-mcp.sh"
    }
  }
}
```

The Linear server is launched through a small wrapper script at [`.claude/bin/linear-mcp.sh`](../../bin/linear-mcp.sh) that:

1. Reads `LINEAR_ACCESS_TOKEN` from the gitignored `.claude/settings.local.json` via `jq`.
2. Exports it into the child process environment.
3. Execs `node ./node_modules/linear-mcp/build/index.js`.

This avoids relying on `${VAR}` expansion inside `.mcp.json`'s `env` block, which Claude Code does not consistently honor — the child process would otherwise receive the literal string `"${LINEAR_ACCESS_TOKEN}"` and the server would silently authenticate with garbage, producing "Authentication required" on every call.

Requirements: `jq` (installed by `bootstrap.sh`'s `require jq` check) and the `linear-mcp` package (installed by `npm install` / `bootstrap.sh`). `linear-mcp` (dvcrn) ships no `bin` entry, which is why we exec `node` against `build/index.js` rather than `npx linear-mcp`.

No edit to `.mcp.json` needed on a clone. Token lives only in `.claude/settings.local.json` (next step).

**3. Set `LINEAR_ACCESS_TOKEN` in `.claude/settings.local.json`**

Start from the shipped template if the file does not exist yet:

```bash
cp .claude/settings.local.template.json .claude/settings.local.json
```

Then put the token under the `env` block (merge it in if the file already has other settings):

```json
{
  "env": {
    "LINEAR_ACCESS_TOKEN": "lin_api_xxx..."
  }
}
```

Paste the real token here. Never commit this file.

**4. Verify `.gitignore`**

`.gitignore` must list `.claude/settings.local.json`. If missing, add the line — otherwise the token will reach the remote on next commit.

**5. Smoke-test the wrapper**

Confirm the wrapper resolves the token and the MCP server boots before restarting Claude Code:

```bash
./.claude/bin/linear-mcp.sh < /dev/null
```

Expected on stderr: `Linear MCP server running on stdio` (then the process blocks waiting for stdin — Ctrl-C to exit). Any line starting with `linear-mcp:` is a wrapper-level failure (missing `jq`, missing token, missing npm entry) — fix the cause it names before continuing.

**6. Restart Claude Code**

MCP servers register on session start. Quit Claude Code fully (not just a new tab/window) and reopen this project so the wrapper-backed server registers.

## Verify Connection

After restart, ask Claude Code: "List my Linear teams" — Claude should surface the workspace teams via `mcp__linear__linear_get_teams`. A response of `Authentication required, not authenticated` means the token is unset or invalid; revisit step 3 and step 5.

## Default Project

This repo defaults to the `MOO` project in the `mobyle` workspace. The `linear-mcp` server has no project filter — `MOO` is convention only, not enforcement. When referencing issues in PRs or commits, use the `MOO-123` prefix; the server will return any issue the token has access to regardless of project.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Token committed to git | Revoke at `https://linear.app/<workspace>/settings/api`, regenerate, store in `.claude/settings.local.json` only |
| Wrong package name | The package is `linear-mcp` (dvcrn), not `@linear/mcp`. Latter does not exist on npm |
| Wrong env var name | `linear-mcp` reads `LINEAR_ACCESS_TOKEN`, not `LINEAR_API_TOKEN`. Older docs may say the wrong name |
| Wrapper script not executable | `chmod +x .claude/bin/linear-mcp.sh` (or re-run `./bootstrap.sh`). Manifests as Claude Code reporting the MCP server failed to start |
| `jq` missing | The wrapper uses `jq` to read the token from `.claude/settings.local.json`. Install via your package manager (`brew install jq`, `apt install jq`) |
| Token missing from settings | Wrapper exits with `linear-mcp: .env.LINEAR_ACCESS_TOKEN missing from .claude/settings.local.json`. Add it under the `env` block |
| Edited token but MCP still returns "Authentication required" | The MCP server process started before the token was set — restart Claude Code completely (not just a new tab) so the wrapper re-reads `settings.local.json` |
| `.mcp.json` reverted to inline `${LINEAR_ACCESS_TOKEN}` | The literal string is passed through to the child unexpanded → silent auth failure. Restore `"command": "./.claude/bin/linear-mcp.sh"` and drop the `env` block |
| `It looks like you're trying to use an API key as a Bearer token` | `patches/linear-mcp+1.2.0.patch` was not applied. Run `npm run postinstall` (or `npx patch-package`) to re-apply, then restart Claude Code |

## Limits of the MCP server (use the GraphQL API instead)

`linear-mcp` covers reading issues and creating or updating plain ones. It can't do several ordinary things that the Linear API itself supports:

- **Milestones:** it can filter by `projectMilestones` but not create them, and `linear_create_issue(s)` take no `projectMilestoneId`.
- **Project assignment:** `linear_create_issue` takes `teamId` but no `projectId`; `linear_bulk_update_issues` only sets `assigneeId`, `priority` and `stateId`. There is no generic issue-update tool.
- **Bulk create:** `linear_create_issues` fails with `Variable "$input" of type "[IssueCreateInput!]!" used in position expecting type "IssueCreateInput!"` (it sends a list to a single-issue mutation). Create issues one at a time, or use the API.

For those, call `https://api.linear.app/graphql` directly (`projectMilestoneCreate`, `issueUpdate(id, input: { projectId, projectMilestoneId })`):

- Send the token from `.claude/settings.local.json` **bare** in the `Authorization` header — no `Bearer` prefix (the same rejection the patch above works around).
- Use `curl --data-binary @payload.json`. Build the JSON payload in a file (with a script if needed), never by interpolating GraphQL into a shell string: nested quoting mangles it into 400s. Batch many mutations into one request with aliases (`u0:`, `u1:`, …) and variables.
- Prefer `curl` over Python's `urllib` on machines whose Python build has no CA bundle (`CERTIFICATE_VERIFY_FAILED`).
- Verify with a follow-up query. A mutation's own `success: true` is not proof the board looks right.


## Security Notes

- **API tokens are read-write credentials** — treat like passwords.
- Revoke immediately if exposed (committed to git, screenshot, chat transcript).
- `.claude/settings.local.json` is gitignored — never commit it.
- Team members each create their own token. Tokens are not shared.

## Next: Use Linear MCP

Once connected, Claude Code has Linear tools available. Ask about:
- Listing issues by status / assignee / label
- Creating or updating issues
- Looking up metadata for a specific issue

See `linear-mcp` (dvcrn) docs for the full tool reference.
