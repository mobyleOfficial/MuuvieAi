# Block Auth Screen — Architecture Review

**Spec:** `research/specs/block-auth-screen.md`
**Date:** 2026-05-19
**Decision:** APPROVED

---

## Review Summary

The spec proposes a lightweight `AuthGate` utility in the `common` package that guards tabs and write actions with a login modal. No new feature packages, no domain layer changes. Clean integration with existing `MuuvieBottomSheet`, `LoginScreen`, and `IsUserAuthenticatedUseCase`.

---

## Criterion-by-Criterion Review

### 1. Architecture Alignment — PASS
- No new feature packages — modifies existing UI layer only
- `AuthGate` as a static utility in `common` is the right location (shared across all UI modules)
- `LoginModalPage` follows the Page/Screen split: Page owns cubit lifecycle, delegates to existing `LoginScreen`

### 2. Ecosystem Fit — PASS
- Reuses existing `MuuvieBottomSheet.show` for modal presentation
- Reuses existing `LoginScreen` for UI
- Uses `IsUserAuthenticatedUseCase` already in DI

### 3. Submodule Boundaries — PASS
- All changes in `muuvie/` submodule only
- No cross-submodule dependencies

### 4. Feasibility — PASS
- `onTap` callback on bottom nav is already a function — wrapping with async auth check is trivial
- Write action interception at the page level is straightforward

### 5. Dependencies — PASS with note
- `common` package needs new path dependencies on `auth` and `auth_ui` and `core` for `AuthGate` to resolve the use case
- This creates a dependency from `common` → `auth`, which is acceptable since `common` is the shared UI utilities package

### 6. Security — PASS
- Auth check happens via use case (reads local token) — no network call needed
- Modal can't be bypassed since the tab/action callback is intercepted before navigation

### 7. Performance — PASS
- `IsUserAuthenticatedUseCase` reads local secure storage — sub-100ms
- No network overhead for the gate check

### 8. Testing — PASS
- `AuthGate` is testable with mock use case
- Tab blocking testable via widget tests on `MainScreen`

---

## Recommendations

1. **Implementation order:** `LoginModalPage` → `AuthGate` → `main_screen.dart` tab gating → write action gating → tests
2. **Post-login tab navigation:** After modal login on a blocked tab, auto-navigate to the requested tab (better UX than requiring a re-tap)
3. **Like button:** Intercept the tap silently (no visual lock icon) — keep it simple for this iteration

---

## Blockers

None.
