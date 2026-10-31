Decision: APPROVED

## Summary

The PM has folded every required change from the prior rejection into the revised spec. ID semantics, `authorId: String`, the mock-only backend posture, per-section `Result<T>` state, the like-failure channel, cubit-instantiated-in-page DI pattern, primary-then-secondary load ordering, pinned `share_plus`, `CommentsBottomSheet` ownership, and v1 always-on like button are all explicitly settled. The spec is now actionable end-to-end against the existing mocked codebase — an implementer can execute it without re-asking PM or architect.

## Resolution of Previous Required Changes

1. **Reconcile `MovieReview` id semantics.** ADDRESSED — Acceptance Criterion 1 + Affected Modules > domain (line 104) commits to `String id` (review id) plus a new `int movieId`, and the call-site migration block (lines 152-157) walks every `ReviewDetailsRoute` consumer (`reviews_screen.dart:125`, `user_reviews_screen.dart:108`, `search_screen.dart:292`, `route_title_resolver.dart:15`).

2. **Resolve `authorId` type mismatch with `PublicProfileRoute`.** ADDRESSED — `authorId` is now `String?` (line 104), matching the verified `PublicProfileRoute(userId: String)` signature at `ui/public_profile/lib/public_profile_page.dart:7`. The spec cites the exact call site (line 38).

3. **Acknowledge there is no real backend.** ADDRESSED — "Backend reality" paragraph (line 9) is explicit, and the `movies_remote_data_source_impl.dart` extension block (lines 125-133) prescribes deterministic mock formulas, an in-memory `Set<String> _likedReviewIds`, mock pagination, and an inline comment marker. Matches the user-issued constraint.

4. **Specify `ReviewDetailsSuccess` state shape.** ADDRESSED — line 140 commits to `Result<T>?` per section with explicit null/Success/Failure semantics ("null = in-flight").

5. **Pick the side-effect channel for like-failure SnackBar.** ADDRESSED — line 44 + line 141 specify a transient `ReviewDetailsLikeFailed(ReviewDetailsSuccess base)` sealed subclass consumed by `BlocListener`, with the cubit re-emitting `base` immediately after.

6. **Decide cubit DI registration policy.** ADDRESSED — line 147 + line 199 explicitly: no `reviews_module.dart`, cubit is `new`-ed inside `ReviewDetailsPage`. Use cases continue to live in `movies_module.dart`. Matches the existing convention in `ui/profile`, `ui/public_profile`, `ui/user_activity`.

7. **Resolve loading vs. partial-error contradiction.** ADDRESSED — Acceptance Criterion 11 is unambiguous: primary `GetReviewDetails` gates `Loading`, then on `Success` the three secondary fetches kick off via `Future.wait` with per-section inline spinners/error rows.

8. **Pin `share_plus` version.** ADDRESSED — `share_plus: ^11.0.0` pinned in both `ui/reviews/pubspec.yaml` (line 160) and `ui/common/pubspec.yaml` (line 167), with iOS 13+ / Android minSdk 21 confirmation. Note: prior review suggested `^10.x` but `^11.0.0` is the current stable line; the implementer can verify resolution. Wrapped in injectable `ShareService` (`ui/common/lib/share/share_service.dart`) for testability.

9. **Specify `CommentsBottomSheet` ownership.** ADDRESSED — full path `ui/reviews/lib/review_details/widgets/comments_bottom_sheet.dart` (line 150) with `PagingController<int, MovieReviewComment>` over `GetReviewComments`, page size 20, inline retry row footer.

10. **Auth-gated like button.** ADDRESSED — Acceptance Criterion 4 (line 46) commits to always-shown in v1; "Real auth gating of the like button" is explicitly listed under Out of Scope (line 256).

## Criterion-by-Criterion Review

### 1. Architecture Alignment

Aligned with `feature-architecture.md`, `ui-architecture.md`, and `feature-implementation.md`. Domain hosts pure models (`MovieReview`, new `MovieReviewComment`, new `MovieReviewCommentListing`), the repository contract, and four new use cases (one class per file, factory-registered) — matches lines 104-118. Data layer hosts remote models + the extended mock data source + repository impl with no try/catch (line 134). UI module keeps the three-file convention (state/bloc/screen) plus a single new `widgets/` folder for the bottom sheet — that's a minor extension of the convention but is a natural place to put it, and the rule's "one class per file" intent is preserved.

