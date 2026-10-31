# Feature Spec: Update Movie Lists Screen

**Status:** Draft
**Priority:** High (MUST)
**Scope:** Frontend-only (muuvie submodule)
**Author:** pm-spec agent
**Date:** 2026-05-21

---

## 1. Overview

Replace the current single-list "Featured Lists" browse screen with a tabbed Movie Lists screen containing three tabs: **"Popular this week"**, **"Popular"**, and **"All Lists"**. Each tab displays a paginated list of movie lists using the existing `MoviesListTile` widget. Scroll position is preserved when switching tabs. Tapping a list item navigates to the existing `MovieListDetailRoute`.

The "Featured Lists" browse item on the Search screen will be renamed to "Movie Lists" (or equivalent localized label) and will navigate to the new tabbed screen instead of the current `FeaturedListsPage`.

---

## 2. User Stories

**US-1: Browse movie lists by category**
As a user, I want to browse movie lists organized into "Popular this week", "Popular", and "All Lists" tabs so I can discover lists that match my interest.

**US-2: Preserve scroll position across tabs**
As a user, I want my scroll position preserved when I switch between tabs so I do not lose my place.

**US-3: Navigate to list details**
As a user, I want to tap on any movie list item and see its details, same as today.

**US-4: Paginated loading**
As a user, I want each tab to load more lists as I scroll down, so I can browse large catalogs without waiting for everything to load upfront.

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | The "Featured Lists" browse item label changes to "Movie Lists" (localized) | Visual inspection |
| AC-2 | Tapping "Movie Lists" opens a screen with a `MuuvieTabBar` showing 3 tabs | Visual inspection |
| AC-3 | **"Popular this week"** tab fetches from `GetFeaturedLists` use case (proxying `/trending/list/week` or current featured endpoint) and paginates | Scroll to trigger next page load |
| AC-4 | **"Popular"** tab fetches from `GetMovieLists` use case (proxying `/list/popular` or current popular endpoint) and paginates | Scroll to trigger next page load |
| AC-5 | **"All Lists"** tab fetches from `GetMovieLists` use case and paginates | Scroll to trigger next page load |
| AC-6 | Switching tabs preserves scroll position of previously visited tabs | Switch away and back; position unchanged |
| AC-7 | Tapping a `MoviesListTile` navigates to `MovieListDetailRoute` with correct `listId`, `listName`, `posterPaths` | Tap item, verify detail screen |
| AC-8 | Each tab shows loading indicator on first page, empty state when no results, error state with retry | Test each state |
| AC-9 | Tab labels are localized (EN, ES, PT) | Switch locale |

---

## 4. Technical Notes

### 4.1 Data Sources Already Available

The required data layer is already in place. No new use cases, repositories, or data sources need to be created:

- **`GetFeaturedLists`** (`muuvie/features/movies/domain/lib/usecases/get_featured_lists.dart`) — fetches curated/trending lists. Will power the "Popular this week" tab.
- **`GetMovieLists`** (`muuvie/features/movies/domain/lib/usecases/get_movie_lists.dart`) — fetches general popular lists. Will power the "Popular" and "All Lists" tabs.

Both return `Result<MovieListListing>` which contains `totalPages` and `List<MovieList>`, fully compatible with the existing `PagingController` pattern.

> **Note on "All Lists" vs "Popular":** Currently both tabs would hit the same `getMovieLists()` endpoint. If a distinct sort/filter is desired for "All Lists" (e.g., chronological or alphabetical), a new `sortBy` parameter could be added to `GetMovieListsParams`. This is flagged as an open question (see section 7). For the initial implementation, both can use the same endpoint with the understanding that the backend/mock can be differentiated later.

### 4.2 Files to Modify

| File | Change |
|------|--------|
| `muuvie/ui/search/lib/featured_lists/featured_lists_page.dart` | **Rewrite** — becomes the new tabbed `MovieListsPage` with `DefaultTabController(length: 3)`, `MuuvieTabBar`, and three `MuuvieKeepAliveTab` children. Each tab instantiates its own Cubit. |
| `muuvie/ui/search/lib/featured_lists/featured_lists_screen.dart` | **Rewrite** — becomes `MovieListsScreen` with the tab layout. Alternatively, keep `FeaturedListsScreen` as-is and use it as the content widget for each tab (it already accepts a cubit). |
| `muuvie/ui/search/lib/featured_lists/featured_lists_bloc.dart` | **No change needed** — `FeaturedListsCubit` already works for the "Popular this week" tab. The "Popular" and "All Lists" tabs can reuse `MoviesListsCubit` from `movies_ui`. |
| `muuvie/ui/search/lib/featured_lists/featured_lists_state.dart` | **No change needed** unless renaming. |
| `muuvie/ui/search/lib/search_screen.dart` | **Modify** — update the `_BrowseItem` for "Featured Lists": change label to localized "Movie Lists" string, keep icon and route. |
| `muuvie/ui/search/lib/search_router.dart` | **No change needed** — the route name `FeaturedListsRoute` can stay or be renamed. |
| Localization files (EN, ES, PT `.arb`) | **Modify** — add keys for tab labels: `movieListsPopularThisWeek`, `movieListsPopular`, `movieListsAllLists`, and update `searchBrowseFeaturedLists` to "Movie Lists". |

