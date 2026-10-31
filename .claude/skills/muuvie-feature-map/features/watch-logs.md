# Watch logs

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

What a logged-in user records about a movie:
- **sessions:** full or partial, with venue, emotions, GIF, comment and visibility;
- **quick actions:** "Já assisti", "Assistir de novo", "Assistindo agora";
- **a rating label**, with an optional review;
- **the per-movie history**, where sessions are edited and deleted.

Most of it starts from the watch panel on [movie-detail](movie-detail.md). Comments on sessions and ratings exist in code and on the backend, but nothing in the app opens them.

## Sub-features
- **log-session:** `LogSessionRoute`, a full-screen modal sliding up. It is titled "Registrar sessão" (`l10n:watchLogTitle`), or "Editar registro" (`l10n:watchLogEditTitle`) when it gets an `existing` log.
  - "Data" (`l10n:watchLogDate`): today by default; the picker allows 1900 to today.
  - "Progresso" (`l10n:watchLogProgress`): "Assistido", "Minutos" or "Porcentagem" (`l10n:watchModeWatched`, `l10n:watchModeMinutes`, `l10n:watchModePercent`). Minutes go from 0 to the runtime, or to 600 when TMDB has no runtime; percent from 0 to 100.
  - "Onde assistiu" (`l10n:watchLogVenue`) chips: Cinema, Streaming, TV, Mídia física, Festival, Outro (`l10n:watchVenuePhysicalMedia`…). Tapping the selected chip clears it. Then "Serviço ou cinema (opcional)" (`l10n:watchLogProvider`, ≤ 255).
  - "Como foi?" (`l10n:watchLogEmotions`): up to 6 emotions, recent ones first.
  - "Adicionar GIF" (`l10n:watchLogAddGif`) opens the GIF picker.
  - "Comentário (opcional)" (`l10n:watchLogComment`, ≤ 5000) and "Contém spoiler" (`l10n:watchLogSpoiler`).
  - "Quem pode ver" (`l10n:watchLogVisibility`): Público / Mútuos / Secreto (`l10n:visibilityPublic`, `l10n:visibilityMutual`, `l10n:visibilitySecret`); default Público.

  "Salvar" (`l10n:watchLogSave`) shows a spinner. On failure: "Não deu para salvar o registro. Tente de novo." (`l10n:watchLogError`), and the form stays. On success the modal closes and the caller shows "Sessão registrada" (`l10n:watchLogSaved`) and reloads.
  - A completed session moves the movie to Já assisti.
  - It also publishes a feed activity, completes matching maratona challenges, and feeds gamification.
- **gif-picker:** `GifPickerSheet`, a bottom sheet titled "Escolha um GIF" (`l10n:gifPickerTitle`). With an empty search it shows "Recentes" (`l10n:gifRecent`, the last 12). Typing searches 400 ms after typing stops ("Buscar GIFs", `l10n:gifSearchHint`). A failed search shows "A busca de GIFs está indisponível agora." (`l10n:gifSearchUnavailable`).
- **mark-watched:** the "Já assisti" tile on the movie panel logs a session in one tap: today, mode watched.
- **rewatch:** "Assistir de novo" (`l10n:rewatchAction`) shows once the movie is watched and a rewatch is allowed. It opens a new cycle and shows "Rewatch iniciado" (`l10n:rewatchStarted`). The server answers 409 `cycle_not_completed` while the current cycle is unfinished.
- **watching-now:** the "Assistindo agora" toggle (`l10n:watchingNowTitle`) on the movie panel. The member profile shows it as a card (`WatchingNowCard`) with a progress bar and a shortcut to log a session. Rating a movie "Abandonei" clears it. A failed quick action shows "Não deu para atualizar. Tente de novo." (`l10n:watchStateError`).
- **rate:** `RateMovieRoute`, a full-screen modal titled "Avaliar" (`l10n:ratingTitle`). It opens from the panel's rating tile.
  - Prompt: "Qual opção melhor reflete sua avaliação final?" (`l10n:ratingPrompt`). Pick one of 7 labels: Favoritado, Adorei, Gostei, Neutro, Não foi pra mim, Abandonei, Na geladeira (`l10n:ratingLabelFavorite` … `l10n:ratingLabelOnHold`).
  - "Comentário (opcional)" (`l10n:ratingReview`, ≤ 10000) and "Contém spoiler".
  - "Criar sessão de 100%" (`l10n:ratingCreateLog`) is on by default unless the movie is already watched. Abandonei and Na geladeira hide it. While it is on, "Como foi?" and "Quem pode ver" appear, for that session.
  - "Salvar avaliação" (`l10n:ratingSave`) is disabled until a label is picked. "Remover avaliação" (`l10n:ratingRemove`) only shows when a rating exists; it keeps sessions and shelves.
  - On failure: "Não deu para salvar a avaliação. Tente de novo." (`l10n:ratingError`). On success the modal closes and the movie page reloads.
