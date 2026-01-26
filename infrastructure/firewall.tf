# Vercel Firewall Configuration for GitPulse
# Addresses: https://github.com/misty-step/gitpulse/issues/124
#
# This configuration adds rate limiting to OAuth endpoints to prevent:
# - OAuth state exhaustion attacks
# - GitHub API quota abuse
# - Brute force attacks on auth flow

terraform {
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 4.0"
    }
  }
}

# Reference existing project (don't recreate)
data "vercel_project" "gitpulse" {
  name = "gitpulse"
}

resource "vercel_firewall_config" "oauth_rate_limits" {
  project_id = data.vercel_project.gitpulse.id

  rules {
    rule {
      name        = "oauth-endpoints-rate-limit"
      description = "Rate limit OAuth initiation and callback endpoints"
      condition_group = [
        {
          conditions = [{
            type  = "path"
            op    = "eq"
            value = "/api/auth/github"
          }]
        },
        {
          conditions = [{
            type  = "path"
            op    = "eq"
            value = "/api/auth/github/callback"
          }]
        }
      ]
      action = {
        action = "rate_limit"
        rate_limit = {
          limit  = 60
          window = 60
          keys   = ["ip"]
          algo   = "fixed_window"
          action = "deny"
        }
        action_duration = "1m"
      }
    }
  }
}
