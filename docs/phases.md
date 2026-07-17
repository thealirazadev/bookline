# Phases: bookline

Phase N+1 does not start until the owner approves phase N. Ship the smallest useful increments;
every phase leaves the app runnable and testable. One commit per feature/task, in the listed
order, Conventional Commits. Build and tests must pass before a feature is done (`docs/testing.md`).

The three senior differentiators are hard requirements of Phases 1 and 2, never later:
timezone-correct slot math (Phase 1), DB-level concurrency-safe booking (Phase 1 constraint,
Phase 2 flow), RFC 5545 calendar interop (Phase 1 writer, Phase 2 delivery + feed).

---

## Phase 1 — Scaffold, database, slot engine, ics writer

Goal: a running Next.js app wired to Postgres with the full schema (including the exclusion
constraint), a seeded host, and the two core libraries — the timezone slot engine and the RFC 5545
writer — complete and heavily unit-tested as pure code. No booking UI yet.

### Definition of done
- Next.js 15 App Router + TypeScript + Tailwind boots with `npm run dev`; ESLint + Prettier clean;
  exact versions pinned; `package-lock.json` committed.
- `docker-compose.yml` brings up Postgres 16 and Mailpit; `.env.example` current; `lib/env.ts`
  validates every variable at startup and fails fast with a clear message.
- Initial Prisma migration creates all tables from `docs/architecture.md` plus, as raw SQL in the
  same migration, `btree_gist` and the `booking_no_overlap` exclusion constraint
  (`hostId` equal, `tstzrange(blockStartUtc, blockEndUtc)` overlap, `WHERE status = 'confirmed'`).
- `prisma/seed.ts` creates the host from `SEED_HOST_*` (bcrypt hash, random `feedToken`, validated
  IANA timezone) and one example event type with weekly rules.
- `lib/slots/engine.ts` implements the algorithm in `docs/architecture.md` as pure functions, with
  named unit tests passing, including all four timezone cases below.
- `lib/ics/writer.ts` produces valid RFC 5545 output (CRLF line endings, 75-octet folding, TEXT
  escaping, UTC `DTSTART`/`DTEND`, `UID`, `SEQUENCE`, `METHOD` REQUEST/CANCEL) with unit tests.
- `lib/logger.ts` and `lib/errors.ts` exist and are used by the seed and env layers.
- A DB-level integration test proves the exclusion constraint: two inserts with overlapping block
  ranges -> second insert fails with Postgres `23P01`; a cancelled row does not conflict.

### Named required test cases (must exist with these names)
- `dst-spring-forward-skipped-hour` — host America/New_York, rule 01:00–04:00 on Sunday
  2026-03-08, 60-min event: local 02:00–02:59 does not exist; exactly the 01:00 and 03:00 starts
  are produced; every returned UTC instant round-trips to a real wall time.
- `dst-fall-back-repeated-hour` — host America/New_York, rule 00:30–03:30 on Sunday 2026-11-01,
  30-min event: wall times 01:00–01:59 occur twice; each wall time yields exactly one slot (earlier
  offset); no duplicate UTC instants; six slots total (00:30 through 03:00).
- `dst-mismatched-transition-windows` — host Europe/Berlin, rule Tuesday 09:00–12:00, visitor
  America/Los_Angeles, date 2026-03-17 (US already on DST, Europe not): visitor-rendered times
  shift by the 8-hour offset, not the usual 9.
- `midnight-crossing-window` — host Asia/Karachi, rule Friday 22:00–02:00, 60-min event: starts at
  22:00, 23:00, 00:00, 01:00, the last two on Saturday local, all attributed to Friday's window,
  and correctly bucketed for a visitor whose local date differs.

### Manual test checklist
- `docker compose up -d`, `npx prisma migrate dev`, `npm run db:seed`, `npm run dev` -> app serves
  on `localhost:3000` with no console errors.
