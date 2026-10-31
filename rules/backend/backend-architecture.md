# Backend Architecture Rule

Applies to: `backend/` submodule. Kotlin 2.0.20 + Ktor 2.3.0 + Koin 3.5.6 (per `build.gradle.kts`).

## Module Layout

Source root: `backend/src/main/kotlin/org/mobyle/`. Sub-packages:

- `Main.kt` — entry point: `embeddedServer(Netty, ...)` + inline `configure*()` functions; no separate `Application.kt`
- `routing/` — Route extension functions, one file per resource (e.g. `MoviesRouting.kt`, `ProfileRouting.kt`, `ActivitiesRouting.kt`)
- `di/` — `appModule` (use-case bindings) + `Utils.kt` (the `injection<T>()` helper)
- `model/` — Listing/wrapper response types serialized to JSON responses (e.g. `MovieListing`, `MovieReviewListing`)
- `domain/model/` — Internal domain types (e.g. `Movie`, `MovieDetail`, `Genre`)
- `domain/repository/` — Repository interfaces consumed by use cases
- `domain/usecase/` — Use case classes; sub-packages by feature (`movies/`, `profile/`, `activities/`)
- `data/repository/` — Repository implementations (delegate to `TmdbDataSource`)
- `data/remote/<source>/` — one folder per external source (`tmdb/`, `filmow/`, …): data source interface + implementation, DTOs and mappers (`data/remote/tmdb/Mappers.kt`: TMDB DTO → domain)
- `data/remote/model/` — TMDB DTO types (`@Serializable` data classes with `@SerialName`)
- `data/di/` — `dataModule`: `HttpClient`, `TmdbDataSource`, and repository `single {}` bindings

The test tree, `backend/src/test/kotlin/org/mobyle/`, mirrors `main/`.

## Routing

- One routing file per top-level resource path; the function is an extension on `Route`
- `configureRouting()` in `Main.kt` installs `ContentNegotiation` (JSON) BEFORE opening the `routing { }` block — an agent that omits this install will produce endpoints that cannot serialize responses; do not move or skip it
- All routes registered inside `configureRouting()` in `Main.kt` via `routing { getMoviesRouting(); ... }`
- Dependencies retrieved with the custom `injection<T>()` helper (defined in `di/Utils.kt`) rather than bare `by inject()`, due to a Ktor 2.x / Koin 3.x compatibility issue; do not change this pattern
- Each route validates inputs, calls a use case directly via `invoke`, and returns `call.respond(...)` with a typed body
- Minimal validation in route bodies (null-check path params, blank-check required query params); all domain logic lives in use cases and repositories

Example shape:
```kotlin
fun Route.getMoviesRouting() {
    val getMovieDetail by injection<GetMovieDetail>()

    get("/movies/{id}") {
        val movieId = call.parameters["id"]?.toIntOrNull()
        if (movieId == null) {
            call.respond(HttpStatusCode.BadRequest, "Invalid movie ID")
            return@get
        }
        call.respond(getMovieDetail(movieId))
    }
}
```

## Dependency Injection

- Two Koin modules installed in `Main.kt` → `configureKoin()`:
  - `dataModule` (`data/di/DataModule.kt`) — `single {}` bindings for `HttpClient`, `TmdbDataSource`, and all `*Repository` implementations
  - `appModule` (`di/AppModule.kt`) — `factory {}` bindings for every use case class; use cases receive repository via constructor
- Routes use `by injection<T>()` (the custom helper in `di/Utils.kt`), not `by inject()` directly
- TMDB API key read from `System.getenv("TMDB_API_KEY")` inside `dataModule`; at startup `Main.kt` logs a warning if `TMDB_API_KEY` is unset but does not abort. The `IllegalStateException` is thrown lazily the first time Koin resolves `HttpClient` (i.e., first inbound request to a movies route). New code must not suppress or catch this exception upstream — never hard-coded
- No use of `ktor.application.conf` / `environment.config` — all secrets are environment variables

## Error Handling

- A single catch-all `StatusPages` block in `Main.kt` → `configureStatusPages()` maps every `Throwable` to HTTP 500 with a JSON body `{ "error": "Internal Server Error", "message": "<cause.message>" }`; if `cause.message` is null the message field reads `"Unknown error"`
- No domain-specific exceptions exist yet; the pattern to follow when introducing them:
  - Define named exception classes (e.g. `MovieNotFoundException`, `TmdbRateLimitedException`)
  - Add typed `exception<MovieNotFoundException> { call, _ -> call.respond(HttpStatusCode.NotFound, ...) }` handlers inside `StatusPages` — never `try/catch` inside route bodies
  - Rate-limit handling: catch HTTP 429 from TMDB → throw `TmdbRateLimitedException` with Retry-After value → `StatusPages` maps it to 503
- Input validation (missing/invalid params) is done inline in route bodies with early `return@get`; these do NOT go through `StatusPages`

## TMDB Integration

- Single `HttpClient(CIO)` registered as a Koin `single` in `dataModule`; Bearer token and base URL configured globally via `defaultRequest { url("https://api.themoviedb.org/3/"); headers.append(HttpHeaders.Authorization, "Bearer $apiKey") }`
- All TMDB HTTP calls are encapsulated in `TmdbDataSourceImpl`; use cases and repositories never call `HttpClient` directly
- TMDB DTOs live in `data/remote/model/TmdbResponses.kt` — all `@Serializable` with `@SerialName` for snake_case fields
- Mapper extension functions in `data/remote/tmdb/Mappers.kt` convert TMDB DTOs to domain/model types; repositories call `.toDomain()` before returning results
- JSON deserialization uses `kotlinx.serialization` with `ignoreUnknownKeys = true` and `isLenient = true` to tolerate TMDB API changes
- Use case `invoke` functions use `runBlocking { repository.suspend_fun() }` rather than being `suspend` themselves — this is the current pattern; new use cases must follow it until the calling layer is made coroutine-aware. **Known performance cost (technical debt):** `runBlocking` inside a Ktor route handler parks one of Ktor's worker threads for the duration of the blocking call, reducing concurrent request throughput; under load this can lead to thread starvation. The pattern is tolerable here because (a) most routes do a single TMDB call (one block per request), (b) Ktor's default `Netty` event loop has enough workers for our throughput, and (c) introducing `suspend` use cases requires `suspend` route handlers + `coroutineScope { }` plumbing across `Main.kt`. Migrating to `suspend` end-to-end is the right long-term direction (file the refactor under `research/decisions/` before doing it); until then, new code MUST match the existing pattern so the codebase doesn't have two competing async models in flight at once.
