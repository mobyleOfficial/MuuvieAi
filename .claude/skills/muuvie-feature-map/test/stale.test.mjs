import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stale } from '../lib/stale.mjs';
import { makeRepo, README, SHELVES_FEATURE, ROUTING_DIR } from './helpers.mjs';

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function commitAll(cwd, message) {
  git(cwd, 'add', '-A');
  git(cwd, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', message);
  return git(cwd, 'rev-parse', '--short', 'HEAD');
}

test('lists commits since the mapped-at sha that touch the paths a file cites', () => {
  const root = makeRepo();
  const backend = join(root, 'backend');
  git(backend, 'init', '-q');
  const mapped = commitAll(backend, 'initial');
  writeFileSync(join(backend, 'unrelated.txt'), 'x');
  commitAll(backend, 'unrelated change');
  writeFileSync(join(root, ROUTING_DIR, 'ShelvesRouting.kt'), '// changed\n');
  const touching = commitAll(backend, 'change shelves routing');

  const feature = SHELVES_FEATURE.replace('backend@a5f16aa', `backend@${mapped}`);
  writeFileSync(join(root, '.claude/skills/muuvie-feature-map/features/shelves.md'), feature);

  const result = stale(root);
  assert.equal(result.files.length, 1);
  const [entry] = result.files;
  assert.equal(entry.file, 'shelves.md');
  assert.deepEqual(entry.backend.commits.map((c) => c.sha), [touching]);
  assert.equal(entry.backend.commits[0].subject, 'change shelves routing');
  assert.deepEqual(result.errors, [{ file: 'shelves.md', submodule: 'muuvie', error: 'muuvie is not a git checkout' }]);
});

test('reports a header sha the submodule does not have', () => {
  const root = makeRepo();
  git(join(root, 'backend'), 'init', '-q');
  commitAll(join(root, 'backend'), 'initial');
  const result = stale(root);
  assert.deepEqual(result.files, []);
  assert.equal(result.errors[0].submodule, 'backend');
  assert.match(result.errors[0].error, /a5f16aa/);
});

test('README is not checked for staleness', () => {
  const root = makeRepo({ features: { 'README.md': README } });
  assert.deepEqual(stale(root), { files: [], errors: [] });
});
