# Logistics Control Tower v2.6

Vessel operations dashboard featuring marine telemetry, AI briefings, and automated twice-daily reporting for the MW4 → AGI corridor.

## Requirements

- Node.js 18+
- pnpm 9+
- Slack incoming webhook URL
- Resend account for transactional email delivery

## Getting Started

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000/public/logistics-app.html` to explore the control tower UI.

## Environment Variables

Copy `.env.example` to `.env.local` and populate the credentials:

| Variable | Description |
| --- | --- |
| `SLACK_WEBHOOK_URL` | Incoming webhook that will receive the twice-daily briefing summary. |
| `RESEND_API_KEY` | Resend API key used for email dispatch. |
| `REPORT_SENDER` | From address used for the Resend email (e.g. `no-reply@example.com`). |
| `REPORT_RECIPIENTS` | Comma separated list of briefing recipients. |
| `REPORT_TIMEZONE` | Timezone string for report generation (default `Asia/Dubai`). |
| `REPORT_ENDPOINT` | Optional override for the `/api/report` endpoint when running the scheduler. |
| `REPORT_LOCK_PATH` | Optional path to the lock file used by the self-hosted cron runner. |

## Manual report trigger

Generate and deliver a briefing immediately:

```bash
curl "http://localhost:3000/api/report?slot=am"
```

The response includes Slack/email delivery results, the chosen slot, and a text sample.

## Automated delivery

### Vercel (serverless)

Add a `vercel.json` with UTC-aligned cron entries:

```json
{
  "crons": [
    { "path": "/api/report?slot=am", "schedule": "0 2 * * *" },
    { "path": "/api/report?slot=pm", "schedule": "0 13 * * *" }
  ]
}
```

`02:00` and `13:00` UTC correspond to 06:00 and 17:00 in Asia/Dubai.

### Self-hosted (node-cron)

Run the scheduler to register local cron jobs:

```bash
pnpm tsx scripts/scheduler.ts
```

The runner:

- Fires at 06:00 and 17:00 Asia/Dubai.
- Calls `REPORT_ENDPOINT` with the appropriate `slot` query.
- Persists a lightweight lock file (default `.report.lock`) to avoid duplicate executions.
- Logs JSON responses and warnings to stdout.

## Testing & quality gates

```bash
pnpm test        # Vitest with coverage (≥ 70% lines required)
pnpm lint        # Next.js lint rules
```

Vitest suites cover the notifier utilities and `/api/report` route, including partial failures and marine API fallbacks.

## Dashboard UX highlights

- Slack/email status badge with tooltips summarising the last automated report.
- Weather-linked schedule adjustments, IOI visualisation, and marine telemetry caching.
- AI-driven daily briefing modal, risk scan helper, and assistant with attachment parsing.
- Keyboard-friendly layout with skip links, accessible modals, and responsive panels.

## Operations notes

- `/api/report?preview=1` returns the last known dispatch metadata without sending new messages.
- Marine API timeouts fall back to “snapshot n/a” so reporting never blocks on upstream availability.
- Partial delivery (e.g. Slack success, email failure) surfaces as “Report: Partial” in the UI and JSON payload.

For additional diagrams or SOP integration, extend the repository’s `/docs` folder.
