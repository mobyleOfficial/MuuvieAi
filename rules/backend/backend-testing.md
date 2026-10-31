# Backend Testing Rule

Applies to: `backend/src/test/kotlin/`. Aligns with [`backend-architecture.md`](backend-architecture.md).

## Test Structure

`backend/src/test/kotlin/org/mobyle/` mirrors `main/`. One test class per production class; file naming `*Test.kt`.

Existing tests (the auth feature is the reference shape to follow):
- `routing/AuthRoutingTest.kt` tests `routing/AuthRouting.kt`
- `domain/usecase/auth/LoginUserTest.kt` tests `domain/usecase/auth/LoginUser.kt`
- `domain/usecase/auth/LogoutUserTest.kt` tests `domain/usecase/auth/LogoutUser.kt`
- `data/repository/AuthRepositoryImplTest.kt` tests `data/repository/AuthRepositoryImpl.kt`
- `data/util/JWTUtilTest.kt` tests `data/util/JWTUtil.kt`
- `data/local/auth/TokenBlocklistDataSourceTest.kt` tests `data/local/auth/TokenBlocklistDataSource.kt`

The movies, profile, and activities packages have no tests yet — adding them means creating `routing/MoviesRoutingTest.kt`, `domain/usecase/movies/GetTrendingMoviesTest.kt`, `data/remote/TmdbDataSourceImplTest.kt`, `data/remote/MappersTest.kt`, and so on, mirroring the same paths.

## Unit Tests

- Use case tests and mapper tests use plain JUnit 5 (no Ktor harness needed); `build.gradle.kts` enables `useJUnitPlatform()` at line 69
- Test deps are already declared in `backend/build.gradle.kts` (lines 49-54) — no need to add them: `ktor-server-tests:2.3.0`, `kotlin("test")`, `mockk:1.13.12`, `kotlinx-coroutines-test:1.8.1`, `h2:2.2.224`
- **Known build issue:** `junit:junit:4.13.2` is also declared while the runner is `useJUnitPlatform()` (JUnit 5). JUnit 4-style tests are silently *not collected* unless `junit-vintage-engine` is added. Write tests against JUnit 5 (`org.junit.jupiter.api.Test`) or `kotlin.test`, never `org.junit.Test`
- Use cases call `runBlocking` internally, so tests can call them synchronously without coroutine wrappers
- Mock injected repository/datasource dependencies via MockK (`val repository = mockk<MoviesRepository>()`)
- Each public function gets at least 1 test covering the happy path and at least 1 covering the failure path (e.g. empty result, datasource exception)

Example use-case test shape:
```kotlin
class GetTrendingMoviesTest {
    private val repository = mockk<MoviesRepository>()
    private val useCase = GetTrendingMovies(repository)

    @Test
    fun `returns movie listing from repository`() {
        val expected = MovieListing(totalPages = 1, totalResults = 1, movies = listOf(/* fixture */))
        coEvery { repository.getTrendingMovies(1) } returns expected
        assertEquals(expected, useCase(1))
    }

    @Test
    fun `propagates repository exception`() {
        coEvery { repository.getTrendingMovies(any()) } throws RuntimeException("fail")
        assertThrows<RuntimeException> { useCase(1) }
    }
}
```

Note: use `coEvery { ... }` (not `every { runBlocking { ... } }`) for suspend-function stubs — MockK throws `MockKException: Missing calls inside every { } block` with the `runBlocking` form. Because production use-case `invoke` functions call `runBlocking` internally, the test body itself does not need a coroutine wrapper.

## Route Tests

Use Ktor's `testApplication { ... }` harness (provided by `ktor-server-tests:2.3.0`). Because `configureKoin()` installs `dataModule` which throws `IllegalStateException` if `TMDB_API_KEY` is unset (lazily on first request), Koin must be replaced with a test module BEFORE `testApplication` starts — not inside `application { }`:

