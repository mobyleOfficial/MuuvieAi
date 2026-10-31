# Profile

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

The signed-in user's own profile, the root of the Perfil tab: a header (banner, avatar, name, @handle, bio, links, counters), shortcuts, and six tabs. It also covers Editar perfil and the Destaques editor. The screen is `MemberProfileView` with `userId: 'me'`. [public-profile](public-profile.md) renders the same view for someone else, so the header and tabs below describe both. Two tabs are mapped elsewhere: Estantes in [shelves](shelves.md) and Locadoras in [locadoras](locadoras.md). Gráficos is in [stats](stats.md).

## Sub-features
- **header:** loads `GET /users/me`. While loading it shows a spinner; on error it shows "Algo deu errado" (`l10n:emptyStateErrorTitle`) with "Tentar novamente" (`l10n:emptyStateRetry`).
  - Counters, scrolling sideways: Assistidos (`l10n:profileStatWatched`), Estantes, Locadoras, Registros, Maratonas, CineClubes (`l10n:profileStatCineclubes`), Participações, Seguidores, Seguindo. Only the last two are tappable (they open [follows](follows.md)).
  - Without a handle, a "Escolha seu @ para os amigos te acharem" button (`l10n:profilePickHandleTip`) opens the editor.
  - Links open in the external browser. The accent color tints the banner fallback, the avatar ring and the main button.
  - The header reloads whenever the screen comes back into view, either back on top of its stack or its tab selected again. It also reloads when the legacy `GET /profile` stream changes `isScraping` or the watched count, which happens over the import WebSocket.
- **actions (own profile):**
  - Gear "Configurações" (`l10n:settingsTitle`) goes to [settings](settings.md); the header reloads if that screen pops `true`.
  - Share "Compartilhar perfil" (`l10n:profileShare`) only appears with a handle. It shares "{name} no Muuvie: {link}" (`l10n:profileShareText`) with the link `https://muuvie.app/@<handle>`.
  - "Editar perfil" (`l10n:profileEditProfile`) opens the editor.
- **shortcuts:**
  - A "Assistindo agora" card (`l10n:watchingNowTitle`, see [watch-logs](watch-logs.md)).
  - A row with the pinned pet, or "Adotar uma vaquinha" (`l10n:petAdopt`), followed by Missões, Caderninho, Watch party and Poster game, all in [gamification](gamification.md) and [games](games.md). The row reloads when one of them closes.
- **tabs:** Destaques · Estantes · Registros · Locadoras · Participações · Gráficos (`l10n:profileTabHighlights`, `l10n:profileTabShelves`, `l10n:profileTabLogs`, `l10n:profileTabLocadoras`, `l10n:profileTabParticipations`, `l10n:profileTabCharts`). They scroll sideways and are kept alive.
- **destaques-tab:** `GET /users/me/highlights` returns every section; the tab shows only the enabled ones, in the order saved. The four sections:
  - Top 4: poster row; a tap opens the movie.
  - Estante em destaque, Locadora em destaque: a card that opens the shelf or locadora.
  - Trilha sonora: "Ouvir no Spotify" or "Ouvir no YouTube Music".

  "Editar destaques" (`l10n:highlightsEdit`) sits at the top. When nothing is enabled, the empty state reads "Mostre seu gosto" / "Escolha um top 4, uma estante, uma locadora e uma trilha sonora." (`l10n:highlightsEmptyOwnTitle`, `l10n:highlightsEmptyOwnMessage`) and its action opens the editor. Pull to refresh also reloads the header.
