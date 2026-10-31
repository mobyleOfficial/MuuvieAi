# Locadoras

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

A locadora is a named group of a user's own shelves, shown like the aisles of a video store: each shelf is a "corridor" with its first movies. Covers the Locadoras tab of a profile (own: editable; others': read-only), the locadora detail, choosing and ordering its shelves, and the Catálogo discovery list's data. Shelves themselves are in [shelves](shelves.md).

## Sub-features
- **list:** profile tab "Locadoras" (`l10n:profileTabLocadoras`). It loads every page (up to 10 × 20) of `GET /users/{userId}/locadoras`, pinned first, then profile order. Each card shows the name, a pin icon, "N estantes" (`l10n:locadoraShelvesCount`), "{watched}/{total} assistidos" (`l10n:shelfWatchedOfTotal`), a visibility chip and posters. Error: "Algo deu errado" (`l10n:emptyStateErrorTitle`) with the server message and "Tentar novamente" (`l10n:emptyStateRetry`). Pull to refresh.
  - Empty: "Nenhuma locadora ainda" (`l10n:locadoraEmptyTitle`) with "Agrupe suas estantes como os corredores de uma locadora." (`l10n:locadoraEmptyMessage`) on my profile, or "Nada para mostrar por aqui ainda." (`l10n:locadoraEmptyOtherMessage`) on someone else's.
  - Owner only: FAB "Nova locadora" (`l10n:locadoraNew`); after creating, the new locadora's detail opens. A ⋮ menu per card: "Editar" (`l10n:locadoraEdit`), "Fixar no topo" / "Desafixar" (`l10n:shelfPin`, `l10n:shelfUnpin`), "Excluir locadora" (`l10n:locadoraDelete`). With 2+ locadoras, a toolbar "Reordenar locadoras" (`l10n:locadoraReorder`) opens a drag list closed by "Concluir" (`l10n:shelfReorderDone`). Pin and reorder both send `PUT /users/me/locadoras/order` (`locadoraIds`, optional `pinnedIds`).
  - Delete asks "Excluir "{name}"?" / "As estantes continuam no seu perfil." (`l10n:locadoraDeleteConfirmTitle`, `l10n:locadoraDeleteConfirmMessage`) → "Excluir" (`l10n:delete`).
  - Any failed action: snackbar "Não deu para concluir. Tente de novo." (`l10n:shelfActionError`).
- **locadora-form (bottom sheet):** `LocadoraFormBottomSheet.show` (a `MuuvieBottomSheet`), title "Nova Locadora" / "Editar locadora" (`l10n:createLocadoraTitle`, `l10n:editLocadoraTitle`). Fields: name "Qual o nome da sua locadora?" (`l10n:createLocadoraNamePrompt`), description "(opcional)" (`l10n:createLocadoraDescriptionPrompt`), visibility "Quem pode ver esta locadora?" (`l10n:createLocadoraVisibilityPrompt`, default Público), and two switches: "Ocultar as estantes da aba Estantes" (`l10n:locadoraHideInProfile`) and "Ocultar as estantes dos filtros" (`l10n:locadoraHideInFilters`). Save ("Criar Locadora" / "Salvar", `l10n:createLocadoraSave`, `l10n:shelfSave`) needs a trimmed name of 1–150 and a description ≤ 150 (`SaveLocadora`, checked again by the server). It pops with the saved locadora; a failure keeps the sheet open with the snackbar. Calls `POST /locadoras` or `PUT /locadoras/{id}`.
- **detail:** `LocadoraDetailRoute` (app bar title = the name passed in). It loads `GET /locadoras/{id}`, then up to 10 pages of `GET /locadoras/{id}/shelves`.
  - Header: description; "de @{username}" (`l10n:locadoraByOwner`), tappable to the owner's profile only when the caller passed `onOpenOwner` and it is not mine (Catálogo and the feed do; the profile tab does not); "{watched} de {total} filmes assistidos" (`l10n:locadoraProgress`); chips "N estantes", "N filmes" (`l10n:locadoraMoviesCount`) and the visibility. Owner: edit (opens the same form) and delete icons; delete pops the screen after confirming.
  - Corridors: one per shelf in the locadora's order, with its name, "{watched}/{total} assistidos", an "Abrir estante" button (`l10n:locadoraOpenShelf`) → `ShelfDetailRoute`, and a horizontal row of its first 10 movies (tap → `MovieDetailRoute`). An empty shelf reads "Estante vazia" (`l10n:locadoraShelfEmpty`); no shelves reads "Esta locadora ainda não tem estantes." (`l10n:locadoraNoShelves`).
  - Owner actions: "Escolher estantes" (`l10n:locadoraChooseShelves`) and, with 2+ shelves, "Reordenar estantes" (`l10n:shelfReorder`): drag and "Concluir" → `PUT /locadoras/{id}/shelves/order`. Only a failed reorder reloads.
- **pick-shelves:** `PickLocadoraShelvesRoute`, a full-screen modal "Estantes da locadora" (`l10n:locadoraPickShelvesTitle`). It lists all my shelves (up to 10 pages of `GET /users/{userId}/shelves` with `me`), checkboxes pre-set to the current set; new picks go to the end. "Salvar" (`l10n:shelfSave`) pops the ids and the detail sends `PUT /locadoras/{id}/shelves` (replaces the whole set), then reloads. No shelves: "Nada aqui ainda" / "Crie uma estante primeiro." (`l10n:emptyStateNoItemsTitle`, `l10n:locadoraPickShelvesEmpty`).
- **discover:** Catálogo's "Locadoras da comunidade" (`l10n:discoverLocadoras`) section and its `DiscoverListRoute` list are drawn by [catalog-search](catalog-search.md) from `GET /discover/locadoras`: public locadoras of others that have at least one public shelf, featured owners first, then the most shelf activity in the last 30 days. With `q`, the name filter also includes my own. Counters and posters there cover public shelves only.

