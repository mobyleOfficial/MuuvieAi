# Architect Review: Email/Password Authentication (Login & Register)

**Spec:** `research/specs/login.md`
**Reviewer:** architect-review agent
**Date:** 2026-07-22
**Decision:** APPROVED_WITH_CONDITIONS

---

## Decision Summary

The spec is technically sound and well-aligned with the existing backend patterns. Architecture fits the ecosystem correctly. Three conditions must be met before or during implementation, none of which block the feature from starting.

---

## Review by Criterion

### 1. Architecture Alignment

**Result: PASS**

The proposed layer breakdown follows clean architecture correctly:

- `domain/model/` receives `LoginRequest`, `LoginResponse`, additions to `User` and `UserProfile` — all pure Kotlin, no external deps.
- `domain/usecase/auth/` receives `LoginUser` and `LogoutUser` — orchestrate repository calls only.
- `domain/repository/AuthRepository` is extended with `loginUser` and `logoutUser` — interface-only changes in the right place.
- `data/local/user/UserDatabaseDataSource` and `data/local/auth/TokenBlocklistDataSource` are new data-layer files — correct placement.
- `data/repository/AuthRepositoryImpl` implements the new methods — correct.
- `routing/AuthRouting.kt` gets new routes with lazy Koin injection — consistent with existing `getAuthRouting()` pattern.
- DI wiring split: datasources/repositories in `DataModule`, usecases in `AppModule` — consistent with existing structure.

One naming note: the spec places `LoginRequest` / `LoginResponse` under `domain/model/`. Since these are HTTP-facing DTOs, they arguably belong under `data/model/` (the DTO layer). However, the existing codebase already places `OAuthCallbackRequest` in `domain/model/`, so the spec follows established convention. Acceptable for MVP.

### 2. Ecosystem Fit

**Result: PASS WITH NOTE**

The spec reuses all existing building blocks correctly:

- `JWTUtil.generateToken(user)` is used as-is — no changes needed to JWT infra.
- `UserRepository.getUserByEmail()` already exists on the interface — lookup is free.
- `UserRepository.createOrUpdateUser()` is reused for new user creation.
- `UserLocalDataSource` remains as L1 cache — layering is preserved.
- BCrypt dependency (`at.favre.lib:bcrypt:0.10.2`) is a standard, well-maintained library. No ecosystem conflict.

**Note on `runBlocking` in usecases:** The architecture rule in `backend-architecture.md` shows usecases using `operator fun invoke()` with `runBlocking` to bridge coroutines. The spec's `LoginUser` / `LogoutUser` should follow this exact pattern — `suspend` is fine inside repositories and datasources, but the usecase `invoke()` must bridge to the Ktor coroutine scope correctly. Implementer should verify consistency with `ProcessOAuthCallback` and `ValidateToken`.

### 3. Submodule Boundaries

**Result: PASS**

The spec is correctly scoped to `backend/` only. The frontend integration is explicitly deferred to a separate ticket (`block-auth-screen`). The API contract is clean and drop-in compatible — the Flutter `AuthRepository` already calls the backend; adding `POST /auth/login` is non-breaking.

No changes required in `muuvie/`.

### 4. Feasibility

**Result: PASS**

All building blocks exist. The work reduces to:

1. Schema migration (one `ALTER TABLE` statement).
2. Two new datasource classes (DB access + blocklist).
3. Two new usecases.
4. Repository interface extension + impl.
5. Two new routes wired into `AuthRouting.kt`.

Nothing in this spec requires introducing a new framework, new pattern, or architectural change. Complexity is low-to-medium. Realistic MVP scope.

### 5. Dependencies

**Result: PASS WITH CONDITION (see Condition 1)**

Direct prerequisites:
- `UsersTable` exists and has the right shape — only `password_hash` column is missing.
- `UserLocalDataSourceImpl` exists — no changes needed at the interface level.
- `JWTUtil` is fully functional.
- `UserRepository` interface already exposes `getUserByEmail` and `createOrUpdateUser`.

