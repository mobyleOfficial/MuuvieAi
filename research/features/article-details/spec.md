---
date: 2026-07-18
author: pm-spec agent
status: draft
related:
  - new-movie-list-screen
tags: [frontend, ui, news, articles]
---

# Feature Spec: Article Details Screen

**Status:** Draft
**Priority:** High (MUST)
**Scope:** Frontend (muuvie submodule only)
**Author:** pm-spec agent
**Date:** 2026-07-18

---

## 1. Overview

Add an **ArticleDetailsScreen** that displays the full content of a news article when the user taps an article tile on the Articles tab. The screen follows the established Page/Screen split pattern (StatefulWidget Page + StatelessWidget Screen + Cubit + State) used by `MovieDetailPage` [Source: muuvie/ui/movies_ui/lib/movie_detail/movie_detail_page.dart]. It includes a hero image, article metadata (source, date), the full article body rendered as plain-text paragraphs, and a share button using the existing `ShareService` pattern [Source: muuvie/ui/common/lib/share/share_service.dart].

The domain and data layers already exist: the `Article` model [Source: muuvie/features/news/domain/lib/models/article.dart], `GetArticleDetail` use case [Source: muuvie/features/news/domain/lib/usecases/get_article_detail.dart], `NewsRepository` interface [Source: muuvie/features/news/domain/lib/repositories/news_repository.dart], `NewsRemoteDataSourceImpl`, `RemoteArticle` DTO, `NewsRepositoryImpl`, and the DI module [Source: muuvie/features/news/data/lib/di/news_di_module.dart] are all in place. Only the UI/presentation layer is missing. The `_ArticleTile.onTap` callback is currently a no-op [Source: muuvie/ui/movies_ui/lib/tabs/articles/movies_articles_screen.dart, line 77].

---

## 2. User Stories

**US-1: View full article**
As a user, I want to tap an article tile on the Articles tab and see the full article content on a dedicated screen, so I can read the complete text without leaving the app.

**US-2: See article metadata**
As a user, I want to see the article's source name, publication date, and hero image on the detail screen, so I know where and when the article was published.

**US-3: Share an article**
As a user, I want to tap a share button to share the article's source URL via the OS share sheet, so I can send the article to others.

**US-4: Open original source**
As a user, I want to tap a link or button to open the article's original source URL in an external browser, so I can read it on the publisher's site if I choose.

**US-5: Navigate back**
As a user, I want to tap a back button to return to the Articles tab, so I can continue browsing other articles.

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | Tapping an `_ArticleTile` on the Articles tab navigates to `ArticleDetailRoute` with the correct `articleId` | Navigation test: tap tile, verify route pushed with matching ID |
| AC-2 | The screen shows a loading indicator (`CircularProgressIndicator`) while fetching the article | Emit `ArticleDetailLoading` state, verify spinner is rendered |
| AC-3 | On successful load, the screen displays the article title in a prominent headline style | Visual inspection; verify `Text` widget contains `article.title` |
| AC-4 | On successful load, the screen displays the source name and formatted publication date below the title | Verify `article.source` and formatted `article.publishedAt` are rendered (format: `yMMMd` matching existing `_ArticleTile` pattern) |
| AC-5 | If `article.imageUrl` is non-null, a hero image is displayed at the top of the screen (e.g., inside a `SliverAppBar` or as a header image) using `CachedNetworkImage` | Provide article with `imageUrl`, verify image renders; provide `null`, verify placeholder or no image section |
| AC-6 | The full article body (`article.content`) is rendered as readable paragraphs, splitting on `\n\n` delimiters | Provide content with `\n\n` breaks, verify each paragraph is rendered as a separate `Text` widget or with appropriate spacing |
| AC-7 | If `article.summary` is non-empty, it is displayed as a distinct lead/intro paragraph (e.g., bold or larger text) before the body content | Verify summary appears visually distinct from body content |
| AC-8 | A share button (icon button in the app bar or floating) triggers `ShareService.shareArticle()` which shares the `article.sourceUrl` via `share_plus` | Tap share button, verify `SharePlus.instance.share` is called with a payload containing `sourceUrl` |
| AC-9 | A "Read original" link or button opens `article.sourceUrl` in an external browser via `url_launcher` | Tap link, verify `launchUrl` is called with the `sourceUrl` |
| AC-10 | On error, the screen displays `MuuvieEmptyState` with an error title, message, and a retry button that re-fetches the article | Emit `ArticleDetailError` state, verify empty state renders with retry action |
| AC-11 | The app bar includes a back button that pops the route | Tap back, verify `context.router.pop()` or system back navigation works |
| AC-12 | All user-facing strings are localized (EN, ES, PT) | Switch locale, verify translated strings for share button tooltip, "Read original" label, error states |
| AC-13 | The screen follows the 4-file Page/Screen split: `article_detail_page.dart` (StatefulWidget), `article_detail_screen.dart` (StatelessWidget), `article_detail_cubit.dart`, `article_detail_state.dart` | Code review: verify file structure matches pattern |
| AC-14 | The cubit is created in the Page and NOT registered in DI (per project convention) | Code review: verify `ArticleDetailCubit` is instantiated in `ArticleDetailPage`, not in any DI module |

