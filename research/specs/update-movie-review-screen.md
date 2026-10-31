# Update Movie Review Screen

## Overview

The current Review Details screen (`ui/reviews/lib/review_details/`) is a near-static page that renders a hardcoded review body, the movie title, the rating and the date. It carries no interaction affordances, no social signals (likes, comments), no navigational hooks back into the parent movie or the author's profile, and no way to discover related content.

This spec rewrites the screen as a social, navigable review experience. The user can like the review, jump into the movie it is about, jump into the author's public profile, read a comments preview, see other reviews about the same movie, see more reviews from the same author, and share the review to external apps (WhatsApp, Instagram, Mail, etc.) via the OS share sheet.

**Backend reality.** There is no real review/comment/like backend wired today. `MoviesRemoteDataSourceImpl` is fully mocked end-to-end (see `_mockedReviews`, `Future.delayed`). This spec is v1 against the mock layer. Every new data method extends the mock and returns a deterministic value. When a real backend is available, only the data source body changes — contracts, models, repository, use cases, cubit and UI stay the same.

The screen remains read-mostly. Comment authoring, threading, moderation, push notifications, and real-time updates are out of scope.

## User Stories

- As a user reading a review, I want to like it so that I can express appreciation for it and signal helpful content to other readers.
- As a user reading a review, I want to undo my like so that I can correct a mistap without it being permanent.
- As a user reading a review, I want to tap the movie title or poster and be taken to the Movie Detail screen so that I can learn more about the film being reviewed.
- As a user reading a review, I want to tap the review author and be taken to their public profile so that I can see who wrote the review and explore more of their content.
- As a user reading a review, I want to see how many likes the review has received so that I can gauge how the community has responded to it.
- As a user reading a review, I want to see the comments left on the review so that I can read the discussion the review generated.
- As a user reading a review, I want to see a list of other reviews for the same movie so that I can compare different perspectives on the film.
- As a user reading a review, I want to see a list of other reviews by the same author so that I can keep reading from a critic whose taste I trust.
- As a user who enjoyed a review, I want to share it with friends via WhatsApp, Instagram, email or any other installed share target so that I can spread good content outside Muuvie.

## Acceptance Criteria

Each item below is individually testable by widget test, unit test or manual QA.

1. **Review id is distinct from movie id.**
   - Given the Review Details route is opened, when the screen loads, then it dispatches `GetReviewDetails(reviewId: String)` and renders the returned `MovieReview` — NOT a route-arg-reconstructed one.
   - Given the mock data source returns a `MovieReview` where `reviewId != movieId` (e.g. `reviewId = "r-693134-0"`, `movieId = 693134`), when the user taps the poster/title, then the app pushes `MovieDetailRoute(movieId: 693134)` — never the `reviewId`.

2. **Header — movie navigation.**
   - Given the success state has rendered, when the user taps the movie poster region OR the movie title, then `MovieDetailRoute(movieId: review.movieId)` is pushed.
   - The tappable region is at least 48×48 dp and announced by screen readers as a button labeled with the movie title.

3. **Author block — profile navigation.**
   - Given the review has a non-null `authorId: String`, when the user taps the author name or avatar, then `PublicProfileRoute(userId: review.authorId)` is pushed. (Matches the existing `PublicProfileRoute(userId: String)` signature at `ui/public_profile/lib/public_profile_router.dart` and the call site at `ui/social/lib/tabs/friends/friends_screen.dart:43`.)
   - When `authorId` is null, the author block is hidden entirely (no tappable placeholder).

4. **Like action — optimistic toggle.**
   - Given the user has not liked the review, when they tap the heart icon, then the icon switches to filled, the like count increments by 1 in the rendered state immediately, and `LikeReview(reviewId)` is dispatched in the background.
   - Given the user has already liked the review, when they tap the heart icon, then the icon switches to outlined, the like count decrements by 1 immediately, and `UnlikeReview(reviewId)` is dispatched.
   - If the use case returns `Result.Failure`, the cubit emits a copy of `Success` with the previous like state restored AND emits a transient `ReviewDetailsLikeFailed` state (separate sealed subclass) once. A `BlocListener<ReviewDetailsCubit, ReviewDetailsState>` in the screen catches `ReviewDetailsLikeFailed` and calls `ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l10n.reviewDetailsLikeError)))`. State immediately re-emits the reverted `Success`.
   - The like button minimum touch target is 48×48 dp and is announced as `Like review` / `Unlike review` depending on state.
   - v1 always shows the like button. Auth-gated visibility (hide when unauthenticated) is out of scope — see Out of Scope.

