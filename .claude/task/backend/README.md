# Backend Feature Pipeline

Structured task tracking for Kotlin/Ktor backend features using the MuuvieAi pipeline.

## Directory Structure

```
task/backend/
├── pipeline-queue.json         # Pipeline state and stage tracking
├── template.md                 # Template for new feature requests
├── README.md                   # This file
├── requests/                   # Feature requests (raw ideas)
├── specs/                      # Specifications (written by pm-spec agent)
└── reviews/                    # Architecture reviews & code reviews
```

## Pipeline Flow

```
1. Create Request
   └─> task/backend/requests/{feature}.md
       (Use template.md as starting point)

2. Write Spec (/pm-spec)
   └─> research/specs/{feature}.md
       (Detailed specification with architecture notes)

3. Review Spec (/architect-review)
   └─> research/reviews/{feature}-review.md
       (Feasibility review, approval/rejection)

4. Implement (/backend-implementer)
   └─> backend/src/main/kotlin/...
       (Uses /new-kotlin-* skills)
       └─> Datasource → Repository → Usecase → Endpoint

5. Code Review (/review-pr <PR#>)
   └─> research/reviews/{feature}-code-review.md
       (Quality review, patterns, DI registration)

6. Validate (/validator)
   └─> Final pre-merge validation
```

## How to Start a Backend Feature

### 1. Create a Request
Create file in `task/backend/requests/{feature-name}.md`:
```bash
cp task/backend/template.md task/backend/requests/trending-movies-endpoint.md
# Edit with your feature details
```

### 2. Run Spec Stage
```bash
/pm-spec
# Reads: task/backend/requests/trending-movies-endpoint.md
# Writes: research/specs/trending-movies-endpoint.md
```

### 3. Run Architecture Review
```bash
/architect-review research/specs/trending-movies-endpoint.md
# Reads: research/specs/trending-movies-endpoint.md
# Writes: research/reviews/trending-movies-endpoint-review.md
# Checks: Feasibility, alignment, architecture
```

### 4. Run Backend Implementation
```bash
/backend-implementer
# Reads: research/specs/trending-movies-endpoint.md
# Generates: backend/src/main/kotlin/...
# Uses: /new-kotlin-datasource, /new-kotlin-repository, /new-kotlin-usecase, /new-ktor-endpoint
```

### 5. Run Code Review
```bash
/review-pr <PR#>
# Reads: Generated backend code
# Writes: research/reviews/trending-movies-endpoint-code-review.md
# Checks: Patterns, DI, tests, code quality
```

### 6. Run Final Validation
```bash
/validator
# Final checks before merge
# Ensures all architecture rules followed
```

## Tracking Progress

Update `pipeline-queue.json` as you progress:
```json
{
  "current_stage": "implement",
  "feature": "trending-movies-endpoint",
  "stages": [
    {"name": "spec", "status": "completed", ...},
    {"name": "review", "status": "completed", ...},
    {"name": "implement", "status": "in-progress", ...},
    {"name": "code-review", "status": "pending", ...}
  ],
  "history": [
    {"stage": "spec", "completed_at": "2026-05-15T10:00:00Z"},
    {"stage": "review", "completed_at": "2026-05-15T10:15:00Z", "decision": "APPROVED"}
  ]
}
```

## Key Differences from Frontend Pipeline

| Aspect | Frontend | Backend |
|--------|----------|---------|
| **Implementer Agent** | `implementer-tester` | `backend-implementer` |
| **Tech Stack** | Flutter/Dart | Kotlin/Ktor |
| **Skills Used** | `/new-usecase`, `/new-datasource`, `/new-repository`, `/new-ui-module` | `/new-kotlin-usecase`, `/new-kotlin-datasource`, `/new-kotlin-repository`, `/new-ktor-endpoint` |
| **Code Output** | muuvie/{features,ui,lib}/** | backend/src/main/kotlin/...** |
| **DI Framework** | GetIt | Koin |
| **Error Handling** | Result<T> wrapper | Exception bubbling |
| **Async Model** | Future/Stream | Suspend functions |

## Common Backend Patterns

### Layer Structure
```
domain/
  ├── model/          # Data classes (pure, no framework deps)
  ├── repository/     # Interfaces (what data layer implements)
  └── usecase/        # Business logic (operator fun invoke())

data/
  ├── remote/         # HTTP datasources (Ktor client)
  └── repository/     # Implementations with DTO mapping

presentation/
  └── routing/        # API endpoints (Ktor routing)
```

### Suspend Function Pattern
```kotlin
// Datasource (HTTP)
suspend fun getTrendingMovies(): List<MovieDTO>

// Repository
suspend fun getTrendingMovies(): List<Movie>

// Usecase
class GetTrendingMoviesUsecase(private val repo: MovieRepository) {
  suspend operator fun invoke(): List<Movie> = repo.getTrendingMovies()
}

// Endpoint
routing {
  get("/api/movies/trending") {
    val movies = getTrendingMoviesUsecase()
    call.respond(movies)
  }
}
```

### DI Registration
```kotlin
// DataModule.kt
val DataModule = module {
  single<MovieDataSource> { MovieDataSourceImpl(get()) }  // HTTP client injected
  single<MovieRepository> { MovieRepositoryImpl(get()) }  // Datasource injected
}

// AppModule.kt
val AppModule = module {
  factory { GetTrendingMoviesUsecase(get()) }  // Repository injected
}
```

## References

- [Backend Architecture Rules](../../../rules/backend/backend-architecture.md) — Layer structure
- [Backend Implementation Rules](../../../rules/backend/backend-implementation.md) — Code style
- [Backend Testing Rules](../../../rules/backend/backend-testing.md) — Test patterns
- [Backend Implementer Agent](../../../agents/backend-implementer.md) — Agent guide
- [Hooks Documentation](../../hooks/README.md) — Validation hooks

## Next: Start a Feature

Ready to implement a backend feature? Create a request:

```bash
cat > task/backend/requests/my-feature.md << 'EOF'
# My Feature

## User Need
...

## High-Level Requirements
...
EOF
```

Then run `/pm-spec` to begin the pipeline.
