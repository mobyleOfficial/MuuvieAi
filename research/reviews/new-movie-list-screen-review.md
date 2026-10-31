# Architect Review: New Movie Lists Screen

**Spec:** `research/specs/new-movie-list-screen.md`
**Reviewer:** architect-review agent
**Date:** 2026-05-21
**Decision:** APPROVED_WITH_CONDITIONS

---

## Criteria Assessment

### 1. Architecture Alignment (PASS)

The spec correctly follows Clean Architecture boundaries with changes isolated to three layers: UI (new screen), domain (params extension), data (pass-through), and backend (API params). The Page/Screen split pattern is properly specified -- `AllMovieListsPage` owns the bloc lifecycle, `AllMovieListsScreen` is pure UI. This matches the established pattern in `MovieListDetailPage`/`MovieListDetailScreen` and `MoviesHomePage`/`MoviesHomeScreen`.

The cubit-not-in-DI convention is correctly followed: `AllMovieListsBloc` is created directly in `AllMovieListsPage` via `GetIt.I<GetMovieLists>()`, matching how `MoviesListsCubit` is created in `MoviesHomePage` (line 22).

### 2. Router Integration (BLOCKER -- needs correction)

The spec proposes adding `AutoRoute(page: AllMovieListsRoute.page)` to `movies_home_router.dart`. This will not work. The `MoviesHomeRouter` is configured with `@AutoRouterConfig(generateForDir: ['lib/home'])`, which means `build_runner` only scans files under `lib/home/`. Files under `lib/all_lists/` will not be discovered.

The codebase pattern is that each top-level directory under `lib/` gets its own router (e.g., `movie_list_detail_router.dart`, `watch_list_router.dart`, `favorite_movies_router.dart`). Routes are then registered in `app_router.dart` at the app level, not in `movies_home_router.dart`.

**Required fix:** The new screen needs either:
- **(a) Its own router** (`all_lists/all_movie_lists_router.dart` with `@AutoRouterConfig(generateForDir: ['lib/all_lists'])`) and a corresponding `AutoRoute(page: AllMovieListsRoute.page)` entry under the `HomeTab` children in `app_router.dart` (lines 33-41). This is the pattern used by `MovieListDetailRoute`, `FavoriteMoviesRoute`, `WatchListRoute`.
- **(b) Place files under `lib/home/all_lists/`** so they are picked up by the existing `generateForDir: ['lib/home']`. However, this breaks the flat one-folder-per-feature convention.

Option (a) is the correct approach.

### 3. Data Layer Changes (PASS with caveat)

Adding optional `query` and `sortBy` parameters to `GetMovieListsParams`, `MoviesRepository.getMovieLists()`, and `MoviesRemoteDataSource.getMovieLists()` is backward-compatible since they are optional. Existing callers pass only `page` and `userId` and will not break.

Current signatures verified:
- `GetMovieListsParams({required this.page, this.userId})` -- adding `this.query, this.sortBy` as optional is safe.
- `MoviesRepository.getMovieLists({required int page, String? userId})` -- adding `String? query, String? sortBy` is safe.
- `MoviesRemoteDataSource.getMovieLists({required int page, String? userId})` -- same.
- `MoviesRepositoryImpl.getMovieLists()` -- pass-through, safe.

**Caveat:** The spec lists `muuvie/test/helpers/fake_movies_repository.dart` as a file to modify. This file does exist but is referenced in 5 test files. The signature change is additive (optional params), so the fake just needs the new params added to the override signature with defaults. Low risk, but the implementer should run tests after the change.

### 4. Bloc Design (PASS)

The proposed `AllMovieListsBloc` correctly combines the two existing patterns:
- **Debounced search** from `NewUserActivityCubit` (`StreamController<String>` + `.distinct().debounce(Duration(milliseconds: 300))` + `_minQueryLength = 3`). Verified in `ui/user_activity/lib/new_user_activity/new_user_activity_bloc.dart`.
- **Paginated list** from `MoviesListsCubit` (`PagingController<int, MovieList>` + `_fetchPage` + `_totalPages`). Verified in `ui/movies_ui/lib/tabs/lists/movies_lists_bloc.dart`.

The key interaction (resetting `PagingController` when query or sort changes) is straightforward -- call `pagingController.refresh()` which clears pages and re-fetches from page 1. This is the standard `infinite_scroll_pagination` approach.