5. **Like count display.**
   - The like count is rendered next to the heart icon using the localized plural string `reviewDetailsLikeCount` (`{count, plural, =0{No likes yet} =1{1 like} other{{count} likes}}`).
   - When the count is 0, the row still renders so users can be the first to like.

6. **Comments section — preview.**
   - Given the comments fetch returned a non-empty page, when the screen renders, then a "Comments" header is shown followed by up to the first 3 comment previews (author name, relative timestamp, body truncated to 3 lines).
   - Given the comments fetch returned >3 comments (`totalResults > 3`), then a `View all ({totalResults})` button is rendered. Tapping it opens the new `CommentsBottomSheet` (see Technical Notes).
   - Given the comments fetch returned 0 results, an empty state shows `reviewDetailsNoComments` ("No comments yet"). Copy MUST NOT imply users can author a comment in v1.
   - Each comment row is a `ListTile` with `Semantics(label: '<authorName>: <body>')` for differentiation by screen reader.

7. **CommentsBottomSheet.**
   - Lives at `ui/reviews/lib/review_details/widgets/comments_bottom_sheet.dart` (new file under the same UI module).
   - Wraps an `infinite_scroll_pagination` `PagingController<int, MovieReviewComment>` whose `fetchPage` calls `GetReviewComments(reviewId, page)`.
   - Page size is 20 (server-side enforced by the mock). Shows a footer spinner while loading next page. Surfaces fetch errors as an inline retry row, NOT a snackbar (no toast inside a bottom sheet).

8. **Other reviews about this movie — carousel.**
   - Below the comments section, a horizontal carousel titled `reviewDetailsOtherReviewsForMovie` renders up to 10 reviews for `review.movieId` excluding the current review (cubit filters out the current `reviewId` client-side).
   - Each card shows the star rating, author name (or "Anonymous" via `reviewDetailsAnonymousAuthor` when null), and first 2 lines of content. The movie title is intentionally omitted because it is redundant in this section.
   - Tapping a card pushes a new `ReviewDetailsRoute(reviewId: card.reviewId)`.
   - The carousel section (header + list) is hidden if zero results remain after filtering.

9. **More reviews by this author — carousel.**
   - Below the previous carousel, a horizontal carousel titled with the localized string `reviewDetailsMoreFromAuthor` ("More reviews from {author}") renders up to 10 other reviews by `review.authorId`, ordered by `date desc`, excluding the current review.
   - Each card shows the movie title, the star rating and the review date.
   - Tapping a card pushes a new `ReviewDetailsRoute(reviewId: card.reviewId)`.
   - The carousel section is hidden when `authorId` is null OR the API returns zero other reviews from this author.

10. **Share action.**
    - Given the user taps the share icon in the AppBar, when the action fires, then `ShareService.shareReview(MovieReview review)` is invoked (see Technical Notes — `ShareService` is constructor-injected into the screen via DI).
    - The default `ShareService` implementation calls `SharePlus.instance.share(ShareParams(text: payload))` where the payload is:
      `"<movieTitle> — <rating>/5 — review by <author> on Muuvie\n\n<deeplinkUrl>"`.
    - `<deeplinkUrl>` is `https://muuvie.app/reviews/<reviewId>`. Universal/App Link handling is a separate ticket.
    - The share button has `Tooltip(message: l10n.reviewDetailsShare)` and is announced as a button.

