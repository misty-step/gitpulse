# Sentry Alerts Runbook

This runbook provides investigation steps and escalation procedures for Sentry alerts configured in the GitPulse project.

## Alert Configuration

**Organization:** misty-step
**Project:** gitpulse
**Dashboard:** https://sentry.io/organizations/misty-step/projects/gitpulse/

## Alert Types

### 1. High Error Rate

**Alert Name:** High Error Rate
**Alert ID:** 16468766
**Condition:** More than 10 errors (level ≥ ERROR) in 5 minutes
**Action:** Email notification to issue owners

#### Investigation Steps

1. **Check the Sentry Dashboard**
   - Navigate to: https://sentry.io/organizations/misty-step/issues/
   - Filter by: Last 5 minutes, Level: ERROR or FATAL
   - Identify the most frequent error types

2. **Analyze Error Patterns**
   - Look for common stack traces
   - Check if errors are user-specific or affecting all users
   - Identify affected routes/endpoints
   - Review error context (user actions, browser, device)

3. **Check Recent Deployments**
   - Review recent commits: `git log --oneline -10`
   - Check Sentry releases: https://sentry.io/organizations/misty-step/projects/gitpulse/releases/
   - Correlate error spike with deployment timing

4. **Immediate Actions**
   - If deployment-related: Consider rollback
   - If user-reported: Check user feedback and support tickets
   - If isolated: Mark error and monitor for escalation
   - If widespread: Escalate to on-call engineer

5. **Root Cause Analysis**
   - Review breadcrumbs leading to error
   - Check performance traces for related slowdowns
   - Examine database query logs
   - Review external API health (GitHub, Convex, etc.)

#### Resolution

- Fix identified issues and deploy
- Monitor error rate for 15 minutes post-deployment
- Update issue in Sentry with resolution notes
- Document pattern in this runbook if recurring

---

### 2. New Error Type Detected

**Alert Name:** New Error Type Detected
**Alert ID:** 16468784
**Condition:** First occurrence of an error type (level ≥ ERROR)
**Action:** Email notification to issue owners

#### Investigation Steps

1. **Assess Severity**
   - Review error message and stack trace
   - Determine if error is blocking user workflows
   - Check error frequency (single occurrence vs. rapid repeat)

2. **Identify Trigger**
   - Review breadcrumbs for user actions leading to error
   - Check if error is feature-specific or global
   - Determine if error is environment-specific (dev vs. prod)

3. **Categorize Error**
   - **Critical**: Blocking core workflows (authentication, report generation, data ingestion)
   - **High**: Degraded functionality but workarounds exist
   - **Medium**: Edge case or non-critical feature
   - **Low**: Cosmetic or logging noise

4. **Immediate Actions**
   - **Critical/High**: Create incident ticket, notify team
   - **Medium**: Create backlog issue, schedule fix
   - **Low**: Document and monitor

5. **Long-term Actions**
   - Add test coverage to prevent regression
   - Update error handling if missing
   - Consider feature flag if unstable

#### Resolution

- Fix error or add graceful error handling
- Add monitoring if pattern might recur
- Update Sentry issue with fix details

---

### 3. Error Regression Detected

**Alert Name:** Error Regression Detected
**Alert ID:** 16468794
**Condition:** Previously resolved error reappears
**Action:** Email notification to issue owners

#### Investigation Steps

1. **Review Resolution History**
   - Check Sentry issue history
   - Review original fix commit and PR
   - Identify what changed since resolution

2. **Compare Context**
   - Check if regression occurs under same conditions as original
   - Identify differences (browser, user type, data state)
   - Review deployment/release notes since resolution

3. **Analyze Recent Changes**
   - `git log --since="YYYY-MM-DD" --grep="related-keyword"`
   - Check for reverted commits
   - Review dependency updates (check Dependabot PRs)

4. **Immediate Actions**
   - Assess if original fix was incomplete
   - Check if new code path triggers same error
   - Determine if rollback is needed

5. **Prevention**
   - Add regression test for this error
   - Review test coverage for affected code path
   - Consider adding integration test

#### Resolution

- Re-apply fix or implement more robust solution
- Ensure regression tests are in place
- Update documentation on proper fix approach

---

## Performance Monitoring

GitPulse has performance monitoring enabled with 10% transaction sampling. While alert rules for performance metrics are not yet configured, you can manually investigate performance issues:

