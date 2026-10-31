# Comments Feature Architecture Review

**Date:** 2026-05-15
**Reviewer:** Architect Review Agent
**Specification:** `research/specs/comments-feature.md`
**Decision:** ✅ **APPROVED**

---

## Executive Summary

The comments feature specification aligns well with the project's Clean Architecture patterns, BLoC state management approach, and feature-based structure. The proposal demonstrates solid understanding of the ecosystem's conventions and is technically feasible with the current tech stack. No blocking issues identified. Minor clarifications recommended before implementation.

---

## Detailed Evaluation

### 1. Architecture Alignment ✅

**Status:** APPROVED

The specification correctly identifies and implements the three-layer architecture:

- **Domain Layer** (`features/comments/domain/`) — Repository contracts, entities, and use cases with zero external dependencies
- **Data Layer** (`features/comments/data/`) — Remote data source, repository implementation, and models
- **UI Layer** (`ui/comments/`) — Three-file BLoC pattern (state, bloc, screen)

The dependency direction `UI → Data → Domain` matches the existing movies feature structure exactly. The use of sealed states (`Loading`, `Success`, `Error`) for the Cubit aligns with patterns in `social`, `search`, and `public_profile` UI modules. Use of `Result<T>` for error handling via data sources mirrors the existing implementation in `MoviesRemoteDataSource`.

**Evidence:** Specification §"Architecture Overview" + comparison against `muuvie/features/movies/` structure confirms alignment.

---

### 2. Feasibility ✅

**Status:** APPROVED

The feature is fully implementable with the project's current stack:

- **Flutter/Dart:** BLoC via `flutter_bloc: ^9.1.1` (already in `pubspec.yaml`)
- **Pagination:** `infinite_scroll_pagination: ^5.0.0` already as a dependency
- **HTTP/Mocking:** `core` package's `HttpClient` + mocked data source pattern proven
- **DI:** `injectable: ^2.5.0` and `get_it: ^8.0.3` fully support the proposed module registration

The use of sealed classes for state, Cubit for state management, and factory construction for use cases all follow established patterns in the codebase. Mocking 30+ comments across 3+ content types is straightforward—no external API complexity required for MVP.

**Evidence:** All required dependencies present in `muuvie/pubspec.yaml`; DI pattern proven in `lib/di/injection.config.dart` and `muuvie/features/movies/data/lib/di/movies_di_module.dart`.

---

### 3. Submodule Boundaries ✅

**Status:** APPROVED

Clear frontend/backend separation maintained:

- **Frontend only:** Comments feature lives entirely in `muuvie/` (feature package + UI module)
- **Backend deferred:** Specification explicitly defers real endpoint to Phase 2 ("Backend will implement real endpoint in Phase 2")
- **AI-agnostic submodules:** Specification makes no reference to Claude-specific configuration, CLAUDE.md, or .claude/ folders in child repos
- **API contract defined:** Section "Backend API Contract (Future)" provides clear contract for backend team when ready

**No critical issues with rules/AI_AGNOSTIC_SUBMODULES.md or rules/NO_COAUTHORS.md identified** — the specification is ready for a single human author to implement.

**Evidence:** Specification §"Backend API Contract (Future)" + §"Cross-Repo Impact" explicitly defers backend work.

---

### 4. Dependencies ✅

**Status:** APPROVED

All required dependencies identified and available:

**Feature-level:**
- `comments` (main feature package)
- `comments_domain` (domain sub-package)
- `comments_data` (data sub-package)

**UI-level:**
- `comments_ui` (BLoC + screen)

**Core utilities:**
- `core` (for `Result<T>`, `HttpClient`, base use case classes)
- `injectable` (for DI)
- `flutter_bloc` (for Cubit)
- `infinite_scroll_pagination` (optional but recommended for "Load More" UX)

No circular dependencies detected. The specification correctly avoids data-layer imports in UI (only depends on feature barrel file which re-exports domain).

**Recommendation:** Consider also adding `common` as a UI module dependency if custom widgets (e.g., shimmer loaders, error states) need localization.

**Evidence:** Specification §"Dependency Injection" correctly identifies module structure; comparison against movies feature confirms no missing dependencies.

---

### 5. Security ✅

