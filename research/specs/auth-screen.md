# Auth Screen Feature Specification

## Overview

Users need to authenticate before accessing the app. This feature introduces an auth screen with Google and Facebook OAuth login, token management via the backend, and secure local token storage. The flow follows the standard OAuth pattern: Frontend App -> Google/Facebook Login SDK -> Identity Token/Access Token -> Backend API -> JWT Session.

### Why This Matters

Authentication is the gateway to personalized features (profiles, reviews, watch lists, social features). Without it, the app cannot distinguish users or protect user-specific data. This is a **must-have** feature and a prerequisite for all authenticated backend endpoints.

---

## User Stories

### User Story 1: Login with Google
**As a** new or returning user
**I want to** sign in using my Google account
**So that** I can access my personalized Muuvie experience without creating a new account

### User Story 2: Login with Facebook
**As a** new or returning user
**I want to** sign in using my Facebook account
**So that** I have an alternative social login option

### User Story 3: Persistent Session
**As a** returning user
**I want to** remain logged in across app restarts
**So that** I don't have to re-authenticate every time I open the app

### User Story 4: Logout
**As a** logged-in user
**I want to** sign out of my account
**So that** I can switch accounts or protect my privacy on a shared device

---

## Acceptance Criteria

### Functional Requirements

- [ ] Auth screen displays two login buttons: "Continue with Google" and "Continue with Facebook"
- [ ] Tapping Google login triggers the Google OAuth SDK flow and returns an identity token
- [ ] Tapping Facebook login triggers the Facebook OAuth SDK flow and returns an access token
- [ ] After receiving the provider token, the app sends it to the backend (`POST /api/auth/oauth`) with provider type
- [ ] Backend returns a JWT session token (mocked response for now)
- [ ] JWT token is securely stored locally using `SecureTokenStorage`
- [ ] On app launch, the app checks for a stored token to determine auth state
- [ ] If a valid token exists, the user is routed to the home screen (skips auth screen)
- [ ] If no token exists, the user sees the auth screen
- [ ] Logout clears the stored token and returns the user to the auth screen
- [ ] Error states are shown for: network failure, OAuth cancellation, backend rejection
- [ ] All remote data source responses are **mocked** (no real OAuth SDK or backend calls)
- [ ] All user-visible strings use `AppLocalizations` (English, Spanish, Portuguese)
- [ ] Auth screen meets WCAG AA accessibility standards (contrast, touch targets, semantic labels)

### Non-Functional Requirements

- [ ] Auth state check on app launch completes in < 100ms (local storage read)
- [ ] OAuth flow mock returns within the same frame (synchronous mock)
- [ ] No `dynamic` types — all models are fully typed
- [ ] All public use cases have unit tests
- [ ] Code passes `flutter analyze`

---

## Technical Notes

### Architecture Overview

This feature spans three packages following the existing multimodule Clean Architecture:

**Feature Package: `features/auth/`**
- `domain/` — Pure Dart: models, repository contract, use cases
- `data/` — Repository implementation, remote data source (mocked), local data source (secure storage)
- `lib/` — Barrel export re-exporting domain + data

**UI Package: `ui/auth_ui/` (using "Login" naming for UI elements)**
- `login_state.dart` — Sealed states: `LoginLoading`, `LoginAuthenticated`, `LoginUnauthenticated`, `LoginError`
- `login_cubit.dart` — `AuthCubit` managing auth state transitions
- `login_screen.dart` — `@RoutePage()` widget with Google/Facebook buttons

**DI Module: `lib/di/auth_module.dart`**
- Already wired in `injection.config.dart` — must match expected interface

### Pre-Existing DI Contract

The `injection.config.dart` already references these types (the module file is missing but the wiring exists):

| Type | Registration | Package |
|------|-------------|---------|
| `SecureTokenStorage` | lazySingleton | `auth` (data) |
| `OAuthRemoteDataSource` | lazySingleton | `auth` (data) |
| `AuthLocalDataSource` | lazySingleton | `auth` (data) |
| `AuthRepository` | lazySingleton | `auth_domain` (domain) |
| `CheckAuthStatusUseCase` | factory | `auth_domain` (domain) |
| `InitiateOAuthUseCase` | factory | `auth_domain` (domain) |
| `CompleteOAuthUseCase` | factory | `auth_domain` (domain) |
| `SaveTokenUseCase` | factory | `auth_domain` (domain) |
| `ClearTokenUseCase` | factory | `auth_domain` (domain) |
| `AuthCubit` | singleton | `auth_ui` (ui) |

