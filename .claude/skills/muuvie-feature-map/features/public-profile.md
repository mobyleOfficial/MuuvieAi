# Public profile

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

Another user's profile. `PublicProfileRoute` takes a user id or an `@handle`, and its screen is the same `MemberProfileView` as the own [profile](profile.md): the same header, shortcuts and six tabs, with `userId` set to the profile's id. This page covers what differs for a visitor and how a visitor gets there.

## Sub-features
- **load:** `GET /users/{userId}` with an id or `@handle` (optional auth). The response carries the counters as the viewer is allowed to see them, plus `isFollowing`, `followsMe`, `mutual` and `self`.
  - Loading: a spinner.
  - 404: "Perfil não encontrado" (`l10n:profileNotFound`), with no retry.
  - Other errors: `l10n:emptyStateErrorTitle` with "Tentar novamente".
- **header-actions (visitor):**
  - Follow button: Seguir / Seguir de volta / Seguindo, toggled optimistically ([follows](follows.md)).
  - "Segue você" chip (`l10n:profileFollowsYou`) when they follow you.
  - "Sussurrar" (`l10n:whisperAction`) only when the follow is mutual. It opens `ConversationRoute` ([whispers](whispers.md)).
  - Share (`l10n:profileShare`) only when they have a handle.
  - Never shown to a visitor: gear, Editar perfil, or the "escolha seu @" tip.
  - Tapping the Seguidores / Seguindo counters opens `FollowsRoute` for that user.
- **shortcuts (visitor):**
  - The "Assistindo agora" card appears only when they are watching something, and has no log button.
  - The gamification row appears only when they have a pinned pet; the chip is not tappable, and the Missões, Caderninho, Watch party and Poster game shortcuts are hidden.
- **tabs (visitor):**
  - Destaques: `GET /users/{userId}/highlights` returns only the enabled sections whose shelf or locadora the viewer can see. There is no "Editar destaques". When empty it shows "Nada aqui ainda" / "Nada em destaque ainda." (`l10n:emptyStateNoItemsTitle`, `l10n:highlightsEmptyOther`).
  - Registros: `GET /users/{userId}/logs` lists only the sessions visible to the viewer; when empty, "Nenhum registro para mostrar." (`l10n:diaryEmptyOther`).
  - Gráficos: no goal editing and no retrospective button ([stats](stats.md)).
  - Estantes: [shelves](shelves.md). Locadoras: [locadoras](locadoras.md). Participações: [profile](profile.md).
- **self:** opening your own id or handle through this route gives `self: true`, so the screen behaves as your own profile. It shows Editar perfil, the gear and the Destaques editor, and its tabs use `me`.
- **title:** the app bar shows `displayName` when the caller passed one, otherwise the `@handle` if `userId` is one, otherwise "Perfil" (`l10n:profile`). Inside a tab stack the screen has no app bar of its own; the shell's bar shows the title.

## How to get to it (user POV)
A tap on a user anywhere in the app opens this screen:
- Social feed (author, lovers), a movie's recent ratings and community, a shelf's owner, maratona and cineclube members and progress, a follows row.
- Catálogo › "Cinéfilos para seguir" (`l10n:discoverProfiles`) and the Pessoas search ([catalog-search](catalog-search.md)).
- A `new_follower` or `activity_loved` push.
- The profile link `https://muuvie.app/@handle`.

## Where it lives
### App
- Routes: `PublicProfileRoute`. It is registered in the Catálogo, Social, Programação and Notícias stacks, and at the root with the path `/:userId`. It is not in the Perfil stack.
- Deep link: `profileDeepLink` in `muuvie/lib/routes/app_router.dart` turns `/@handle` (one segment, starting with `@`) into `[MainRoute, PublicProfileRoute(userId: '@handle')]`. The push mapping is in `muuvie/lib/push/push_route.dart`. The title comes from `muuvie/lib/routes/route_title_resolver.dart`.
- Screens: `muuvie/ui/public_profile/lib/public_profile_page.dart` (`@PathParam('userId')`) and `muuvie/ui/public_profile/lib/public_profile_screen.dart`. Both delegate to `muuvie/ui/profile/lib/member/member_profile_view.dart`.
- Data: `muuvie/features/profile/data/lib/datasources/profiles_remote_data_source_impl.dart` (`getProfile`, `getHighlights`)
### Backend
| Endpoint | Auth | Use case |
|---|---|---|
| `GET /users/{userId}` | optional | `backend/src/main/kotlin/org/mobyle/domain/usecase/users/GetProfile.kt`, built by `backend/src/main/kotlin/org/mobyle/domain/usecase/users/ProfileAccess.kt` |
| `GET /users/{userId}/highlights` | optional | `backend/src/main/kotlin/org/mobyle/domain/usecase/users/GetProfileHighlights.kt` |
| `GET /users/{userId}/logs` | optional | `backend/src/main/kotlin/org/mobyle/domain/usecase/watch/GetUserDiary.kt` |

The follow endpoints are on [follows](follows.md), the charts on [stats](stats.md). `GET /discover/profiles` belongs to [catalog-search](catalog-search.md).

## Driving it
```bash
A=http://localhost:8080/api/v1
curl -s $A/users/@cinefila                                     # logged out: isFollowing=false, public counts only
curl -s -H "Authorization: Bearer $TOKEN" $A/users/@cinefila   # isFollowing/followsMe/mutual/self
curl -s $A/users/@cinefila/highlights
curl -s "$A/users/@cinefila/logs?page=1"
```
In the app, push `PublicProfileRoute(userId: '@cinefila')` or a user id. The `https://muuvie.app/@cinefila` link needs the link domain configured on the device (see the README's skip table).

## Gotchas
- Visibility: the counters, highlights, Registros and charts are all filtered through `VisibilityPolicy` by the viewer's relation to the owner. The same profile shows different numbers to the owner, a follower and a logged-out viewer.
- The `@handle` is resolved only in the first request. After that, every tab and action uses `profile.id`.
- `GET /users/{userId}` does not need a token, but following, the lists and whispering do. The profile header still shows Seguir to a logged-out viewer.
- A handle that is not found and a raw id that is not found both return 404 `not_found` (`ProfileAccess.resolveUserId`).
