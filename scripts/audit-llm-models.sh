#!/usr/bin/env bash
set -euo pipefail

echo "== GitPulse LLM Model Audit =="

if ! command -v rg >/dev/null 2>&1; then
  echo "ripgrep (rg) is required."
  exit 1
fi

echo
echo "-- Model references in active app surface (apps/* + packages/*) --"
rg -n "(gpt-|claude-|gemini-|o[34]-|openrouter|OPENROUTER_API_KEY|GITPULSE_MODEL)" \
  apps packages \
  --glob '!**/*.test.ts' \
  --glob '!**/*.test.tsx' || true

echo
echo "-- Hardcoded primary-model anti-pattern check --"
if rg -n "openrouter\\.chat\\(\"" packages/agent-core/src; then
  echo "FAIL: direct hardcoded model in runtime. Use llm/config.ts."
  exit 1
fi
echo "PASS: no hardcoded openrouter.chat(\"...\") model literals in agent runtime."

echo
echo "-- Legacy model refs outside active surface (for cleanup backlog) --"
rg -n "(gpt-|claude-|gemini-)" . \
  --glob '!node_modules/**' \
  --glob '!apps/**' \
  --glob '!packages/**' \
  --glob '!.git/**' || true