**Implementation MUST match these exact class names and constructor signatures** since DI wiring is already committed.

### Domain Models

```dart
// OAuth provider enum
enum OAuthProvider { google, facebook }

// OAuth result from SDK
class OAuthResult {
  final OAuthProvider provider;
  final String providerToken;
}

// Auth token from backend
class AuthToken {
  final String accessToken;
  final String? refreshToken;
  final DateTime expiresAt;
}

// Auth status
enum AuthStatus { authenticated, unauthenticated, unknown }
```

### Repository Contract

```dart
abstract interface class AuthRepository {
  Future<Result<OAuthResult>> initiateOAuth(OAuthProvider provider);
  Future<Result<AuthToken>> completeOAuth(OAuthResult oauthResult);
  Future<Result<AuthStatus>> checkAuthStatus();
  Future<Result<void>> saveToken(AuthToken token);
  Future<Result<void>> clearToken();
}
```

### Use Cases

| Use Case | Input | Output | Purpose |
|----------|-------|--------|---------|
| `InitiateOAuthUseCase` | `OAuthProvider` | `Result<OAuthResult>` | Trigger Google/Facebook SDK (mocked) |
| `CompleteOAuthUseCase` | `OAuthResult` | `Result<AuthToken>` | Send provider token to backend, get JWT (mocked) |
| `CheckAuthStatusUseCase` | none | `Result<AuthStatus>` | Check local storage for existing token |
| `SaveTokenUseCase` | `AuthToken` | `Result<void>` | Persist JWT to secure storage |
| `ClearTokenUseCase` | none | `Result<void>` | Remove JWT from secure storage (logout) |

### Data Sources

**`OAuthRemoteDataSource` (mocked)**
- `initiateOAuth(OAuthProvider)` → returns mock `OAuthResult` with fake token
- `completeOAuth(OAuthResult)` → returns mock `AuthToken` with fake JWT

**`AuthLocalDataSource`**
- `saveToken(AuthToken)` → persists to `SecureTokenStorage`
- `getToken()` → reads from `SecureTokenStorage`
- `clearToken()` → removes from `SecureTokenStorage`

**`SecureTokenStorage`**
- Wraps `flutter_secure_storage` (or equivalent) for encrypted token persistence

### API Contract (Backend — Mocked)

```
POST /api/auth/oauth
Request:  { "provider": "google" | "facebook", "provider_token": "..." }
Response: { "access_token": "mock-jwt-token", "refresh_token": null, "expires_at": "2026-06-19T00:00:00Z" }
```

### Routing Changes

- Add `LoginRoute` as an initial/guard route in `app_router.dart`
- On app start: `CheckAuthStatusUseCase` → if authenticated, navigate to `MainRoute`; if not, show `LoginRoute`
- After successful login: navigate to `MainRoute` and clear the auth stack
- On logout: navigate to `LoginRoute` and clear the navigation stack

### Mock Strategy

All remote interactions are mocked at the data source level:
- `OAuthRemoteDataSource` returns hardcoded success responses with artificial delays (500ms)
- No real Google/Facebook SDK integration (no native plugin dependencies yet)
- No real backend HTTP calls
- `AuthLocalDataSource` uses real `SecureTokenStorage` (actual local persistence)

---

## Cross-Repo Impact

- **Frontend (muuvie):** New `auth` feature package, new `auth_ui` UI module, DI module, route changes
- **Backend:** Will need `POST /api/auth/oauth` endpoint (not part of this scope — mocked)
- **Shared:** Auth token will eventually be injected as a header in the backend `Dio` instance for authenticated requests

### Future Integration Points (Out of Scope Now)

- Token refresh logic
- Dio interceptor for injecting JWT in backend requests
- Real Google/Facebook SDK plugin integration
- Backend OAuth endpoint implementation

---

## Out of Scope

- Real Google/Facebook OAuth SDK integration (mocked)
- Real backend API calls (mocked)
- Token refresh/rotation
- Biometric authentication
- Email/password login
- Account deletion
- Onboarding flow after first login

---

## Open Questions

1. **Token injection:** Should the backend `Dio` interceptor for JWT headers be added now (with the mock token) or deferred to when real backend auth is ready?
2. **Splash screen:** Should there be a dedicated splash/loading screen while checking auth status, or should the auth screen show a loading indicator?
3. **Deep linking:** If the app is opened via a deep link while unauthenticated, should it queue the deep link and redirect after login?