- `npx prisma migrate reset` replays migrations cleanly (constraint SQL survives replay).
- In `psql`, insert two overlapping confirmed bookings by hand -> second rejected by
  `booking_no_overlap`.
- Import a writer-generated .ics file into Google Calendar or Apple Calendar -> event appears at
  the correct UTC-derived local time, no import warnings.
- Break `DATABASE_URL` -> startup fails with a clear, secret-free message.

### Verification
- `npm run build`, `npm run lint`, `npm run test`, `npm run test:integration` all pass.
- Browser console clean on the placeholder page.
- Unhappy paths: missing env var (fail fast), invalid `SEED_HOST_TIMEZONE` (seed refuses), seed
  re-run (idempotent, no duplicate host).

### Commits
- `chore(scaffold): init next app router with typescript and tailwind`
- `chore(tooling): add eslint prettier vitest and playwright config`
- `build(dev): add docker compose with postgres and mailpit`
- `feat(env): add validated server-only env access`
- `feat(logging): add structured logger and error helper`
- `feat(db): add prisma schema and initial migration with exclusion constraint`
- `feat(db): add host and event type seed script`
- `feat(slots): add window resolution for rules overrides and blackouts`
- `feat(slots): project host-local windows to utc slot instants`
- `test(slots): cover dst edges midnight crossing and visitor bucketing`
- `feat(ics): add rfc 5545 writer with folding and escaping`
- `test(ics): cover invite cancel and writer edge cases`
- `test(db): prove exclusion constraint blocks overlapping bookings`

---

## Phase 2 — Public booking flow, emails, manage links, feed

Goal: a visitor can book end to end — pick a day and slot in their timezone, submit, receive a
confirmation email with a valid invite, cancel or reschedule via the signed link — and an external
calendar can subscribe to the feed. All three differentiators are fully live at the end of this
phase.

### Definition of done
- `GET /api/availability`, `GET /api/slots`, `POST /api/bookings` implemented exactly per
  `docs/api-contracts.md`, Zod-validated, using the Phase 1 engine.
- `/book` and `/book/[eventTypeSlug]` render the month grid, slot list, timezone select (detected
  default + manual override), and booking form per `docs/design.md`.
- Booking insert runs in a transaction; a `23P01` exclusion violation maps to 409 `SLOT_TAKEN`
  with `refreshedSlots`; the UI shows the friendly message and swaps in the refreshed list.
- Integration test `simultaneous-booking-single-winner`: two parallel POSTs for the same slot
  against real Postgres -> exactly one 201, one 409, one confirmed row.
- Confirmation emails (invitee + host) send via SMTP with a METHOD:REQUEST .ics attachment; UID
  stored on the booking; SMTP failure leaves the booking stored and returns `emailStatus:
  "pending"`.
- `/manage/[token]` page plus cancel and reschedule endpoints per contract: HMAC token verified
  with `timingSafeEqual`; cancel sends METHOD:CANCEL (same UID, SEQUENCE + 1); reschedule re-runs
  the full engine + constraint path, keeps UID, increments SEQUENCE, emails updated invites.
- `GET /api/ical/[feedToken]` serves the text/calendar feed; wrong token -> 404.
- Slot list auto-reflects bookings: booking a slot then reloading the day no longer shows it.

### Manual test checklist
- Open `/book/intro-call`: month grid marks available days; click a day -> slots in your local
  timezone; switch the timezone select to `Asia/Tokyo` -> labels and day bucketing change.
- Book a slot -> confirmation screen; Mailpit (`localhost:8025`) shows invitee + host emails; open
  the .ics attachment in a calendar app -> correct time, organizer, summary.
- Two browser tabs on the same day: book the same slot in tab A, submit tab B -> tab B shows
  "that time was just booked" and a refreshed slot list, no error page.
- Open the manage link from the email: cancel -> status shown, slot reappears on `/book`, both
  sides get METHOD:CANCEL mail; calendar removes the event.
