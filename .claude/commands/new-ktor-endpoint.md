---
name: new-ktor-endpoint
description: Scaffold a new Ktor API endpoint with routing
---

# New Ktor Endpoint Scaffold

Create a new API endpoint handler with routing and dependency injection for the Ktor backend.

## Usage

```bash
/new-ktor-endpoint
```

## What You'll Be Asked

- **Resource name** — What's the API resource? (e.g., "movies", "reviews", "profiles")
- **Endpoints** — What routes? (comma-separated with HTTP method, e.g., "GET /trending, GET /{id}, POST /search")
- **Use cases** — Which usecases does it depend on? (comma-separated, e.g., "GetTrendingMovies, GetMovieDetail")

## Generated Structure

```
backend/src/main/kotlin/org/mobyle/routing/
└── <Resource>Routing.kt
```

## Pattern

```kotlin
// backend/src/main/kotlin/org/mobyle/routing/MoviesRouting.kt

package org.mobyle.routing

import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import org.koin.java.KoinJavaComponent.inject
import org.mobyle.domain.usecase.movies.*

fun Route.getMoviesRouting() {
    val getTrendingMovies by inject<GetTrendingMovies>(GetTrendingMovies::class.java)
    val getMovieDetail by inject<GetMovieDetail>(GetMovieDetail::class.java)
    val searchMovies by inject<SearchMovies>(SearchMovies::class.java)
    val discoverMovies by inject<DiscoverMovies>(DiscoverMovies::class.java)
    val getGenres by inject<GetGenres>(GetGenres::class.java)
    val getCountries by inject<GetCountries>(GetCountries::class.java)
    val getLanguages by inject<GetLanguages>(GetLanguages::class.java)

    // GET /api/movies/trending?page=1
    get("/trending") {
        val page = call.parameters["page"]?.toIntOrNull() ?: 1
        call.respond(getTrendingMovies(page))
    }

    // GET /api/movies/{id}
    get("/{id}") {
        val movieId = call.parameters["id"]?.toIntOrNull()
        if (movieId == null) {
            call.respond(HttpStatusCode.BadRequest, "Invalid movie ID")
            return@get
        }
        call.respond(getMovieDetail(movieId))
    }

    // GET /api/movies/search?query=...&page=1
    get("/search") {
        val query = call.parameters["query"]?.trim()
        if (query.isNullOrBlank()) {
            call.respond(HttpStatusCode.BadRequest, "Query parameter is required")
            return@get
        }
        val page = call.parameters["page"]?.toIntOrNull() ?: 1
        call.respond(searchMovies(query, page))
    }

    // GET /api/movies/discover?page=1&year=2024...
    get("/discover") {
        val page = call.parameters["page"]?.toIntOrNull() ?: 1
        val year = call.parameters["year"]?.toIntOrNull()
        val releaseDateGte = call.parameters["releaseDate.gte"]
        val releaseDateLte = call.parameters["releaseDate.lte"]
        val sortBy = call.parameters["sortBy"]
        val genres = call.parameters["withGenres"]
        val language = call.parameters["withOriginalLanguage"]
        val country = call.parameters["withOriginCountry"]
        val voteCountGte = call.parameters["voteCount.gte"]?.toIntOrNull()

        call.respond(
            discoverMovies(
                page = page,
                year = year,
                releaseDateGte = releaseDateGte,
                releaseDateLte = releaseDateLte,
                sortBy = sortBy,
                genres = genres,
                language = language,
                country = country,
                voteCountGte = voteCountGte
            )
        )
    }

    // GET /api/movies/genres
    get("/genres") {
        call.respond(getGenres())
    }

    // GET /api/movies/countries
    get("/countries") {
        call.respond(getCountries())
    }

    // GET /api/movies/languages
    get("/languages") {
        call.respond(getLanguages())
    }
}
```

## Wire into Application

In `/backend/src/main/kotlin/org/mobyle/Application.kt`:

```kotlin
routing {
    route("/api/movies") {
        getMoviesRouting()
    }
    // ... other routes
}
```

## Key Patterns

### Dependency Injection

```kotlin
val getTrendingMovies by inject<GetTrendingMovies>(GetTrendingMovies::class.java)
```

- Use `by inject<T>()` for lazy property delegation
- Required for Koin 3.5.x compatibility
- Each usecase injected as a lazy property

### Parameter Extraction

```kotlin
// Single parameter from path
val movieId = call.parameters["id"]?.toIntOrNull()

// Query parameters
val page = call.parameters["page"]?.toIntOrNull() ?: 1
val query = call.parameters["query"]?.trim()
```

- Use `?.toIntOrNull()` for safe integer parsing
- Provide sensible defaults (e.g., `?: 1` for page)
- Use `?.trim()` for string cleanup

### Validation

```kotlin
if (movieId == null) {
    call.respond(HttpStatusCode.BadRequest, "Invalid movie ID")
    return@get
}
```

- Validate before calling usecases
- Return 400 (BadRequest) with descriptive message
- Use `return@get` to exit early

### Response

```kotlin
call.respond(getTrendingMovies(page))
```

- `call.respond()` automatically serializes to JSON
- No explicit JSON wrapping needed
- Returns appropriate HTTP 200 with serialized data

## Exception Handling

Unhandled exceptions from usecases automatically return HTTP 500. For custom error handling, add try/catch:

```kotlin
get("/movies/{id}") {
    try {
        val movieId = call.parameters["id"]?.toIntOrNull()
            ?: throw IllegalArgumentException("Invalid movie ID")
        call.respond(getMovieDetail(movieId))
    } catch (e: IllegalArgumentException) {
        call.respond(HttpStatusCode.BadRequest, e.message ?: "Invalid request")
    }
}
```

## Requirements

- Extension function on `Route` with name pattern `get<Resource>Routing()`
- All usecases injected via `by inject<T>()`
- `call.parameters["key"]` for both path and query parameters
- Safe parsing with `?.toIntOrNull()` for integers
- Validation before usecase invocation
- `call.respond()` for JSON responses
- Sensible HTTP status codes (400, 404, 500)
- File name matches resource name (PascalCase + "Routing")

## Common HTTP Status Codes

- **200 OK** — Success (automatic)
- **400 BadRequest** — Invalid parameters
- **404 NotFound** — Resource not found
- **500 InternalServerError** — Unhandled exception (automatic)
