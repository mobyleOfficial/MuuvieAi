# Agents

Custom Claude agents for specialized tasks in the MuuvieAi ecosystem. These form a feature development pipeline.

## Available Agents

- **pm-spec** — Product manager that writes feature specifications for the ecosystem
- **architect-review** — Technical architect that reviews specs for feasibility and ecosystem alignment
- **implementer-tester** — Flutter/Dart implementer that builds features in the muuvie submodule with full test coverage
- **backend-implementer** — Kotlin/Ktor implementer that builds backend features in the backend submodule with full test coverage
- **reviewer** — PR review orchestrator: dispatches `reviewers/security`, `reviewers/bug-finder` and `reviewers/architecture` in parallel, dedupes, and posts one batched review (`/review-pr`)
- **validator** — Strict read-only validator that catches issues before merge
- **ultimate-developer** — Autonomous end-to-end orchestrator: spec → plan → implementation, each through a PR review loop (`/ultimate-feature`)
- **researcher** — Researches one topic per invocation and writes one file; dispatched by `ultimate-developer` during the plan phase
- **feature-mapper** — Writes and repairs pages of the Muuvie feature map (`.claude/skills/muuvie-feature-map/`), tracing each feature through both submodules; dispatched by `/map-features` and `ultimate-developer`

## Pipeline Usage

Feature development follows this pipeline:

1. **pm-spec** — Convert feature request → formal spec in `research/specs/`
2. **architect-review** — Review spec for feasibility → approval/rejection in `research/reviews/`
3. **implementer-tester** (for frontend) or **backend-implementer** (for backend) — Implement approved spec with tests
4. **reviewer** — Review implementation for quality and correctness
5. **validator** — Final validation before merge

For features requiring both frontend and backend:
- Start with **backend-implementer** (endpoints and business logic)
- Then **implementer-tester** (UI consuming the backend APIs)

Each agent has specific tool allowlists and responsibilities defined in its metadata. All agents understand the MuuvieAi ecosystem structure and can work across the muuvie and backend submodules.

See [CLAUDE.md](../CLAUDE.md) for ecosystem-wide guidance.
