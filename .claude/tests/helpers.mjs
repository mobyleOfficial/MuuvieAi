import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const HOOKS = fileURLToPath(new URL('../hooks/', import.meta.url));
export const META_ROOT = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');

/**
 * Runs a hook the way Claude Code does — hook JSON on stdin — under macOS's
 * /bin/bash (3.2), so bash-4-only syntax fails in tests rather than in sessions.
 */
export function runHook(name, { command, cwd = META_ROOT, filePath, processCwd = cwd } = {}) {
  const toolInput = command !== undefined ? { command } : { file_path: filePath };
  const result = spawnSync('/bin/bash', [`${HOOKS}${name}`], {
    cwd: processCwd,
    input: JSON.stringify({ cwd, tool_input: toolInput }),
    encoding: 'utf8',
  });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

/** Asserts each command gets the expected exit status, naming the command on failure. */
export function expectStatus(assert, name, commands, status, opts = {}) {
  for (const command of commands) {
    const result = runHook(name, { ...opts, command });
    assert.equal(result.status, status, `${name}: ${JSON.stringify(command)} → ${result.status}\n${result.stderr}`);
  }
}
