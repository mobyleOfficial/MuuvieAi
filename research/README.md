# Research & Documentation

Central hub for design documents, architecture decisions, feature specifications, and analysis across the MuuvieAi ecosystem.

## Directory Structure

- **specs/** — Feature specifications and requirements. Written by PM, reviewed by architect. Input to the implementation pipeline.
- **reviews/** — Architecture reviews (spec-stage) and code reviews (post-implementation). Output from `architect-review` and `validator` agents.
- **requests/** — Incoming feature requests and change proposals. Initial input before PM converts to formal spec.
- **archive/** — Historical specs and obsolete documentation. Reference only.
- **decisions/** — Architecture Decision Records (ADRs), design patterns, and ecosystem-wide decisions.
- **analysis/** — Performance analysis, benchmarks, user research, and technical investigations.

## Examples

- `specs/movie-search-feature.md` — Feature spec with acceptance criteria and API contract
- `reviews/movie-search-feature.md` — Architect's review and approval/rejection
- `decisions/bloc-state-management.md` — ADR explaining why we use BLoC pattern
- `analysis/tmdb-api-performance.md` — TMDB integration benchmarks and recommendations
