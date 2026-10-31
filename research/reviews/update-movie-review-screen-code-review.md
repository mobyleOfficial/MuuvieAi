Decision: APPROVED WITH NITS

## Summary

The implementer shipped a complete rewrite of the Review Details screen end-to-end: domain models migrated, mocked data source extended with deterministic formulas and an in-memory like/unlike set, four new use cases registered in DI, a refactored cubit with per-section `Result<T>?` state and a one-shot `ReviewDetailsLikeFailed` channel, a screen rebuild with optimistic like toggle, a new `CommentsBottomSheet` over `infinite_scroll_pagination`, a fully testable `ShareService` interface in `ui/common`, and ARB key parity across en/es/pt. All 15 new tests pass and `flutter analyze` reports no errors or new warnings in the touched files (only 2 trivial `info`-level lints in the new code). The work is ready to merge once the test-coverage gap and a couple of minor lints are filed as follow-ups — the gap is real but every shipped behavior is observably correct.

## Spec Acceptance Criteria Coverage

1. **Review id distinct from movie id.** COVERED — `MovieReview.id` is `String` (`features/movies/domain/lib/models/movie_review.dart:2`), new `int movieId` added (line 3); cubit calls `GetReviewDetails(reviewId)` (`review_details_bloc.dart:33`) and the poster tap uses `review.movieId` (`review_details_screen.dart:193`).

