# Review PR

Run the `reviewer` agent against a GitHub pull request.

**Usage:** `/review-pr <PR-number>`

The argument `$ARGUMENTS` is the PR number (e.g. `12`, `#12`, or a full PR URL).

## Steps

1. Parse `$ARGUMENTS` into a PR number.
2. Dispatch the `reviewer` subagent with the PR number:
   ```
   Task({
     subagent_type: "reviewer",
     description: "Review PR <N>",
     prompt: "Review PR #<N> on mobyleOfficial/MuuvieAi using the multi-pass workflow defined in .claude/agents/reviewer.md. Run the three specialized sub-reviewers in parallel, validate findings, deduplicate against any existing inline comments, and post net-new findings as inline review comments. Return the final JSON summary."
   })
   ```
3. After the agent returns, read the JSON summary and report to the user:
   - Number of new comments posted
   - Number of prior comments resolved
   - Overall risk level
   - Whether the PR is ready to merge (no remaining unresolved findings)
4. If `overall_risk` is `Low` and `posted_comments == 0` and no unresolved prior threads remain, suggest a 30-second pause and then merging via `gh pr merge <N> --squash --delete-branch`.

## What Happens Under the Hood

The reviewer agent:

1. Reads the PR diff and title/body
2. Resolves prior inline comments that are no longer applicable (re-review mode)
3. Dispatches three subagents in parallel:
   - `security` — security vulnerabilities only
   - `bug-finder` — correctness bugs only
   - `architecture` — design / structural problems only
4. Aggregates, validates, risk-ranks, and deduplicates
5. Posts surviving findings as inline GitHub review comments
6. Returns a STRICT JSON summary

See [`.claude/agents/reviewer.md`](../agents/reviewer.md) for the full workflow specification.
