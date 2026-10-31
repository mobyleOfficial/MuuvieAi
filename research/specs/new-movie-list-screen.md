# Feature Spec: New Movie Lists Screen

**Status:** Draft
**Priority:** High (MUST)
**Scope:** Frontend (muuvie submodule) + Backend (data layer changes for search/sort)
**Author:** pm-spec agent
**Date:** 2026-05-21

---

## 1. Overview

Add an "All lists" button to the existing **Lists tab** on the Movies home screen. Tapping this button navigates to a **new, dedicated screen** that displays all movie lists with three capabilities: **pagination**, **debounced search**, and **sorting**. The new screen follows the Page/Screen split pattern and has its own Bloc, states, and dedicated UI files.

The search behavior replicates the pattern established by `NewUserActivityCubit`: a `StreamController<String>` with 300ms debounce and a minimum query length of 3 characters. Sorting allows the user to reorder the list by different criteria (e.g., popularity, recently created, alphabetical).

---

## 2. User Stories

**US-1: Access all movie lists**
As a user, I want to tap an "All lists" button on the Lists tab so I can browse the complete catalog of movie lists beyond just the popular ones.

**US-2: Paginated browsing**
As a user, I want the all-lists screen to load more results as I scroll down, so I can browse large catalogs without long initial load times.

**US-3: Search movie lists**
As a user, I want to type in a search field to find specific movie lists by name, with results appearing automatically after I pause typing (debounced), so I can quickly find lists I am interested in.

**US-4: Sort movie lists**
As a user, I want to sort the movie lists by different criteria (e.g., popularity, newest, alphabetical) so I can organize the results in the way most useful to me.

**US-5: Navigate to list details**
As a user, I want to tap on any movie list item and see its details, same as the current behavior.

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | The Lists tab on the Movies home screen shows an "All lists" button (localized EN/ES/PT) below the "Popular this week" header or at the top of the list | Visual inspection |
| AC-2 | Tapping "All lists" navigates to a new full screen (not a tab, not a modal) | Navigation test |
| AC-3 | The new screen displays a paginated list of movie lists using `MoviesListTile` widgets | Scroll to trigger next page load |
| AC-4 | The new screen has a search field (using `MuuvieEditText` or `TextField`) in the app bar or below it | Visual inspection |
| AC-5 | Typing in the search field triggers a debounced search (300ms delay, minimum 3 characters) | Type 2 chars = no search; type 3+ chars = search fires after 300ms pause |
| AC-6 | Clearing the search field or reducing below 3 chars returns to the default paginated list | Clear field, verify original list restores |
| AC-7 | The new screen has a sort control (dropdown, icon button, or bottom sheet) with at least 2 sort options | Visual inspection |
| AC-8 | Changing the sort order refreshes the list with the new sort applied | Select different sort, verify list reorders |
| AC-9 | Tapping a `MoviesListTile` navigates to `MovieListDetailRoute` with correct `listId`, `listName`, `posterPaths` | Tap item, verify detail screen |
| AC-10 | Loading state shows `CircularProgressIndicator`, error state shows `MuuvieEmptyState` with retry, empty state shows `MuuvieEmptyState` | Test each state |
| AC-11 | All user-facing strings are localized (EN, ES, PT) | Switch locale |
| AC-12 | The new screen has a back button / app bar to return to the home screen | Navigation test |

---

## 4. Technical Notes

### 4.1 New Files to Create

All new files live under `muuvie/ui/movies_ui/lib/all_lists/`:

| File | Purpose |
|------|---------|
| `all_movie_lists_page.dart` | `@RoutePage()` StatefulWidget. Creates the `AllMovieListsBloc`, provides it via `BlocProvider`, renders `AllMovieListsScreen`. Disposes bloc on close. |
| `all_movie_lists_screen.dart` | Stateless UI. Receives bloc. Renders app bar with search field, sort control, and paginated `PagedListView<int, MovieList>` body. Manages `TextEditingController` and `FocusNode` for search. |
| `all_movie_lists_bloc.dart` | `AllMovieListsBloc extends Cubit<AllMovieListsState>`. Manages `PagingController<int, MovieList>`, debounced search via `StreamController<String>` (300ms, min 3 chars), and current sort selection. Resets pagination when search query or sort changes. |
| `all_movie_lists_state.dart` | Sealed class: `AllMovieListsLoading`, `AllMovieListsSuccess(sortOption, query)`, `AllMovieListsSearching`, `AllMovieListsError(message)`. |

