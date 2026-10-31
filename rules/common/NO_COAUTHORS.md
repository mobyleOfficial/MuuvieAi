# No Coauthors Policy

**Rule:** Never use coauthors (Co-Authored-By) in commits, PRs, or issues across all child repositories (muuvie, backend, etc).

## Why

- Single, clear author per commit
- Cleaner git history and blame
- Simpler attribution

## Where This Applies

- Commits: No `Co-Authored-By:` trailers
- Pull Request descriptions: No coauthor mentions
- Issues: Single owner/reporter, no coauthor tags
- Squash commits: Single author

## Implementation

**Git hook (optional):** Add to `.git/hooks/commit-msg` to prevent accidental coauthors:
```bash
grep -i "Co-Authored-By" "$1" && exit 1 || exit 0
```

**Claude instructions:** Claude Code should not add coauthors when committing on behalf of users in these repos.

## Exceptions

None. Single author always.
