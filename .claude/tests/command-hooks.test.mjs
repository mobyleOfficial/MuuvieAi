import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expectStatus, runHook, HOOKS } from './helpers.mjs';

function git(cwd, ...args) {
  const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'init.defaultBranch=main', ...args], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

const TRAILER = 'Co-Authored-By: Someone <someone@example.com>';

test('check-coauthor blocks a real trailer, however the commit is spelled', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'coauthor-'));
  writeFileSync(join(dir, 'msg.txt'), `feat: x\n\n${TRAILER}\n`);
  expectStatus(assert, 'check-coauthor.sh', [
    `git commit -m "feat: x" -m "${TRAILER}"`,
    `git -C muuvie commit -m "feat: x\n\n${TRAILER}"`,
    `(git commit -m "x" -m "${TRAILER}")`,
    `git commit -F- <<'EOF'\nfeat: x\n\n${TRAILER}\nEOF`,
    'git commit -F msg.txt',
  ], 2, { cwd: dir });
});

test('check-coauthor allows messages that only mention the trailer', () => {
  expectStatus(assert, 'check-coauthor.sh', [
    'git commit -m "chore: block Co-Authored-By trailers"',
    'git commit --amend -m "$(git log -1 --format=%B | grep -v Co-Authored-By)"',
    `echo "${TRAILER}"`,
    'git status',
  ], 0);
});

test('check-python-env blocks global installs', () => {
  expectStatus(assert, 'check-python-env.sh', [
    'pip install requests',
    'pip3.12 install requests',
    'python3.12 -m pip install requests',
    'python -m pip install -r requirements.txt',
    'uvx ruff check; pip install x',
    'uv pip install --system requests',
    'cd tools && pip install -e .',
    'pip install --break-system-packages x',
  ], 2);
});

test('check-python-env allows venv-scoped installs and mentions', () => {
  expectStatus(assert, 'check-python-env.sh', [
    'source .venv/bin/activate && pip install requests',
    '. venv/bin/activate; python -m pip install -r requirements.txt',
    '.venv/bin/pip install requests',
    'venv/bin/python -m pip install x',
    'uv pip install requests',
    'poetry install',
    'poetry add requests',
    'uvx ruff check .',
    'gh pr create --body "$(cat <<\'EOF\'\npip install -r requirements.txt\nEOF\n)"',
    'git commit -m "doc: never pip install globally"',
  ], 0);
});

/** A meta-repo fixture whose `muuvie` submodule tracks the given files. */
function metaWithSubmodule(subFiles) {
  const root = mkdtempSync(join(tmpdir(), 'meta-'));
  const sub = join(root, 'muuvie');
  mkdirSync(sub);
  writeFileSync(join(sub, 'README.md'), 'app');
  for (const [name, text] of Object.entries(subFiles)) {
    mkdirSync(join(sub, name, '..'), { recursive: true });
    writeFileSync(join(sub, name), text);
  }
  git(sub, 'init', '-q');
  git(sub, 'add', '-A');
  git(sub, 'commit', '-q', '-m', 'app');
  git(root, 'init', '-q');
  writeFileSync(join(root, 'CLAUDE.md'), 'meta');
  git(root, 'add', 'CLAUDE.md');
  git(root, 'commit', '-q', '-m', 'base');
  git(root, 'update-ref', 'refs/remotes/origin/dev', 'HEAD');
  git(root, 'add', 'muuvie');
  return root;
}

test('check-submodule-ai blocks AI tooling in a submodule the operation touches', () => {
  for (const file of ['.claude.rar', 'docs/CLAUDE.md', 'GEMINI.md', '.copilot/config.json', 'AI_SETUP.md']) {
    const root = metaWithSubmodule({ [file]: 'x' });
    const meta = runHook('check-submodule-ai.sh', { command: 'git commit -m "bump"', cwd: root });
    assert.equal(meta.status, 2, `${file} (meta commit): ${meta.stderr}`);
    // From inside the submodule, or pointing git at it.
    assert.equal(runHook('check-submodule-ai.sh', { command: 'git commit -m x', cwd: join(root, 'muuvie') }).status, 2, `${file} (cwd in submodule)`);
    assert.equal(runHook('check-submodule-ai.sh', { command: 'git -C muuvie push', cwd: root }).status, 2, `${file} (git -C)`);
  }
});

test('check-submodule-ai sees a pointer bump that was committed but never pushed', () => {
  const root = metaWithSubmodule({ '.claude/settings.json': '{}' });
  git(root, 'commit', '-q', '-m', 'bump');
  // No upstream: falls back to origin/dev...HEAD.
  assert.equal(runHook('check-submodule-ai.sh', { command: 'git push -u origin feature/x', cwd: root }).status, 2);
});

test('check-submodule-ai lets clean submodules and unrelated commits through', () => {
  const clean = metaWithSubmodule({ 'lib/claude_client.dart': 'x', '.claudeignore': 'x' });
  assert.equal(runHook('check-submodule-ai.sh', { command: 'git commit -m bump', cwd: clean }).status, 0);
  const dirty = metaWithSubmodule({ '.claude.rar': 'x' });
  git(dirty, 'reset', '-q');
  assert.equal(runHook('check-submodule-ai.sh', { command: 'git commit -m "docs only"', cwd: dirty }).status, 0);
  assert.equal(runHook('check-submodule-ai.sh', { command: 'git commit -m "mention git push"', cwd: dirty }).status, 0);
});

test('check-docs-sync skips pushes made from inside a submodule', () => {
  expectStatus(assert, 'check-docs-sync.sh', [
    'cd muuvie && git push',
    'git -C backend push origin dev',
    'echo "git push"',
    'git commit -m "then gh pr create"',
  ], 0);
});

test('check-docs-sync blocks a push whose branch changed config without docs', () => {
  const root = mkdtempSync(join(tmpdir(), 'docs-'));
  mkdirSync(join(root, '.claude'));
  cpSync(join(HOOKS, '..', 'verify-docs.sh'), join(root, '.claude', 'verify-docs.sh'));
  writeFileSync(join(root, 'README.md'), 'x');
  git(root, 'init', '-q', '-b', 'feature/x');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  git(root, 'update-ref', 'refs/remotes/origin/dev', 'HEAD');
  writeFileSync(join(root, '.claude', 'settings.json'), '{}');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'config');
  // The hook process runs elsewhere; the session cwd decides which repo is judged.
  assert.equal(runHook('check-docs-sync.sh', { command: 'git push', cwd: root, processCwd: tmpdir() }).status, 2);
  writeFileSync(join(root, 'README.md'), 'documented');
  git(root, 'commit', '-q', '-am', 'docs');
  assert.equal(runHook('check-docs-sync.sh', { command: 'git push', cwd: root, processCwd: tmpdir() }).status, 0);
});
