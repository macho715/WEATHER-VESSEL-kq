# Changelog

## [0.2.0] - 2025-09-28
### Added
- Automated `/api/report` endpoint combining vessel, marine, and briefing data with Slack/Resend delivery.
- `lib/server/notifier` helpers for Slack webhook and Resend email dispatch with graceful fallbacks.
- `scripts/scheduler.ts` cron runner for self-hosted twice-daily briefings with duplicate run guards.
- UI badge highlighting report health and last dispatch timestamp.
- Vitest configuration and unit tests covering notifier utilities and reporting pipeline.
- Environment template, README operations guide, and Vercel cron example for serverless scheduling.

### Changed
- Dashboard logic now polls report status and surfaces partial failures as “Report: Partial”.

### Fixed
- Marine snapshot formatting now defaults to `n/a` when upstream data is unavailable, preventing empty report lines.
