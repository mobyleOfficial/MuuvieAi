# Movie detail

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

A movie's page (`MovieDetailRoute`), reachable from almost every tab. From the top:
- the header (backdrop, trailer, poster, credits);
- the viewer's watch panel, whose writes are covered on [watch-logs](watch-logs.md);
- an actions sheet;
- three pinned tabs: Sobre (synopsis, where to watch, cast, similar movies), Comunidade (what Muuvie did with the movie) and Atividade (the feed of sessions and ratings).

It also covers the person page `PersonDetailRoute`, which nothing in the app opens. Reading works logged out; every action asks to log in first.

## Sub-features
- **load:** `GET /movies?id=<catalog id>` behind a spinner. A failure shows "Algo deu errado" (`l10n:emptyStateErrorTitle`) with the server message and "Tentar novamente" (`l10n:emptyStateRetry`); an unknown id gets 404 "Movie not found".
- **header:**
  - The backdrop fades into the page. "Ver trailer" (`l10n:movieDetailTrailer`) shows only with a `trailerKey` and opens YouTube outside the app.
  - The poster, with the localized title and, below it in italics, the original title.
  - "ano · N min", genre pills, then "Dirigido por" / "Roteiro de" (`l10n:movieDetailDirectedBy`, `l10n:movieDetailWrittenBy`).
- **watch-panel:** `MovieWatchPanel` loads `GET /movies/{id}/me`. A 401 makes it the guest panel, where every tile first opens login (`AuthGate`). A failure shows a "Tentar novamente" button. "Quero ver" shows above the tiles when it applies. The tiles:
  - "Já assisti" (`l10n:systemShelfWatched`) logs a session for today in one tap. Once watched it turns into "Assistir de novo" (`l10n:rewatchAction`) when a rewatch is allowed, else a selected "Já assisti".
  - "Avaliar" (`l10n:ratingTitle`), or the current label in its color, opens `RateMovieRoute`.
  - "Assistindo agora" (`l10n:watchingNowTitle`) is a toggle.
  - "Histórico" (`l10n:historyTitle`) opens `MovieHistoryRoute`; it is missing for guests.

  Below the tiles: a progress bar while the current cycle is unfinished, "Registrar sessão" (`l10n:watchLogAction`) → `LogSessionRoute`, and the "Ações" button (`l10n:movieDetailActions`, a "⋯" icon). A failed quick action shows "Não deu para atualizar. Tente de novo." (`l10n:watchStateError`). Saving a rating or a session reloads the Comunidade sections.
- **actions-sheet:** a bottom sheet (`_showActionsSheet` in `muuvie/ui/movies_ui/lib/movie_detail/movie_detail_screen.dart`, not a route) titled with the movie. Each row closes the sheet and goes through login first.
  - "Adicionar à estante…" (`l10n:addToShelvesAction`) → `AddToShelvesRoute`; back here it shows "Salvo em N estantes" (`l10n:addToShelvesSaved`). See [shelves](shelves.md).
  - "Criar CineClube com este filme" (`l10n:movieDetailCreateCineClube`) → `CineClubeEditorRoute` with the movie as the first session ([cineclubes](cineclubes.md)).
  - "Sessão sincronizada" (`l10n:movieDetailWatchParty`) → `WatchPartyRoute` ([games](games.md)).
- **about-tab:** "Sobre" (`l10n:movieDetailAboutTab`).
  - A notice (`l10n:movieDetailUnmatched`) for imported movies that could not be matched to TMDB.
  - "Sinopse" (`l10n:movieDetailSynopsis`), cut at 4 lines with "Ler mais"/"Ler menos" (`l10n:movieDetailReadMore`, `l10n:movieDetailReadLess`). It may carry a note that it was machine translated or is only in English (`l10n:movieDetailSynopsisTranslated`, `l10n:movieDetailSynopsisInEnglish`).
  - "Onde Assistir" (`l10n:movieDetailWhereToWatch`): one row of provider logos, plus a "+N" tile that expands them.
  - "Elenco" (`l10n:movieDetailCast`): cast cards, not tappable.
  - "Filmes Similares" (`l10n:movieDetailSimilar`): each opens its own `MovieDetailRoute`.

  Every section is hidden when it has no data.
