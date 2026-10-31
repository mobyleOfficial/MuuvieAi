import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../lib/check.mjs';
import { makeRepo, README, SHELVES_FEATURE, SHELVES_ROUTING, HEALTH_ROUTING, SOCKET_ROUTING } from './helpers.mjs';

const kinds = (result) => result.problems.map((p) => [p.kind, p.ref]);

test('a clean map passes', () => {
  const result = check(makeRepo());
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.uncovered, { endpoints: [], routes: [] });
  assert.equal(result.ok, true);
  assert.equal(result.stats.files, 1);
});

test('matches endpoints ignoring param names', () => {
  // The feature says {id}; the code says {shelfId}.
  const result = check(makeRepo());
  assert.ok(!result.problems.some((p) => p.ref === 'GET /shelves/{id}'));
});

test('reports missing endpoint/route/path with fix text', () => {
  const feature = SHELVES_FEATURE.replace(
    '## Driving it',
    '- `GET /nope`, `GoneRoute`, `muuvie/ui/gone`\n\n## Driving it',
  );
  const result = check(makeRepo({ features: { 'README.md': README, 'shelves.md': feature } }));
  assert.deepEqual(kinds(result), [
    ['missing-endpoint', 'GET /nope'],
    ['missing-route', 'GoneRoute'],
    ['missing-path', 'muuvie/ui/gone'],
  ]);
  for (const problem of result.problems) {
    assert.equal(problem.file, 'shelves.md');
    assert.ok(problem.line > 0);
    assert.ok(problem.fix.length > 0);
  }
  assert.equal(result.ok, false);
});

test('reports uncovered inventory items', () => {
  const feature = SHELVES_FEATURE.replace('| `POST /shelves` | |\n', '').replace(', `AddToShelvesRoute`', '');
  const result = check(makeRepo({ features: { 'README.md': README, 'shelves.md': feature } }));
  assert.deepEqual(result.uncovered.endpoints.map((e) => e.key), ['POST /shelves']);
  assert.deepEqual(result.uncovered.routes.map((r) => r.name), ['AddToShelvesRoute']);
  assert.ok(result.uncovered.endpoints[0].file.endsWith('ShelvesRouting.kt'));
  assert.equal(result.ok, false);
});

test('treats Not mapped items as covered', () => {
  const result = check(makeRepo());
  assert.ok(!result.uncovered.endpoints.some((e) => e.key === 'GET /health/live'));
});

test('a Not mapped entry that no longer exists is a problem', () => {
  const readme = README + '- `GET /removed`: gone\n';
  const result = check(makeRepo({ features: { 'README.md': readme, 'shelves.md': SHELVES_FEATURE } }));
  assert.deepEqual(kinds(result), [['missing-endpoint', 'GET /removed']]);
  assert.equal(result.problems[0].file, 'README.md');
});

test('counts an endpoint referenced twice once', () => {
  const other = SHELVES_FEATURE.replace('# Shelves', '# Other');
  const result = check(makeRepo({ features: { 'README.md': README, 'shelves.md': SHELVES_FEATURE, 'other.md': other } }));
  assert.equal(result.ok, true);
  assert.equal(result.stats.endpoints, 5);
  assert.equal(result.stats.endpointsCovered, 4);
  assert.equal(result.stats.endpointsNotMapped, 1);
});

test('reports missing sections and warns about out-of-order ones', () => {
  const swapped = SHELVES_FEATURE.replace('## Gotchas\n- None.\n', '').replace(
    '## Sub-features',
    '## Gotchas\n- None.\n\n## Sub-features',
  );
  const missing = SHELVES_FEATURE.replace('## Driving it\nNo app driver yet.\n', '');
  const result = check(makeRepo({ features: { 'README.md': README, 'a.md': swapped, 'b.md': missing } }));
  assert.deepEqual(result.problems.map((p) => [p.file, p.kind, p.ref]), [['b.md', 'missing-section', 'Driving it']]);
  assert.deepEqual(result.warnings.map((w) => [w.file, w.kind, w.ref]), [['a.md', 'section-order', 'Gotchas']]);
});

