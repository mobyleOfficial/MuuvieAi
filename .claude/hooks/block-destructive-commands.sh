#!/bin/bash
# .claude/hooks/block-destructive-commands.sh
# Blocks destructive shell commands: anything that destroys local work, rewrites
# shared git history, bypasses safety checks, publishes, or touches the host.
# Wired project-wide as a PreToolUse hook on Bash in .claude/settings.json.
#
# Judges what actually runs, not what the text mentions: heredoc bodies and
# quoted strings are dropped first (lib-hook.sh), then each simple command is
# checked word by word. `bash -c '…'`, `sh -c "…"` and `eval "…"` payloads are
# checked too. Tests: .claude/tests/block-destructive-commands.test.mjs.

. "$(dirname "$0")/lib-hook.sh"
hook_read_input
[ -z "$HOOK_COMMAND" ] && exit 0

block() {
  echo "Blocked: $1." >&2
  echo "Command: $HOOK_COMMAND" >&2
  echo "If this is really intended, ask the user to run it themselves." >&2
  exit 2
}

is_whole_tree() { case "$1" in .|./|:/|'*'|:) return 0 ;; esac; return 1; }

check_git() {
  local i=1 sub arg n=${#w[@]}
  # git's global options before the subcommand: -C dir, -c key=val, --no-pager, …
  while [ "$i" -lt "$n" ]; do
    case "${w[$i]}" in
      -C|-c) i=$((i + 2)) ;;
      --*) i=$((i + 1)) ;;
      *) break ;;
    esac
  done
  sub=${w[$i]}
  local args=("${w[@]:$((i + 1))}")

  for arg in "${args[@]}"; do
    case "$arg" in
      --no-verify) block "git --no-verify skips the repo's hooks" ;;
      --no-gpg-sign) block "git --no-gpg-sign skips commit signing" ;;
    esac
  done

  case "$sub" in
    push)
      for arg in "${args[@]}"; do
        case "$arg" in
          --force|--force-with-lease*|--force-if-includes|--mirror|--delete|--prune) block "git push $arg rewrites or deletes remote refs" ;;
          --*) ;;
          -*[fd]*) block "git push $arg forces or deletes remote refs" ;;
          +*) block "a +refspec force-pushes" ;;
          :*) block "a :refspec deletes a remote branch" ;;
        esac
      done ;;
    reset)
      for arg in "${args[@]}"; do [ "$arg" = "--hard" ] && block "git reset --hard discards local work"; done ;;
    clean)
      for arg in "${args[@]}"; do
        case "$arg" in --force) block "git clean --force deletes untracked files" ;; --*) ;; -*f*) block "git clean -f deletes untracked files" ;; esac
      done ;;
    checkout)
      for arg in "${args[@]}"; do
        case "$arg" in -f|--force) block "git checkout --force discards local changes" ;; esac
        is_whole_tree "$arg" && block "git checkout $arg discards every local change"
      done ;;
    restore)
      local staged=0 worktree=0 whole=0
      for arg in "${args[@]}"; do
        case "$arg" in
          --staged|-S) staged=1 ;;
          --worktree|-W) worktree=1 ;;
          -*S*W*|-*W*S*) staged=1; worktree=1 ;;
        esac
        is_whole_tree "$arg" && whole=1
      done
      # Unstaging only is safe; discarding the whole working tree is not.
      if [ "$whole" -eq 1 ] && { [ "$staged" -eq 0 ] || [ "$worktree" -eq 1 ]; }; then
        block "git restore of the whole tree discards every local change"
      fi ;;
    switch)
      for arg in "${args[@]}"; do
        case "$arg" in -f|--force|--discard-changes) block "git switch $arg discards local changes" ;; esac
      done ;;
    branch)
      local del=0 force=0
      for arg in "${args[@]}"; do
        case "$arg" in
          -D) block "git branch -D deletes an unmerged branch" ;;
          --delete) del=1 ;;
          --force) force=1 ;;
          --*) ;;
          -*) case "$arg" in *D*) block "git branch -D deletes an unmerged branch" ;; esac
              case "$arg" in *d*) del=1 ;; esac
              case "$arg" in *f*) force=1 ;; esac ;;
        esac
      done
      [ "$del" -eq 1 ] && [ "$force" -eq 1 ] && block "git branch --delete --force deletes an unmerged branch" ;;
    rebase)
      for arg in "${args[@]}"; do
        case "$arg" in --interactive) block "interactive rebase isn't supported here" ;; --*) ;; -*i*) block "interactive rebase isn't supported here" ;; esac
      done ;;
    config)
      local positional=0 skip=0
      for arg in "${args[@]}"; do
        if [ "$skip" -eq 1 ]; then skip=0; continue; fi
        case "$arg" in
          --unset|--unset-all|--add|--replace-all|--rename-section|--remove-section|--edit|-e) block "git config $arg changes configuration" ;;
          --file|-f|--blob|--type|--default) skip=1 ;;
          -*) ;;
          *) positional=$((positional + 1)) ;;
        esac
      done
      [ "$positional" -ge 2 ] && block "git config <key> <value> changes configuration" ;;
    tag)
      for arg in "${args[@]}"; do case "$arg" in -d|--delete) block "git tag --delete deletes a tag" ;; esac; done ;;
    update-ref)
      for arg in "${args[@]}"; do [ "$arg" = "-d" ] && block "git update-ref -d deletes a ref"; done ;;
    stash)
      case "${args[0]:-}" in clear|drop) block "git stash ${args[0]} throws away stashed work" ;; esac ;;
    filter-branch|filter-repo)
      block "git $sub rewrites history" ;;
  esac
}