```kotlin
@Test
fun `GET trending movies returns 200`() {
    stopKoin()  // tear down any previously started Koin instance
    startKoin {
        modules(testDataModule)  // test module overriding dataModule; provides mocked TmdbDataSource
    }
    testApplication {
        // Do NOT call configureKoin() here — Koin is already running with test doubles
        application { configureRouting(); configureStatusPages() }
        val response = client.get("/movies/trending?page=1")
        assertEquals(HttpStatusCode.OK, response.status)
    }
}
```

Where `testDataModule` is a Koin module that binds `TmdbDataSource`, all `*Repository` implementations, and all use cases with MockK doubles (or in-memory stubs) so no real TMDB call is made. Keep route tests focused on HTTP contract (status codes, response shape) — not domain logic.

## TMDB Mocking

- Never call the real TMDB API in tests; all tests must pass with `TMDB_API_KEY` unset
- Mock `TmdbDataSource` via MockK; return DTO fixture instances constructed inline or loaded from `src/test/resources/tmdb/<endpoint>.json`
- For HTTP-level tests of `TmdbDataSourceImpl`, use Ktor's `MockEngine` with canned response bodies rather than a real `HttpClient(CIO)`:

```kotlin
val mockEngine = MockEngine { request ->
    respond(
        content = ByteReadChannel(File("src/test/resources/tmdb/trending.json").readText()),
        status = HttpStatusCode.OK,
        headers = headersOf(HttpHeaders.ContentType, "application/json")
    )
}
val client = HttpClient(mockEngine) { install(ContentNegotiation) { json() } }
val ds = TmdbDataSourceImpl(client)
```

- Rate-limit test: configure `MockEngine` to return HTTP 429; assert that the client or repository layer throws the appropriate exception (once `TmdbRateLimitedException` is introduced per `backend-architecture.md`)

## Coverage Expectations

- All route handlers: 1 happy-path + 1 error-path test (at minimum: missing/invalid param → 400, valid param → 200/201)
- All use case `invoke` functions: at least 1 unit test each (happy path + exception propagation)
- All `TmdbDataSourceImpl` methods: 1 success test + 1 rate-limit/error test
- All mapper extension functions in `Mappers.kt`: at least 1 round-trip test per domain type
- `./gradlew test` must pass (zero failures) before any PR opens

No numeric coverage percentage gate — gate is on the per-class expectations above.

## Test Style

### Names describe behavior, not implementation

```kotlin
// Good — states the condition and the expected outcome
fun `should return empty list when no movies available`() { }
fun `should throw exception when network fails`() { }
fun `should include sort parameter only when provided`() { }

// Bad — vague or method-name echoes
fun `test getTrendingMovies`() { }
fun `test response parsing`() { }
```

### Arrange-Act-Assert

```kotlin
@Test
fun `should return movies sorted by popularity`() {
    // Arrange
    val movies = listOf(
        Movie(id = 1, title = "Popular", voteAverage = 9.0),
        Movie(id = 2, title = "Less Popular", voteAverage = 5.0)
    )
    coEvery { repository.getTrendingMovies(1) } returns
        MovieListing(movies = movies, totalResults = 2, totalPages = 1)

    // Act
    val result = useCase(1)

    // Assert
    assertEquals("Popular", result.movies[0].title)
}
```

### Cover edge cases explicitly

Empty collections, null optional fields, and boundary values each get their own test — they are the cases TMDB responses actually vary on:

```kotlin
@Test
fun `should handle empty results`() {
    coEvery { datasource.getTrendingMovies(any()) } returns
        TmdbMovieListResponse(results = emptyList())

    val result = repository.getTrendingMovies(1)

    assertTrue(result.movies.isEmpty())
    assertEquals(0, result.totalResults)
}

@Test
fun `should handle null optional fields`() {
    val movie = TmdbMovie(id = 1, title = "Test", posterPath = null, releaseDate = null)

    val domainMovie = movie.toDomain()

    assertNull(domainMovie.posterPath)
}
```
