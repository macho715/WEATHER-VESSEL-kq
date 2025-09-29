# Implementation Plan

## Objectives
- Provide automated briefing distribution via Slack and email, using marine and vessel data snapshots.
- Add a daily reporting API and background scheduler for both Vercel (cron) and self-hosted deployments.
- Surface report delivery status within the logistics dashboard and document the required environment configuration.

## Steps
1. **Messaging utilities**
   - Create `lib/server/notifier.ts` with Slack webhook and Resend email helpers, including error normalization.
   - Add unit tests with mocked fetch to validate success/error paths and coverage.

2. **Reporting API**
   - Implement `/api/report` GET handler to compose vessel, marine, and briefing data, append marine summary, and dispatch via notifier.
   - Handle optional `slot` query, partial failures, and return structured JSON with timestamps.
   - Extend `/api/health` if necessary to expose last report metadata for the dashboard badge.

3. **Scheduling & state**
   - Add `scripts/scheduler.ts` for node-cron self-host execution with timezone-aware scheduling and lock protection.
   - Provide Vercel cron definitions in `vercel.json` and persist last-report metadata (in-memory fallback) for badge display.

4. **Frontend integration**
   - Update `public/logistics-app.html` script to read new health/report status fields, trigger manual report refresh, and render tooltips.

5. **Documentation & config**
   - Create `.env.example` with notifier variables, update README with deployment and scheduling guidance, and append CHANGELOG entry.
   - Add instructions for running tests (`pnpm test`, coverage) and scheduler usage.

6. **Verification**
   - Run linting/typing/test commands available in the project (eslint, prettier, tsc, vitest) and capture results for the final report.
