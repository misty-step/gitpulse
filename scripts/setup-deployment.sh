#!/usr/bin/env bash

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CLERK_JWT_ISSUER_DOMAIN="finer-llama-61.clerk.accounts.dev"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Print functions
print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Pause for user to read
pause() {
    read -p "Press Enter to continue..."
}

# Main setup function
main() {
    clear
    print_header "GitPulse Deployment Setup (CLI-Automated)"
    echo ""
    echo "This script will configure Vercel-managed deployments for GitPulse."
    echo "It automates environment variable setup using CLI tools."
    echo ""
    echo "Time required: 10-15 minutes"
    echo ""
    pause

    # Step 1: Check prerequisites
    check_prerequisites

    # Step 2: Convex setup
    setup_convex

    # Step 3: Manual steps for Convex dashboard
    convex_manual_steps

    # Step 4: Vercel setup
    setup_vercel

    # Step 5: Verification
    verify_setup

    # Step 6: Summary
    print_summary
}

check_prerequisites() {
    print_header "Step 1: Checking Prerequisites"
    echo ""

    local all_good=true

    # Check Node.js
    if command_exists node; then
        local node_version=$(node --version)
        print_success "Node.js installed: $node_version"
    else
        print_error "Node.js not found. Please install Node.js >= 22.15.0"
        all_good=false
    fi

    # Check pnpm
    if command_exists pnpm; then
        local pnpm_version=$(pnpm --version)
        print_success "pnpm installed: $pnpm_version"
    else
        print_error "pnpm not found. Install: npm install -g pnpm"
        all_good=false
    fi

    # Check Convex CLI
    if command_exists npx; then
        print_success "npx available (will use: npx convex)"
    else
        print_error "npx not found"
        all_good=false
    fi

    # Check Vercel CLI
    if command_exists vercel; then
        local vercel_version=$(vercel --version)
        print_success "Vercel CLI installed: $vercel_version"
    else
        print_warning "Vercel CLI not found. Installing globally..."
        npm install -g vercel
        if command_exists vercel; then
            print_success "Vercel CLI installed successfully"
        else
            print_error "Failed to install Vercel CLI"
            all_good=false
        fi
    fi

    # Check if in project directory
    if [ -f "$PROJECT_DIR/package.json" ]; then
        print_success "In correct project directory"
    else
        print_error "Not in project root. Please run from: /Users/phaedrus/Development/gitpulse"
        all_good=false
    fi

    echo ""
    if [ "$all_good" = false ]; then
        print_error "Prerequisites not met. Please fix the above issues and run again."
        exit 1
    fi

    print_success "All prerequisites met!"
    echo ""
    pause
}

setup_convex() {
    print_header "Step 2: Configuring Convex Environment Variables"
    echo ""

    print_info "We'll set CLERK_JWT_ISSUER_DOMAIN for your Convex environments."
    print_warning "Note: 'Default environment variables' can only be set via Convex Dashboard."
    print_info "We'll set it explicitly for development and production instead."
    echo ""

    # Set for development environment
    print_info "Setting for development environment..."
    if npx convex env set CLERK_JWT_ISSUER_DOMAIN "$CLERK_JWT_ISSUER_DOMAIN" 2>&1 | grep -q "Set environment variable"; then
        print_success "Development: CLERK_JWT_ISSUER_DOMAIN = $CLERK_JWT_ISSUER_DOMAIN"
    else
        print_warning "May have failed (check manually with: npx convex env list)"
    fi

    echo ""

    # Set for production environment
    print_info "Setting for production environment..."
    if npx convex env set CLERK_JWT_ISSUER_DOMAIN "$CLERK_JWT_ISSUER_DOMAIN" --prod 2>&1 | grep -q "Set environment variable"; then
        print_success "Production: CLERK_JWT_ISSUER_DOMAIN = $CLERK_JWT_ISSUER_DOMAIN"
    else
        print_warning "May have failed (check manually with: npx convex env list --prod)"
    fi

    echo ""
    print_info "Verifying environment variables..."
    echo ""
    echo "Development:"
    npx convex env list | grep CLERK_JWT_ISSUER_DOMAIN || print_warning "Variable not found in development"
    echo ""
    echo "Production:"
    npx convex env list --prod | grep CLERK_JWT_ISSUER_DOMAIN || print_warning "Variable not found in production"
    echo ""
    pause
}

