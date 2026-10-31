#!/bin/bash
# .claude/hooks/check-python-env.sh
# Blocks Python package installs that would land outside a project virtualenv.
# Enforces rules/common/PYTHON_ENVS.md.
# Registered as a PreToolUse hook on the Bash tool in .claude/settings.json.
#
# The Bash tool keeps no environment between calls, so "activate, then install"
# has to happen in one command — that counts as in a venv. So do a venv's own
# binaries (.venv/bin/pip), uv (it refuses to install outside a venv unless told
# --system) and poetry (it manages its own venv). Mentions in messages, quotes
# and heredocs don't count. Tests: .claude/tests/command-hooks.test.mjs.

. "$(dirname "$0")/lib-hook.sh"
hook_read_input
[ -z "$HOOK_COMMAND" ] && exit 0

text=$(executable_text "$HOOK_COMMAND")
segments=$(command_segments "$text")

violation=""
if printf '%s\n' "$segments" | grep -qE -- '--break-system-packages'; then
  violation="--break-system-packages installs into the system Python"
elif printf '%s\n' "$segments" | grep -qE '^uv[[:space:]]+pip[[:space:]]+install([[:space:]].*)?[[:space:]]--system([[:space:]]|$)'; then
  violation="uv pip install --system installs into the system Python"
elif printf '%s\n' "$segments" | grep -qE '^(pip[0-9.]*|python[0-9.]*[[:space:]]+-m[[:space:]]+pip|conda)[[:space:]]+install([[:space:]]|$)'; then
  # A bare pip / python -m pip / conda install: fine only inside an environment.
  if [ -n "${VIRTUAL_ENV:-}" ] || [ -n "${CONDA_PREFIX:-}" ] || [ -n "${POETRY_ACTIVE:-}" ]; then
    exit 0
  fi
  if printf '%s\n' "$segments" | grep -qE '^((source|\.)[[:space:]]+[^[:space:]]*bin/activate|conda[[:space:]]+activate)([[:space:]]|$)'; then
    exit 0
  fi
  violation="install command outside an active virtualenv"
fi

[ -z "$violation" ] && exit 0
echo "❌ PYTHON_ENVS rule violation: $violation." >&2
echo "   Install inside a project venv, in the same command (the Bash tool keeps no environment):" >&2
echo "     python3 -m venv .venv && source .venv/bin/activate && pip install …" >&2
echo "   or call the venv's own pip: .venv/bin/pip install …   See rules/common/PYTHON_ENVS.md." >&2
exit 2
