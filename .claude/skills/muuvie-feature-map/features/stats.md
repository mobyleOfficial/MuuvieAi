# Stats

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

A profile's Gráficos tab: a year picker, a yearly movie goal, totals and charts, and a session calendar. From there the owner can open the year's retrospective, a full-screen run of stories that can be shared as images. The charts appear on any profile; the goal editor and the retrospective are only on your own.

## Sub-features
- **year-picker:** chips for the current year plus every year with sessions visible to the viewer (`GET /users/{userId}/stats/years`), newest first.
  - It opens on the current year when that year has sessions or no year does; otherwise on the latest year with sessions.
  - Switching year shows a linear progress bar while `GET /users/{userId}/stats/{year}`, `GET /users/{userId}/stats/{year}/calendar` and `GET /users/{userId}/goals/{year}` load in parallel.
  - Only a stats failure shows the error state ("Algo deu errado" and retry). A failed calendar shows no days; a failed goal shows no goal.
- **goal (own, current or next year only):**
  - With no goal, the card reads "Defina quantos filmes você quer assistir em {year}." (`l10n:chartsGoalPrompt`), next to "Definir meta" (`l10n:chartsGoalSet`).
  - The prompt is "Meta de filmes do ano" (`l10n:chartsGoalTitle`), confirmed with "Salvar meta" (`l10n:chartsGoalSave`). It accepts 1–5000 and otherwise shows "Digite um número entre 1 e 5000." (`l10n:chartsGoalInvalid`). It sends `PUT /users/me/goals/{year}`; a failure shows "Não deu certo. Tente de novo." (`l10n:maratonaActionError`).
  - With a goal, the card reads "{watched} de {target} filmes em {year}" (`l10n:chartsGoalProgress`), plus "Meta batida!" (`l10n:chartsGoalReached`) once reached. Its "Mais opções" menu has "Editar" and "Remover" (`l10n:maratonaEdit`, `l10n:maratonaRemove`). Remover sends `DELETE /users/me/goals/{year}`, and a failed removal is silent.
  - Another user's goal shows read-only when it exists.
- **charts:** the totals are filmes, horas na frente da tela, sessões and revistos (`l10n:chartsMovies`, `l10n:chartsHours`, `l10n:chartsSessions`, `l10n:chartsRewatches`). Then come the sections:
  - Filmes por mês (`l10n:chartsMonths`)
  - Gêneros, with "Outros" (`l10n:chartsGenres`)
  - Décadas (`l10n:chartsDecades`)
  - Países, Idiomas (`l10n:chartsCountries`, `l10n:chartsLanguages`)
  - Onde você assistiu (`l10n:chartsVenues`)
  - Diretores (`l10n:chartsDirectors`)
  - Emoções, top 12 (`l10n:chartsEmotions`)
  - Avaliações (`l10n:chartsRatings`)
  - Calendário, captioned "Sessões em N dias" (`l10n:chartsCalendar`, `l10n:chartsCalendarSummary`)

  A section with no data is hidden. A year with no sessions shows "Nenhuma sessão neste ano" / "As sessões registradas no ano aparecem aqui em gráficos." (`l10n:chartsEmptyTitle`, `l10n:chartsEmptyMessage`).
- **retrospective:** on your own profile, when the year has more than 0 movies, the button reads "Ver a retrospectiva de {year}" (`l10n:chartsOpenRetrospective`). It opens `RetrospectiveRoute(year)`, which slides up and calls `GET /users/me/retrospectives/{year}`.
  - Stories, in order: intro ("Seu ano no cinema"); totals; top genres; top directors and actors; the year's emotion; favorite movie with its rating; best month, maratonas finished, cineclubes joined and goal progress; outro ("Até a próxima sessão"). The stories with no data are skipped.
  - Navigation: tap the right two thirds to go forward and the left third to go back; swiping also works. A progress bar runs across the top.
  - "Compartilhar este story" (`l10n:retrospectiveShare`) shares the current story as a PNG, `muuvie-<year>.png`, with the text "Meu {year} em filmes no Muuvie" (`l10n:retrospectiveShareText`).
  - A 404 (no completed movie that year) shows "Nenhum filme concluído neste ano ainda" (`l10n:retrospectiveEmpty`).

