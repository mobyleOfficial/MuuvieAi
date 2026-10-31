# News

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

The Notícias tab: film news scraped by the backend from Brazilian outlets, newest first, filterable by source, with each article's cited movies one tap from Quero ver. Works logged out. Lives in `muuvie/ui/news` and `muuvie/features/news`; backend side is `ArticlesRouting.kt` and the scraping loop in `Main.kt`.

## Sub-features
- **list:** infinite list, 20 per page (`GET /articles?page=&limit=20`), stops at `totalPages`. The newest article is a large featured card; the rest are tiles with source · date (locale `yMMMd`). Spinner on the first page; error → "Algo deu errado" (`l10n:emptyStateErrorTitle`) with "Tentar novamente" (`l10n:emptyStateRetry`); empty → "Nada aqui ainda" (`l10n:emptyStateNoItemsTitle`). Pull to refresh reloads only the source on screen.
- **source-filter:** chips "Todas" (`l10n:newsAllSources`) plus each outlet from `GET /articles/sources`, shown only with more than one source. Each source keeps its own pages and scroll position, so switching back does not reload.
- **read-marks:** opening an article marks it "Lido" (`l10n:newsRead`) on the list. Kept on the device only (last 500 ids in a JSON file), not on the server.
- **detail:** `GET /articles/{articleId}`: image, info, cited movies, full text, "Compartilhar artigo" (`l10n:articleDetailShare`, shares title, summary and source URL). Title comes from the list into the app bar. Error → `l10n:emptyStateErrorTitle` with retry.
- **cited-movies:** "Filmes citados" (`l10n:newsMoviesTitle`), horizontal cards, hidden when the article cites none.
  - Poster opens `MovieDetailRoute` (see [movie-detail](movie-detail.md)).
  - Already watched → "Já assisti" (`l10n:newsWatched`), no button.
  - "Quero ver" (`l10n:newsWantToWatch`) adds to the watchlist shelf; it turns into "No Quero ver" (`l10n:newsInWantToWatch`, disabled) immediately and reverts on failure. Snackbar "{title} está no Quero ver" (`l10n:newsAddedToWatchlist`) or "Não foi possível adicionar o filme" (`l10n:newsWantToWatchError`).
  - "Adicionar à estante" (`l10n:newsAddToShelf`) opens `AddToShelvesRoute` (see [shelves](shelves.md)).

## How to get to it (user POV)
Bottom bar › Notícias › tap an article. No deep link.

## Where it lives
### App
- Routes: `NewsListRoute` (root of `NoticiasTab`), `ArticleDetailRoute` (args `articleId`, `articleTitle`)
- Screens and state: `muuvie/ui/news/lib/news_list` (`NewsListCubit`, one `PagingController` per source), `muuvie/ui/news/lib/article_detail` (`ArticleDetailCubit`)
- Data: `muuvie/features/news/data/lib/datasources/remote/news_remote_data_source_impl.dart`, `muuvie/features/news/data/lib/datasources/local/news_read_local_data_source.dart`, `muuvie/features/news/data/lib/repositories/news_repository_impl.dart`; Quero ver via `muuvie/features/shelves/domain/lib/usecases/add_movie_to_watchlist.dart`
### Backend
| Endpoint | Auth | Use case |
|---|---|---|
| `GET /articles` | none | `backend/src/main/kotlin/org/mobyle/domain/usecase/articles/ArticlesV1.kt` (`GetArticlesPage`) |
| `GET /articles/sources` | none | same file (`GetArticleSources`) |
| `GET /articles/{articleId}` | optional (adds `me` per movie: watched, in Quero ver) | same file (`GetArticle`) |
| `GET /users/{userId}/shelves` (as `me`) | required for `me` | `backend/src/main/kotlin/org/mobyle/domain/usecase/shelves/GetUserShelves.kt` (see [shelves](shelves.md)) |
| `POST /movies/{id}/shelves` | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/shelves/AddMovieToShelves.kt` (see [shelves](shelves.md)) |

Scraping: `backend/src/main/kotlin/org/mobyle/data/remote/articles/ArticlesDataSourceImpl.kt` (sources "G1 Cinema" from the g1 Pop RSS and "Omelete"), movie linking `backend/src/main/kotlin/org/mobyle/data/service/ArticleMovieLinker.kt`, loop in `backend/src/main/kotlin/org/mobyle/Main.kt` (`scheduleArticleScraping`).

## Driving it
```bash
B=localhost:8080/api/v1
curl -s "$B/articles?page=1&limit=20" | jq '.totalPages, .results[0] | {id, title, source, movies}'
curl -s $B/articles/sources                                  # ["G1 Cinema","Omelete"]
curl -s "$B/articles?source=Omelete&page=2"
curl -s $B/articles/1 -H "Authorization: Bearer $TOKEN"     # movies[].me filled; 404 for an unknown id
```
App: Notícias tab; logged in to try Quero ver.

## Gotchas
- The backend scrapes on boot and then every `SCRAPE_INTERVAL_HOURS` (default 3). A fresh database is empty until the first run finishes, and it needs network to the outlets; TMDB is needed to link cited movies (pending links retry each run).
- `limit` above 50 or `page` below 1 → 400 `invalid_pagination`; a non-numeric or non-positive id → 400 `validation_failed`.
- Quero ver is two calls: it pages `GET /users/{userId}/shelves` as `me` (up to 3 pages) to find the system watchlist shelf, then posts to it. Logged out, the first call fails with 401 and the snackbar shows the error; it does not open login.
- Opening the detail marks the article read even if loading fails.
