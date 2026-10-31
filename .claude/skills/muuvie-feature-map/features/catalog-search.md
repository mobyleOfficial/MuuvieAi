# Catalog search and browse

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

The Catálogo tab (`SearchTab`): a search field over a discovery hub.
- With nothing typed, the hub shows genre chips and rows of movies, shelves, locadoras and cinéfilos, each with "Ver tudo".
- Typing switches to six result tabs: movies, people, shelves, locadoras, CineClubes and maratonas.
- At the bottom, the "Explorar o catálogo" grid (`l10n:discoverExplore`) opens TMDB listings: by release date, by genre, country or language, most popular, and most anticipated.

It works logged out. With a token, movies carry the viewer's state, and the viewer's own shelves, locadoras and profile are left out of discovery.

## Sub-features
- **search-field:** placeholder "Filmes, pessoas, estantes e mais" (`l10n:searchHint`). Results show while the field has text. Back first unfocuses the field, then clears it, then leaves the tab.
- **recent-searches:** shown while the field is focused and empty. "Buscas recentes" (`l10n:searchRecent`) lists the last 10 queries; tap one to run it again. "Limpar tudo" (`l10n:searchClearRecent`) clears them all, and the × button ("Remover", `l10n:searchRemoveRecent`) removes one. With no history, the hub shows instead. A query is saved on keyboard submit, when a movie result is opened, or when a recent search is tapped. It is stored on the device (ObjectBox, capped at 100) and never sent to the server.
- **movie-results:** tab "Filmes" (`l10n:searchTabMovies`).
  - Fewer than 3 letters shows "Digite pelo menos 3 letras" (`l10n:searchMinLetters`). From 3 letters a spinner shows, and `GET /movies/search` runs 300 ms after typing stops.
  - No match shows "Nenhum resultado encontrado" (`l10n:noResults`). A failure shows "Algo deu errado" (`l10n:emptyStateErrorTitle`) with the message, and no retry.
  - A row shows poster, title and year, plus the viewer's rating badge or a Já assisti / Quero ver mark. Tapping it opens `MovieDetailRoute` ([movie-detail](movie-detail.md)).
  - Only the first page loads (20 TMDB results); there is no infinite scroll.
- **other-result-tabs:** they search 400 ms after typing stops and scroll forever. Empty shows "Nada aqui ainda" (`l10n:emptyStateNoItemsTitle`); an error offers "Tentar novamente" (`l10n:emptyStateRetry`).
  - "Pessoas" (`l10n:searchTabPeople`) lists Muuvie users, not cast. Name, @ or username all match; the "@" is stripped.
  - "Estantes" and "Locadoras" (`l10n:profileTabShelves`, `l10n:profileTabLocadoras`).
  - "CineClubes" and "Maratonas" (`l10n:programacaoCineClubesTab`, `l10n:programacaoMaratonasTab`) include finished ones.
- **discovery-hub:** from the top:
  - Genre chips ("Gêneros", `l10n:discoverGenres`; hidden while loading or on failure) open `ReleaseDateMoviesRoute` for that genre, by `popularity.desc`.
  - "Em alta no Muuvie" (`l10n:discoverTrending`): the most logged movies of the last 7 days.
  - "Em cartaz e lançamentos" (`l10n:discoverReleases`): TMDB releases of the last 45 days, by popularity.
  - "Mais amados no Muuvie" (`l10n:discoverMostLoved`): movies with at least 2 ratings.
  - "Estantes mais populares", "Locadoras da comunidade" and "Cinéfilos para seguir" (`l10n:discoverShelves`, `l10n:discoverLocadoras`, `l10n:discoverProfiles`): curated items first, then the most active of the last 30 days.

  A loading row shows grey placeholders. A failed row shows "Não foi possível carregar esta seção" (`l10n:discoverSectionError`) with "Tentar novamente"; an empty row is hidden. Pull to refresh reloads them all.
