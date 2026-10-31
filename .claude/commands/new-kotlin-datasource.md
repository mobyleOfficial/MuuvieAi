---
name: new-kotlin-datasource
description: Scaffold a new Kotlin datasource interface and TMDB implementation
---

# New Kotlin DataSource Scaffold

Create a datasource contract and Ktor HTTP client implementation for the backend.

## Usage

```bash
/new-kotlin-datasource
```

## What You'll Be Asked

- **DataSource name** — What's the semantic name? (e.g., "Tmdb", "UserActivities")
- **Methods** — What operations? (comma-separated, e.g., "getTrending, getDetail, search")

## Generated Structure

```
backend/src/main/kotlin/org/mobyle/data/remote/
├── <name>DataSource.kt        (contract/interface)
└── <name>DataSourceImpl.kt     (Ktor HTTP client implementation)
```

## DataSource Interface Pattern

```kotlin
// backend/src/main/kotlin/org/mobyle/data/remote/TmdbDataSource.kt

package org.mobyle.data.remote

interface TmdbDataSource {
    suspend fun getTrendingMovies(page: Int): TmdbMovieListResponse
    suspend fun getMovieDetail(movieId: Int): TmdbMovieDetailResponse
    suspend fun searchMovies(query: String, page: Int): TmdbMovieListResponse
    suspend fun discoverMovies(
        page: Int,
        year: Int? = null,
        releaseDateGte: String? = null,
        releaseDateLte: String? = null,
        sortBy: String? = null,
        genres: String? = null,
        language: String? = null,
        country: String? = null,
        voteCountGte: Int? = null
    ): TmdbMovieListResponse
}
```

## DataSource Implementation Pattern

```kotlin
// backend/src/main/kotlin/org/mobyle/data/remote/TmdbDataSourceImpl.kt

package org.mobyle.data.remote

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter

class TmdbDataSourceImpl(
    private val httpClient: HttpClient
) : TmdbDataSource {

    override suspend fun getTrendingMovies(page: Int): TmdbMovieListResponse {
        return httpClient.get("trending/movie/week") {
            parameter("page", page)
        }.body()
    }

    override suspend fun getMovieDetail(movieId: Int): TmdbMovieDetailResponse {
        return httpClient.get("movie/$movieId").body()
    }

    override suspend fun searchMovies(
        query: String,
        page: Int
    ): TmdbMovieListResponse {
        return httpClient.get("search/movie") {
            parameter("query", query)
            parameter("page", page)
        }.body()
    }

    override suspend fun discoverMovies(
        page: Int,
        year: Int?,
        releaseDateGte: String?,
        releaseDateLte: String?,
        sortBy: String?,
        genres: String?,
        language: String?,
        country: String?,
        voteCountGte: Int?
    ): TmdbMovieListResponse {
        return httpClient.get("discover/movie") {
            parameter("page", page)
            if (year != null) parameter("primary_release_year", year)
            if (releaseDateGte != null) parameter("release_date.gte", releaseDateGte)
            if (releaseDateLte != null) parameter("release_date.lte", releaseDateLte)
            if (sortBy != null) parameter("sort_by", sortBy)
            if (genres != null) parameter("with_genres", genres)
            if (language != null) parameter("with_original_language", language)
            if (country != null) parameter("with_origin_country", country)
            if (voteCountGte != null) parameter("vote_count.gte", voteCountGte)
        }.body()
    }
}
```

## DTO Pattern (Response Models)

```kotlin
// backend/src/main/kotlin/org/mobyle/data/remote/model/TmdbResponses.kt

package org.mobyle.data.remote.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

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
    @SerialName("overview")
    val overview: String = "",
    @SerialName("poster_path")
    val posterPath: String? = null,
    @SerialName("backdrop_path")
    val backdropPath: String? = null,
    @SerialName("vote_average")
    val voteAverage: Double = 0.0,
    @SerialName("release_date")
    val releaseDate: String? = null
)

@Serializable
data class TmdbMovieDetailResponse(
    @SerialName("id")
    val id: Int = 0,
    @SerialName("title")
    val title: String = "",
    @SerialName("overview")
    val overview: String = "",
    @SerialName("poster_path")
    val posterPath: String? = null,
    @SerialName("backdrop_path")
    val backdropPath: String? = null,
    @SerialName("vote_average")
    val voteAverage: Double = 0.0,
    @SerialName("release_date")
    val releaseDate: String? = null,
    @SerialName("revenue")
    val revenue: Long? = null,
    @SerialName("budget")
    val budget: Long? = null,
    @SerialName("runtime")
    val runtime: Int? = null
)
```

## Requirements

- `suspend fun` throughout (coroutine-based)
- All parameters with nullable default null
- Use `httpClient.get()` with lambda for parameters
- Use `.body()` to deserialize response
- Return response DTOs directly (not wrapped)
- Response DTOs use `@Serializable` and `@SerialName` annotations
- Exceptions bubble up (no try/catch)
- HttpClient injected via constructor
- Interface is pure contract (no implementation)

## DI Registration

Add to `/backend/src/main/kotlin/org/mobyle/data/di/DataModule.kt`:

```kotlin
single<TmdbDataSource> {
    TmdbDataSourceImpl(httpClient = get())
}
```

The HttpClient is already configured with base URL and TMDB API key in the data module.
