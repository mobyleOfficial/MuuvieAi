# Task Management & Feature Pipeline

Centralized task tracking and feature development pipelines for the MuuvieAi ecosystem.

## Directory Structure

```
task/
├── README.md                   # This file
├── frontend/                   # Flutter/Dart feature pipeline
│   ├── pipeline-queue.json     # Frontend pipeline state
│   ├── template.md             # Request template for frontend
│   ├── README.md               # Frontend pipeline guide
│   ├── requests/               # Feature requests (raw ideas)
│   ├── specs/                  # Specs written by pm-spec
│   └── reviews/                # Architecture & code reviews
└── backend/                    # Kotlin/Ktor feature pipeline
    ├── pipeline-queue.json     # Backend pipeline state
    ├── template.md             # Request template for backend
    ├── README.md               # Backend pipeline guide
    ├── requests/               # Feature requests (raw ideas)
    ├── specs/                  # Specs written by pm-spec
    └── reviews/                # Architecture & code reviews
```

## Quick Start

### Frontend Feature
```bash
# 1. Create request
cp task/frontend/template.md task/frontend/requests/my-feature.md

# 2. Start pipeline
/pm-spec
/architect-review research/specs/my-feature.md
/implementer-tester
/review-pr <PR#>
/validator
```

See [task/frontend/README.md](frontend/README.md) for full guide.

### Backend Feature
```bash
# 1. Create request
cp task/backend/template.md task/backend/requests/my-feature.md

# 2. Start pipeline
/pm-spec
/architect-review research/specs/my-feature.md
/backend-implementer
/review-pr <PR#>
/validator
```

See [task/backend/README.md](backend/README.md) for full guide.

## Pipeline Overview

Both frontend and backend follow the same 6-stage pipeline:

| Stage | Agent | Input | Output | Purpose |
|-------|-------|-------|--------|---------|
| **1. Spec** | `pm-spec` | `task/{type}/requests/` | `research/specs/` | Write detailed specification |
| **2. Review** | `architect-review` | `research/specs/` | `research/reviews/` | Feasibility & alignment review |
| **3. Implement** | `implementer-tester` or `backend-implementer` | `research/specs/` | Code in submodule | Build feature with tests |
| **4. Code Review** | `reviewer` | Generated code | `research/reviews/` | Quality & pattern review |
| **5. Validate** | `validator` | Generated code | Report | Pre-merge validation |

## Key Differences

### Frontend (Flutter/Dart)
- **Implementer:** `/implementer-tester`
- **Tech Stack:** Flutter, Dart, BLoC, GetIt
- **Code Output:** `muuvie/{features,ui,lib}/**`
- **Skills:** `/new-datasource`, `/new-repository`, `/new-usecase`, `/new-ui-module`
- **Error Handling:** `Result<T>` wrappers
- **Async:** Future/Stream

### Backend (Kotlin/Ktor)
- **Implementer:** `/backend-implementer`
- **Tech Stack:** Kotlin, Ktor, Koin
- **Code Output:** `backend/src/main/kotlin/**`
- **Skills:** `/new-kotlin-datasource`, `/new-kotlin-repository`, `/new-kotlin-usecase`, `/new-ktor-endpoint`
- **Error Handling:** Exception bubbling
- **Async:** Suspend functions

## Shared Research Directories

Specs and reviews from both pipelines go to shared `research/` directories:

```
research/
├── specs/
│   ├── comment-screen.md              # Frontend spec
│   ├── trending-movies-endpoint.md    # Backend spec
│   └── ...
├── reviews/
│   ├── comment-screen-review.md       # Architecture review
│   ├── comment-screen-code-review.md  # Code review
│   ├── trending-movies-endpoint-review.md
│   └── trending-movies-endpoint-code-review.md
└── requests/                          # (deprecated, moved to task/)
    ├── comment-screen.md
    └── ...
```

## Tracking State

Each pipeline directory has `pipeline-queue.json` tracking:
- Current stage
- Feature name
- Stage statuses (pending/in-progress/completed)
- History with timestamps and decisions

Update as you progress through stages:
```json
{
  "current_stage": "implement",
  "feature": "comment-screen",
  "stages": [
    {"name": "spec", "status": "completed"},
    {"name": "review", "status": "completed", "decision": "APPROVED"},
    {"name": "implement", "status": "in-progress"},
    ...
  ]
}
```

## Rules & Guidance

### Before Starting a Feature
- [ ] Read relevant architecture rules (frontend or backend)
- [ ] Check if feature aligns with current priorities
- [ ] Identify dependencies on other features

### During Implementation
- [ ] Follow code patterns from respective rules
- [ ] Write tests (hooks validate test coverage)
- [ ] Maintain DI registration (hooks catch missing registrations)
- [ ] Run hooks locally if needed (optional)

### Before Merging
- [ ] Architecture review approved
- [ ] Code review approved
- [ ] Validator passes
- [ ] All tests passing
- [ ] No broken dependencies

## Feature Request Templates

### Frontend
See [task/frontend/template.md](frontend/template.md) — Focus on:
- User-facing features
- Screen layouts and navigation
- Localization requirements
- Accessibility considerations

### Backend
See [task/backend/template.md](backend/template.md) — Focus on:
- API endpoints and contracts
- Data transformations
- Caching strategies
- Error handling

## References

### Frontend
- [Feature Architecture Rules](../../rules/frontend/feature-architecture.md)
- [Implementation Rules](../../rules/frontend/feature-implementation.md)
- [Testing Rules](../../rules/frontend/feature-testing.md)
- [Implementer-Tester Agent](../../agents/implementer-tester.md)

### Backend
- [Backend Architecture Rules](../../rules/backend/backend-architecture.md)
- [Implementation Rules](../../rules/backend/backend-implementation.md)
- [Testing Rules](../../rules/backend/backend-testing.md)
- [Backend-Implementer Agent](../../agents/backend-implementer.md)

### Shared
- [Hooks Documentation](../hooks/README.md)
- [Skills Documentation](../skills/README.md)

## Tips

1. **Be explicit in requests** — More detail = better spec
2. **Use architecture reviews to catch issues early** — Cheaper to redesign in the spec phase
3. **Follow the template** — Standard format helps all agents understand context
4. **Track progress** — Update `pipeline-queue.json` as you go
5. **Reference the rules** — Both implementers read them; consistency matters

## Workflow Example

**Scenario:** Add "Top Rated Movies" feature

```
1. Create request:
   → task/backend/requests/top-rated-endpoint.md

2. Write spec:
   → /pm-spec
   → Creates research/specs/top-rated-endpoint.md
   (API contract, response format, caching strategy)

3. Review spec:
   → /architect-review research/specs/top-rated-endpoint.md
   → Creates research/reviews/top-rated-endpoint-review.md
   (Feasibility check, identifies needed datasources)

4. Implement backend:
   → /backend-implementer
   → Creates datasource (HTTP call to TMDB)
   → Creates repository (DTO mapping)
   → Creates usecase (business logic)
   → Creates endpoint (Ktor routing)

5. Code review:
   → /review-pr <PR#>
   → Validates DI registration, suspend functions, patterns
   → Creates research/reviews/top-rated-endpoint-code-review.md

6. Final validation:
   → /validator
   → Confirms architecture rules, tests, etc.

7. Frontend can now build on top:
   → Create task/frontend/requests/top-rated-screen.md
   → Follow same pipeline for UI
   → Consume the new backend endpoint
```

---

**Start now:** Pick a feature and create a request in either `task/frontend/` or `task/backend/`.