- **highlights-editor:** `HighlightsEditorRoute` slides up. There is one card per type, with a drag handle to reorder. Each card shows its summary or "Não definido" (`l10n:highlightNotSet`) and an "Escolher" or "Trocar" button (`l10n:highlightChoose`, `l10n:highlightChange`). Its switch is disabled until the slot is configured.
  - Top 4 opens `TopMoviesPicker`, a `Navigator` push of a `MaterialPageRoute` rather than a router route. It lists the user's system "watched" shelf: it finds the shelf by scanning up to 3 pages of `GET /users/{userId}/shelves`, then loads `GET /shelves/{id}/movies`. The user picks up to 4 movies in order; the title reads "{count} de 4" (`l10n:highlightTop4Count`). The empty state is `l10n:highlightTop4Empty`; "Concluir" confirms.
  - Estante opens the shelf-picker bottom sheet.
  - Locadora opens a sheet backed by `GET /users/{userId}/locadoras`.
  - Trilha sonora opens a text prompt that accepts only open.spotify.com or music.youtube.com links (`l10n:highlightSoundtrackInvalid`).
  - "Salvar" (`l10n:editProfileSave`) sends `PUT /users/me/highlights` with the configured slots only, in order, and pops `true`; the tab reloads. A failure shows "Não foi possível salvar os destaques" (`l10n:highlightsSaveError`).
- **registros-tab:** `GET /users/{userId}/logs` lists every session, newest first, under its movie. It pages infinitely. When empty it shows "Seus registros aparecem aqui." (`l10n:diaryEmptyOwn`). A tap opens the movie.
- **participacoes-tab:** maratonas the profile joined, via `GET /maratonas` with `participant=<userId>`. It loads more near the end. When empty it shows "Você ainda não entrou em nenhuma maratona." (`l10n:maratonaParticipatingEmpty`).
- **edit-profile:** `EditProfileRoute` slides up.
  - Fields:
    - Nome (`l10n:editProfileDisplayNameLabel`), up to 50 characters.
    - @ (`l10n:editProfileHandleLabel`), 5–30 of `a-z0-9_.`. It is checked 400 ms after typing stops with `GET /handles/{handle}/available`, showing "Verificando…", "Disponível", "Este @ já está em uso" or the invalid hint (`l10n:editProfileHandleChecking`, `l10n:editProfileHandleAvailable`, `l10n:editProfileHandleTaken`, `l10n:editProfileHandleInvalid`).
    - Pronomes, up to 30 characters.
    - Bio, up to 500 characters.
    - Links: up to 5, via "Adicionar link" (`l10n:editProfileAddLink`).
    - Cor de destaque: "Padrão" (`l10n:editProfileAccentDefault`) or a color.
    - Foto e banner: URLs only (`l10n:editProfileImagesHint`).
  - "Salvar" sends `PUT /users/me`. Errors show as snackbars: 409 gives "Este @ já está em uso", 400 gives `l10n:editProfileInvalidField`, anything else gives `l10n:editProfileSaveError`. On success the screen pops `true` and the header reloads.
  - "Importar dados do Filmow" (`l10n:editProfileImportFilmow`) goes to [imports](imports.md); it is disabled while an import runs.
  - "Sair da conta" (`l10n:editProfileLogout`) asks for confirmation, then logs out (see [auth](auth.md)).

## How to get to it (user POV)
Bottom bar › Perfil (`l10n:profile`); the tab requires login. From there, Editar perfil, or Destaques › Editar destaques. The same screen opens from the Perfil tab's stack only. Other tabs reach a profile through [public-profile](public-profile.md).

## Where it lives
### App
- Routes: `ProfileTab`, `ProfileRoute`, `EditProfileRoute`, `HighlightsEditorRoute`. The top 4 picker is not a route.
- Screens and state:
  - `muuvie/ui/profile/lib/profile_page.dart`
  - `muuvie/ui/profile/lib/member/member_profile_view.dart`, with `MemberProfileCubit` in `muuvie/ui/profile/lib/member/member_profile_bloc.dart`
  - `muuvie/ui/profile/lib/member/profile_header.dart`
  - `muuvie/ui/profile/lib/member/highlights`, which holds the tab, the editor and `muuvie/ui/profile/lib/member/highlights/top_movies_picker.dart`
  - `muuvie/ui/profile/lib/member/diary/diary_tab.dart`
  - `muuvie/ui/profile/lib/tabs/participations`
  - `muuvie/ui/profile/lib/edit_profile`
