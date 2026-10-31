---
name: new-kotlin-usecase
description: Scaffold a new usecase in the backend domain layer (Kotlin)
---

# New Kotlin UseCase Scaffold

Create a reusable business logic usecase for the Ktor backend following the MuuvieAi pattern.

## Usage

```bash
/new-kotlin-usecase
```

## What You'll Be Asked

- **UseCase name** — What does it do? (e.g., "GetTrendingMovies", "SearchMovies")
- **Input type** — What parameter does it take? (e.g., "Int" for page, "String" for query, "no params" for void)
- **Output type** — What does it return? (e.g., "MovieListing", "MovieDetail", "List<Genre>")
- **Repository** — Which repository does it use? (e.g., "MoviesRepository")

## Generated Structure

```
backend/src/main/kotlin/org/mobyle/domain/usecase/
└── <use_case_name>.kt
```

## Pattern - Simple (No Parameters)

```kotlin
package org.mobyle.domain.usecase

import org.mobyle.domain.repository.MoviesRepository
import org.mobyle.model.MovieListing
import kotlinx.coroutines.runBlocking

class GetTrendingMovies(private val repository: MoviesRepository) {
    operator fun invoke(page: Int): MovieListing = runBlocking {
        repository.getTrendingMovies(page)
    }
}
```

## Pattern - With Multiple Parameters

```kotlin
package org.mobyle.domain.usecase

import org.mobyle.domain.repository.MoviesRepository
import org.mobyle.model.MovieListing
import kotlinx.coroutines.runBlocking

class DiscoverMovies(private val repository: MoviesRepository) {
    operator fun invoke(
        page: Int,
        year: Int? = null,
        releaseDateGte: String? = null,
        releaseDateLte: String? = null,
        sortBy: String? = null,
        genres: String? = null,
        language: String? = null,
        country: String? = null,
        voteCountGte: Int? = null
    ): MovieListing = runBlocking {
        repository.discoverMovies(
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
    }
}
```

## Requirements

- One usecase per file
- Implement `operator fun invoke()` (not `call()`)
- Use `runBlocking { }` to bridge suspend repository functions
- All parameters as function parameters with defaults
- Repository injected via constructor
- Direct delegation to repository methods
- File name matches class name (PascalCase)
- Package: `org.mobyle.domain.usecase`

## DI Registration

UseCase will be auto-discovered and registered in the Koin module. Add to `/backend/src/main/kotlin/org/mobyle/di/AppModule.kt`:

```kotlin
factory { <UseCaseName>(repository = get()) }
```
