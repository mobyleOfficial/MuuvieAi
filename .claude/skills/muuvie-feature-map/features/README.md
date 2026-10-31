# Muuvie feature map

Behaviour-level inventory of what a user can do in Muuvie, and which code in `muuvie/` (Flutter app) and `backend/` (Ktor API) does it. Agents use it to find a feature and its code without rediscovering the product; humans use it as the regression checklist. `$B` is `.claude/skills/muuvie-feature-map/bin/feature-map-check` (see `../SKILL.md` for the reference syntax and commands).

## Page template

```markdown
# <Feature>

> Mapped at backend@<short sha> muuvie@<short sha> · source: code

One paragraph: what it is, for whom, and where it lives in the app.

## Sub-features
- **<slug>:** observable behaviour; loading, empty, error and success states; rules and limits a user meets, with exact values and pt-BR labels (`l10n:<key>`).

## How to get to it (user POV)
Tab › button › screen, in the app's pt-BR labels. Deep links, if any.

## Where it lives
### App
- Routes: `<Name>Route`, …
- Screens and state: `muuvie/ui/<package>/lib/<dir>` (screen, BLoC/Cubit)
- Data: `muuvie/features/<package>/data/lib/datasources/<file>.dart`
### Backend
| Endpoint | Auth | Use case |
|---|---|---|
| `GET /shelves/{id}` | optional | `backend/src/main/kotlin/org/mobyle/domain/usecase/shelves/GetShelf.kt` |

## Driving it
curl recipes against a local backend; the route or deep link that reaches the screen.

## Gotchas
- Surprises: auth, pagination, side effects, paths that can't be triggered and the closest real path.
```

*Source* is `code` until someone observes the page's flows in the running app; then `code + app (<date>)`.

## Baseline preconditions

**Backend** (`backend/`, Postgres in Docker, API on `http://localhost:8080`):

```bash
cd backend
cp .env.example .env          # then fill TMDB_API_KEY, and add JWT_SECRET (not in the example)
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
docker compose up -d db       # just Postgres on :5433; a bare `up -d` also runs the backend container on :8080
set -a; . ./.env; set +a      # ./gradlew run does not read .env
./gradlew run
```

Required: `TMDB_API_KEY`, `DATABASE_URL`, `JWT_SECRET` (the server refuses to start without it). Optional: `TENOR_API_KEY` (else `GET /gifs/search` answers 503), `FCM_SERVICE_ACCOUNT` / `FCM_SERVICE_ACCOUNT_FILE` (push), `OAUTH_*`, `METRICS_TOKEN`, `CORS_ORIGINS` (Flutter web on a port other than 5173).

Most endpoints need a token. Sign up or log in through `AuthRouting` (see [auth](auth.md)) and pass `-H "Authorization: Bearer $TOKEN"`.

**App** (`muuvie/`): `secrets/.env` from `secrets/.env.example` with `DEV_BACKEND_URL` (`http://localhost:8080` on the iOS simulator, `http://10.0.2.2:8080` on the Android emulator), then

```bash
cd muuvie
flutter run --flavor dev --dart-define=FLAVOR=dev --dart-define-from-file=secrets/.env
```

Firebase is optional in dev (its bootstrap is wrapped in a try/catch). The UI is pt-BR first; labels on pages are pt-BR with their `l10n:` key.

## Proof and skip reporting

A page defines the coverage set for its feature. When verifying a change, exercise every reachable entry point and the success, empty, error and persistence paths the change can affect, and check side effects in the backend (a `GET` after a write), not just the screen. When a path is unreachable, name the blocker and cover the closest real path.

Reachable only indirectly, by construction:

| Surface | Blocker | Closest real path |
|---|---|---|
| Push notifications | Needs FCM credentials and a device token | `PUT /users/me/devices`, then the WebSocket event of the same type (see [app-shell](app-shell.md)) |
| WebSocket events | Server-to-client only; the server ignores what the client sends | Trigger the action that emits the event (follow, love, message, import) and watch `WS /ws` |
| Deep links `/@handle`, `/m/<slug>`, `/c/<slug>` | Need the app's link domain configured on the device | Push the route directly (`PublicProfileRoute`, `MaratonaDetailRoute`, `CineClubeDetailRoute`) |
| Bottom sheets and dialogs | Not routes: opened imperatively (`MuuvieBottomSheet.show`, `showDialog`) | The page of the screen that opens them names the trigger |

## Full sweep (top to bottom)

### Shell and account

- [app-shell](app-shell.md): launch, the five tabs, deep links, WebSocket and push events and where each lands, device registration.
- [auth](auth.md): log in, sign up, nickname check, session and token refresh, OAuth.
- [onboarding](onboarding.md): the intro shown once per install (not tied to an account), replayable from Configurações.
- [settings](settings.md): Configurações — notification switches, push permission, intro replay, logout (no delete-account or change-password).

### Social (`SocialTab`, called Atts in code; `l10n:navAtts`)

- [social-feed](social-feed.md): the activity feed, loving activities.
- [whispers](whispers.md): conversations and messages.

### Catálogo (`SearchTab`; `l10n:navCatalogo`)

- [catalog-search](catalog-search.md): search, browse by release date and category, rankings, discover lists.
- [movie-detail](movie-detail.md): a movie's page, its community and timeline, people.
- [watch-logs](watch-logs.md): logging a session, rating, history, comments.
- [shelves](shelves.md): shelves, adding movies, saved shelves.
- [locadoras](locadoras.md): locadoras (user video stores) and their shelves.

### Programação (`ProgramacaoTab`; `l10n:navProgramacao`)

- [programacao](programacao.md): the hub of maratonas and cineclubes.
- [maratonas](maratonas.md): movie marathons — challenges, progress, ranking, editor.
- [cineclubes](cineclubes.md): film clubs — participation, debates, progress, editor.

### Notícias (`NoticiasTab`; `l10n:navNoticias`)

- [news](news.md): news list and article detail.

### Perfil (`ProfileTab`; `l10n:profile`)

- [profile](profile.md): own profile, tabs, edit profile, highlights.
- [public-profile](public-profile.md): another user's profile.
- [follows](follows.md): followers and following.
- [stats](stats.md): stats, yearly goals, retrospective.
- [gamification](gamification.md): shelter, missions, diary.
- [games](games.md): watch parties and the poster game.
- [imports](imports.md): importing a history from another service.

## Not mapped

Inventory left out of the pages on purpose. The checker counts these as covered.

- `GET /health/live`, `GET /health/ready`: liveness and readiness probes, mounted at the root (not under `/api/v1`).
- `GET /metrics`: Prometheus metrics behind `METRICS_TOKEN`, root-mounted.
