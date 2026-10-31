# Map Features

Bring the Muuvie feature map (`.claude/skills/muuvie-feature-map/features/`) back in line with the submodules by dispatching `feature-mapper` agents.

**Usage:** `/map-features [<slug>…] [--drift | --audit]`

`$ARGUMENTS` is any mix of page slugs and one mode flag. No arguments means `--drift`.

- `--drift` (default): fix what the checker can see — references that no longer resolve, and endpoints or routes no page names.
- `--audit`: re-read the code behind pages that changed upstream since they were mapped (behavioural drift the checker can't see).
- `<slug>…`: write or repair just these pages (new slugs create pages).

## Steps

1. Run the checker and keep its JSON:
   ```bash
   .claude/skills/muuvie-feature-map/bin/feature-map-check
   ```
   Exit 2 means an environment problem (usually submodules not checked out): show its `fix` and stop.
2. Build the work list:
   - **Slugs given:** one job per slug.
   - **`--drift`:** group `problems` by `file`; group `uncovered.endpoints` by routing file (`ShelvesRouting.kt` → the page whose *Where it lives* already cites that file, found by grepping `features/` for it) and `uncovered.routes` by the `muuvie/ui/<package>` that defines the page. Items with no owner become a job for a new page, named after the feature.
   - **`--audit`:** run `feature-map-check stale`; one job per page it lists, passing the commits.
   - Nothing to do → report the check output and stop.
3. Dispatch one `feature-mapper` per job, all in one message so they run in parallel:
   ```
   Task({
     subagent_type: "feature-mapper",
     description: "Map <slug>",
     prompt: "pages=<slug>  (or: uncovered=<json for this page> | audit=<slug> with the stale commits)\nOther mappers are running in parallel: write only your page; do not edit features/README.md — report index lines and Not mapped proposals instead."
   })
   ```
4. Apply the reports: add index lines for new pages and *Not mapped* entries (each with its reason) to `features/README.md`.
5. Run the checker again. Repeat steps 2–4 for what is left, at most twice; then report what still fails.
6. Report: pages written, refs added and removed, *Not mapped* changes, anything a mapper flagged as unverified, and the final check `stats`.

Commit the map changes in the same branch as the submodule ref bump that caused them.
