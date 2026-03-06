#!/usr/bin/env bash
set -euo pipefail

echo "== GitPulse LLM Model Audit =="

have_rg=false
if command -v rg >/dev/null 2>&1; then
  have_rg=true
fi

search_active() {
  local pattern="$1"

  if [ "$have_rg" = true ]; then
    rg -n "$pattern" apps packages \
      --glob '!**/*.test.ts' \
      --glob '!**/*.test.tsx'
    return
  fi

  grep -RInE "$pattern" apps packages \
    --exclude='*.test.ts' \
    --exclude='*.test.tsx' \
    --binary-files=without-match
}

search_repo() {
  local pattern="$1"

  if [ "$have_rg" = true ]; then
    rg -n "$pattern" . \
      --glob '!node_modules/**' \
      --glob '!apps/**' \
      --glob '!packages/**' \
      --glob '!.git/**'
    return
  fi

  grep -RInE "$pattern" . \
    --exclude-dir=node_modules \
    --exclude-dir=apps \
    --exclude-dir=packages \
    --exclude-dir=.git \
    --binary-files=without-match
}

echo
echo "-- Model references in active app surface (apps/* + packages/*) --"
search_active "(gpt-|claude-|gemini-|o[34]-|openrouter|OPENROUTER_API_KEY|GITPULSE_MODEL)" || true

echo
echo "-- Hardcoded primary-model anti-pattern check --"
if search_active "openrouter\\.chat\\(\\s*[\"']" | grep -q .; then
  echo "FAIL: direct hardcoded model in runtime. Use llm/config.ts."
  exit 1
fi
echo "PASS: no hardcoded openrouter.chat(\"...\") model literals in agent runtime."

echo
echo "-- Legacy model refs outside active surface (for cleanup backlog) --"
# TODO: legacy/pre-agentic-root and other archived paths are expected noise here
# until the old tree is deleted entirely. Keep surfacing them so cleanup stays visible.
search_repo "(gpt-|claude-|gemini-)" || true
