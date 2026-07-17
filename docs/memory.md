# Memory: bookline

Running log of what is done, what is in flight, and decisions worth remembering. Update after
every meaningful chunk of work; log every non-obvious decision with its reason.

## Completed

- 2026-07-18 — Planning documentation created (README, PRD, architecture, rules, phases, design,
  testing, api-contracts, launch-checklist, .env.example). Awaiting owner review; no code yet.
- 2026-07-18 — Phase 1 complete. Next.js 15 App Router + TS + Tailwind scaffold; ESLint/Prettier;
  Vitest (unit/integration projects) and Playwright config; docker-compose (Postgres 16 + Mailpit);
  validated server-only env (`lib/env.ts`); structured logger + single-format error helper; Prisma
  schema + initial migration carrying `btree_gist` and the `booking_no_overlap` exclusion constraint
  plus a status CHECK; idempotent seed (host + example event type + weekday rules). Slot engine
  (`lib/slots/`) with all four named DST tests passing; RFC 5545 writer (`lib/ics/writer.ts`) with
  folding/escaping/CRLF and its tests; exclusion-constraint conflict detector
  (`lib/bookings/conflict.ts`) and a DB integration test proving 23P01 blocks overlaps, allows
  touching ranges, and frees cancelled slots. Verified: build, lint, typecheck, 21 unit + 4
  integration tests all pass.

## In progress

- Phase 2 — public booking flow, emails, manage links, iCal feed.

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
- 2026-07-18 — Local dev Postgres is published on host port 5433 (not 5432) because an unrelated
  container already owns 5432 on this machine. The committed `docker-compose.yml` and
  `.env.example` keep the standard 5432; the gitignored local `.env` uses 5433. The Docker Compose
  plugin is absent here, so the containers are launched with `docker run` mirroring the compose
  file. Neither is a project change — both are environment workarounds.
- 2026-07-18 — Slot-conflict detection lives in `lib/bookings/conflict.ts` and matches both the
  typed-client error (message carries `23P01`/`booking_no_overlap`) and any raw path (P2010 with
  `meta.code = 23P01`). Reason: `prisma.booking.create` surfaces the exclusion violation only as an
  unknown-request error message, so a message check is required alongside the structured code.
