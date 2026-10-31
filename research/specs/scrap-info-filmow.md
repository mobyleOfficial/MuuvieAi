---
date: 2026-05-23
author: Claude Sonnet
status: draft
related:
  - ui-architecture
  - backend-architecture
tags: [frontend, backend, webview, profile, filmow, scraping]
---

# Scrap Info Filmow — Feature Specification

## Executive Summary

This feature enables Muuvie users to import their watch history, ratings, and lists from Filmow by authenticating through an in-app WebView. The app extracts session cookies after login and forwards them to the backend, which scrapes the user's Filmow profile data and returns it in a structured format. This is a high-priority feature that directly enriches the user's Muuvie profile with pre-existing data from another platform.

## Problem Statement

Users who have an existing Filmow account hold valuable watch history and ratings data that is not available in Muuvie. Manually re-entering this data is impractical. The only way to access Filmow data without a public API is through authenticated session scraping. By embedding a WebView login flow inside the app and extracting the resulting cookies, the backend can perform authenticated requests to Filmow on the user's behalf and retrieve their profile data.

## User Stories

1. **As a Muuvie user with a Filmow account**, I want to tap "Get Filmow Information" on my profile so that my watch history and ratings from Filmow are imported into Muuvie.
2. **As a Muuvie user**, I want to log in to Filmow inside the app without leaving it so that the flow feels native and trustworthy.
3. **As a Muuvie user**, I want the import to only happen after I successfully authenticate so that no unintended data transfer occurs if I close the WebView early.
4. **As a Muuvie user**, I want feedback during the import process (loading, success, error) so that I know the operation completed correctly.

## Acceptance Criteria

### Button & Navigation
- [ ] A button labeled "Get Filmow Information" is visible on the profile screen.
- [ ] Tapping the button navigates to the Filmow WebView screen.

