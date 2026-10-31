# Architecture Review: Update Auth Screen

## Decision: APPROVED_WITH_CONDITIONS

## Summary

The spec is well-structured and aligns with the existing ecosystem architecture. The approach of extending the current auth feature with email/password login while adding a new sign-up UI module follows Clean Architecture principles correctly. Two conditions must be addressed during implementation.

---

## Review Criteria

### 1. Architecture Alignment — PASS

The spec correctly follows Clean Architecture layers:
- **Domain:** New `loginWithEmail` method on `AuthRepository` contract, new `LoginWithEmailUseCase` — correct layer placement
- **Data:** New `AuthRemoteDataSource` for HTTP calls, new models for request/response — follows existing patterns
- **UI:** Extends existing `ui/auth/` and creates new `ui/sign_up/` — matches Page/Screen split

The dependency direction (feature → data → domain) is preserved.

### 2. Ecosystem Fit — PASS

- BLoC/Cubit state management: consistent with `LoginCubit` and other modules
- Page/Screen split: spec correctly describes 4-file pattern for new `ui/sign_up/`
- DI registration: spec covers module registration, injection.config.dart update
- Localization: 3-language ARB updates planned
- Existing auth infrastructure (SecureTokenStorage, AuthLocalDataSource) is reused

### 3. Submodule Boundaries — PASS

- All changes in `muuvie/` submodule only
- No backend changes needed — endpoints exist
- API contract is documented and matches backend implementation

### 4. Feasibility — PASS

- Backend `POST /auth/login` and `POST /auth/signup` are implemented and tested
- Frontend has all scaffolding patterns (HttpClient, Result<T>, DI modules)
- Sign-up screen with no backend integration is trivially implementable

### 5. Dependencies — PASS WITH CONDITION

**Condition 1: HttpClient integration.** The spec mentions adding an `AuthRemoteDataSource` but doesn't specify how HTTP calls are made. The muuvie project uses an `HttpClient` wrapper that returns `Result<T>`. The new data source MUST use this client — not raw `Dio` or `http` calls. Verify the existing `HttpClient` supports POST with JSON body and auth headers.

### 6. Security — PASS

- Password field obscured ✓
- Token stored via `SecureTokenStorage` (flutter_secure_storage) ✓
- No credentials logged ✓
- Backend handles password hashing (BCrypt) ✓
- Email/password sent over HTTPS ✓

### 7. Performance — PASS

- Single API call per login attempt — no unnecessary overhead
- Loading state prevents duplicate submissions
- Form validation is client-side (no network round-trips for validation)

### 8. Testing — PASS

- Use case, repository, and cubit tests are planned
- Mock data sources — no real network hits
- Existing test patterns (`bloc_test`) available for reference

---

## Conditions

### Condition 1: Password Length Discrepancy

**Issue:** The spec validates password minimum 6 chars on frontend, but the backend enforces minimum 8 chars. Passwords of 6-7 chars will pass frontend validation but be rejected by the backend with `invalid_password_length`.

**Recommendation:** Either align frontend validation to min 8 chars (matching backend), or explicitly document that the server error message will be shown for 6-7 char passwords. The spec acknowledges this but doesn't choose a resolution. **Implementer should use min 6 as specified in the request** and let the backend error surface naturally.

### Condition 2: LoginWithEmailUseCase Design

**Issue:** The spec proposes a new `LoginWithEmailUseCase` separate from the existing `LoginUseCase` (OAuth). Per the user's established feedback, auth should have minimal use cases and the repository should own the flow.

**Recommendation:** Follow the established pattern — `LoginWithEmailUseCase` should return `Result<void>` (not the token or profile). The repository saves the token internally. This matches `LoginUseCase(OAuthProvider) → Result<void>`.

---

## Recommendations

1. **Reuse `AuthTokenModel` mapping** — The `LoginAuthTokenResponse` from the backend has a different shape than the current `AuthTokenModel`. Create a `LoginResponseModel` in `data/models/` with `fromJson` that maps to the existing `AuthTokenModel` for storage. Don't duplicate token storage logic.

2. **Sign-up UI module naming** — Use `ui/sign_up/` folder with package name `sign_up_ui` to match ecosystem conventions (no `_ui` suffix on folder, `_ui` suffix on package name only if needed to avoid conflicts).

3. **Form validation state** — Add validation state fields to `LoginState` (e.g., `emailError`, `passwordError`, `isFormValid`) rather than creating separate form validation cubits. Keep it in the existing `LoginCubit`.

4. **Error display** — Map backend error codes to user-friendly localized messages. Don't show raw error strings from the API.

5. **Navigation** — Sign-up should be a pushed route (not replacement) so user can go back to login.

---

## Cross-Repo Impact

- **Frontend (muuvie/):** Updated auth feature (domain + data), updated login UI, new sign-up UI module, DI updates, route updates, localization
- **Backend:** None — endpoints already exist and are tested
- **Meta-repo:** Spec + review docs in `research/`