## How to get to it (user POV)
- Perfil › Locadoras tab (own). Any profile › Locadoras (read-only) ([public-profile](public-profile.md)).
- Catálogo › "Locadoras da comunidade" › a card.
- Social › a "nova locadora" activity card ([social-feed](social-feed.md)). Perfil › Destaques › Locadora em destaque ([profile](profile.md)).

## Where it lives
### App
- Routes: `LocadoraDetailRoute` (every tab stack and the root), `PickLocadoraShelvesRoute` (root, slide-up).
- Screens and state: `muuvie/ui/locadoras/lib/locadoras_list` (the tab: `LocadorasListPage`, `LocadorasListCubit`), `muuvie/ui/locadoras/lib/locadora_detail` (`LocadoraDetailCubit`), `muuvie/ui/locadoras/lib/pick_shelves` (`PickShelvesCubit`), `muuvie/ui/locadoras/lib/locadora_form/locadora_form_bottom_sheet.dart`, `muuvie/ui/locadoras/lib/widgets/confirm_locadora_delete.dart`.
- Data: `muuvie/features/shelves/data/lib/datasources/locadoras_remote_data_source_impl.dart` (in the shelves feature package); use cases in `muuvie/features/shelves/domain/lib/usecases` (`GetUserLocadoras`, `SaveLocadora`, `GetLocadoraShelves`, `SetLocadoraShelves`, …).
### Backend
`backend/src/main/kotlin/org/mobyle/routing/LocadorasRouting.kt`; use cases in `backend/src/main/kotlin/org/mobyle/domain/usecase/locadoras`, rules in `LocadoraAccess.kt` and `LocadoraInput.kt`.

| Endpoint | Auth | Use case |
|---|---|---|
| `GET /users/{userId}/locadoras` | required for `me`, else optional | `GetUserLocadoras` |
| `PUT /users/me/locadoras/order` | required | `ReorderLocadoras` (204) |
| `POST /locadoras` | required | `CreateLocadora` (201) |
| `GET /locadoras/{id}` | optional | `GetLocadora` |
| `PUT /locadoras/{id}` | required | `UpdateLocadora` |
| `DELETE /locadoras/{id}` | required | `DeleteLocadora` (204; shelves stay) |
| `GET /locadoras/{id}/shelves` | optional | `GetLocadoraShelves` (each shelf with its first 10 movies) |
| `PUT /locadoras/{id}/shelves` | required | `SetLocadoraShelves` (204) |
| `PUT /locadoras/{id}/shelves/order` | required | `ReorderLocadoraShelves` (204) |
| `GET /discover/locadoras` | optional | `DiscoverLocadoras` in `backend/src/main/kotlin/org/mobyle/domain/usecase/discover/DiscoverContent.kt` (`DiscoverRouting.kt`) |

## Driving it
```bash
H="Authorization: Bearer $TOKEN"; J="Content-Type: application/json"; A=http://localhost:8080/api/v1
L=$(curl -s -X POST -H "$H" -H "$J" $A/locadoras -d '{"name":"Clássicos","visibility":"public","hideShelvesInProfile":false,"hideShelvesInFilters":false}' | jq .id)
curl -s -X PUT -H "$H" -H "$J" $A/locadoras/$L/shelves -d '{"shelfIds":[12,13]}' -w '%{http_code}\n'   # 204
curl -s -X PUT -H "$H" -H "$J" $A/locadoras/$L/shelves/order -d '{"shelfIds":[13,12]}'
curl -s -H "$H" "$A/locadoras/$L/shelves?page=1&limit=20" | jq '.results[] | {name: .shelf.name, n: (.movies|length)}'
curl -s "$A/discover/locadoras?q=cl&page=1&limit=20" | jq '.results[].name'
```
App: push `LocadoraDetailRoute(locadoraId: L, locadoraName: 'Clássicos')`; without `onOpenShelf` the "Abrir estante" button is hidden.

## Gotchas
- `LocadoraDetailRoute` takes callbacks (`onOpenShelf`, `onOpenOwner`), so it cannot be deep-linked; each caller decides what those taps do.
- Only my own shelves can go in a locadora: a shelf the owner cannot see is a 404, someone else's a 403 `not_shelf_owner`. A locadora holds at most 200 shelves (400). Reordering needs every id to already be in it (400), and an empty list is a 400.
- Inside a visible locadora each shelf keeps its own visibility, so a viewer may see fewer corridors than "N estantes" says to the owner.
- "Ocultar as estantes da aba Estantes" hides those shelves from others' view of the Estantes tab, and from mine only on the profile itself (`profile=true`). "Ocultar as estantes dos filtros" keeps them out of "Estantes mais populares" discovery.
- Creating a locadora publishes a `nova_locadora` activity with its visibility; editing rewrites it and deleting removes it ([social-feed](social-feed.md)).
- A non-owner change is a 403 `not_locadora_owner`; a locadora the viewer cannot see is a 404.
