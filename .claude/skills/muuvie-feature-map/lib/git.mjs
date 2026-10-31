import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SUBMODULES } from './paths.mjs';

/** Runs git; returns trimmed stdout, or null when git fails. */
export function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

/** Whether `dir` is the top of its own git checkout (a submodule's `.git` is a file). */
export function isCheckout(dir) {
  return existsSync(join(dir, '.git'));
}

/**
 * For each submodule: the commit the meta-repo's HEAD records, and the commit checked out.
 * Submodules git can't answer for (fixtures, fresh clones) are left out.
 */
export function submoduleStates(root) {
  const states = [];
  for (const name of SUBMODULES) {
    const entry = git(root, 'ls-tree', 'HEAD', name);
    const recorded = entry?.match(/^160000 commit ([0-9a-f]+)\t/)?.[1];
    const dir = join(root, name);
    const checkedOut = isCheckout(dir) ? git(dir, 'rev-parse', 'HEAD') : null;
    if (recorded && checkedOut) states.push({ name, recorded, checkedOut });
  }
  return states;
}
