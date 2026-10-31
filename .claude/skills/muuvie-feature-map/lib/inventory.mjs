import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROUTER_FILE, ROUTING_DIR, endpointKey } from './paths.mjs';

const METHODS = { get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', delete: 'DELETE', webSocket: 'WS' };

// A Ktor route call: at line start or after whitespace, `{`, `;` or `(` — never after `.`,
// so `call.parameters.get("x")` is not a route.
// `route(` nests paths; the checker reads routes flat, so a nested block is reported, not guessed at.
const CALL = /(?:^|[\s{;(])(get|post|put|patch|delete|webSocket|route)\(/g;
const LITERAL = /^\s*"([^"]*)"/;
const GETTER = /^\)\s*=/; // `get() = …` is a Kotlin property getter, not a route
const PAGE = /\b([A-Z]\w*)\.page\b/g;

export class MissingCheckoutError extends Error {
  constructor(path) {
    super(`${path} not found`);
    this.path = path;
  }
}

/**
 * The ground truth the map is checked against: every backend route declared in
 * `routing/*.kt`, and every page registered in the app router.
 */
export function extractInventory(root) {
  const routingDir = join(root, ROUTING_DIR);
  const routerFile = join(root, ROUTER_FILE);
  if (!existsSync(routingDir)) throw new MissingCheckoutError(ROUTING_DIR);
  if (!existsSync(routerFile)) throw new MissingCheckoutError(ROUTER_FILE);

  const endpoints = [];
  const unparsed = [];
  for (const name of readdirSync(routingDir).filter((n) => n.endsWith('.kt')).sort()) {
    const file = `${ROUTING_DIR}/${name}`;
    readFileSync(join(routingDir, name), 'utf8').split('\n').forEach((text, index) => {
      for (const call of text.matchAll(CALL)) {
        const callStart = call.index + call[0].length - call[1].length - 1;
        const args = text.slice(call.index + call[0].length);
        if (GETTER.test(args)) continue;
        const literal = args.match(LITERAL);
        if (literal && call[1] !== 'route') {
          const method = METHODS[call[1]];
          endpoints.push({ method, path: literal[1], key: endpointKey(method, literal[1]), file, line: index + 1 });
        } else {
          unparsed.push({ file, line: index + 1, text: text.slice(callStart).trim() });
        }
      }
    });
  }

  const routes = [];
  const seen = new Set();
  readFileSync(routerFile, 'utf8').split('\n').forEach((text, index) => {
    for (const page of text.matchAll(PAGE)) {
      if (seen.has(page[1])) continue;
      seen.add(page[1]);
      routes.push({ name: page[1], file: ROUTER_FILE, line: index + 1 });
    }
  });

  return { endpoints, routes, unparsed };
}