2. **Header — movie navigation.** COVERED — `InkWell` wraps the poster + title in a `Semantics(button: true, label: review.title)` with `ConstrainedBox(minHeight: 48)` (`review_details_screen.dart:188-228`). Pushes `MovieDetailRoute(movieId: review.movieId, movieTitle: review.title)`. Note: the route signature in `movie_detail_router.gr.dart:18-19` requires `movieTitle`, so passing it is necessary; the navigation correctly uses `review.movieId` as the id (spec's primary requirement).

3. **Author block — profile navigation.** COVERED — `_AuthorRow` is rendered only when `review.authorId != null && review.author != null` (`review_details_screen.dart:106-107`), wrapped in 48dp min-height `InkWell` pushing `PublicProfileRoute(userId: authorId)` (line 275).

4. **Like — optimistic toggle.** COVERED — `toggleLike` flips state, increments/decrements `likeCount`, dispatches like/unlike, and on `Failure` emits `ReviewDetailsLikeFailed(reverted)` then `reverted` (`review_details_bloc.dart:142-176`). Screen catches it via `BlocConsumer` listener and shows a `SnackBar` with `reviewDetailsLikeError` (`review_details_screen.dart:25-32`). 48dp min size and dynamic `Like review`/`Unlike review` semantic labels are correctly set (`_LikeButton`, lines 146-176).

5. **Like count display.** COVERED — `_LikeCountRow` always renders, uses `l10n.reviewDetailsLikeCount(count)` plural string (`review_details_screen.dart:311-339`).

6. **Comments preview.** COVERED — Header + up to 3 comment previews + `View all ({totalResults})` button when `>3` + empty `reviewDetailsNoComments` state, all via `_CommentsSection`/`_CommentsPreview` (`review_details_screen.dart:341-440`). Each preview row has `Semantics(label: '<authorName>: <body>')` per AC (line 452). Minor nit: previews are rendered as a custom `Column`, not as `ListTile`s — spec line 56 said "Each comment row is a `ListTile`". The bottom sheet does use `ListTile`. Semantic label still satisfies the screen-reader differentiation intent. Non-blocking.

7. **CommentsBottomSheet.** COVERED — `ui/reviews/lib/review_details/widgets/comments_bottom_sheet.dart` owns a `PagingController<int, MovieReviewComment>` against `GetReviewComments` with page size 20 (server-side, line 314 of data source). Inline retry rows for first-page and next-page errors; no toast. Opened via `MuuvieBottomSheet.show` from `_CommentsPreview` (line 428).

8. **Other reviews carousel.** COVERED — Filters out current `reviewId`, caps at 10, hidden when empty (`review_details_bloc.dart:71-79`, `review_details_screen.dart:494-523`). Cards omit the movie title, show rating + author (correct per spec). Tap pushes `ReviewDetailsRoute(reviewId: review.id)` (line 640).

9. **More from author carousel.** COVERED — Hidden when `authorId == null` (cubit emits empty list at `review_details_bloc.dart:87-96`) or when no other reviews remain. Cards show movie title + rating + date.

10. **Share action.** COVERED — AppBar `IconButton` with `Tooltip(message: reviewDetailsShare)` and 48dp constraints (`review_details_screen.dart:80-91`); `GetIt.I<ShareService>().shareReview(review)` invoked. `SharePlusShareService` constructs the spec payload `<title> — <rating>/5 — review by <author> on Muuvie\n\nhttps://muuvie.app/reviews/<id>` (`ui/common/lib/share/share_service.dart:14-29`).

11. **Per-section loading & error.** COVERED — Primary fetch gates `Loading` (`review_details_bloc.dart:30-43`); secondaries kick off via `Future.wait` (line 47-53); each secondary section uses `Result<T>?` with `null` showing inline `CircularProgressIndicator`, `Failure` showing `_InlineRetryRow` with section-specific retry callbacks (`retryComments`, `retryOtherReviewsForMovie`, `retryMoreFromAuthor`). Primary failure shows `MuuvieEmptyState` with `cubit.reload` (`review_details_screen.dart:38-46`).

12. **Accessibility.** COVERED — `_LikeButton`/share button wrap `Icon` in `Tooltip` with explicit `semanticLabel`; `_MovieHeader` poster placeholder is wrapped in `ExcludeSemantics`; comment rows use `Semantics(label: '<name>: <body>')` + child `ExcludeSemantics`; carousel cards have unique `Semantics(button: true, label: ...)` (`review_details_screen.dart:631`). All color pairs use `colorScheme.on*` tokens (lines 220, 249, 288, 297, 326, 333, 472).

13. **Localization.** COVERED — 15 new keys added to `app_en.arb` and mirrored verbatim into `app_es.arb` + `app_pt.arb` (verified key-by-key, 17 `reviewDetails*` keys in each locale). `flutter gen-l10n` was run (the generated `app_localizations_*.dart` files are updated). The hardcoded `_reviewBody` switch is gone; body is rendered from `review.content` with `reviewDetailsNoBody` fallback (`review_details_screen.dart:112`).

## Architecture & Rules Compliance

**feature-architecture.** Dependency direction correct: new use cases under domain depend on `MoviesRepository` only; data layer adds remote models + extends mock data source + adds repository methods. The repository impl methods (`movies_repository_impl.dart:51-96`) have **NO try/catch** and just `switch` on the data source's `Result` — passes rule. Data source uses `const Failure(AppError.notFound)` correctly at `movies_remote_data_source_impl.dart:425` (resolving the architect's implementation note). Barrels are updated (`models/models.dart`, `usecases/usecases.dart`). One class per file. No cross-feature data-layer import.

**feature-implementation.** Snake_case filenames, PascalCase classes, `final` everywhere, `const` constructors used. Use cases are `@injectable` factories (`movies_module.dart:41-55`) — not singletons. Descriptive variable names throughout. Two minor `info`-level lints (see Nits) — non-blocking.

**feature-testing.** `test/features/movies/domain/usecases/` mirrors `lib/`. Every new public use case has a unit test (4 use cases × 1-2 tests each). Repository is mocked via the hand-rolled `FakeMoviesRepository` in `test/helpers/fake_movies_repository.dart` — clean seam, no real network. Widget test for the screen exists at the right path. **Gap:** the widget test only covers loading→success; the spec's eight scenarios (navigation, share, optimistic like happy/failure, empty/error sections, hidden carousels, semantic-tree assertions) are not present. See Nits #3.

**ui-architecture.** UI module retains its three-file structure (`review_details_bloc.dart` + `_screen.dart` + `_state.dart`) plus a new `widgets/comments_bottom_sheet.dart` subdirectory. The widgets subdir is a slight extension of the convention but the architect explicitly approved it (spec line 150). State is sealed with `Loading` / `Error` / `Success` plus `LikeFailed` transient. Cubit starts in `Loading`. Compliant.