- **history:** `MovieHistoryRoute` ("Histórico", `l10n:historyTitle`), from the panel's history tile. It is missing for guests.
  - A summary card: "N min assistidos", sessions, rewatches (`l10n:historyMinutes`, `l10n:historySessions`, `l10n:historyRewatches`), and emotions.
  - Sessions newest first, grouped under "Primeira vez" / "Rewatch N" (`l10n:historyFirstWatch`, `l10n:historyRewatch`). Scrolling loads more.
  - Own sessions have a menu: "Editar" opens `LogSessionRoute` in edit mode; "Excluir" (`l10n:historyEdit`, `l10n:historyDelete`) asks "Excluir este registro?" / "O progresso é recalculado. O filme continua em Já assisti." (`l10n:historyDeleteTitle`, `l10n:historyDeleteMessage`).
  - Empty: "Nenhum registro ainda" (`l10n:historyEmpty`). An error offers "Tentar novamente".
- **comments:** `ThreadCommentsSheet` shows the comments on a session (`watch_log`) or a rating, oldest first ("Comentários", `l10n:threadCommentsTitle`). It has a field "Escreva um comentário" (`l10n:threadCommentHint`, 1..2000) with a spoiler toggle, and replies via `parentId`. The author or the target's owner can delete a comment. **No entry point in the app:** nothing calls `ThreadCommentsSheet.show`.

## How to get to it (user POV)
Catálogo › a movie › panel › "Registrar sessão" / "Já assisti" / "Avaliar" / "Assistindo agora" / "Histórico". Also: a shelf › a movie's log action (`ShelfDetailRoute`), and Perfil › the "assistindo agora" card. Each action opens login first when signed out.

## Where it lives
### App
- Routes: `LogSessionRoute`, `RateMovieRoute`, `MovieHistoryRoute`
- Screens and state: `muuvie/ui/watch_logs/lib/log_session` (`LogSessionCubit`), `muuvie/ui/watch_logs/lib/rating` (`RateMovieCubit`), `muuvie/ui/watch_logs/lib/history` (`MovieHistoryCubit`), `muuvie/ui/watch_logs/lib/movie_panel` (`MovieWatchCubit`), `muuvie/ui/watch_logs/lib/gif_picker`, `muuvie/ui/watch_logs/lib/watching_now/watching_now_card.dart`, `muuvie/ui/watch_logs/lib/comments`
- Data: `muuvie/features/watch_logs/data/lib/datasources/watch_logs_remote_data_source.dart`; client checks in `muuvie/features/watch_logs/domain/lib/usecases/log_watch_session.dart`
### Backend
| Endpoint | Auth | Use case |
|---|---|---|
| `POST /movies/{id}/logs` | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/watch/LogWatchSession.kt` (validation in `WatchLogInput.kt`) |
| `POST /movies/tmdb/{tmdbId}/logs` (not called by the app) | required | same |
| `GET /movies/{id}/logs` | required for `userId=me` (default), else optional | `backend/src/main/kotlin/org/mobyle/domain/usecase/watch/GetMovieLogs.kt` |
| `PUT /logs/{id}` | required (owner) | `backend/src/main/kotlin/org/mobyle/domain/usecase/watch/UpdateWatchLog.kt` |
| `DELETE /logs/{id}` | required (owner) | `backend/src/main/kotlin/org/mobyle/domain/usecase/watch/DeleteWatchLog.kt` |
| `POST /movies/{id}/rewatch` | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/watch/StartRewatch.kt` |
| `PUT /movies/{id}/rating` | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/watch/SetMovieRating.kt` |
| `DELETE /movies/{id}/rating` | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/watch/RemoveMovieRating.kt` |
| `PUT /users/me/watching-now` | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/watch/WatchingNowUseCases.kt` |
| `GET /users/{userId}/watching-now` | required for `me`, else public | same |
| `GET /users/me/emotions/recent` | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/watch/PickerUseCases.kt` |
| `GET /users/me/gifs/recent` | required | same |
| `GET /gifs/search` | required | same (`SearchGifs`) |
| `GET /comments` (no entry point in the app) | optional | `backend/src/main/kotlin/org/mobyle/domain/usecase/comments/CommentUseCases.kt` |
| `POST /comments` (no entry point in the app) | required | same |
| `DELETE /comments/{id}` (no entry point in the app) | required (author or target owner) | same |

