#!/usr/bin/env bash

# Deployment Configuration Verification Script
# Validates that deployment configuration is consistent across all sources
# to prevent silent failures and configuration drift.
#
# Checks:
# - vercel.json buildCommand matches expected
# - package.json build scripts exist and match expected
# - Required environment variables are documented
# - No configuration drift between files

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0

error() {
  echo -e "${RED}❌ ERROR: $1${NC}"
  ERRORS=$((ERRORS + 1))
}

warn() {
  echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
  WARNINGS=$((WARNINGS + 1))
}

success() {
  echo -e "${GREEN}✅ $1${NC}"
}

info() {
  echo "ℹ️  $1"
}

# Change to project root
cd "$PROJECT_ROOT"

echo ""
echo "🔍 Deployment Configuration Verification"
echo "=========================================="
echo ""

# Check 1: Verify vercel.json exists
info "Checking vercel.json..."
if [ ! -f "vercel.json" ]; then
  error "vercel.json not found"
else
  # Check buildCommand
  BUILD_CMD=$(jq -r '.buildCommand // empty' vercel.json)
  EXPECTED_BUILD_CMD="npx convex deploy --cmd 'pnpm build:app'"

  if [ "$BUILD_CMD" = "$EXPECTED_BUILD_CMD" ]; then
    success "vercel.json buildCommand is correct"
  else
    error "vercel.json buildCommand mismatch"
    echo "   Expected: $EXPECTED_BUILD_CMD"
    echo "   Got:      $BUILD_CMD"
  fi

  # Check framework
  FRAMEWORK=$(jq -r '.framework // empty' vercel.json)
  if [ "$FRAMEWORK" = "nextjs" ]; then
    success "vercel.json framework is correct (nextjs)"
  else
    warn "vercel.json framework is '$FRAMEWORK' (expected 'nextjs')"
  fi
fi

# Check 2: Verify package.json build scripts
info "Checking package.json scripts..."
if [ ! -f "package.json" ]; then
  error "package.json not found"
else
  # Check build:app script
  BUILD_APP_SCRIPT=$(jq -r '.scripts["build:app"] // empty' package.json)
  if [ "$BUILD_APP_SCRIPT" = "next build" ]; then
    success "package.json build:app script is correct"
  else
    error "package.json build:app script mismatch"
    echo "   Expected: next build"
    echo "   Got:      $BUILD_APP_SCRIPT"
  fi

  # Check build script
  BUILD_SCRIPT=$(jq -r '.scripts.build // empty' package.json)
  if [ "$BUILD_SCRIPT" = "pnpm build:app" ]; then
    success "package.json build script is correct"
  else
    warn "package.json build script mismatch"
    echo "   Expected: pnpm build:app"
    echo "   Got:      $BUILD_SCRIPT"
  fi

  # Check build:local script (should exist)
  BUILD_LOCAL_SCRIPT=$(jq -r '.scripts["build:local"] // empty' package.json)
  if [ -n "$BUILD_LOCAL_SCRIPT" ]; then
    success "package.json build:local script exists"
  else
    warn "package.json build:local script missing (optional but recommended)"
  fi
fi

# Check 3: Verify .env.example documents required variables
info "Checking .env.example..."
if [ ! -f ".env.example" ]; then
  warn ".env.example not found"
else
  REQUIRED_VARS=(
    "CONVEX_DEPLOY_KEY"
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
    "CLERK_SECRET_KEY"
  )

  for VAR in "${REQUIRED_VARS[@]}"; do
    if grep -q "^$VAR=" .env.example || grep -q "^# $VAR=" .env.example; then
      success ".env.example documents $VAR"
    else
      warn ".env.example missing documentation for $VAR"
    fi
  done
fi

# Check 4: Verify deployment documentation exists
info "Checking deployment documentation..."
DEPLOYMENT_DOCS=(
  "docs/deployment/VERCEL_SETUP.md"
  "docs/deployment/PREVIEW_DEPLOYMENTS_GUIDE.md"
)

for DOC in "${DEPLOYMENT_DOCS[@]}"; do
  if [ -f "$DOC" ]; then
    success "Documentation exists: $DOC"
  else
    warn "Missing deployment documentation: $DOC"
  fi
done

# Check 5: Verify vercel-build.sh script exists and is executable
info "Checking vercel-build.sh script..."
if [ ! -f "scripts/vercel-build.sh" ]; then
  warn "scripts/vercel-build.sh not found (optional)"
elif [ ! -x "scripts/vercel-build.sh" ]; then
  error "scripts/vercel-build.sh exists but is not executable"
  echo "   Run: chmod +x scripts/vercel-build.sh"
else
  success "scripts/vercel-build.sh exists and is executable"
fi

# Summary
echo ""
echo "=========================================="
echo "Summary:"
echo "  Errors:   $ERRORS"
echo "  Warnings: $WARNINGS"
echo ""

if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}❌ Deployment configuration has errors that must be fixed${NC}"
  echo ""
  echo "These errors will cause deployment failures in production."
  echo "Please fix them before proceeding."
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Deployment configuration has warnings${NC}"
  echo ""
  echo "Warnings indicate potential issues or missing optional configuration."
  echo "Consider addressing them to improve deployment reliability."
  exit 0
else
  echo -e "${GREEN}✅ All deployment configuration checks passed${NC}"
  exit 0
fi
