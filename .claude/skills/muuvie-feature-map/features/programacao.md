# Programação

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

The Programação tab (`l10n:navProgramacao` "Programação"): a thin hub with two tabs, Maratonas and CineClubes, each a searchable, filterable, paged list with a create button. It owns no endpoint of its own beyond the two list calls; everything past the list lives on [maratonas](maratonas.md) and [cineclubes](cineclubes.md). The tab opens without login (`requiresLogin` is false for it in `muuvie/lib/routes/main_navigation.dart`); actions that need an account ask first.

## Sub-features
- **tabs:** `l10n:programacaoMaratonasTab` "Maratonas" | `l10n:programacaoCineClubesTab` "CineClubes" (`MuuvieTabBar`, not routes).
- **participating:** chip `l10n:programacaoParticipatingFilter` "Participando" above both tabs; narrows both lists to what the user joined (`participant=me`). Turning it on asks to log in first (`AuthGate`). Empty: `l10n:maratonaParticipatingEmpty` / `l10n:cineclubeParticipatingEmpty`.
- **search:** field `l10n:maratonaSearchHint` "Buscar maratonas" / `l10n:cineclubeSearchHint` "Buscar CineClubes", debounced 400 ms, sent as `q` (title, case-insensitive substring).
- **filters (Maratonas):** `l10n:maratonaFilterCurated` "Curadoria" (`trusted`), `l10n:maratonaFilterOpen` "Sem senha" (`open`: no password), `l10n:maratonaFilterFinished` "Incluir finalizadas" (`includeFinished`), `l10n:maratonaFilterMine` "Criadas por mim" (`mine`, asks to log in).
- **filters (CineClubes):** the same minus Curadoria (CineClubes have no curated flag); labels reuse the `maratonaFilter*` keys.
- **list:** cards (`MaratonaCard`, `CineClubeCard`), 20 per page, next page when < 400 px from the bottom, pull to refresh. Order: maratonas curated first, then newest start; CineClubes newest start.
  - loading: spinner; error: `l10n:emptyStateErrorTitle` "Algo deu errado" with `l10n:emptyStateRetry` "Tentar novamente"; empty: `l10n:maratonaListEmptyTitle` "Nenhuma maratona por aqui" + `l10n:maratonaListEmptyMessage` / `l10n:cineclubeListEmptyTitle` + `l10n:cineclubeListEmptyMessage`.
- **create:** FAB `l10n:maratonaCreate` "Criar maratona" / `l10n:cineclubeCreate` "Criar CineClube"; asks to log in, pushes the editor, reloads the list on return.
- **open:** tapping a card pushes the detail; the list reloads on return (participant counts change).

## How to get to it (user POV)
Bottom bar › Programação (`ProgramacaoTab`). Maratonas › card, or › Criar maratona. CineClubes › card, or › Criar CineClube.

## Where it lives
### App
- Routes: `ProgramacaoTab` (shell tab), `ProgramacaoRoute` (its root). Pushes `MaratonaDetailRoute`, `MaratonaEditorRoute`, `CineClubeDetailRoute`, `CineClubeEditorRoute`.
- Screens and state: `muuvie/ui/programacao/lib/programacao_page.dart`, `muuvie/ui/programacao/lib/programacao_screen.dart`, `muuvie/ui/programacao/lib/programacao_bloc.dart` (`ProgramacaoCubit`: only the Participando flag)
- Lists: `muuvie/ui/programacao/lib/maratonas/maratona_list.dart` + `muuvie/ui/programacao/lib/maratonas/maratona_list_bloc.dart`; `muuvie/ui/programacao/lib/cineclubes/cineclube_list.dart` + `muuvie/ui/programacao/lib/cineclubes/cineclube_list_bloc.dart`
- Data: `muuvie/features/maratonas/data/lib/datasources/maratonas_remote_data_source.dart` (`getMaratonas`), `muuvie/features/cineclubes/data/lib/datasources/cineclubes_remote_data_source.dart` (`getCineClubes`)
- Tab bar entry: `muuvie/lib/routes/main_navigation.dart`
### Backend
| Endpoint | Auth | Use case |
|---|---|---|
| `GET /maratonas` | optional; required with `mine=true` or `participant=me` | `ListMaratonas` in `backend/src/main/kotlin/org/mobyle/domain/usecase/maratonas/MaratonaUseCases.kt` |
| `GET /cineclubes` | optional; required with `mine=true` or `participant=me` | `ListCineClubes` in `backend/src/main/kotlin/org/mobyle/domain/usecase/cineclubes/CineClubeUseCases.kt` |

Query: `q`, `open`, `includeFinished`, `trusted` (maratonas only), `mine`, `participant` (`me` or a user id), `page`, `limit` (app sends 20). Queries live in `backend/src/main/kotlin/org/mobyle/data/local/maratonas/MaratonaDataSource.kt` and `backend/src/main/kotlin/org/mobyle/data/local/cineclubes/CineClubeDataSource.kt`.

## Driving it
```bash
API=http://localhost:8080/api/v1
curl -s "$API/maratonas?trusted=true&page=1&limit=20"
curl -s "$API/maratonas?participant=me" -H "Authorization: Bearer $TOKEN"
curl -s "$API/cineclubes?q=noir&includeFinished=true"
```
App: tap the Programação tab; no deep link to the hub itself.

## Gotchas
- `includeFinished` only applies to the plain list: with `mine` the list shows every status (cancelled too), with `participant` everything but cancelled. So "Incluir finalizadas" does nothing while Participando or Criadas por mim is on.
- "Curadoria" is the `trusted` column, set only in the database; no endpoint or screen sets it.
- `participant=me` without a token is a 401, and `mine=true` anonymously too; the app never sends them anonymously because of `AuthGate`.
- `ProgramacaoCubit` has a `ProgramacaoError` state that nothing emits: the hub itself cannot fail, only the lists.
- The same lists appear elsewhere: Catálogo's discover search (`muuvie/ui/search/lib/discover/programacao_search_list.dart`) and Perfil › Participações (`muuvie/ui/profile/lib/tabs/participations`, maratonas only, `participant=<userId>`) also call `GET /maratonas`.