### 4.2 Files to Modify

| File | Change |
|------|--------|
| `muuvie/ui/movies_ui/lib/tabs/lists/movies_lists_screen.dart` | Add an "All lists" button. Placement: either as a persistent header/row above the list, or as the first item. The button triggers navigation to `AllMovieListsRoute`. |
| `muuvie/ui/movies_ui/lib/home/movies_home_router.dart` | Add `AutoRoute(page: AllMovieListsRoute.page)` to the router's routes list. |
| `muuvie/features/movies/domain/lib/usecases/get_movie_lists.dart` | Add optional `query` and `sortBy` fields to `GetMovieListsParams`. Pass them through to the repository. |
| `muuvie/features/movies/domain/lib/repositories/movies_repository.dart` | Add optional `query` and `sortBy` parameters to `getMovieLists()` method signature. |
| `muuvie/features/movies/data/lib/repositories/movies_repository_impl.dart` | Pass `query` and `sortBy` through to the data source. |
| `muuvie/features/movies/data/lib/datasources/remote/movies_remote_data_source.dart` | Add `query` and `sortBy` params to `getMovieLists()` interface. |
| `muuvie/features/movies/data/lib/datasources/remote/movies_remote_data_source_impl.dart` | Implement `query` and `sortBy` — pass as query parameters to the backend API call (or filter mock data locally). |
| `muuvie/test/helpers/fake_movies_repository.dart` | Update `getMovieLists` signature to include new optional params. |
| Localization `.arb` files (EN, ES, PT) | Add keys: `allLists` ("All lists"), `allListsSearchHint` ("Search lists..."), `allListsSortPopularity` ("Popularity"), `allListsSortNewest` ("Newest"), `allListsSortAlphabetical` ("A-Z"), and any other sort labels. |

### 4.3 Backend / API Impact

The current `GET /movies/lists` endpoint accepts `page` and `userId`. To support search and sort, it needs two new optional query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | `String?` | Filter lists by name (case-insensitive contains match) |
| `sortBy` | `String?` | Sort order. Values: `popularity.desc` (default), `created_at.desc`, `name.asc` |

**Backend files to modify:**
- `backend/src/main/kotlin/org/mobyle/routing/MoviesRouting.kt` — parse `query` and `sortBy` from request params
- `backend/src/main/kotlin/org/mobyle/domain/usecase/movies/GetMovieLists.kt` — add params
- `backend/src/main/kotlin/org/mobyle/domain/repository/MoviesRepository.kt` — add params to interface
- `backend/src/main/kotlin/org/mobyle/data/repository/MoviesRepositoryImpl.kt` — pass params to TMDB API or filter locally

**Note:** TMDB's List API (`/list/popular`) does not natively support search by name or arbitrary sort. The backend will need to either:
- (a) Use a different TMDB endpoint if one supports list search, or
- (b) Implement server-side filtering/sorting on cached or paginated results, or
- (c) Start with client-side filtering of the mock data source, deferring real API integration.

Option (c) is recommended for the initial implementation since the datasource is currently mock-based.

### 4.4 Bloc Design (AllMovieListsBloc)

```
class AllMovieListsBloc extends Cubit<AllMovieListsState> {
  // Dependencies
  final GetMovieLists _getMovieLists;

  // Search debounce (matches NewUserActivityCubit pattern)
  final StreamController<String> _queryController;
  late final StreamSubscription<String> _querySubscription;
  static const _debounceDuration = Duration(milliseconds: 300);
  static const _minQueryLength = 3;

  // Pagination
  late final PagingController<int, MovieList> pagingController;
  int _totalPages = 1;

  // Current filters
  String _currentQuery = '';
  MovieListSortOption _currentSort = MovieListSortOption.popularity;

  // Methods
  void onSearchChanged(String query);   // feeds _queryController
  void onSortChanged(MovieListSortOption sort);  // updates sort, resets paging
  Future<List<MovieList>> _fetchPage(int page);  // calls use case with query + sort
}
```

