#!/bin/bash
# .claude/hooks/human-gate-review.sh
# Human gate after the architect review stage.
# Define this as a Stop hook in the architect-review agent's frontmatter.
# Reads the active stage from .claude/task/pipeline-queue.json so paths stay
# in sync with the queue (no hard-coded .tasks/ paths).

. "$(dirname "$0")/lib-hook.sh"
hook_read_input
stop_hook_active && exit 0

root=$(meta_root "$HOOK_CWD") || exit 0
queue_file="$root/.claude/task/pipeline-queue.json"

# No queue: architect-review ran outside the manual pipeline (for example
# dispatched by ultimate-developer). Nothing to gate.
[ -f "$queue_file" ] || exit 0

# Pull the review file path and the spec path it gated from the queue
review_file=$(jq -r 'first(.stages[] | select(.name == "review" and .status == "in-progress") | .output) // empty' "$queue_file")
spec_file=$(jq -r 'first(.stages[] | select(.name == "spec") | .output) // empty' "$queue_file")

if [ -z "$review_file" ]; then
  # Architect-review ran outside the pipeline — nothing to gate on
  exit 0
fi

case "$review_file" in /*) ;; *) review_file="$root/$review_file" ;; esac

if [ ! -f "$review_file" ]; then
  echo "Blocked: architect-review did not produce $review_file" >&2
  exit 2
fi

# The first "Decision" line, in the form architect-review writes
# ("- **Decision:** APPROVED_WITH_CONDITIONS") or the plain "Decision: APPROVED".
decision=$(grep -iE '^[[:space:]]*(-[[:space:]]*)?(\*\*)?Decision' "$review_file" | head -n 1 |
  grep -oE 'APPROVED_WITH_CONDITIONS|APPROVED|REJECTED' | head -n 1)

if [ "$decision" = "REJECTED" ]; then
  echo "Blocked: architect rejected the design" >&2
  echo "Review feedback in $review_file and revise the spec at $spec_file." >&2
  exit 2
fi

if [ "$decision" = "APPROVED" ] || [ "$decision" = "APPROVED_WITH_CONDITIONS" ]; then
  if [ "$decision" = "APPROVED_WITH_CONDITIONS" ]; then
    echo "Architect approved the design, with conditions — read them in the review before implementing."
  else
    echo "Architect approved the design."
  fi
  echo ""
  echo "------------------------------------------------------------"
  echo "HUMAN GATE: review the approval before implementation starts"
  echo "------------------------------------------------------------"
  echo ""
  echo "  Spec   : $spec_file"
  echo "  Review : $review_file"
  echo ""
  echo "To proceed:  use the implementer-tester subagent on $spec_file"
  echo "To revise :  edit the spec, then re-run the architect-review subagent"
  echo ""
  exit 0
fi

echo "Blocked: review decision is missing or unrecognized" >&2
echo "Expected a line like '- **Decision:** APPROVED' (or APPROVED_WITH_CONDITIONS / REJECTED) in $review_file." >&2
exit 2
