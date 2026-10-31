# CineClubes

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

Film clubs: one movie with a viewing period and a debate day, or a cycle of up to 52 movies one after another. Participants log sessions as usual; the CineClube shows who is watching and their logs, hiding comments from people who have not finished the movie until the debate day. Anyone can browse; logged-in users join, create and edit. Listed from [programacao](programacao.md); the detail is also reachable by `/c/<slug>`.

## Sub-features
- **detail:** header with color, period, status (`maratonaStatus*` keys: "Em breve", "Acontecendo", "Finalizada", "Cancelada"), participants, `l10n:cineclubeSessionsCount` for cycles, `l10n:maratonaLocked` "Com senha". A participant sees their progress on the current session (`l10n:cineclubeProgressPending` "Não começou" / `l10n:cineclubeProgressWatching` "Assistindo" / `l10n:cineclubeProgressCompleted` "Assistiu") and, in a cycle, `l10n:cineclubeCompletedSessions` "{done} de {total} filmes". Error state with retry.
- **cycle picker:** for cycles, a chip row `l10n:cineclubeSessionLabel` "{number}. {title}" (play icon on the current one); the selected session drives the Progresso and Participantes tabs.
- **tabs:** `l10n:maratonaTabAbout` "Sobre" (the session's movie with year and `l10n:cineclubeRuntime`, `l10n:cineclubeDebateOn` "Debate em {date}", `l10n:cineclubeSpoilerNote` before the debate, `l10n:cineclubeWhereToWatch` "Onde assistir" providers for the current session, description, owner, `l10n:cineclubeDebateLink` and `l10n:maratonaSocialLink` links opened externally, the cycle's `l10n:cineclubeSessions` list), `l10n:cineclubeTabProgress` "Progresso", `l10n:cineclubeTabParticipants` "Participantes". Tabs are widgets, not routes.
- **progress:** participants' logs of the session, newest first, paged with `l10n:maratonaLoadMore`: status (`l10n:cineclubeWatchedPercent`, `l10n:cineclubeWatchedMinutes`, "Assistiu"), emotions, comment, GIF. A gated log shows `l10n:cineclubeSpoilerHidden` instead of its comment and GIF. Empty: `l10n:cineclubeProgressEmptyTitle` "Nenhuma sessão ainda".
- **participants:** chips `l10n:cineclubeFilterAll` "Todos", Assistiu, Assistindo, Não começou (`status=completed|watching|pending`), paged. Empty: `l10n:cineclubeParticipantsEmpty`.
- **join:** `l10n:cineclubeJoin` "Entrar no CineClube" (upcoming or active only) asks to log in, then a password prompt if locked. Success: `l10n:cineclubeJoined` "Você entrou. O filme está no seu Quero ver." (the current session's movie goes to Quero ver unless already watched). Errors: 403 → `l10n:maratonaWrongPassword`, 409 → `l10n:cineclubeClosed`, else `l10n:maratonaActionError`.
- **leave:** `l10n:maratonaLeave` "Sair" → `l10n:cineclubeLeaveTitle` / `l10n:cineclubeLeaveMessage` ("O filme continua no seu Quero ver.").
- **editor:** `l10n:cineclubeEditorNewTitle` "Novo CineClube" / `l10n:cineclubeEditorEditTitle`. Title (100), address (3–50 of `a-z0-9-`, `l10n:cineclubeSlugHelp` "muuvie.app/c/{slug}", live check on create, 400 ms), description (2000), sessions (`l10n:cineclubeMovieAndDates` for one, `l10n:cineclubeSessions` for a cycle): each picks a movie in a search sheet (`l10n:cineclubeSearchMovie`, ≥ 2 characters, `GET /movies/search`), start, end and `l10n:cineclubeFieldDebate` "Dia do debate"; `l10n:cineclubeAddSession` "Adicionar filme" adds the next 7-day slot (up to 52). Color, debate link, social link, password (≤ 72) or `l10n:maratonaRemovePassword`. Client checks: `l10n:cineclubeMovieRequired`, `l10n:maratonaPeriodError`, `l10n:cineclubeOverlapError`, `l10n:cineclubeFutureSessionError`. Started sessions are locked (`l10n:cineclubeSessionStarted` "Já começou"). Save errors: 409 → `l10n:maratonaSlugTaken`, else `l10n:maratonaSaveError`.
- **create from a movie:** a movie's action sheet › `l10n:movieDetailCreateCineClube` "Criar CineClube com este filme" opens the editor with that movie as the first session.
- **edit / cancel:** owner-only menu `l10n:maratonaEdit` "Editar" / `l10n:cineclubeCancel` "Cancelar CineClube" while upcoming or active; cancel is final (`l10n:cineclubeCancelMessage`).
- **lifecycle:** hourly scheduler: starts with the first session, puts each new cycle movie on participants' Quero ver when its session opens, pushes `cineclube_debate` on the debate day, finishes the day after the last end or debate.

## How to get to it (user POV)
Programação › CineClubes › card. Also: Atts feed activity cards; Catálogo discover search; a movie's CineClubes section; onboarding suggestions; push `cineclube_debate`; link `https://muuvie.app/c/<slug>`. Create: Programação › CineClubes › Criar CineClube, or Filme › ações › Criar CineClube com este filme.

## Where it lives
### App
- Routes: `CineClubeDetailRoute` (`slug`, `title`; also root path `/c/:slug`), `CineClubeEditorRoute` (`slug` null = create, optional `movie`)
- Detail: `muuvie/ui/cineclubes/lib/detail` (`cineclube_detail_page.dart`, `cineclube_detail_bloc.dart`, `cineclube_detail_screen.dart`, `about_tab.dart`, `progress_tab.dart`, `participants_tab.dart`)
- Editor: `muuvie/ui/cineclubes/lib/editor` (`cineclube_editor_page.dart`, `cineclube_editor_bloc.dart`, `cineclube_editor_screen.dart`, `movie_search_sheet.dart`)
- Data: `muuvie/features/cineclubes/data/lib/datasources/cineclubes_remote_data_source.dart`; use cases `muuvie/features/cineclubes/domain/lib/usecases/cineclubes.dart`
- Entry points: `muuvie/lib/routes/app_router.dart` (`profileDeepLink`), `muuvie/lib/push/push_route.dart`, `muuvie/lib/routes/app_movie_detail_links.dart`
### Backend
Handlers in `backend/src/main/kotlin/org/mobyle/routing/CineClubesRouting.kt`; use cases in `backend/src/main/kotlin/org/mobyle/domain/usecase/cineclubes/CineClubeUseCases.kt`.

| Endpoint | Auth | Use case |
|---|---|---|
| `GET /cineclubes/{slug}` | optional (adds `me`, `canEdit`) | `GetCineClube` (+ TMDB watch providers) |
| `GET /cineclubes/{slug}/progress` | optional (drives the spoiler gate) | `GetCineClubeProgress` (`session`, `page`, `limit`) |
| `GET /cineclubes/{slug}/participants` | none | `GetCineClubeParticipants` (`session`, `status`, `completedOnly`) |
| `POST /cineclubes/{slug}/participation` | required | `JoinCineClube` (201) |
| `DELETE /cineclubes/{slug}/participation` | required | `LeaveCineClube` (204) |
| `GET /cineclubes/slug-available` | none | `CheckCineClubeSlug` |
| `POST /cineclubes` | required | `CreateCineClube` (201); validation in `backend/src/main/kotlin/org/mobyle/domain/usecase/cineclubes/CineClubeInput.kt` |
| `PUT /cineclubes/{slug}` | required, owner | `UpdateCineClube` |
| `POST /cineclubes/{slug}/cancel` | required, owner | `CancelCineClube` |

Background: `backend/src/main/kotlin/org/mobyle/domain/usecase/cineclubes/AdvanceCineClubes.kt` (on boot, then hourly, from `Main.kt`).

## Driving it
```bash
API=http://localhost:8080/api/v1; H="Authorization: Bearer $TOKEN"; H2="Authorization: Bearer $TOKEN2"; J='Content-Type: application/json'
curl -s -X POST $API/cineclubes -H "$H" -H "$J" -d '{"slug":"noir-club","title":"Noir Club",
  "sessions":[{"tmdbId":289,"title":"Casablanca","startsOn":"2026-11-02","endsOn":"2026-11-08","debateOn":"2026-11-09"}]}'
curl -s -X POST $API/cineclubes/noir-club/participation -H "$H2" -H "$J" -d '{}'   # second user joins
curl -s "$API/cineclubes/noir-club/participants?status=pending"
curl -s "$API/cineclubes/noir-club/progress" -H "$H2"   # logs come from sessions logged in the period
```
App: push `CineClubeDetailRoute(slug: 'noir-club')`; `/c/noir-club` needs the link domain on the device.

## Gotchas
- The spoiler gate runs on the server: until the debate day, a viewer who has not watched the movie gets other people's spoiler-flagged or commented logs with `comment` and `gifUrl` stripped and `hidden=true`, `hiddenReason="spoiler"`. Anonymous viewers are always gated before the debate.
- The creator joins their own CineClube at creation (and gets the movie on Quero ver).
- Edit and cancel are owner-only on both sides (no co-owners, unlike maratonas).
- Sessions: each ≤ 90 days, the debate between the start and 30 days after the end (defaults to the end), no overlap, the whole span ≤ 366 days, a new CineClube cannot end in the past. Once any session started, new or changed sessions must start after today and started ones stay as they are.
- A session may name a movie by `tmdbId` only; the server creates a stub movie from `title`.
- Status is stored and moved by the scheduler; one created with a session starting today is active at once.