### WebView Screen
- [ ] The WebView screen opens `https://filmow.com/login/` on load [Source: feature request].
- [ ] The screen is placed in the `ui/profile` module [Source: feature request].
- [ ] The BLoC, state, and cubit files for this screen live within the same `ui/profile` module.
- [ ] A loading indicator is shown while the page is loading.
- [ ] The user can navigate the WebView normally (follow Filmow's own login flow).

### Cookie Extraction & Authentication Detection
- [ ] The app detects when the user has successfully authenticated on Filmow (e.g., by detecting a post-login URL redirect away from `/login/`).
- [ ] On successful authentication, `WebViewCookieManager.getCookies('https://filmow.com')` is called to extract session cookies [Source: feature request].
- [ ] If the user closes the WebView without authenticating, the app does nothing — no data is sent to the backend.
- [ ] The WebView screen emits an `authenticated` state carrying the extracted cookies when login is detected.

### Backend Communication
- [ ] Extracted cookies are passed to the backend via `GET /profile/filmow-information` [Source: feature request].
- [ ] The request includes cookies either as a `Cookie` header or encoded query parameter.
- [ ] A loading state is shown while the backend request is in flight.
- [ ] On success, the app transitions to a success state with the returned Filmow profile data.
- [ ] On error (network failure, backend error), the app transitions to an error state with a user-visible message.

### Data Layer
- [ ] A datasource exists in the data layer responsible for calling the backend endpoint.
- [ ] A repository abstracts the datasource and is consumed by a use case.
- [ ] The use case passes cookies to the repository and returns the Filmow profile result.

## Technical Notes

### Frontend (muuvie)

**Package dependency:**
- Add `webview_flutter` to `pubspec.yaml` [Source: feature request].

**Module location:** `ui/profile`

**New files (following Page/Screen 4-file split and BLoC pattern):**
```
ui/profile/
  filmow_webview/
    filmow_webview_page.dart       # route entry point, provides BLoC
    filmow_webview_screen.dart     # stateful widget with WebView + controller
    filmow_webview_cubit.dart      # business logic (no DI registration)
    filmow_webview_state.dart      # state definitions
```

**BLoC States:**
```dart
sealed class FilmowWebviewState {}
class FilmowWebviewInitial extends FilmowWebviewState {}
class FilmowWebviewLoading extends FilmowWebviewState {}
class FilmowWebviewAuthenticated extends FilmowWebviewState {
  final List<Cookie> cookies;
}
class FilmowWebviewSendingCookies extends FilmowWebviewState {}
class FilmowWebviewSuccess extends FilmowWebviewState {
  final FilmowProfile profile;
}
class FilmowWebviewError extends FilmowWebviewState {
  final String message;
}
```

**Authentication detection strategy:**
- Subscribe to `WebViewController.setNavigationDelegate` and observe `onPageFinished`.
- Check if the current URL no longer contains `/login/` (e.g., redirects to `/` or `/usuario/` on successful login).
- On detection, invoke `WebViewCookieManager().getCookies('https://filmow.com')`.

**Data layer (inside `muuvie` feature or `profile` feature):**
- `FilmowDatasource` — calls `GET /profile/filmow-information` with cookies.
- `FilmowRepository` / `FilmowRepositoryImpl` — wraps datasource, returns `Result<FilmowProfile>`.
- `GetFilmowInformationUseCase` — single invocable use case; accepts cookies, returns `Result<FilmowProfile>`.

### Backend (backend)

**New endpoint:** `GET /profile/filmow-information`

**Input:** Filmow session cookies, passed via:
- `Cookie` request header (preferred), or
- `?cookies=<url-encoded-cookie-string>` query parameter (fallback)

**Processing:**
- Use cookies to make authenticated HTTP requests to `https://filmow.com` on behalf of the user.
- Parse the response HTML/JSON to extract: username, watched movies, ratings, lists.
- Return structured JSON.

**Response shape:**
```json
{
  "username": "string",
  "displayName": "string",
  "watchedCount": 0,
  "recentlyWatched": [{ "id": 123, "title": "string", "localTitle": "string?", "originalTitle": "string?", "posterPath": "string?", "voteAverage": 0.0 }],
  "watched": [{ "id": 123, "title": "string", "localTitle": "string?", "originalTitle": "string?", "posterPath": "string?", "voteAverage": 0.0 }],
  "watchlist": [{ "id": 123, "title": "string", "localTitle": "string?", "originalTitle": "string?", "posterPath": "string?", "voteAverage": 0.0 }],
  "favorites": [{ "id": 123, "title": "string", "localTitle": "string?", "originalTitle": "string?", "posterPath": "string?", "voteAverage": 0.0 }],
  "lists": [{
    "filmowId": "string",
    "title": "string",
    "description": "string?",
    "filmowUrl": "string",
    "coverUrl": "string?",
    "movies": [{ "id": -1, "title": "string", "localTitle": "string?", "originalTitle": "string?", "filmowId": "string?", "posterPath": "string?", "voteAverage": 0.0 }]
  }],
  "errors": ["string"]
}
```

**Notes:**
- `id` is the TMDB ID. For movies in `recentlyWatched`, `watched`, `watchlist`, and `favorites`, it is resolved via TMDB search. For movies inside `lists`, it defaults to `-1` (not resolved).
- `localTitle` is the Portuguese title from Filmow; `originalTitle` is the original language title. Both are nullable (absent when Filmow does not distinguish).
- `filmowId` on list movies is the Filmow internal ID (`data-movie-pk`), available without navigating to the movie detail page.
- `title` uses the original title when available (better for TMDB matching), falling back to the local title.

**Backend module placement:**
- Route: `src/routes/profile/FilmowInformationRoute.kt`
- Use case: `src/domain/usecases/profile/GetFilmowInformationUseCase.kt`
- Datasource: `src/data/datasources/filmow/FilmowRemoteDatasource.kt`
- Repository: `src/data/repositories/filmow/FilmowRepository.kt`
- DTOs: `src/data/datasources/filmow/dto/`

**Koin registration:** New use case and datasource must be registered in the relevant Koin module.

### API Contract

```
GET /profile/filmow-information
Authorization: Bearer <muuvie-jwt>        (standard auth)
Cookie: <filmow-session-cookies>
  OR
?cookies=<url-encoded-filmow-cookies>

200 OK
{
  "username": "string",
  "displayName": "string",
  "watchedCount": 0,
  "recentlyWatched": [...],
  "watched": [...],
  "watchlist": [...],
  "favorites": [...],
  "lists": [...],
  "errors": [...]
}

401 Unauthorized   — invalid/expired Filmow cookies
502 Bad Gateway    — Filmow unreachable or scraping failed
```

## Cross-Repo Impact

| Repo | Impact |
|------|--------|
| `muuvie` (Flutter) | New screen in `ui/profile`, new data layer files, new dependency (`webview_flutter`), button added to profile screen |
| `backend` (Kotlin/Ktor) | New route, use case, datasource, repository, and DTOs in `profile` domain area |
| `MuuvieAi` (meta) | Submodule refs bumped after both repos merge |

## Out of Scope

- **Automatic/background re-sync:** Cookies expire; re-import is manual only.
- **Storing Filmow credentials:** The app never stores username/password — only session cookies, and only in memory during the flow.
- **Persisting Filmow cookies on the backend:** The backend uses them for a single request and discards them.
- **Mapping Filmow movie IDs to TMDB IDs in lists:** Movies in `recentlyWatched`, `watched`, `watchlist`, and `favorites` are resolved to TMDB IDs via search. Movies inside user lists are not resolved (`id = -1`) to avoid excessive API calls; their `filmowId` is available for future resolution.
- **Other Filmow data:** Community reviews, followers, and comments are out of scope for v1.
- **iOS/Android platform-specific WebView config beyond the `webview_flutter` defaults:** No custom JS injection or certificate pinning.

## Open Questions

1. **Authentication detection heuristic:** Redirecting away from `/login/` is the assumed signal for successful login. Are there edge cases (e.g., failed login that redirects to an error page still not containing `/login/`)? Should we validate a specific post-login URL pattern?
2. **Cookie encoding for transport:** Should cookies be sent as a `Cookie` header (more standard) or as a query parameter (simpler CORS-wise)? This needs alignment between frontend and backend teams.
3. **Filmow scraping reliability:** Filmow does not have a public API. HTML structure changes on their end will break the backend parser. Is a maintenance plan needed, or is best-effort acceptable?
4. **Backend authentication requirement:** Should `GET /profile/filmow-information` require a valid Muuvie JWT, or is the Filmow cookie sufficient identification? Recommend requiring the JWT to prevent abuse.
5. **Rate limiting:** If many users trigger this endpoint simultaneously, the backend could get rate-limited by Filmow. Is per-user rate limiting on this endpoint needed at launch?
6. **Cookie expiry handling:** Filmow session cookies may expire quickly. Should the app surface a "session expired, please re-authenticate" error with a retry button?
7. **Profile screen placement:** The button location on the profile screen (top, bottom, settings section?) is not specified — needs design input.

## Next Steps

- [ ] Architect review of this spec (architect-review agent)
- [ ] Confirm cookie transport mechanism (header vs query param) — backend + frontend alignment
- [ ] Design mockup for button placement on profile screen
- [ ] Add `webview_flutter` to `muuvie/pubspec.yaml`
- [ ] Implement backend endpoint (`GET /profile/filmow-information`) with Filmow scraping logic
- [ ] Implement frontend WebView screen + BLoC in `ui/profile`
- [ ] Implement frontend data layer (datasource, repository, use case)
- [ ] Wire button on profile screen to navigation
- [ ] Manual QA: test login, cookie extraction, backend response, error cases
- [ ] Update submodule refs in MuuvieAi after both PRs merge
