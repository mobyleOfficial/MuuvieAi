# Onboarding

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

A full-screen introduction to the app's concept, shown once per install over the main screen (not tied to sign-up or to an account), and again on demand from Configurações. Six panels, then open maratonas and CineClubes to join. Lives in `muuvie/ui/onboarding` and `muuvie/features/onboarding`; it has no endpoint of its own and borrows the Programação list endpoints.

## Sub-features
- **show-once:** after the main screen's first frame, `ShouldShowOnboarding` checks a file `onboarding_seen` next to the ObjectBox directory; missing → `OnboardingRoute` is pushed on the root router (slides up). Logged in or not.
- **panels:** swipe or "Próximo" (`l10n:onboardingNext`); "Pular" (`l10n:onboardingSkip`, top right) ends it from any panel. Dots below with the label "Passo {current} de {total}" (`l10n:onboardingStep`, total 7).
  1. "O Muuvie é uma maratona de filmes" (`l10n:onboardingWelcomeTitle`)
  2. "Estantes e locadoras" (`l10n:onboardingShelvesTitle`)
  3. "Registre cada sessão" (`l10n:onboardingLogsTitle`)
  4. "Maratonas e CineClubes" (`l10n:onboardingProgramacaoTitle`)
  5. "Amigos e uma vaquinha" (`l10n:onboardingSocialTitle`)
  6. "Traga seu histórico" (`l10n:onboardingImportTitle`) with "Importar do Filmow" (`l10n:onboardingImportFilmow`): asks for login first (`AuthGate`), then closes the intro and opens `ImportStartRoute` (see [imports](imports.md)). Dismissing login keeps the intro open.
- **suggestions:** last page "Em cartaz" (`l10n:onboardingSuggestionsTitle`): up to 3 open maratonas (title, "{n} participantes", `l10n:maratonaParticipants`) and up to 3 open CineClubes (title, movie). Spinner while loading; both empty or failed → "Nada aberto agora. Crie o primeiro na Programação!" (`l10n:onboardingSuggestionsEmpty`). Tapping one closes the intro and opens `MaratonaDetailRoute` / `CineClubeDetailRoute`. The button reads "Começar" (`l10n:onboardingStart`) and closes.
- **seen:** Pular, Começar, back/swipe-dismiss, or leaving for import or a suggestion all write the seen file. There is no error state: a failed request just empties its list.
- **replay:** Configurações › "Ver a introdução de novo" (`l10n:settingsShowIntro`) deletes the file and pushes the intro right away (see [settings](settings.md)).

## How to get to it (user POV)
First launch after install. Afterwards: Perfil › gear (Configurações) › Ver a introdução de novo.

## Where it lives
### App
- Routes: `OnboardingRoute` (root, slide-up modal)
- Screens and state: `muuvie/ui/onboarding/lib/onboarding_page.dart`, `muuvie/ui/onboarding/lib/onboarding_screen.dart`, `muuvie/ui/onboarding/lib/onboarding_bloc.dart` (`OnboardingCubit`), trigger in `muuvie/lib/routes/main_screen.dart` (`_showOnboarding`)
- Data: `muuvie/features/onboarding/domain/lib/domain.dart` (use cases), `muuvie/features/onboarding/data/lib/data.dart` (seen file), `muuvie/lib/di/onboarding_module.dart`; lists via `muuvie/features/maratonas/data/lib/datasources/maratonas_remote_data_source.dart` and `muuvie/features/cineclubes/data/lib/datasources/cineclubes_remote_data_source.dart`
### Backend
| Endpoint | Auth | Use case |
|---|---|---|
| `GET /maratonas` (`?open=true&page=1`) | optional | `backend/src/main/kotlin/org/mobyle/domain/usecase/maratonas/MaratonaUseCases.kt` (see [programacao](programacao.md)) |
| `GET /cineclubes` (`?open=true&page=1`) | optional | `backend/src/main/kotlin/org/mobyle/domain/usecase/cineclubes/CineClubeUseCases.kt` (see [programacao](programacao.md)) |

## Driving it
```bash
curl -s "localhost:8080/api/v1/maratonas?open=true"     # the suggestions; the app keeps the first 3
curl -s "localhost:8080/api/v1/cineclubes?open=true"
```
App: fresh install, or delete the app's `onboarding_seen` file (sibling of the `objectbox` directory in the documents dir) and relaunch, or use Configurações › Ver a introdução de novo.

## Gotchas
- "Once per install", not per account: a second user on the same device never sees it, and reinstalling shows it again.
- The domain doc comment on `ResetOnboarding` says "the next launch shows it again", but Configurações pushes it immediately; closing it marks it seen again, so it will not reappear on next launch.
- The intro opens over whatever the launch tab is. A push or deep link that opened the app on first launch is also pushed after the first frame, so which one ends on top is a race (unverified).
