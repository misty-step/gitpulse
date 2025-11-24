#!/usr/bin/env bash
set -euo pipefail

# Verify Lefthook hooks are installed; fail with guidance if missing.
HOOK_DIR=".git/hooks"
MISSING=()
for hook in pre-commit pre-push; do
  if [ ! -x "$HOOK_DIR/$hook" ]; then
    MISSING+=("$hook")
  fi
done

if [ ${#MISSING[@]} -ne 0 ]; then
  echo "❌ Lefthook hooks missing: ${MISSING[*]}" >&2
  echo "Run 'pnpm install' or 'lefthook install' to restore git hooks." >&2
  exit 1
fi

echo "✅ Lefthook hooks present"