- **community-tab:** "Comunidade" (`l10n:movieCommunityTitle`). Every section is hidden on failure, and most when empty.
  - **Counts and charts** (`GET /movies/{id}/community`): "Assistiram", "Querem ver" and "Estantes" (`l10n:movieStatWatched`, `l10n:movieStatWantToWatch`, `l10n:movieStatShelves`). "Estantes" opens `MovieShelvesRoute` when it is above 0. Then the ratings by label ("Avaliações", `l10n:movieDetailReviews`) and "Como as pessoas se sentiram" (`l10n:movieCommunityFeelings`; 5 emotions, then "Ver todas"). With nothing yet: "Ninguém interagiu com este filme ainda." (`l10n:movieCommunityEmpty`).
  - **"Últimos 12 meses"** (`l10n:movieTimelineTitle`, `GET /movies/{id}/timeline?months=12`): sessions and ratings per month.
  - **"Avaliações recentes"** (`l10n:movieRecentRatings`): up to 3 ratings that have a review, from `GET /movies/{movieId}/activities` with `scope=all&type=ratings`. "Ver todas" (`l10n:movieRecentRatingsAll`) jumps to Atividade, filtered on Avaliações.
  - **"Em estantes"** (`l10n:movieShelvesSection`): public shelves holding the movie (`GET /movies/{id}/shelves/public`, [shelves](shelves.md)). A card opens `ShelfDetailRoute`; "Ver todas" opens `MovieShelvesRoute`.
  - **"Na Programação"** (`l10n:movieEventsTitle`, `GET /movies/{id}/events`): open maratonas the movie counts for, with "Conta para: …" (`l10n:movieEventCountsFor`).
  - **CineClubes row** (`GET /movies/{id}/cineclubes`) and **"Maratonas em que contou"** (`l10n:movieMaratonasSection`, `GET /movies/{id}/maratonas`): paged sideways rows. A card opens `CineClubeDetailRoute` or `MaratonaDetailRoute`.
- **activity-tab:** "Atividade" (`l10n:movieDetailRecordsTab`), the `MovieActivitiesFeed` of [social-feed](social-feed.md) on `GET /movies/{movieId}/activities`.
  - Kind chips: "Avaliações" / "Atualizações" / "Tudo" (`l10n:movieActivitiesRatings`, `l10n:movieActivitiesUpdates`, `l10n:movieActivitiesEverything`).
  - Scope chips: "Todos" / "Seguindo" / "Só eu" (`l10n:movieActivitiesEveryone`, `l10n:movieActivitiesFollowing`, `l10n:movieActivitiesOnlyMe`). "Seguindo" and "Só eu" need login.
  - Empty: "Ninguém registrou este filme ainda. Seja a primeira pessoa!" (`l10n:movieRecordsEmpty`).
- **person:** `PersonDetailRoute(personId, tmdbPersonId?, personName)`. It calls `GET /persons/{id}`, or `GET /persons/tmdb/{tmdbId}` when `personId` ≤ 0. It shows the photo and name, then poster grids under "Direção" and "Atuação" (`l10n:personDirected`, `l10n:personActed`) that open the movie. With no catalog movies: "Nenhum filme do catálogo ainda." (`l10n:personNoCredits`). An error offers "Tentar novamente".

## How to get to it (user POV)
Catálogo › a search result, hub card or browse poster › the movie. Also from a shelf, a feed card, a maratona or CineClube, the news, a similar movie, or a person's credits. `MovieDetailRoute` is registered in every tab and at the root.

