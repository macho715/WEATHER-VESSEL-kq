# Logistics Control Tower v2.6

Next.js powered control tower for JOPETWIL 71 with real-time marine telemetry, automated reporting, and AI-assisted briefings.

## Highlights

- **Automated Briefings**: `/api/report` composes vessel, weather, and AI insights and dispatches to Slack and email twice daily.
- **Health Awareness**: `/api/health` now exposes the most recent report outcome for the dashboard badge and monitoring.
- **Manual Control**: Operators can trigger the daily report directly from the control center panel without leaving the dashboard.
- **Self-Host Friendly**: `scripts/scheduler.ts` mirrors the Vercel cron schedule with node-cron, lock protection, and rich logging.
- **Typed Utilities**: Shared notifier helpers encapsulate Slack and Resend delivery, with graceful degradation and timeout handling.

## Getting Started

```bash
pnpm install
cp .env.example .env.local # fill in Slack/Resend credentials
pnpm dev
```

Navigate to [`http://localhost:3000/logistics-app.html`](http://localhost:3000/logistics-app.html) to view the dashboard.

## Environment Variables

| Variable | Description |
| --- | --- |
| `SLACK_WEBHOOK_URL` | Incoming webhook for the Slack channel receiving briefings |
| `RESEND_API_KEY` | API key for [Resend](https://resend.com/) transactional email |
| `REPORT_SENDER` | From address for dispatched emails |
| `REPORT_RECIPIENTS` | Comma-separated recipient list |
| `REPORT_TIMEZONE` | Timezone for reporting windows (default `Asia/Dubai`) |
| `REPORT_ENDPOINT` | Base URL used by the self-host scheduler (default `http://localhost:3000/api/report`) |
| `REPORT_LOCK_FILE` | Optional lock file override for the scheduler |

## Daily Reporting

### API

`GET /api/report?slot=am|pm`

- Aggregates `/api/vessel`, `/api/marine`, and `/api/briefing`
- Appends a marine snapshot line to the AI briefing
- Dispatches Slack + Resend email, tolerating partial failures
- Responds with JSON `{ ok, sent, slot, generatedAt, sample }`

### Scheduling

- **Vercel**: `vercel.json` registers UTC `0 2 * * *` and `0 13 * * *` crons (06:00/17:00 Asia/Dubai)
- **Self-host**: run `REPORT_TIMEZONE=Asia/Dubai node scripts/scheduler.ts`
  - Uses `node-cron` with lock file protection (`.weather-vessel-report.lock`)
  - Logs status, HTTP errors, and partial delivery states

## Dashboard Updates

- Header badge now shows `API: Online · Report OK` (or pending) with tooltip `Last report: …`
- Manual “📤 Send Daily Report” button issues `GET /api/report` and logs the outcome in the event feed.

## Testing & Quality

```bash
pnpm lint        # Next.js ESLint rules
pnpm typecheck   # TypeScript strict mode
pnpm test        # Vitest with coverage ≥ 70%
```

Vitest suites mock outbound fetch calls for notifier and reporting logic.

## Deployment Checklist

1. Configure environment variables on Vercel (or `.env.local`).
2. Ensure Resend domain is verified for the chosen sender address.
3. Verify Slack webhook permissions for the target channel.
4. Deploy (`pnpm build`) and monitor `/api/health` for report status.
5. For self-hosted environments, keep `scripts/scheduler.ts` running via PM2/systemd.

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md) for release history.
