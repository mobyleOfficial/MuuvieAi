# Skills

Project-level Claude Code skills for the MuuvieAi ecosystem. Each subdirectory holds a single skill with a `SKILL.md` describing it (frontmatter + body). Claude Code auto-discovers skills here when a session opens in this repo.

## Available Skills

- **`muuvie-feature-map`** — Map of every user-facing Muuvie feature across both submodules (route, screen, BLoC, datasource, endpoint, use case), with the `feature-map-check` CLI that keeps it true. Maintained by the `feature-mapper` agent and `/map-features`.
- **`muuvie-research-format`** — Standardized format for design docs, architecture decisions, and research documentation.
- **`setting-up-linear-mcp`** — Configure Linear MCP at project level with secure token storage.
- **`verify-docs-before-pr`** — Documentation verification before PR creation.

## Invocation

Skills are exposed as slash commands. Type `/<skill-name>` at the prompt:

```text
/skill-name
```

For example, `/muuvie-research-format` to start formatted research, or `/verify-docs-before-pr` for a manual pre-PR doc check (the `check-docs-sync.sh` hook already enforces docs-sync at `gh pr create` / `git push` time).

The `Skill("<name>")` tool form is reserved for programmatic invocation from within an agent or other skill — humans should prefer the slash command.

## Scaffolding Workflows

Flutter scaffolding (new datasource, repository, usecase, UI module) lives under [`.claude/commands/`](../commands/) and is invoked via slash commands (`/new-datasource`, `/new-repository`, `/new-usecase`, `/new-ui-module`) — not as skills. See [`.claude/agents/implementer-tester.md`](../agents/implementer-tester.md) for pipeline usage.

## Adding a New Skill

1. Create `.claude/skills/<skill-name>/SKILL.md`.
2. Add frontmatter:
   ```yaml
   ---
   name: <skill-name>
   description: Use when ... (one-line summary)
   ---
   ```
3. Write the skill body (instructions, examples, common mistakes).
4. Claude Code picks it up on next session.
