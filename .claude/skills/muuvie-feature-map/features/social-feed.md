# Social feed

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

The Social tab (`SocialTab`, labeled "Social", `l10n:navAtts`; "Atts" in code): a feed of activities by me and the people I follow, with three scopes, "amei" on any visible activity and hiding my own activities from others. The same `ActivityCard` also renders a movie's Atividade tab and a maratona's progress feed. The app bar's people and envelope buttons belong to [follows](follows.md) and [whispers](whispers.md).

## Sub-features
- **scopes:** chips "Todos", "Seguindo", "Só eu" (`l10n:attsScopeAll`, `l10n:attsScopeFollowing`, `l10n:attsScopeMe`), sending `GET /feed?scope=all|following|me`. Todos is me (minus what I hid) plus the people I follow; Seguindo is only them; Só eu is mine, hidden ones included. Each scope keeps its list and scroll position, so switching back does not reload; only a scope never loaded, or one that failed, hits the server.
- **list:** 20 per page by cursor; the next page loads 600 px before the end, with a spinner row at the bottom. Pull to refresh reloads the current scope and keeps the list until the first page arrives. Loading is a spinner. Error: "Algo deu errado" / "Ocorreu um erro inesperado…" (`l10n:emptyStateErrorTitle`, `l10n:emptyStateErrorMessage`) with "Tentar novamente". Empty: "Nada por aqui ainda" (`l10n:attsEmptyTitle`) with "O que você registra, avalia e cria aparece aqui." in Só eu (`l10n:attsEmptyMe`), else "Siga pessoas para ver o que elas assistem." (`l10n:attsEmptyFollowing`).
- **card:** actor avatar and name (tap → `PublicProfileRoute`), a verb by type (`l10n:activityVerbFinished` "assistiu", `l10n:activityVerbRewatched`, `l10n:activityVerbSession`, `l10n:activityVerbRating`, `l10n:activityVerbNewShelf` "criou a estante", `l10n:activityVerbFeaturedShelf`, `l10n:activityVerbNewLocadora`, `l10n:activityVerbWatchingNow`, `l10n:activityVerbImported`, maratona, CineClube and bichinho verbs), then the object. The object opens `MovieDetailRoute`, `ShelfDetailRoute`, `LocadoraDetailRoute`, `MaratonaDetailRoute` or `CineClubeDetailRoute`. Ratings show the label, emotions, the comment (behind "Spoiler. Toque para ver", `l10n:spoilerReveal`, when it spoils) and a GIF. A footer shows the love button, an "Oculta" pill (`l10n:activityHidden`) and a lock or people icon for secret or mutual visibility (tooltip: the visibility label).
- **love:** "Amei" / "Desfazer amei" (`l10n:activityLove`, `l10n:activityUnlove`) with "N amei" (`l10n:activityLovesCount`). It flips at once with ±1 and then takes the server's `{loved, loves}`; on failure it goes back. Calls `PUT /activities/{activityId}/love` or `DELETE /activities/{activityId}/love`. The same activity is updated in every loaded scope.
- **hide (own activities):** a ⋮ "Mais opções" (`l10n:activityMoreOptions`) on my cards: "Ocultar dos outros" / "Mostrar de novo" (`l10n:activityHide`, `l10n:activityShow`) → `PUT /activities/{activityId}/hidden` with `{"hidden": true|false}`. Hiding drops the card from Todos and Seguindo, keeps it in Só eu with the "Oculta" pill, and shows the snackbar "Agora só você vê" (`l10n:activityHiddenSnack`). Showing again is silent. A failure shows `l10n:emptyStateErrorMessage`.
- **movie-activities:** `MovieActivitiesFeed` (`muuvie/ui/social/lib/feed/movie_activities_feed.dart`) is the movie detail's Atividade tab: kind chips "Avaliações" / "Atualizações" / "Tudo" and people chips "Todos" / "Seguindo" / "Só eu" (`l10n:movieActivitiesRatings`, `l10n:movieActivitiesUpdates`, `l10n:movieActivitiesEverything`, `l10n:movieActivitiesEveryone`, `l10n:movieActivitiesFollowing`, `l10n:movieActivitiesOnlyMe`). Seguindo, Só eu and loving ask for login first (`AuthGate`). Its endpoint is mapped on [movie-detail](movie-detail.md).
- **love-notification:** loving someone else's activity, the first time, notifies its author: an `activity_loved` push (per the "loves" preference) opens the lover's profile; the WebSocket copy is not listened to ([app-shell](app-shell.md)).