- Book again, reschedule via the manage link -> only valid slots offered, calendar event moves in
  place (same UID), SEQUENCE incremented in the new .ics.
- Subscribe to `/api/ical/<feedToken>` from a calendar app -> confirmed bookings appear; cancel
  one -> gone after refresh.
- Tamper one character of a manage token -> friendly invalid-link page.

### Verification
- Build, lint, unit, integration suites pass; booking page console clean.
- Unhappy paths: submit with empty name/invalid email (field errors, no booking), submit a stale
  slot after the notice window crosses it (422 message), stop Mailpit and book (booking stored,
  `emailStatus: "pending"`, warn log), double-click the submit button (one booking), refresh
  mid-flow (no orphan rows), day with zero slots (empty state), very long name (stored and
  rendered without layout break, escaped in email).
- No token, email address, or SMTP credential appears in any log line.

### Commits
- `feat(api): add availability and slots endpoints`
- `feat(booking): add month grid slot list and timezone select`
- `feat(booking): add booking form with server validation`
- `feat(booking): create bookings with constraint-backed conflict handling`
- `test(booking): prove single winner under simultaneous submissions`
- `feat(email): add smtp mailer and confirmation templates with ics attachment`
- `feat(manage): add signed manage tokens and booking manage page`
- `feat(manage): add cancel flow with method cancel emails`
- `feat(manage): add reschedule flow with stable uid and sequence increment`
- `feat(ical): add subscribable calendar feed endpoint`
- `test(manage): cover token verification cancel and reschedule paths`

---

## Phase 3 — Host auth and dashboard

Goal: the host signs in and sees their bookings; host-side cancel works.

### Definition of done
- Auth.js credentials login at `/login` against the seeded host (bcrypt compare); generic failure
  message; JWT session cookie; sign-out.
- `middleware.ts` guards `/dashboard*` and host APIs; unauthenticated -> redirect (pages) or 401
  (APIs); access matrix in `docs/rules.md` enforced.
- `/dashboard` lists upcoming and past bookings (tabs), rendered in the host's timezone, showing
  invitee name/email, event type, status; cancelled bookings visibly badged.
- `POST /api/host/bookings/[id]/cancel` wired to a confirm dialog; triggers the same cancellation
  emails/ics as the invitee flow with `cancelledBy: "host"`.
- `/dashboard/settings` shows host name, timezone, and the iCal feed URL with a copy control.

### Manual test checklist
- Visit `/dashboard` signed out -> redirected to `/login`; wrong password -> generic message;
  correct credentials -> dashboard.
- Book a slot publicly -> it appears under Upcoming with the right host-local time.
- Cancel it from the dashboard -> confirm dialog, invitee gets the cancellation email, slot frees
  up, booking moves to a cancelled badge.
- `curl /api/event-types` without a session cookie -> 401 JSON in the standard error format.
- Sign out -> `/dashboard` redirects again.

### Verification
- Build, lint, tests pass; no session token logged.
- Unhappy paths: empty login form (validation), session cookie tampered (treated as signed out),
  cancelling an already-cancelled booking (410 handled in UI), dashboard with zero bookings
  (empty states for both tabs).

### Commits
- `feat(auth): add credentials login with seeded host account`
- `feat(auth): guard dashboard and host apis via middleware`
- `feat(dashboard): list upcoming and past bookings in host timezone`
- `feat(dashboard): add host-initiated cancellation`
- `feat(dashboard): add settings page with ical feed url`
- `test(auth): cover login guard and host cancel`

---

## Phase 4 — Event type CRUD and availability editor

Goal: the host manages event types and availability entirely from the dashboard; the public page
reflects changes immediately.

### Definition of done
- Event type list, create, edit, deactivate, delete per `docs/api-contracts.md`; server-side Zod
  validation with field-level errors surfaced inline; delete blocked (409) when bookings exist,
  with deactivate offered instead.
