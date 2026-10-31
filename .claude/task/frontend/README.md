# Frontend Feature Pipeline

Structured task tracking for Flutter/Dart frontend features using the MuuvieAi pipeline.

## Directory Structure

```
task/frontend/
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
   └─> task/frontend/requests/{feature}.md
       (Use template.md as starting point)

2. Write Spec (/pm-spec)
   └─> research/specs/{feature}.md
       (Detailed specification with architecture notes)

3. Review Spec (/architect-review)
   └─> research/reviews/{feature}-review.md
       (Feasibility review, approval/rejection)

4. Implement (/implementer-tester)
   └─> muuvie/{features,ui,lib}/**
       (Uses /new-* Flutter/Dart skills)
       └─> Datasource → Repository → Usecase → UI Module

5. Code Review (/review-pr <PR#>)
   └─> research/reviews/{feature}-code-review.md
       (Quality review, patterns, DI registration)

6. Validate (/validator)
   └─> Final pre-merge validation
```

## How to Start a Frontend Feature

### 1. Create a Request
Create file in `task/frontend/requests/{feature-name}.md`:
```bash
cp task/frontend/template.md task/frontend/requests/comments-screen.md
# Edit with your feature details
```

### 2. Run Spec Stage
```bash
/pm-spec
# Reads: task/frontend/requests/comments-screen.md
# Writes: research/specs/comments-screen.md
```

### 3. Run Architecture Review
```bash
/architect-review research/specs/comments-screen.md
# Reads: research/specs/comments-screen.md
# Writes: research/reviews/comments-screen-review.md
# Checks: Feasibility, alignment, architecture
```

### 4. Run Frontend Implementation
```bash
/implementer-tester
# Reads: research/specs/comments-screen.md
# Generates: muuvie/{features,ui,lib}/**
# Uses: /new-datasource, /new-repository, /new-usecase, /new-ui-module
```

### 5. Run Code Review
```bash
/review-pr <PR#>
# Reads: Generated Flutter code
# Writes: research/reviews/comments-screen-code-review.md
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
  "feature": "comments-screen",
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

## Key Patterns

### Layer Structure
```
features/
  ├── {feature}/
      ├── domain/
      │   ├── models/       # Data classes
      │   ├── repositories/ # Interfaces
      │   └── usecases/     # Business logic
      ├── data/
      │   ├── datasources/  # HTTP/local data sources
      │   └── repositories/ # Implementations
      └── ui/
          ├── bloc/         # State management
          ├── screens/      # Full screens
          └── widgets/      # Reusable components
```

### BLoC Pattern
```dart
// Usecase
abstract class MovieRepository {
  Future<Result<List<Movie>>> getTrendingMovies();
}

// BLoC Event
abstract class MovieEvent {}
class GetTrendingMoviesEvent extends MovieEvent {}

// BLoC State
abstract class MovieState {}
class TrendingMoviesLoading extends MovieState {}
class TrendingMoviesLoaded extends MovieState {
  final List<Movie> movies;
}
class TrendingMoviesError extends MovieState {
  final String message;
}

// BLoC
class MovieBloc extends Bloc<MovieEvent, MovieState> {
  final GetTrendingMoviesUsecase _usecase;

  MovieBloc(this._usecase) : super(TrendingMoviesLoading()) {
    on<GetTrendingMoviesEvent>(_onGetTrendingMovies);
  }

  Future<void> _onGetTrendingMovies(
    GetTrendingMoviesEvent event,
    Emitter<MovieState> emit,
  ) async {
    final result = await _usecase();
    result.fold(
      (failure) => emit(TrendingMoviesError(failure.message)),
      (movies) => emit(TrendingMoviesLoaded(movies)),
    );
  }
}
```

### DI Registration
```dart
// lib/di/movie_module.dart
@module
abstract class MovieModule {
  @lazySingleton
  MovieDataSource movieDataSource(Dio dio) => MovieDataSourceImpl(dio);

  @lazySingleton
  MovieRepository movieRepository(MovieDataSource ds) => MovieRepositoryImpl(ds);

  @lazySingleton
  GetTrendingMoviesUsecase getTrendingMoviesUsecase(MovieRepository repo) =>
    GetTrendingMoviesUsecase(repo);
}

// lib/di/injection.config.dart (auto-generated)
// Register all modules with GetIt
```

## References

- [Frontend Architecture Rules](../../../rules/frontend/feature-architecture.md) — Feature structure
- [Frontend Implementation Rules](../../../rules/frontend/feature-implementation.md) — Code style
- [Frontend Testing Rules](../../../rules/frontend/feature-testing.md) — Test patterns
- [Implementer-Tester Agent](../../../agents/implementer-tester.md) — Agent guide
- [Hooks Documentation](../../hooks/README.md) — Validation hooks

## Next: Start a Feature

Ready to implement a frontend feature? Create a request:

```bash
cat > task/frontend/requests/my-feature.md << 'EOF'
# My Feature

## User Need
...

## High-Level Requirements
...
EOF
```

Then run `/pm-spec` to begin the pipeline.