- **see-all:** "Ver tudo" (`l10n:profileSeeAll`) opens a full list:
  - On the two Muuvie rankings, `MuuvieRankingRoute`: a paged poster grid with the row's title.
  - On releases, `ReleaseDateMoviesRoute` with the same filter.
  - On shelves, locadoras and cinéfilos, `DiscoverListRoute`: the search tabs' paged list, without a query. Empty shows "Nada por aqui ainda." (`l10n:discoverEmpty`).
- **browse-release-date:** "Data de lançamento" (`l10n:searchBrowseReleaseDate`) → `ReleaseDateDecadesRoute` ("Data de Lançamento", `l10n:routeReleaseDate`).
  - "Upcoming" lists movies from today on, earliest first (`sort_by=primary_release_date.asc`).
  - The decades run from 2020s down to 1870s. A decade opens `ReleaseDateYearsRoute`, titled e.g. "1990s": "Any" lists the whole decade (`release_date_gte`/`release_date_lte`), then come the 10 years, newest first (`year=`).
- **browse-categories:** "Gênero, País e Idioma" (`l10n:searchBrowseGenreCountryLanguage`) → `BrowseCategoriesRoute` ("Explorar", `l10n:routeBrowse`).
  - It loads `GET /movies/genres`, `GET /movies/countries` and `GET /movies/languages` in parallel. If any one fails, the whole screen shows "Algo deu errado" with "Tentar novamente".
  - Tabs: "Gênero", "País", "Idioma" (`l10n:searchBrowseGenre`, `l10n:searchBrowseCountry`, `l10n:searchBrowseLanguage`). Countries and languages are sorted A–Z, ignoring accents.
  - A tap filters by `with_genres`, `with_origin_country` or `with_original_language`, in TMDB's default order.
- **browse-popular:** "Mais populares" (`l10n:searchBrowseMostPopular`) → `MostPopularRoute` ("Mais Populares", `l10n:routeMostPopular`): `popularity.desc`. "Mais aguardados" (`l10n:searchBrowseMostAnticipated`) → `MostAnticipatedRoute` ("Mais Esperados", `l10n:routeMostAnticipated`): from today on, `popularity.desc`.
- **listing-grid:** `ReleaseDateMoviesRoute` and the popular, anticipated and ranking screens are paged poster grids on `GET /movies/discover` (the rankings use `/discover/movies/*`).
  - They load pages up to `totalPages`. A spinner shows while the first page loads; a failed first page offers "Tentar novamente".
  - Empty shows "Nada aqui ainda" / "Não há itens para exibir." (`l10n:emptyStateNoItemsMessage`); the rankings show "Nada por aqui ainda." instead.
  - A poster opens `MovieDetailRoute`.

## How to get to it (user POV)
Catálogo tab (`l10n:navCatalogo`) › the field at the top; or scroll the hub › Ver tudo, a genre chip, or a tile of "Explorar o catálogo". No deep link.

