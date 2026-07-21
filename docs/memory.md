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

- 2026-07-18 — Phase 2 complete. Public read endpoints (`/api/availability`, `/api/slots`) and the
  booking flow: `/book` list, `/book/[slug]` picker (month grid, slot list, timezone select, form),
  `POST /api/bookings` re-validating against the engine and inserting inside a transaction where the
  exclusion constraint is authority (23P01 -> 409 SLOT_TAKEN with refreshedSlots; rule failures ->
  422). SMTP mailer + templates + notifications send invitee/host confirmation with a
  METHOD:REQUEST .ics attachment; SMTP failure yields emailStatus "pending" without rolling back.
  Manage: signed HMAC tokens, `/manage/[token]` page, GET details, cancel (METHOD:CANCEL, SEQUENCE
  +1, frees slot) and reschedule (same UID, SEQUENCE +1, updated invite). Token-authed iCal feed at
  `/api/ical/[feedToken]`. Verified: build, lint, typecheck, 28 unit + 10 integration pass,
  including `simultaneous-booking-single-winner`. Manual: booking, double-book (409), cancel,
  reschedule, and feed all exercised via curl + Mailpit; CANCEL/REQUEST .ics inspected for correct
  METHOD/UID/SEQUENCE.

- 2026-07-18 — Phase 3 complete. Auth.js v5 credentials login against the seeded host (bcrypt),
  split config (edge-safe `lib/auth.config.ts` for the middleware, node credentials in `lib/auth.ts`
  delegating to `lib/host-credentials.ts`). `middleware.ts` guards `/dashboard*` (redirect) and
  `/api/event-types*` + `/api/host/*` (401 JSON). Dashboard shell with nav + sign out; bookings
  table (upcoming/past tabs, host-tz times, cancelled badged) with host-initiated cancel
  (`POST /api/host/bookings/[id]/cancel`, `cancelledBy: host`, ownership-checked); settings page
  with the iCal feed URL and copy control. Verified: build, lint, typecheck, 28 unit + 14
  integration pass; manual curl confirmed 401/redirect guard, login (wrong vs right), host cancel
  (401/200/410/404), and settings render.

- 2026-07-18 — Phase 4 complete. Event type CRUD (`/api/event-types` + `/[id]`): create/list/patch/
  delete with Zod validation, duplicate-slug 400, delete-with-bookings 409 (via an ApiError status
  override), dashboard list + create/edit forms. Availability: weekly rules GET/PUT (atomic replace,
  overlap rejection incl. midnight-crossing via extended-interval intersection) + per-weekday editor;
  date overrides (POST replaces a date's rows, overlap-checked) and blackout dates (unique, duplicate
  400) with a combined editor. Public page reflects changes: verified an override replacing the
  weekly window and a blackout zeroing a day via `/api/slots`. Verified: build, lint, typecheck, 42
  unit + 14 integration pass.

- 2026-07-18 — Phase 5 complete. Reminder job (`jobs/reminders.ts`) claims due bookings with a
  single atomic `UPDATE ... WHERE reminderSentAt IS NULL` joined to the event type's lead, sends
  one invitee reminder each in their timezone, and runs every 60s via `instrumentation.ts`;
  `npm run reminders:once` for external cron. Idempotency proven by a concurrent-run integration
  test. A11y: month grid rebuilt as an ARIA grid with roving tabindex + arrow/Home/End/PageUp-Down
  keys and availability in each cell's accessible name (component test); dialogs return focus to
  their trigger. Loading skeletons for the dashboard and booking routes; long-text wrapping.
  Playwright e2e drives book -> Mailpit (invitee + host, text/calendar attachment) -> manage-link
  cancel -> slot frees, all passing. Launch checklist updated. Final verification: build, lint,
  typecheck, 45 unit, 17 integration, 1 e2e all pass.

- 2026-07-22 — Repo hygiene: added `LICENSE` (MIT, Ali Raza) at the root and
  `.github/workflows/ci.yml`. CI runs on push and pull_request to `main` against Node 24 with a
  `postgres:16` service container, applies `prisma migrate deploy` (which creates `btree_gist` and
  the `booking_no_overlap` exclusion constraint), then runs typecheck, lint, `npm run test`, and
  `npm run test:integration` before the build.

## In progress

- Implementation complete through Phase 5.

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
- 2026-07-18 — Booking re-validation runs the engine with `blocks: []` (availability rules only), so
  a slot already taken by another booking still reaches the insert and surfaces as 409 SLOT_TAKEN
  (constraint authority) rather than being misreported as a 422 rule failure. 422 is reserved for
  genuine rule violations (notice, horizon, outside windows).
- 2026-07-18 — React 19 lets function components take `ref` as a plain prop; `Button` and `Input`
  accept and forward it rather than using `forwardRef`.
- 2026-07-18 — Auth.js v5 needs `trustHost: true` for the self-hosted `next start` deploy (no Vercel
  host header), else every `/api/auth/*` call fails with UntrustedHost. Set in `lib/auth.config.ts`.
- 2026-07-18 — `next-auth@5.0.0-beta.31` pulls `@auth/core` whose optional Email-provider peer wants
  nodemailer 7; we keep the documented nodemailer 6 (own mailer, not Auth's Email provider). Added
  `.npmrc` `legacy-peer-deps=true` so the documented stack installs reproducibly.
- 2026-07-18 — Reminder SMTP-down policy: claim first (set reminderSentAt), then send; if the send
  fails, reset reminderSentAt to NULL so the next 60s tick retries. Chosen over dropping the
  reminder so a transient outage still delivers. Claim-before-send keeps a double-fire harmless.
- 2026-07-18 — `@testing-library/react@16` needs `@testing-library/dom` as an explicit peer; added
  it (10.4.1) as a dev dependency. Component tests set jsdom via a `// @vitest-environment jsdom`
  docblock and call `afterEach(cleanup)` (no vitest globals, so RTL auto-cleanup is not registered).
- 2026-07-22 — CI omits `npm run test:e2e`. Playwright needs a browser download plus a booted
  `next start` and a live Mailpit inbox to assert against, which is slow and flaky on a runner;
  it stays a local check against the compose stack. CI also runs without an SMTP server: `sendMail`
  logs and returns false instead of throwing, so the DB-backed suites take the EMAIL_PENDING path
  and still pass. Verified locally by pointing SMTP at a dead port and by replaying
  `prisma migrate deploy` onto a fresh database before running the integration suite.
