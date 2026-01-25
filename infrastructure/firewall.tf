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
      version = "~> 2.0"
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
    # Rule 1: Rate limit OAuth initiation endpoint
    rule {
      name        = "oauth-init-rate-limit"
      description = "Rate limit OAuth initiation to prevent state exhaustion"
      condition_group = [{
        conditions = [
          {
            type  = "path"
            op    = "pre"  # starts with
            value = "/api/auth/github"
          },
          {
            type  = "path"
            op    = "neq"  # not equals
            value = "/api/auth/github/callback"
          }
        ]
      }]
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

    # Rule 2: Rate limit OAuth callback endpoint
    rule {
      name        = "oauth-callback-rate-limit"
      description = "Rate limit OAuth callback to prevent brute force"
      condition_group = [{
        conditions = [{
          type  = "path"
          op    = "eq"
          value = "/api/auth/github/callback"
        }]
      }]
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
