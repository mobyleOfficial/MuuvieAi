import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROUTER_FILE, ROUTING_DIR, endpointKey } from './paths.mjs';

const METHODS = { get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', delete: 'DELETE', webSocket: 'WS' };

// A Ktor route call: at line start or after whitespace, `{`, `;` or `(` — never after `.`,
// so `call.parameters.get("x")` is not a route.
// `route(` nests paths and `get { }` has none; the checker reads routes flat, so both are
// reported, not guessed at.
const CALL = /(?:^|[\s{;(])(get|post|put|patch|delete|webSocket|route)(\(|\s*\{)/g;
const LITERAL = /^\s*"([^"]*)"/;
const GETTER = /^\)\s*=/; // `get() = …` is a Kotlin property getter, not a route
const PAGE = /\b([A-Z]\w*)\.page\b/g;

/** Something outside the map is wrong (a missing checkout, an unreadable file): exit 2, not "map broken". */
export class EnvironmentError extends Error {
  constructor(message, fix) {
    super(message);
    this.fix = fix;
  }
}

const CHECKOUT_FIX = 'Check out the submodules: git submodule update --init --recursive (or pass --root <meta-repo>).';

/**
 * Blanks out Kotlin comments, keeping every other character in place so match indices
 * still point at the original text. Strings are respected, so "http://x" stays code.
 */
export function stripComments(lines) {
  let inBlock = false;
  return lines.map((line) => {
    let out = '';
    let inString = false;
    for (let i = 0; i < line.length; i += 1) {
      const pair = line.slice(i, i + 2);
      if (inBlock) {
        if (pair === '*/') {
          inBlock = false;
          out += '  ';
          i += 1;
        } else out += ' ';
      } else if (inString) {
        if (line[i] === '\\') {
          out += line.slice(i, i + 2);
          i += 1;
        } else {
          if (line[i] === '"') inString = false;
          out += line[i];
        }
      } else if (pair === '//') {
        out += ' '.repeat(line.length - i);
        break;
      } else if (pair === '/*') {
        inBlock = true;
        out += '  ';
        i += 1;
      } else {
        if (line[i] === '"') inString = true;
        out += line[i];
      }
    }
    return out;
  });
}

/**
 * The ground truth the map is checked against: every backend route declared in
 * `routing/*.kt`, and every page registered in the app router.
 */
export function extractInventory(root) {
  const routingDir = join(root, ROUTING_DIR);
  const routerFile = join(root, ROUTER_FILE);
  if (!existsSync(routingDir)) throw new EnvironmentError(`${ROUTING_DIR} not found under ${root}`, CHECKOUT_FIX);
  if (!existsSync(routerFile)) throw new EnvironmentError(`${ROUTER_FILE} not found under ${root}`, CHECKOUT_FIX);

  const endpoints = [];
  const unparsed = [];
  for (const name of readdirSync(routingDir).filter((n) => n.endsWith('.kt')).sort()) {
    const file = `${ROUTING_DIR}/${name}`;
    const lines = readFileSync(join(routingDir, name), 'utf8').split(/\r?\n/);
    stripComments(lines).forEach((text, index) => {
      for (const call of text.matchAll(CALL)) {
        const callStart = call.index + call[0].length - call[1].length - call[2].length;
        const args = text.slice(call.index + call[0].length);
        if (call[2] === '(' && GETTER.test(args)) continue;
        const literal = call[2] === '(' ? args.match(LITERAL) : null;
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
