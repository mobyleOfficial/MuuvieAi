# Auth Screen — Architecture Review

**Spec:** `research/specs/auth-screen.md`
**Date:** 2026-05-19
**Decision:** APPROVED

---

## Review Summary

The auth-screen spec is well-aligned with the existing MuuvieAi ecosystem architecture. The feature follows Clean Architecture with the standard domain/data/UI layer separation. Crucially, the DI contract is already committed in `injection.config.dart`, which both constrains and validates the proposed class names and registrations.

---

## Criterion-by-Criterion Review

### 1. Architecture Alignment — PASS

- Feature follows the standard `features/auth/{domain,data,lib}` structure
- Domain layer is pure Dart (models, repository contract, use cases)
- Data layer implements the contract with remote (mocked) and local data sources
- UI module follows the 3-file pattern (state, cubit, screen) under `ui/auth_ui/`
- Dependency direction: feature → data → domain is respected

### 2. Ecosystem Fit — PASS

- Uses `Result<T>` error handling pattern consistent with movies, comments, profile features
- `SecureTokenStorage` for local persistence follows the project's storage patterns
- `AuthCubit` as singleton matches the need for app-wide auth state
- Use cases are factory-registered, consistent with all other features

### 3. Submodule Boundaries — PASS

- All auth code lives in `muuvie/` submodule (frontend only)
- Backend interaction is fully mocked — no cross-submodule dependency
- API contract is documented for future backend implementation
- No AI-tooling files in submodule (compliant with `AI_AGNOSTIC_SUBMODULES` rule)

### 4. Feasibility — PASS

- DI wiring already exists in `injection.config.dart` — implementation just needs to match the expected interface
- All referenced patterns (Result, HttpClient, SecureStorage) are proven in the codebase
- Mock-first approach eliminates external SDK dependencies for this iteration
- No new Flutter plugins required (mocked OAuth)

### 5. Dependencies — PASS

- **Internal:** `core` package (HttpClient, Result, LocalClient), `common` package (AppLocalizations)
- **Pre-existing DI:** `auth_module.dart` is already imported but missing — must be created
- **No new pub dependencies** required for mocked implementation
- **Routing:** `auto_route` already configured — just needs new route entry

### 6. Security — PASS with note

- JWT stored via `SecureTokenStorage` (encrypted platform keychain) — correct approach
- Mock tokens don't need security, but the pattern is set up correctly for real integration
- **Note:** When real OAuth is integrated, ensure provider tokens are never logged or persisted beyond the OAuth exchange

### 7. Performance — PASS

- Auth status check is a local storage read (sub-100ms, no network)
- Mock responses with 500ms artificial delay simulates realistic UX
- `AuthCubit` as singleton avoids redundant state management instances

### 8. Testing — PASS

- Spec requires unit tests for all public use cases
- Mock data sources make testing straightforward
- Repository tests can verify domain mapping without network
- Cubit tests can verify state transitions with mocked use cases

---

## Recommendations

1. **UI Module naming:** The spec says `ui/auth_ui/` with files named `login_*`. Ensure the package name in `pubspec.yaml` matches what `injection.config.dart` imports (`auth_ui`). The cubit class should be `AuthCubit` (matching DI), not `LoginCubit`.

2. **Token injection interceptor:** Defer the Dio interceptor for JWT headers to a follow-up task. Adding it now with mock tokens adds complexity without value.

3. **Route guard pattern:** Consider using `auto_route`'s `AutoRouteGuard` for the auth check rather than imperative navigation. This integrates cleanly with the existing routing setup and handles deep links.

4. **Splash screen:** Use the `LoginLoading` state to show a brief loading indicator on the auth screen while checking stored token, rather than adding a separate splash route. Keeps routing simple.

5. **Implementation order:** domain models → domain repository contract → domain use cases → data models → data sources (mock) → data repository impl → DI module → UI cubit → UI screen → route registration → tests

---

## Blockers

None. Spec is approved for implementation.

---

## Cross-Repo Impact

- **Frontend only** for this iteration (all backend mocked)
- Future: Backend needs `POST /api/auth/oauth` endpoint — tracked separately
- Future: Dio interceptor for JWT header injection — follow-up task
