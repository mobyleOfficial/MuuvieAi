# Movie universe

> Mapped at backend@9c27152 muuvie@7a08b8e · source: code + app (2026-11-10)

A full-screen map of the movies similar to one movie, drawn as a star system in Flame: the movie is the star and its similar movies orbit it, closer when they are more alike. Tapping a planet opens a card; "Viajar" makes that planet the star of a new system, so the user hops from movie to movie. It opens from a movie's page and works without login; login only adds the viewer's state and the actions that write. Design and phases: `research/features/movie-universe/roadmap.md`.

## Sub-features
- **map:** title `l10n:universeTitle` "Universo de {title}". Up to 10 planets per system (TMDB `/similar`), placed by score (rank, shared genres, shared keywords). Planets orbit slowly (about 1.5 min a turn for the closest orbit, over 3 min for the farthest); the selected one holds still. Systems already visited stay on the map and stream in and out by distance. Pan and pinch; tapping another system's star focuses it. Loading, `l10n:universeEmpty` and `l10n:universeError` states. The canvas has one label, `l10n:universeMapLabel`, that points to the list.
- **list:** `l10n:universeShowList` / `l10n:universeShowMap` switch. Opens by itself when a screen reader is on, even when TalkBack reports late. Each row: title, year, status and `l10n:universeInCommon` "Em comum: …" (up to 4), a `l10n:universeMoreActions` menu and `l10n:universeTravelTo`.
- **card:** a planet's poster, status, "Em comum", `l10n:universeOpenDetails` (opens `MovieDetailRoute`), `l10n:universeTravel`, `l10n:universeWantToWatch` "Quero ver" and `l10n:universeAddToShelf`. The last two ask for login first; "Quero ver" marks the planet at once and reverts on failure (`l10n:universeWantToWatchError`).
- **travel:** a flight of 1.1–2.2 s, longer for farther systems: the camera eases out and in, pulls back a little mid-way, and the stars streak past. The new star sets off from where its planet was and grows to its size; its orbits fade in and its planets come out one by one. With reduced motion (system animations off) planets do not orbit and the camera jumps.
- **hops:** `l10n:universeHops` counts jumps from the origin; `l10n:universeBackToOrigin` returns. `l10n:universeShareRoute` shares `l10n:universeShareRouteText` with the path from origin to the current star. A failed jump says `l10n:universeTravelError`.
- **badges:** with login, watched planets get a check and Quero ver ones a bookmark (`me.status` on each movie of `GET /movies/{id}/similar`, filled when a token is sent). States refresh after "Adicionar à estante" and after a login.
- **filters:** `l10n:universeFilter` sheet: `l10n:universeFilterOnlyUnwatched`, `l10n:universeFilterDecade`, `l10n:universeFilterGenre` (only values present on the map), `l10n:universeFilterClear`. Non-matching planets fade and leave the list, but never move. Summary `l10n:universeFilterSummary`; nothing left: `l10n:universeFilterNoMatch`.
- **constellations:** in the same sheet, `l10n:universeConstellations` lists public shelves holding the current star (`l10n:universeConstellationLabel`; `l10n:universeConstellationsEmpty`, `l10n:universeConstellationsError`). Picking one lights its movies and joins them with lines (up to 10 pages of the shelf); picking it again turns it off. Summary `l10n:universeConstellationSummary`; failure `l10n:universeConstellationError`.
- **explorer pets:** with login, each system visited is recorded once per user. 10 systems unlock `l10n:petFoguete` Foguete (common), 50 `l10n:petAstronauta` Astronauta (rare); a snackbar `l10n:universeUnlockedPet` with `l10n:universeSeePet` opens `ShelterRoute` ([gamification](gamification.md)).

## How to get to it (user POV)
A movie's page › "Ações" (⋯, `l10n:movieDetailActions`) › "Explorar universo" (`l10n:universeAction`). It opens for guests too, without the login step the other rows have. No deep link.

## Where it lives
### App
- Routes: `MovieUniverseRoute` (root, pushed by `muuvie/lib/routes/app_movie_detail_links.dart`)
- Entry: the actions sheet in `muuvie/ui/movies_ui/lib/movie_detail/movie_detail_screen.dart` ([movie-detail](movie-detail.md))
- Screens and state: `muuvie/ui/universe/lib/movie_universe` (page, screen, `movie_universe_bloc.dart` holding `MovieUniverseCubit`, state); graph in `muuvie/ui/universe/lib/movie_universe/graph`, Flame map in `muuvie/ui/universe/lib/movie_universe/map`, streaming in `muuvie/ui/universe/lib/movie_universe/streaming`, filters in `muuvie/ui/universe/lib/movie_universe/filter`
- Data: `muuvie/features/movies/data/lib/datasources/remote/movies_remote_data_source_impl.dart` (similar), `muuvie/features/gamification/data/lib/datasources/gamification_remote_data_source.dart` (visits), shelves and watch state through their own features
### Backend
| Endpoint | Auth | Use case |
|---|---|---|
| `GET /movies/{id}/similar` | optional | `backend/src/main/kotlin/org/mobyle/domain/usecase/movies/GetSimilarMovies.kt` (score in `SimilarityScorer.kt`) |
| `POST /users/me/universe/visits` | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/gamification/RecordUniverseVisits.kt` (body `{"movieIds"}`, 1–50 ids) |
| `GET /movies/{id}/shelves/public` | none | `GetPublicShelvesWithMovie` ([shelves](shelves.md)) |
| `GET /shelves/{id}/movies` | optional | constellation members ([shelves](shelves.md)) |

## Driving it
```bash
# {id} is the Muuvie catalog id, not the TMDB id
curl -s localhost:8080/api/v1/movies/550/similar | jq '{movieId, first: .results[0].title, affinity: .affinities[0]}'
curl -s -X POST localhost:8080/api/v1/users/me/universe/visits \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"movieIds":[550,680]}'   # {"systemsVisited":2,"unlockedPets":[]}
```
App: push `MovieUniverseRoute(movieId:, movieTitle:, posterPath:)`, or open any movie and tap "Explorar universo".

## Gotchas
- Similar lists are cached in Postgres for 7 days, empty ones too (`movies.similars_checked_at`), so a movie TMDB has no similars for is not asked again for a week.
- Similars without genres or keywords score only by TMDB rank (about 0.5) and are pushed ahead in the enrichment queue (up to 10 per call); the better orbit shows on the next visit.
- Visits are recorded only with login, on load and after each successful jump, in chunks of 50. A guest who logs in mid-session (through "Quero ver" or "Adicionar à estante") gets every system already on the map recorded then.
- The map is a canvas: widget tests and screen readers go through the list.