- Data:
  - `muuvie/features/profile/data/lib/datasources/profiles_remote_data_source_impl.dart` (v1)
  - The legacy `muuvie/features/profile/data/lib/datasources/profile_remote_data_source_impl.dart`, wrapped by the WebSocket-aware `muuvie/features/profile/data/lib/repositories/profile_repository_impl.dart`
  - `GetUserDiary` in `muuvie/features/watch_logs/data/lib/datasources/watch_logs_remote_data_source.dart`
### Backend
| Endpoint | Auth | Use case |
|---|---|---|
| `GET /users/me` | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/users/GetMyProfile.kt` |
| `PUT /users/me` | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/users/UpdateMyProfile.kt` (rules in `backend/src/main/kotlin/org/mobyle/domain/usecase/users/ProfileInput.kt`) |
| `GET /handles/{handle}/available` | optional | `backend/src/main/kotlin/org/mobyle/domain/usecase/users/CheckHandleAvailability.kt` |
| `GET /users/me/highlights` | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/users/GetProfileHighlights.kt` |
| `PUT /users/me/highlights` | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/users/SaveProfileHighlights.kt` |
| `GET /users/{userId}/logs` | `me`: required, else optional | `backend/src/main/kotlin/org/mobyle/domain/usecase/watch/GetUserDiary.kt` |
| `GET /profile` | required | inline in `backend/src/main/kotlin/org/mobyle/routing/ProfileRouting.kt` (legacy: counts, recent movies, `isScraping`) |
| `PUT /profile` (not called by the app) | required | `backend/src/main/kotlin/org/mobyle/domain/usecase/profile/UpdateUserProfile.kt` |
| `GET /users/{userId}/stats` (not called by the app) | optional | `backend/src/main/kotlin/org/mobyle/domain/usecase/users/GetProfileStats.kt` |

`GET /maratonas` (Participações) is described in [maratonas](maratonas.md).

## Driving it
```bash
H="Authorization: Bearer $TOKEN"; A=http://localhost:8080/api/v1
curl -s -H "$H" $A/users/me                         # header + stats, isScraping
curl -s $A/handles/cinefila/available               # {"handle","available","reason"?}
curl -s -X PUT -H "$H" -H 'Content-Type: application/json' $A/users/me \
  -d '{"displayName":"Ana","handle":"cinefila","links":["https://letterboxd.com/ana"],"accentColor":"#E91E63"}'
curl -s -X PUT -H "$H" -H 'Content-Type: application/json' $A/users/me/highlights \
  -d '{"highlights":[{"type":"soundtrack","soundtrackUrl":"https://open.spotify.com/track/x"}]}'
curl -s -H "$H" "$A/users/me/logs?page=1"
```
The app opens on `ProfileRoute`, the initial child of `ProfileTab`.

## Gotchas
- `PUT /users/me` replaces every field: a blank optional field becomes null, so clearing Bio removes it. Only the handle is kept when omitted, which means a handle can never be cleared once set.
- Backend limits on a 400 (`field` in `details`):
  - Handle: `^[a-z0-9_.]{5,30}$`.
  - Links: ≤ 5, `http(s)`, ≤ 200 characters each.
  - Image URLs: ≤ 500 characters.
  - Accent color: `#RRGGBB`, stored uppercase.
  - Highlights: at most one of each type; Top 4 holds 1–4 known movies; the shelf and locadora must be the user's own.
- `CheckHandleAvailability` counts the viewer's own handle as available. The app skips the check when the typed handle equals the current one.
- Saving a newly featured, enabled shelf publishes an `estante_destaque` activity to the feed ([social-feed](social-feed.md)).
- Ktor matches the literal `/users/me...` routes before `/users/{userId}...`. That is why `'me'` works for the header and the highlights; through the `{userId}` routes it would 404.
- Legacy `GET /profile` runs once at startup (when `ProfileRepositoryImpl` is built) and again when an import ends. Besides this header, it feeds the import banner on the main screen ([app-shell](app-shell.md)). The legacy `PUT /profile` (username, bio, photoUrl) still has a datasource and a DI-registered `UpdateUserProfile`, but no screen calls it.
- The empty text of Participações is written in the first person, even on someone else's profile.
