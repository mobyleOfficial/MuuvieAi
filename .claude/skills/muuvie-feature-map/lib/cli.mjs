import { fileURLToPath } from 'node:url';
import { check } from './check.mjs';
import { EnvironmentError, extractInventory } from './inventory.mjs';
import { stale } from './stale.mjs';

// lib/ → muuvie-feature-map/ → skills/ → .claude/ → meta-repo root
const DEFAULT_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

const HELP = `feature-map-check — check the Muuvie feature map against the submodules

Usage: feature-map-check [command] [--root <meta-repo>]

Commands:
  check      (default) Every endpoint, route and path the map names must exist, and every
             backend endpoint and app route must be named by a feature file or listed under
             "Not mapped" in features/README.md. Exit 0 when ok, 1 when not.
  inventory  Every backend endpoint (routing/*.kt) and app route (app_router.dart) with its
             file and line, plus declarations the checker could not read.
  uncovered  Only the endpoints and routes no feature file names. Exit 1 when any.
  stale      For each feature file, the submodule commits since its "> Mapped at" sha that
             touch the paths it cites: the to-do list for an audit. Always exit 0.

Options:
  --root <dir>  Meta-repo root (default: the repo this script lives in).
  --strict      check: a submodule checked out at a commit other than the one the
                meta-repo records is a problem, not a warning (the hook uses this).
  --help        This text.

Output is one JSON object on stdout. Exit 2 means a usage or environment error
(for example a submodule that is not checked out); its JSON carries a "fix".

Reference syntax inside backticks in a feature file:
  \`GET /shelves/{id}\`   endpoint, path relative to /api/v1 (GET POST PUT PATCH DELETE WS)
  \`ShelfDetailRoute\`    app route or tab registered in app_router.dart
  \`muuvie/ui/shelves\`   file or directory in a submodule
  \`l10n:searchHint\`     key in muuvie/ui/common/lib/l10n/app_pt.arb
`;

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(error, fix) {
  print({ ok: false, error, fix });
  return 2;
}

function parseArgs(argv) {
  const args = { command: 'check', root: DEFAULT_ROOT, help: false, strict: false };
  const rest = [...argv];
  while (rest.length > 0) {
    const arg = rest.shift();
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--strict') args.strict = true;
    else if (arg === '--root') {
      args.root = rest.shift();
      if (!args.root) throw new Error('--root needs a directory');
    } else if (arg.startsWith('-')) throw new Error(`Unknown option ${arg}`);
    else args.command = arg;
  }
  return args;
}

/** Runs the CLI and returns its exit code. */
export function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    return fail(error.message, 'Run feature-map-check --help for usage.');
  }
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }
  try {
    switch (args.command) {
      case 'check': {
        const result = check(args.root, { strict: args.strict });
        print(result);
        return result.ok ? 0 : 1;
      }
      case 'inventory': {
        print(extractInventory(args.root));
        return 0;
      }
      case 'uncovered': {
        const { uncovered } = check(args.root);
        print(uncovered);
        return uncovered.endpoints.length + uncovered.routes.length === 0 ? 0 : 1;
      }
      case 'stale': {
        print(stale(args.root));
        return 0;
      }
      default:
        return fail(`Unknown command "${args.command}"`, 'Use check, inventory, uncovered or stale. See --help.');
    }
  } catch (error) {
    if (error instanceof EnvironmentError) return fail(error.message, error.fix);
    // Anything else is a bug in the checker, not in the map: exit 2 so the hook doesn't block on it.
    return fail(`feature-map-check crashed: ${error.stack ?? error}`, 'Report it, and fix lib/ under .claude/skills/muuvie-feature-map. The map itself was not judged.');
  }
}
