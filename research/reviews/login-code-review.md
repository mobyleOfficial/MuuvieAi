# Code Review: Email/Password Authentication

**Feature:** login
**Reviewer:** code-reviewer agent
**Date:** 2026-07-22
**Overall Verdict:** APPROVED_WITH_CONDITIONS

---

## Summary

The implementation is well-structured, follows existing codebase patterns, and addresses the most critical security concerns (BCrypt cost 12, timing-safe dummy hash, `@Transient` on `passwordHash`, no password logging). There are a handful of issues that should be resolved before merge: the use cases deviate from the established `runBlocking` bridge pattern, the `UserProfile.recentlyWatchedMovies` field is never populated in the login response, and the `UsersTable.username` column lacks a unique index despite the username-conflict-resolution logic depending on uniqueness. None of these are blocking-severity alone, but together they warrant a conditions-based approval.

## Review by Criterion

### 1. Architecture Compliance
**Verdict:** WARN

**Positives:**
- Clean architecture layers are respected. Domain models (`LoginRequest`, `LoginResponse`, `User`, `AuthToken`) are pure Kotlin with `kotlinx.serialization` annotations (consistent with existing codebase convention for domain DTOs).
- Repository pattern correct: `AuthRepository` interface in `domain/repository/`, `AuthRepositoryImpl` in `data/repository/`.
- Datasource pattern correct: `UserDatabaseDataSource` has interface + impl separation in `data/local/user/`. `TokenBlocklistDataSource` is a concrete class (no interface), which is acceptable for an in-memory utility.
- DI wiring is correct: datasources and repositories registered in `DataModule` (`DataModule.kt:126-131`), use cases in `AppModule` (`AppModule.kt:64-65`).

**Issues:**
- **Use case pattern deviation** (`LoginUser.kt:7`, `LogoutUser.kt:6`): Both use cases use `suspend operator fun invoke()` instead of the established pattern of `operator fun invoke() = runBlocking { ... }`. Every other use case in the codebase (`ProcessOAuthCallback`, `ValidateToken`, `GetTrendingMovies` in the architecture rule) uses the non-suspend `runBlocking` bridge. The architect review explicitly flagged this: "the usecase `invoke()` must bridge to the Ktor coroutine scope correctly. Implementer should verify consistency with `ProcessOAuthCallback` and `ValidateToken`." However, looking at the existing codebase, `ProcessOAuthCallback.kt` and `ValidateToken.kt` also use `suspend operator fun invoke()` -- so the deviation is pre-existing and consistent within the auth module. The architecture *rule* says `runBlocking`, but the actual codebase uses `suspend`. This is a WARN, not a FAIL, because the implementation is consistent with its peer use cases. The rules and codebase should be reconciled in a separate task.

### 2. Security
**Verdict:** PASS

**Positives:**
- `@Transient` annotation on `User.passwordHash` (`User.kt:13`) -- hash will never serialize to JSON.
- BCrypt cost factor 12 used for hashing (`AuthRepositoryImpl.kt:165`).
- Timing-safe dummy hash for user-not-found path (`AuthRepositoryImpl.kt:162`) and OAuth-only user path (`AuthRepositoryImpl.kt:136`) -- both call `BCrypt.verifyer().verify()` against `DUMMY_HASH` before returning failure. Correctly prevents user enumeration via timing.
- `DUMMY_HASH` is a module-level constant pre-computed at class load time (`AuthRepositoryImpl.kt:22`), exactly as architect review recommended.
- Password length validation enforced (8-72) at `AuthRepositoryImpl.kt:121`.
- Email normalized to lowercase and trimmed (`AuthRepositoryImpl.kt:117`).
- Password trimmed (`AuthRepositoryImpl.kt:118`).
- `passwordHash` stripped from user in response via `.copy(passwordHash = null)` at `AuthRepositoryImpl.kt:152` and `AuthRepositoryImpl.kt:192`.
- Error responses use generic codes (`invalid_credentials`) that do not distinguish "wrong password" from "user not found" (`AuthRouting.kt:124-126`).
- No password is logged -- only `e.message` from exceptions (`AuthRepositoryImpl.kt:199`).
- Token blocklist checked in `validateToken` before signature validation (`AuthRepositoryImpl.kt:95-97`).
- `AuthToken.isNewUser` is `@Transient` (`AuthToken.kt:13`), so it never leaks into JSON responses -- the routing layer manually maps to `LoginAuthTokenResponse` anyway.

