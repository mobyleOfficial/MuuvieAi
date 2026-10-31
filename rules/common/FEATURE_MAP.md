# Feature Map Rule

**RULE:** The Muuvie feature map (`.claude/skills/muuvie-feature-map/features/`) must match the submodule commits the meta-repo records. A meta-repo change that moves the `muuvie` or `backend` ref, or edits the map, must leave `feature-map-check --strict` passing, and must update every page whose behaviour the change alters. **A page that no longer matches the app is a bug.**

## Why

- The map is how agents find a feature and its code in both repos without rediscovering the product. A wrong page sends them to the wrong code with confidence.
- The submodules must stay AI-agnostic (`AI_AGNOSTIC_SUBMODULES.md`), so submodule PRs never touch the map. The meta-repo PR that bumps a submodule ref is the only moment the map can be brought along.
- The checker sees names (endpoints, routes, paths, l10n keys), not behaviour. Names stay true by enforcement; behaviour stays true by this rule and periodic audits.

## What's Required

- **Bumping a submodule ref:** run `.claude/skills/muuvie-feature-map/bin/feature-map-check`. New endpoints or routes appear under `uncovered`; references to removed ones appear under `problems`. Fix both on the same branch (`/map-features` dispatches `feature-mapper` to do it).
- **Behaviour changed** (new rule, label, state, error, entry point): update the page that describes it, and its `> Mapped at` shas.
- **Not user-facing** (probes, internal endpoints): list it under `## Not mapped` in `features/README.md` with a reason, rather than leaving it uncovered.
- **Periodically:** `/map-features --audit` re-reads the code behind pages that `feature-map-check stale` lists.

## Enforcement

- **Automatic:** `.claude/hooks/check-feature-map.sh` runs as `PreToolUse` on Bash. On `git push` / `gh pr create` in the meta-repo, when the branch changes `muuvie`, `backend` or the map against its base (`origin/dev`, else `origin/main`), it runs `feature-map-check --strict` and blocks on failure. It does not judge pushes made from inside a submodule, and it skips when Node or a submodule checkout is missing.
- **Backstop:** the `validator` agent runs the check, because the hook only gates Claude sessions, not pushes from a terminal.

## Exceptions

- A ref bump that only touches tests, CI or tooling in the submodule needs no page changes, but the check must still pass.
- Warnings (page over 150 lines, sections out of order, a submodule checked out off its recorded commit without `--strict`) don't block.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Bumping a ref and fixing the map "later" | Same PR. The hook blocks the push anyway. |
| Silencing an uncovered endpoint by adding it to *Not mapped* | Only for endpoints no user reaches. Give the reason. |
| Writing a page from file names | Every rule and label on a page is read in code. See `agents/feature-mapper.md`. |
| Leaving the `Mapped at` shas old after an update | `feature-map-check stale` then flags the page forever. |

---

See also: [DOCS_UP_TO_DATE.md](DOCS_UP_TO_DATE.md), [AI_AGNOSTIC_SUBMODULES.md](AI_AGNOSTIC_SUBMODULES.md)
