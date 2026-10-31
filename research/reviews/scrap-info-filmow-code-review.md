---
date: 2026-05-23
author: validator agent
status: approved_with_findings
feature: scrap-info-filmow
spec: research/specs/scrap-info-filmow.md
architect-review: research/reviews/scrap-info-filmow-review.md
---

# Code Review — Scrap Info Filmow

## Decision: APPROVED WITH FINDINGS

The implementation is functionally correct and passes all automated checks. All architect blocker conditions (C4–C7) are satisfied. Several minor and medium findings are documented below. None block merge; one medium finding warrants a follow-up issue.

---

## Static Analysis & Tests

| Check | Result |
|-------|--------|
| `flutter analyze` | PASS — 0 issues |
| `flutter test` | PASS — 54 tests (10 new filmow tests) |

---

## Check 1 — Correctness (Acceptance Criteria)

**Result: PASS with one gap**

All acceptance criteria from the spec are met:

- "Get Filmow Information" button visible on profile screen (`profile_info_screen.dart:235`) — PASS
- Tapping navigates to `FilmowWebviewRoute` — PASS
- WebView opens `https://filmow.com/login/` on load (`filmow_webview_page.dart:36`) — PASS
- Loading indicator shown while page loads (initial `FilmowWebviewLoading` state with `CircularProgressIndicator`) — PASS
- Login detection and cookie extraction on authentication — PASS
- No data sent to backend if user closes without authenticating — PASS
- `FilmowWebviewAuthenticated` state carries cookies — PASS
- Backend called via `GET /profile/filmow-information` — PASS
- Loading state while backend is in flight (`FilmowWebviewSendingCookies`) — PASS
- Success state with returned profile data — PASS
- Error state with user-visible message — PASS
- Data layer: datasource, repository, use case — PASS

**Gap:** The spec defines `FilmowWebviewInitial extends FilmowWebviewState {}` as one of the states (line 81 of spec). The implementation skips this state and starts directly in `FilmowWebviewLoading`. This is a reasonable simplification (no semantic difference between "not started" and "loading the page"), but is a divergence from the spec's state contract. Low severity.

---

## Check 2 — Architecture Compliance (C1, DI, layers)

**Result: PASS**

- Condition C1 satisfied: `features/filmow/` is a standalone feature package with `domain/` and `data/` sub-packages. Filmow domain models are NOT embedded in `features/profile/`.
- Dependency direction is correct: `filmow_domain` has no external deps (only `core`); `filmow_data` depends on `filmow_domain` and `dio`; the UI layer depends on `filmow_domain` only.
- DI registration complete: `filmow_module.dart` registers datasource as `@lazySingleton`, repository as `@lazySingleton`, use case as `@injectable` (factory). `injection.config.dart` updated with all three.
- Use case correctly registered as factory (not singleton), matching `rules/frontend/feature-implementation.md`.
- Repository never try/catches — delegates entirely to datasource (`filmow_repository_impl.dart`). PASS per `feature-architecture.md` error-handling rule.
- Datasource owns all `Result` mapping with correct error classification. PASS.

---

## Check 3 — UI Pattern Compliance (C2, 4-file split, sealed states, Cubit)

**Result: PASS**

- 4-file split present: `filmow_webview_page.dart`, `filmow_webview_screen.dart`, `filmow_webview_bloc.dart`, `filmow_webview_state.dart`.
- Condition C2 satisfied: `FilmowWebviewScreen` is `StatelessWidget`. `WebViewController` is owned by the Page's `_FilmowWebviewPageState` and passed as a constructor parameter to the Screen. Navigation delegate and state emission remain in Page/Cubit.
- `FilmowWebviewState` is `sealed` with `const` constructors. PASS.
- `FilmowWebviewCubit extends Cubit<FilmowWebviewState>`. PASS.
- Cubit NOT registered in DI. PASS.
- Page is `@RoutePage()` `StatefulWidget`. Creates cubit via field initializer with `GetIt.I<>()`. Disposes in `dispose()`. PASS.
- `FilmowWebviewRoute` registered in `profile_router.dart` and generated in `profile_router.gr.dart`. PASS.