test('reports a feature file without the mapped-at header', () => {
  const feature = SHELVES_FEATURE.replace(/> Mapped at .*\n/, '');
  const result = check(makeRepo({ features: { 'README.md': README, 'shelves.md': feature } }));
  assert.deepEqual(kinds(result), [['missing-header', 'shelves.md']]);
});

test('reports l10n keys missing from app_pt.arb', () => {
  const feature = SHELVES_FEATURE.replace('`l10n:shelvesTitle`', '`l10n:shelvesTitle` `l10n:goneKey` `l10n:@shelvesTitle`');
  const result = check(makeRepo({ features: { 'README.md': README, 'shelves.md': feature } }));
  assert.deepEqual(kinds(result), [
    ['missing-l10n', 'l10n:goneKey'],
    ['missing-l10n', 'l10n:@shelvesTitle'],
  ]);
});

test('ignores unknown route-like names outside Where it lives', () => {
  const feature = SHELVES_FEATURE.replace('Perfil › Estantes.', 'Pushed with `MaterialPageRoute`.');
  const result = check(makeRepo({ features: { 'README.md': README, 'shelves.md': feature } }));
  assert.equal(result.ok, true);
});

test('a submodule off its recorded commit warns, and fails under strict', () => {
  const root = makeRepo();
  const submodules = () => [{ name: 'backend', recorded: 'aaaaaaa', checkedOut: 'bbbbbbb' }];
  const loose = check(root, { submodules });
  assert.equal(loose.ok, true);
  assert.deepEqual(loose.warnings.map((w) => [w.kind, w.ref]), [['submodule-mismatch', 'backend']]);
  const strict = check(root, { submodules, strict: true });
  assert.equal(strict.ok, false);
  assert.deepEqual(kinds(strict), [['submodule-mismatch', 'backend']]);
});

test('warns about files over 150 lines without failing', () => {
  const long = SHELVES_FEATURE + '- filler\n'.repeat(150);
  const result = check(makeRepo({ features: { 'README.md': README, 'shelves.md': long } }));
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.warnings.map((w) => [w.kind, w.ref]), [['too-long', 'shelves.md']]);
  assert.equal(result.ok, true);
});

test('a new route in the backend fixture fails the check and is named', () => {
  const routing = SHELVES_ROUTING.replace('post("/shelves") { }', 'post("/shelves") { }\n    put("/shelves/{id}/order") { }');
  const result = check(makeRepo({ routing: { 'ShelvesRouting.kt': routing, 'HealthRouting.kt': HEALTH_ROUTING, 'WebSocketRouting.kt': SOCKET_ROUTING } }));
  assert.equal(result.ok, false);
  assert.deepEqual(result.uncovered.endpoints.map((e) => e.key), ['PUT /shelves/{}/order']);
});

test('unparsed declarations make the check fail', () => {
  const routing = SHELVES_ROUTING + 'fun extra() { get(SOME_PATH) { } }\n';
  const result = check(makeRepo({ routing: { 'ShelvesRouting.kt': routing, 'HealthRouting.kt': HEALTH_ROUTING, 'WebSocketRouting.kt': SOCKET_ROUTING } }));
  assert.equal(result.ok, false);
  assert.deepEqual(kinds(result), [['unparsed-route', 'get(SOME_PATH) { } }']]);
});

test('a widget class ending in Tab is prose unless the router registers it', () => {
  const feature = SHELVES_FEATURE.replace('- Code:', '- Widgets: `DiaryTab`, `MaterialPageRoute`\n- Code:');
  const result = check(makeRepo({ features: { 'README.md': README, 'shelves.md': feature } }));
  assert.deepEqual(result.problems, []);
});