11. **Loading and error — per section, not full screen.**
    - On screen entry the cubit emits `ReviewDetailsLoading` ONLY until the primary fetch (`GetReviewDetails`) returns. The screen shows a single `CircularProgressIndicator` during this window.
    - Once the primary fetch returns `Success`, the cubit emits `ReviewDetailsSuccess` and IMMEDIATELY kicks off the three secondary fetches in parallel via `Future.wait` (comments, other-reviews-for-movie, more-from-author).
    - Each secondary section is modeled as `Result<T>` inside `ReviewDetailsSuccess`: `Result<MovieReviewCommentListing> comments`, `Result<List<MovieReview>> otherReviewsForMovie`, `Result<List<MovieReview>> moreFromAuthor`. The cubit emits a fresh `Success` copy as each secondary `Result` resolves.
    - While a secondary section is in-flight its value is `null` (sentinel — interpreted by the screen as "show inline spinner"). When it resolves to `Failure`, the section shows an inline error placeholder with a retry button that re-invokes the section-specific fetch only.
    - If the primary `GetReviewDetails` fetch fails, the cubit emits `ReviewDetailsError(message)` and the screen shows the existing `MuuvieEmptyState` widget with `actionLabel: l10n.emptyStateRetry` and `action: cubit.reload`. (Reuses the current widget already on file at `review_details_screen.dart:118-125`.)

12. **Accessibility and contrast.**
    - All new icons (heart, share, navigation chevrons, author avatar) wrap their `Icon` in a `Tooltip` AND set a `semanticLabel`. Decorative containers are wrapped in `ExcludeSemantics`.
    - All color pairs use the matching `colorScheme.on*` token so AA contrast is guaranteed.
    - The screen passes `flutter analyze` with zero warnings.

13. **Localization.**
    - All new user-visible strings live in `ui/common/lib/l10n/app_en.arb`, `app_es.arb`, `app_pt.arb` and are consumed via `AppLocalizations.of(context)!.<key>`.
    - The hardcoded `_reviewBody` switch in `review_details_screen.dart:29-102` is deleted; the body is rendered from `review.content` (fallback to `reviewDetailsNoBody` "No review text" when null).
    - Run `flutter gen-l10n` after editing the ARBs.

## Technical Notes

### Affected modules

**`features/movies/domain` (pure Dart — no framework deps)**
- `models/movie_review.dart` — additive migration. Change `final int id` to `final String id` (the review id) and ADD `final int movieId`, `final int likeCount`, `final bool likedByCurrentUser`, `final String? authorId`, `final int commentCount`. Existing fields (`title`, `date`, `rating`, `author?`, `content?`) stay. This is a breaking change for callers — see "Call-site migration" below.
- `models/movie_review_comment.dart` (NEW) — `final String id`, `final String reviewId`, `final String authorId`, `final String authorName`, `final String body`, `final String createdAt`. Pure Dart class.
- `models/movie_review_comment_listing.dart` (NEW) — `final int page`, `final int totalPages`, `final int totalResults`, `final List<MovieReviewComment> comments`. Mirrors `MovieReviewListing`.
- `models/models.dart` — barrel re-exports both new files.
- `repositories/movies_repository.dart` — ADD four method signatures (additive):
  - `Future<Result<MovieReview>> getReviewDetails({required String reviewId});`
  - `Future<Result<MovieReviewCommentListing>> getReviewComments({required String reviewId, required int page});`
  - `Future<Result<void>> likeReview({required String reviewId});`
  - `Future<Result<void>> unlikeReview({required String reviewId});`
  - `getMovieReviews(...)` is REUSED for the two carousels — do not add new methods for them.
- `usecases/` — add four files (one class per file, each `@injectable` factory, single public `call` method that returns `Future<Result<T>>`). Add their exports to `usecases.dart`. Existing review-related use cases today are only `get_movie_reviews.dart`; the new files are:
  - `get_review_details.dart` — `GetReviewDetails extends UseCase<String, Result<MovieReview>>`. `call(reviewId)` delegates to `repository.getReviewDetails`.
  - `get_review_comments.dart` — params class `GetReviewCommentsParams({required String reviewId, required int page})`. Returns `Result<MovieReviewCommentListing>`.
  - `like_review.dart` — `LikeReview extends UseCase<String, Result<void>>`. `call(reviewId)`.
  - `unlike_review.dart` — `UnlikeReview extends UseCase<String, Result<void>>`. `call(reviewId)`.

