// Regression tests for the fourth /review-pr pass on PR #36.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expectStatus } from './helpers.mjs';

const DESTRUCTIVE = 'block-destructive-commands.sh';

test('nested shells glued to ( $( ; && || are inspected', () => {
  expectStatus(assert, DESTRUCTIVE, [
    '(bash -c "git push --force")',
    'x=$(bash -c \'rm -rf build\')',
    'cd x;bash -c \'git reset --hard\'',
    'cd x&&bash -c \'rm -rf build\'',
    'true||bash -c \'git push --force\'',
    'cd x;eval \'rm -rf build\'',
    'out=`bash -c "git push --force"`',
  ], 2);
});

test('flags after an unquoted command substitution are still seen', () => {
  expectStatus(assert, DESTRUCTIVE, [
    'git push origin $(git branch --show-current) --force',
    'git reset $(git merge-base HEAD main) --hard',
    'git commit -m x $(echo a) --no-verify',
    'git -C $(git rev-parse --show-toplevel) push --force',
    'git push origin `git branch --show-current` --force',
    'rm $(ls -d build) -rf',
  ], 2);
  // Substitutions themselves are still checked, and arithmetic is left alone.
  expectStatus(assert, DESTRUCTIVE, ['echo $(rm -rf build)', 'echo `git push --force`'], 2);
  expectStatus(assert, DESTRUCTIVE, ['git push origin $(git branch --show-current)', 'echo $((1 + 2))', 'git log -n $((3 * 2))'], 0);
});