### 5. State Design (MINOR CONCERN)

The spec proposes a sealed state class with `AllMovieListsLoading`, `AllMovieListsSuccess`, `AllMovieListsSearching`, `AllMovieListsError`. However, since `PagingController` already manages loading/error/empty states internally (as seen in `MoviesListsScreen` using `firstPageProgressIndicatorBuilder`, `firstPageErrorIndicatorBuilder`, `noItemsFoundIndicatorBuilder`), the cubit state may be redundant for those cases.

**Recommendation:** Simplify the state to track only what `PagingController` does not: the current `sortOption` and `query`. The cubit can emit state changes for sort/query updates so the UI rebuilds the app bar, while `PagingController` handles the list loading states. This avoids fighting two state management systems.

### 6. Dependencies (PASS)

All required packages are already available in `movies_ui/pubspec.yaml`:
- `infinite_scroll_pagination: ^5.0.0` -- for `PagingController`, `PagedListView`
- `flutter_bloc: ^9.1.1` -- for `BlocProvider`, `BlocBuilder`
- `auto_route: ^11.1.0` -- for `@RoutePage()`, `context.router.push()`
- `movies` (path dependency) -- for `GetMovieLists`, `MovieList`, `MovieListListing`
- `common` (path dependency) -- for `MuuvieEmptyState`, `AppLocalizations`

The `dart:async` import for `StreamController`/`StreamSubscription` is part of the SDK, no additional dependency needed.

### 7. Submodule Boundaries (PASS)

- Frontend changes are in `muuvie/` submodule only.
- Backend changes are in `backend/` submodule only.
- No AI-tooling files introduced in either submodule.
- Meta-repo needs submodule ref bumps after both merges.
- Cross-repo coordination is straightforward: backend changes (optional query params) can be deployed independently since they are additive.

### 8. Backend Feasibility (PASS)

The spec correctly identifies that TMDB's List API does not natively support search-by-name or arbitrary sort, and recommends option (c): client-side filtering of mock data for the initial implementation. This is pragmatic and avoids blocking the frontend on a TMDB API limitation. The backend changes are minimal -- add optional query parameters to the route handler and pass them through.

### 9. Localization (PASS)

The spec identifies all required localization keys: `allLists`, `allListsSearchHint`, `allListsSortPopularity`, `allListsSortNewest`, `allListsSortAlphabetical`. Three locales (EN, ES, PT) are required per project convention.

### 10. Security (PASS)

Read-only browse feature. Search input is passed as a query parameter to the backend, which should sanitize it. No authentication changes. No new sensitive data exposure.

---

## Blockers

| # | Issue | Severity | Required Action |
|---|-------|----------|-----------------|
| B-1 | Router integration pattern is wrong | BLOCKER | Create `all_lists/all_movie_lists_router.dart` with its own `@AutoRouterConfig(generateForDir: ['lib/all_lists'])`. Register `AllMovieListsRoute` under `HomeTab` children in `app_router.dart`, not in `movies_home_router.dart`. |

## Recommendations (non-blocking)

| # | Recommendation | Rationale |
|---|---------------|-----------|
| R-1 | Simplify state class to only track `sortOption` and `query` | `PagingController` already handles loading/error/empty states. A redundant sealed state creates two sources of truth for the same UI states. |
| R-2 | Consider adding `AllMovieListsRoute` to other tabs in `app_router.dart` if list browsing should be accessible from Search or Profile tabs | Currently the spec only adds it under HomeTab. Other tabs already register `MovieListDetailRoute` for cross-tab navigation. |
| R-3 | Run `dart run build_runner build --delete-conflicting-outputs` after creating the new router | Required to generate the `.gr.dart` file for the new router and update `app_router.gr.dart`. |
| R-4 | Verify `debounce` extension availability | `NewUserActivityCubit` uses `.debounce()` on `Stream<String>`. Confirm this extension is available in `movies_ui` (likely from `common` or `core` package, or `rxdart`). |

---

## Summary

The spec is well-structured and demonstrates strong understanding of the codebase patterns (Page/Screen split, BLoC, PagingController, debounced search). The data layer changes are backward-compatible and the backend approach is pragmatic. The single blocker is the router integration pattern: the spec proposes modifying `movies_home_router.dart`, but the codebase convention requires a dedicated router per feature directory, registered at the app level in `app_router.dart`. Once corrected, the spec is ready for implementation.
