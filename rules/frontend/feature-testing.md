---
description: Rules for writing old when creating features
globs: test/**/*.dart
---

# Feature Testing

## Test Structure

Mirror the `lib/` feature structure under `test/`:

```
test/
  features/
    <feature_name>/
      data/
        models/             # Model serialization tests
        repositories/       # Repository implementation tests
      domain/
        usecases/           # Use case unit tests
      presentation/
        pages/              # Widget tests for pages
        controllers/        # Controller/Bloc unit tests
```

## Rules

- Every public use case must have at least one unit test.
- Widget tests should verify key UI elements render and interactions work.
- Mock external dependencies (repositories, data sources) — don't depend on real network or storage in unit tests.
- Test file names match the source file with a `_test` suffix (e.g., `login_usecase.dart` → `login_usecase_test.dart`).
- Run `flutter test` to verify all tests pass before finishing work.