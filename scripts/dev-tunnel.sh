#!/bin/bash
# Start cloudflared tunnel for local webhook development
#
# Usage: ./scripts/dev-tunnel.sh
#
# Prerequisites:
#   brew install cloudflared
#
# After running, copy the tunnel URL and configure your GitHub App:
#   Webhook URL: https://<tunnel-subdomain>.trycloudflare.com/api/webhooks/github
#   Secret: Use value from GITHUB_WEBHOOK_SECRET in .env.local

set -e

PORT="${PORT:-3000}"

echo "Starting cloudflared tunnel for localhost:$PORT..."
echo ""
echo "Once the tunnel starts, configure your GitHub App webhook:"
echo "  URL: https://<subdomain>.trycloudflare.com/api/webhooks/github"
echo "  Secret: (see GITHUB_WEBHOOK_SECRET in .env.local)"
echo ""

cloudflared tunnel --url "http://localhost:$PORT"
