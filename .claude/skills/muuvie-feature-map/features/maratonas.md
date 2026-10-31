# Maratonas

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

Movie marathons with a period, challenges grouped in categories, levels, optional teams, prizes and an optional password. Anyone can browse; logged-in users join, mark challenges with movies (or have them completed automatically by logged sessions), climb a ranking, and create or edit their own. Listed from [programacao](programacao.md); the detail is reachable from many places and by `/m/<slug>`.

## Sub-features
- **detail:** header with logo, period, status (`l10n:maratonaStatusUpcoming` "Em breve" / `l10n:maratonaStatusActive` "Acontecendo" / `l10n:maratonaStatusFinished` "Finalizada" / `l10n:maratonaStatusCancelled` "Cancelada"), participants, "Curadoria" and `l10n:maratonaLocked` "Com senha" badges. A joined user sees a bar `l10n:maratonaMyProgress` "{done} de {total} desafios" (total = their level's minimum) and their level. Loads maratona + challenges in parallel; either failing shows the error state with retry.
- **tabs:** `l10n:maratonaTabAbout` "Sobre" (description, `l10n:maratonaOwnerBy` "Por {name}", co-owners, `l10n:maratonaSocialLink` "Comunidade" link opened externally, levels, teams, prizes, `l10n:maratonaProgressFeed` "Atividade" feed with `l10n:maratonaLoadMore`), `l10n:maratonaTabChallenges` "Desafios", `l10n:maratonaTabQueue` "Minha Fila", `l10n:maratonaTabDiscovery` "Descoberta", `l10n:maratonaTabRanking` "Ranking". Tabs are widgets, not routes.
- **join:** `l10n:maratonaJoin` "Participar" (only while upcoming or active) asks to log in, then a bottom sheet `l10n:maratonaJoinTitle`: level (only with > 1 level; default is the lowest minimum), team (`l10n:maratonaNoTeam` "Sem equipe" allowed), password when locked. Errors: 403 → `l10n:maratonaWrongPassword` "Senha errada.", 409 → `l10n:maratonaClosed` "Esta maratona não está aberta.", else `l10n:maratonaActionError`. Joining creates a public shelf "Fila: <title>" (the queue) in the maratona's color.
- **leave:** `l10n:maratonaLeave` "Sair" → dialog `l10n:maratonaLeaveTitle` / `l10n:maratonaLeaveMessage` ("Sua Fila e os desafios marcados serão removidos."). The queue shelf and all links are deleted.
- **challenges:** per category (team-only ones tagged `l10n:maratonaTeamOnly`), each challenge shows `l10n:maratonaChallengeDone` "Concluído" / `l10n:maratonaChallengeOpen` "A fazer", `l10n:maratonaChallengeAuto` "Conclui sozinho" (has criteria) or `l10n:maratonaChallengeManual`, and `l10n:maratonaChallengeDaily` "Diário". Tap → challenge sheet with tied movies (`l10n:maratonaLinkAuto` "por um registro" for auto links).
- **mark:** in the sheet, `l10n:maratonaLinkMovie` "Marcar com um filme" (joined and active only; else `l10n:maratonaJoinToMark` or `l10n:maratonaNotRunning`) opens a movie picker sheet: `l10n:maratonaLinkFromQueue` "Da sua Fila" or `l10n:maratonaLinkFromWatched` "Do Já assisti" (the user's watched system shelf). `l10n:maratonaUnlink` "Remover" unties. The first movie completes the challenge, removing the last undoes it.
- **auto-complete:** a completed session logged with a watch date inside an active maratona's period completes every challenge whose criteria match (genres, decades, countries, original language, runtime min/max, TMDB vote). Imports never count.
- **queue:** "Minha Fila" lists the queue shelf (`l10n:maratonaQueueEmpty` when empty, `l10n:maratonaQueueJoin` before joining) with `l10n:maratonaQueueOpen` "Abrir estante" → `ShelfDetailRoute`.
- **discovery:** pick a challenge with criteria (`l10n:maratonaDiscoveryPick`); suggested movies paged; long-press adds to the queue (`l10n:maratonaAddedToQueue`). No criteria anywhere: `l10n:maratonaDiscoveryNone`.
- **ranking:** participants by completed challenges, 20 per page with "Carregar mais"; a toggle `l10n:maratonaRankingUsers` / `l10n:maratonaTeams` appears when the maratona has teams. Empty: `l10n:maratonaRankingEmpty`.
- **editor:** `l10n:maratonaEditorNewTitle` / `l10n:maratonaEditorEditTitle`, four steps `l10n:maratonaStepDetails` "Dados", Desafios, `l10n:maratonaStepLevels` "Níveis e equipes", `l10n:maratonaStepPrizes` "Prêmios e privacidade". New ones start from `l10n:maratonaEditorFromScratch` "Começar do zero" (30-day period from today) or one of 5 templates (`l10n:maratonaEditorTemplates`) that prefill the form. Address `l10n:maratonaFieldSlug` (3–50 of `a-z0-9-`, checked live 400 ms debounced, create only, `l10n:maratonaSlugTaken`). At least 3 challenges (`l10n:maratonaMinChallengesError`); criteria per challenge in a bottom sheet (`l10n:maratonaCriteria`). Create replaces the editor with the new detail; edit pops back and reloads.
- **edit / cancel:** a menu with `l10n:maratonaEdit` "Editar" and `l10n:maratonaCancel` "Cancelar maratona" shows for owners/co-owners while upcoming or active. After the start only texts, logo, color, link and prizes change (`l10n:maratonaStartedNote`). Cancel is final (`l10n:maratonaCancelMessage`).
- **lifecycle:** an hourly scheduler starts maratonas on `startsOn`, finishes them the day after `endsOn`, records "concluiu a maratona" for whoever reached their level, and pushes `maratona_started` / `maratona_finished` to participants.

## How to get to it (user POV)
Programação › Maratonas › card. Also: Atts feed activity cards; Catálogo discover search; Perfil › `l10n:profileTabParticipations` "Participações"; a movie's `l10n:movieMaratonasSection` "Maratonas em que contou"; onboarding suggestions; push `maratona_started` / `maratona_finished`; link `https://muuvie.app/m/<slug>`. Create: Programação › Maratonas › Criar maratona. Edit: detail › menu › Editar.

## Where it lives
### App
- Routes: `MaratonaDetailRoute` (`slug`, `title`; also root path `/m/:slug`), `MaratonaEditorRoute` (`slug` null = create)
- Detail: `muuvie/ui/maratonas/lib/detail` (`maratona_detail_page.dart`, `maratona_detail_bloc.dart`, tabs `about_tab.dart`, `challenges_tab.dart`, `queue_tab.dart`, `discovery_tab.dart`, `ranking_tab.dart`, `progress_feed.dart`; sheets `join_sheet.dart`, `challenge_sheet.dart`, `movie_picker_sheet.dart`)
- Editor: `muuvie/ui/maratonas/lib/editor` (`maratona_editor_page.dart`, `maratona_editor_bloc.dart`, `maratona_editor_screen.dart`, `criteria_sheet.dart`)
- Data: `muuvie/features/maratonas/data/lib/datasources/maratonas_remote_data_source.dart`; progress feed in `muuvie/features/social_network/data/lib/datasources/social_network_remote_data_source.dart`; queue and picker use shelves (`GET /shelves/{id}/movies`, `GET /users/{userId}/shelves`, `POST /movies/{id}/shelves`, see [shelves](shelves.md))
- Entry points: `muuvie/lib/routes/app_router.dart` (`profileDeepLink`), `muuvie/lib/push/push_route.dart`, `muuvie/lib/routes/app_movie_detail_links.dart`
### Backend
Handlers in `backend/src/main/kotlin/org/mobyle/routing/MaratonasRouting.kt`; use cases in `backend/src/main/kotlin/org/mobyle/domain/usecase/maratonas/MaratonaUseCases.kt` unless noted.

| Endpoint | Auth | Use case |
|---|---|---|
| `GET /maratonas/{slug}` | optional (adds `me`, `canEdit`) | `GetMaratona` |
| `GET /maratonas/{slug}/challenges` | optional (adds the viewer's links) | `GetMaratonaChallenges` |
| `POST /maratonas/{slug}/participation` | required | `JoinMaratona` (201) |
| `DELETE /maratonas/{slug}/participation` | required | `LeaveMaratona` (204) |
| `PUT /maratonas/{slug}/challenges/{id}/links/{movieId}` | required | `SetChallengeLink` |
| `DELETE /maratonas/{slug}/challenges/{id}/links/{movieId}` | required | `SetChallengeLink` |
| `GET /maratonas/{slug}/challenges/{id}/suggestions` | none | `GetChallengeSuggestions` |
| `GET /maratonas/{slug}/ranking` | none | `GetMaratonaRanking` (`by=user` paged, `by=team`) |
| `GET /maratonas/{slug}/progress` | optional | `GetMaratonaProgress` (cursor, 20) |
| `GET /maratona-templates` | none | `GetMaratonaTemplates` in `backend/src/main/kotlin/org/mobyle/domain/usecase/maratonas/MaratonaTemplates.kt` |
| `GET /maratonas/slug-available` | none | `CheckMaratonaSlug` |
| `POST /maratonas` | required | `CreateMaratona` (201); validation in `backend/src/main/kotlin/org/mobyle/domain/usecase/maratonas/MaratonaInput.kt` |
| `PUT /maratonas/{slug}` | required, owner or co-owner | `UpdateMaratona` |
| `POST /maratonas/{slug}/cancel` | required, creator only | `CancelMaratona` |
| `POST /maratonas/from-template/{templateId}` (not called by the app) | required | `CreateMaratonaFromTemplate` |
| `PUT /maratonas/{slug}/owners` (not called by the app) | required, creator only | `SetMaratonaCoOwners` (max 10) |

Background: `backend/src/main/kotlin/org/mobyle/domain/usecase/maratonas/AdvanceMaratonas.kt` (hourly, from `Main.kt`), `backend/src/main/kotlin/org/mobyle/domain/usecase/maratonas/MaratonaAutoLinker.kt` (on session logged).

## Driving it
```bash
API=http://localhost:8080/api/v1; H="Authorization: Bearer $TOKEN"; J='Content-Type: application/json'
curl -s -X POST $API/maratonas -H "$H" -H "$J" -d '{"slug":"terror-30","title":"Terror 30","startsOn":"2026-10-31","endsOn":"2026-11-29",
  "categories":[{"name":"Clássicos","challenges":[{"description":"Um terror","criteria":{"all":[{"field":"genre","op":"in","value":[27]}]}},
  {"description":"Um filme dos anos 80"},{"description":"Um filme brasileiro"}]}]}'
curl -s -X POST $API/maratonas/terror-30/participation -H "$H" -H "$J" -d '{}'
curl -s "$API/maratonas/terror-30/challenges" -H "$H"            # ids
curl -s -X PUT "$API/maratonas/terror-30/challenges/<id>/links/<movieId>" -H "$H"
curl -s "$API/maratonas/terror-30/ranking?by=user"; curl -s "$API/maratonas/terror-30/progress"
```
App: push `MaratonaDetailRoute(slug: 'terror-30')`; the `/m/terror-30` link needs the app's link domain on the device.

## Gotchas
- Status is stored, not computed on read: a maratona created with `startsOn` = today is active at once, but one that should have started waits for the hourly scheduler (also run on boot).
- Marking needs status active (409 `maratona_not_active`); joining and leaving work while upcoming too. Leaving a finished one is a 409.
- Owners and co-owners see Cancelar, but only the creator may cancel: a co-owner gets 403 and the generic `l10n:maratonaActionError`. Co-owners can only be set through `PUT /maratonas/{slug}/owners`, which no screen calls.
- Templates are a prefill: the app posts the filled form to `POST /maratonas`; `CreateMaratonaFromTemplate` exists in the app's DI and data layer but no screen uses it, so the `templateId` is never recorded from the app.
- Suggestions of a challenge without criteria are an empty page, not an error.
- The progress feed comes from the social-network package, not the maratonas one; it lists activities (joined, completed a challenge, finished).
- Server limits: 1–20 categories, 1–50 challenges each, 3–200 in total, ≤ 10 levels, ≤ 20 teams and prizes, ≤ 366 days, password 4–72 characters; a new maratona cannot end in the past.