The decision to NOT add new "other reviews" use cases (line 113) — reusing `GetMovieReviews(GetMovieReviewsParams(movieId: ...))` and `GetMovieReviews(GetMovieReviewsParams(userId: ...))` — is the right call and avoids surface bloat.

### 2. Feasibility

Buildable with the current stack (Flutter 3.11.4, `auto_route` 11, `injectable` 2.5, `flutter_bloc` 9, `infinite_scroll_pagination` 5 — already in `ui/reviews/pubspec.yaml`). The horizontal carousels and bottom sheet are standard patterns. The optimistic-toggle + `BlocListener` for SnackBar is conventional. The `_likedReviewIds` set toggle on the mock cleanly survives `getReviewDetails` re-fetches.

One minor codebase discrepancy to flag for the implementer (does not block approval): the spec writes `Failure(NotFoundError())` at line 127, but the project's `Result` API uses an `AppError` enum (`core/lib/http/errors/http_error.dart:1-12`) and `Failure` takes an `AppError`, not an `Error` instance. The correct construction is `Failure(AppError.notFound)`. This is a one-line fix during implementation.

### 3. Dependencies

- `share_plus: ^11.0.0` is added in two pubspecs (lines 160, 167). Not currently anywhere in the repo, so this is the first addition — implementer must run `flutter pub get`. The spec correctly notes that iOS 13+ / Android `minSdk 21` are already true.
- `infinite_scroll_pagination` is already a dependency of `ui/reviews` — no new dep for the bottom sheet pagination.
- No new HTTP routes are needed (mock-only).
- `MovieDetailRoute(movieId: int)` is already wired into all four parent route stacks in `lib/routes/app_router.dart:36,54,64,77` — pushing it from `ui/reviews` already works today.

### 4. Security & Privacy

- Share payload is `https://muuvie.app/reviews/<reviewId>` text. No tokens, no PII beyond the public author display name. Deep link routing is correctly deferred (line 255).
- v1 always shows the like button; auth gating deferred (line 256) — acceptable per #10 of the prior review.
- No new persisted user data beyond the in-memory `_likedReviewIds` set on the mock data source.

### 5. Performance

- Primary fetch (single `Loading` → single `Success`) followed by parallel secondaries via `Future.wait` (AC 11) is correct.
- Carousels capped at 10 items, comments preview capped at 3. Pagination is bottom-sheet-only.
- Mock latencies (200-500ms via `Future.delayed`) match the existing mock conventions and won't change real-world performance once the data source is swapped.
- `flutter_bloc` `Success.copyWith` emits per resolved section — no unnecessary full-page rebuilds since the secondary sections are independent.

### 6. Testing

Test plan (lines 230-244) is concrete and covers:
- All four use cases with mocked `MoviesRepository`.
- Repository impl delegation + `.toDomain()` mapping for all four new methods.
- Mock data source deterministic generation, like/unlike toggle persistence, and `NotFound` for unknown reviewIds.
- Eight widget-test scenarios including navigation, optimistic like happy/failure paths (with `SnackBar` assertion), share payload verification via stub `ShareService`, hidden carousels, and semantic-tree labels.
- Cubit tests for parallel fetch ordering, partial-failure handling, and the `ReviewDetailsLikeFailed` one-shot emission.

The `ShareService` abstract interface (line 164) sidesteps `share_plus` platform-channel mocking — a clean choice.

### 7. DI & Build Hygiene

- Four new use cases added to `lib/di/movies_module.dart` (lines 174-191) following the existing pattern at `movies_module.dart:33-87`.
- Manual `injection.config.dart` edit prescribed (line 198) per the `CLAUDE.md` "build_runner may not be available" caveat.
- `ShareService` registered as `@lazySingleton`. The spec proposes a new `lib/di/common_module.dart` (line 192). This is a NEW DI module, and per `CLAUDE.md` the implementer must (a) create the module file, (b) instantiate it in `init()`, (c) add the `_$CommonModule` class at the bottom of `injection.config.dart`. The spec calls all three out explicitly.
- The cubit is NOT in DI — line 199 is explicit and matches `ui/profile`, `ui/public_profile`, `ui/user_activity`.