## How to get to it (user POV)
- Bottom bar › Social (`SocialTab`, needs login; logged out it asks to sign in).
- Filme › Atividade tab, for the per-movie feed. Maratona › progress feed ([maratonas](maratonas.md)).

## Where it lives
### App
- Routes: `SocialRoute`, the root of `SocialTab`.
- Screens and state: `muuvie/ui/social/lib/social_page.dart` (navigation), `muuvie/ui/social/lib/social_bloc.dart` (`SocialCubit`), `muuvie/ui/social/lib/social_screen.dart`, the card `muuvie/ui/social/lib/feed/activity_card.dart`, the tab's app bar in `muuvie/lib/routes/main_navigation.dart`.
- Data: `muuvie/features/social_network/data/lib/datasources/social_network_remote_data_source.dart` (`getFeed`, `setLove`, `setHidden`); use cases `GetFeed`, `ToggleActivityLove`, `HideActivity` in `muuvie/features/social_network/domain/lib/usecases/feed.dart`.
### Backend
`backend/src/main/kotlin/org/mobyle/routing/FeedRouting.kt`; use cases in `backend/src/main/kotlin/org/mobyle/domain/usecase/feed/FeedUseCases.kt`; queries in `backend/src/main/kotlin/org/mobyle/data/local/feed/ActivityDataSource.kt`; activities are written by `backend/src/main/kotlin/org/mobyle/domain/usecase/feed/ActivityPublisher.kt`.

| Endpoint | Auth | Use case |
|---|---|---|
| `GET /feed` | required | `GetFeed` (`scope` all, following or me; `cursor`; `limit` 1–50, default 20) |
| `PUT /activities/{activityId}/love` | required | `LoveActivity` → `{loved, loves}`; notifies the author |
| `DELETE /activities/{activityId}/love` | required | `UnloveActivity` |
| `PUT /activities/{activityId}/hidden` | required | `HideActivity` (204) |
| `GET /users/{userId}/activities` (not called by the app) | required for `me`, else optional | `GetProfileActivities`; the app's `GetProfileActivities` use case is registered in DI but no screen uses it |

## Driving it
```bash
H="Authorization: Bearer $TOKEN"; J="Content-Type: application/json"; A=http://localhost:8080/api/v1
curl -s -H "$H" "$A/feed?scope=all&limit=20" | jq '{next: .nextCursor, items: [.results[] | {id,type,self,hidden,loves}]}'
curl -s -H "$H" "$A/feed?scope=all&cursor=$NEXT"
curl -s -X PUT -H "$H" $A/activities/42/love            # {"loved":true,"loves":1}
curl -s -X PUT -H "$H" -H "$J" $A/activities/42/hidden -d '{"hidden":true}' -w '%{http_code}\n'   # 204, own only
```
To create activities: create a shelf or locadora, log or rate a movie ([watch-logs](watch-logs.md)), join a maratona. App: tap the Social tab, or push `SocialRoute` inside `SocialTab`.

## Gotchas
- An activity the viewer cannot see (visibility, or hidden by its author) is a 404 for love, unlove and hide; hiding someone else's is a 403 `not_activity_owner`.
- Loving is idempotent and only the first love notifies; loving your own activity never notifies.
- Editing a shelf or locadora rewrites its existing activity in place (visibility included) without bumping it; deleting it removes the activity ([shelves](shelves.md), [locadoras](locadoras.md)).
- The feed uses the cursor envelope (`results`, `nextCursor`), not page numbers; a bad `scope` is a 400.
- An activity's visibility comes from its subject (a shelf's or a locadora's, for example); the author can still hide any of their own on top of that.
