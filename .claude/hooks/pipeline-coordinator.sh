#!/bin/bash
# .claude/hooks/pipeline-coordinator.sh
# Advances the manual pipeline queue (.claude/task/pipeline-queue.json) when a
# pipeline agent finishes its stage, and names the next agent to run.
# Run by hand once a stage is accepted, with the agent whose stage it was:
#   echo '{}' | .claude/hooks/pipeline-coordinator.sh pm-spec
# Deliberately NOT wired as a frontmatter Stop hook: Claude Code runs an
# event's hooks in parallel, so it could advance a stage that a gate in the
# same event (validate-spec, human-gate-review) is blocking.
#
# Only the in-progress stage owned by that agent is completed, so a pipeline
# agent invoked for something else (e.g. architect-review dispatched by
# ultimate-developer) never advances someone else's stage. No queue, no stage
# for this agent → nothing to do. Tests: .claude/tests/pipeline-hooks.test.mjs.

. "$(dirname "$0")/lib-hook.sh"
hook_read_input
agent=${1:-}
[ -z "$agent" ] && exit 0

root=$(meta_root "$HOOK_CWD") || exit 0
queue_file="$root/.claude/task/pipeline-queue.json"
[ -f "$queue_file" ] || exit 0

stage=$(jq -r --arg agent "$agent" 'first(.stages[] | select(.status == "in-progress" and .agent == $agent) | .name) // empty' "$queue_file")
[ -z "$stage" ] && exit 0

tmp="$queue_file.tmp.$$"
jq --arg stage "$stage" --arg agent "$agent" '
  (.stages[] | select(.name == $stage) | .status) = "completed" |
  .history += [{ "stage": $stage, "agent": $agent, "completed_at": (now | todate) }]
' "$queue_file" > "$tmp" && mv "$tmp" "$queue_file" || { rm -f "$tmp"; exit 0; }
echo "Pipeline stage completed: $stage ($agent)"

next_stage=$(jq -r 'first(.stages[] | select(.status == "pending") | .name) // empty' "$queue_file")
if [ -z "$next_stage" ]; then
  jq '.current_stage = "complete"' "$queue_file" > "$tmp" && mv "$tmp" "$queue_file"
  echo "✓ Pipeline complete!"
  exit 0
fi

jq --arg stage "$next_stage" '
  (.stages[] | select(.name == $stage) | .status) = "in-progress" |
  .current_stage = $stage
' "$queue_file" > "$tmp" && mv "$tmp" "$queue_file"

next_agent=$(jq -r --arg stage "$next_stage" 'first(.stages[] | select(.name == $stage) | .agent)' "$queue_file")
next_input=$(jq -r --arg stage "$next_stage" 'first(.stages[] | select(.name == $stage) | .input) // "the previous stage output"' "$queue_file")
echo ""
echo "▶ Next stage: $next_stage"
echo "▶ Use the $next_agent subagent to read $next_input and proceed"
exit 0
