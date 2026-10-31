# Variable Naming

## Rules

- ALWAYS use descriptive variable names that clearly communicate intent.
- Avoid single-letter names (except for loop indices like `i`, `j` in simple loops).
- Avoid abbreviations unless they are universally understood (e.g., `id`, `url`, `http`).
- Prefer longer, self-documenting names over short, ambiguous ones.

## Arrow Functions

- ALWAYS use arrow syntax (`=>`) for single-expression functions and methods instead of block bodies.

```dart
// Bad
String fullName() {
  return '$firstName $lastName';
}

int double(int value) {
  return value * 2;
}

// Good
String fullName() => '$firstName $lastName';

int double(int value) => value * 2;
```

## Examples

```dart
// Bad
final r = await _dataSource.getTrendingMovieList();
final d = r.data;
final m = movies.map((e) => e.toDomain());

// Good
final result = await _dataSource.getTrendingMovieList();
final movieModels = result.data;
final domainMovies = movieModels.map((model) => model.toDomain());
```