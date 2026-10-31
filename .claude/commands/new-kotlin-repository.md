---
name: new-kotlin-repository
description: Scaffold a new Kotlin repository interface and implementation
---

# New Kotlin Repository Scaffold

Create a repository contract in the domain layer and its implementation in the data layer.

## Usage

```bash
/new-kotlin-repository
```

## What You'll Be Asked

- **Repository name** — What's the semantic name? (e.g., "Movies", "UserActivities")
- **Methods** — What operations? (comma-separated, e.g., "getTrending, getDetail, search")
- **DataSource** — Which datasource does it use? (e.g., "TmdbDataSource")

## Generated Structure

```
backend/src/main/kotlin/org/mobyle/
├── domain/repository/
│   └── <name>Repository.kt             (contract - pure domain)
└── data/repository/
    └── <name>RepositoryImpl.kt          (implementation - uses datasource)
```

## Domain Repository Interface Pattern

```kotlin
// backend/src/main/kotlin/org/mobyle/domain/repository/MoviesRepository.kt

package org.mobyle.domain.repository

import org.mobyle.domain.model.*
import org.mobyle.model.MovieListing

interface MoviesRepository {
    suspend fun getTrendingMovies(page: Int): MovieListing
    suspend fun getMovieDetail(movieId: Int): MovieDetail
    suspend fun searchMovies(query: String, page: Int): MovieListing
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
    ): MovieListing
    suspend fun getGenres(): List<Genre>
    suspend fun getCountries(): List<Country>
    suspend fun getLanguages(): List<Language>
}
```

## Data Repository Implementation Pattern

```kotlin
// backend/src/main/kotlin/org/mobyle/data/repository/MoviesRepositoryImpl.kt

package org.mobyle.data.repository

import org.mobyle.domain.model.*
import org.mobyle.domain.repository.MoviesRepository
import org.mobyle.data.remote.TmdbDataSource
import org.mobyle.data.remote.Mappers.toDomain
import org.mobyle.model.MovieListing

class MoviesRepositoryImpl(
    private val tmdbDataSource: TmdbDataSource
) : MoviesRepository {

    override suspend fun getTrendingMovies(page: Int): MovieListing {
        return tmdbDataSource.getTrendingMovies(page).toDomain()
    }

    override suspend fun getMovieDetail(movieId: Int): MovieDetail {
        return tmdbDataSource.getMovieDetail(movieId).toDomain()
    }

    override suspend fun searchMovies(
        query: String,
        page: Int
    ): MovieListing {
        return tmdbDataSource.searchMovies(query, page).toDomain()
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
    ): MovieListing {
        return tmdbDataSource.discoverMovies(
            page = page,
            year = year,
            releaseDateGte = releaseDateGte,
            releaseDateLte = releaseDateLte,
            sortBy = sortBy,
            genres = genres,
            language = language,
            country = country,
            voteCountGte = voteCountGte
        ).toDomain()
    }

    override suspend fun getGenres(): List<Genre> {
        return tmdbDataSource.getGenres().map { it.toDomain() }
    }

    override suspend fun getCountries(): List<Country> {
        return tmdbDataSource.getCountries().map { it.toDomain() }
    }

    override suspend fun getLanguages(): List<Language> {
        return tmdbDataSource.getLanguages().map { it.toDomain() }
    }
}
```

## Mapper Extension Pattern

```kotlin
// backend/src/main/kotlin/org/mobyle/data/remote/Mappers.kt

package org.mobyle.data.remote

import org.mobyle.data.remote.model.*
import org.mobyle.domain.model.*
import org.mobyle.model.Movie
import org.mobyle.model.MovieListing

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
    posterPath = posterPath,
    backdropPath = backdropPath,
    voteAverage = voteAverage,
    releaseDate = releaseDate
)

fun TmdbMovieDetailResponse.toDomain(): MovieDetail = MovieDetail(
    id = id,
    title = title,
    overview = overview,
    posterPath = posterPath,
    backdropPath = backdropPath,
    voteAverage = voteAverage,
    releaseDate = releaseDate,
    revenue = revenue ?: 0L,
    budget = budget ?: 0L,
    runtime = runtime ?: 0
)

fun TmdbGenre.toDomain(): Genre = Genre(
    id = id,
    name = name
)

fun TmdbCountry.toDomain(): Country = Country(
    code = code,
    name = name
)

fun TmdbLanguage.toDomain(): Language = Language(
    code = code,
    name = name
)
```

## Requirements

- **Domain interface** — Pure Kotlin, no data layer dependencies, suspend functions
- **Implementation** — Wraps datasource and maps DTO → domain models
- All parameters with nullable default null
- Use mapper extension functions (`toDomain()`)
- Suspend functions throughout
- Direct delegation to datasource with mapping
- No try/catch — exceptions bubble up
- Inject datasource via constructor

## DI Registration

Add to `/backend/src/main/kotlin/org/mobyle/data/di/DataModule.kt`:

```kotlin
single<MoviesRepository> {
    MoviesRepositoryImpl(tmdbDataSource = get())
}
```