### Check Performance Traces

1. Navigate to: https://sentry.io/organizations/misty-step/projects/gitpulse/performance/
2. Filter by:
   - P95 latency > 3000ms
   - Transaction duration > 5000ms
   - Slow database queries

### Key Transactions to Monitor

- **Report Generation**: `/api/reports/generate`
- **GitHub Webhook Processing**: `/api/webhooks/github`
- **Dashboard Loading**: `/dashboard`
- **Repository Ingestion**: Convex backfill actions

### Performance Investigation

1. Review transaction trace waterfall
2. Identify slow spans (DB queries, API calls, LLM generation)
3. Check for N+1 query patterns
4. Verify caching is working (cache hit rate)
5. Review LLM token usage and generation time

---

## Escalation Procedures

### Priority Levels

- **P0 (Critical)**: Complete service outage, data loss, security breach
  - **Action**: Page on-call immediately, create incident channel
  - **Response Time**: 15 minutes

- **P1 (High)**: Core functionality broken, affecting multiple users
  - **Action**: Notify team, create incident ticket
  - **Response Time**: 1 hour

- **P2 (Medium)**: Degraded functionality, workarounds available
  - **Action**: Create backlog issue, schedule for next sprint
  - **Response Time**: 1 business day

- **P3 (Low)**: Minor issues, cosmetic problems
  - **Action**: Document in backlog
  - **Response Time**: Best effort

### Contact Information

- **On-call Engineer**: Check PagerDuty rotation
- **Team Slack**: #gitpulse-alerts (to be configured)
- **Sentry Dashboard**: https://sentry.io/organizations/misty-step/projects/gitpulse/

---

## Common Issues and Solutions

### High Error Rate After Deployment

**Symptoms:** Sudden spike in errors after deployment
**Cause:** New bug introduced in recent code
**Solution:**

1. Review recent commits
2. Check Sentry breadcrumbs for error context
3. Rollback deployment if errors are critical
4. Fix issue and redeploy

### Recurring "Failed to fetch" Errors

**Symptoms:** Network errors from client-side
**Cause:** Convex backend timeout or rate limiting
**Solution:**

1. Check Convex dashboard for backend health
2. Review recent Convex function changes
3. Check rate limit quotas
4. Add retry logic if transient

### Authentication Errors

**Symptoms:** Clerk authentication failures
**Cause:** JWT token expiration or misconfiguration
**Solution:**

1. Check Clerk dashboard for service status
2. Verify JWT template configuration
3. Review token refresh logic
4. Check browser console for token errors

---

## Maintenance

### Weekly Tasks

- Review Sentry issue backlog
- Resolve or archive stale issues
- Check error trends and patterns

### Monthly Tasks

- Review alert thresholds and tune if needed
- Analyze performance trends
- Update runbook with new patterns
- Review and archive resolved issues

### Quarterly Tasks

- Audit alert rules effectiveness
- Review escalation procedures
- Update contact information
- Performance budget review

---

## Configuration Reference

### Environment Variables

```bash
SENTRY_DSN=https://724cc7295e04d879cd1aa8376faaf7b6@o4510313803677696.ingest.us.sentry.io/4510403670638592
NEXT_PUBLIC_SENTRY_DSN=https://724cc7295e04d879cd1aa8376faaf7b6@o4510313803677696.ingest.us.sentry.io/4510403670638592
SENTRY_ORG=misty-step
SENTRY_PROJECT=gitpulse
```

### GitHub Secrets Required

- `SENTRY_AUTH_TOKEN`: Required for deployment tracking (add to repository secrets)

### Alert Rules

Created via Sentry API on 2025-11-21:

| Alert Name                | ID       | Condition                | Action |
| ------------------------- | -------- | ------------------------ | ------ |
| High Error Rate           | 16468766 | >10 errors in 5min       | Email  |
| New Error Type Detected   | 16468784 | First seen error         | Email  |
| Error Regression Detected | 16468794 | Resolved error reappears | Email  |

---

## Related Documentation

- [Sentry Next.js SDK](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Performance Monitoring](https://docs.sentry.io/product/performance/)
- [GitPulse Architecture](../../DESIGN.md)
- [Deployment Guide](../../README.md)

---

_Last Updated: 2025-11-21_
_Maintainer: GitPulse Team_
