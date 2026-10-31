# Follows

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

Covers following and unfollowing a user, and the Seguidores / Seguindo lists of any profile. The follow button sits in a profile header ([public-profile](public-profile.md)) and on every row of `FollowsRoute`. The lists open from a profile's counters, or from the Social tab's app bar for the current user.

## Sub-features
- **follow-button:** `FollowButton` has three looks:
  - "Seguir" (`l10n:followLabel`), filled with the profile's accent on a header.
  - "Seguir de volta" (`l10n:followBackLabel`) when the other user already follows you.
  - "Seguindo" (`l10n:followingLabel`), outlined; tapping it unfollows straight away, with no confirmation.

  A tap sends `POST /users/{userId}/follow` or `DELETE /users/{userId}/follow`. Both answer the new `FollowStatus` (`following`, `followedBy`, `mutual`), and the app adopts it.
  - **Profile header:** the update is optimistic. The button flips and Seguidores changes by ±1 while the button waits. On failure the old state comes back and a snackbar appears.
  - **List row:** only that row's button waits (no optimistic flip). The new status is then applied to the user in both lists.
  - **Errors:** a 429 shows "Muitos follows seguidos. Tente de novo em um minuto." (`l10n:followRateLimited`); anything else shows "Não deu para atualizar o follow" (`l10n:followError`).
- **follows-you:** a "Segue você" chip (`l10n:profileFollowsYou`) appears on a profile header and in a row's subtitle (`@handle · Segue você`) whenever the other user follows the viewer.
- **lists:** `FollowsRoute` has two tabs, Seguidores and Seguindo (`l10n:profileFollowersTitle`, `l10n:profileFollowingTitle`). The tab that opens is the counter that was tapped (`initialList`). The app bar title is the profile's name.
  - Loading: both lists load at once, 30 per page. More loads 400 px before the end; pull to refresh works per tab.
  - Rows: avatar, name, `@handle` and the follow button, except your own row, which has no button. A tap opens [public-profile](public-profile.md).
  - Empty: "Nada aqui ainda" (`l10n:emptyStateNoItemsTitle`) with "Ainda sem seguidores." or "Ainda não segue ninguém." (`l10n:followsEmptyFollowers`, `l10n:followsEmptyFollowing`).
  - Error: `l10n:emptyStateErrorTitle` and a retry button.
- **mutual-side-effects:** following back someone who follows you, or unfollowing a mutual, adds a system message to an existing conversation between you. That conversation becomes writable or read-only ([whispers](whispers.md)). Whispering ("Sussurrar", `l10n:whisperAction`) is offered on a profile only to mutuals.
- **new-follower:** a new follow notifies the followed user. The push `new_follower` opens the follower's `PublicProfileRoute` ([app-shell](app-shell.md)).

## How to get to it (user POV)
- Perfil › tap Seguidores or Seguindo in the counters.
- Any profile › Seguidores / Seguindo, or the Seguir button.
- Social tab (`l10n:navAtts`) › people icon "Seguindo e seguidores" (`l10n:attsFollowsAction`): your own lists, with that text as the title.

## Where it lives
### App
- Routes: `FollowsRoute`. It is registered in the Perfil, Catálogo, Social and Programação stacks and at the root.
- Screens and state:
  - `muuvie/ui/profile/lib/follows`: page, `FollowsCubit`, screen, `followErrorMessage`
  - The button: `muuvie/ui/profile/lib/follows/follow_button.dart`
  - The header toggle: `MemberProfileCubit.toggleFollow` in `muuvie/ui/profile/lib/member/member_profile_bloc.dart`
  - The Social tab entry: `muuvie/lib/routes/main_navigation.dart`
- Data: `muuvie/features/social_network/data/lib/datasources/social_network_remote_data_source.dart`, through the use cases `SetFollowing` and `GetFollowList` (`muuvie/features/social_network/domain/lib/usecases/follows.dart`)
### Backend
All endpoints are in `backend/src/main/kotlin/org/mobyle/routing/SocialRouting.kt`.

| Endpoint | Auth | Use case |
|---|---|---|
| `POST /users/{userId}/follow` | required | `FollowAccount` in `backend/src/main/kotlin/org/mobyle/domain/usecase/follow/FollowUseCases.kt` |
| `DELETE /users/{userId}/follow` | required | `UnfollowAccount` (same file) |
| `GET /users/{userId}/followers` | required | `GetFollowList.followers` (same file); handles `me` itself |
| `GET /users/{userId}/following` | required | `GetFollowList.following` |
| `GET /users/me/following` | required | `GetFollowList.following`. The app calls `/users/me/following` for your own Seguindo tab, and this literal route wins over `{userId}` |
| `GET /users/{userId}/follow-status` | required | `GetFollowStatus`; called only by [whispers](whispers.md) to decide whether the conversation input is enabled |
| `GET /users/me/followers/recent` (not called by the app) | required | `GetFollowList.followers` for the caller |
| `GET /users/search` (not called by the app) | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/social/SearchUsers.kt`. A `q` under 2 characters returns `[]`. The app's people search uses `GET /discover/profiles` ([catalog-search](catalog-search.md)) |

## Driving it
```bash
H="Authorization: Bearer $TOKEN"; A=http://localhost:8080/api/v1
curl -s -X POST -H "$H" $A/users/@cinefila/follow      # {"following":true,"followedBy":…,"mutual":…}
curl -s -X DELETE -H "$H" $A/users/@cinefila/follow
curl -s -H "$H" "$A/users/me/followers?page=1&limit=30"
curl -s -H "$H" "$A/users/@cinefila/following?page=1&limit=30"   # results[].isFollowing/followsMe/mutual/self
```
In the app, push `FollowsRoute(userId: 'me', profileName: 'X', initialList: FollowList.following)`.

## Gotchas
- `{userId}` takes an id or an `@handle` on follow and unfollow, and on the lists, where `/followers` also takes `me`. `/users/{userId}/following` with `me` would 404 (`resolveUserId("me")`); only the literal `GET /users/me/following` route makes your own Seguindo tab work.
- Follow and unfollow are idempotent. Following an account you already follow returns the current status without using up a rate-limit slot. The limit is 10 new follows per minute per user (429 `rate_limited`). Following yourself is a 400; the app never offers it.
- Both lists need a token, even though the profile itself (`GET /users/{userId}`) is optional-auth.
- Each row's `self` flag hides its button, so your own row in someone else's list cannot be "followed".
- The follower count on a profile header refreshes only when that profile comes back into view; the list screen does not update it directly.