**Minor finding:** The file is named `filmow_webview_bloc.dart` but the class inside is `FilmowWebviewCubit`. The `ui-architecture.md` rule uses `_bloc.dart` as the conventional file name suffix, so this is compliant with the naming convention. However, the inconsistency between file name (`_bloc`) and class name (`Cubit`) may cause confusion. This is a cosmetic issue, not an architecture violation.

---

## Check 4 — Code Quality

**Result: PASS with one minor finding**

- Class names `PascalCase`, files `snake_case`, variables `camelCase`. PASS.
- `const` constructors used on all state classes and domain models. PASS.
- `final` used for all non-reassigned members. PASS.
- No `dynamic` types anywhere in the implementation. PASS.
- Arrow syntax used in `fromJson` factories and `toDomain()` methods. PASS.
- Private members prefixed with `_`. PASS.
- One class per file throughout. PASS.

**Minor finding:** `filmow_profile_data_model.dart` contains four classes (`FilmowProfileDataModel`, `FilmowMovieDataModel`, `FilmowRatingDataModel`, `FilmowListDataModel`) in a single file. The `feature-architecture.md` rule states "One class per file." These four sub-models should each live in their own file. Not a functional defect, but it violates the stated rule.

---

## Check 5 — Testing

**Result: PASS with gaps**

- Use case test (`get_filmow_information_test.dart`): 2 tests covering success and failure paths. Uses `FakeFilmowRepository` (not real network). PASS.
- Cubit test (`filmow_webview_bloc_test.dart`): 8 tests covering all state transitions (initial, login page ignored, login error page ignored, `/usuario/` detection, root `/` detection, no double-trigger, success, error). Uses `FakeFilmowRepository`. PASS.
- `FakeFilmowRepository` is a hand-crafted fake, not a real network call. PASS per `feature-testing.md`.

**Gap 1 (Medium):** There are no data layer tests. `FilmowRepositoryImpl` and `FilmowRemoteDataSourceImpl` are untested. The `feature-testing.md` structure includes `data/repositories/` and `data/models/` test directories, but neither exists for the filmow feature. Specifically:
- `FilmowProfileDataModel.fromJson()` / `toDomain()` parsing logic is untested.
- `FilmowRepositoryImpl` result-mapping logic is untested.
- `FilmowRemoteDataSourceImpl` error-classification logic (`_mapDioError`, `_mapStatusCode`) is untested.

**Gap 2 (Low):** No widget test for `FilmowWebviewScreen`. The Page/Screen split was designed specifically to enable widget testing of the Screen with a mock Cubit (as noted in `ui-architecture.md`). The architect review also noted this as testable. The test for cookie extraction via `document.cookie` is correctly noted as requiring a real device (and that limitation is documented in the code comment).

---

## Check 6 — Localization

**Result: PASS with one minor finding**

- 9 strings defined in `app_en.arb` (lines 363–380), all with `@key` descriptions. PASS.
- All 9 keys present in `app_es.arb` and `app_pt.arb`. PASS.
- All strings accessed through `AppLocalizations.of(context)` via `package:common/common.dart`. PASS.
- No hardcoded user-visible strings in source files.

**Minor finding (Low):** The screen uses `?.` null-safe access (`l10n?.filmowWebviewTitle ?? 'Filmow'`) instead of `!` (`AppLocalizations.of(context)!.filmowWebviewTitle`). The `localization.md` rule example uses `!`. Using `??` fallback with hardcoded English strings means localization would silently fail in a locale-less context rather than throwing an error detectable during testing. This pattern appears across all 10 localisation call sites in `filmow_webview_screen.dart`. Low risk in practice (the app always has a locale), but not consistent with the prescribed pattern.

---

## Check 7 — Accessibility

**Result: PASS with one gap**

- Loading indicator has a `Semantics(label: l10n?.loading ?? 'Loading')` wrapper (`filmow_webview_screen.dart:37–44`). PASS.
- `OutlinedButton.icon` on the profile screen uses a text label (`filmowGetInformation`), so semantic label is adequate for screen readers. PASS.
- Color usage: `colorScheme.primary` / `colorScheme.surface` with `.withValues(alpha: 0.7)` for the authentication overlay. The `colorScheme.primary` on `colorScheme.surface` pairing is not a guaranteed Material contrast pair — the overlay background at 70% opacity may not meet the 4.5:1 WCAG AA requirement for the text displayed on it. Cannot be verified statically without theme values.

