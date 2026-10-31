# App shell

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

What every session shares: launch, the bottom bar with five tabs, the login gate on tabs, deep links, the WebSocket that keeps screens live, and push registration and taps. Lives in `muuvie/lib/routes`, `muuvie/lib/push`, `muuvie/lib/firebase` and `muuvie/core/lib/websocket`; backend side is `WebSocketRouting.kt`, the device endpoints and `SocialNotifierImpl`.

## Sub-features
- **tabs:** Perfil (`l10n:profile`) · Social (`l10n:navAtts`, the code calls it Atts) · Programação (`l10n:navProgramacao`) · Catálogo (`l10n:navCatalogo`) · Notícias (`l10n:navNoticias`), in that order. Perfil, Social and Catálogo need an account: tapping one logged out opens login (`AuthGate.check`) and the tab only switches if login succeeds. Catálogo hides the shell app bar.
- **launch-tab:** logged in opens Perfil (index 0); logged out opens Programação (index 2). When the session ends (logout, or a refresh token the server rejects) on a gated tab, the shell jumps to Programação.
- **social-app-bar:** Social's root has two actions: Seguindo e seguidores (`l10n:attsFollowsAction`, opens `FollowsRoute`) and Sussurros (`l10n:attsWhispers`) with a badge of conversations with unread messages (`l10n:attsWhispersUnread`). Badge = `GET /users/me/unread-count` once, then the `unread` WebSocket event, and reloaded on return from Sussurros.
- **import-banner:** while the session profile says `isScraping` (an import is pending/reading/importing) a banner sits under the app bar: "Importing data..." / "Filmow", hardcoded English, not l10n. When an `import_progress` with status `done` arrives, a snackbar "Sua importação do Filmow terminou" (`l10n:importFinishedSnack`) with "Ver relatório" (`l10n:importSeeReport`) opens the job report.
- **first-run intro:** after the first frame the shell pushes the intro once per install (see [onboarding](onboarding.md)).
- **app-bar titles:** pushed screens inside a tab put their own title and a back arrow in the shell app bar (`route_title_resolver.dart`).
- **deep links:** `https://muuvie.app/@handle` → public profile, `/m/<slug>` → maratona, `/c/<slug>` → CineClube, each pushed over `MainRoute` so back returns to the app (`profileDeepLink`). Anything else takes the default path.
- **websocket:** at launch the app trades its JWT for a 30 s single-use nonce (`POST /ws/token`), then opens `WS /ws` with the nonce in the `Authorization` header (raw, no `Bearer`). Any failure or close retries every 5 s, forever.
- **push:** Firebase is on only when the build has its config (never on web). Once the session profile arrives the app asks for notification permission, then `PUT /users/me/devices` with platform, FCM token and locale; again on token refresh. Logout calls `DELETE /users/me/devices?token=` and deletes the FCM token first (`LogoutWithPush`). With the app in the foreground no push is shown; the WebSocket updates the screen. A tapped push opens the screen from `pushRoute` (table below).

### Events: WebSocket and push
Built from `Notification.kt` (`SocialEvent`), `ImportJobRunner.kt`, `ws_message.dart` and `push_route.dart`. "WS ignored" means `WsMessageType.unknown` or no listener.

| Event | Sent by | Push (pref) | App on WS | App on push tap | Page |
|---|---|---|---|---|---|
| `import_progress` | every job change | never | progress on the job screen; banner on/off; refetch `GET /profile` and snackbar on `done` | n/a | [imports](imports.md) |
| `import_updated` | job reaches preview, done or failed | always, no pref | WS ignored | `ImportJobRoute(jobId)`, else `ImportStartRoute` | [imports](imports.md) |
| `message` | new Sussurro; also the sender's own, to their other sessions (never pushed) | `messages`, not system msgs | live list and thread | `ConversationRoute(senderId)` | [whispers](whispers.md) |
| `unread` | badge count changed | never | Sussurros badge | n/a | [whispers](whispers.md) |
| `new_follower` | someone follows you | `newFollowers` | WS ignored | follower's `PublicProfileRoute` | [follows](follows.md) |
| `activity_loved` | someone loves your activity | `loves` | WS ignored | lover's `PublicProfileRoute` | [social-feed](social-feed.md) |
| `watch_party` | join/leave/message/start/closed | never | watch party screen (filtered by code) | n/a | [games](games.md) |
| `maratona_started`, `maratona_finished` | hourly maratona job | `maratonas` | WS ignored | `MaratonaDetailRoute(slug)` | [maratonas](maratonas.md) |
| `cineclube_debate` | debate day | `cineclubes` | WS ignored | `CineClubeDetailRoute(slug)` | [cineclubes](cineclubes.md) |

## How to get to it (user POV)
Open the app. The bottom bar is always there; Social › people icon or envelope icon in the app bar. Deep links from the browser or another app.

