# Testing: bookline

The highest-value targets are the two pure libraries (slot engine, ics writer) and the
database-enforced behaviors (booking concurrency, guarded state transitions, reminder idempotency).
`docs/decisions.md` explains why those guarantees live where they do.

## Strategy

### Unit tests - Vitest `unit` project (no I/O, no network, no DB)
- **Slot engine (`tests/unit/slots/engine.test.ts`)** - the core suite. Fixed `now`, synthetic
  rules and bookings, real IANA zones via Luxon. Named DST cases:
  - `dst-spring-forward-skipped-hour` - America/New_York 2026-03-08, rule 01:00-04:00: the
    skipped 02:00 hour yields no slot; 01:00 and 03:00 do.
  - `dst-fall-back-repeated-hour` - America/New_York 2026-11-01, rule 00:30-03:30: each repeated
    wall time yields exactly one slot (earlier offset), no duplicate UTC instants.
  - `dst-mismatched-transition-windows` - Europe/Berlin host, America/Los_Angeles visitor,
    2026-03-17: rendered offset is 8 hours, not the usual 9.
  - `midnight-crossing-window` - Asia/Karachi, Friday 22:00-02:00: slots on both sides of
    midnight, attributed to Friday, bucketed correctly per visitor zone.
  - Plus: override replaces weekly rules; blackout beats both; minimum notice trims today and is
    inclusive at the cutoff; the horizon is measured from the host-local day; symmetric and
    asymmetric buffers; empty rules; a zero or negative duration returns no slots without hanging;
    a visitor date that maps to two host dates; 25 and 23 hourly slots on visitor-zone DST days;
    `daysForMonth` marking only days with open slots.
- **ics writer, invite and feed (`tests/unit/ics/`)** - CRLF endings, 75-octet folding (including
  multi-byte characters), TEXT escaping, UTC DTSTART/DTEND, UID and SEQUENCE passthrough,
  METHOD:REQUEST vs METHOD:CANCEL, STATUS lines, organizer and attendee, a stable UID across a
  reschedule series, intake answers in the DESCRIPTION, and a valid feed with zero bookings.
- **Manage tokens (`tests/unit/tokens.test.ts`)** - round trip, wrong secret, tampered payload or
  signature, truncation, missing separator, non-canonical payload encoding.
- **Validation schemas (`tests/unit/validation.test.ts`)** - weekly rule overlap detection
  including midnight-crossing pairs, event type bounds (duration > 0, buffers >= 0, horizon >= 1,
  slug shape), invalid IANA zones, invalid emails.

### Component tests - Vitest + Testing Library (jsdom), also in the `unit` project
- `MonthGrid`: availability in each cell's accessible name, arrow-key navigation, Enter selects
  only available days.
- `SlotList`: announced slot count and timezone, empty state, singular wording.
- `BookingConfirmation`: live status region, focus on mount, the pending-email warning keeps the
  manage link.

Behavior and accessibility (roles, names) only - no styling assertions.

### Integration tests - Vitest `integration` project against real Postgres
Run serially (single fork) against a migrated database; these exist because the guarantees live in
Postgres, not in application code:
- `simultaneous-booking-single-winner` - two concurrent submissions for one slot: exactly one wins,
  one gets `SLOT_TAKEN`, one confirmed row.
- Exclusion constraint semantics - overlapping block ranges rejected with `23P01`; touching ranges
  allowed; cancelled rows do not conflict; a reschedule onto its own old range succeeds.
- Manage paths - cancel bumps SEQUENCE and frees the slot; double cancel refused; reschedule keeps
  the UID, increments SEQUENCE, and rejects cancelled bookings and slots held by another booking.
- Reschedule and cancel races - a cancel committed inside the caller's own status read makes the
  reschedule (or a second cancel) fail with `BOOKING_NOT_ACTIONABLE`.
- ics pipeline - one UID with SEQUENCE 0, 1, 2, 3 and METHOD flipping to CANCEL across create,
  reschedule, reschedule, cancel.
- Reminder idempotency - concurrent runs send exactly one email, a later run or a restarted process
  does not resend, and cancelled bookings are never reminded (mailer mocked; the claim is the thing
  under test).
- Intake questions - required answers, invalid choices, persistence, and answers in the generated
  .ics.
- Host credentials and host-initiated cancellation.

### End-to-end - Playwright (one smoke test, local only)
Against `next start` with the compose stack up, using Mailpit's REST API to read mail:
1. Open `/book/intro-call`, pick a day and slot, book with name and email.
2. Assert the confirmation screen and that Mailpit received invitee and host messages with a
   `text/calendar` attachment.
3. Follow the manage link from the email body, cancel, assert the cancelled state.
4. Reload the booking page and assert the slot is offered again.

### Manual checks
Automation does not cover importing .ics files into real calendar apps, subscribing to the feed
from one, visual states in both themes, keyboard-only and screen-reader runs, or rendering in real
mail clients. Check these by hand when a change touches them.

## Exact commands

```
docker compose up -d          # Postgres + Mailpit
npm ci                        # exact pinned versions from package-lock.json
npx prisma migrate deploy     # apply migrations (btree_gist + booking_no_overlap)
npm run db:seed               # seed host + example event type

npm run typecheck             # tsc --noEmit
npm run lint                  # ESLint (next lint)
npm run test                  # vitest run --project unit (unit + component, no DB)
npm run test:integration      # vitest run --project integration (requires Postgres)
npm run test:coverage         # vitest run --coverage (both projects, lib/ coverage gate)
npm run test:e2e              # Playwright smoke test (requires the compose stack and next start)
npm run build                 # production build
```

The coverage gate is configured in `vitest.config.ts`: it measures `lib/**` only and fails below 80
percent lines and statements. Route handlers are exercised by the Playwright suite, which Vitest
coverage does not see.

## CI

`.github/workflows/ci.yml` runs on every push and pull request to `main`, on Node 24 with a
`postgres:16` service container and no SMTP server:

1. `npm ci`
2. `npx prisma generate`
3. `npx prisma migrate deploy` (onto a fresh database, so the migrations, `btree_gist` and the
   exclusion constraint are replayed on every run)
4. `npm run typecheck`
5. `npm run lint`
6. `npm run test`
7. `npm run test:coverage` (runs the unit and integration projects with the coverage gate)
8. `npm run build`

`npm run test:e2e` is not run in CI: Playwright needs a browser download, a booted `next start`,
and a live Mailpit inbox, which is slow and flaky on a runner. Run it locally against the compose
stack when a change touches the end-to-end booking flow. Because no SMTP server runs in CI,
`sendMail` returns false and the DB-backed suites exercise the email-pending path.
