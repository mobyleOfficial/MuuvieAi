# Favorite Movies

## Status
Done

## Overview
Create the favorite movies screen and add navigate to it from public profile and user profile

## Why
I want to see the favorite movies

## Acceptance Criteria
- [ ] Show a grid of movies
- [ ] Paginate it
- [ ] Use mocked data 
- [ ] Create methods (repository and data source) to get the a user favorite movies
- [ ] Use the user id to get them
- [ ] Create the bloc, state and screen on the ui/movies_ui module
- [ ] Create a use case to get the favorite movies
- [ ] Tapping a favorite movie navigates to its detail screen
- [ ] On public profile, when tapping in "see all" on favorite movies section, navigate to the Favorite movies screen
- [ ] App bar should have the User name + Favorite Movies
- [ ] The name, on the tab bar, should be optional to send

## Notes
- Follow existing feature architecture: domain (model, repository contract, use case), data (repository impl, data source)
- Consider reusing the `Movie` domain and data model

## Plan

### Step 1 — Profile Domain Layer

Add `getUserFavoriteMovies` to `ProfileRepository` and create the use case.

**Files:**
- `features/profile/domain/lib/repositories/profile_repository.dart` — add method:
  ```dart
  Future<Result<MovieListing>> getUserFavoriteMovies({required String userId, required int page});
  ```
  Reuses `MovieListing` and `Movie` from `movies_domain` (already a dependency).

- `features/profile/domain/lib/usecases/get_user_favorite_movies.dart` — new file:
  ```dart
  class GetUserFavoriteMoviesParams {
    final String userId;
    final int page;
  }
  class GetUserFavoriteMovies extends UseCase<GetUserFavoriteMoviesParams, Result<MovieListing>>
  ```

- Update barrel: `usecases/usecases.dart`

### Step 2 — Profile Data Layer

Add mocked data source method and repository implementation.

**Files:**
- `features/movies/data/lib/datasources/remote/movies_remote_data_source.dart` — add method:
  ```dart
  Future<Result<RemoteMovieListing>> getUserFavoriteMovies({required String userId, required int page});
  ```

- `features/movies/data/lib/datasources/remote/movies_remote_data_source_impl.dart` — implement with mocked data:
  - Static list of ~12 `RemoteMovie` entries with real TMDB IDs/poster paths
  - `_pageSize = 6`, paginate using the same `sublist` + `clamp` pattern
  - `userId` param present but ignored (mock)

- `features/profile/data/lib/repositories/profile_repository_impl.dart` — add override:
  ```dart
  Future<Result<MovieListing>> getUserFavoriteMovies({required String userId, required int page}) async {
    final result = await _moviesRemoteDataSource.getUserFavoriteMovies(userId: userId, page: page);
    return switch (result) { Success => Success(data.toDomain()), Failure => Failure(error) };
  }
  ```

### Step 3 — DI Registration

**Files:**
- `lib/di/profile_module.dart` — add:
  ```dart
  @injectable
  GetUserFavoriteMovies getUserFavoriteMovies(ProfileRepository repository) =>
      GetUserFavoriteMovies(repository);
  ```

- Run `dart run build_runner build --delete-conflicting-outputs` to regenerate `injection.config.dart`

### Step 4 — UI: Favorite Movies Screen (in `ui/movies_ui`)

Create the screen inside `ui/movies_ui/lib/favorite_movies/` following the `TrendingMoviesScreen` pattern.

**Files to create:**

- `ui/movies_ui/lib/favorite_movies/favorite_movies_state.dart`:
  ```dart
  sealed class FavoriteMoviesState { ... }
  class FavoriteMoviesLoading / FavoriteMoviesSuccess / FavoriteMoviesError
  ```

- `ui/movies_ui/lib/favorite_movies/favorite_movies_bloc.dart`:
  ```dart
  class FavoriteMoviesCubit extends Cubit<FavoriteMoviesState> {
    final GetUserFavoriteMovies _getUserFavoriteMovies;
    final String userId;
    // PagingController<int, Movie> with same pattern as TrendingMoviesCubit
    // _fetchPage passes GetUserFavoriteMoviesParams(userId, page)
  }
  ```

