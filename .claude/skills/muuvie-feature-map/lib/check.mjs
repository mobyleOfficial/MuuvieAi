import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { submoduleStates } from './git.mjs';
import { extractInventory } from './inventory.mjs';
import { ARB_FILE, FEATURES_DIR, INDEX_FILE } from './paths.mjs';
import { parseFeatureFile, parseNotMapped } from './references.mjs';

export const SECTIONS = ['Sub-features', 'How to get to it (user POV)', 'Where it lives', 'Driving it', 'Gotchas'];
export const MAX_LINES = 150;
const ROUTES_SECTION = 'Where it lives';

const FIX = {
  'missing-endpoint': (ref) =>
    `No route "${ref}" in backend routing. Run \`feature-map-check inventory\` for the real list, then correct the method/path or remove the line.`,
  'missing-route': (ref) =>
    `No ${ref}.page in muuvie/lib/routes/app_router.dart. Use the name the router registers, or remove it.`,
  'missing-path': (ref) => `${ref} does not exist. Point at the file or directory that replaced it.`,
  'missing-l10n': (ref) =>
    `No key "${ref.slice('l10n:'.length)}" in ${ARB_FILE}. Use the key the app uses for that label, or write the label as plain text.`,
  'missing-section': (ref) => `Add a "## ${ref}" section; every feature file has: ${SECTIONS.join(', ')}.`,
  'missing-header': () =>
    'Add "> Mapped at backend@<sha> muuvie@<sha> · source: code" under the title, with the submodule commits you read (git -C backend rev-parse --short HEAD).',
  'section-order': (ref) => `"## ${ref}" is out of order; sections go: ${SECTIONS.join(', ')}.`,
  'too-long': () => `Over ${MAX_LINES} lines. Split the feature into two files, or cut detail the code already says.`,
  'unparsed-route': () =>
    'The checker cannot read this route\'s path. Give the route a literal path on the same line, or list its endpoint under "Not mapped" in features/README.md with a reason.',
  'submodule-mismatch': (ref) =>
    `${ref} is not at the commit the meta-repo records. Commit the ref bump (git add ${ref}) or check out the recorded commit (git submodule update ${ref}).`,
};

function finding(file, line, kind, ref, message) {
  return { file, line, kind, ref, message, fix: FIX[kind](ref) };
}

function readArbKeys(root) {
  const path = join(root, ARB_FILE);
  if (!existsSync(path)) return new Set();
  return new Set(Object.keys(JSON.parse(readFileSync(path, 'utf8'))).filter((k) => !k.startsWith('@')));
}

function sectionFindings(file, sections) {
  const present = sections.map((s) => s.name).filter((n) => SECTIONS.includes(n));
  const problems = SECTIONS.filter((n) => !present.includes(n)).map((n) =>
    finding(file, 1, 'missing-section', n, `Missing section "${n}"`),
  );
  const warnings = [];
  const expected = SECTIONS.filter((n) => present.includes(n));
  const firstOff = present.findIndex((name, i) => name !== expected[i]);
  if (firstOff >= 0) {
    const name = present[firstOff];
    const { line } = sections.find((s) => s.name === name);
    warnings.push(finding(file, line, 'section-order', name, `Section "${name}" is out of order`));
  }
  return { problems, warnings };
}

/**
 * Checks the map both ways: every reference resolves, and every inventory item is referenced.
 * `problems` make `ok` false; `warnings` don't. With `strict`, a submodule checked out at a
 * commit other than the recorded one is a problem rather than a warning.
 */