**`features/movies/data` (depends on domain)**
- `models/remote/remote_movie_review.dart` — UPDATE. Add fields `final String reviewId`, `final int movieId`, `final int likeCount`, `final bool likedByMe`, `final String? authorId`, `final int commentCount`. Update `fromJson` to read `review_id`, `movie_id`, `like_count`, `liked_by_me`, `author_id`, `comment_count`. Update `toDomain()` to produce the new domain shape (the previous `id` field is dropped — what used to be `id` was `movie_id` per current code at line 22 and is now correctly mapped to `movieId`).
- `models/remote/remote_movie_review_comment.dart` (NEW) — fields + `fromJson` + `toDomain()`.
- `models/remote/remote_movie_review_comment_listing.dart` (NEW) — fields + `fromJson` + `toDomain()`.
- `datasources/remote/movies_remote_data_source.dart` — add four abstract method signatures matching the repository ones but returning `Result<RemoteX>`.
- `datasources/remote/movies_remote_data_source_impl.dart` — EXTEND the mock (additive). All four methods are mock-backed; no real HTTP call. Specifically:
  - Update `_mockedReviews` so each entry is a `RemoteMovieReview` with `reviewId = 'r-${movieId}-${index}'`, `likeCount = (movieId % 47) + 3`, `likedByMe = movieId % 5 == 0`, `authorId = 'u-${(movieId % 7) + 1}'`, `commentCount = (movieId % 9)`. Deterministic, no randomness, mirrors the formulas used at line 282-284.
  - `getReviewDetails({required String reviewId})` — `Future.delayed(500ms)` then linear scan `_mockedReviews` by `reviewId`; if found return `Success(remoteReview)`; if not, return `Failure(NotFoundError())`. After mutating the in-memory like set (see below), the returned `likedByMe` reflects current state.
  - `getReviewComments({required String reviewId, required int page})` — `Future.delayed(400ms)`; generate `commentCount` deterministic comments keyed off `reviewId` (e.g. `id = '$reviewId-c-$i'`, `authorName = 'Commenter ${i+1}'`, `authorId = 'u-${(i % 7) + 1}'`, `body = 'Mocked comment $i for $reviewId.'`, `createdAt = 'Mar ${10 - (i % 10)}, 2024'`). Paginate at 20/page.
  - `likeReview({required String reviewId})` — `Future.delayed(200ms)`; add `reviewId` to an instance-level `final Set<String> _likedReviewIds = {};`; return `Success(null)`. This mutates the mock so a subsequent `getReviewDetails` returns the new state.
  - `unlikeReview({required String reviewId})` — symmetric: remove from `_likedReviewIds`; return `Success(null)`.
  - `getReviewDetails` and `_mockedReviews` accessors must consult `_likedReviewIds` to override `likedByMe` so the toggle survives across refresh.
  - The carousels reuse the existing `getMovieReviews(page, movieId|userId)` mock unchanged.
  - Comment in the file: `// Mock implementation — replace with real endpoints when backend is available.`
- `repositories/movies_repository_impl.dart` — UPDATE. Add four method overrides. Each one delegates to the data source and `.toDomain()`-maps. NO try/catch in the repository (per `feature-architecture.md` — data source owns Result mapping).

**`ui/reviews/lib/review_details/` (UI module — the screen owner)**
- `review_details_state.dart` — REPLACE. Keep `sealed`. States:
  - `ReviewDetailsLoading` (existing).
  - `ReviewDetailsError(String message)` (existing).
  - `ReviewDetailsSuccess({required MovieReview review, required bool isLikeBusy, Result<MovieReviewCommentListing>? comments, Result<List<MovieReview>>? otherReviewsForMovie, Result<List<MovieReview>>? moreFromAuthor})`. Nullable `Result<T>?` per section so `null` = in-flight, `Success` = data, `Failure` = error. Includes `copyWith`.
  - `ReviewDetailsLikeFailed(ReviewDetailsSuccess base)` — transient sealed subclass emitted ONCE on like-failure for the `BlocListener` snackbar; cubit re-emits `base` right after.
