---
date: 2026-05-23
author: architect-review agent
status: approved_with_conditions
spec: research/specs/scrap-info-filmow.md
---

# Architect Review — Scrap Info Filmow

## Decision: APPROVED_WITH_CONDITIONS

The feature is technically sound and fits the ecosystem well. Architecture alignment is strong on the backend side and mostly correct on the frontend side, with two structural issues that must be resolved before implementation begins. Security and open questions in the spec also require concrete answers before coding starts.

---

## 1. Architecture Alignment

**Frontend — PARTIALLY ALIGNED**

The spec proposes placing new files directly inside `ui/profile/lib/filmow_webview/`. Inspection of the actual `muuvie/ui/profile` module shows it already has sub-modules following the 4-file Page/Screen split under flat sub-directories (e.g., `edit_profile/`). The proposed `filmow_webview/` sub-directory inside the existing `profile_ui` package is acceptable structurally, provided the four-file rule and naming conventions are strictly followed.

However, the data layer (`FilmowDatasource`, `FilmowRepository`, `GetFilmowInformationUseCase`) is proposed without a clear feature package home. The spec says "inside `muuvie` feature or `profile` feature" — this ambiguity is a blocker. Clean Architecture requires the data layer to live in a dedicated feature package (`features/filmow/` or appended to `features/profile/`). Folding Filmow-specific domain models into the existing `profile_domain` package would pollute the profile domain with third-party import concerns. A separate `features/filmow/` feature package is the preferred path.

**Backend — ALIGNED**

The proposed backend structure (`domain/usecase/profile/`, `data/remote/filmow/`, `data/repository/filmow/`) maps cleanly to the actual backend layout observed at `backend/src/main/kotlin/org/mobyle/`. The existing `ProfileRouting.kt` is the correct extension point for the new `GET /profile/filmow-information` route. DTOs in `data/remote/filmow/model/` (mirroring the existing `data/remote/tmdb/model/` pattern) and Koin registration in `DataModule.kt` + `AppModule.kt` are well understood.

**Condition C1:** The frontend data layer placement must be clarified. Create `features/filmow/` as a standalone feature package with its own `domain/` and `data/` sub-packages. Do not embed Filmow domain models in `features/profile/domain/`.

---

## 2. Ecosystem Fit

**Flutter/Dart — ALIGNED**

- `webview_flutter` is the standard Flutter WebView package. Adding it to `pubspec.yaml` is straightforward.
- `WebViewCookieManager.getCookies()` is the correct API for cookie extraction.
- The 4-file Page/Screen split (`filmow_webview_page.dart`, `filmow_webview_screen.dart`, `filmow_webview_cubit.dart`, `filmow_webview_state.dart`) matches the pattern established by `edit_profile/` and documented in `rules/frontend/ui-architecture.md`.
- The Cubit must not be DI-registered (confirmed correct in spec: "no DI registration").
- The Page resolves use cases from `GetIt` and passes them to the Cubit constructor — this matches `EditProfilePage`'s pattern exactly.

**Kotlin/Ktor — ALIGNED**

- Adding a new Ktor client (or reusing a generic one) for Filmow scraping is feasible with the existing Ktor client infrastructure.
- HTML parsing will require a new dependency (see Dependencies section).

**Condition C2:** The `filmow_webview_screen.dart` must be a `StatelessWidget` per the ui-architecture rule. The spec notes it is "stateful with WebView + controller" — the WebView controller state must be managed in the Page or a dedicated Cubit, not by making the Screen stateful. The Screen may hold a `WebViewController` if constructed inline, but the navigation delegation and state emission must remain in the Page/Cubit respectively.

---

## 3. Submodule Boundaries

The feature correctly spans both submodules with a clear boundary: cookie extraction lives in the Flutter frontend; all Filmow HTTP requests and HTML parsing live in the backend. The frontend never communicates directly with `filmow.com`. This is the correct and only acceptable design — it avoids CORS issues, prevents credential leakage in client-side JS, and centralizes scraping logic where it can be versioned and updated without an app release.

