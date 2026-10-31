# Block Auth Screen Feature Specification

## Overview

Unauthenticated users can browse movies and search freely, but certain tabs (Profile, Social, New Activity) and write actions (review, like, comment) must be gated behind authentication. When a user taps a blocked tab or triggers a write action, the login screen opens as a modal bottom sheet. On successful login the modal closes and the blocked action proceeds.

### Why This Matters

This is the standard freemium UX pattern: browse freely, authenticate to participate. It reduces friction for new users while protecting user-specific features behind login.

---

## User Stories

### User Story 1: Blocked Tabs
**As an** unauthenticated user
**I want to** see the login modal when I tap Profile, Social, or New Activity
**So that** I can sign in and access those features

### User Story 2: Blocked Write Actions
**As an** unauthenticated user
**I want to** see the login modal when I try to write a review, like a movie, or add a comment
**So that** I understand I need to sign in to participate

### User Story 3: Seamless Post-Login
**As a** user who just logged in via modal
**I want** the modal to close and my original action to proceed
**So that** I don't have to navigate back or re-tap the button

---

## Acceptance Criteria

### Tab Blocking
- [ ] Tapping the Social tab (index 2) when unauthenticated opens the login modal instead of navigating to the tab
- [ ] Tapping the Profile tab (index 3) when unauthenticated opens the login modal instead of navigating to the tab
- [ ] Tapping the center "New Activity" button when unauthenticated opens the login modal instead of pushing `NewUserActivityRoute`
- [ ] Home tab (index 0) and Search tab (index 1) are always accessible regardless of auth state
- [ ] After successful login via modal, the modal closes automatically
- [ ] After modal login success on a blocked tab, the user is navigated to the originally requested tab

### Write Action Blocking
- [ ] Triggering a review creation when unauthenticated opens the login modal
- [ ] Triggering a like/unlike action when unauthenticated opens the login modal
- [ ] After successful login via write-action modal, the modal closes (the user can re-trigger the action)

### Login Modal
- [ ] Login screen is presented as a modal bottom sheet using `MuuvieBottomSheet.show`
- [ ] Modal is dismissible (user can swipe down or tap outside to cancel)
- [ ] Modal uses the existing `LoginScreen` widget (no new UI)
- [ ] On successful login (`LoginAuthenticated` state), the modal pops with a `true` result
- [ ] On dismiss without login, returns `null`/`false`

### Auth State
- [ ] Auth state is checked via `IsUserAuthenticatedUseCase` (already registered in DI)
- [ ] All user-visible strings use `AppLocalizations`
- [ ] No new localization keys needed (reuses existing login strings)

---

## Technical Notes

### Architecture

This feature does NOT create new feature packages. It modifies existing files:

**Core change:** Add an `AuthGate` utility in the `common` UI package that provides a static method to check auth and show the login modal. All blocking points call this single utility.

### `AuthGate` (in `ui/common/`)

```dart
class AuthGate {
  /// Returns true if user is authenticated (or just logged in via modal).
  /// Returns false if user dismissed the modal without logging in.
  static Future<bool> check(BuildContext context) async {
    final isAuthenticated = await GetIt.I<IsUserAuthenticatedUseCase>()();
    if (isAuthenticated is Success<bool> && isAuthenticated.data) {
      return true;
    }
    // Show login modal
    final result = await MuuvieBottomSheet.show<bool>(
      context: context,
      builder: (_) => LoginModalPage(),
    );
    return result == true;
  }
}
```

### `LoginModalPage` (new file in `ui/auth/`)

A variant of `LoginPage` designed for modal context:
- No `@RoutePage()` annotation (it's not a route — it's shown via `MuuvieBottomSheet`)
- On `LoginAuthenticated`, calls `Navigator.of(context).pop(true)` instead of routing
- Wraps `LoginScreen` in a sized container suitable for bottom sheet

### Files to Modify

| File | Change |
|------|--------|
| `ui/common/lib/src/auth_gate.dart` | **NEW** — `AuthGate.check()` static utility |
| `ui/common/lib/common.dart` | Export `auth_gate.dart` |
| `ui/auth/lib/login_modal_page.dart` | **NEW** — Modal variant of LoginPage |
| `ui/auth/lib/auth.dart` | Export `login_modal_page.dart` |
| `lib/routes/main_screen.dart` | Intercept tab taps and center button with `AuthGate.check()` |
| `ui/reviews/lib/review_details/review_details_page.dart` | Guard like action with `AuthGate.check()` |
| `ui/user_activity/lib/new_user_activity/new_user_activity_screen.dart` | Guard review creation with `AuthGate.check()` |

### Main Screen Changes

In `main_screen.dart`, the `onTap` and `onCenterTap` callbacks need auth gating:

```dart
// Tab tap — guard Social (2) and Profile (3)
onTap: (index) async {
  if (index == 2 || index == 3) {
    final allowed = await AuthGate.check(context);
    if (!allowed) return;
  }
  tabsRouter.setActiveIndex(index);
},

// Center button — guard New Activity
onCenterTap: () async {
  final allowed = await AuthGate.check(context);
  if (!allowed) return;
  context.router.root.push(const NewUserActivityRoute());
},
```

### Dependencies

- `ui/common` pubspec needs `auth_ui` and `auth` as path dependencies (for `AuthGate` to access `IsUserAuthenticatedUseCase` and `LoginModalPage`)
- Main app already depends on `auth`, `auth_ui`, and `common`

---

## Cross-Repo Impact

- **Frontend only** — no backend changes
- Touches shared `common` package (new utility) and `main_screen.dart` (tab gating)
- Write action gating touches `reviews` and `user_activity` UI modules

---

## Out of Scope

- Token refresh / expiry during a session
- Blocking read-only actions (movie detail, search)
- Showing a "sign in to continue" snackbar instead of modal
- Deep link auth gating

---

## Open Questions

1. After successful modal login on a blocked tab, should the tab navigate automatically or should the user tap again?
2. Should the like button show a visual indicator (disabled state / lock icon) when unauthenticated, or just intercept the tap?