- `review_details_bloc.dart` — REPLACE `ReviewDetailsCubit`. Constructor takes `({required String reviewId, required GetReviewDetails getReviewDetails, required GetReviewComments getReviewComments, required GetMovieReviews getMovieReviews, required LikeReview likeReview, required UnlikeReview unlikeReview})`. Methods:
  - `Future<void> load()` — emit `Loading`; await primary; emit `Success(review, isLikeBusy: false, null, null, null)`; then kick off the three secondary fetches via `Future.wait` and emit `Success.copyWith` as each resolves.
  - `void reload()` — alias for `load`.
  - `Future<void> retryComments()` / `retryOtherReviewsForMovie()` / `retryMoreFromAuthor()` — per-section retry hooks for the inline error rows.
  - `Future<void> toggleLike()` — optimistic flip on `Success`; call `LikeReview` or `UnlikeReview`; on `Failure` emit `ReviewDetailsLikeFailed(reverted)` then `reverted`.
- `review_details_page.dart` — REPLACE. `@RoutePage()` accepts `final String reviewId`. Use cases come from `GetIt.I<...>()` (existing project pattern — see `ui/profile/`, `ui/public_profile/`, `ui/user_activities/`; no UI cubits are registered in DI today). NO new `lib/di/reviews_module.dart` — cubit is `new`-ed in the page state with `late final ReviewDetailsCubit _cubit = ReviewDetailsCubit(reviewId: widget.reviewId, getReviewDetails: GetIt.I<GetReviewDetails>(), ...)`.
- `review_details_screen.dart` — REPLACE the screen build to render the new sections. Remove the `_reviewBody` switch (lines 29-102) and the route-arg fields (`movieTitle`, `reviewDate`, `rating`, `posterColorIndex`). The cubit's `Success.review` provides all of these. Wrap the body in `BlocConsumer` (listener for `ReviewDetailsLikeFailed`, builder for `Success`). The AppBar gains two `IconButton` actions: like (heart) and share. Tappable poster + title push `MovieDetailRoute(movieId: review.movieId)`. Tappable author row pushes `PublicProfileRoute(userId: review.authorId!)`.
- `review_details_router.dart` — UPDATE. The generated `ReviewDetailsRoute` now takes `reviewId: String`. Re-run `auto_route_generator` (or hand-edit the `.gr.dart` since build_runner may be unavailable, per `CLAUDE.md`).
- `widgets/comments_bottom_sheet.dart` (NEW) — `StatefulWidget`. Owns a `PagingController<int, MovieReviewComment>`. `fetchPage` calls `GetIt.I<GetReviewComments>()` via `GetReviewCommentsParams(reviewId, page)`. Renders comment rows as `ListTile`s with `Semantics(label: ...)`. Footer error: inline retry row, not a snackbar.

**Call-site migration for `ReviewDetailsRoute`.** The route's args change from `(movieTitle, reviewDate, rating, posterColorIndex)` to `(reviewId: String)`. Every call site below must change to pass `review.id` (the new String review id):
- `ui/reviews/lib/reviews_list/reviews_screen.dart:125` — currently passes `(movieTitle, reviewDate, rating, posterColorIndex)`. Change to `ReviewDetailsRoute(reviewId: review.id)`.
- `ui/public_profile/lib/user_review/user_reviews_screen.dart:108` — same change.
- `ui/search/lib/search_screen.dart:292` — same change.
- `lib/routes/route_title_resolver.dart:15` — currently reads `argsAs<ReviewDetailsRouteArgs>().movieTitle`. Change to a static title fallback `'Review'` (we no longer have the title before the screen loads). The screen sets its own AppBar title from the loaded `MovieReview` once `Success` lands.
- `lib/routes/app_router.dart:35,55,65,76` — no functional change (routes are referenced by name only); no edit needed.

**`ui/reviews/pubspec.yaml`**
- ADD `share_plus: ^11.0.0` (pinned; latest stable compatible with Flutter SDK `^3.11.4`). Confirm iOS deployment target ≥ 13 and Android `minSdk` ≥ 21 (already true per existing repo config — no platform-file edits expected).