- Weekly rules editor: per-weekday window rows, add/remove, midnight-crossing windows accepted
  (end before start), overlap within a weekday rejected server-side with a clear message.
- Overrides editor: pick a date, define replacement windows or clear them; list and delete
  existing overrides. Blackout dates: add/remove; duplicates rejected.
- Public `/book` page reflects saved changes on next load (new event type appears, deactivated
  one disappears, changed rules change slots).

### Manual test checklist
- Create an event type -> it appears on `/book`; deactivate it -> gone publicly, still in the
  dashboard with its bookings.
- Enter duration 0, negative buffer, duplicate slug -> inline field errors, nothing saved.
- Add a Friday 22:00–02:00 window -> saved; `/book` shows slots past midnight (verify against the
  `midnight-crossing-window` expectations).
- Add overlapping windows on one weekday -> rejected with a message naming the conflict.
- Add an override for a date -> that date shows exactly the override windows; delete the override
  -> weekly rules return. Add a blackout -> the date shows no slots and the month grid unmarks it.

### Verification
- Build, lint, tests pass.
- Unhappy paths: submitting the weekly editor with an empty rule set (allowed — host is simply
  unbookable; public page shows a "no open times" state), malformed date strings (400), an
  override on a blacked-out date (blackout wins, editor says so), very long event type
  name/description (clamped in UI, stored fine).

### Commits
- `feat(event-types): add crud endpoints with validation`
- `feat(event-types): add dashboard list and forms`
- `feat(availability): add weekly rules endpoints and editor`
- `feat(availability): add date overrides and blackout dates`
- `test(availability): cover overlap rejection and override precedence`

---

## Phase 5 — Reminders, polish, end-to-end

Goal: reminder emails fire exactly once, the UI meets the design and accessibility bar, and a
Playwright smoke test guards the booking flow.

### Definition of done
- `jobs/reminders.ts` claims due bookings atomically (`reminderSentAt IS NULL` and
  `startUtc - reminderLeadMin <= now`, confirmed only) and sends one reminder each, rendered in
  the invitee's timezone with the manage link; `instrumentation.ts` runs it every 60s; a manual
  `npm run reminders:once` script exists for testing and external cron.
- Idempotency test: firing the job twice concurrently sends exactly one email per due booking.
- Accessibility pass per `docs/design.md`: labels, focus states, keyboard operability (month grid
  arrow keys, dialogs focus-trapped), `aria-live` announcements for slot refresh and toasts,
  contrast in both themes.
- Loading, empty, and error states present on every data-driven view; custom 404 and error pages.
- Playwright smoke test: book -> Mailpit shows mail -> manage link cancels -> slot frees.

### Manual test checklist
- Create a booking with a 1-minute reminder lead (test event type) -> reminder lands in Mailpit
  within the next tick; it never sends twice; cancelling before the lead time means no reminder.
- Keyboard-only: complete an entire booking, then a cancel via manage page.
- Toggle `prefers-reduced-motion` -> no shimmer/scale animations.
- Kill Postgres while browsing -> friendly error state, structured error log, no stack trace in
  the browser.

### Verification
- `npm run build`, `npm run lint`, `npm run test`, `npm run test:integration`,
  `npm run test:e2e` all pass.
- Unhappy paths: reminder job with SMTP down (claim released or retried next tick — pick one,
  document in memory.md), booking exactly at the lead boundary (single send), long cancel reason
  (stored, clamped in dashboard).
- `docs/launch-checklist.md` items that are verifiable now get ticked with notes.

### Commits
- `feat(reminders): add claim-and-send reminder job with scheduler`
- `test(reminders): prove single send under concurrent job runs`
- `feat(ui): add loading empty and error states across views`
- `feat(a11y): add keyboard month grid focus management and live regions`
- `test(e2e): add booking and cancel smoke test`
- `docs(launch): update launch checklist status`

---

## Backlog

_(empty)_
