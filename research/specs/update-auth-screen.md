# Update Auth Screen — Email/Password Login & Sign Up

## Overview

The current login screen uses OAuth-only authentication (Google/Facebook buttons). The backend already supports email/password login (`POST /auth/login`) and sign up (`POST /auth/signup`). This feature updates the frontend auth screen to support email/password authentication, adds a sign-up flow, and integrates with the backend login endpoint.

**Why now:** Email/password is the most basic and universal authentication method. Users who don't have or don't want to use OAuth providers need an alternative way to authenticate. The backend already has the endpoints ready.

## User Stories

- As a user, I want to log in with my email and password so that I can access protected features without needing a social account.
- As a user, I want to see validation errors on my login form so that I know what to fix before submitting.
- As a user, I want to navigate to a sign-up screen from the login screen so that I can create a new account.
- As a user, I want to create an account with email, password, and nickname so that I can register for the app.
- As a user, I want to see a loading state during login so that I know my request is being processed.
- As a user, I want to see a clear error message if login fails so that I can correct my credentials.

## Acceptance Criteria

### Login Screen
- [ ] Screen has an email `TextField` with email keyboard type
- [ ] Screen has a password `TextField` with text obscured
- [ ] Email field validates format (basic email regex); login button disabled until valid email
- [ ] Password field validates minimum length of 6 characters; login button disabled until valid password
- [ ] Login button is disabled when email is invalid OR password is < 6 characters
- [ ] Tapping "Login" shows a loading indicator and disables both text fields
- [ ] On successful login, navigates to user profile
- [ ] On login error, shows an error message below the password field
- [ ] Screen has a "Sign Up" button/link that navigates to the Sign Up screen
- [ ] Existing OAuth buttons (Google/Facebook) may be removed or kept alongside — spec focuses on email/password

### Sign Up Screen
- [ ] Screen has 3 `TextField`s: email, password (obscured), and nickname
- [ ] Screen has a "Create Account" button
- [ ] Tapping "Create Account" does NOT call any backend endpoint (no integration yet)
- [ ] Basic form validation: email format, password min 6 chars, nickname not empty
- [ ] Navigation back to login screen is possible

### Backend Integration (Login Only)
- [ ] Login calls `POST /auth/login` with `{ email, password }`
- [ ] On success (200/201), receives `LoginAuthTokenResponse` with `accessToken`, `tokenType`, `expiresIn`, `profile`
- [ ] Token is saved securely via existing `SecureTokenStorage`
- [ ] Profile data (`photoUrl`, `username`, `bio`) is available from the response
- [ ] On error (400/401/409/500), the error message from the response `message` field is displayed

## Technical Notes

### Frontend (muuvie/)

**Affected Modules:**

1. **`features/auth/domain/`**
   - Update `AuthRepository` contract: add `loginWithEmail(String email, String password)` method returning `Result<void>`
   - Add `LoginWithEmailUseCase` — takes email + password, delegates to repository
   - Keep existing `LoginUseCase` (OAuth) and `IsUserAuthenticatedUseCase` intact

2. **`features/auth/data/`**
   - Add `AuthRemoteDataSource` (new) — HTTP client that calls `POST /auth/login`
   - Add `LoginRequest` model — `{ email: String, password: String }`
   - Add `LoginAuthTokenResponse` model — `{ accessToken, tokenType, expiresIn, profile: { photoUrl, username, bio } }`
   - Update `AuthRepositoryImpl` — implement `loginWithEmail()` using the new remote data source + save token via local data source
   - Convert `AuthTokenModel` or create mapping from `LoginAuthTokenResponse` → stored token

3. **`ui/auth/`** (existing login UI module)
   - Replace OAuth-based `LoginScreen` with email/password form
   - Update `LoginCubit` — add `loginWithEmail(email, password)` method, add form validation state
   - Update `LoginState` — add fields/substates for form validation (email valid, password valid, error message)
   - Update `LoginPage` — continue owning Cubit lifecycle, handle navigation on success

4. **New `ui/sign_up/` module** (or `ui/signup/`)
   - `SignUpState` — sealed states (Initial, Loading if needed in future, etc.)
   - `SignUpCubit` — form validation only (no backend calls)
   - `SignUpPage` — `@RoutePage()` StatefulWidget, owns Cubit lifecycle
   - `SignUpScreen` — StatelessWidget, 3 text fields + button, pure UI

5. **`lib/di/auth_module.dart`**
   - Register `AuthRemoteDataSource`
   - Register `LoginWithEmailUseCase`

6. **`lib/routes/`**
   - Add `SignUpRoute` to app router

7. **Localization**
   - Add keys for: email hint, password hint, login button, sign up button, sign up title, nickname hint, create account button, email validation error, password validation error, nickname validation error
   - All 3 languages: EN, ES, PT

### Backend (backend/) — No Changes Required

The backend already has `POST /auth/login` and `POST /auth/signup` endpoints fully implemented.

**Login API Contract:**
```
POST /auth/login
Content-Type: application/json

Request:
{
  "email": "user@example.com",
  "password": "password123"
}

Success Response (200 OK):
{
  "accessToken": "eyJhbGc...",
  "tokenType": "Bearer",
  "expiresIn": 86400,
  "profile": {
    "photoUrl": "",
    "username": "user123",
    "bio": ""
  }
}

Error Response (400/401/409/500):
{
  "error": "invalid_credentials",
  "message": "Invalid email or password"
}
```

**Error codes:**
- `invalid_password_length` (400) — password outside 8-72 chars
- `invalid_credentials` (401) — wrong email/password
- `invalid_request` (400) — malformed request
- `internal_error` (500) — server failure

> **Note:** Backend enforces password 8-72 chars. Frontend validates min 6 chars per the request. The backend will reject passwords of 6-7 chars with `invalid_password_length`. This is acceptable — the frontend error message from the server response will be shown to the user.

## Cross-Repo Impact

- **Frontend:** Updated auth feature (domain + data + UI), new sign-up UI module, DI updates, route updates, localization
- **Backend:** No changes needed — endpoints already exist
- **Shared:** Login API contract as documented above

## Out of Scope

- Sign up endpoint integration (explicitly excluded per requirements)
- OAuth login flow changes (existing OAuth can remain or be removed — not part of this spec)
- Password reset / forgot password
- Token refresh
- Logout functionality
- Profile screen updates after login
- Biometric authentication
- Remember me / stay logged in

## Open Questions

1. **Password min length mismatch:** Frontend validates min 6 (per request), backend enforces min 8. Should frontend match backend (min 8) to avoid confusing error messages? → Proceeding with min 6 as specified in the request; backend error message will handle the edge case.
2. **OAuth buttons:** Should the existing Google/Facebook OAuth buttons be removed or kept alongside email/password? → Spec assumes they can coexist; implementation can keep or remove them.
3. **Sign Up screen — future integration:** When sign-up endpoint integration is added later, should it auto-login the user? → Out of scope, but backend returns a token on signup which suggests auto-login.