**`ui/common/lib/` (ShareService — testable wrapper around share_plus)**
- ADD `ui/common/lib/share/share_service.dart`:
  - `abstract interface class ShareService { Future<void> shareReview(MovieReview review); }` — pure Dart contract so widget tests can stub it without platform-channel mocking.
  - `class SharePlusShareService implements ShareService` — calls `SharePlus.instance.share(ShareParams(text: ...))` with the formatted payload from Acceptance Criterion 10.
- Re-export from `package:common/common.dart`.
- Add `share_plus: ^11.0.0` to `ui/common/pubspec.yaml` AND `movies_domain` path dep (for the `MovieReview` import).
- The screen receives `ShareService` via `GetIt.I<ShareService>()`.

### Dependency Injection registration (CRITICAL — per `CLAUDE.md`)

Build runner may be unavailable, so all edits below are MANUAL.

- `lib/di/movies_module.dart` — ADD four `@injectable` factory registrations (one per use case), following the existing pattern at lines 33-87:
  ```dart
  @injectable
  GetReviewDetails getReviewDetails(MoviesRepository repository) =>
      GetReviewDetails(repository);

  @injectable
  GetReviewComments getReviewComments(MoviesRepository repository) =>
      GetReviewComments(repository);

  @injectable
  LikeReview likeReview(MoviesRepository repository) =>
      LikeReview(repository);

  @injectable
  UnlikeReview unlikeReview(MoviesRepository repository) =>
      UnlikeReview(repository);
  ```
- `lib/di/common_module.dart` (NEW) OR extend an existing module — register `ShareService` as `@lazySingleton`:
  ```dart
  @lazySingleton
  ShareService shareService() => SharePlusShareService();
  ```
  Add the module's imports + `_$CommonModule` class to `lib/di/injection.config.dart`.
- `lib/di/injection.config.dart` — ADD four `gh.factory<...>(() => moviesModule.xxx(gh<MoviesRepository>()))` lines in the same block as the existing movies use cases (lines 108-152), plus one `gh.lazySingleton<ShareService>(() => commonModule.shareService())` line. Add the new module's import + instantiation + `_$` class at the bottom.
- The `ReviewDetailsCubit` is NOT registered in DI — it is instantiated directly in `ReviewDetailsPage` like every other UI cubit in this project (see `ui/profile/`, `ui/public_profile/`, `ui/user_activity/`).

### Localization keys to add

Add to `app_en.arb`, then mirror translated values to `app_es.arb` and `app_pt.arb`, then run `flutter gen-l10n`.

| Key | English value | Notes |
|---|---|---|
| `reviewDetailsShare` | `"Share review"` | Tooltip + semantic label for share button. |
| `reviewDetailsLike` | `"Like review"` | Tooltip + semantic label when not liked. |
| `reviewDetailsUnlike` | `"Unlike review"` | Tooltip + semantic label when liked. |
| `reviewDetailsLikeError` | `"Couldn't update like. Try again."` | SnackBar copy. |
| `reviewDetailsLikeCount` | `"{count, plural, =0{No likes yet} =1{1 like} other{{count} likes}}"` | ICU plural. Placeholder `count: int`. |
| `reviewDetailsCommentsTitle` | `"Comments"` | Section header. |
| `reviewDetailsViewAllComments` | `"View all ({count})"` | Placeholder `count: int`. |
| `reviewDetailsNoComments` | `"No comments yet"` | Empty state — does NOT imply authoring. |
| `reviewDetailsOtherReviewsForMovie` | `"Other reviews for this movie"` | Carousel header. |
| `reviewDetailsMoreFromAuthor` | `"More reviews from {author}"` | Placeholder `author: String`. |
| `reviewDetailsBy` | `"by {author}"` | Inline author label on carousel cards. Placeholder `author: String`. |
| `reviewDetailsAnonymousAuthor` | `"Anonymous"` | Fallback when `author` is null. |
| `reviewDetailsNoBody` | `"No review text"` | Fallback when `review.content` is null. |
| `reviewDetailsLoadCommentsError` | `"Couldn't load comments"` | Inline error row + retry. |
| `reviewDetailsLoadRelatedError` | `"Couldn't load related reviews"` | Inline error row + retry. |