---

## 4. Technical Notes

### 4.1 Existing Domain & Data Layers (No Changes Needed)

The entire domain and data stack is already implemented and registered in DI:

| Layer | File | What It Provides |
|-------|------|-----------------|
| Domain Model | `features/news/domain/lib/models/article.dart` | `Article` class with fields: `id`, `title`, `summary`, `content`, `imageUrl`, `sourceUrl`, `source`, `publishedAt` |
| Use Case | `features/news/domain/lib/usecases/get_article_detail.dart` | `GetArticleDetail extends UseCase<int, Result<Article>>` |
| Repository Interface | `features/news/domain/lib/repositories/news_repository.dart` | `getArticleDetail({required int articleId})` |
| Repository Impl | `features/news/data/lib/repositories/news_repository_impl.dart` | `NewsRepositoryImpl` |
| Remote Data Source | `features/news/data/lib/datasources/remote/news_remote_data_source_impl.dart` | `NewsRemoteDataSourceImpl` |
| DTO | `features/news/data/lib/models/remote/remote_article.dart` | `RemoteArticle` |
| DI Module | `features/news/data/lib/di/news_di_module.dart` | Registers `GetArticleDetail` as `@injectable` |

### 4.2 New Files to Create

All new files live under `muuvie/ui/movies_ui/lib/article_detail/`:

| File | Purpose |
|------|---------|
| `article_detail_page.dart` | `@RoutePage()` StatefulWidget. Creates `ArticleDetailCubit` with `GetIt.I<GetArticleDetail>()` and the `articleId`. Disposes cubit on close. Renders `ArticleDetailScreen`. Mirrors `MovieDetailPage` pattern. |
| `article_detail_screen.dart` | Stateless UI. Receives `ArticleDetailCubit`. Uses `BlocProvider.value` + `BlocBuilder` with sealed-class `switch`. Renders loading/error/success states. Success state shows scrollable article content with hero image, metadata, paragraphs, share button, and "Read original" link. |
| `article_detail_cubit.dart` | `ArticleDetailCubit extends Cubit<ArticleDetailState>`. Takes `GetArticleDetail` use case and `int articleId`. Fetches on construction. Exposes `reload()` for retry. Mirrors `MovieDetailCubit`. |
| `article_detail_state.dart` | Sealed class: `ArticleDetailLoading`, `ArticleDetailSuccess(Article article)`, `ArticleDetailError(String message)`. Mirrors `MovieDetailState`. |
| `article_detail_router.dart` | `@AutoRouterConfig` with `ArticleDetailRoute.page`. Mirrors `MovieDetailRouter`. |

### 4.3 Files to Modify

| File | Change |
|------|--------|
| `muuvie/ui/movies_ui/lib/tabs/articles/movies_articles_screen.dart` | Wire `_ArticleTile.onTap` to push `ArticleDetailRoute(articleId: article.id)` via `context.router`. Pass `articleId` as a constructor parameter to `_ArticleTile`. |
| `muuvie/ui/movies_ui/lib/home/movies_home_router.dart` (or equivalent) | Add `AutoRoute(page: ArticleDetailRoute.page)` to the router's routes list. |
| `muuvie/ui/common/lib/share/share_service.dart` | Add `Future<void> shareArticle(Article article)` to the `ShareService` interface. Implement in `SharePlusShareService` with payload: `"<title> — <source>\n\n<sourceUrl>"`. |
| Localization `.arb` files (EN, ES, PT) | Add keys: `articleDetailReadOriginal` ("Read original article"), `articleDetailShareTooltip` ("Share article"), `articleDetailPublishedBy` ("Published by {source}"), and any other article-specific strings. |

### 4.4 Cubit Design

