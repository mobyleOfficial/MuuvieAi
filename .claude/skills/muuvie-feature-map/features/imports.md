# Imports

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

Bringing a history in from Filmow: log in to Filmow inside the app, let the server read the profile, review a preview, confirm, follow the progress, then confirm the movies it could not match. Watched movies go to "Já assisti", the watchlist to "Quero ver", and lists become shelves ([shelves](shelves.md)). Nothing is written before the user confirms. Letterboxd exists in the vocabulary but the server refuses it.

## Sub-features
- **start:** `ImportStartRoute` "Importar" (`l10n:importTitle`): the intro (`l10n:importIntro`), one button, and "Importações anteriores" (`l10n:importHistoryTitle`), the first 20 jobs of `GET /imports`, newest first. Rows read "Filmow · {username}", the date and a colored status (`l10n:importStatusLabel`: Começando, Lendo, Esperando você, Importando, Concluída, Falhou, Cancelada); a tap opens the job. Loading is a spinner; an error shows `l10n:emptyStateErrorTitle` and a retry.
  - Button: "Entrar no Filmow e importar" (`l10n:importStartFilmow`). If a job is running or waiting on its preview, the button shows that job's status instead and opens it, so a second import is never started from here.
- **filmow-login:** a dialog first: "Espere depois do login" / "Depois de entrar no Filmow, você PRECISA esperar a tela fechar sozinha…" / "Entendi" (`l10n:importFilmowWaitTitle`, `l10n:importFilmowWaitMessage`, `l10n:importFilmowWaitConfirm`). Then a `Navigator.push` of a `MaterialPageRoute` (not a router route) with `FilmowLoginWebview`, titled "Login no Filmow" (`l10n:editProfileFilmowLogin`), on `https://filmow.com/login/`. Every second it checks for a filmow.com page outside `/login` and `/cdn-cgi` with no password field, reads the username from the header's `/usuario/<name>` link, reads the `filmow_sessionid` cookie from the native cookie jar (MethodChannel "muuvie/webview_cookies"; the cookie is HttpOnly) and closes by itself. Closing it by hand starts nothing.
  - Then `POST /imports` (`source: filmow`, `username`, `cookies`, answered 202) and the start screen is replaced by `ImportJobRoute`. A 409 shows "Você já tem uma importação em andamento." (`l10n:importInProgress`) and reloads the history; anything else shows "Não deu para começar a importação. Tente de novo." (`l10n:importStartError`).
- **job:** `ImportJobRoute(jobId)`, also titled "Importar". It loads `GET /imports/{id}`, reloads on every `import_progress` WebSocket event for this job, and also polls every 4 s while the job runs (pending, reading, importing). By status:
  - pending / reading: "Lendo seu perfil do Filmow" (`l10n:importReadingTitle`), "Você pode sair desta tela…" (`l10n:importReadingMessage`).
  - preview: "Pronto para importar" (`l10n:importPreviewTitle`) with counts "N filmes → Já assisti", "→ Quero ver", favorites, "sessões com data" (`l10n:importPreviewWatched`, `l10n:importPreviewWatchlist`, `l10n:importPreviewFavorites`, `l10n:importPreviewLogs`). Then "Listas → estantes" (`l10n:importPreviewLists`), one checkbox per list with "N filmes", all checked at first ("Nenhuma lista encontrada no seu perfil.", `l10n:importPreviewNoLists`). Then "Quem vê as estantes e sessões novas" (`l10n:importPreviewVisibility`), a Público / Mútuos / Secreto selector defaulting to Público. "Importar" (`l10n:importConfirm`) sends `POST /imports/{id}/confirm` with `listsToImport` and `defaultVisibility`; "Cancelar importação" (`l10n:importCancel`) sends `POST /imports/{id}/cancel`.
  - importing: "Importando seu histórico" (`l10n:importImportingTitle`), a progress bar and "{processed} de {total}" (`l10n:importImportingProgress`).
  - done: "Importação concluída" (`l10n:importDoneTitle`): the same counts, "N listas viraram estantes" (`l10n:importDoneShelves`), "N filmes que você já tinha ficaram como estavam" (`l10n:importDoneKept`). With unmatched movies, "Revisar N filmes" (`l10n:importReviewUnmatched`) → `ImportUnmatchedRoute`. Always "Importar de novo" (`l10n:importAgain`), which replaces the screen with `ImportStartRoute`.
  - failed: "A importação falhou" (`l10n:importFailedTitle`) with the job's `error` and "Importar de novo". cancelled: "Importação cancelada" / "Nada foi gravado." (`l10n:importCancelledTitle`, `l10n:importCancelledMessage`).
  - A failed confirm or cancel shows "Algo deu errado. Tente de novo." (`l10n:importActionError`).
- **unmatched:** `ImportUnmatchedRoute(jobId)` "Confirmar filmes" (`l10n:importUnmatchedTitle`): the hint "Não tivemos certeza sobre estes filmes. Eles já estão nas suas estantes…" (`l10n:importUnmatchedHint`), then a card per movie, "Title (year)", with its TMDB candidates. Tapping a candidate sends `POST /imports/{id}/unmatched/{itemId}` with `tmdbId` and `title`; "Pular" (`l10n:importUnmatchedSkip`) sends `skip: true`. A resolved card reads "Confirmado" or "Pulado" (`l10n:importUnmatchedMatched`, `l10n:importUnmatchedSkipped`). No candidates: "Nenhuma sugestão encontrada." (`l10n:importUnmatchedNoCandidates`). Nothing to review: "Todos os filmes foram encontrados." (`l10n:importUnmatchedEmpty`). Pages load as you scroll (`GET /imports/{id}/unmatched`).
- **finished-anywhere:** when an `import_progress` with status `done` arrives, the main screen shows the snackbar "Sua importação do Filmow terminou" (`l10n:importFinishedSnack`) with "Ver relatório" (`l10n:importSeeReport`) → `ImportJobRoute` ([app-shell](app-shell.md)).

