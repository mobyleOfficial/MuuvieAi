import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HOOKS } from './helpers.mjs';

/** A repo with validate-config.sh copied in and the given config files. */
function repo(files) {
  const root = mkdtempSync(join(tmpdir(), 'config-'));
  mkdirSync(join(root, '.claude'));
  cpSync(join(HOOKS, '..', 'validate-config.sh'), join(root, '.claude', 'validate-config.sh'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(root, name), text);
  return root;
}

function run(root, cwd = tmpdir()) {
  return spawnSync('/bin/bash', [join(root, '.claude', 'validate-config.sh')], { cwd, encoding: 'utf8', input: '{}' });
}

test('clean config passes, from any working directory', () => {
  const root = repo({ '.claude/settings.json': '{"statusLine":{"command":"./.claude/statusline.sh"}}', '.mcp.json': '{}' });
  assert.equal(run(root).status, 0);
});

test('a non-portable path in shared config blocks the prompt', () => {
  for (const bad of ['"/Users/me/x"', '"~/bin/x"', '"$HOME/x"', '"/home/me/x"']) {
    const root = repo({ '.claude/settings.json': `{"x": ${bad}}` });
    const result = run(root);
    assert.equal(result.status, 2, bad);
    assert.match(result.stderr, /settings\.json:1/);
  }
  assert.equal(run(repo({ '.mcp.json': '{"c": "/Users/me/x"}' })).status, 2);
});

test('the personal settings file only warns', () => {
  const result = run(repo({ '.claude/settings.local.json': '{"x": "/Users/me/x"}' }));
  assert.equal(result.status, 0);
  assert.match(result.stderr, /not blocking/);
});
