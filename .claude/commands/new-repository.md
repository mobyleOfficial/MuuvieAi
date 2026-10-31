# New Repository

Scaffold a new repository contract (domain) and its implementation (data) for a feature.

**Usage:** `/new-repository <feature_name> <repository_name>`

- `<feature_name>` — snake_case feature name (e.g. `movies`, `user_profile`)
- `<repository_name>` — snake_case repository name (e.g. `movies`, `trending_movies`)

The full argument string is `$ARGUMENTS`.

## Steps

1. Parse `$ARGUMENTS`:
   - First word → `<feature_name>` (snake_case)
   - Second word → `<repository_name>` (snake_case)
2. Derive `<RepositoryName>` in PascalCase (e.g. `trending_movies` → `TrendingMovies`).
3. Check `features/<feature_name>/data/pubspec.yaml`:
   - If `injectable` is missing, add it: `injectable: any`
   - If `core` is missing, add it: `core:\n    path: ../../../core`
4. Create the three files below.
5. Export the contract from `features/<feature_name>/domain/lib/repositories/repositories.dart`.
6. Export the implementation from `features/<feature_name>/data/lib/repositories/repositories.dart`.

---

### `features/<feature_name>/domain/lib/repositories/<repository_name>_repository.dart`

```dart
abstract interface class <RepositoryName>Repository {}
```

---

### `features/<feature_name>/data/lib/repositories/<repository_name>_repository_impl.dart`

```dart
import 'package:injectable/injectable.dart';
import 'package:<feature_name>_domain/<feature_name>_domain.dart';

@LazySingleton(as: <RepositoryName>Repository)
class <RepositoryName>RepositoryImpl implements <RepositoryName>Repository {
  <RepositoryName>RepositoryImpl();
}
```

---

### Update barrel files

**`features/<feature_name>/domain/lib/repositories/repositories.dart`** — add:

```dart
export '<repository_name>_repository.dart';
```

**`features/<feature_name>/data/lib/repositories/repositories.dart`** — add:

```dart
export '<repository_name>_repository_impl.dart';
```

---

## Notes

- The **interface** lives in `domain/` — use cases and the rest of the domain layer depend only on this.
- The **implementation** lives in `data/` and is registered with `@LazySingleton(as: <RepositoryName>Repository)` so get_it binds the impl to the interface automatically.
- Use cases should inject `<RepositoryName>Repository` (the interface), never `<RepositoryName>RepositoryImpl`.
- Data sources needed by the repository should be added as constructor parameters to the impl — get_it will resolve them automatically.
- After creating, run `dart run build_runner build` in the root app to regenerate `injection.config.dart`.