## How to get to it (user POV)
Perfil › Gráficos tab (`l10n:profileTabCharts`) › "Ver a retrospectiva de {year}". The same tab exists, read-only, on any [public-profile](public-profile.md).

## Where it lives
### App
- Routes: `RetrospectiveRoute`, a root `CustomRoute` with a slide-bottom transition.
- Screens and state:
  - `muuvie/ui/profile/lib/tabs/charts`: `ChartsPage` (prompt and gating), `ChartsCubit`, `ChartsScreen` and the chart widgets
  - `muuvie/ui/profile/lib/retrospective`: page (share), `RetrospectiveCubit`, story screen
- Data:
  - `muuvie/features/stats/data/lib/datasources/stats_remote_data_source.dart`
  - Use cases in `muuvie/features/stats/domain/lib/usecases/stats.dart`. `SetYearlyGoal` with `null` removes the goal.
  - The Caderninho ([gamification](gamification.md)) also reads `GET /users/{userId}/goals/{year}` for `me`.
### Backend
The endpoints are in `backend/src/main/kotlin/org/mobyle/routing/StatsRouting.kt`; the use cases are in `backend/src/main/kotlin/org/mobyle/domain/usecase/stats/StatsUseCases.kt`.

| Endpoint | Auth | Use case |
|---|---|---|
| `GET /users/{userId}/stats/years` | `me`: required, else optional | `GetStatsYears` |
| `GET /users/{userId}/stats/{year}` | `me`: required, else optional | `GetYearStats` |
| `GET /users/{userId}/stats/{year}/calendar` | `me`: required, else optional | `GetStatsCalendar` |
| `GET /users/{userId}/goals/{year}` | `me`: required, else optional | `GetYearlyGoal` |
| `PUT /users/me/goals/{year}` | required | `SetYearlyGoal` |
| `DELETE /users/me/goals/{year}` | required | `SetYearlyGoal.remove` (204) |
| `GET /users/me/retrospectives/{year}` | required | `GetRetrospective` |
| `GET /users/me/retrospectives` (not called by the app) | required | `GetRetrospective.years`. The app registers `GetRetrospectiveYears` in DI, but no screen uses it |

## Driving it
```bash
H="Authorization: Bearer $TOKEN"; A=http://localhost:8080/api/v1; Y=$(date +%Y)
curl -s -H "$H" $A/users/me/stats/years                  # {"years":[…]}
curl -s -H "$H" $A/users/me/stats/$Y
curl -s -H "$H" $A/users/me/stats/$Y/calendar
curl -s -X PUT -H "$H" -H 'Content-Type: application/json' $A/users/me/goals/$Y -d '{"targetMovies":100}'
curl -s -H "$H" $A/users/me/goals/$Y                     # 404 when no goal
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE -H "$H" $A/users/me/goals/$Y   # 204, then 404
curl -s -H "$H" $A/users/me/retrospectives/$Y            # 404 without a completed session
```
In the app, push `RetrospectiveRoute(year: 2025)` to skip the tab.

## Gotchas
- Every year parameter is validated: outside 1900 to next year it is a 400 `validation_failed` (`year`). A goal is accepted only for this year or the next, with a target from 1 to 5000.
- The app offers the goal for the current year or the next, but the chips list the next year only once it has sessions. In practice, only the current year's goal can be set.
- `GET /users/{userId}/goals/{year}` answers 404 when there is no goal. The app reads that as "no goal", so a real error looks the same.
- The charts count only the sessions the viewer may see (`VisibilityPolicy`). The retrospective always counts all of the owner's sessions.
- Retrospectives exist for the owner only (`/users/me/...`); there is no way to see someone else's.
- The profile's own counters endpoint `GET /users/{userId}/stats` (UsersRouting) is a different thing and is on [profile](profile.md) as not called.