## How to get to it (user POV)
- Perfil › Editar perfil › "Importar dados" › "Importar dados do Filmow" (`l10n:editProfileImportSection`, `l10n:editProfileImportFilmow`) ([profile](profile.md)).
- Perfil › Configurações › "Importar filmes" (`l10n:settingsImport`) ([settings](settings.md)).
- Perfil › Estantes › an empty "Já assisti" › "Já usa o Filmow? Traga seu histórico" (`l10n:watchedEmptyImport`).
- The intro's last page, "Importar do Filmow" ([onboarding](onboarding.md)).
- An `import_updated` push opens `ImportJobRoute(jobId)`, or `ImportStartRoute` without a job id.

## Where it lives
### App
- Routes: `ImportStartRoute`, `ImportJobRoute` (root, slide-up), `ImportUnmatchedRoute` (root).
- Screens and state: `muuvie/ui/imports/lib/import_start` (`ImportStartCubit`), `muuvie/ui/imports/lib/import_job` (`ImportJobCubit`), `muuvie/ui/imports/lib/import_unmatched` (`ImportUnmatchedCubit`), the login `muuvie/ui/imports/lib/widgets/filmow_login_webview.dart`, the snackbar in `muuvie/lib/routes/main_screen.dart`.
- Data: `muuvie/features/imports/data/lib/datasources/imports_remote_data_source.dart` (HTTP); the WebSocket stream in `muuvie/features/imports/data/lib/repositories/imports_repository_impl.dart`; use cases in `muuvie/features/imports/domain/lib/usecases`.
### Backend
`backend/src/main/kotlin/org/mobyle/routing/ImportsRouting.kt`; use cases in `backend/src/main/kotlin/org/mobyle/domain/usecase/imports/ImportUseCases.kt` and `backend/src/main/kotlin/org/mobyle/domain/usecase/imports/UnmatchedUseCases.kt`; the background work in `backend/src/main/kotlin/org/mobyle/data/service/ImportJobRunner.kt` and `backend/src/main/kotlin/org/mobyle/data/repository/FilmowImportReader.kt`.

| Endpoint | Auth | Use case |
|---|---|---|
| `POST /imports` | required | `StartImport` (202) |
| `GET /imports` | required | `GetImports` |
| `GET /imports/{id}` | required | `GetImport` |
| `POST /imports/{id}/confirm` | required | `ConfirmImport` (202) |
| `POST /imports/{id}/cancel` | required | `CancelImport` |
| `GET /imports/{id}/unmatched` | required | `GetUnmatchedItems` |
| `POST /imports/{id}/unmatched/{itemId}` | required | `ResolveUnmatchedItem` |

## Driving it
```bash
H="Authorization: Bearer $TOKEN"; J="Content-Type: application/json"; A=http://localhost:8080/api/v1
JOB=$(curl -s -X POST -H "$H" -H "$J" $A/imports -d '{"source":"filmow","username":"someone","cookies":""}' | jq .id)
curl -s -H "$H" $A/imports/$JOB | jq '{status,processed,total,preview}'   # poll until "preview"
curl -s -X POST -H "$H" -H "$J" $A/imports/$JOB/confirm -d '{"defaultVisibility":"secret"}'   # null listsToImport = all lists
curl -s -H "$H" "$A/imports/$JOB/unmatched?page=1&limit=20" | jq '.results[] | {id,resolution}'
curl -s -X POST -H "$H" -H "$J" $A/imports/$JOB/unmatched/7 -d '{"skip":true}'
```
Watch `WS /ws` for `import_progress` (`jobId`, `source`, `status`, `processed`, `total`, all strings). App: push `ImportJobRoute(jobId: JOB)` (root).

## Gotchas
- The Filmow login is a live third-party site; it cannot be driven without a real Filmow account. The closest real path is `POST /imports` with an empty `cookies` (the scraper then runs without a session; whether Filmow serves the profile that way is unverified) and then `ImportJobRoute`.
- One active job per user and source: a second `POST /imports` while one is pending, reading, in preview or importing is a 409 `import_in_progress`. `letterboxd` is a 503 `import_source_unavailable`. The username must match `^[A-Za-z0-9_.-]{1,100}$` (400). The server runs at most 2 jobs at a time.
- Confirm works only in preview (409 `import_not_in_preview`); lists not in the preview are a 400. Cancel works only before writing (pending, reading, preview), else 409 `import_not_cancellable`; the app offers it only on the preview. A resolved unmatched item is a 409 `already_resolved`. Someone else's job is a 404.
- The cookies are sent for this read and never stored. `import_updated` pushes (preview, done, failed) ignore notification preferences ([settings](settings.md)).
- The job's `error` text is the server's English ("Could not read the source profile", "Could not finish the import"), shown as is.
- An import that adds movies publishes one `importou_filmes` activity ([social-feed](social-feed.md)).