**Status:** APPROVED – MINOR NOTES

Security posture is appropriate for MVP:

- **No authentication required:** Mocked data source removes API key/token concerns for MVP
- **Avatar URL validation:** Specification mentions "Realistic author names and avatar URLs" but doesn't explicitly address network image loading security. **Recommend:** Use `CachedNetworkImage` from `cached_network_image` package with safe error handling and placeholder; validate URLs before loading
- **Content sanitization:** Mocked comments avoid XSS risk; when backend integrated, ensure HTML/script injection is prevented (e.g., don't use `Html` widget without sanitization)
- **Rate limiting:** Mocked data eliminates concerns for MVP; when backend integrated, implement pagination limits and consider rate limiting

**Action items for implementation phase:**
1. Use a network image caching library with safe fallbacks
2. Validate avatar URLs (domain whitelist if needed)
3. Add a note in backend API contract about content escaping

**Evidence:** No security vulnerabilities in mocked approach; backend API contract section is template-ready for security review.

---

### 6. Performance ✅

**Status:** APPROVED

Pagination and state management strategy is sound:

- **Page size (default 10):** Reasonable for mobile UX; balances rendering performance and network payload
- **Pagination logic:** `page * pageSize` indexing with `hasMore` flag is straightforward and matches REST best practices
- **No local caching (MVP):** Correct decision for MVP ("All comments fetched via remote HTTP data source only"); avoids sync complexity
- **BLoC emission:** Cubit will emit `Loading → Success` / `Loading → Error` states, allowing UI to show loaders and handle failures gracefully
- **Image loading:** Avatar URLs will load asynchronously; use `FadeInImage` or `CachedNetworkImage` to avoid janky rendering
- **List rendering:** With `infinite_scroll_pagination` package, can implement "Load More" button or infinite scroll without rebuilding entire list

**Recommendations:**
- Pre-load next page in background when user scrolls near end of list
- Use `ListView.builder` to render comments (not all at once)
- Consider shimmer loaders for avatar images

**Evidence:** Specification §"Acceptance Criteria" correctly enforces pagination (`default page size: 10`); state management approach mirrors proven pattern in `SearchScreen` and `MovieDetailScreen`.

---

### 7. Testing ✅

**Status:** APPROVED

Testability is built in:

- **Use case unit tests:** One use case (`GetCommentsUseCase`) will be trivial to test; just mock the repository and verify it returns domain-mapped results
- **Data source testing:** Mock data source is self-contained; no external dependencies
- **Repository testing:** Test that it correctly delegates to data source and maps `.toDomain()`
- **Widget testing:** `CommentsScreen` can be tested by mocking the Cubit and verifying UI renders based on state
- **Bloc testing:** `CommentsCubit` can be tested via `bloc_test` package (not yet in dependencies but simple to add)

**Sample test structure:**
```
test/
  features/
    comments/
      data/
        repositories/
          comments_repository_impl_test.dart
      domain/
        usecases/
          get_comments_test.dart
      presentation/
        pages/
          comments_screen_test.dart
        cubits/
          comments_cubit_test.dart
```

**Action item:** Add `bloc_test: ^11.0.0` to dev dependencies for Cubit testing.

**Evidence:** Specification §"Acceptance Criteria" requires "All public use cases have unit tests"; architecture is mockable at all layers (data source is mocked for MVP, repository and cubit are easily testable).

---

### 8. DI Checklist ✅

**Status:** APPROVED

Specification correctly identifies all DI steps required per `rules/feature-implementation.md`:

**Checklist (from rules/feature-implementation.md):**

1. ✅ **Create `lib/di/comments_module.dart`** — Specification §"Dependency Injection" identifies this file and structure
2. ✅ **Update `lib/di/injection.config.dart`** — Specification explicitly mentions updating this file; instructions clear
3. ✅ **Add feature to main `pubspec.yaml`** — Implied in "Update main `pubspec.yaml` to depend on comments feature + UI module"
4. ✅ **Add domain/data to UI module `pubspec.yaml` if needed** — Implied; `ui/comments` should depend on `comments_domain` if UI directly consumes entities

**DI Module Structure (from spec):**
- Register `CommentsRemoteDataSource` as `@injectable`
- Register `CommentsRepository` as `@lazySingleton(as: CommentsRepository)`
- Register `GetCommentsUseCase` as `@injectable` (factory)

This matches the pattern in `movies/data/lib/di/movies_di_module.dart` exactly.

**Evidence:** Specification §"Dependency Injection" provides complete DI registration strategy matching existing codebase conventions.

---

### 9. Code Quality & Conventions ✅

**Status:** APPROVED

Specification enforces quality standards:

- ✅ "Comments are fully typed, no `dynamic`" — Enforces type safety per `rules/variable-naming.md`
- ✅ "Code passes `dart analyze` and follows Dart/Flutter conventions" — Explicit requirement
- ✅ Uses arrow functions for single-expression methods (as specified in `rules/variable-naming.md`)
- ✅ Naming: Entity/model names are PascalCase; field names camelCase
- ✅ No hardcoded strings — Specification §"Open Questions" asks about localization (answer: defer if mocked, plan for backend phase)

**Minor note:** Localization for comment content itself is deferred (appropriate for MVP with mocked data). When backend integrates, consider whether comments are user-generated (no translation needed) or admin-curated (localization needed).

**Evidence:** Specification requirements align with `rules/feature-implementation.md`, `rules/variable-naming.md`, and `rules/localization.md`.

---

## Cross-Repo Impact Analysis

### Frontend (Muuvie) — Changes Required

**Feature Package (New):**
- `features/comments/pubspec.yaml` — New feature barrel
- `features/comments/domain/` — New domain layer
- `features/comments/data/` — New data layer
- `features/comments/lib/comments.dart` — Barrel file

**UI Module (New):**
- `ui/comments/pubspec.yaml` — New UI module
- `ui/comments/lib/comments_state.dart` — Sealed state classes
- `ui/comments/lib/comments_bloc.dart` — CommentsBloc (Cubit)
- `ui/comments/lib/comments_screen.dart` — @RoutePage screen
- `ui/comments/lib/comments.dart` — Barrel file

**DI Integration:**
- Create `lib/di/comments_module.dart` — Module with @module registrations
- Update `lib/di/injection.config.dart` — Add imports, instantiate module, register dependencies

**Main App Integration:**
- Update `pubspec.yaml` — Add `comments` and `comments_ui` as path dependencies
- Add `CommentsScreen` widget to review detail screen
- Add `CommentsScreen` widget to list detail screen

**Testing:**
- Create `test/features/comments/` — Mirror feature structure with unit and widget tests

### Backend (MuuvieBackend) — No Changes (MVP)

- Frontend uses mocked data source; no backend endpoint required for MVP
- When backend implements real endpoint (Phase 2), endpoint should match API contract in specification §"Backend API Contract (Future)"
- Backend endpoint: `GET /api/v1/comments?id={contentId}&page={page}&pageSize={pageSize}`
- Response shape: `{comments: [...], totalCount: int, hasMore: bool}`

### Integration Impact

**Review Detail Screen Changes:**
- Import `CommentsScreen` from `comments_ui`
- Add widget tree: `CommentsScreen(contentId: movieReviewId)`
- Handle loading/error states (CommentsScreen internally manages state)

**List Detail Screen Changes:**
- Same pattern as review detail screen
- Pass `listId` as `contentId` parameter

**No breaking changes** to existing features; comments are additive feature that can be toggled on/off at screen level.

---

## Implementation Recommendations

### Critical Files to Create (In Order)

1. **Domain Layer**
   - `features/comments/domain/pubspec.yaml`
   - `features/comments/domain/lib/domain.dart` (barrel)
   - `features/comments/domain/lib/models/comment.dart` (entity)
   - `features/comments/domain/lib/models/comment_response.dart` (envelope)
   - `features/comments/domain/lib/repositories/comments_repository.dart` (abstract)
   - `features/comments/domain/lib/usecases/get_comments.dart` (use case)

2. **Data Layer**
   - `features/comments/data/pubspec.yaml`
   - `features/comments/data/lib/data.dart` (barrel)
   - `features/comments/data/lib/models/remote_comment.dart` (model + toDomain)
   - `features/comments/data/lib/models/remote_comment_response.dart`
   - `features/comments/data/lib/datasources/comments_remote_data_source.dart` (abstract)
   - `features/comments/data/lib/datasources/comments_remote_data_source_impl.dart` (mocked impl)
   - `features/comments/data/lib/repositories/comments_repository_impl.dart`
   - `features/comments/data/lib/di/comments_di_module.dart`

3. **Feature Barrel**
   - `features/comments/pubspec.yaml`
   - `features/comments/lib/comments.dart` (re-export domain + data)

4. **UI Module**
   - `ui/comments/pubspec.yaml`
   - `ui/comments/lib/comments_state.dart`
   - `ui/comments/lib/comments_bloc.dart`
   - `ui/comments/lib/comments_screen.dart`
   - `ui/comments/lib/comments.dart` (barrel)

5. **Tests**
   - `test/features/comments/domain/usecases/get_comments_test.dart`
   - `test/features/comments/data/repositories/comments_repository_impl_test.dart`
   - `test/features/comments/presentation/pages/comments_screen_test.dart`

6. **DI Integration**
   - Update `lib/di/injection.config.dart` — add comments module

### Key Implementation Decisions

**Pagination UX:** Specification asks (§"Open Questions") whether to use "Load More" button or infinite scroll. Recommendation:
- **For MVP:** Use "Load More" button (simpler to test, clearer UX)
- **Future:** Implement infinite scroll with `infinite_scroll_pagination` package once designs finalize

**Avatar Rendering:** Use `CachedNetworkImage` or `FadeInImage` to avoid jank. Example:
```dart
CachedNetworkImage(
  imageUrl: comment.authorAvatar,
  placeholder: (context, url) => const CircleAvatar(child: Icon(Icons.person)),
  errorWidget: (context, url, error) => const CircleAvatar(child: Icon(Icons.error)),
)
```

**Comments Cubit Initial State:** Start in `CommentsLoading`; call `_load()` in constructor (like `SocialCubit` pattern).

**Mocked Data Structure:** Organize by content type (e.g., `_mockCommentsByReviewId`, `_mockCommentsByListId`). At least 10 comments per content ID to test pagination.

---

## Required Changes Before Implementation

**None blocking.** Specification is implementation-ready. The following are optional clarifications to resolve before starting:

### Minor Clarifications (§"Open Questions")

1. **Visual Design** — Will comments appear as a tab or inline on review/list detail screens? (Impacts screen layout integration)
2. **Pagination UX** — "Load More" button or infinite scroll? (Recommend: button for MVP)
3. **Avatar Loading** — How to handle failed avatar loads? (Recommend: placeholder icon)
4. **Rating Display** — Should rating display as stars, numerical, or hidden? (May vary by screen; clarify)
5. **Comment Length** — Max length constraint? Truncate with "read more"? (For mocked data: no constraint; for backend: add limit)

**These clarifications do not block implementation** — they affect UI polish, not architecture or core functionality.

---

## Lint & Analysis

**Expected `dart analyze` output:** Clean (no issues). Specification explicitly requires this.

**Expected `flutter test` output:** All unit tests passing. Recommendation: use `bloc_test` for Cubit testing once dependency is added.

---

## Approval & Sign-Off

**Decision:** ✅ **APPROVED**

**Conditions:** None. Implementation can begin immediately upon design finalization (UI placement, pagination UX, avatar fallback strategy).

**Reviewer Notes:**
- Specification demonstrates excellent understanding of ecosystem patterns
- DI checklist is complete and correct
- Submodule boundaries are clear (frontend-only MVP, deferred backend)
- No security, performance, or testability concerns identified
- Ready for immediate implementation by single author (no co-author violations)

**Next Steps:**
1. Resolve §"Open Questions" (UI design, pagination UX preference)
2. Create DI module and feature structure in order listed above
3. Implement mocked data source with 30+ comments across 3+ content types
4. Write unit tests for use case and repository
5. Write widget tests for CommentsScreen
6. Integrate CommentsScreen into review detail and list detail pages
7. Run `dart analyze` and `flutter test` to verify all requirements met
8. Open PR targeting `main` per branch naming conventions (no co-authors)

---

**Review Complete**
**Reviewer:** Architect Review Agent
**Date:** 2026-05-15
