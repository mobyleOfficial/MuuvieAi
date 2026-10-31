# Games

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

Two light games, each a full-screen modal: the watch party (`l10n:partyTitle` "Sessão sincronizada"), a room where friends press play together after a shared countdown and chat, kept in the backend's memory and refreshed over the WebSocket; and the solo poster game (`l10n:posterGameTitle` "Jogo do Pôster"), guessing a movie from a poster that sharpens over time. Both are opened from the own profile's gamification row (see [gamification](gamification.md)); the watch party also from a movie.

## Sub-features
- **party lobby:** `l10n:partyIntro`; create with an optional `l10n:partyFieldTitle` "O que vocês vão assistir?" (≤ 100; when opened from a movie the movie is attached and the title may stay empty) via `l10n:partyCreate` "Criar uma sala"; or join with a 6-character `l10n:partyFieldCode` via `l10n:partyJoin` "Entrar com um código". Errors under the form: 404 → `l10n:partyNotFound` "Nenhuma sala com esse código.", 409 → `l10n:partyFull` "Esta sala está cheia.", else `l10n:maratonaActionError`.
- **party room:** the code large (`l10n:partyCodeLabel`) with `l10n:partyCopyCode` (snack `l10n:partyCodeCopied`), `l10n:partyMembers` "{count} pessoas na sala", the countdown and the chat.
- **countdown:** only the host sees `l10n:partyStart` "Começar a contagem" (`l10n:partyRestart` once set), picking 10, 30, 60 or 300 s (`l10n:partyStartIn`) in a bottom sheet. Before it: `l10n:partyWaitingHost` (host) / `l10n:partyWaiting` (guests). During it: `l10n:partySecondsLeft`, ticking every 250 ms against the server clock (the app corrects for the offset from `serverTime`). At zero: `l10n:partyPlay` "Play!".
- **chat:** `l10n:partyMessageHint` "Diga alguma coisa" (≤ 500), `l10n:partySend`; empty: `l10n:partyNoMessages`. The room keeps the last 100 messages.
- **live updates:** every join, leave, start and message sends the other members a `watch_party` WebSocket event `{code, event}` (`join`, `leave`, `start`, `message`, `closed`); the app re-reads the room on each, and shows `l10n:partyClosed` "A sala foi fechada" on `closed` or when the re-read answers 404/403.
- **leave:** closing the modal leaves the room. The host leaving, or the last member, closes the room for everyone.
- **poster round:** score `l10n:posterGameScore` "{points} pontos" and `l10n:posterGameStreak` "Sequência: {count}"; a blurred poster (`l10n:posterGameHint`) that goes from blur 24 to sharp in 12 s; `l10n:posterGameQuestion` "Que filme é esse?" with 4 options. A right answer scores `round(100 × (1 − 0.8 × clarity))` (100 at once, 20 when fully sharp) and extends the streak; a wrong one scores 0, resets the streak and shows `l10n:posterGameWrong` "Era {title}". `l10n:posterGameRight` "Acertou!", then `l10n:posterGameNext` "Próximo pôster". Error state with retry.

## How to get to it (user POV)
Perfil (own) › row › "Sessão sincronizada" or "Jogo do Pôster". Also Filme › action sheet › `l10n:movieDetailWatchParty` "Sessão sincronizada" (room for that movie). Guests get the code out of band and type it in the lobby.

## Where it lives
### App
- Routes: `WatchPartyRoute` (`code`, `movieId`, `movieTitle`, all optional), `PosterGameRoute` (root-level `CustomRoute`s, slide from bottom)
- Screens and state: `muuvie/ui/gamification/lib/party` (`watch_party_page.dart`, `watch_party_screen.dart`, `watch_party_bloc.dart`, `watch_party_state.dart`), `muuvie/ui/gamification/lib/poster` (`poster_game_page.dart`, `poster_game_screen.dart`, `poster_game_bloc.dart`, `poster_game_state.dart`)
- Data: `muuvie/features/gamification/data/lib/datasources/gamification_remote_data_source.dart`; the event stream in `muuvie/features/gamification/data/lib/repositories/gamification_repository_impl.dart` (`partyEvents`, filtered by code in `WatchPartyActions.events`); event type in `muuvie/core/lib/websocket/ws_message.dart`
- Entry points: `muuvie/ui/gamification/lib/widgets/profile_gamification_row.dart`, `muuvie/lib/routes/app_movie_detail_links.dart` (`startWatchParty`)
### Backend
Handlers in `backend/src/main/kotlin/org/mobyle/routing/GamesRouting.kt`; use cases in `backend/src/main/kotlin/org/mobyle/domain/usecase/games/WatchPartyUseCases.kt`.

| Endpoint | Auth | Use case |
|---|---|---|
| `POST /watch-parties` | required | `WatchParties.create` (201; `{title?, movieId?}`) |
| `GET /watch-parties/{code}` | required, member | `WatchParties.get` |
| `POST /watch-parties/{code}/members` | required | `WatchParties.join` |
| `DELETE /watch-parties/{code}/members/me` | required | `WatchParties.leave` (204) |
| `POST /watch-parties/{code}/start` | required, host | `WatchParties.schedule` (`{inSeconds}` 5–3600) |
| `POST /watch-parties/{code}/messages` | required, member | `WatchParties.send` (`{body}`) |
| `GET /games/poster/round` | none | `GetPosterRound` |
| `WS /ws` (event `watch_party`) | token | `SocialEvent.WatchPartyChanged` in `backend/src/main/kotlin/org/mobyle/domain/model/Notification.kt`; socket owned by [app-shell](app-shell.md) |

## Driving it
```bash
API=http://localhost:8080/api/v1; J='Content-Type: application/json'
CODE=$(curl -s -X POST $API/watch-parties -H "Authorization: Bearer $TOKEN" -H "$J" -d '{"title":"Casablanca"}' | jq -r .code)
curl -s -X POST $API/watch-parties/$CODE/members -H "Authorization: Bearer $TOKEN2"
curl -s -X POST $API/watch-parties/$CODE/start -H "Authorization: Bearer $TOKEN" -H "$J" -d '{"inSeconds":30}'
curl -s -X POST $API/watch-parties/$CODE/messages -H "Authorization: Bearer $TOKEN2" -H "$J" -d '{"body":"pronto"}'
curl -s $API/games/poster/round    # {movie, options[4]}: the answer is in the payload
```
Watch the second user's `WS /ws` to see the `watch_party` events. App: push `WatchPartyRoute()` or `PosterGameRoute()` on the root router.

## Gotchas
- Rooms live in memory on one backend instance: a restart loses them, and they expire 6 hours after creation. Max 30 members.
- `GET /watch-parties/{code}` is 403 `not_in_party` until you `POST .../members`; the app always joins first. Codes are 6 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, case-insensitive (the app upper-cases).
- `watch_party` is WebSocket only, never a push, and the sender does not get its own event. Without a socket the room only refreshes on the user's own actions.
- `WatchPartyRoute(code: …)` would auto-join, but nothing in the app passes a code: no share link or deep link exists.
- A party needs a title or a movie (400 otherwise); an unknown `movieId` is a 404.
- The poster game is client-scored and in memory: no endpoint stores scores, and the round includes the right answer. Rounds come from TMDB trending pages 1–5 (needs `TMDB_API_KEY`); fewer than 4 movies with posters is a 404.