check_segment() {
  local seg=$1
  w=()
  read -r -a w <<< "$seg"
  [ "${#w[@]}" -eq 0 ] && return 0
  # Wrappers that run the next word as the command.
  while [ "${#w[@]}" -gt 1 ]; do
    case "${w[0]}" in
      sudo) block "sudo runs with root privileges" ;;
      command|exec|nohup|time|nice|env) w=("${w[@]:1}") ;;
      *) break ;;
    esac
  done
  local cmd=${w[0]##*/} arg
  case "$cmd" in
    sudo) block "sudo runs with root privileges" ;;
    rm)
      local r=0 f=0
      for arg in "${w[@]:1}"; do
        case "$arg" in
          --) break ;;
          --recursive) r=1 ;;
          --force) f=1 ;;
          --*) ;;
          -*) case "$arg" in *[rR]*) r=1 ;; esac; case "$arg" in *f*) f=1 ;; esac ;;
        esac
      done
      [ "$r" -eq 1 ] && [ "$f" -eq 1 ] && block "rm -rf deletes a tree without asking (use find <dir> -depth -delete for a scoped cleanup)" ;;
    mkfs|mkfs.*|shred|diskutil) block "$cmd destroys data on disk" ;;
    dd)
      for arg in "${w[@]:1}"; do case "$arg" in of=/dev/*) block "dd to a device overwrites it" ;; esac; done ;;
    mv)
      [ "${w[${#w[@]}-1]}" = "/dev/null" ] && block "mv to /dev/null destroys the file" ;;
    kill)
      for arg in "${w[@]:1}"; do case "$arg" in -9|-KILL|-SIGKILL) block "kill -9 skips clean shutdown" ;; esac; done ;;
    shutdown|reboot|halt|poweroff) block "$cmd affects the host" ;;
    chmod)
      for arg in "${w[@]:1}"; do case "$arg" in 777|0777|a+rwx) block "chmod 777 opens files to everyone" ;; esac; done ;;
    npm|yarn|pnpm)
      case "${w[1]:-}" in publish|uninstall|remove|un|unlink|rm) block "$cmd ${w[1]} publishes or removes packages" ;; esac ;;
    dart|flutter)
      [ "${w[1]:-}" = "pub" ] && [ "${w[2]:-}" = "publish" ] && block "$cmd pub publish publishes a package" ;;
    git) check_git ;;
  esac
}

# $1 = command text; $2 = nesting depth (bash -c inside bash -c …).
check_text() {
  local raw=$1 depth=${2:-0} nohd text seg payload
  nohd=$(strip_heredocs "$raw")
  text=$(strip_quotes "$nohd")

  # On the quote-stripped text, so a message that mentions them doesn't count.
  if printf '%s\n' "$text" | grep -qE '(curl|wget)[^|;&]*\|[[:space:]]*((sudo|env|exec|command|nohup)[[:space:]]+)*([^[:space:]|]*/)?(ba|z)?sh([[:space:]]|$)'; then
    block "piping a download into a shell runs remote code"
  fi
  if printf '%s\n' "$text" | grep -qE ':\(\)[[:space:]]*\{[[:space:]]*:[[:space:]]*\|[[:space:]]*:[[:space:]]*&[[:space:]]*\}'; then
    block "fork bomb"
  fi

  while IFS= read -r seg; do
    check_segment "$seg"
  done < <(command_segments "$text")

  # Nested shells: bash -c, bash -lc, sh -ec, bash -l -c, /bin/sh -c, eval — behind
  # anything (timeout, xargs, find -exec, if, VAR="a b"). Whether one really runs
  # is decided on the quote-stripped text, where prose is blanked; its payload is
  # then read from the text with quotes intact.
  local shell_c='(ba|z)?sh([[:space:]]+-[a-zA-Z]+)*[[:space:]]+-[a-zA-Z]*c[a-zA-Z]*'
  printf '%s\n' "$text" | grep -qE "(^|[[:space:];&|(){}\`/])(${shell_c}|eval)([[:space:]]|\$)" || return 0

  # `bash -c "$(curl …)"` runs a download.
  if printf '%s\n' "$nohd" | grep -qE "${shell_c}[[:space:]]+[\"']?\\\$\\((curl|wget)"; then
    block "running a downloaded script runs remote code"
  fi

  [ "$depth" -ge 3 ] && return 0
  local nested="(${shell_c}|eval)[[:space:]]+"
  while IFS= read -r payload; do
    [ -n "$payload" ] && check_text "$payload" $((depth + 1))
  done < <(printf '%s\n' "$nohd" |
    grep -oE "${nested}('[^']*'|\"([^\"\\\\]|\\\\.)*\")" |
    sed -E "s#^${nested}##; s/^['\"]//; s/['\"]\$//")
}

check_text "$HOOK_COMMAND"
exit 0