convex_manual_steps() {
    print_header "Step 3: Manual Steps Required (Convex Dashboard)"
    echo ""

    print_warning "The following steps CANNOT be automated via CLI and must be done manually:"
    echo ""

    echo "1. Generate Deploy Keys:"
    echo "   • Open: https://dashboard.convex.dev/"
    echo "   • Select: gitpulse project"
    echo "   • Go to: Settings → Deploy Keys"
    echo "   • Click: 'Generate Production Deploy Key'"
    echo "   • Copy the key (starts with 'prod:...')"
    echo "   • Click: 'Generate Preview Deploy Key'"
    echo "   • Copy the key (starts with 'preview:...')"
    echo ""

    echo "2. Set Default Environment Variables (for Preview deployments):"
    echo "   • Still in Convex Dashboard"
    echo "   • Go to: Settings → Environment Variables"
    echo "   • Look for: 'Default Environment Variables' or 'Set Default Variables'"
    echo "   • Add for Preview + Development:"
    echo "     CLERK_JWT_ISSUER_DOMAIN = $CLERK_JWT_ISSUER_DOMAIN"
    echo "   • Save"
    echo ""

    print_info "This ensures ALL future preview deployments get the variable automatically."
    echo ""

    read -p "Have you generated both deploy keys? (y/n): " has_keys
    if [ "$has_keys" != "y" ]; then
        print_error "Please generate deploy keys before continuing."
        print_info "Exiting. Run this script again when ready."
        exit 1
    fi

    echo ""
    read -p "Production Deploy Key (starts with 'prod:...'): " PROD_DEPLOY_KEY
    read -p "Preview Deploy Key (starts with 'preview:...'): " PREVIEW_DEPLOY_KEY

    if [ -z "$PROD_DEPLOY_KEY" ] || [ -z "$PREVIEW_DEPLOY_KEY" ]; then
        print_error "Deploy keys cannot be empty."
        exit 1
    fi

    if [[ ! "$PROD_DEPLOY_KEY" =~ ^prod: ]]; then
        print_warning "Production key doesn't start with 'prod:' - this may be incorrect."
    fi

    if [[ ! "$PREVIEW_DEPLOY_KEY" =~ ^preview: ]]; then
        print_warning "Preview key doesn't start with 'preview:' - this may be incorrect."
    fi

    export PROD_DEPLOY_KEY
    export PREVIEW_DEPLOY_KEY

    print_success "Deploy keys captured!"
    echo ""
    pause
}

setup_vercel() {
    print_header "Step 4: Configuring Vercel"
    echo ""

    # Check if logged in
    print_info "Checking Vercel authentication..."
    if vercel whoami >/dev/null 2>&1; then
        local vercel_user=$(vercel whoami)
        print_success "Logged in as: $vercel_user"
    else
        print_warning "Not logged in to Vercel. Logging in..."
        vercel login
        if vercel whoami >/dev/null 2>&1; then
            print_success "Successfully logged in!"
        else
            print_error "Failed to log in to Vercel"
            exit 1
        fi
    fi

    echo ""

    # Check if project is linked
    print_info "Checking if project is linked to Vercel..."
    if [ -f "$PROJECT_DIR/.vercel/project.json" ]; then
        print_success "Project already linked to Vercel"
        local project_id=$(jq -r '.projectId' "$PROJECT_DIR/.vercel/project.json")
        print_info "Project ID: $project_id"
    else
        print_warning "Project not linked. Linking now..."
        vercel link
        if [ -f "$PROJECT_DIR/.vercel/project.json" ]; then
            print_success "Project linked successfully!"
        else
            print_error "Failed to link project"
            exit 1
        fi
    fi

    echo ""

    # Add environment variables
    print_info "Adding CONVEX_DEPLOY_KEY to Vercel environments..."
    echo ""

    # Production
    print_info "Adding production deploy key..."
    echo "$PROD_DEPLOY_KEY" | vercel env add CONVEX_DEPLOY_KEY production 2>&1 | tee /tmp/vercel_prod_output.log
    if grep -q "Created" /tmp/vercel_prod_output.log || grep -q "Added" /tmp/vercel_prod_output.log; then
        print_success "Production: CONVEX_DEPLOY_KEY added"
    else
        print_warning "May have failed or already exists. Check: vercel env ls"
    fi

    echo ""

    # Preview
    print_info "Adding preview deploy key..."
    echo "$PREVIEW_DEPLOY_KEY" | vercel env add CONVEX_DEPLOY_KEY preview 2>&1 | tee /tmp/vercel_preview_output.log
    if grep -q "Created" /tmp/vercel_preview_output.log || grep -q "Added" /tmp/vercel_preview_output.log; then
        print_success "Preview: CONVEX_DEPLOY_KEY added"
    else
        print_warning "May have failed or already exists. Check: vercel env ls"
    fi

    echo ""
    print_info "Listing all Vercel environment variables..."
    vercel env ls
    echo ""
    pause
}

