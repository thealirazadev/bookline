# Memory: bookline

Running log of what is done, what is in flight, and decisions worth remembering. Update after
every meaningful chunk of work; log every non-obvious decision with its reason.

## Completed

- 2026-07-18 — Planning documentation created (README, PRD, architecture, rules, phases, design,
  testing, api-contracts, launch-checklist, .env.example). Awaiting owner review; no code yet.

## In progress

- _(nothing — implementation has not started)_

## Decisions log

- 2026-07-18 — Postgres exclusion constraint (`btree_gist`, `tstzrange` on the buffered block
  range, confirmed rows only) is the double-booking authority; the application pre-check exists
  only for friendly errors. Reason: correctness under concurrency must not depend on application
  code.
- 2026-07-18 — Luxon over date-fns-tz and the Temporal polyfill for all timezone math. Reason:
  mature, platform IANA data, documented DST semantics the engine's skip/earlier-offset policy is
  built on. Dependency awaits owner approval.
- 2026-07-18 — .ics generation is hand-rolled (no `ics` package). Reason: METHOD/UID/SEQUENCE
  control is a differentiator and the needed RFC 5545 subset is ~100 testable lines.
- 2026-07-18 — Manage links are stateless HMAC tokens (bookingId-bound, validity derived from
  booking status), not stored tokens. Reason: nothing to persist, rotate, or expire separately.
- 2026-07-18 — Reminders run on an in-process 60s interval via `instrumentation.ts` with an
  atomic claim column. Reason: simplest infrastructure for a single-instance deploy; external
  cron via `reminders:once` is the documented serverless fallback.
