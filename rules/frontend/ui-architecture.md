---
description: Rules for structuring UI modules in the Flutter app
globs: ui/**/*.dart
---

# UI Module Architecture

UI modules live under `ui/`. This is a container directory — NOT a package. Only the sub-modules inside it are packages.

## UI Module Structure

Each UI module is a package that contains **four files** following the Page/Screen split pattern:

```
ui/<module_name>/
  pubspec.yaml                          # Package: <module_name>
  lib/
    <module_name>.dart                  # Barrel file re-exporting all four files
    <module_name>_state.dart            # State class(es) for the BLoC
    <module_name>_bloc.dart             # Cubit for state management
    <module_name>_page.dart             # Page: @RoutePage(), owns Cubit lifecycle, handles navigation
    <module_name>_screen.dart           # Screen: StatelessWidget, pure UI, receives state/cubit as params
```

## File Responsibilities

- `<module_name>_state.dart` — sealed base class + `Loading`, `Success`, and `Error` concrete states.
- `<module_name>_bloc.dart` — Cubit extending `Cubit<<ModuleName>State>`, starts in `Loading`. Contains business logic (fetching data, handling events). Does NOT resolve its own dependencies — receives use cases via constructor.
- `<module_name>_page.dart` — `@RoutePage()` **StatefulWidget**. Owns the Cubit lifecycle (creates in `initState` or field initializer, disposes in `dispose`). Resolves dependencies from `GetIt`. Handles navigation via `BlocConsumer` listener. Delegates rendering to the Screen.
- `<module_name>_screen.dart` — **StatelessWidget**. Pure UI only — receives the Cubit (or state) as a constructor parameter. Uses `BlocProvider.value` + `BlocBuilder` to render. Never resolves dependencies or handles navigation directly.

### Why Page/Screen Split?

- **Testability:** The Screen can be tested with a mock Cubit without needing `GetIt` or navigation context.
- **Separation of concerns:** DI resolution, lifecycle, and navigation live in the Page. Rendering lives in the Screen.
- **Consistency:** Matches the established pattern in `movies_ui` (`MoviesHomePage` + `MoviesHomeScreen`).

Use `/new-ui-module <name>` to scaffold a new module from the standard template.

## Rules

- Each UI module is its own package with its own `pubspec.yaml`.
- Every UI module **MUST** contain exactly four files (plus the barrel): `_state.dart`, `_bloc.dart`, `_page.dart`, and `_screen.dart`.
- **ALWAYS** use the Page/Screen split. Never put `@RoutePage()`, `GetIt` resolution, or Cubit lifecycle management in the Screen. Never put rendering logic in the Page.
- The Page is the `@RoutePage()` entry point. The Screen is a plain `StatelessWidget`.
- Cubits are **never registered in DI modules**. The Page resolves use cases from `GetIt` and passes them to the Cubit constructor.
- **Folder naming:** The folder under `ui/` must NOT have a `_ui` suffix (e.g., `ui/news/`, `ui/auth/`, `ui/profile/`). The Dart package name in `pubspec.yaml` may use a `_ui` suffix only to avoid conflicts with a feature package of the same name (e.g., `name: news_ui` because `features/news` already uses `name: news`).
- The main app adds the UI module as a path dependency (e.g., `news_ui: path: ui/news`).
- The barrel file re-exports all four files.
- File names use `snake_case`. Class names use `PascalCase` (e.g., `HomeCubit`, `HomePage`, `HomeScreen`, `HomeState`).
- **No AppBar in detail screens.** Detail screens must NOT add their own `AppBar` or pinned `SliverAppBar` with title/back/actions. The app uses a generic `MuuvieAnimatedAppBar` in `main_screen.dart` that resolves the title from `route_title_resolver.dart` and shows a back button automatically. Use a `SliverAppBar` with `automaticallyImplyLeading: false` and `pinned: false` ONLY for hero images. Register the route title in `lib/routes/route_title_resolver.dart`. For screen-specific actions (e.g., share), place them in the body content or use `AppBarController.setActions()`.