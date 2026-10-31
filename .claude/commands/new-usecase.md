# New Use Case

Scaffold a new use case inside a feature's domain layer, following the project's feature architecture rules.

**Usage:** `/new-usecase <feature_name> <usecase_name> [params_type] [response_type]`

- `<feature_name>` — the feature in `snake_case` (e.g. `movies`, `movie_detail`)
- `<usecase_name>` — the use case in `snake_case` (e.g. `get_movies`, `fetch_trending`)
- `[params_type]` — optional Dart type for params (e.g. `String`, `int`, `MovieFilter`). Defaults to `void` if omitted.
- `[response_type]` — optional Dart type for the response (e.g. `List<Movie>`, `Movie`). Defaults to `void` if omitted.

The full argument string is `$ARGUMENTS`.

## Steps

1. Parse `$ARGUMENTS`:
   - First word → `<feature_name>` (snake_case)
   - Second word → `<usecase_name>` (snake_case)
   - Third word → `<ParamsType>` (Dart type, default `void`)
   - Fourth word → `<ResponseType>` (Dart type, default `void`)
2. Derive `<UseCaseName>` in `PascalCase` from `<usecase_name>` (e.g. `get_movies` → `GetMovies`).
3. Determine the params signature:
   - If `<ParamsType>` is `void`: method signature is `Future<<ResponseType>> call()`
   - Otherwise: method signature is `Future<<ResponseType>> call([<ParamsType>? params])`
4. Create the file below.
5. Export it from `features/<feature_name>/domain/lib/usecases/usecases.dart`.

### `features/<feature_name>/domain/lib/usecases/<usecase_name>.dart`

**With params (`<ParamsType>` is not `void`):**
```dart
import 'package:core/core.dart';

class <UseCaseName> extends UseCase<<ParamsType>, <ResponseType>> {
  @override
  Future<<ResponseType>> call([<ParamsType>? params]) async {
    throw UnimplementedError();
  }
}
```

**Without params (`<ParamsType>` is `void`):**
```dart
import 'package:core/core.dart';

class <UseCaseName> extends UseCase<void, <ResponseType>> {
  @override
  Future<<ResponseType>> call([void params]) async {
    throw UnimplementedError();
  }
}
```

### Update `features/<feature_name>/domain/lib/usecases/usecases.dart`

Add the export:
```dart
export '<usecase_name>.dart';
```