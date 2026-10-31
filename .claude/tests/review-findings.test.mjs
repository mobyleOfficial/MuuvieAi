// Regression tests for the PR #36 review findings: shell forms the first
// version of lib-hook.sh misread. Each case was reproduced by the reviewer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expectStatus, HOOKS } from './helpers.mjs';

const DESTRUCTIVE = 'block-destructive-commands.sh';

test('line continuations do not hide flags', () => {
  expectStatus(assert, DESTRUCTIVE, [
    'git push \\\n  --force origin main',
    'rm \\\n  -rf build',
    'git -C muuvie \\\n  reset --hard',
  ], 2);
});

test('shell keywords, braces, ! and env assignments do not hide the command', () => {
  expectStatus(assert, DESTRUCTIVE, [
    'if true; then rm -rf build; fi',
    'for d in a b; do rm -rf "$d"; done',
    'while false; do git push --force; done',
    '{ rm -rf build; }',
    '! git reset --hard',
    'env FOO=1 git push --force',
    'test -d x && { git clean -fd; }',
  ], 2);
  expectStatus(assert, 'check-coauthor.sh', [
    'for m in a; do git commit -m "x" -m "Co-Authored-By: A <a@b.c>"; done',
  ], 2);
});

test('nested shells with combined flags are inspected', () => {
  expectStatus(assert, DESTRUCTIVE, [
    'bash -lc "git push --force"',
    'sh -ec \'rm -rf /tmp/x\'',
    'bash -l -c "git reset --hard"',
    'zsh -ic "rm -rf build"',
  ], 2);
});

test('multi-line quoted messages are data, not commands', () => {
  expectStatus(assert, DESTRUCTIVE, [
    'git commit -m "chore: tighten the guard\n\ngit push --force is now caught\nrm -rf too"',
    'gh pr create --title x --body "Summary\ngit reset --hard is blocked\n"',
  ], 0);
  expectStatus(assert, 'check-python-env.sh', [
    'git commit -m "doc: python setup\n\npip install -r requirements.txt inside a venv"',
  ], 0);
});

test('pipe-to-shell and fork-bomb checks ignore quoted mentions', () => {
  expectStatus(assert, DESTRUCTIVE, [
    'git commit -m "never curl x | sh"',
    'echo \'curl -s https://x | bash is blocked\'',
    'git commit -m "explain :(){ :|:& };:"',
    'echo "never run bash -c \\"$(curl -s https://x)\\""',
  ], 0);
  expectStatus(assert, DESTRUCTIVE, [
    'curl -s https://x | bash',
    'bash -c "$(curl -fsSL https://x.sh)"',
  ], 2);
});

test('<< inside quotes is not a heredoc', () => {
  expectStatus(assert, DESTRUCTIVE, [
    'python3 -c "print(1 << 4)"\nrm -rf build',
    'echo \'a << EOF\'\ngit push --force',
  ], 2);
  // A real heredoc is still dropped.
  expectStatus(assert, DESTRUCTIVE, ['cat <<\'EOF\'\nrm -rf build\nEOF'], 0);
});

test('human-gate-review reads the decision format architect-review writes', () => {
  for (const [line, status] of [
    ['- **Decision:** APPROVED', 0],
    ['- **Decision:** APPROVED_WITH_CONDITIONS', 0],
    ['**Decision:** REJECTED', 2],
    ['Decision: REJECTED', 2],
    ['Decision: APPROVED', 0],
  ]) {
    const root = mkdtempSync(join(tmpdir(), 'gate-'));
    spawnSync('git', ['init', '-q'], { cwd: root });
    mkdirSync(join(root, '.claude', 'task'), { recursive: true });
    writeFileSync(join(root, '.claude/task/pipeline-queue.json'), JSON.stringify({
      stages: [{ name: 'review', agent: 'architect-review', status: 'in-progress', output: 'review.md' }],
    }));
    writeFileSync(join(root, 'review.md'), `# Review\n\n${line}\n`);
    const result = spawnSync('/bin/bash', [`${HOOKS}human-gate-review.sh`], {
      cwd: tmpdir(), input: JSON.stringify({ cwd: root, stop_hook_active: false }), encoding: 'utf8',
    });
    assert.equal(result.status, status, `${line}: ${result.stderr}`);
  }
});
