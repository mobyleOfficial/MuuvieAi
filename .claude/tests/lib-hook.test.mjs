import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const LIB = fileURLToPath(new URL('../hooks/lib-hook.sh', import.meta.url));

// macOS /bin/bash is 3.2: run the helpers under it so bash-4-only syntax fails here.
function lib(fn, ...args) {
  const result = spawnSync('/bin/bash', ['-c', `. "${LIB}"; ${fn} "$@"`, '_', ...args], { encoding: 'utf8' });
  return { status: result.status, out: result.stdout.replace(/\n$/, ''), err: result.stderr };
}

test('strip_heredocs drops heredoc bodies, including $(cat <<EOF … EOF)', () => {
  const cmd = 'gh pr create --body "$(cat <<\'EOF\'\nrun git push --force here\nEOF\n)"\ngit status';
  assert.equal(lib('strip_heredocs', cmd).out, 'gh pr create --body "$(cat <<\'EOF\'\n)"\ngit status');
});

test('strip_heredocs keeps text after a here-string', () => {
  assert.equal(lib('strip_heredocs', 'grep x <<< "$v"\ngit push').out, 'grep x <<< "$v"\ngit push');
});

test('strip_heredocs accepts a terminator followed by )', () => {
  assert.equal(lib('strip_heredocs', 'x=$(cat <<EOF\nbody\nEOF)\ngit push').out, 'x=$(cat <<EOF\ngit push');
});

test('strip_quotes empties quoted strings and honours escapes', () => {
  assert.equal(lib('strip_quotes', 'git commit -m "say \\"push --force\\" no" -m \'rm -rf /\' && ls').out, 'git commit -m "" -m \'\' && ls');
});

test('command_segments splits on operators and drops env prefixes', () => {
  const text = lib('executable_text', 'FOO=1 BAR=2 git commit -m "a; b" && (cd x; git push) | tee log').out;
  assert.deepEqual(lib('command_segments', text).out.split('\n'), ['git commit -m ""', 'cd x', 'git push', 'tee log']);
});

test('runs_git sees global options and ignores mentions', () => {
  assert.equal(lib('runs_git', 'git -C muuvie --no-pager commit -m ""', 'commit').status, 0);
  assert.equal(lib('runs_git', 'echo ""', 'push').status, 1);
  const mention = lib('executable_text', 'git commit -m "then git push"').out;
  assert.equal(lib('runs_git', mention, 'push').status, 1);
});

test('session-start.sh runs under bash 3.2 and counts rules by category', () => {
  const result = spawnSync('/bin/bash', [fileURLToPath(new URL('../hooks/session-start.sh', import.meta.url))], { encoding: 'utf8', input: '{}' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^MuuvieAi session — \d+ rules/);
  assert.match(result.stdout, /Rules: \d+ common, \d+ frontend, \d+ backend/);
});
