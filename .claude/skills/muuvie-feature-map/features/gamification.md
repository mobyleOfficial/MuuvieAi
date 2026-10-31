# Gamification

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

Three personal, full-screen modals opened from the user's own profile: the pet shelter (`l10n:petShelterTitle` "Vaquinha da Bombonière"), the weekly missions (`l10n:missionsTitle` "Missões") and the private diary (`l10n:diaryTitle` "Caderninho"). Pets grow with XP from logged sessions and missions; the pinned pet shows on the profile, including to other users. The watch party and poster game buttons in the same profile row belong to [games](games.md).

## Sub-features
- **profile row:** on the own profile, the pinned pet as a chip "{name} · `l10n:petLevel` Nível {level}" (tap → shelter) or `l10n:petAdopt` "Adotar uma vaquinha", then Missões, Caderninho, Sessão sincronizada, Jogo do Pôster. On someone else's profile, only their pinned pet (not tappable), and nothing if they have none. The row reloads after any of these modals closes.
- **starter:** until one is chosen the shelter shows only the 3 starters, `l10n:petStarterTitle` "Escolha seu balde de pipoca" / `l10n:petStarterMessage`: `l10n:petPipocaDoce`, `l10n:petPipocaSalgada`, `l10n:petPipocaCaramelo`. Choosing asks `l10n:petStarterConfirmTitle` "Adotar {name}?" (`l10n:petStarterConfirm` "Adotar"); it is permanent and pinned. Pets the user already earned unlock at once.
- **shelter:** the pinned pet with `l10n:petLevel`, an XP bar `l10n:petXp` "{xp} de {next} XP" and `l10n:petXpHelp` ("Cada filme concluído dá 20 XP, mais 1 a cada 10 minutos. Importações não contam."); `l10n:petUnlocked` list with rarity and a `l10n:petPin` "Mostrar no meu perfil" action; `l10n:petLocked` "Para desbloquear" list with the rule (`l10n:petRuleMovies`, `l10n:petRuleMinutes`, `l10n:petRuleHorror`, `l10n:petRuleSciFi`, `l10n:petRuleOldMovies`, `l10n:petRuleCineclubes`, `l10n:petRuleMaratonas`, `l10n:petRuleMissions`) and "progress/target". 11 unlockable pets: common (claquete 10 movies, ingresso 1000 min, fantasminha 5 horror, robozinho 5 sci-fi, lanterninha 1 CineClube), rare (rolo-de-filme 50 movies, dinossauro 10 pre-1970, coruja 10 missions, trofeu 1 maratona), legendary (projetor 30000 min, estatueta 250 movies).
- **xp:** per logged session 20 XP if completed + 1 per 10 minutes watched (max 30), added to the pinned pet only (no pet pinned, no XP kept); level n needs 50·n·(n−1) XP, max level 50. Missions add their XP. Each log also re-checks missions and unlocks.
- **missions:** `l10n:missionsWeek` "Semana de {start} a {end}" (Monday–Sunday), `l10n:missionsHelp`, 3 missions picked from a pool of 14 by the week number, the same for everyone: progress bar, `l10n:missionXp` "+{xp} XP", `l10n:missionDone` "Cumprida!". Texts: `l10n:missionSessions`, `l10n:missionMovies`, `l10n:missionEmotions`, `l10n:missionLongMovie`, `l10n:missionClassic`, `l10n:missionDocumentary`, `l10n:missionHorror`, `l10n:missionAnimation`, `l10n:missionAsia`, `l10n:missionAfrica`, `l10n:missionBrazil`, `l10n:missionCineclube`, `l10n:missionChallenge`. Error state with retry.
- **diary day:** opens today (`l10n:diaryToday` "Hoje"); previous/next day buttons (`l10n:diaryPreviousDay`, `l10n:diaryNextDay`), a date picker (2000 to today) and a month strip with each written day's mood emoji. `l10n:diaryMood` "Como foi o seu dia?" with 5 moods (`l10n:moodGreat` … `l10n:moodAwful`); `l10n:diaryGoals` "Metas ({count} de {max})", max 6, added with `l10n:diaryAddGoal` (category chips `l10n:diaryCategoryMovie`, `l10n:diaryCategoryShort`, `l10n:diaryCategorySeries`, `l10n:diaryCategoryStudy`, `l10n:diaryCategoryOther`; text ≤ 200), checked, reordered (`l10n:diaryReorder`) and removed; `l10n:diaryNote` "Desabafo" (≤ 5000); `l10n:diaryPrivate`. The year's goal from [stats](stats.md) (`GET /users/{userId}/goals/{year}`) shows on top when set.
- **diary save:** nothing is saved until Salvar; `l10n:diarySaved` "Dia salvo" or `l10n:maratonaSaveError`. Saving an empty day deletes it. Leaving or changing day with edits asks `l10n:diaryDiscardTitle` "Sair sem salvar?".
- **diary year:** app bar `l10n:diaryYearTitle` "Ano de humores" opens a bottom sheet: `l10n:diaryYearOf`, `l10n:diaryYearDays`, `l10n:diaryYearTop` and per-month mood counts.