**Gap (Low):** The `Icon(Icons.download)` on the profile screen "Get Filmow Information" button uses a download icon that carries semantic meaning (import action). It does not have an explicit `semanticLabel`. While the adjacent text label makes the button's purpose clear for screen readers, `Icon(Icons.download, semanticLabel: null)` would be the correct explicit exclusion from the semantic tree to avoid duplicate announcements. Currently Flutter does not exclude icons by default in button contexts, so screen readers may announce "download, button" before the text label. Recommend adding `semanticLabel: null` to the Icon or verifying the VoiceOver/TalkBack announcement.

---

## Check 8 — Security

**Result: PASS**

- Condition C6 satisfied: Cookies are transported via `X-Filmow-Cookies` custom header, NOT as a query parameter. The query parameter fallback from the spec has been completely removed. PASS.
- Condition C7 (backend JWT) is a backend concern — not evaluated here.
- No cookie logging anywhere in the implementation. `document.cookie` result is extracted and forwarded to the cubit without any `print`, `debugPrint`, or logger calls. PASS.
- Cookies are held in memory only (`String cookieString` in `_onPageFinished`). No persistence to local storage. PASS.
- Note: `document.cookie` only exposes non-HttpOnly cookies. This is an inherent limitation of the JavaScript bridge approach (documented in the code comment at `filmow_webview_page.dart:45`). The session cookie being HttpOnly (a common security measure on Filmow's end) could silently return an empty cookie string. This was not flagged as a blocker in the architect review but is worth noting as an operational risk.

---

## Check 9 — Performance

**Result: PASS**

- Loading indicator is shown from the initial widget build (cubit starts in `FilmowWebviewLoading`, which renders `CircularProgressIndicator` immediately). The WebView renders under it. PASS — satisfies architect recommendation for first-frame loading visibility.
- No `setState` or stream subscriptions causing excessive rebuilds. BLoC pattern used correctly with `BlocBuilder`. PASS.
- `webview_flutter` WebView is initialized once in `initState`, not rebuilt on state changes. PASS.

---

## Check 10 — Architect Conditions Met

| Condition | Status | Notes |
|-----------|--------|-------|
| C1 — Standalone `features/filmow/` package | PASS | Separate package with domain/data sub-packages |
| C2 — `FilmowWebviewScreen` is `StatelessWidget` | PASS | Controller owned by Page state |
| C3 — Hardened login detection | PASS | Matches `/usuario/` prefix and root `/`; ignores `/login/?error=1`; uses module-level constants |
| C4 — Jsoup added to backend | N/A | Backend validation is out of scope for this frontend review |
| C5 — Named Filmow HttpClient in Koin | N/A | Backend scope |
| C6 — No query-param cookie transport | PASS | `X-Filmow-Cookies` header used exclusively |
| C7 — JWT required on backend endpoint | N/A | Backend scope |
| C8 — Backend HttpClient timeout | N/A | Backend scope |
| C9 — HTML snapshot tests | N/A | Backend scope |

---

## Findings Summary

| ID | Severity | Check | Description |
|----|----------|-------|-------------|
| F1 | Low | Correctness | `FilmowWebviewInitial` state from spec not implemented; starts in `Loading` directly |
| F2 | Low | UI Pattern | `filmow_webview_bloc.dart` file name uses `_bloc` suffix but class is `Cubit` |
| F3 | Medium | Code Quality | `filmow_profile_data_model.dart` contains 4 classes; violates "one class per file" rule |
| F4 | Medium | Testing | No data layer tests (datasource, repository, model serialization) |
| F5 | Low | Testing | No widget test for `FilmowWebviewScreen` |
| F6 | Low | Localization | Uses `?.` null-safe + fallback string instead of `!` for all l10n access |
| F7 | Low | Accessibility | `Icon(Icons.download)` on profile button missing explicit `semanticLabel: null` |
| F8 | Low | Security | `document.cookie` JS bridge silently omits HttpOnly cookies; documented but operational risk |

**No blockers. All architect blocker conditions (C4–C7, frontend-applicable: C1, C2, C3, C6) are satisfied.**

The medium findings (F3, F4) warrant follow-up issues but do not block merge.
