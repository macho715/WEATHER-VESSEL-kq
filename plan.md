# Implementation Plan

## Objectives
- Automate twice-daily briefing delivery (06:00 & 17:00 Asia/Dubai) over Slack and email.
- Provide a manual `/api/report` trigger that survives partial channel failures and marine API outages.
- Surface last-report status on the dashboard and document the new operations workflow.
- Maintain RED → GREEN → REFACTOR cycles by writing tests first, implementing features, then tidying.

## Steps
1. **RED – Define coverage expectations**
   - Add Vitest suites for `lib/server/notifier.ts` and `/api/report` to lock expected behaviour.
   - Mock external fetch/Resend calls and express success/partial failure cases.

2. **GREEN – Implement runtime features**
   - Build `lib/server/notifier.ts` with Slack webhook + Resend email helpers and error handling.
   - Create `/api/report/route.ts` to aggregate vessel/marine/briefing data, append marine summary, dispatch notifications, and persist last-run metadata.
   - Expose `scripts/scheduler.ts` with node-cron, in-memory/file lock, and timezone-aware scheduling.
   - Add frontend badge wiring, environment docs, cron configuration (vercel.json), and CHANGELOG notes.

3. **REFACTOR – Harden and document**
   - Deduplicate fetch helpers, share constants, and ensure typing/formatting compliance.
   - Update README with operations guide (serverless vs self-host) and ensure `.env.example` variables are complete.
   - Confirm lint/test suite inc. coverage ≥ 70% and polish wording/tooltips.