The panel's state comes from `GET /movies/{id}/me` (see [movie-detail](movie-detail.md)).

## Driving it
```bash
API=http://localhost:8080/api/v1; H="Authorization: Bearer $TOKEN"
LOG=$(curl -s -X POST "$API/movies/$ID/logs" -H "$H" -H 'Content-Type: application/json' \
  -d '{"watchedOn":"2026-10-30","mode":"minutes","minutesWatched":40,"venue":"streaming","emotions":["tension"],"visibility":"public"}' | jq .id)
curl -s "$API/movies/$ID/me" -H "$H" | jq '{status, progress, watchingNow}'
curl -s -X PUT "$API/movies/$ID/rating" -H "$H" -H 'Content-Type: application/json' -d '{"rating":"loved","review":"Ótimo","createLog":true}'
curl -s "$API/movies/$ID/logs?page=1&limit=20" -H "$H" | jq '.summary'
curl -s -X POST "$API/movies/$ID/rewatch" -H "$H" -w '%{http_code}\n'   # 409 while the cycle is open
curl -s -X DELETE "$API/logs/$LOG" -H "$H" -w '%{http_code}\n'           # 204
curl -s "$API/gifs/search?q=wow" -H "$H" -w '%{http_code}\n'             # 503 without TENOR_API_KEY
```
App: `LogSessionRoute(movieId: …, movieTitle: …)` and `RateMovieRoute(movieId: …, movieTitle: …)` are root routes and can be pushed anywhere.

## Gotchas
- **Server-side checks:** `watchedOn` must be `YYYY-MM-DD` and not in the future; at most 6 emotions; minutes must fit within the runtime (600 when it is unknown). A failed check answers 400 `validation_failed`, which the app shows only as the generic save error. The app checks the same limits before sending.
- **No partial "Já assisti":** only a completed session moves the movie to Já assisti. Ratings don't, except through "Criar sessão de 100%". `createLog` with `abandoned` or `on_hold` answers 400.
- **Owner-only writes:** `PUT /logs/{id}` and `DELETE /logs/{id}` answer 403 `not_log_owner` for someone else's session, and 404 when the viewer can't see it. Deleting recomputes progress but keeps the movie on Já assisti.
- **Other users' history is unused:** `GET /movies/{id}/logs?userId=<other>` exists, but `MovieHistoryRoute` is only pushed without `userId` (the viewer's own history).
- **Dead TMDB-id path:** `LogSessionRoute` accepts a `tmdbId` (→ `POST /movies/tmdb/{tmdbId}/logs`), but every caller passes `movieId`.
- **GIF search needs a key:** without `TENOR_API_KEY`, `GET /gifs/search` answers 503 `gif_search_unavailable` and the picker shows the unavailable message. Recent GIFs still load.
- **Comments are unreachable:** `ThreadCommentsSheet` is exported from `muuvie/ui/watch_logs/lib/watch_logs_ui.dart` but never shown. Drive comments with curl: `GET /comments?targetType=watch_log&targetId=$LOG`. Targets are `watch_log` or `rating` (else 400); a `parentId` must belong to the same target.
- **Emotion wire names:** they are the snake_case values in `muuvie/core/lib/vocabulary/emotion.dart` (`tension`, `freak_out`, …). An unknown name answers 400.