## Where it lives
### App
- Routes: `MainRoute`, `ProfileTab`, `SocialTab`, `ProgramacaoTab`, `SearchTab`, `NoticiasTab`
- Shell: `muuvie/lib/routes/main_screen.dart`, `muuvie/lib/routes/main_navigation.dart` (tabs, gates, launch index), `muuvie/lib/routes/main_bloc.dart` (banner), `muuvie/lib/routes/whispers_button.dart`, `muuvie/lib/routes/route_title_resolver.dart`, `muuvie/lib/routes/app_router.dart` (`profileDeepLink`), `muuvie/android/app/src/main/AndroidManifest.xml` (link filters)
- Startup: `muuvie/lib/main.dart`, `muuvie/lib/app_initializer.dart`
- WebSocket: `muuvie/core/lib/websocket/websocket_client.dart`, `muuvie/core/lib/websocket/ws_message.dart`
- Push: `muuvie/lib/push/push_coordinator.dart`, `muuvie/lib/push/push_route.dart`, `muuvie/lib/push/logout_with_push.dart`, `muuvie/lib/firebase/firebase_bootstrap.dart`, `muuvie/lib/firebase/firebase_push_messaging.dart`, `muuvie/features/social_network/domain/lib/usecases/push_devices.dart`
- Data: `muuvie/features/social_network/data/lib/datasources/social_network_remote_data_source.dart` (devices, unread), `muuvie/features/profile/data/lib/datasources/profile_remote_data_source_impl.dart` and `muuvie/features/profile/data/lib/repositories/profile_repository_impl.dart` (session profile)
### Backend
| Endpoint | Auth | Use case |
|---|---|---|
| `POST /ws/token` | required | `backend/src/main/kotlin/org/mobyle/data/service/WsTokenManager.kt` |
| `WS /ws` | nonce | `backend/src/main/kotlin/org/mobyle/data/service/WebSocketManager.kt`, fed by `backend/src/main/kotlin/org/mobyle/data/service/SocialNotifierImpl.kt` and `backend/src/main/kotlin/org/mobyle/data/service/ImportJobRunner.kt` |
| `PUT /users/me/devices` | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/notifications/NotificationUseCases.kt` (`RegisterDevice`) |
| `DELETE /users/me/devices` | required | same file (`RemoveDevice`) |
| `GET /users/me/unread-count` | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/messages/MessageUseCases.kt` |
| `GET /profile` | required | inline in `backend/src/main/kotlin/org/mobyle/routing/ProfileRouting.kt` (counts, recent movies, `isScraping`) |
| `PUT /profile` (not called by the app) | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/profile/UpdateUserProfile.kt`; the app's `UpdateUserProfile` is registered but nothing uses it |

## Driving it
```bash
NONCE=$(curl -s -X POST localhost:8080/api/v1/ws/token -H "Authorization: Bearer $TOKEN" | jq -r .token)
websocat "ws://localhost:8080/api/v1/ws?token=$NONCE"      # within 30 s; ?token= works as well as the header
# From a second user, trigger events and watch the socket:
curl -s -X POST localhost:8080/api/v1/users/$USER_A/follow -H "Authorization: Bearer $TOKEN_B"   # new_follower
curl -s -X POST localhost:8080/api/v1/users/$USER_A/messages -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' -d '{"body":"oi"}'                                         # message + unread
# Device registration (what the app sends after permission):
curl -s -X PUT localhost:8080/api/v1/users/me/devices -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"platform":"android","token":"fake","locale":"pt_BR"}'   # 204
adb shell am start -a android.intent.action.VIEW -d "muuvie://muuvie.app/@handle"                 # deep link, no domain check
```

## Gotchas
- The session profile (`GET /profile`) is fetched once, when its repository is built at launch, and again only after an import finishes. Logging in mid-session therefore does not register push until the next launch (unless Configurações › Permitir is tapped). Tags for crashes and analytics wait for it too.
- Logging out does not close the WebSocket: it keeps delivering the previous user's events until it drops and the reconnect fails.
- Logged out, the WebSocket retries `POST /ws/token` (401) every 5 s for the whole session.
- `new_follower` and `activity_loved` are parsed by `WsMessageType` but nothing listens; maratona, CineClube and `import_updated` are not even parsed. Those events reach the user only as push. The client never sends anything; the server just logs incoming frames.
- The client uses `IOWebSocketChannel` with a header, which does not work on Flutter web.
- Push payload `data` is the event's string map plus `type`; push texts are pt/en/es by the device locale saved at registration (`PushTexts`).
- iOS has no URL scheme or associated-domain config in `muuvie/ios/Runner/Info.plist`; only Android declares the link filters. Push the route directly otherwise.
- Push needs `FCM_SERVICE_ACCOUNT` on the backend and a Firebase-configured build; drive the WebSocket instead (see README preconditions).