## How to get to it (user POV)
Perfil (own) › the row under the header › pet chip or "Adotar uma vaquinha" (shelter), "Missões", "Caderninho". All open as slide-up modals over the shell. No deep links.

## Where it lives
### App
- Routes: `ShelterRoute`, `MissionsRoute`, `DiaryRoute` (root-level `CustomRoute`s, slide from bottom)
- Screens and state: `muuvie/ui/gamification/lib/shelter`, `muuvie/ui/gamification/lib/missions`, `muuvie/ui/gamification/lib/diary` (page, screen, Cubit, state each); labels in `muuvie/ui/gamification/lib/widgets/gamification_labels.dart`
- Profile row: `muuvie/ui/gamification/lib/widgets/profile_gamification_row.dart`, placed by `muuvie/ui/profile/lib/member/member_profile_view.dart`
- Data: `muuvie/features/gamification/data/lib/datasources/gamification_remote_data_source.dart`; use cases `muuvie/features/gamification/domain/lib/usecases/gamification.dart`
### Backend
Handlers in `backend/src/main/kotlin/org/mobyle/routing/GamificationRouting.kt`; use cases in `backend/src/main/kotlin/org/mobyle/domain/usecase/gamification/GamificationUseCases.kt`; catalogs and XP in `backend/src/main/kotlin/org/mobyle/domain/policy/GamificationRules.kt`.

| Endpoint | Auth | Use case |
|---|---|---|
| `GET /users/me/pets` | required | `GetPetShelter` (catalog with locked ones) |
| `POST /users/me/pets/starter` | required | `ChooseStarterPet` (201; body `{"slug"}`) |
| `PUT /users/me/pets/{slug}/pin` | required | `PinPet` |
| `GET /users/{userId}/pets` | none | `GetPetShelter.public` (unlocked only; id or handle) |
| `GET /users/me/missions` | required | `WeeklyMissions` |
| `GET /users/me/diary/{date}` | required | `GetDiaryDay` |
| `PUT /users/me/diary/{date}` | required | `SaveDiaryDay` |
| `GET /users/me/diary` | required | `GetDiaryMonth` (`month=YYYY-MM`) |
| `GET /users/me/diary/summary/{year}` | required | `GetDiaryYear` |

Session hook: `GamificationHook.sessionLogged` (same file) runs after a session is logged; imports skip it.

## Driving it
```bash
API=http://localhost:8080/api/v1; H="Authorization: Bearer $TOKEN"; J='Content-Type: application/json'
curl -s $API/users/me/pets -H "$H"
curl -s -X POST $API/users/me/pets/starter -H "$H" -H "$J" -d '{"slug":"pipoca-doce"}'
curl -s $API/users/me/missions -H "$H"
curl -s -X PUT $API/users/me/diary/2026-10-31 -H "$H" -H "$J" \
  -d '{"mood":"great","note":"Maratona de terror","tasks":[{"category":"movie","description":"Ver Rashomon"}]}'
curl -s "$API/users/me/diary?month=2026-10" -H "$H"; curl -s $API/users/me/diary/summary/2026 -H "$H"
```
App: Perfil › row buttons, or push the routes on the root router.

## Gotchas
- The UI says "vaquinha"; code and API say pet / bichinho. Slugs are stable ids (`pipoca-doce`…), names come from `petName` in the labels file.
- `POST /users/me/pets/starter` twice is a 409 `starter_chosen`; a non-starter slug is a 400. Pinning a pet not owned is a 404.
- Missions are completed lazily: XP is granted when `GET /users/me/missions` or a session log notices the target, once per mission per week.
- Reading a diary day never creates it (`saved=false`). A date more than one day ahead of the server's today is a 400 (one day of slack for time zones); the app never goes past its own today.
- Diary moods on the wire: `great`, `good`, `okay`, `bad`, `awful`; categories `movie`, `short`, `series`, `study`, `other`.
- The own profile calls `GET /users/me/pets` (full shelter) through the same `getPetsOf('me')` call that hits `GET /users/{userId}/pets` for others.
