import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const ROUTING_DIR = 'backend/src/main/kotlin/org/mobyle/routing';
export const ROUTER_FILE = 'muuvie/lib/routes/app_router.dart';
export const FEATURES_DIR = '.claude/skills/muuvie-feature-map/features';

export const SHELVES_ROUTING = `package org.mobyle.routing

fun Route.getShelvesRouting() {
    get("/shelves/{shelfId}") {
        call.respond(HttpStatusCode.OK)
    }
    post("/shelves") { }
    delete("/shelves/{id}/movies/{movieId}") { }
}
`;

export const HEALTH_ROUTING = `fun Route.getHealthRouting() {
    get("/health/live") { }
}
`;

export const SOCKET_ROUTING = `fun Route.getWebSocketRouting() {
    webSocket("/ws") { }
}
`;

export const ARB_FILE = "muuvie/ui/common/lib/l10n/app_pt.arb";
export const ARB = JSON.stringify({ "@@locale": "pt", shelvesTitle: "Estantes", "@shelvesTitle": {} });

export const APP_ROUTER = `class AppRouter extends RootStackRouter {
  List<AutoRoute> get routes => [
    AutoRoute(page: MainRoute.page, children: [
      AutoRoute(page: ShelfDetailRoute.page),
    ]),
    AutoRoute(page: ShelfDetailRoute.page),
    CustomRoute(page: AddToShelvesRoute.page),
  ];
}
`;

export const SHELVES_FEATURE = `# Shelves

> Mapped at backend@a5f16aa muuvie@e4bc089 · source: code

Lists of movies. Label: \`l10n:shelvesTitle\`.

## Sub-features
- **detail:** shows a shelf.

## How to get to it (user POV)
Perfil › Estantes.

## Where it lives
### App
- Routes: \`ShelfDetailRoute\`, \`AddToShelvesRoute\`, \`MainRoute\`
- Code: \`muuvie/lib/routes/app_router.dart\`
### Backend
| Endpoint | Use case |
|---|---|
| \`GET /shelves/{id}\` | \`${ROUTING_DIR}/ShelvesRouting.kt\` |
| \`POST /shelves\` | |
| \`DELETE /shelves/{id}/movies/{movieId}\` | |
| \`WS /ws\` | |

## Driving it
No app driver yet.

## Gotchas
- None.
`;

export const README = `# Map

## Full sweep
- [shelves](shelves.md)

## Not mapped
- \`GET /health/live\`: liveness probe, not a feature.
`;

/** Writes a fake meta-repo into a temp dir and returns its root. */
export function makeRepo({
  routing = { 'ShelvesRouting.kt': SHELVES_ROUTING, 'HealthRouting.kt': HEALTH_ROUTING, 'WebSocketRouting.kt': SOCKET_ROUTING },
  router = APP_ROUTER,
  arb = ARB,
  features = { 'README.md': README, 'shelves.md': SHELVES_FEATURE },
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'feature-map-'));
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  if (routing) for (const [name, text] of Object.entries(routing)) write(`${ROUTING_DIR}/${name}`, text);
  if (router !== null) write(ROUTER_FILE, router);
  if (arb !== null) write(ARB_FILE, arb);
  for (const [name, text] of Object.entries(features)) write(`${FEATURES_DIR}/${name}`, text);
  return root;
}
