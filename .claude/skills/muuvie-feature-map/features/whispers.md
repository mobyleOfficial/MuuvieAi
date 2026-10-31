# Whispers

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

Sussurros: one-to-one text conversations between mutuals (two users who follow each other). Covers the unread badge in the Social tab's app bar, the conversation list, a conversation thread, starting one from a profile, and the system messages that close or reopen a conversation when the follow changes. Messages arrive live on the WebSocket. Push devices are in [app-shell](app-shell.md) and the message preference in [settings](settings.md).

## Sub-features
- **badge:** the envelope button in the Social tab's app bar (`WhispersButton`). The badge counts conversations with something unread; the tooltip is "Sussurros" or "Sussurros, {count} não lidos" (`l10n:attsWhispers`, `l10n:attsWhispersUnread`). The count comes from `GET /users/me/unread-count` when the button is built and again after returning from the list, and from every `unread` WebSocket event in between.
- **list:** `WhispersRoute`, titled "Sussurros". It loads `GET /conversations` (30 per page by cursor, latest message first; more 400 px before the end; pull to refresh). Each row has the avatar, name, the last message ("Você: {body}" for mine, `l10n:whisperYou`; a system message in its l10n text), and, when unread, bold text plus a count badge (semantics "N não lidas", `l10n:whisperUnread`). Empty: "Nenhum sussurro ainda" / "Mande um sussurro pelo perfil de quem segue você de volta." (`l10n:whispersEmptyTitle`, `l10n:whispersEmptyMessage`). Error: `l10n:emptyStateErrorTitle` with a retry.
  - Live: a `message` event moves its conversation to the top, bumps its unread count when it came from the other member, and closes or reopens it on a system code. A message for a conversation not in the list reloads the list. Opening a row zeroes its unread locally; the list reloads on the way back.
- **thread:** `ConversationRoute(userId, name, conversationId?)`, titled with the name. With an id it loads `GET /conversations/{conversationId}`; from a profile (no id) it loads `GET /users/{userId}/conversation`. Then `GET /conversations/{conversationId}/messages` (newest first, 30 per page, older ones 300 px before the top of a reversed list). If there were unread messages it sends `PUT /conversations/{conversationId}/read`, and again for each message the other member sends while the screen is open.
  - Never talked (404 from the profile path): an empty thread "Diga oi para {name}" (`l10n:whisperStart`). Whether the composer shows comes from `GET /users/{userId}/follow-status` (`mutual`, see [follows](follows.md)); if not mutual it adds "Vocês só trocam sussurros enquanto um segue o outro." (`l10n:whisperDisabled`).
  - Composer: "Escreva um sussurro" (`l10n:whisperHint`), a 2000-character counter, and "Enviar" (`l10n:whisperSend`), disabled while blank or sending. Sending calls `POST /users/{userId}/messages` (201) and the message appears on top; the WebSocket echo is de-duplicated by id. The first message creates the conversation, which is then fetched. The text is cleared at once and given back on failure, with a snackbar: 429 → "Calma: muitos sussurros em um minuto." (`l10n:whisperRateLimited`); 403 → `l10n:whisperDisabled`, and the composer closes; else "Não deu para enviar. Tente de novo." (`l10n:whisperSendError`).
  - Closed conversation: the history stays readable and the composer is replaced by the `l10n:whisperDisabled` notice.
- **system-messages:** when a follow change ends or restores mutuality between two users who already have a conversation, the server adds a system message: "Vocês não se seguem mais. Esta conversa ficou só para leitura." or "Vocês voltaram a se seguir." (`l10n:whisperMutualLost`, `l10n:whisperMutualRestored`). In the app it closes or reopens the composer live.

## How to get to it (user POV)
- Social tab › envelope icon (badge) › Sussurros › a conversation.
- A mutual's profile › "Sussurrar" (`l10n:whisperAction`) → `ConversationRoute` without an id ([public-profile](public-profile.md)).
- A `message` push opens `ConversationRoute` with the sender and conversation id ([app-shell](app-shell.md)).

## Where it lives
### App
- Routes: `WhispersRoute` (Social stack), `ConversationRoute` (Social, Catálogo and Programação stacks and the root).
- Screens and state: `muuvie/ui/whispers/lib` (`WhispersPage`, `WhispersCubit`, `whispers_screen.dart`), `muuvie/ui/whispers/lib/conversation` (`ConversationCubit`, screen), the badge `muuvie/lib/routes/whispers_button.dart`.
- Data: `muuvie/features/social_network/data/lib/datasources/social_network_remote_data_source.dart`; the WebSocket streams (`message`, `unread`) in `muuvie/features/social_network/data/lib/repositories/social_network_repository_impl.dart`; use cases in `muuvie/features/social_network/domain/lib/usecases/whispers.dart` (`SendWhisper` rejects blank or >2000 characters before calling).
### Backend
`backend/src/main/kotlin/org/mobyle/routing/MessagesRouting.kt` (conversations and messages only); use cases in `backend/src/main/kotlin/org/mobyle/domain/usecase/messages/MessageUseCases.kt`; system messages from `backend/src/main/kotlin/org/mobyle/domain/usecase/follow/FollowUseCases.kt`.

| Endpoint | Auth | Use case |
|---|---|---|
| `GET /conversations` | required | `GetConversations` (cursor; `limit` 1–50, default 30) |
| `GET /conversations/{conversationId}` | required | `GetConversation` (members only, else 404) |
| `GET /conversations/{conversationId}/messages` | required | `GetMessages` |
| `PUT /conversations/{conversationId}/read` | required | `MarkConversationRead` → `UnreadCount`; pushes `unread` to my other sessions |
| `POST /users/{userId}/messages` | required | `SendMessage` (201); `{userId}` takes an id or `@handle` |
| `GET /users/{userId}/conversation` | required | `GetConversationWith` (404 until the first message) |
| `GET /users/me/unread-count` | required | `GetUnreadCount` → `{conversations, messages}` |

## Driving it
```bash
H="Authorization: Bearer $TOKEN"; J="Content-Type: application/json"; A=http://localhost:8080/api/v1
# Two users who follow each other (POST /users/{id}/follow both ways, see follows)
curl -s -X POST -H "$H" -H "$J" $A/users/@amiga/messages -d '{"body":"oi!"}'   # 201, {id, conversationId, …}
curl -s -H "$H" $A/conversations | jq '.results[] | {id, other: .other.name, unread}'
curl -s -H "$H" "$A/conversations/$C/messages" | jq '.results[].body'
curl -s -X PUT -H "$H" $A/conversations/$C/read          # {"conversations":0,"messages":0}
curl -s -H "$H" $A/users/me/unread-count
```
With the other user's token on `WS /ws`, watch `message` and `unread` arrive. App: push `WhispersRoute()` in the Social stack, or `ConversationRoute(userId: '@amiga', name: 'Amiga')`.

## Gotchas
- Only mutuals can send (403 `not_mutual`); messaging yourself is a 400; an unknown recipient is a 404. A body is trimmed and must be 1–2000 characters (400).
- Rate limit: 30 messages per minute per sender (429 `rate_limited`).
- The recipient gets `message` and `unread` on the WebSocket and a push (if the "messages" preference is on); the sender's other sessions get `message` too. System messages are never pushed.
- The WebSocket message carries no "mine" flag: the app treats anything not from the other member or the system as mine.
- Only the two members know a conversation exists: anyone else gets a 404 on every conversation endpoint.
