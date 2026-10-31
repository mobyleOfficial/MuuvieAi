---
description: Rules for implementing Kotlin code in backend features
globs: backend/src/main/kotlin/**/*.kt
---

# Backend Implementation Rules

Code style and architectural patterns for Kotlin/Ktor backend implementation.

## Naming Conventions

### Classes
```kotlin
// Interfaces describe contracts
interface MoviesRepository { }

// Implementations append Impl or context-specific name
class MoviesRepositoryImpl { }
class TmdbDataSourceImpl { }

// Usecases are verb-noun pattern
class GetTrendingMovies { }
class SearchMovies { }
class CreateUserProfile { }

// DTOs append Response or Request
data class TmdbMovieListResponse { }
data class CreateMovieRequest { }
```

### Functions and Properties
```kotlin
// Functions are camelCase, verbs first
suspend fun getTrendingMovies(page: Int): MovieListing
fun buildHttpClient(): HttpClient
private fun mapToDomain(dto: TmdbMovie): Movie

// Properties are camelCase, nouns
val movieRepository: MoviesRepository
private val httpClient: HttpClient
var currentPage: Int = 1

// Constants are UPPER_SNAKE_CASE
const val DEFAULT_PAGE = 1
private const val TIMEOUT_MS = 5000
```

### Parameters
```kotlin
// Use descriptive names, no single letters except i, j in loops
fun getMovieDetail(movieId: Int, language: String? = null): MovieDetail

// Named parameters improve readability
httpClient.get("trending/movie/week") {
    parameter("page", page)
    parameter("sort_by", sortBy)
}
```

## Coroutines and Suspend Functions

### Always Use Suspend Functions
```kotlin
// Good - suspend function
suspend fun getTrendingMovies(page: Int): MovieListing =
    datasource.getTrendingMovies(page)

// Bad - callback style (never use)
fun getTrendingMovies(page: Int, callback: (MovieListing) -> Unit)

// Bad - future/promise style (never use)
fun getTrendingMovies(page: Int): Future<MovieListing>
```

### Never Block Event Loop
```kotlin
// Bad - blocking in suspend function
suspend fun getTrendingMovies(page: Int): MovieListing {
    Thread.sleep(1000) // NEVER DO THIS
    return datasource.getTrendingMovies(page)
}

// Good - proper async/await
suspend fun getTrendingMovies(page: Int): MovieListing =
    datasource.getTrendingMovies(page)
```

### runBlocking Only for Bridging
```kotlin
// OK - bridging from non-suspend (usecase) to suspend (repository)
class GetTrendingMovies(private val repository: MoviesRepository) {
    operator fun invoke(page: Int): MovieListing = runBlocking {
        repository.getTrendingMovies(page)
    }
}

// Bad - using runBlocking in routing
get("/trending") {
    val movies = runBlocking {
        getTrendingMovies()  // NO - Ktor routing is already async
    }
}
```

## Null Safety

### Use Nullable Types Explicitly
```kotlin
// Good - nullable type
val releaseDate: String? = movie.releaseDate

// Bad - assuming non-null
val releaseDate: String = movie.releaseDate // Crashes if null

// Good - handling nullable
val date = movie.releaseDate ?: "Unknown"
```

### Safe Calls and Elvis Operator
```kotlin
// Good - safe call
val year = movie?.releaseDate?.take(4)?.toIntOrNull()

// Good - Elvis operator with sensible default
val page = call.parameters["page"]?.toIntOrNull() ?: 1
val movieId = call.parameters["id"]?.toIntOrNull()
    ?: throw IllegalArgumentException("ID required")
```

### Validation Before Use
```kotlin
// Good - validate before using
val movieId = call.parameters["id"]?.toIntOrNull()
if (movieId == null) {
    call.respond(HttpStatusCode.BadRequest, "Invalid ID")
    return@get
}
// Now movieId is non-nullable
call.respond(getMovieDetail(movieId))
```

## Data Classes and Serialization

### Use @Serializable for DTOs
```kotlin
@Serializable
data class TmdbMovieListResponse(
    @SerialName("page")
    val page: Int = 0,
    @SerialName("results")
    val results: List<TmdbMovie> = emptyList(),
    @SerialName("total_pages")
    val totalPages: Int = 0,
    @SerialName("total_results")
    val totalResults: Int = 0
)

@Serializable
data class TmdbMovie(
    @SerialName("id")
    val id: Int = 0,
    @SerialName("title")
    val title: String = "",
    @SerialName("poster_path")
    val posterPath: String? = null
)
```

### Default Values for DTOs
Always provide default values to handle partial JSON responses:
```kotlin
// Good - all fields have defaults
data class TmdbMovie(
    val id: Int = 0,
    val title: String = "",
    val overview: String = ""
)

// Bad - required fields will crash on partial JSON
data class TmdbMovie(
    val id: Int,
    val title: String,
    val overview: String
)
```

## Dependency Injection