### 4.3 Recommended Implementation Approach

The simplest approach reuses existing widgets and cubits without creating new files:

1. **`FeaturedListsPage`** becomes a `StatefulWidget` that:
   - Creates a `DefaultTabController(length: 3)`
   - Instantiates three cubits in `initState`/`late final`:
     - `FeaturedListsCubit(GetIt.I<GetFeaturedLists>())` for "Popular this week"
     - `MoviesListsCubit(GetIt.I<GetMovieLists>())` for "Popular"
     - `MoviesListsCubit(GetIt.I<GetMovieLists>())` for "All Lists"
   - Disposes all three in `dispose()`

2. **Screen body** uses:
   ```
   Column(
     children: [
       MuuvieTabBar(tabs: [l10n.popularThisWeek, l10n.popular, l10n.allLists]),
       Expanded(
         child: TabBarView(
           children: [
             MuuvieKeepAliveTab(child: FeaturedListsScreen(cubit: _popularThisWeekCubit)),
             MuuvieKeepAliveTab(child: FeaturedListsScreen(cubit: _popularCubit)),
             MuuvieKeepAliveTab(child: FeaturedListsScreen(cubit: _allListsCubit)),
           ],
         ),
       ),
     ],
   )
   ```

3. **`FeaturedListsScreen`** already accepts a cubit and renders a `PagedListView<int, MovieList>` with `MoviesListTile`. It can be reused as-is for all three tabs if the "Popular" and "All Lists" cubits expose the same `pagingController` type.

   However, `FeaturedListsCubit` uses `GetFeaturedLists` while the other two tabs need `MoviesListsCubit` (which uses `GetMovieLists`). Both cubits expose `PagingController<int, MovieList>`, so the screen widget can be generalized to accept a `PagingController<int, MovieList>` directly instead of a typed cubit. Alternatively, create a small adapter or just duplicate the screen content inline.

4. **`MuuvieKeepAliveTab`** wraps each tab to preserve scroll state via `AutomaticKeepAliveClientMixin` (already used in the search results tabs pattern in `search_screen.dart`).

### 4.4 Existing Patterns to Follow

- **Tabbed screens:** `_SearchResultsSection` in `search_screen.dart` (lines 97-155) — uses `DefaultTabController`, `MuuvieTabBar`, `TabBarView`, `MuuvieKeepAliveTab`.
- **Paginated list cubit:** `FeaturedListsCubit` and `MoviesListsCubit` — both use `PagingController<int, MovieList>`, `_fetchPage`, `_totalPages`, `PagedListView`.
- **List item widget:** `MoviesListTile` — used identically in `FeaturedListsScreen`, `MoviesListsScreen`, and `_ListsResultsTab`.
- **Navigation:** `MovieListDetailRoute(listId, listName, posterPaths)` via `context.router.push()`.

### 4.5 DI / Registration

No new DI registrations needed. `GetFeaturedLists` and `GetMovieLists` are already registered in GetIt. `MoviesListsCubit` is already importable from `movies_ui` package.

---

## 5. Cross-Repo Impact

| Repo | Impact |
|------|--------|
| **muuvie** (frontend) | Primary target. UI changes only within `ui/search/lib/featured_lists/` and `search_screen.dart`. Localization `.arb` file updates. |
| **backend** | **None.** All required API endpoints are already proxied. The mock data source already serves both `getFeaturedLists()` and `getMovieLists()`. |
| **MuuvieAi** (meta-repo) | Submodule ref bump after merge. |

---

## 6. Out of Scope

- **New backend endpoints.** No new TMDB proxy routes. If "All Lists" needs a distinct sort order in the future, that is a separate backend task.
- **Search within lists.** No search/filter within the tabbed screen.
- **List creation or editing.** This is a read-only browse feature.
- **Removing the "Popular this week" header** from `MoviesListsScreen` in `movies_ui`. That header (`showPopularHeader`) is used elsewhere (home tab) and should not be affected.
- **Renaming files/classes** from `FeaturedLists*` to `MovieLists*`. Optional refactor — not required for functionality. Can be done in a follow-up.

---

## 7. Open Questions

| # | Question | Impact |
|---|----------|--------|
| OQ-1 | Should "All Lists" use a different sort order or endpoint than "Popular"? Currently both would call `getMovieLists()`. If chronological or alphabetical sorting is needed, `GetMovieListsParams` needs a `sortBy` field and the backend/mock needs to support it. | Data layer change if yes |
| OQ-2 | Should the browse item label change from "Featured Lists" to "Movie Lists", or remain as "Featured Lists" while the inner tabs provide the categorization? | Localization strings |
| OQ-3 | Which tab should be selected by default when the screen opens? Assumed: "Popular this week" (index 0). | UX decision |
| OQ-4 | Should the `FeaturedListsScreen` widget be refactored to accept a `PagingController<int, MovieList>` instead of a `FeaturedListsCubit`, making it reusable across cubit types? Or should we create a shared `MovieListTabContent` widget? | Implementation detail |