```dart
class ArticleDetailCubit extends Cubit<ArticleDetailState> {
  final GetArticleDetail _getArticleDetail;
  final int _articleId;

  ArticleDetailCubit(this._getArticleDetail, this._articleId)
      : super(const ArticleDetailLoading()) {
    _fetchArticleDetail();
  }

  void reload() {
    emit(const ArticleDetailLoading());
    _fetchArticleDetail();
  }

  Future<void> _fetchArticleDetail() async {
    final result = await _getArticleDetail(_articleId);
    switch (result) {
      case Success(:final data):
        emit(ArticleDetailSuccess(data));
      case Failure(:final error):
        emit(ArticleDetailError(error.message));
    }
  }
}
```

### 4.5 Content Rendering

The `article.content` field contains plain text with `\n\n` as paragraph delimiters. The screen should split on `\n\n` and render each paragraph as a separate `Text` widget with vertical spacing (`SizedBox(height: 16)`) between them. This avoids a single massive `Text` widget and allows for better layout control.

```dart
// Pseudocode for content rendering
final paragraphs = article.content.split('\n\n');
Column(
  children: paragraphs.map((p) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Text(p, style: bodyStyle),
  )).toList(),
)
```

### 4.6 Share Payload

Extend `ShareService` with an `shareArticle` method. The share payload format:

```
<title> -- <source>

<sourceUrl>
```

Example: `"New Movie Announced -- Hollywood Reporter\n\nhttps://hollywoodreporter.com/article/123"`

### 4.7 Navigation

The `ArticleDetailPage` receives `articleId` as a required path parameter via AutoRoute. The article list screen pushes the route:

```dart
context.router.push(ArticleDetailRoute(articleId: article.id));
```

### 4.8 DI / Registration

`GetArticleDetail` is already registered in GetIt via `NewsDiModule` [Source: muuvie/features/news/data/lib/di/news_di_module.dart]. The `ArticleDetailCubit` is created directly in `ArticleDetailPage` (cubits are not registered in DI per project convention [Source: muuvie/ui/movies_ui/lib/movie_detail/movie_detail_page.dart, lines 24-25]).

### 4.9 External Dependencies

| Package | Usage | Already in project? |
|---------|-------|-------------------|
| `share_plus` | OS share sheet | Yes (used by `SharePlusShareService`) |
| `url_launcher` | Open source URL in browser | Check `pubspec.yaml`; add if missing |
| `cached_network_image` | Hero image loading/caching | Yes (used in `MovieDetailScreen`) |
| `intl` | Date formatting (`DateFormat.yMMMd`) | Yes (used in `_ArticleTile`) |

---

## 5. Cross-Repo Impact

| Repo | Impact |
|------|--------|
| **muuvie** (frontend) | Primary and only target. New screen under `ui/movies_ui/lib/article_detail/`. Modifications to `MoviesArticlesScreen` (wire onTap), router (add route), `ShareService` (add `shareArticle`), and localization `.arb` files. |
| **backend** | No changes. `GET /articles/{articleId}` already returns all needed fields. |
| **MuuvieAi** (meta-repo) | Submodule ref bump for `muuvie` after merge. |

---

## 6. Out of Scope

- **Article comments or reactions.** This feature is read-only content display.
- **Offline caching or bookmarking of articles.** Articles are fetched live on each visit.
- **Rich text / HTML rendering.** Content is plain text only; no Markdown or HTML parser is needed.
- **In-app WebView for the source URL.** The "Read original" action opens the system browser.
- **Article search or filtering.** The Articles tab list already handles browsing; this screen is detail-only.
- **Backend changes.** The API endpoint and all data/domain layers are already complete.
- **Deep linking to article detail.** Navigation is in-app only for this iteration.

---

## 7. Open Questions

| # | Question | Impact |
|---|----------|--------|
| OQ-1 | Should the hero image use a `SliverAppBar` with collapse-on-scroll (like `MovieDetailScreen`) or a simpler fixed header image? The `SliverAppBar` approach provides a richer experience but adds complexity. This spec recommends `SliverAppBar` for consistency with `MovieDetailScreen`. | UI layout and scroll behavior |
| OQ-2 | Should `url_launcher` be added as a dependency if not already present, or should the "Read original" button be deferred to a follow-up? | Dependencies, scope |
| OQ-3 | Should the share payload include the article summary in addition to title + source + URL? A longer payload provides more context but may be too verbose for some share targets. | `ShareService.shareArticle` implementation |
| OQ-4 | Should the `_ArticleTile` also pass the `article.title` to the route (for immediate app bar display before the fetch completes), mirroring how `MovieDetailPage` receives both `movieId` and `movieTitle`? | Route parameters, UX polish |
| OQ-5 | Is there an existing accessibility pattern for long-form article text (e.g., semantic headings, adjustable font size)? If so, it should be applied here. | Accessibility compliance |