### 8. Accessibility & Localization

- 15 new localization keys (one consolidated table, lines 205-222) including ICU plural for `reviewDetailsLikeCount` and parameterized strings for `reviewDetailsMoreFromAuthor` and `reviewDetailsBy`. The spec requires mirroring to `app_es.arb` and `app_pt.arb` plus `flutter gen-l10n` re-run (line 203).
- Existing keys (`reviewDetailsBodyTitle`, `reviewDetailsAddReview`) are correctly identified as not repurposed (line 223).
- 48×48 dp touch targets called out for like, share, and movie-title tap region (AC 2, 4, 10).
- `Tooltip` + `semanticLabel` required on all icon buttons; decorative containers wrapped in `ExcludeSemantics` (AC 12).
- Each comment row gets a unique `Semantics(label: ...)` for screen-reader differentiation (AC 6).
- `colorScheme.on*` pairs mandated (AC 12) for AA contrast.

## Implementation Recommendations

1. **`NotFoundError()` → `AppError.notFound`.** The spec's line 127 says `Failure(NotFoundError())`, but the project uses an enum: `Failure(AppError.notFound)` per `core/lib/http/errors/http_error.dart`. One-line fix during implementation. No other places in the spec contradict this.

2. **Order of work (suggested):** domain models (`MovieReview` migration + new comment models) → repository contract additions → use cases → mock data source extensions (add `_likedReviewIds`, new methods, mock comment generator, stable `reviewId = 'r-${movieId}-${index}'`) → repository impl → DI registration (`movies_module.dart` + manual `injection.config.dart` + new `common_module.dart`) → ARB keys + `flutter gen-l10n` → state + cubit refactor → page/screen refactor → call-site updates for `ReviewDetailsRoute(reviewId: ...)` → tests.

3. **Migration of existing `_mockedReviews` data:** since today's `RemoteMovieReview.id` was populated from `movie_id` (`remote_movie_review.dart:22`), the mock data shape changes from `(id, title, date, rating)` to `(reviewId, movieId, title, date, rating, likeCount, likedByMe, authorId, commentCount)`. The deterministic formulas in the spec (line 126) yield a stable seed — keep `movieId` as the existing int IDs and add `reviewId = 'r-${movieId}-${index}'`. Don't introduce randomness.

4. **`route_title_resolver.dart:15` static fallback** — the spec says use the literal `'Review'` since the route no longer carries `movieTitle`. The screen sets a proper `AppBar` title from `Success.review.title` post-load, so the route-resolver title is only visible during the brief loading window. That's acceptable.

5. **`auto_route_generator` regeneration** — `review_details_router.gr.dart` (route args) AND `app_router.gr.dart` (containing each parent stack's `ReviewDetailsRoute(...)` factory) will both need re-running. Per `CLAUDE.md`, build_runner may be unavailable, so the implementer should hand-edit the generated `.gr.dart` files following the existing pattern for `MovieDetailRoute(movieId: int)`.

6. **`ShareService` registration import** — when adding the new `common_module.dart`, the implementer must ensure `package:movies_domain/movies_domain.dart` is in scope (since `ShareService.shareReview(MovieReview review)` takes a domain model). The spec already requires adding `movies_domain` as a path dep to `ui/common/pubspec.yaml` (line 167).

7. **Carousel card chrome** — borrow from `ui/movies_ui/`'s existing horizontal-list patterns (e.g. `popular_reviews` carousel on Movie Detail) rather than inventing new card styling.

## Out-of-Scope Acknowledgement

The Out of Scope section (lines 246-259) is comprehensive and well-reasoned:
- Real backend (matches user-issued constraint).
- Comment authoring / threading / moderation.
- Like notifications and push.
- Real-time / pull-to-refresh.
- Image sharing (Instagram Story etc.).
- Deep link routing on launch (format defined, handler deferred).
- Real auth gating of the like button.
- Analytics events.
- Locales beyond en/es/pt.
- Hardcoded `_reviewBody` switch elsewhere — explicitly confirmed via grep that the switch is only in `review_details_screen.dart:29-102`; the spec removes it. The earlier review's concern on this point is resolved.

All deferrals are defensible and traceable to a clear follow-up boundary.