### 4.5 Sort Options Enum

```
enum MovieListSortOption {
  popularity,   // "popularity.desc" — default
  newest,       // "created_at.desc"
  alphabetical, // "name.asc"
}
```

### 4.6 "All Lists" Button Placement

Recommended: Add a row with an "All lists" text button (with a forward arrow icon) between the "Popular this week" header and the first list item in `MoviesListsScreen`. This keeps the existing list behavior intact and provides a clear entry point.

Alternative: Place it as a floating action button or in the app bar. The header-adjacent approach is preferred because it is visible without scrolling and follows the pattern of discovery buttons seen in other apps.

### 4.7 Existing Patterns to Follow

- **Debounced search:** `NewUserActivityCubit` — `StreamController<String>`, `.distinct().debounce(Duration(milliseconds: 300))`, `_minQueryLength = 3`.
- **Paginated list with cubit:** `MoviesListsCubit` / `FeaturedListsCubit` — `PagingController<int, MovieList>`, `_fetchPage`, `_totalPages`.
- **Page/Screen split:** All UI modules follow the 4-file pattern (`*_page.dart`, `*_screen.dart`, `*_bloc.dart`, `*_state.dart`). Page creates the cubit, screen is pure UI.
- **List item widget:** `MoviesListTile` — reuse as-is.
- **Navigation:** `context.router.push(AllMovieListsRoute())` via auto_route.
- **Text input:** `MuuvieEditText` or standard `TextField` with `InputDecoration`.

### 4.8 DI / Registration

`GetMovieLists` is already registered in GetIt via `MoviesDiModule`. No new DI registrations are needed. The `AllMovieListsBloc` is created directly in `AllMovieListsPage` (cubits are not registered in DI per project convention).

---

## 5. Cross-Repo Impact

| Repo | Impact |
|------|--------|
| **muuvie** (frontend) | Primary target. New screen under `ui/movies_ui/lib/all_lists/`. Modifications to `MoviesListsScreen` (add button), router, use case params, repository interface, data source. Localization updates. |
| **backend** | Add `query` and `sortBy` query parameters to `GET /movies/lists` endpoint. Update use case, repository interface, and implementation. Low effort since current impl returns mock data. |
| **MuuvieAi** (meta-repo) | Submodule ref bumps for both `muuvie` and `backend` after merge. |

---

## 6. Out of Scope

- **Creating or editing movie lists.** This feature is read-only browse/search/sort.
- **Filtering by genre, year, or other criteria.** Only search-by-name and sort are in scope.
- **Changing the existing Lists tab behavior.** The current paginated "Popular this week" list remains as-is; we only add the "All lists" entry point.
- **Offline caching or local persistence of search history.** Search is live/network-only.
- **Real TMDB list-search API integration.** The initial implementation works against the mock data source. Real API integration is a follow-up when the backend connects to TMDB endpoints that support list search.

---

## 7. Open Questions

| # | Question | Impact |
|---|----------|--------|
| OQ-1 | What sort options should be available? This spec proposes Popularity (default), Newest, and Alphabetical (A-Z). Are additional options needed (e.g., most items, highest rated)? | Enum definition, localization strings, backend sort support |
| OQ-2 | Should the search field be always visible in the app bar, or toggled via a search icon button (expanding/collapsing)? The request mentions "search button/field" which could mean either. | UI layout decision |
| OQ-3 | Where exactly should the "All lists" button be placed on the Lists tab? Options: (a) between the header and first item, (b) as a persistent floating button, (c) in a section header row. This spec recommends (a). | UI layout |
| OQ-4 | Should the search also filter by list description/creator, or only by list name? | Backend query logic |
| OQ-5 | When the user is searching, should pagination still apply to search results, or should search return all matches at once (up to a limit)? This spec assumes paginated search results. | Bloc + API design |
| OQ-6 | Should the sort persist across sessions (e.g., saved to local preferences), or reset to default (Popularity) each time the screen opens? | State management scope |