## Where it lives
### App
- Routes: `MovieDetailRoute`, `PersonDetailRoute`
- Screens and state: `muuvie/ui/movies_ui/lib/movie_detail` (`movie_detail_screen.dart`, `MovieDetailCubit`, `movie_community_tab.dart`, `movie_charts.dart`, `movie_events_section.dart`, `recent_ratings_section.dart`), `muuvie/ui/movies_ui/lib/person_detail/person_detail_page.dart`, the panel `muuvie/ui/watch_logs/lib/movie_panel`, links to other modules `muuvie/lib/routes/app_movie_detail_links.dart`, the Atividade tab `muuvie/ui/social/lib/feed/movie_activities_feed.dart`
- Data: `muuvie/features/movies/data/lib/datasources/remote/movies_remote_data_source_impl.dart` (detail), `muuvie/features/movies/data/lib/datasources/remote/movie_community_remote_data_source.dart`, `muuvie/features/movies/data/lib/datasources/remote/persons_remote_data_source.dart`, `muuvie/features/watch_logs/data/lib/datasources/watch_logs_remote_data_source.dart` (`/me`), `muuvie/features/social_network/data/lib/datasources/social_network_remote_data_source.dart` (activities)
### Backend
| Endpoint | Auth | Use case |
|---|---|---|
| `GET /movies` | optional (adds `me`) | `backend/src/main/kotlin/org/mobyle/domain/usecase/movies/LookupMovieDetail.kt` |
| `GET /movies/{id}` (not called by the app) | optional | same; `{id}` is a TMDB id here |
| `GET /movies/{id}/me` | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/watch/GetMovieUserState.kt` |
| `GET /movies/{id}/community` | public | `backend/src/main/kotlin/org/mobyle/domain/usecase/watch/GetMovieCommunity.kt` |
| `GET /movies/{id}/timeline` | public | `backend/src/main/kotlin/org/mobyle/domain/usecase/movies/GetMovieTimeline.kt` |
| `GET /movies/{id}/events` | optional (`joined`) | `backend/src/main/kotlin/org/mobyle/domain/usecase/movies/GetMovieEvents.kt` |
| `GET /movies/{id}/cineclubes` | optional | `backend/src/main/kotlin/org/mobyle/domain/usecase/movies/GetMovieCineClubes.kt` |
| `GET /movies/{id}/maratonas` | optional | `backend/src/main/kotlin/org/mobyle/domain/usecase/movies/GetMovieMaratonas.kt` |
| `GET /movies/{movieId}/activities` | optional for `scope=all`, else required | `backend/src/main/kotlin/org/mobyle/domain/usecase/feed/FeedUseCases.kt` (`GetMovieActivities`) |
| `GET /persons/{id}` (no entry point in the app) | public | `backend/src/main/kotlin/org/mobyle/domain/usecase/movies/GetPersonDetail.kt` |
| `GET /persons/tmdb/{tmdbId}` (no entry point in the app) | public | same (`byTmdbId`) |

## Driving it
```bash
API=http://localhost:8080/api/v1
ID=$(curl -s "$API/movies/search?query=matrix" | jq '.movies[0].id')
curl -s "$API/movies?id=$ID" -H "Authorization: Bearer $TOKEN" | jq '{title, localTitle, me}'
curl -s "$API/movies/$ID/me" -H "Authorization: Bearer $TOKEN"
curl -s "$API/movies/$ID/community" | jq
curl -s "$API/movies/$ID/timeline?months=12" | jq '.months | length'
curl -s "$API/movies/$ID/activities?scope=all&type=ratings&limit=20" | jq '.results | length'
curl -s "$API/persons/tmdb/6384" | jq '.person.name, (.credits | length)'
```
App: push `MovieDetailRoute(movieId: <catalog id>, movieTitle: '…')`. Opening `PersonDetailRoute(personId: 0, tmdbPersonId: 6384, personName: 'Keanu Reeves')` takes a code change, because no screen pushes it.

## Gotchas
- `GET /movies` takes `id`, `tmdbId` or `filmowId`; the app only sends `id`. `GET /movies/{id}` looks the movie up by TMDB id despite the name, and the app never calls it.
- `PersonDetailRoute` is registered under every tab and at the root, but nothing pushes it, and the cast cards are not tappable. So the person page and both `/persons` endpoints are unreachable from the UI.
- `/events` returns maratonas and CineClubes, but "Na Programação" shows only the maratonas and is hidden when there are none. The CineClubes row comes from `/cineclubes` instead.
- `GET /movies/{id}/timeline` takes `months` 1..24 (400 outside); the app always sends 12. The `/cineclubes` and `/maratonas` rows page with `limit=20`.
- Comunidade only reloads after a rating or session saved from this page. Changes made elsewhere show after leaving and reopening the movie.
- The actions sheet comes from `MovieWatchPanel.onMore`. It always has rows in the app, because `AppMovieDetailLinks` is registered.