## Where it lives
### App
- Routes: `SearchRoute`, `DiscoverListRoute`, `MuuvieRankingRoute`, `ReleaseDateDecadesRoute`, `ReleaseDateYearsRoute`, `ReleaseDateMoviesRoute`, `BrowseCategoriesRoute`, `MostPopularRoute`, `MostAnticipatedRoute`
- Screens and state: `muuvie/ui/search/lib/search_screen.dart` (`SearchCubit` in `muuvie/ui/search/lib/search_bloc.dart`), `muuvie/ui/search/lib/discover` (hub, `DiscoverList`, `ProgramacaoSearchList`), `muuvie/ui/search/lib/muuvie_ranking/muuvie_ranking_page.dart`, `muuvie/ui/search/lib/release_date`, `muuvie/ui/search/lib/browse_categories`, `muuvie/ui/search/lib/most_popular`, `muuvie/ui/search/lib/most_anticipated`. Route titles: `muuvie/lib/routes/route_title_resolver.dart`
- Data: `muuvie/features/movies/data/lib/datasources/remote/movies_remote_data_source_impl.dart` (search, discover, vocabularies, rankings), `muuvie/features/movies/data/lib/datasources/local/movies_local_data_source_impl.dart` (recent searches), `muuvie/features/shelves/data/lib/datasources/shelves_remote_data_source_impl.dart` and `muuvie/features/shelves/data/lib/datasources/locadoras_remote_data_source_impl.dart` (discover shelves and locadoras), `muuvie/features/profile/data/lib/datasources/profiles_remote_data_source_impl.dart` (discover profiles)
### Backend
| Endpoint | Auth | Use case |
|---|---|---|
| `GET /movies/search` | optional | `backend/src/main/kotlin/org/mobyle/domain/usecase/movies/SearchMovies.kt` + `AttachMovieStates.kt` |
| `GET /movies/discover` | optional | `backend/src/main/kotlin/org/mobyle/domain/usecase/movies/DiscoverMovies.kt` + `AttachMovieStates.kt` |
| `GET /movies/genres`, `GET /movies/countries`, `GET /movies/languages` | public | `GetGenres.kt`, `GetCountries.kt`, `GetLanguages.kt` in `backend/src/main/kotlin/org/mobyle/domain/usecase/movies` |
| `GET /discover/movies/trending` | optional | `backend/src/main/kotlin/org/mobyle/domain/usecase/discover/DiscoverContent.kt` (`DiscoverTrendingMovies`) |
| `GET /discover/movies/loved` | optional | same file (`DiscoverLovedMovies`) |
| `GET /discover/shelves` | optional | same file (`DiscoverShelves`) |
| `GET /discover/profiles` | optional | same file (`DiscoverProfiles`) |
| `GET /movies/trending` (not called by the app) | optional | `backend/src/main/kotlin/org/mobyle/domain/usecase/movies/GetTrendingMovies.kt` |

The hub and the search tabs also call `GET /discover/locadoras` ([locadoras](locadoras.md)), `GET /cineclubes` ([cineclubes](cineclubes.md)) and `GET /maratonas` ([maratonas](maratonas.md)).

## Driving it
```bash
API=http://localhost:8080/api/v1
curl -s "$API/movies/search?query=matrix&page=1" -H "Authorization: Bearer $TOKEN" | jq '.movies[0] | {id, title, me}'
curl -s "$API/movies/discover?page=1&with_genres=27&sort_by=popularity.desc" | jq '{totalPages, first: .movies[0].title}'
curl -s "$API/movies/discover?page=1&release_date_gte=1990-01-01&release_date_lte=1999-12-31" | jq '.totalResults'
curl -s "$API/movies/countries" | jq 'length'
curl -s "$API/discover/movies/trending?page=1&limit=20&days=7" | jq '.results | length'
curl -s "$API/discover/profiles?q=@ana&page=1&limit=20" -H "Authorization: Bearer $TOKEN" | jq '.results[].handle'
```
App: the Catálogo tab opens on `SearchRoute`. To reach a filtered grid directly, push `ReleaseDateMoviesRoute(title: 'Terror', withGenres: '27')` inside `SearchTab`.

## Gotchas
- `GET /movies/search` and `GET /movies/discover` proxy TMDB and write every result into the catalog, so each one gets a Muuvie id. The `id` in a result is that catalog id, which is what `MovieDetailRoute` takes; it is not the TMDB id.
- `GET /movies/search` answers 400 on a blank `query`; the 3-letter minimum keeps the app from sending one. `GET /movies/discover` does not validate anything: its filters go straight to TMDB. `vote_count_gte` is supported but no screen sets it.
- The `/discover/*` endpoints check `page ≥ 1` and `limit` 1..50 (400 `invalid_pagination`). Trending takes `days` 1..30 (default 7); the app never sends it.
- The two Muuvie rankings come from Muuvie data, so on a fresh database both rows are hidden. To fill them, log a session within 7 days (trending) and have two users rate the same movie (loved).
- Some screens are not localized. The decade and year screens hard-code "Upcoming", "Any" and "1990s" in English, and Explorar's error message reads "Failed to load categories".
- The tile reads "Mais aguardados" but its screen is titled "Mais Esperados": two different keys.
- `GET /shelves/search` is not called here. It searches the viewer's own shelves (`SearchMyShelves`), and no screen uses that (see [shelves](shelves.md)).