**No issues found.**

### 3. Spec Compliance
**Verdict:** WARN

**Positives:**
- `POST /auth/login` returns `201 Created` for new user, `200 OK` for existing (`AuthRouting.kt:112`).
- `POST /auth/logout` returns `204 No Content` (`AuthRouting.kt:167`).
- Error codes match spec: `invalid_request` (`AuthRouting.kt:128`), `invalid_password_length` (`AuthRouting.kt:118`), `invalid_credentials` (`AuthRouting.kt:123`), `internal_error` (`AuthRouting.kt:133`).
- `LoginAuthTokenResponse` includes `profile: UserProfile` (`LoginResponse.kt:10`).
- Username auto-generated from email with conflict resolution (`AuthRepositoryImpl.kt:225-240`).

**Issues:**
- **`recentlyWatchedMovies` is always empty** (`AuthRouting.kt:100-103`): The routing builds a `UserProfile` from the `User` object but never queries the `UserMoviesTable` for recently watched movies. For an existing user with watch history, `recentlyWatchedMovies` will always be `[]`. The spec (AC-4) explicitly requires: "For existing user, `recentlyWatchedMovies` includes last 10 items ordered by `watchedAt` desc." This is a spec gap in the implementation. The `UserProfile` is constructed inline in routing rather than populated by a datasource/repository query. For a new user this is correct (empty list), but for existing users it violates AC-4.
- **`LoginAuthTokenResponse` vs spec field names**: The response class is named `LoginAuthTokenResponse` (`LoginResponse.kt:6`) while the spec calls it `AuthTokenResponse`. This is cosmetic and does not affect the JSON output, which matches the spec contract.

### 4. Architect Conditions
**Verdict:** PASS

