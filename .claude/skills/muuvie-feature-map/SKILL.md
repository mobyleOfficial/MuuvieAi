---
name: muuvie-feature-map
description: "Map of every user-facing Muuvie feature: what a user can do, how they get there, and which code in muuvie/ (Flutter route, screen, BLoC, datasource) and backend/ (Ktor endpoint, use case) does it. Use before changing, reviewing, verifying or explaining a Muuvie feature, when an agent needs to find where a screen or endpoint lives, and whenever a submodule ref moves."
---

# Muuvie feature map

[`features/README.md`](features/README.md) indexes every user-facing feature in sweep order. Open the index, then **only** the page you need. Each page connects the user's view (tab › button › screen, pt-BR labels) to the code on both sides of the API, so you don't have to rediscover it.

The map is read from code. Nothing here drives the running app yet: there is no app driver, so a page's *Driving it* section gives curl recipes for the backend and the route or deep link for the app. Say so in your evidence rather than claiming you saw a screen.

## Page format

Every page has a title, a `> Mapped at backend@<sha> muuvie@<sha> · source: code` header, a one-paragraph summary, and these sections in order: `Sub-features`, `How to get to it (user POV)`, `Where it lives`, `Driving it`, `Gotchas`. Pages stay under ~120 lines.

## References the checker understands

Inside backticks, outside fenced code blocks:

| Kind | Example | Resolves when |
|---|---|---|
| Endpoint | `` `GET /shelves/{id}` `` | a Ktor route with that method and path exists (param names and query strings ignored). Paths are relative to `/api/v1`, except the root-mounted health routes |
| App route | `` `ShelfDetailRoute` `` | `ShelfDetailRoute.page` is registered in `muuvie/lib/routes/app_router.dart`. Only checked in *Where it lives*; a `*Tab` name counts only when the router registers it (the five shell tabs) |
| Path | `` `muuvie/ui/profile/lib/tabs/shelves` `` | the file or directory exists. Write real paths: no `...`, no globs |
| l10n key | `` `l10n:searchHint` `` | the key exists in `muuvie/ui/common/lib/l10n/app_pt.arb` |

Anything else in backticks is prose to the checker.

## The check

```bash
B=.claude/skills/muuvie-feature-map/bin/feature-map-check
$B            # check: every ref resolves; every endpoint and route is on a page or under "Not mapped"
$B inventory  # every backend endpoint and app route with file:line — the ground truth
$B uncovered  # only what no page names yet
$B stale      # per page: submodule commits since its Mapped-at sha touching the paths it cites
$B --help
```

One JSON object per run. `problems` fail the check, `warnings` (page too long, section order, a submodule checked out off its recorded commit) don't, except that `--strict` turns the submodule warning into a problem. Each finding carries a `fix`. Tests: `cd .claude/skills/muuvie-feature-map && npm test`.

## Keeping it true

**A page that no longer matches the app is a bug** (`rules/common/FEATURE_MAP.md`). The submodules can't carry the map (`rules/common/AI_AGNOSTIC_SUBMODULES.md`), so the meta-repo PR that moves a submodule ref updates the pages its changes touch, and `.claude/hooks/check-feature-map.sh` blocks a push or PR that leaves the check failing.

- The hook runs *before* the command, so it judges the repo as it is then. Commit a submodule ref bump in one command and push in the next: `git add muuvie && git commit … && git push` as a single command is blocked, because the bump isn't committed yet when the hook looks (`submodule-mismatch`).
- New endpoint or route: `$B uncovered` names it; add it to the page that owns it.
- Changed behaviour: update the page, and its `Mapped at` shas.
- Periodically: `/map-features --audit` re-reads the code behind pages that `stale` flags.

The `feature-mapper` agent does all three; `/map-features` dispatches it.
