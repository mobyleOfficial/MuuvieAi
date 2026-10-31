# Architect Review: Update Movie Lists Screen

**Spec:** `research/specs/update-movie-list.md`
**Reviewer:** architect-review agent
**Date:** 2026-05-21
**Decision:** APPROVED_WITH_CONDITIONS

---

## Criteria Assessment

### 1. Architecture Alignment (PASS)

The spec stays within Clean Architecture boundaries. All changes are confined to the UI layer (`ui/search/`). No domain or data layer modifications are needed. The Page/Screen split pattern is preserved -- `FeaturedListsPage` owns cubit lifecycle, `FeaturedListsScreen` renders the paginated list.

### 2. Ecosystem Fit (PASS)

The proposed implementation follows established Flutter/Dart patterns already present in the codebase:

- **BLoC/Cubit pattern:** Both `FeaturedListsCubit` and `MoviesListsCubit` follow the identical pattern -- sealed state classes, `PagingController<int, MovieList>`, `_fetchPage`, `_totalPages`, `close()` disposing the controller. Verified in `featured_lists_bloc.dart` and `movies_lists_bloc.dart`.
- **Tabbed layout:** The `_SearchResultsSection` in `search_screen.dart` (lines 97-155) already uses `DefaultTabController` + `MuuvieTabBar` + `TabBarView` + `MuuvieKeepAliveTab`. The spec correctly identifies this as the pattern to follow.
- **Paginated lists:** `PagingListener` + `PagedListView` + `PagedChildBuilderDelegate` is the standard pattern, used identically in `FeaturedListsScreen`, `_ListsResultsTab`, and `_ReviewsResultsTab`.

### 3. Submodule Boundaries (PASS)

- Frontend-only change in the `muuvie` submodule. No backend changes.
- No AI-tooling files introduced in the submodule.
- Meta-repo only needs a submodule ref bump after merge.

### 4. Feasibility (PASS)

All building blocks exist and are verified:

| Component | Location | Status |
|-----------|----------|--------|
| `GetFeaturedLists` use case | `features/movies/domain/lib/usecases/get_featured_lists.dart` | Exists, registered in DI (`movies_di_module.dart:15`) |
| `GetMovieLists` use case | `features/movies/domain/lib/usecases/get_movie_lists.dart` | Exists, registered in DI |
| `FeaturedListsCubit` | `ui/search/lib/featured_lists/featured_lists_bloc.dart` | Exists, exposes `PagingController<int, MovieList>` |
| `MoviesListsCubit` | `ui/movies_ui/lib/tabs/lists/movies_lists_bloc.dart` | Exists, exposes `PagingController<int, MovieList>` |
| `MuuvieKeepAliveTab` | `ui/common/lib/src/muuvie_keep_alive_tab.dart` | Exists, uses `AutomaticKeepAliveClientMixin` |
| `MuuvieTabBar` | `ui/common/lib/src/muuvie_tab_bar.dart` | Exists |
| `MoviesListTile` | `ui/movies_ui/lib/tabs/lists/movies_list_tile.dart` | Exists, already used in both screens |
| `MovieListDetailRoute` | `ui/movies_ui/lib/movie_list_detail/movie_list_detail_router.dart` | Exists |

### 5. Dependencies (PASS)

No new packages or DI registrations required. Both use cases are already in GetIt via `movies_di_module.dart`. `MoviesListsCubit` is importable from the `movies_ui` package (already a dependency of `search` -- confirmed by its use in `_ListsResultsTab` at `search_screen.dart:361`).

### 6. Security (PASS)

Read-only browse feature. No user input beyond scrolling and tapping. No authentication required. No new API calls -- reuses existing TMDB proxy endpoints.

### 7. Performance (PASS with note)

- Pagination via `PagingController` ensures on-demand loading.
- `MuuvieKeepAliveTab` preserves scroll state but keeps all three tab widget trees in memory. For three tabs of list items this is acceptable. If the number of tabs were to grow, consider lazy initialization.
- Each tab gets its own cubit instance, so pagination state is independent and correct.

### 8. Testing (PASS)

- `FeaturedListsCubit` and `MoviesListsCubit` are independently testable (mock the use case, verify paging behavior).
- Widget tests can verify tab rendering, tab switching, and navigation via `MovieListDetailRoute`.
- The existing test patterns for `_ListsResultsTab` and `FeaturedListsScreen` provide a template.

---

## Conditions for Approval

### C1: FeaturedListsScreen type coupling (MUST address)

`FeaturedListsScreen` currently takes `FeaturedListsCubit cubit` as its parameter and accesses `cubit.pagingController`. The "Popular" and "All Lists" tabs need `MoviesListsCubit`, which is a different type. The spec acknowledges this (section 4.3, paragraph 3) but leaves it as an open question (OQ-4).

**Recommendation:** Refactor `FeaturedListsScreen` to accept a `PagingController<int, MovieList>` directly instead of a typed cubit. Both cubits expose `pagingController` of the same generic type, so the screen body only needs the controller. This is a minimal change (one parameter type swap) and avoids duplicating the screen widget three times.

Alternatively, create a small shared `MovieListTabContent` widget that takes a `PagingController<int, MovieList>`. Either approach works; the key is that the implementer must resolve this type mismatch before the tabs can share a single screen widget.

### C2: "All Lists" vs "Popular" data differentiation (SHOULD address)

OQ-1 is valid -- both tabs currently call the same `getMovieLists()` with identical parameters. For launch this is acceptable (the tabs serve as a UI skeleton), but the implementer should add a `// TODO: differentiate sort/filter for "All Lists" tab` comment so it is not forgotten. Consider adding a `sortBy` parameter to `GetMovieListsParams` in a follow-up.

---

## Recommendations (non-blocking)

1. **OQ-2 (label):** Rename to "Movie Lists" -- it better reflects the tabbed content and avoids confusion with a single "featured" list.

2. **OQ-3 (default tab):** Index 0 ("Popular this week") is the right default -- it surfaces the most timely content.

3. **File renaming:** The spec wisely defers renaming `FeaturedLists*` to `MovieLists*`. Agree -- do it in a follow-up to keep the diff focused.

4. **AppBar title:** The spec does not mention the AppBar title for the new tabbed screen. The implementer should set it to the localized "Movie Lists" string for consistency with the browse item label.

---

## Cross-Repo Impact Assessment

| Repo | Impact | Action Required |
|------|--------|----------------|
| muuvie (frontend) | UI changes in `ui/search/lib/featured_lists/` + localization `.arb` files | Primary implementation target |
| backend | None | No action |
| MuuvieAi (meta-repo) | Submodule ref bump | After muuvie PR merges |

No cross-repo coordination needed. This is a self-contained frontend change.

---

## Summary

The spec is well-researched and accurately identifies all existing components. The proposed approach is the simplest path -- reusing existing cubits, widgets, and patterns rather than creating new abstractions. The only mandatory condition is resolving the type coupling between `FeaturedListsScreen` and `FeaturedListsCubit` so the screen widget can be shared across all three tabs. With that addressed, this feature is straightforward to implement.
