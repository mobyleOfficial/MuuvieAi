import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeRepo, README, SHELVES_FEATURE } from './helpers.mjs';

const BIN = fileURLToPath(new URL('../bin/feature-map-check', import.meta.url));

function run(args) {
  const result = spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, json: safeParse(result.stdout) };
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

test('prints JSON and exits 0 on a clean fixture', () => {
  const { status, json } = run(['check', '--root', makeRepo()]);
  assert.equal(status, 0);
  assert.equal(json.ok, true);
});

test('defaults to check', () => {
  const { status, json } = run(['--root', makeRepo()]);
  assert.equal(status, 0);
  assert.equal(json.ok, true);
});

test('exits 1 with problems', () => {
  const feature = SHELVES_FEATURE.replace('## Gotchas', '- `GET /nope`\n\n## Gotchas');
  const { status, json } = run(['--root', makeRepo({ features: { 'README.md': README, 'shelves.md': feature } })]);
  assert.equal(status, 1);
  assert.equal(json.problems[0].ref, 'GET /nope');
});

test('inventory lists endpoints and routes', () => {
  const { status, json } = run(['inventory', '--root', makeRepo()]);
  assert.equal(status, 0);
  assert.equal(json.endpoints.length, 5);
  assert.equal(json.routes.length, 3);
});

test('uncovered prints only uncovered items', () => {
  const feature = SHELVES_FEATURE.replace('| `POST /shelves` | |\n', '');
  const { status, json } = run(['uncovered', '--root', makeRepo({ features: { 'README.md': README, 'shelves.md': feature } })]);
  assert.equal(status, 1);
  assert.deepEqual(json.endpoints.map((e) => e.key), ['POST /shelves']);
  assert.deepEqual(json.routes, []);
});

test('exits 2 when a submodule is not checked out', () => {
  const { status, json } = run(['--root', makeRepo({ router: null })]);
  assert.equal(status, 2);
  assert.equal(json.ok, false);
  assert.match(json.fix, /git submodule update --init/);
});

test('exits 2 on an unknown command', () => {
  const { status, json } = run(['bogus']);
  assert.equal(status, 2);
  assert.match(json.error, /bogus/);
});

test('--help exits 0 and lists subcommands', () => {
  const result = spawnSync(process.execPath, [BIN, '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  for (const word of ['check', 'inventory', 'uncovered', '--root']) assert.match(result.stdout, new RegExp(word));
});

test('exits 2 with a fix when the ARB file is not valid JSON', () => {
  const { status, json } = run(['--root', makeRepo({ arb: '{ not json' })]);
  assert.equal(status, 2);
  assert.match(json.error, /app_pt\.arb/);
  assert.ok(json.fix);
});