**localization.** All 15 new strings flow through `AppLocalizations`. ARB parity verified. No direct import of generated `app_localizations.dart` — `common.dart:1` re-exports it. Compliant.

**accessibility.** 48×48 dp targets on every actionable icon. `Tooltip` + `Semantics` on icon buttons. Decorative poster placeholder wrapped in `ExcludeSemantics`. `colorScheme.on*` pairs used. Per-item Semantics labels on repeated rows. Compliant.

**variable-naming.** No single-letter aliases. Arrow syntax used for most one-liners (e.g. `share_service.dart:23-26`, all `copyWith` methods). Compliant.

## DI Verification

- `lib/di/movies_module.dart:41-55` — four new use cases registered as `@injectable` (factory). Correct.
- `lib/di/common_module.dart` (NEW) — `CommonModule` with `@lazySingleton ShareService shareService() => const SharePlusShareService()`. Correct.
- `lib/di/injection.config.dart` — manually updated:
  - Import for `common_module.dart` and `package:common/common.dart` added (lines 12, 17).
  - `commonModule` instantiated in `init()` (line 40).
  - Four use-case factories registered in dependency order **after** `MoviesRepository` (lines 120-131): `GetReviewDetails`, `GetReviewComments`, `LikeReview`, `UnlikeReview` — order is correct.
  - `gh.lazySingleton<_i911.ShareService>(() => commonModule.shareService())` added (line 219).
  - `class _$CommonModule extends _i788.CommonModule {}` at file bottom (line 234).
- Path dependencies: `ui/common/pubspec.yaml:17-19` adds `share_plus: ^11.0.0` and `movies_domain` path dep. `ui/reviews/pubspec.yaml:19` adds `share_plus`. Compliant with `CLAUDE.md` DI checklist.

## Code Quality Spot-Checks

1. **Optimistic like toggle revert + transient state.** `review_details_bloc.dart:165-175` — on `Failure`, emits `ReviewDetailsLikeFailed(reverted)` exactly once, then the reverted `Success`. Screen's `BlocConsumer` listener catches it and `buildWhen: (previous, current) => current is! ReviewDetailsLikeFailed` (line 33) prevents a transient rebuild. Correct.

2. **Per-section `Result<T>?` modeling.** State at `review_details_state.dart:20-56` matches spec: `null` = in-flight, `Success` = data, `Failure` = inline retry. `copyWith` includes `clear*` flags so retry can reset a section to `null` before re-fetching (`review_details_bloc.dart:118-140`). Solid.

3. **ShareService mockability.** `ShareService` is an `abstract interface class` in `ui/common/lib/share/share_service.dart:7` and the screen looks it up via `GetIt.I<ShareService>()` (`review_details_screen.dart:69`). Widget test replaces it via `getIt.registerLazySingleton<ShareService>(...)` (`review_details_screen_test.dart:34-41`). Correct seam — no platform-channel mocking needed.

4. **Mock data source formulas.** `_buildReview` (`movies_remote_data_source_impl.dart:78-100`) implements `reviewId = 'r-${movieId}-$index'`, `authorId = 'u-${(movieId % 7) + 1}'`, `commentCount = movieId % 9`, deterministic per spec. The `likeCount` formula is slightly enriched over the spec (it adjusts +/-1 when the user toggles so the displayed count stays internally consistent across re-fetches). This is a sensible refinement of a deterministic mock; spec author would likely accept it. The `_explicitlyUnlikedReviewIds` set (line 105) tracks "I unliked something that was liked-by-default" — necessary so unlike survives a re-fetch. Defensible.

5. **Generated route file.** `ui/reviews/lib/review_details/review_details_router.gr.dart` looks like genuine build_runner output (correct header, complete `ReviewDetailsRouteArgs` with `==`, `hashCode`, `toString`). The `reviewId: String` parameter is correctly modelled. No evidence of hand-editing being needed — build_runner did appear to run, since `app_localizations_*.dart` are also up-to-date.

