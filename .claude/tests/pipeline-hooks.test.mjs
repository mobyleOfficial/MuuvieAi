import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HOOKS } from './helpers.mjs';

function stopHook(name, { cwd, args = [], stopHookActive = false }) {
  const result = spawnSync('/bin/bash', [`${HOOKS}${name}`, ...args], {
    cwd: tmpdir(),
    input: JSON.stringify({ cwd, stop_hook_active: stopHookActive, hook_event_name: 'SubagentStop' }),
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** A git repo with an optional pipeline queue: stages as [name, agent, status, output]. */
function repo(stages, files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'pipeline-'));
  spawnSync('git', ['init', '-q'], { cwd: root });
  mkdirSync(join(root, '.claude', 'task'), { recursive: true });
  if (stages) {
    const queue = {
      current_stage: 'x',
      stages: stages.map(([name, agent, status, output = null]) => ({ name, agent, status, input: null, output })),
      history: [],
    };
    writeFileSync(join(root, '.claude/task/pipeline-queue.json'), JSON.stringify(queue));
  }
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const queueOf = (root) => JSON.parse(readFileSync(join(root, '.claude/task/pipeline-queue.json'), 'utf8'));

test('pipeline-coordinator completes only the stopping agent\'s stage', () => {
  const root = repo([['spec', 'pm-spec', 'completed'], ['review', 'architect-review', 'in-progress'], ['implement', 'implementer-tester', 'pending']]);
  // Another agent stopping does nothing.
  assert.equal(stopHook('pipeline-coordinator.sh', { cwd: root, args: ['validator'] }).status, 0);
  assert.equal(queueOf(root).stages[1].status, 'in-progress');
  const result = stopHook('pipeline-coordinator.sh', { cwd: root, args: ['architect-review'] });
  assert.equal(result.status, 0);
  const queue = queueOf(root);
  assert.deepEqual(queue.stages.map((s) => s.status), ['completed', 'completed', 'in-progress']);
  assert.equal(queue.current_stage, 'implement');
  assert.match(result.stdout, /implementer-tester/);
});

test('pipeline-coordinator does nothing without a queue or an agent name', () => {
  assert.equal(stopHook('pipeline-coordinator.sh', { cwd: repo(null), args: ['pm-spec'] }).status, 0);
  const root = repo([['spec', 'pm-spec', 'in-progress']]);
  assert.equal(stopHook('pipeline-coordinator.sh', { cwd: root }).status, 0);
  assert.equal(queueOf(root).stages[0].status, 'in-progress');
});

test('human-gate-review passes when there is no queue (architect-review outside the pipeline)', () => {
  assert.equal(stopHook('human-gate-review.sh', { cwd: repo(null) }).status, 0);
});

test('human-gate-review blocks a rejected design and passes an approved one', () => {
  const rejected = repo([['spec', 'pm-spec', 'completed', 'spec.md'], ['review', 'architect-review', 'in-progress', 'review.md']], { 'review.md': 'Decision: REJECTED\n' });
  assert.equal(stopHook('human-gate-review.sh', { cwd: rejected }).status, 2);
  assert.equal(stopHook('human-gate-review.sh', { cwd: rejected, stopHookActive: true }).status, 0);
  const approved = repo([['review', 'architect-review', 'in-progress', 'review.md']], { 'review.md': 'Decision: APPROVED\n' });
  const result = stopHook('human-gate-review.sh', { cwd: approved });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /HUMAN GATE/);
});

test('validate-spec checks the in-progress spec, resolved from the session cwd', () => {
  const thin = repo([['spec', 'pm-spec', 'in-progress', 'research/specs/x.md']], { 'research/specs/x.md': '## Overview\n' });
  assert.equal(stopHook('validate-spec.sh', { cwd: thin }).status, 2);
  assert.equal(stopHook('validate-spec.sh', { cwd: thin, stopHookActive: true }).status, 0);
  const full = [
    '## Overview', 'x', '## User Stories', 'x',
    '## Acceptance Criteria', 'Given a signed-in user, when they open the shelf, then the movies list loads and shows each title with its poster.',
    '## Technical Notes', 'Touches features/shelves domain and a Cubit in ui/shelves.', '## Out of Scope', 'x',
  ].join('\n');
  const good = repo([['spec', 'pm-spec', 'in-progress', 'research/specs/x.md']], { 'research/specs/x.md': full });
  assert.equal(stopHook('validate-spec.sh', { cwd: good }).status, 0);
  assert.equal(stopHook('validate-spec.sh', { cwd: repo(null) }).status, 0);
});