**Condition 1 -- OAuth env vars are optional:**
PASS. `DataModule.kt:138-169` registers `OAuthDataSource?` as nullable. When `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, or `OAUTH_PROVIDER_URL` are absent, it returns `null` instead of throwing. `AuthRepositoryImpl` accepts `oauthDataSource: OAuthDataSource?` (`AuthRepositoryImpl.kt:25`) and gracefully handles the null case in `processOAuthCallback` (`AuthRepositoryImpl.kt:36-39`). The server can start without OAuth credentials.

**Condition 2 -- `passwordHash` never in API responses:**
PASS. `@Transient` annotation on `User.passwordHash` (`User.kt:13`) prevents serialization. Additionally, the repository copies the user with `passwordHash = null` before including it in `AuthToken` (`AuthRepositoryImpl.kt:152, 192`). Double protection.

**Condition 3 -- All 4 test files present:**
PASS. All four required test files are present:
- `LoginUserTest.kt` -- 5 tests covering new user (201), existing user (200), wrong password (401), password too short (400), delegation
- `LogoutUserTest.kt` -- 3 tests covering valid revocation, invalid token, already-revoked token
- `AuthRepositoryImplTest.kt` -- 10 tests covering new user, correct password, wrong password, short/long password, email normalization, logout revocation, invalid token logout, validate-after-revoke, username conflict
- `TokenBlocklistDataSourceTest.kt` -- 5 tests covering revoke, isRevoked false, cleanup, empty cleanup, overwrite expiry

### 5. Code Quality
**Verdict:** PASS

**Positives:**
- No dead code or unused imports detected across all files.
- Naming is consistent with existing codebase: `UserDatabaseDataSource`/`UserDatabaseDataSourceImpl` follows the `Interface`/`InterfaceImpl` pattern.
- Error handling via `Result<T>` is consistent with existing auth code.
- No magic numbers: BCrypt cost factor 12 could be a constant, but it appears only in two places (`AuthRepositoryImpl.kt:22` for the dummy hash and `AuthRepositoryImpl.kt:165` for actual hashing). Minor.
- Username generation logic is clean and uses a DB query rather than a retry loop, as architect recommended (`AuthRepositoryImpl.kt:229`).
- Kotlin null safety used correctly throughout.

**Minor notes:**
- BCrypt cost `12` appears as a literal in two places. Extracting to a companion constant would be cleaner but is not blocking.
- `java.time.Instant.now().toString()` at `AuthRepositoryImpl.kt:168` while the rest of the codebase uses `kotlinx.datetime.Clock.System.now()` (`UserDatabaseDataSourceImpl.kt:44`). Inconsistent but functional.

### 6. Testing Quality
**Verdict:** WARN

**Positives:**
- Tests cover happy path + error cases with meaningful assertions.
- Mocks are properly configured using `mockk` with `coEvery`/`every`.
- Tests don't depend on external state (in-memory blocklist used directly, JWTUtil with test secret).
- `AuthRepositoryImplTest` is thorough: covers new user creation, correct password, wrong password, short/long password, email normalization, logout, token revocation round-trip, and username conflicts.
- `TokenBlocklistDataSourceTest` covers all public methods including edge cases (empty cleanup, overwrite).

**Issues:**
- **Missing test: timing-safe dummy hash when user not found** (`LoginUserTest.kt`): The architect review explicitly required this test case ("timing-safe dummy hash when user not found"). While `AuthRepositoryImplTest` implicitly tests this path (the new-user test calls `findByEmail` returning `null`, which triggers the dummy hash path), there is no explicit assertion that `BCrypt.verifyer().verify()` is called with the dummy hash. Since the dummy hash call is a side-effect for timing attack mitigation, verifying it requires either a spy on BCrypt or a timing-based assertion. The current test proves the path works (new user is created successfully), but does not explicitly verify the anti-enumeration measure. This is acceptable for MVP but should be noted.
- **`LoginUserTest` tests are thin**: The use case is a pure delegate (`return authRepository.loginUser(email, password)`), so the tests are necessarily thin -- they only verify delegation. The real business logic tests are in `AuthRepositoryImplTest`, which is comprehensive. This is architecturally correct but means `LoginUserTest` does not add much safety net beyond verifying the delegation contract.

### 7. Integration
**Verdict:** PASS

**Positives:**
- Existing OAuth flow is not broken: `processOAuthCallback` is unchanged in behavior. The `oauthDataSource` is now nullable but the null-check is in place (`AuthRepositoryImpl.kt:36-39`).
- Routing is properly wired: `getAuthRouting()` is called in `Main.kt:125`, and the new `POST /login` and `POST /logout` routes are defined inside `getAuthRouting()` (`AuthRouting.kt:82, 152`).
- `UserDatabaseDataSource` does not conflict with `UserLocalDataSource`: they serve different purposes (DB access vs in-memory cache) and have different interfaces. Both are registered in DI and injected into `AuthRepositoryImpl` separately.
- `ValidateToken` now checks the blocklist because `AuthRepositoryImpl.validateToken` checks `tokenBlocklistDataSource.isRevoked()` before calling `jwtUtil.validateToken()` (`AuthRepositoryImpl.kt:94-98`). This is the integration point required by the spec.

**Notes:**
- There is a duplicate `ErrorResponse` class: one in `AuthRouting.kt:249-253` and one in `JWTAuth.kt:18-21`. Both are `@Serializable` data classes with the same fields. This is a pre-existing duplication, not introduced by this PR, but should be cleaned up eventually.

## Issues Found

### Critical (must fix)

None.

### Warnings (should fix)

1. **`recentlyWatchedMovies` never populated for existing users** (`AuthRouting.kt:100-103`): The `UserProfile` is constructed manually with only `photoUrl` and `username`. For existing users, `recentlyWatchedMovies` should be fetched from `UserMoviesTable` (last 10, `status = 'watched'`, ordered by `watchedAt DESC`). This violates spec AC-4. Requires a new datasource method or repository method to fetch recently watched movies, and wiring it into the login response.

2. **`UsersTable.username` has no unique index** (`Tables.kt:8`): The username conflict resolution logic in `AuthRepositoryImpl.generateUsername()` (`AuthRepositoryImpl.kt:225-240`) assumes username uniqueness, but the `UsersTable` has no `uniqueIndex()` on the `username` column. The architect review explicitly recommended: "confirm username uniqueness constraint in `UsersTable` (currently absent -- add `uniqueIndex()` on `username` column)". A race condition between two concurrent registrations with the same email prefix could produce duplicate usernames.

3. **Inconsistent timestamp API** (`AuthRepositoryImpl.kt:168`): Uses `java.time.Instant.now().toString()` while `UserDatabaseDataSourceImpl.kt:44` uses `kotlinx.datetime.Clock.System.now()`. Should use the same API for consistency.

4. **BCrypt cost factor as magic number** (`AuthRepositoryImpl.kt:22, 165`): The cost factor `12` appears as a literal in two places. Extract to a constant (`BCRYPT_COST = 12`) for maintainability.

### Suggestions (nice to have)

1. **Reconcile use case pattern**: The architecture rule mandates `operator fun invoke() = runBlocking { ... }` but all auth use cases use `suspend operator fun invoke()`. Either update the rule or update the use cases project-wide. Not introduced by this PR.

2. **Deduplicate `ErrorResponse`**: `AuthRouting.kt:249` and `JWTAuth.kt:18` define the same class. Extract to a shared location (e.g., `routing/model/ErrorResponse.kt`). Pre-existing issue.

3. **Blocklist cleanup scheduling**: The `TokenBlocklistDataSource.cleanup()` method exists but is never called anywhere. Consider scheduling it via a coroutine in `Main.kt` (similar to `scheduleArticleScraping`) or calling it lazily during `isRevoked()` with a time-based threshold, as the architect review suggested.

4. **`UserDatabaseDataSource.findByUsername` query could be more precise**: The `LIKE '$prefix%'` query (`UserDatabaseDataSourceImpl.kt:52`) may match more than intended if the prefix contains SQL wildcard characters (`%`, `_`). Consider escaping the prefix or using an exact-match + suffix pattern query.

## Files Reviewed

| File | Lines | Status |
|---|---|---|
| `backend/src/main/kotlin/org/mobyle/domain/model/LoginRequest.kt` | 9 | New |
| `backend/src/main/kotlin/org/mobyle/domain/model/LoginResponse.kt` | 11 | New |
| `backend/src/main/kotlin/org/mobyle/data/local/user/UserDatabaseDataSource.kt` | 57 | New |
| `backend/src/main/kotlin/org/mobyle/data/local/auth/TokenBlocklistDataSource.kt` | 20 | New |
| `backend/src/main/kotlin/org/mobyle/domain/usecase/auth/LoginUser.kt` | 9 | New |
| `backend/src/main/kotlin/org/mobyle/domain/usecase/auth/LogoutUser.kt` | 9 | New |
| `backend/build.gradle.kts` | 73 | Modified |
| `backend/src/main/kotlin/org/mobyle/domain/model/User.kt` | 14 | Modified |
| `backend/src/main/kotlin/org/mobyle/domain/model/UserProfile.kt` | 22 | Modified |
| `backend/src/main/kotlin/org/mobyle/domain/model/AuthToken.kt` | 30 | Modified |
| `backend/src/main/kotlin/org/mobyle/data/local/database/Tables.kt` | 88 | Modified |
| `backend/src/main/kotlin/org/mobyle/domain/repository/AuthRepository.kt` | 21 | Modified |
| `backend/src/main/kotlin/org/mobyle/data/repository/AuthRepositoryImpl.kt` | 241 | Modified |
| `backend/src/main/kotlin/org/mobyle/data/di/DataModule.kt` | 202 | Modified |
| `backend/src/main/kotlin/org/mobyle/di/AppModule.kt` | 66 | Modified |
| `backend/src/main/kotlin/org/mobyle/routing/AuthRouting.kt` | 253 | Modified |
| `backend/src/main/kotlin/org/mobyle/Main.kt` | 134 | Modified |
| `backend/src/test/kotlin/org/mobyle/domain/usecase/auth/LoginUserTest.kt` | 101 | New |
| `backend/src/test/kotlin/org/mobyle/domain/usecase/auth/LogoutUserTest.kt` | 46 | New |
| `backend/src/test/kotlin/org/mobyle/data/repository/AuthRepositoryImplTest.kt` | 191 | New |
| `backend/src/test/kotlin/org/mobyle/data/local/auth/TokenBlocklistDataSourceTest.kt` | 64 | New |
| `backend/src/main/kotlin/org/mobyle/domain/usecase/auth/ProcessOAuthCallback.kt` | 11 | Reference |
| `backend/src/main/kotlin/org/mobyle/domain/usecase/auth/ValidateToken.kt` | 9 | Reference |
| `backend/src/main/kotlin/org/mobyle/data/util/JWTUtil.kt` | 128 | Reference |
| `backend/src/main/kotlin/org/mobyle/auth/JWTAuth.kt` | 65 | Reference |
| `backend/src/main/kotlin/org/mobyle/data/local/user/UserLocalDataSource.kt` | 40 | Reference |
| `backend/src/main/kotlin/org/mobyle/di/Utils.kt` | 17 | Reference |
