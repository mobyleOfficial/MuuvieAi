# Watch List

## Status
Done

## Overview
Create the watch list screen and add navigate to it from public profile and user profile

## Why
I want to see the watch list

## Acceptance Criteria
- [ ] Show a grid of movies
- [ ] Paginate it
- [ ] Use mocked data 
- [ ] Create methods (repository and data source) to get the a watch list
- [ ] Use feature/movies repo, data source, etc
- [ ] Use the user id to get them
- [ ] Create the bloc, state and screen on the ui/movies_ui module
- [ ] Create a use case to get the watch list
- [ ] Tapping a watch list movie navigates to its detail screen
- [ ] On public profile, when tapping in "see all" on watch list section, navigate to the Watch list screen
- [ ] App bar should have the User name + Watch List
- [ ] The name, on the tab bar, should be optional to send

## Notes
- Follow existing feature architecture: domain (model, repository contract, use case), data (repository impl, data source)
- Consider reusing the `Movie` domain and data model

## Plan

### Step 1 — Movies Domain Layer

Add `getUserWatchList` to `MoviesRepository` and create the use case.

**Files:**
- `features/movies/domain/lib/repositories/movies_repository.dart` — add method:
  ```dart
  Future<Result<MovieListing>> getUserWatchList({required String userId, required int page});
  ```

- `features/movies/domain/lib/usecases/get_user_watch_list.dart` — new file:
  ```dart
  class GetUserWatchListParams { final String userId; final int page; }
  class GetUserWatchList extends UseCase<GetUserWatchListParams, Result<MovieListing>>
  ```

- Update barrel: `usecases/usecases.dart`

### Step 2 — Movies Data Layer

Add mocked data source method and repository implementation.

**Files:**
- `features/movies/data/lib/datasources/remote/movies_remote_data_source.dart` — add:
  ```dart
  Future<Result<RemoteMovieListing>> getUserWatchList({required String userId, required int page});
  ```

- `features/movies/data/lib/datasources/remote/movies_remote_data_source_impl.dart`:
  - Static `_mockedWatchList` with ~12 `RemoteMovie` entries
  - Paginate with `_watchListPageSize = 6`, same sublist+clamp pattern

- `features/movies/data/lib/repositories/movies_repository_impl.dart` — add override

### Step 3 — DI Registration

**Files:**
- `lib/di/movies_module.dart` — add:
  ```dart
  @injectable
  GetUserWatchList getUserWatchList(MoviesRepository repository) =>
      GetUserWatchList(repository);
  ```

- Run `dart run build_runner build --delete-conflicting-outputs`

### Step 4 — UI: Watch List Screen (in `ui/movies_ui`)

Create inside `ui/movies_ui/lib/watch_list/` following the `FavoriteMoviesScreen` pattern.

**Files to create:**
- `watch_list_state.dart` — sealed class: Loading, Success, Error
- `watch_list_bloc.dart` — `WatchListCubit` with `PagingController<int, Movie>`
- `watch_list_screen.dart` — `WatchListScreen` with `PagedGridView` + `MuuvieMoviePosterCard`
- `watch_list_page.dart` — `@RoutePage()`, params: `userId`, `userName?`, AppBar: `"$userName — Watch List"` or `"Watch List"`, localized via `profileWatchlistSection`
- `watch_list_router.dart` — `@AutoRouterConfig` with `part` directive

### Step 5 — Routing

**Files:**
- `lib/routes/app_router.dart` — import router, add `AutoRoute(page: WatchListRoute.page)` to HomeTab, SocialTab, ProfileTab children
- Run codegen

### Step 6 — Wire "See All" on Public Profile

**Files:**
- `ui/public_profile/lib/public_profile_screen.dart`:
  - Change watchlist `_SectionHeader.onSeeAll` to navigate to `WatchListRoute(userId: userId, userName: user.displayName)`
  - Add import for `watch_list_router.dart`

### File Tree Summary

```
features/movies/domain/lib/
  repositories/movies_repository.dart          (modify)
  usecases/get_user_watch_list.dart            (new)
  usecases/usecases.dart                       (modify)

features/movies/data/lib/
  datasources/remote/movies_remote_data_source.dart       (modify)
  datasources/remote/movies_remote_data_source_impl.dart  (modify)
  repositories/movies_repository_impl.dart                (modify)

ui/movies_ui/lib/watch_list/
  watch_list_state.dart                        (new)
  watch_list_bloc.dart                         (new)
  watch_list_screen.dart                       (new)
  watch_list_page.dart                         (new)
  watch_list_router.dart                       (new)

lib/di/movies_module.dart                      (modify)
lib/routes/app_router.dart                     (modify)
ui/public_profile/lib/public_profile_screen.dart (modify)
```

## Progress Log
- 2026-04-10: Step 1 done — Added `getUserWatchList` to `MoviesRepository`, created `GetUserWatchList` use case
- 2026-04-10: Step 2 done — Added 12 mocked movies, data source interface/impl, repository impl
- 2026-04-10: Step 3 done — Registered `GetUserWatchList` in `movies_module.dart`
- 2026-04-10: Step 4 done — Created `WatchListCubit`, `WatchListState`, `WatchListScreen`, `WatchListPage`, `WatchListRouter` in `ui/movies_ui/lib/watch_list/`
- 2026-04-10: Step 5 done — Added `WatchListRoute` to HomeTab, SocialTab, ProfileTab in `app_router.dart`, regenerated codegen
- 2026-04-10: Step 6 done — Wired "See all" on watchlist section to navigate to `WatchListRoute` with `userId` and `userName`
- 2026-04-10: Step 1 done — Added `getUserWatchList` to `MoviesRepository`, created `GetUserWatchList` use case with params