### Constructor Injection
```kotlin
// Good - injected via constructor
class GetTrendingMovies(
    private val repository: MoviesRepository
) {
    operator fun invoke(page: Int): MovieListing = runBlocking {
        repository.getTrendingMovies(page)
    }
}

// Bad - service locator pattern (never use in Kotlin)
class GetTrendingMovies {
    private val repository = KoinJavaComponent.inject<MoviesRepository>()
}
```

### Lazy Injection in Routing
```kotlin
// Good - lazy delegate injection in routing
fun Route.getMoviesRouting() {
    val getTrendingMovies by inject<GetTrendingMovies>(GetTrendingMovies::class.java)
    val getMovieDetail by inject<GetMovieDetail>(GetMovieDetail::class.java)

    get("/trending") {
        val page = call.parameters["page"]?.toIntOrNull() ?: 1
        call.respond(getTrendingMovies(page))
    }
}
```

## Error Handling

### Exceptions Over Result Wrappers
```kotlin
// Good - exceptions bubble up naturally
suspend fun getTrendingMovies(page: Int): MovieListing =
    datasource.getTrendingMovies(page).toDomain()

// Bad - wrapping in Result (Dart pattern, not for Kotlin)
suspend fun getTrendingMovies(page: Int): Result<MovieListing> = try {
    Success(datasource.getTrendingMovies(page).toDomain())
} catch (e: Exception) {
    Failure(e)
}
```

### HTTP Status Codes in Routing
```kotlin
// Good - validation with appropriate status codes
get("/{id}") {
    val movieId = call.parameters["id"]?.toIntOrNull()
    if (movieId == null) {
        call.respond(HttpStatusCode.BadRequest, "Invalid ID format")
        return@get
    }

    try {
        call.respond(getMovieDetail(movieId))
    } catch (e: NotFoundException) {
        call.respond(HttpStatusCode.NotFound, "Movie not found")
    }
}
```

## Data Mapping

### Use Extension Functions
```kotlin
// Good - extension function in Mappers.kt
fun TmdbMovieListResponse.toDomain(): MovieListing = MovieListing(
    movies = results.map { it.toDomain() },
    totalResults = totalResults,
    totalPages = totalPages,
    page = page
)

fun TmdbMovie.toDomain(): Movie = Movie(
    id = id,
    title = title,
    overview = overview,
    posterPath = posterPath
)

// Usage in repository
override suspend fun getTrendingMovies(page: Int): MovieListing {
    return datasource.getTrendingMovies(page).toDomain()
}
```

## Code Organization

### Imports
```kotlin
package org.mobyle.domain.usecase

import org.mobyle.domain.model.MovieListing      // Internal imports last
import org.mobyle.domain.repository.MoviesRepository

import kotlinx.serialization.SerialName           // Third-party before internal
import kotlinx.serialization.Serializable

import kotlin.math.ceil                           // Standard library first
```

### Class Structure
```kotlin
class GetTrendingMovies(
    private val repository: MoviesRepository
) {
    operator fun invoke(page: Int): MovieListing = runBlocking {
        repository.getTrendingMovies(page)
    }
}

// Single line classes are OK
interface MoviesRepository {
    suspend fun getTrendingMovies(page: Int): MovieListing
}
```

## Coding Style

### Prefer Val Over Var
```kotlin
// Good - immutable by default
val movieId = call.parameters["id"]?.toIntOrNull() ?: 1

// Only use var when necessary
var currentPage = 1
currentPage++
```

### Use When for Exhaustive Conditions
```kotlin
// Good - when is exhaustive for enums/sealed classes
val description = when (genre) {
    MovieGenre.ACTION -> "Fast-paced action films"
    MovieGenre.DRAMA -> "Emotional drama films"
    MovieGenre.COMEDY -> "Humorous comedy films"
}

// Bad - if chains lose compile-time safety
if (genre == MovieGenre.ACTION) {
    // ...
}
```

### Use Collections Properly
```kotlin
// Good - functional style
val actionMovies = movies
    .filter { it.genre == MovieGenre.ACTION }
    .sortedByDescending { it.voteAverage }
    .take(10)

// Bad - imperative loops
val actionMovies = mutableListOf<Movie>()
for (movie in movies) {
    if (movie.genre == MovieGenre.ACTION) {
        actionMovies.add(movie)
    }
}
```

## HTTP Client Usage

### Parameter Setting in Lambda
```kotlin
// Good - using lambda for parameters
httpClient.get("trending/movie/week") {
    parameter("page", page)
    parameter("sort_by", "popularity.desc")
}

// Bad - building query strings manually
httpClient.get("trending/movie/week?page=$page&sort_by=popularity.desc")
```

### Conditional Parameters
```kotlin
// Good - only add if not null
httpClient.get("discover/movie") {
    parameter("page", page)
    if (year != null) parameter("primary_release_year", year)
    if (genres != null) parameter("with_genres", genres)
}
```

### Response Deserialization
```kotlin
// Good - automatic deserialization
override suspend fun getTrendingMovies(page: Int): TmdbMovieListResponse {
    return httpClient.get("trending/movie/week") {
        parameter("page", page)
    }.body()  // Automatic JSON deserialization via @Serializable
}
```
