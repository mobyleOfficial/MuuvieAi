# New Data Source

Scaffold a new data source inside a feature's data layer.

**Usage:** `/new-datasource <feature_name> <datasource_name> <type>`

- `<feature_name>` — snake_case feature name (e.g. `movies`, `user_profile`)
- `<datasource_name>` — snake_case data source name (e.g. `movies`, `trending_movies`)
- `<type>` — one of `remote`, `local`, or `memory`

The full argument string is `$ARGUMENTS`.

## Steps

1. Parse `$ARGUMENTS`:
   - First word → `<feature_name>` (snake_case)
   - Second word → `<datasource_name>` (snake_case)
   - Third word → `<type>` (`remote`, `local`, or `memory`)
2. Derive `<DataSourceName>` in PascalCase (e.g. `trending_movies` → `TrendingMovies`).
3. Determine `<subfolder>` from `<type>`:
   - `remote` → `datasources/remote`
   - `local` → `datasources/local`
   - `memory` → `datasources/memory`
4. Check `features/<feature_name>/data/pubspec.yaml`:
   - If `injectable` is missing, add it: `injectable: any`
   - If `core` is missing, add it: `core:\n    path: ../../../core`
5. Create the two files below inside `features/<feature_name>/data/lib/<subfolder>/`.
   - Create the subfolder if it does not exist.
6. Export both from `features/<feature_name>/data/lib/datasources/datasources.dart`.

---

### `features/<feature_name>/data/lib/<subfolder>/<datasource_name>_data_source.dart`

```dart
abstract interface class <DataSourceName>DataSource {}
```

---

### `features/<feature_name>/data/lib/<subfolder>/<datasource_name>_data_source_impl.dart`

**remote:**
```dart
import 'package:core/core.dart';
import 'package:injectable/injectable.dart';

import '<datasource_name>_data_source.dart';

@injectable
class <DataSourceName>DataSourceImpl implements <DataSourceName>DataSource {
  final HttpClient _httpClient;

  <DataSourceName>DataSourceImpl(this._httpClient);
}
```

**local:**
```dart
import 'package:injectable/injectable.dart';

import '<datasource_name>_data_source.dart';

@injectable
class <DataSourceName>DataSourceImpl implements <DataSourceName>DataSource {
  <DataSourceName>DataSourceImpl();
}
```

**memory:**
```dart
import 'package:injectable/injectable.dart';

import '<datasource_name>_data_source.dart';

@injectable
class <DataSourceName>DataSourceImpl implements <DataSourceName>DataSource {
  <DataSourceName>DataSourceImpl();
}
```

---

### Update `features/<feature_name>/data/lib/datasources/datasources.dart`

Add the exports:

```dart
export '<subfolder>/<datasource_name>_data_source.dart';
export '<subfolder>/<datasource_name>_data_source_impl.dart';
```

---

## Notes

- `@injectable` registers it as a **factory** (new instance per injection). Do NOT use `@singleton` or `@lazySingleton` unless explicitly requested.
- `remote` implementations receive an `HttpClient` via constructor — use `@Named('tmdb')` or `@Named('backend')` if a specific client is needed.
- `local` implementations interact with on-device storage (e.g. ObjectBox, SharedPreferences).
- `memory` implementations hold state in-memory — useful for caching or testing.
- The interface (`<DataSourceName>DataSource`) is what repositories and tests depend on — never the implementation directly.
- After creating, run `dart run build_runner build` in the root app to regenerate `injection.config.dart`.