**Condition 1 — OAuth env vars block server start (Q3 in spec):**
`DataModule.kt` eagerly throws `IllegalStateException` when `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, or `OAUTH_PROVIDER_URL` are absent. Adding an email/password flow should not require OAuth credentials. These three vars must be made optional (nullable fallback instead of throwing) before or during this implementation, otherwise the server cannot start in a clean email-only environment (e.g., CI, local dev without OAuth). This is a low-effort change.

### 6. Security

**Result: PASS WITH CONDITION (see Condition 2)**

Positives:
- BCrypt cost factor 12 is appropriate.
- Constant-time BCrypt verification prevents timing attacks.
- Spec correctly notes that a dummy hash must be run even when the user is not found (prevents user enumeration via timing side-channel). This is critical and must be implemented — it is easy to forget.
- Email normalized to lowercase before lookup.
- Password trimmed, length bounds enforced (8–72, respecting bcrypt 72-byte limit).
- `invalid_credentials` response does not distinguish "wrong password" from "user not found".
- Exposed ORM uses prepared statements — no SQL injection risk.
- Error payloads never expose stack traces.

**Condition 2 — `passwordHash` must not serialize into API responses (Q4 in spec):**
`User.kt` is `@Serializable` and `User` is returned directly in `AuthTokenResponse.user`. Adding `passwordHash: String?` to `User` without excluding it from serialization would leak bcrypt hashes to clients. The implementer must apply `@kotlinx.serialization.Transient` to that field (or exclude it via a custom serializer / separate response DTO). This is a hard security requirement, not a phase-2 item.

**In-memory blocklist limitations (known, acceptable for MVP):**
The spec acknowledges the blocklist does not persist across restarts and does not work under horizontal scaling. This is correctly scoped as a known limitation. For MVP with a single instance this is fine.

**JWTUtil note — custom implementation:**
The existing `JWTUtil` is a hand-rolled HMAC-SHA256 JWT implementation. It works, but it does not validate `iss` / `aud` claims. This is a pre-existing issue outside the scope of this feature; flag it to the security team for a future hardening pass (e.g., migrate to `com.auth0:java-jwt` or `io.jsonwebtoken:jjwt`).

### 7. Performance

**Result: PASS**

- BCrypt cost 12 adds ~250–400ms per login call on modern hardware. This is expected and acceptable for an auth endpoint. No SLA concern for MVP.
- `recentlyWatchedMovies` (max 10 items) requires a join query on `UserMoviesTable`. This is bounded and indexed via `userId` + `watchedAt`. No N+1 risk as long as the datasource fetches them in a single query (`SELECT ... WHERE user_id = ? AND status = 'watched' ORDER BY watched_at DESC LIMIT 10`).
- Token blocklist uses `ConcurrentHashMap` — O(1) lookup, non-blocking. Cleanup can be scheduled lazily or on a low-frequency background coroutine. No performance concern for MVP traffic.
- No unnecessary calls: the spec correctly returns `UserProfile` inline in the login response, avoiding a second round-trip from the client.

### 8. Testing

**Result: PASS WITH CONDITION (see Condition 3)**

The spec does not include a test plan, but the feature is fully testable with the existing mock-based strategy.

**Condition 3 — Tests are required for the following paths:**

| Test File | Minimum Coverage |
|---|---|
| `domain/usecase/auth/LoginUserTest.kt` | new user (201), existing user correct password (200), wrong password (401), password too short (400), timing-safe dummy hash when user not found |
| `domain/usecase/auth/LogoutUserTest.kt` | valid token revoked, already-revoked token rejected |
| `data/repository/AuthRepositoryImplTest.kt` | `loginUser` and `logoutUser` delegation to datasources |
| `data/local/auth/TokenBlocklistDataSourceTest.kt` | revoke, isRevoked, cleanup of expired entries |

All four test files must be delivered with the implementation PR, not in a follow-up. This matches the `backend-testing.md` requirement ("All public usecases — At least 1 test per public method").

---

## Conditions (must be resolved before/during implementation)

### Condition 1 — Make OAuth env vars optional
`DataModule.kt` must be updated so that `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, and `OAUTH_PROVIDER_URL` fall back gracefully (return `null` or skip wiring `OAuthDataSource`) when absent, rather than throwing at startup. This unblocks local dev and CI environments that run email-only auth.

### Condition 2 — Exclude `passwordHash` from serialization
`User.passwordHash` must never appear in any API response. Apply `@Transient` annotation from `kotlinx.serialization` on the field, or use a separate response model. Verify that `AuthTokenResponse.user` does not include the hash in any login, refresh, or OAuth response.

### Condition 3 — Tests shipped with implementation
The four test files listed above are required in the same PR. The feature is not considered done without them.

---

## Recommendations

**Implementation guidance:**

1. Apply the schema migration via Exposed's `SchemaUtils.createMissingTablesAndColumns()` on startup (consistent with how the existing schema is managed), or add a standalone migration script — check how the current DB bootstrap works first.

2. For `UserDatabaseDataSource`, keep the interface thin: `findByEmail(email: String): User?` and `save(user: User): User`. Let `AuthRepositoryImpl` own the upsert logic, not the datasource.

3. The blocklist `cleanup()` method should be called on a coroutine launched with `applicationScope` on startup, or triggered lazily during `isRevoked()` checks with a time-based threshold — not on every request.

4. For the user enumeration timing attack mitigation: define a module-level `DUMMY_HASH` constant (a pre-computed BCrypt hash of an empty string) and always call `BCrypt.verifyer().verify(password, DUMMY_HASH)` before returning when the user is not found. Do not skip the verify call.

5. Q1 (recentlyWatchedMovies scope): use `status = 'watched'` only. `want_to_watch` should not appear in "recently watched." Confirm with PM but this is the obvious interpretation.

6. Q2 (username conflict resolution): the suffix-increment strategy described in the spec (`joao.silva` → `joao.silva_1`) is acceptable. Implement with a DB query checking for existing usernames with the same prefix, not a retry loop.

---

## Cross-Repo Impact

| Repo | Impact | Action Required |
|---|---|---|
| `backend/` | All changes contained here | Implement per spec + conditions above |
| `muuvie/` (Flutter) | None — new endpoint is additive | No action |
| `MuuvieAi` (meta-repo) | Submodule ref bump after merge | Update `backend` ref after PR merges |

No breaking changes to existing endpoints. OAuth flow is unaffected.

---

## Open Questions (disposition)

| # | Disposition |
|---|---|
| Q1 | Answered above — use `status = 'watched'` only |
| Q2 | Suffix increment is acceptable; confirm username uniqueness constraint in `UsersTable` (currently absent — add `uniqueIndex()` on `username` column) |
| Q3 | Resolved as Condition 1 above |
| Q4 | Resolved as Condition 2 above |
| Q5 | Single instance assumed for MVP — blocklist in memory is acceptable; flag to DevOps before any horizontal scaling |