`reviewDetailsBodyTitle` ("My Review") and `reviewDetailsAddReview` already exist — neither is repurposed. The latter is NOT used on this screen (it belongs to the write-flow).

### Error handling and Result mapping

Per `feature-architecture.md`: the four new data source methods own their `Result<T>` wrapping. The repository implementations have NO try/catch — they delegate and `.toDomain()`-map only. Since the mock returns `Success/Failure` directly (no thrown exceptions), this is a one-line delegate in each repo method.

### Testing impact

- `test/features/movies/domain/usecases/` — `get_review_details_test.dart`, `get_review_comments_test.dart`, `like_review_test.dart`, `unlike_review_test.dart`. Each test mocks `MoviesRepository`, calls the use case, and asserts the delegated call + returned `Result`.
- `test/features/movies/data/repositories/movies_repository_impl_test.dart` — extend with four cases covering the new methods (assert delegation + `.toDomain()` mapping).
- `test/features/movies/data/datasources/movies_remote_data_source_impl_test.dart` — extend to cover (a) deterministic mock generation, (b) like/unlike toggling the `_likedReviewIds` set, (c) `getReviewDetails` returning `Failure(NotFoundError)` for unknown reviewId.
- `test/ui/reviews/review_details/` — widget tests:
  - Tap movie title → `MovieDetailRoute(movieId: <int>)` pushed (mock the router).
  - Tap author → `PublicProfileRoute(userId: <String>)` pushed.
  - Tap heart with succeeding `LikeReview` → optimistic update sticks; count +1.
  - Tap heart with failing `LikeReview` → count reverts; `SnackBar` with `reviewDetailsLikeError` appears (verify via `find.byType(SnackBar)`).
  - Tap share → injected mock `ShareService.shareReview` invoked exactly once with the loaded `MovieReview`; assert payload formatting.
  - Empty comments → `reviewDetailsNoComments` shown.
  - Comments `Failure` → inline retry row visible; primary content still rendered.
  - Hidden carousels when API returns empty.
  - Semantic-tree golden-style assertion: heart/share/author/movie-title each have the expected `Semantics(label, button: true)`.
- `test/ui/reviews/review_details/review_details_bloc_test.dart` — cubit tests for parallel fetch (assert `Future.wait` ordering), partial failure (comments fail → state still `Success`, only `comments` is `Failure`), and `toggleLike` happy/failure paths emitting `ReviewDetailsLikeFailed` once.

## Out of Scope

The following are intentionally excluded from this iteration:

- **Real backend.** All four new data source methods are mocked. Wiring to TMDB/our own backend is a follow-up — the contracts here are designed to make that swap data-source-only.
- **Comment authoring, replies, threading, moderation.** Comments are read-only and flat.
- **Like notifications.** Authors are NOT notified when their review is liked. Push notification infrastructure is a separate workstream.
- **Real-time / pull-to-refresh.** Like count and comment list are fetched once at screen load. No websocket. No pull-to-refresh gesture.
- **Sharing as image.** v1 ships text + URL only. Generating a styled review card image for Instagram Story sharing is deferred.
- **Deep link routing.** This spec defines the URL FORMAT (`https://muuvie.app/reviews/{reviewId}`) for the share payload but does NOT implement Universal/App Links handling on launch.
- **Real auth gating of the like button.** v1 always shows the like button. There is no auth-state observable in the current DI graph; gating ("hide for unauthenticated") is deferred until auth state is plumbed.
- **Analytics events.** Instrumentation (`review_liked`, `review_shared`, `review_comment_viewed`, `related_review_tapped`) is desirable but excluded.
- **Locales beyond en/es/pt.** New strings ship in the three existing locales only.
- **Migrating off hardcoded `_reviewBody` switch elsewhere.** Confirmed via grep that the switch is only in `review_details_screen.dart:29-102`; this spec removes it. No other screen depends on it.
