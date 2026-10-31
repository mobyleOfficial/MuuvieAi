# AI-Agnostic Submodules Rule

**RULE:** Child repositories (muuvie, backend) MUST remain AI-agnostic. All AI-specific configuration, documentation, and integration belongs in the MuuvieAi meta-repo only.

## Why

- **Clean separation:** Child repos focus on code, not tooling
- **Portability:** Submodules work with or without Claude Code
- **Single source of truth:** AI config lives in one place (meta-repo)
- **Team flexibility:** Developers can use any editor/workflow on submodules
- **Maintainability:** No duplicate AI setup across repos

## What's Forbidden in Submodules

### ❌ Never Add to muuvie/ or backend/

```
CLAUDE.md           # No AI-specific guidance in child repos
GEMINI.md           # No LLM-specific config
.claude/            # No Claude Code settings
.copilot/           # No Copilot config
.cursorrules        # No Cursor rules
AI_SETUP.md         # No AI setup docs
.claude.rar, .claude.zip, …   # No archived copies of the above either
```

This applies at any depth (`docs/CLAUDE.md`, `tool/.claude/`), and to archives: a zipped `.claude/` is still AI tooling in the repo. (`muuvie` carried a `.claude.rar` from May to October 2026 because the hook only looked at the repo root and for the plain directory name.)

### ❌ Never Reference in Documentation

```markdown
# In child repo README or docs:

"Use Claude Code to..."            # Wrong
"AI-assisted development..."       # Wrong
"Setting up Claude locally..."     # Wrong
"See CLAUDE.md for AI config"      # Wrong
```

### ❌ Never Add Co-authors

```bash
git commit -m "feat: auth flow

Co-Authored-By: Claude <claude@anthropic.com>"  # WRONG
```

Reason: Claude is a tool, not a contributor. Single human author always.
See [NO_COAUTHORS.md](NO_COAUTHORS.md).

## What Belongs in MuuvieAi Meta-Repo

**All AI integration lives here:**
- `.claude/settings.json` — Claude Code config
- `CLAUDE.md` — AI guidance for this ecosystem
- `plugins/` — MCP servers
- `.claude/skills/` — AI workflows
- `.claude/agents/` — Specialized Claude agents
- Setup/onboarding docs for AI tools

## Checking Compliance

Before merging a PR in submodules, verify:
```bash
# Should return nothing
grep -r "claude\|Claude\|CLAUDE" muuvie/
grep -r "claude\|Claude\|CLAUDE" backend/

# Should return nothing
ls -la muuvie/.claude/
ls -la backend/.claude/
ls -la muuvie/CLAUDE.md
ls -la backend/CLAUDE.md

# Tracked AI tooling at any depth, archives included — the hook's own pattern
git -C muuvie ls-files | grep -E '(^|/)(\.claude([/.]|$)|CLAUDE\.md$|\.cursorrules$|AGENTS\.md$|\.github/copilot-instructions\.md$)'
```

## When a Submodule Needs AI Documentation

Example: "How do I run Muuvie in Claude Code?"

**❌ Add to muuvie/README.md:**
```markdown
## Claude Code Setup
(instructions here)
```

**✅ Add to MuuvieAi CLAUDE.md instead:**
```markdown
### Muuvie (Flutter Frontend)
...development guidance for Muuvie...
```

Point child repo docs to meta-repo:
```markdown
# Muuvie

For AI-assisted development guidance, see the parent repo: [MuuvieAi CLAUDE.md](../../CLAUDE.md)
```

## Enforcement

- **Hook:** `.claude/hooks/check-submodule-ai.sh` blocks `git commit` / `git push` that involve a submodule whose tracked files match the pattern above (any depth, archives included).
- **PR reviews:** Catch CLAUDE.md, .claude/, Claude references in submodule PRs
- **CI/CD:** Optional: Lint rule to block CLAUDE.md in submodules
- **Team:** Explain this rule during onboarding

## Exception: Integration Tests

If a submodule integration test needs MCP/Claude context (rare):
- Create a test-specific `.claude/` directory
- Document why (comment in test)
- Keep it minimal

Example:
```bash
muuvie/tests/ai-integration/.claude/settings.json  # Test-only config
```

Not production code — test setup only.

## No Exceptions

- "Just a quick CLAUDE.md" → No, belongs in meta-repo
- "We'll move it later" → Add it correctly now
- "Everyone uses Claude anyway" → Doesn't matter, keep repos clean
- "It's AI-generated code" → Code is code, doesn't need AI markers

**Submodules stay agnostic. Always.**