verify_setup() {
    print_header "Step 5: Verifying Configuration"
    echo ""

    local all_verified=true

    # Verify Convex variables
    print_info "Checking Convex environment variables..."
    if npx convex env list | grep -q CLERK_JWT_ISSUER_DOMAIN; then
        print_success "Convex dev has CLERK_JWT_ISSUER_DOMAIN"
    else
        print_error "Convex dev missing CLERK_JWT_ISSUER_DOMAIN"
        all_verified=false
    fi

    if npx convex env list --prod | grep -q CLERK_JWT_ISSUER_DOMAIN; then
        print_success "Convex prod has CLERK_JWT_ISSUER_DOMAIN"
    else
        print_error "Convex prod missing CLERK_JWT_ISSUER_DOMAIN"
        all_verified=false
    fi

    echo ""

    # Verify Vercel variables
    print_info "Checking Vercel environment variables..."
    if vercel env ls | grep -q "CONVEX_DEPLOY_KEY.*Production"; then
        print_success "Vercel has production CONVEX_DEPLOY_KEY"
    else
        print_warning "Vercel may be missing production CONVEX_DEPLOY_KEY"
        all_verified=false
    fi

    if vercel env ls | grep -q "CONVEX_DEPLOY_KEY.*Preview"; then
        print_success "Vercel has preview CONVEX_DEPLOY_KEY"
    else
        print_warning "Vercel may be missing preview CONVEX_DEPLOY_KEY"
        all_verified=false
    fi

    echo ""

    if [ "$all_verified" = true ]; then
        print_success "All verifications passed!"
    else
        print_warning "Some checks failed. Please verify manually."
    fi

    echo ""
    pause
}

print_summary() {
    print_header "Setup Complete!"
    echo ""

    print_success "What was configured:"
    echo "  ✓ Convex development environment variables"
    echo "  ✓ Convex production environment variables"
    echo "  ✓ Vercel production deploy key"
    echo "  ✓ Vercel preview deploy key"
    echo ""

    print_warning "Manual steps still required:"
    echo "  1. Set Convex default environment variables (dashboard only)"
    echo "     → Go to: https://dashboard.convex.dev/"
    echo "     → Settings → Environment Variables → Default Variables"
    echo "     → Add: CLERK_JWT_ISSUER_DOMAIN = $CLERK_JWT_ISSUER_DOMAIN"
    echo "     → For: Preview + Development environments"
    echo ""
    echo "  2. Remove GitHub secret (no longer needed):"
    echo "     → gh secret remove CONVEX_DEPLOY_KEY"
    echo ""

    print_info "Next steps:"
    echo "  1. Test with a new PR to verify preview deployments"
    echo "  2. Follow: docs/deployment/MIGRATION_CHECKLIST.md"
    echo "  3. Monitor first few deployments for issues"
    echo ""

    print_info "Useful commands:"
    echo "  • Check Convex vars: npx convex env list"
    echo "  • Check Vercel vars: vercel env ls"
    echo "  • Deploy preview: vercel"
    echo "  • Deploy production: vercel --prod"
    echo ""

    print_success "🚀 Deployment setup complete!"
    echo ""
}

# Run main function
main "$@"
