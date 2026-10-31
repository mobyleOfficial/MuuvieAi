// Where the checker looks, relative to the meta-repo root.
export const ROUTING_DIR = 'backend/src/main/kotlin/org/mobyle/routing';
export const ROUTER_FILE = 'muuvie/lib/routes/app_router.dart';
export const FEATURES_DIR = '.claude/skills/muuvie-feature-map/features';
export const INDEX_FILE = 'README.md';
export const ARB_FILE = 'muuvie/ui/common/lib/l10n/app_pt.arb';
export const SUBMODULES = ['backend', 'muuvie'];

/** `GET /shelves/{id}` → `GET /shelves/{}`, so param names never decide a match. */
export function endpointKey(method, path) {
  return `${method} ${path.replace(/\{[^}]*\}/g, '{}')}`;
}
