import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRepo, FEATURES_DIR, SHELVES_FEATURE } from './helpers.mjs';

const SKILL = fileURLToPath(new URL('..', import.meta.url));
const HOOK = fileURLToPath(new URL('../../../hooks/check-feature-map.sh', import.meta.url));

function git(cwd, ...args) {
  const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

/** Runs the hook as Claude Code does: JSON on stdin, carrying the session's cwd. */
function runHook(cwd, command, { processCwd = tmpdir() } = {}) {
  return spawnSync('bash', [HOOK], { cwd: processCwd, input: JSON.stringify({ cwd, tool_input: { command } }), encoding: 'utf8' });
}

/** A meta-repo fixture with the real CLI copied in, `origin/dev` at the first commit. */
function metaRepo() {
  const root = makeRepo();
  // The submodules are their own repos, as in a real checkout.
  for (const name of ['backend', 'muuvie']) {
    git(join(root, name), 'init', '-q');
    git(join(root, name), 'add', '-A');
    git(join(root, name), 'commit', '-q', '-m', 'base');
  }
  for (const dir of ['bin', 'lib']) cpSync(join(SKILL, dir), join(root, '.claude/skills/muuvie-feature-map', dir), { recursive: true });
  cpSync(join(SKILL, 'package.json'), join(root, '.claude/skills/muuvie-feature-map/package.json'));
  git(root, 'init', '-q', '-b', 'feature/x');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  git(root, 'update-ref', 'refs/remotes/origin/dev', 'HEAD');
  return root;
}

function editPage(root, text) {
  writeFileSync(join(root, FEATURES_DIR, 'shelves.md'), text);
  git(root, 'commit', '-q', '-am', 'edit map');
}

test('blocks a push whose map edit breaks the check, naming the problem', () => {
  const root = metaRepo();
  editPage(root, SHELVES_FEATURE.replace('## Gotchas', '- `GET /nope`\n\n## Gotchas'));
  const result = runHook(root, 'git push -u origin feature/x');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /FEATURE_MAP/);
  assert.match(result.stderr, /GET \/nope/);
});

test('allows a push whose map edit keeps the check passing', () => {
  const root = metaRepo();
  editPage(root, SHELVES_FEATURE.replace('- None.', '- Still none.'));
  assert.equal(runHook(root, 'gh pr create --base dev').status, 0);
});

test('ignores branches that touch neither the map nor a submodule', () => {
  const root = metaRepo();
  writeFileSync(join(root, 'notes.md'), 'x');
  git(root, 'add', 'notes.md');
  git(root, 'commit', '-q', '-m', 'notes');
  // Break the map without committing it: the branch diff doesn't touch it, so no check runs.
  writeFileSync(join(root, FEATURES_DIR, 'shelves.md'), 'broken');
  assert.equal(runHook(root, 'git push').status, 0);
});

test('ignores other commands and pushes from inside a submodule', () => {
  const root = metaRepo();
  editPage(root, SHELVES_FEATURE.replace('## Gotchas', '- `GET /nope`\n\n## Gotchas'));
  for (const command of ['ls', 'echo "git push"', 'cd backend && git push', 'git -C muuvie push origin dev']) {
    assert.equal(runHook(root, command).status, 0, command);
  }
});

test('ignores "git push" inside a heredoc body, but not after it', () => {
  const root = metaRepo();
  editPage(root, SHELVES_FEATURE.replace('## Gotchas', '- `GET /nope`\n\n## Gotchas'));
  const heredoc = "node - <<'EOF'\nconst doc = 'run `cd x && git push` later';\nEOF";
  assert.equal(runHook(root, heredoc).status, 0);
  assert.equal(runHook(root, `cat <<EOF > notes.txt\ngit push\nEOF\ngit push`).status, 2);
});

test("skips a quoted submodule path", () => {
  const root = metaRepo();
  editPage(root, SHELVES_FEATURE.replace('## Gotchas', '- `GET /nope`\n\n## Gotchas'));
  assert.equal(runHook(root, "cd 'backend' && git push").status, 0);
  assert.equal(runHook(root, 'git -C "./muuvie" push').status, 0);
});

test('skips a submodule push however the submodule is named', () => {
  const root = metaRepo();
  editPage(root, SHELVES_FEATURE.replace('## Gotchas', '- `GET /nope`\n\n## Gotchas'));
  assert.equal(runHook(root, `cd ${join(root, 'muuvie')} && git push`).status, 0);
  assert.equal(runHook(root, 'git -C ./backend/ push').status, 0);
  // The session itself sits in a submodule.
  assert.equal(runHook(join(root, 'backend'), 'git push').status, 0);
  // A cd that stays inside the meta-repo still gets checked.
  assert.equal(runHook(root, 'cd .claude && git push').status, 2);
});

test('a here-string is not a heredoc', () => {
  const root = metaRepo();
  editPage(root, SHELVES_FEATURE.replace('## Gotchas', '- `GET /nope`\n\n## Gotchas'));
  assert.equal(runHook(root, 'grep x <<< "$v"\ngit push').status, 2);
});

test('does not block when the checker cannot judge the map', () => {
  const root = metaRepo();
  writeFileSync(join(root, 'muuvie/ui/common/lib/l10n/app_pt.arb'), '{ not json');
  editPage(root, SHELVES_FEATURE.replace('## Gotchas', '- `GET /nope`\n\n## Gotchas'));
  assert.equal(runHook(root, 'git push').status, 0);
});

test('does not block when there is no base branch', () => {
  const root = metaRepo();
  git(root, 'update-ref', '-d', 'refs/remotes/origin/dev');
  editPage(root, SHELVES_FEATURE.replace('## Gotchas', '- `GET /nope`\n\n## Gotchas'));
  assert.equal(runHook(root, 'git push').status, 0);
});