- `ui/movies_ui/lib/favorite_movies/favorite_movies_screen.dart`:
  - `FavoriteMoviesScreen` — `StatefulWidget`, creates cubit, provides via `BlocProvider`
  - Uses `PagingListener` + `PagedGridView<int, Movie>` with `muuvieGridDelegate`
  - Each item is `MuuvieMoviePosterCard` with `onTap` navigating to `MovieDetailRoute`
  - Constructor: `required GetUserFavoriteMovies getUserFavoriteMovies, required String userId`

- `ui/movies_ui/lib/favorite_movies/favorite_movies_page.dart`:
  - `@RoutePage()` widget
  - Params: `required String userId`, `String? userName`
  - AppBar title: `userName != null ? '$userName — Favorite Movies' : 'Favorite Movies'`
  - Gets `GetUserFavoriteMovies` from `GetIt.I`

- `ui/movies_ui/lib/favorite_movies/favorite_movies_router.dart`:
  - `@AutoRouterConfig` exposing `FavoriteMoviesRoute`

- Update `ui/movies_ui/pubspec.yaml` — add `profile` dependency:
  ```yaml
  profile:
    path: ../../features/profile
  ```

### Step 5 — Routing

**Files:**
- `lib/routes/app_router.dart`:
  - Import `favorite_movies_router.dart`
  - Add `AutoRoute(page: FavoriteMoviesRoute.page)` inside `SocialTab` (after `PublicProfileRoute`), `ProfileTab`, and `HomeTab` children

- Run `dart run build_runner build --delete-conflicting-outputs`

### Step 6 — Wire "See All" on Public Profile

**Files:**
- `ui/public_profile/lib/public_profile_screen.dart`:
  - Change the favorite movies `_SectionHeader.onSeeAll` from `() {}` to navigate:
    ```dart
    onSeeAll: () => context.router.push(
      FavoriteMoviesRoute(userId: widget.userId, userName: user.displayName),
    ),
    ```
  - Add import for `FavoriteMoviesRoute`

- `ui/public_profile/pubspec.yaml` — may need no change if route is accessible via `auto_route`

### Step 7 — Localization (if needed)

- Add `profileFavoriteMoviesAppBar` key to ARB files if the app bar title "Favorite Movies" should be localized
- Or keep it simple using the existing `profileFavoriteMovies` key

### File Tree Summary

```
features/profile/domain/lib/
  repositories/profile_repository.dart         (modify)
  usecases/get_user_favorite_movies.dart       (new)
  usecases/usecases.dart                       (modify)

features/profile/data/lib/
  repositories/profile_repository_impl.dart    (modify)

features/movies/data/lib/datasources/remote/
  movies_remote_data_source.dart               (modify)
  movies_remote_data_source_impl.dart          (modify)

ui/movies_ui/lib/favorite_movies/
  favorite_movies_state.dart                   (new)
  favorite_movies_bloc.dart                    (new)
  favorite_movies_screen.dart                  (new)
  favorite_movies_page.dart                    (new)
  favorite_movies_router.dart                  (new)

lib/di/profile_module.dart                     (modify)
lib/routes/app_router.dart                     (modify)

ui/public_profile/lib/
  public_profile_screen.dart                   (modify)
```

## Progress Log
- 2026-04-10: Step 1 done — Added `getUserFavoriteMovies` to `ProfileRepository`, created `GetUserFavoriteMovies` use case with `GetUserFavoriteMoviesParams`
- 2026-04-10: Step 2 done — Added mocked data (12 movies, page size 6) to `MoviesRemoteDataSourceImpl`, added method to interface and `ProfileRepositoryImpl`
- 2026-04-10: Step 3 done — Registered `GetUserFavoriteMovies` in `profile_module.dart`
- 2026-04-10: Step 4 done — Created `FavoriteMoviesCubit`, `FavoriteMoviesState`, `FavoriteMoviesScreen`, `FavoriteMoviesPage`, `FavoriteMoviesRouter` in `ui/movies_ui/lib/favorite_movies/`
- 2026-04-10: Step 5 done — Added `FavoriteMoviesRoute` to HomeTab, SocialTab, ProfileTab in `app_router.dart`, regenerated codegen
- 2026-04-10: Step 6 done — Wired "See all" on favorite movies section to navigate to `FavoriteMoviesRoute` with `userId` and `userName`
- 2026-04-10: Step 7 done — Localized app bar title using existing `profileFavoriteMovies` key