---
description: Build a feature end-to-end autonomously — spec, plan, implementation with multi-pass review loops on each phase's PR.
argument-hint: "<feature request as plain text>"
---

# /ultimate-feature

Act as the `ultimate-developer` agent in THIS session (do NOT dispatch via `Task` — `AskUserQuestion` from a nested Task subagent cannot reach the interactive user, and the kickoff brainstorm requires user replies). Load `.claude/agents/ultimate-developer.md` into context and follow its protocol from the top: Required Reading → Kickoff Phase (brainstorm + parameter collection via `AskUserQuestion`) → Spec / Plan / Impl phases.

The user's feature request follows below the slash command. Treat it as the seed for the brainstorm.

The agent will:
1. Brainstorm with you (kickoff — the only user touchpoint)
2. Ask for target branch, scope, and slug
3. Write spec → open PR → review loop → merge
4. Plan with research → open PR → review loop → merge
5. Implement → open PR → review loop → merge
6. Bump submodule refs if cross-repo

After kickoff, the agent makes all decisions autonomously until merge or escalation. See `.claude/agents/ultimate-developer.md` for the full contract (mode flag conventions, safe_merge gate, orphan-stash recovery, secret-scan regex, hard safety boundaries).

Sub-agents (researcher, pm-spec, architect-review, implementer-tester, backend-implementer, validator, reviewer) ARE dispatched via `Task` — only the top-level orchestrator runs in your session so kickoff prompts surface correctly.
