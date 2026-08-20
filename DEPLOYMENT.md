# Deployment Guide — Crewbill

## Overview

This document describes the deployment workflow for **crewbillai.com** using Bolt's built-in hosting.

### Important Limitation

**Bolt does not support automatic CI/CD deployment.** Changes made to your Bolt project are NOT automatically applied to the published site. Publishing is a manual action — you click **Update** in Bolt's Publish menu to push changes live.

This guide implements the **closest supported reliable workflow**: a pre-deploy quality gate script, manual publish via Bolt's UI, and a post-deploy health check script.

---

## Pre-Deploy Quality Gate

Before publishing any changes to production, run the quality gate to verify the build is safe:

```bash
npm run pre-deploy
```

This script runs four gates in sequence:

| Gate | Command | What it checks |
|------|---------|---------------|
| Typecheck | `npm run typecheck` | TypeScript compiles with no errors |
| Tests | `npm test` | All unit/integration tests pass |
| Production build | `npm run build` | Vite production build succeeds |
| Lint | `npx eslint src/` | No lint errors in application source |

**If any gate fails, do NOT publish.** Fix the failures first.

The script exits with code `1` on any failure, making it suitable for CI pipelines if you later add one (e.g., GitHub Actions).

---

## Publishing to Production

Once all gates pass:

1. Open the **Publish** menu in Bolt (top-right of the editor).
2. Click **Update** to push your changes live to crewbillai.com.
3. Wait for the deployment to complete (Bolt shows a confirmation).

> **Always use the Publish or Update button** in the Publish menu — these don't consume tokens. Prompting Bolt to publish via chat consumes tokens.

---

## Post-Deploy Health Check

After publishing, verify the site is live:

```bash
npm run health-check
```

This script checks:
- Homepage (`/`) returns HTTP 200
- HTTPS protocol is in use
- Page content contains expected markers

To check a different URL:
```bash
bash scripts/post-deploy-health-check.sh https://crewbillai.com
```

---

## Rollback

Bolt does not have a programmatic rollback API. If a deployment is broken:

1. Click **View history** in Bolt's editor.
2. Find the last known working version (preview if needed).
3. Click **Restore** on that version.
4. Click **Update** in the Publish menu to push the restored version live.

This restores the immediately previous successful version using Bolt's built-in version history.

---

## Safety Rules

The following actions are **never** performed automatically:

- ❌ Destructive database migrations (DROP tables, DELETE columns, rename tables)
- ❌ Real Stripe charges or refunds
- ❌ Secret/key rotation
- ❌ Account deletion
- ❌ Subscription cancellation
- ❌ Sending emails to real users

All secrets remain server-side in Supabase Edge Function environment variables and `.env` (never committed to the repo).

---

## Disabling Deployment

To stop deploying changes to production:

1. Simply **do not click Update** in Bolt's Publish menu. Changes stay in the editor and don't go live.
2. To fully unpublish the site: open the Publish menu and click **Unpublish**.

The pre-deploy gate and health-check scripts are safe to run at any time — they don't modify production or trigger deployments.

---

## File Reference

| File | Purpose |
|------|---------|
| `scripts/pre-deploy-gate.sh` | Quality gate: typecheck + tests + build + lint |
| `scripts/post-deploy-health-check.sh` | Post-deploy URL/HTTPS/content verification |
| `DEPLOYMENT.md` | This document |

---

## Edge Functions (Supabase)

Edge functions are deployed separately via the Supabase MCP tools, not via Bolt's Publish menu. When an edge function changes:

1. Run `npm run pre-deploy` to verify the frontend still works.
2. Deploy the changed function using the Supabase deploy tool.
3. Run `npm run health-check` to verify the site.

Edge function deployments are independent of the frontend publish — they don't require republishing the Bolt site unless the frontend calls them differently.
