#!/usr/bin/env bash
# Used by smoke tests to verify each audit-only-aware agent declares the contract.
# Usage: validate-audit-only.sh <agent-md-path>
set -euo pipefail
F="${1:?agent file path required}"
[ -f "$F" ] || { echo "FAIL: $F missing"; exit 1; }
# Lenient detector — matches mode: "audit-only" / mode=audit-only / MODE : 'audit-only' / etc.
# Case-insensitive; tolerates whitespace and either quote style. Same regex the agents use at runtime,
# so the smoke test catches drift (e.g., if someone writes mode='audit_only' with underscore).
grep -qiE 'mode[[:space:]]*[:=][[:space:]]*["'"'"']*audit-only["'"'"']*' "$F" \
  || { echo "FAIL: $F missing audit-only contract (regex: mode[:=]\"?audit-only\"?)"; exit 1; }
grep -qF 'STRICT JSON' "$F" || { echo "FAIL: $F missing JSON output contract"; exit 1; }
echo "PASS: $F"
