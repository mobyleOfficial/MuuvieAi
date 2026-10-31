import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeatureFile, parseNotMapped } from '../lib/references.mjs';

test('parses endpoint, route and path refs inside backticks only', () => {
  const text = [
    '# X',
    'GET /not/in/backticks and ShelfDetailRoute too',
    '| `GET /shelves/{id}` | `backend/src/Foo.kt` |',
    '- `ShelfDetailRoute`, `SearchTab`, `WS /ws`',
    '- `muuvie/ui/shelves` and `someVariable` and `get /lowercase`',
  ].join('\n');
  const { refs } = parseFeatureFile('x.md', text);
  assert.deepEqual(
    refs.map((r) => [r.kind, r.value, r.line]),
    [
      ['endpoint', 'GET /shelves/{id}', 3],
      ['path', 'backend/src/Foo.kt', 3],
      ['route', 'ShelfDetailRoute', 4],
      ['route', 'SearchTab', 4],
      ['endpoint', 'WS /ws', 4],
      ['path', 'muuvie/ui/shelves', 5],
    ],
  );
  assert.equal(refs[0].key, 'GET /shelves/{}');
});

test('ignores framework route class names', () => {
  const { refs } = parseFeatureFile('x.md', '`AutoRoute` `CustomRoute` `RootStackRouter` `MainRoute`');
  assert.deepEqual(refs.map((r) => r.value), ['MainRoute']);
});

test('ignores refs inside fenced code blocks', () => {
  const text = '```bash\ncurl `GET /fake`\n```\n`GET /real`';
  const { refs } = parseFeatureFile('x.md', text);
  assert.deepEqual(refs.map((r) => r.value), ['GET /real']);
});

test('lists level-2 section headings in order', () => {
  const { sections } = parseFeatureFile('x.md', '# T\n## Sub-features\n### App\n## Gotchas\n');
  assert.deepEqual(sections, [
    { name: 'Sub-features', line: 2 },
    { name: 'Gotchas', line: 4 },
  ]);
});

test('reads Not mapped refs from README', () => {
  const text = '# Map\n- `GET /in/sweep`\n## Not mapped\n- `GET /health/live`: probe\n- `DebugRoute`: dev only\n## After\n- `GET /after`\n';
  assert.deepEqual(
    parseNotMapped(text).map((r) => r.value),
    ['GET /health/live', 'DebugRoute'],
  );
});

test('strips query strings from endpoint refs', () => {
  const { refs } = parseFeatureFile('x.md', '`GET /shelves/search?q=noir`');
  assert.equal(refs[0].key, 'GET /shelves/search');
});

test('parses l10n refs', () => {
  const { refs } = parseFeatureFile('x.md', 'Tap `l10n:searchHint`.');
  assert.deepEqual(refs.map((r) => [r.kind, r.value]), [['l10n', 'searchHint']]);
});

test('tags each ref with its section', () => {
  const { refs } = parseFeatureFile('x.md', '# T\n`MainRoute`\n## Where it lives\n`ShelfDetailRoute`\n');
  assert.deepEqual(refs.map((r) => r.section), [null, 'Where it lives']);
});

test('reads the mapped-at header', () => {
  const { header } = parseFeatureFile('x.md', '# T\n\n> Mapped at backend@a5f16aa muuvie@e4bc0893 · source: code\n');
  assert.deepEqual(header, { backend: 'a5f16aa', muuvie: 'e4bc0893', line: 3 });
  assert.equal(parseFeatureFile('x.md', '# T\n').header, null);
});