export function check(root, { featuresDir = join(root, FEATURES_DIR), strict = false, submodules = submoduleStates } = {}) {
  const inventory = extractInventory(root);
  const endpointKeys = new Set(inventory.endpoints.map((e) => e.key));
  const routeNames = new Set(inventory.routes.map((r) => r.name));
  const arbKeys = readArbKeys(root);
  const problems = [];
  const warnings = [];
  const covered = new Set();
  const notMapped = new Set();

  const names = existsSync(featuresDir) ? readdirSync(featuresDir).filter((n) => n.endsWith('.md')).sort() : [];
  const featureFiles = names.filter((n) => n !== INDEX_FILE);

  for (const name of names) {
    const text = readFileSync(join(featuresDir, name), 'utf8');
    const isIndex = name === INDEX_FILE;
    const { refs, sections, header } = parseFeatureFile(name, text);
    const notMappedRefs = new Set(isIndex ? parseNotMapped(text).map((r) => `${r.line}:${r.value}`) : []);

    for (const ref of refs) {
      const id = ref.kind === 'endpoint' ? ref.key : ref.value;
      if (ref.kind === 'endpoint' && !endpointKeys.has(ref.key)) {
        problems.push(finding(name, ref.line, 'missing-endpoint', ref.value, `Endpoint ${ref.value} not found`));
        continue;
      }
      if (ref.kind === 'route' && !routeNames.has(ref.value)) {
        // Outside "Where it lives", a *Route name may be a Flutter class (MaterialPageRoute): prose.
        if (ref.section === ROUTES_SECTION) {
          problems.push(finding(name, ref.line, 'missing-route', ref.value, `App route ${ref.value} not found`));
        }
        continue;
      }
      if (ref.kind === 'path' && !existsSync(join(root, ref.value))) {
        problems.push(finding(name, ref.line, 'missing-path', ref.value, `Path ${ref.value} not found`));
        continue;
      }
      if (ref.kind === 'l10n') {
        if (!arbKeys.has(ref.value)) {
          problems.push(finding(name, ref.line, 'missing-l10n', `l10n:${ref.value}`, `l10n key ${ref.value} not found`));
        }
        continue;
      }
      if (notMappedRefs.has(`${ref.line}:${ref.value}`)) notMapped.add(id);
      else if (!isIndex) covered.add(id);
    }

    if (isIndex) continue;
    if (!header) problems.push(finding(name, 1, 'missing-header', name, 'No "> Mapped at" header'));
    const sectionResult = sectionFindings(name, sections);
    problems.push(...sectionResult.problems);
    warnings.push(...sectionResult.warnings);
    const lineCount = text.replace(/\n$/, '').split('\n').length;
    if (lineCount > MAX_LINES) {
      warnings.push(finding(name, MAX_LINES + 1, 'too-long', name, `${lineCount} lines`));
    }
  }

  for (const u of inventory.unparsed) {
    problems.push(finding(u.file, u.line, 'unparsed-route', u.text, 'Route declaration the checker cannot read'));
  }

  for (const state of submodules(root)) {
    if (state.recorded === state.checkedOut) continue;
    const mismatch = finding(
      state.name,
      0,
      'submodule-mismatch',
      state.name,
      `${state.name} is checked out at ${state.checkedOut.slice(0, 7)}, the meta-repo records ${state.recorded.slice(0, 7)}`,
    );
    (strict ? problems : warnings).push(mismatch);
  }

  const isCovered = (id) => covered.has(id) || notMapped.has(id);
  const uncovered = {
    endpoints: inventory.endpoints.filter((e) => !isCovered(e.key)),
    routes: inventory.routes.filter((r) => !isCovered(r.name)),
  };
  const stats = {
    files: featureFiles.length,
    endpoints: inventory.endpoints.length,
    endpointsCovered: inventory.endpoints.filter((e) => covered.has(e.key)).length,
    endpointsNotMapped: inventory.endpoints.filter((e) => notMapped.has(e.key) && !covered.has(e.key)).length,
    routes: inventory.routes.length,
    routesCovered: inventory.routes.filter((r) => covered.has(r.name)).length,
    routesNotMapped: inventory.routes.filter((r) => notMapped.has(r.name) && !covered.has(r.name)).length,
  };
  const ok = problems.length === 0 && uncovered.endpoints.length === 0 && uncovered.routes.length === 0;
  return { ok, problems, warnings, uncovered, stats };
}