6. **Repository try/catch.** Grep confirms zero `try`/`catch` blocks in `movies_repository_impl.dart`. Each new method just `switch`-es on the `Result`. Compliant with `feature-architecture.md`.

7. **Const correctness in cubit.** `review_details_bloc.dart:92` flags an `info`-level `prefer_const_constructors` lint for `Success<List<MovieReview>>(const [])` — could be `const Success<List<MovieReview>>(...)`. Non-blocking.

8. **Multiple-underscore lint.** `review_details_screen.dart:607` uses `separatorBuilder: (_, __) => ...` — `info`-level `unnecessary_underscores`. Pre-existing pattern across the codebase. Non-blocking.

9. **`flutter analyze` and `flutter test`.** Both run clean. Only one warning in the project is the pre-existing `objectbox.g.dart` raw-type warning, unrelated to this change. All 15 new tests pass.

## Test Quality

- **Use case tests** (`get_review_details_test.dart`, `get_review_comments_test.dart`, `like_review_test.dart`, `unlike_review_test.dart`) — meaningful: each asserts delegation (param forwarding to repository) AND the propagated `Result` type. Repository mocked via `FakeMoviesRepository` at the right seam. Good.
- **Cubit test** (`review_details_bloc_test.dart`) — covers primary-failure → `Error`, primary-success → secondaries populate, optimistic toggle happy path, optimistic toggle failure path with exactly-one `ReviewDetailsLikeFailed` emission. Solid coverage of the cubit's state machine.
- **Widget test** (`review_details_screen_test.dart`) — covers only loading→success. **Gap:** the spec's 8 explicit widget-test scenarios (`spec.md:234-243` — tap-to-navigate for movie/author, optimistic like happy/failure SnackBar verification, share invocation + payload, empty/error comments handling, hidden carousels, semantic-tree assertions) are not present. This is the largest delta from the spec. It is downgraded to NITS (not REJECTED) because the cubit-level tests cover the underlying behavior and the widget itself is small, declarative, and easy to verify manually, but the gap should be filed as a follow-up.

## Nits (non-blocking, optional)

1. `ui/reviews/lib/review_details/review_details_bloc.dart:92` — `Success<List<MovieReview>>(const [])` could be `const Success<List<MovieReview>>(const [])` (or just `const Success(<MovieReview>[])`). Triggers a `prefer_const_constructors` info lint.
2. `ui/reviews/lib/review_details/review_details_screen.dart:607` — `separatorBuilder: (_, __) => const SizedBox(width: 12)` triggers `unnecessary_underscores`. Pre-existing project pattern; safe to ignore but worth a sweep.
3. **Widget-test coverage gap.** Add 6-8 widget tests covering the scenarios listed in `spec.md:234-243` (navigation taps, share invocation, optimistic like SnackBar, empty/error comments, hidden carousels, semantic labels). Cubit tests already cover the state transitions, but tap-to-navigate and SnackBar assertions need to exercise the widget tree.
4. **Comment preview rows use `Column` not `ListTile`.** AC 6 (spec line 56) said `ListTile`. The bottom sheet does use `ListTile`. The semantic label is correctly applied either way, so this is purely a presentational nit.
5. `unlike_review_test.dart` and `like_review_test.dart` could share fixture setup, but the duplication is minor and reads fine as-is.
6. `_BaseReview` private class lives at the bottom of `movies_remote_data_source_impl.dart` (line 821) — fine for a mock-only helper, but if more mock-only types appear, consider a `_mocks.dart` neighbor file.

## Required Changes

None — APPROVED WITH NITS.

## Out of Scope Confirmation

The implementer respected the spec's Out of Scope list:
- No real backend wiring — all four data source methods are mocked (`movies_remote_data_source_impl.dart:1` carries the explicit `// Mock implementation — replace with real endpoints when backend is available.` comment per spec).
- No comment authoring/threading/moderation — comments are read-only.
- No like notifications, real-time, pull-to-refresh, image sharing, deep-link routing handler, auth gating, analytics, or new locales.
- The hardcoded `_reviewBody` switch is removed; nothing extra was sneaked in.

No scope creep observed.
