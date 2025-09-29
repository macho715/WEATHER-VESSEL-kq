# Changelog

## 2025-03-17

### Added
- Automated daily reporting pipeline with Slack and Resend delivery helpers.
- `/api/report` endpoint combining vessel, marine, and briefing data with marine snapshot summary.
- node-cron scheduler script for self-hosted deployments and Vercel cron definitions.
- Dashboard badge tooltip plus manual “Send Daily Report” control with event feed logging.

### Changed
- `/api/health` now surfaces last report metadata for UI consumption.
- Updated documentation and environment template for new integrations.

### Fixed
- Health badge no longer leaves stale text when API errors occur; report failures are highlighted as warnings.
