# New UI Module

Scaffold a new UI module under `ui/` following the project's UI architecture rules.

**Usage:** `/new-ui-module <module_name>`

The argument `$ARGUMENTS` is the module name in `snake_case` (e.g. `profile`, `movie_detail`).

## Steps

1. Derive the `PascalCase` class prefix from `$ARGUMENTS` (e.g. `movie_detail` → `MovieDetail`).
2. Create the following files with the content below (substituting `<module_name>` and `<ModuleName>`):

### `ui/<module_name>/pubspec.yaml`

```yaml
name: <module_name>
description: <ModuleName> UI module
publish_to: none

environment:
  sdk: ^3.0.0

dependencies:
  flutter:
    sdk: flutter
  flutter_bloc: any
  auto_route: any
```

### `ui/<module_name>/lib/<module_name>.dart` (barrel file)

```dart
export '<module_name>_bloc.dart';
export '<module_name>_page.dart';
export '<module_name>_screen.dart';
export '<module_name>_state.dart';
```

### `ui/<module_name>/lib/<module_name>_state.dart`

```dart
sealed class <ModuleName>State {
  const <ModuleName>State();
}

class <ModuleName>Loading extends <ModuleName>State {
  const <ModuleName>Loading();
}

class <ModuleName>Success extends <ModuleName>State {
  const <ModuleName>Success();
}

class <ModuleName>Error extends <ModuleName>State {
  final String message;

  const <ModuleName>Error(this.message);
}
```

### `ui/<module_name>/lib/<module_name>_bloc.dart`

```dart
import 'package:flutter_bloc/flutter_bloc.dart';

import '<module_name>_state.dart';

class <ModuleName>Cubit extends Cubit<<ModuleName>State> {
  <ModuleName>Cubit() : super(const <ModuleName>Loading());
}
```

### `ui/<module_name>/lib/<module_name>_page.dart`

```dart
import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';

import '<module_name>_bloc.dart';
import '<module_name>_screen.dart';

@RoutePage()
class <ModuleName>Page extends StatefulWidget {
  const <ModuleName>Page({super.key});

  @override
  State<<ModuleName>Page> createState() => _<ModuleName>PageState();
}

class _<ModuleName>PageState extends State<<ModuleName>Page> {
  final <ModuleName>Cubit _cubit = <ModuleName>Cubit();

  @override
  void dispose() {
    _cubit.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return <ModuleName>Screen(cubit: _cubit);
  }
}
```

### `ui/<module_name>/lib/<module_name>_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '<module_name>_bloc.dart';
import '<module_name>_state.dart';

class <ModuleName>Screen extends StatelessWidget {
  final <ModuleName>Cubit cubit;

  const <ModuleName>Screen({super.key, required this.cubit});

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: cubit,
      child: BlocBuilder<<ModuleName>Cubit, <ModuleName>State>(
        builder: (context, state) {
          return switch (state) {
            <ModuleName>Loading() => const Center(
                child: CircularProgressIndicator(),
              ),
            <ModuleName>Success() => const Center(
                child: Text('<ModuleName>'),
              ),
            <ModuleName>Error() => Center(
                child: Text(state.message),
              ),
          };
        },
      ),
    );
  }
}
```

3. Remind the user to:
   - Add the module as a path dependency in the main app's `pubspec.yaml`. If the module name conflicts with a feature package (e.g., `news` already exists under `features/news`), use a `_ui` suffix for the **package name only** (in `pubspec.yaml` `name:` field and imports), NOT the folder:
     ```yaml
     <module_name>_ui:
       path: ui/<module_name>
     ```
   - Register the route title in `lib/routes/route_title_resolver.dart` if this is a detail screen.
   - Do NOT add an `AppBar` or pinned `SliverAppBar` with title/back/actions inside the screen — the generic `MuuvieAnimatedAppBar` in `main_screen.dart` handles that. Use `SliverAppBar` with `automaticallyImplyLeading: false` and `pinned: false` only for hero images.