The cross-repo impact table in the spec is accurate. Submodule refs in MuuvieAi must be bumped after both PRs merge.

---

## 4. Feasibility

The feature is technically feasible with the existing stack. The primary unknowns are:

- **Filmow login detection heuristic** (open question 1): Redirecting away from `/login/` is a reasonable heuristic but fragile. Filmow's login page may redirect to an error page (e.g., `/login/?error=1`) that also does not contain `/login/` literally. The implementer must validate the post-login URL pattern against a known-good Filmow login session before finalising the detection logic.
- **HTML scraping reliability** (open question 3): Filmow has no public API. The backend parser is inherently brittle against HTML changes. This is acceptable for v1 but must be acknowledged in implementation notes with error logging that surfaces parse failures clearly (structured log, not silent null).

**Condition C3:** The authentication detection strategy must be hardened. Matching against a known post-login path prefix (e.g., `/usuario/` or root `/`) rather than the absence of `/login/` is safer. Implement as a configurable constant, not a hard-coded string literal.

---

## 5. Dependencies

**Frontend:**
- `webview_flutter` — add to `muuvie/pubspec.yaml` (and to the `profile_ui` or new `filmow_ui` package's `pubspec.yaml`).
- No other new packages needed.

**Backend:**
- HTML parsing library required. The existing stack uses Ktor client for HTTP but has no HTML parser. **Jsoup** (`org.jsoup:jsoup`) is the standard Kotlin/JVM HTML parser and is the recommended addition. Add to `build.gradle.kts`.
- A second `HttpClient` instance (or a separate Ktor client configured without TMDB-specific defaults) is needed for Filmow requests. The current `DataModule.kt` single `HttpClient` is TMDB-specific (base URL, auth header). Creating a second generic `HttpClient` registered as a named Koin binding is the correct approach.

**Condition C4 (Blocker):** The spec does not mention an HTML parsing library. Jsoup must be added to `backend/build.gradle.kts`. The implementer must confirm availability and license compatibility (Jsoup: MIT — compatible).

**Condition C5 (Blocker):** A second Koin-registered `HttpClient` (named, e.g., `filmowHttpClient`) must be created for Filmow requests. Reusing the TMDB client would inject TMDB auth headers into Filmow requests, which is incorrect.

---

## 6. Security

**Cookie handling — CONCERN**

The spec correctly states that Filmow cookies are never stored — they are held in memory during the flow and discarded after the backend responds. This is acceptable.

However, the transport mechanism is unresolved (open question 2):

- Passing cookies as a `Cookie` header is standard and preferred — the header is not logged by default in most setups.
- Passing cookies as a query parameter (`?cookies=...`) is a significant security risk: query parameters appear in server access logs, browser history, and proxy logs. **This option must be eliminated.**

**Condition C6 (Blocker):** The `?cookies=<url-encoded>` query parameter fallback must be removed from the spec and implementation. Cookies must only be transported via the `Cookie` request header (or, if proxied, via a private custom header like `X-Filmow-Cookies` that is explicitly excluded from access logs).

**JWT requirement (open question 4):** The spec recommends requiring a valid Muuvie JWT on `GET /profile/filmow-information`. This is correct and must be implemented. Without JWT validation, any caller can proxy Filmow requests through the backend, enabling abuse.

**Condition C7 (Blocker):** `GET /profile/filmow-information` must require Muuvie JWT authentication. This must be added to the spec's acceptance criteria and implemented before the endpoint is exposed.

---

## 7. Performance

**WebView startup:** `webview_flutter` initialization on first render can be slow on older devices. A loading overlay should be shown from the first frame, not only after `onPageStarted` fires. The spec already includes a loading indicator — ensure it is visible from initial widget build.

**Backend scraping latency:** Making authenticated HTTP requests to `filmow.com` and parsing HTML is inherently slow compared to a TMDB API call. The backend endpoint should enforce a timeout on the outbound Filmow request (recommended: 15–30 seconds). If Filmow is unreachable or returns a non-200 response, the endpoint must return `502 Bad Gateway` promptly rather than hanging.

**Condition C8:** The Filmow `HttpClient` in the backend must be configured with an explicit request timeout. Add this to the Koin `filmowHttpClient` definition.

**Rate limiting (open question 5):** Per-user rate limiting at launch is not required but the endpoint must log a warning when Filmow returns HTTP 429 or connection errors, so operational issues can be detected early.

---

## 8. Testing

**Frontend:**
- The `FilmowWebviewCubit` can be unit-tested by injecting a mock `GetFilmowInformationUseCase`. States (`Loading`, `Authenticated`, `SendingCookies`, `Success`, `Error`) are all testable.
- The `FilmowWebviewScreen` can be widget-tested with a mock Cubit (matching the Page/Screen split benefit).
- Cookie extraction via `WebViewCookieManager` is a platform channel call — it cannot be unit-tested without a real device/emulator. Document this limitation in the test file; integration testing on a real device is required for cookie extraction.

**Backend:**
- `FilmowRemoteDatasource` can be unit-tested by mocking the `HttpClient` response.
- HTML parsing logic must have unit tests with captured Filmow HTML snapshots. This is critical given scraping fragility — a test corpus of representative Filmow pages must be included.
- The `GetFilmowInformationUseCase` can be unit-tested with a mocked `FilmowRepository`.
- `FilmowInformationRoute` (routing) should have an integration test using `testApplication`.

**Condition C9:** Backend HTML parsing tests with snapshot fixtures are required. Without them, regressions caused by Filmow HTML changes will be invisible.

---

## Blockers Summary

| ID | Layer | Blocker |
|----|-------|---------|
| C4 | Backend | Add Jsoup to `build.gradle.kts`; confirm before implementation |
| C5 | Backend | Create a named Filmow `HttpClient` in Koin; do not reuse TMDB client |
| C6 | Both | Remove cookie-as-query-parameter option entirely |
| C7 | Backend | Require Muuvie JWT on `GET /profile/filmow-information` |

---

## Conditions (Non-Blocking)

| ID | Layer | Condition |
|----|-------|-----------|
| C1 | Frontend | Create `features/filmow/` feature package; do not embed in `features/profile/` |
| C2 | Frontend | `filmow_webview_screen.dart` must be `StatelessWidget`; move controller state to Cubit or Page |
| C3 | Frontend | Harden login detection heuristic; match known post-login URL, not absence of `/login/` |
| C8 | Backend | Configure explicit request timeout on Filmow `HttpClient` |
| C9 | Backend | Include HTML snapshot test fixtures for parser unit tests |

---

## Recommendations

1. **Resolve open questions 1, 2, 4 before implementation starts.** Questions 3, 5, 6, 7 can be deferred to follow-up issues.
2. **Define the filmow feature package structure explicitly in the spec.** The current ambiguity ("inside `muuvie` feature or `profile` feature") will cause the implementer to make an arbitrary choice.
3. **Consider a thin `FilmowProfile` domain model** in `features/filmow/domain/` rather than coupling it to `profile_domain`. Filmow data is conceptually import/migration data, not core profile data.
4. **Backend: log parse failures with full HTML context** (truncated) at `WARN` level so scraping breakage is detectable in production without a new release.
5. **Frontend: localize the "Get Filmow Information" button label and all error messages** via the existing `AppLocalizations` infrastructure — this is required by `rules/frontend/localization.md`.

---

## Cross-Repo Impact Assessment

| Repo | Impact | Notes |
|------|--------|-------|
| `muuvie` (Flutter) | Moderate | New `features/filmow/` package, new `filmow_webview/` sub-module in `ui/profile`, `webview_flutter` dependency, button on profile screen, DI registration, localization strings |
| `backend` (Kotlin/Ktor) | Moderate | New route, use case, datasource, repository, DTOs, Jsoup dependency, named Koin `HttpClient`, JWT validation on new endpoint |
| `MuuvieAi` (meta) | Low | Submodule ref bumps after both PRs merge; no structural meta-repo changes |

Both repos must land before the MuuvieAi submodule ref bump. Backend should be implemented and merged first so the frontend can validate against the real endpoint during QA.
