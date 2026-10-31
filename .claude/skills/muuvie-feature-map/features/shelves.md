# Shelves

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

Estantes: named, colored lists of movies with a visibility. Every user has two system shelves, "Já assisti" and "Quero ver" (`l10n:systemShelfWatched`, `l10n:systemShelfWatchlist`), created on first read, plus their own. Covers the Estantes tab of a profile (own: editable; others': read-only), a shelf's detail, adding movies to shelves, saving other people's shelves ("Salvas") and the public "Estantes com este filme" list. Grouping shelves into locadoras is in [locadoras](locadoras.md).

## Sub-features
- **list:** profile tab "Estantes" (`l10n:profileTabShelves`). It loads every page (up to 10 × 20) of `GET /users/{userId}/shelves?profile=true`: pinned first, then profile order. Each card shows the name, a pin icon, "{watched}/{total} assistidos" (`l10n:shelfWatchedOfTotal`), a visibility chip and up to a row of posters. Loading is a spinner; an error shows "Algo deu errado" (`l10n:emptyStateErrorTitle`) with the server message and "Tentar novamente" (`l10n:emptyStateRetry`). Pull to refresh.
  - Owner only: FAB "Nova estante" (`l10n:shelfNew`), a "+" "Adicionar filmes" (`l10n:shelfAddMovies`) on each card, and a ⋮ menu: "Editar" (`l10n:shelfEdit`), "Fixar no topo" / "Desafixar" (`l10n:shelfPin`, `l10n:shelfUnpin`), and "Excluir estante" (`l10n:shelfDelete`), which is not offered on system shelves. Delete asks "Excluir "{name}"?" / "Os filmes continuam no seu histórico." (`l10n:shelfDeleteConfirmTitle`, `l10n:shelfDeleteConfirmMessage`).
  - Toolbar (owner only): "Salvas" (`l10n:savedShelvesAction`) and "Reordenar estantes" (`l10n:shelfReorder`), a drag list closed by "Concluir" (`l10n:shelfReorderDone`), which sends `PUT /users/me/shelves/order`. Pin/unpin sends the same call with `pinnedIds`.
  - Any failed action: snackbar "Não deu para concluir. Tente de novo." (`l10n:shelfActionError`).
- **shelf-form (bottom sheet):** `ShelfFormBottomSheet.show` (a `MuuvieBottomSheet`), title "Nova Estante" / "Editar estante" (`l10n:createShelfTitle`, `l10n:editShelfTitle`). Fields: name "Qual o nome da sua estante?" (`l10n:createShelfNamePrompt`), description "(opcional)" with an `n/150` counter (`l10n:createShelfDescriptionPrompt`), color "Escolha uma cor para sua estante" (`l10n:createShelfColorPrompt`; tapping the chosen swatch clears it), and visibility "Quem pode ver esta estante?" (`l10n:createShelfVisibilityPrompt`): Público / Mútuos / Secreto (`l10n:visibilityPublic`, `l10n:visibilityMutual`, `l10n:visibilitySecret`), defaulting to Público. Save ("Criar Estante" / "Salvar", `l10n:createShelfSave`, `l10n:shelfSave`) is enabled only for a trimmed name of 1–150 and a description ≤ 150. On a system shelf the name is read-only, with "Estante padrão: não pode ser renomeada nem excluída" (`l10n:systemShelfLockedHint`). Calls `POST /shelves` or `PUT /shelves/{id}`.
- **add-movies (owner):** "+" opens `AddMoviesToShelfRoute`, a movie search (`GET /movies/search`, 3+ characters, 300 ms debounce) with multi-select. Back or "Done (n)" returns the picks, which are added one by one with `POST /shelves/{id}/movies`, stopping at the first failure.
- **detail:** `ShelfDetailRoute` (app bar title = the shelf name passed in). It loads `GET /shelves/{id}` and `GET /shelves/{id}/movies` together (20 per page, more 400 px before the end). Header: "de {name}" owner row (`l10n:shelfByOwner`) when it is someone else's shelf (tap → `PublicProfileRoute`), description, the count, visibility chip, grid/list toggle.
  - Filters (chips): "Assistidos" / "Não assistidos" (`l10n:shelfFilterWatched`, `l10n:shelfFilterNotWatched`), "Década" (`l10n:shelfFilterDecade`; 2020 down to 1920, shown "Anos {decade}"), "Gênero" (`l10n:shelfFilterGenre`; options from `GET /movies/genres`), "Limpar filtros" (`l10n:shelfFilterClear`). The decade and genre pickers are bottom sheets with "Qualquer" (`l10n:shelfFilterAny`).
  - Empty: "Nada aqui ainda" (`l10n:emptyStateNoItemsTitle`) with "Não há itens para exibir." or, filtered, "Nenhum filme com esses filtros" (`l10n:shelfEmptyFiltered`). My own empty "Já assisti" (no filter) adds "Já usa o Filmow? Traga seu histórico" (`l10n:watchedEmptyImport`) → `ImportStartRoute` ([imports](imports.md)).
  - Owner tools: FAB "Adicionar filmes"; "Ordenar por" (`l10n:shelfSortBy`) opens a sort sheet with 11 modes, Manual to "Por avaliação" (`l10n:shelfSortManual` … `l10n:shelfSortRatingHighest`), and "Aplicar só uma vez" (`l10n:shelfSortApplyOnce`; saves the result as the manual order) then "Aplicar" (`l10n:shelfSortApply`); ⋮ "Reordenar filmes", "Mover todos para…", "Copiar todos para…" (`l10n:shelfManualOrder`, `l10n:shelfMoveAll`, `l10n:shelfCopyAll`). Manual reorder first loads every page with no filter, then drag and "Concluir". Sort and reorder both use `PUT /shelves/{id}/order`.
  - Per movie (owner; long press in the grid, ⋮ in the list) a sheet: "Registrar sessão" (`l10n:watchLogAction`) → `LogSessionRoute`, then the snackbar "Sessão registrada" (`l10n:watchLogSaved`); "Remover da estante" (`l10n:shelfMovieRemove`); "Mover para…" / "Copiar para…" (`l10n:shelfMovieMoveTo`, `l10n:shelfMovieCopyTo`). Removing from "Já assisti" first asks "Desmarcar como assistido?" / "Os registros desse filme são mantidos." → "Desmarcar" (`l10n:shelfUnmarkWatchedTitle`, `l10n:shelfUnmarkWatchedMessage`, `l10n:shelfUnmarkWatchedConfirm`).
  - Move/copy target: `ShelfPickerBottomSheet.show` (a `MuuvieBottomSheet`), "Escolha a estante" (`l10n:shelfPickTarget`), the user's shelves minus the current one → `POST /shelves/{id}/movies/transfer`.
  - Every change reloads the shelf, so counters and order come from the server.
- **save (others' shelves):** the owner row has "Salvar" / "Salva" (`l10n:shelfSave`, `l10n:shelfSavedLabel`), hidden on system shelves. It flips at once and flips back on failure, with "Não foi possível atualizar as estantes salvas. Tente de novo." (`l10n:shelfSaveError`). Calls `POST /shelves/{id}/save` or `DELETE /shelves/{id}/save`.
- **saved-list:** `SavedShelvesRoute` "Estantes salvas" (`l10n:savedShelvesTitle`): `GET /users/me/shelves/saved`, last saved first, with cards "de {owner} · N filmes" (`l10n:shelfMoviesCount`). Empty: "As estantes que você salvar de outras pessoas aparecem aqui." (`l10n:savedShelvesEmpty`). It reloads after returning from a shelf.
- **add-to-shelves:** `AddToShelvesRoute`, a full-screen modal "Adicionar às estantes" (`l10n:addToShelvesTitle`). It loads `GET /movies/{id}/shelves` (the shelves already holding the movie: checked and locked) and all my shelves, then "Salvar" (`l10n:addToShelvesSave`) sends `POST /movies/{id}/shelves` with the new picks only. Movie detail then shows "Salvo em N estantes" (`l10n:addToShelvesSaved`). Nothing can be removed here.
- **movie-shelves:** `MovieShelvesRoute` "Estantes com este filme" (`l10n:movieShelvesTitle`): public custom shelves of anyone holding the movie, last updated first (`GET /movies/{id}/shelves/public`). Empty: "Nenhuma estante pública tem este filme ainda." (`l10n:movieShelvesEmpty`).

## How to get to it (user POV)
- Perfil › Estantes tab (own). Any profile › Estantes (read-only) ([public-profile](public-profile.md)).
- Estantes › Salvas → Estantes salvas. A shelf card → shelf detail.
- Filme › ⋯ › "Adicionar à estante…" (`l10n:addToShelvesAction`) → `AddToShelvesRoute`. Also an article's movie card in Notícias ([news](news.md)).
- Filme › Comunidade › "Em estantes" (`l10n:movieShelvesSection`) › "Ver todas" or the "Estantes" counter → `MovieShelvesRoute` ([movie-detail](movie-detail.md)).
- Also opened from a feed card ([social-feed](social-feed.md)), a locadora corridor ([locadoras](locadoras.md)), Catálogo "Estantes mais populares" (`GET /discover/shelves`, [catalog-search](catalog-search.md)) and Destaques ([profile](profile.md)).

## Where it lives
### App
- Routes: `ShelfDetailRoute`, `MovieShelvesRoute`, `SavedShelvesRoute`, `AddMoviesToShelfRoute`, `AddToShelvesRoute`. The first three are in every tab stack and at the root; the last two are root slide-up modals.
- Screens and state: `muuvie/ui/profile/lib/tabs/shelves` (tab page, `ShelvesCubit`, the sheets `shelf_form_bottom_sheet.dart` and `shelf_picker_bottom_sheet.dart`, `movie_shelves_page.dart`, `saved_shelves_page.dart`), `muuvie/ui/profile/lib/tabs/shelves/shelf_detail` (`ShelfDetailCubit`), `muuvie/ui/shelves/lib/add_to_shelves` (`AddToShelvesCubit`); the search reused by `AddMoviesToShelfRoute` is `muuvie/ui/profile/lib/tabs/lists/create_list/add_movies_screen.dart`.
- Data: `muuvie/features/shelves/data/lib/datasources/shelves_remote_data_source_impl.dart`; use cases in `muuvie/features/shelves/domain/lib/usecases` (`SaveShelf` validates 150/150 client-side; `AddMovieToWatchlist` is the news "Quero ver" shortcut).
### Backend
All in `backend/src/main/kotlin/org/mobyle/routing/ShelvesRouting.kt`; use cases in `backend/src/main/kotlin/org/mobyle/domain/usecase/shelves`, visibility in `ShelfAccess.kt`.

| Endpoint | Auth | Use case |
|---|---|---|
| `GET /users/{userId}/shelves` | required for `me`, else optional | `GetUserShelves` (`?profile=true` hides shelves of a locadora with "Ocultar as estantes da aba Estantes" from the owner too) |
| `PUT /users/me/shelves/order` | required | `ReorderShelves` (`shelfIds`, optional `pinnedIds`) |
| `GET /users/me/shelves/saved` | required | `GetSavedShelves` in `SavedShelves.kt` |
| `POST /shelves` | required | `CreateShelf` (201), validated by `ShelfInput.kt` |
| `GET /shelves/search` (not called by the app) | required | `SearchShelves`: own shelves by name; the app's `SearchMyShelves` is registered in DI but no screen uses it |
| `GET /shelves/{id}` | optional | `GetShelf` (records a visit and `saved` for a non-owner) |
| `PUT /shelves/{id}` | required | `UpdateShelf` |
| `DELETE /shelves/{id}` | required | `DeleteShelf` (204; 403 `system_shelf_delete`) |
| `POST /shelves/{id}/save` | required | `SaveShelf` in `SavedShelves.kt` |
| `DELETE /shelves/{id}/save` | required | `UnsaveShelf` |
| `GET /shelves/{id}/movies` | optional | `GetShelfMovies` (`watched`, `genre`, `decade`, `rating`) |
| `POST /shelves/{id}/movies` | required | `AddMovieToShelves` (`movieId`, or `tmdbId` + `title`) |
| `DELETE /shelves/{id}/movies/{movieId}` | required | `RemoveMovieFromShelf` |
| `POST /shelves/{id}/movies/transfer` | required | `TransferShelfMovies` (`mode` move/copy; empty `movieIds` = all) |
| `PUT /shelves/{id}/order` | required | `SortShelf` (`sortMode` + `applyOnce`, or `movieIds`) |
| `GET /movies/{id}/shelves` | required | `GetMovieShelves` → `{movieId, shelfIds}` |
| `POST /movies/{id}/shelves` | required | `AddMovieToShelves`, answers `GetMovieShelves` |
| `GET /movies/{id}/shelves/public` | none | `GetPublicShelvesWithMovie` |
| `GET /movies/tmdb/{tmdbId}/shelves` (not called by the app) | required | `GetMovieShelves` by TMDB id |
| `POST /movies/tmdb/{tmdbId}/shelves` (not called by the app) | required | `AddMovieToShelves`; creates a stub movie for an unknown TMDB id |

## Driving it
```bash
H="Authorization: Bearer $TOKEN"; J="Content-Type: application/json"; A=http://localhost:8080/api/v1
curl -s -H "$H" "$A/users/me/shelves?page=1&limit=20&profile=true" | jq '.results[] | {id,name,systemType,pinned}'
S=$(curl -s -X POST -H "$H" -H "$J" $A/shelves -d '{"name":"Noir","color":"#112233","visibility":"public"}' | jq .id)
curl -s -X POST -H "$H" -H "$J" $A/shelves/$S/movies -d '{"movieId":1}' -o /dev/null -w '%{http_code}\n'   # 201
curl -s -X PUT -H "$H" -H "$J" $A/shelves/$S/order -d '{"sortMode":"title","applyOnce":true}'
curl -s -H "$H" "$A/shelves/$S/movies?watched=false&decade=1940"
curl -s -X POST -H "$H" -H "$J" $A/movies/1/shelves -d '{"shelfIds":['$S']}'   # {"movieId":1,"shelfIds":[…]}
```
App: push `ShelfDetailRoute(shelfId: S, shelfName: 'Noir')`, `SavedShelvesRoute()` or `AddToShelvesRoute(movieId: 1, movieTitle: 'X')` (root).

## Gotchas
- System shelves are statuses, not items: adding a movie to "Quero ver" takes it off "Já assisti" and vice versa, and removing it from "Já assisti" unmarks it as watched (the logs stay). Copying or moving into a system shelf does the same.
- A shelf the viewer cannot see is a 404, not a 403. Changing someone else's shelf is a 403 `not_shelf_owner`. Renaming a system shelf is a 403 `system_shelf_rename`; the form never sends a new name.
- Saving your own shelf or a system shelf is a 400. Saving twice keeps one.
- The move/copy picker loads only the first page (20) of my shelves; the tab, `AddToShelvesRoute` and the locadora picker load up to 10 pages.
- `AddMoviesToShelfRoute` labels are hardcoded English ("Search movies...", "Done (n)"), not l10n.
- The app never sends the `rating` filter, and its sort sheet does not show the current `applyOnce` state (the server stores `manual` after an apply-once).
- Creating a custom shelf publishes a `nova_estante` activity with the shelf's visibility ([social-feed](social-feed.md)); editing rewrites it (visibility included) and deleting removes it.
