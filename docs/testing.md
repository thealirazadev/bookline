# Testing: bookline

Build and tests must pass before any feature is marked done. After creating or editing files, run
the build and the test suite and fix all errors before reporting done. The highest-value targets
are the two pure libraries (slot engine, ics writer) and the two database-enforced behaviors
(booking concurrency, reminder idempotency).

## Strategy

### Unit tests — Vitest (no I/O, no network, no DB)
- **Slot engine (`lib/slots/`)** — the core suite. Fixed `now`, synthetic rules/bookings, real
  IANA zones via Luxon. Required named cases (also listed in `docs/phases.md` Phase 1):
  - `dst-spring-forward-skipped-hour` — America/New_York 2026-03-08, rule 01:00–04:00: the
    skipped 02:00 hour yields no slot; 01:00 and 03:00 do.
  - `dst-fall-back-repeated-hour` — America/New_York 2026-11-01, rule 00:30–03:30: each repeated
    wall time yields exactly one slot (earlier offset), no duplicate UTC instants.
  - `dst-mismatched-transition-windows` — Europe/Berlin host, America/Los_Angeles visitor,
    2026-03-17: rendered offset is 8 hours, not the usual 9.
  - `midnight-crossing-window` — Asia/Karachi, Friday 22:00–02:00: slots on both sides of
    midnight, attributed to Friday, bucketed correctly per visitor zone.
  - Plus: override replaces weekly rules; blackout beats both; min-notice trims today; horizon
    cuts the last day (host-local); buffers block adjacent candidates; empty rules -> empty
    output; visitor date maps to two host dates across the dateline.
- **ics writer (`lib/ics/`)** — CRLF endings, 75-octet folding on long SUMMARY/DESCRIPTION, TEXT
  escaping (`,` `;` `\` newline), UTC DTSTART/DTEND format, METHOD:REQUEST vs METHOD:CANCEL,
  SEQUENCE and UID passthrough, STATUS lines, feed with zero bookings still valid.
- **Manage tokens (`lib/tokens.ts`)** — round trip, tampered payload, tampered signature,
  truncation, wrong secret; verification uses `timingSafeEqual`.
- **Validation schemas** — booking body, event type bounds (duration > 0, buffers >= 0, horizon
  >= 1), weekly rules overlap detection including midnight-crossing pairs, IANA zone check
  rejects `"Mars/Olympus"`.
- **Email templates** — user text is HTML-escaped; times rendered in the invitee zone; manage
  link present.

### Component tests — Vitest + Testing Library (jsdom)
- MonthGrid: available/unavailable cells, arrow-key navigation, `aria-selected`.
- SlotList + BookingForm: select-confirm flow, field errors focus first invalid input, submit
  disabled while pending, SLOT_TAKEN response swaps the list and announces.
- TimezoneSelect: detected default, change re-renders labels.
- Dashboard tables/forms: empty states, field-level errors, confirm dialogs.
Behavior and accessibility (roles, names) only — no styling assertions.

### Integration tests — Vitest against real Postgres (Docker)
Run serially against the compose database with a truncate-per-test helper; these exist because
the guarantees live in Postgres, not in application code:
- `simultaneous-booking-single-winner` — two concurrent `POST /api/bookings` (or direct service
  calls) for one slot: exactly one 201/insert, one 409/`23P01`, one confirmed row.
- Exclusion constraint semantics — overlapping block ranges rejected; touching ranges
  (`end == start`) allowed; cancelled rows do not conflict; reschedule onto its own old time
  succeeds.
- Reminder idempotency — two concurrent job runs over the same due booking send exactly one email
  (mailer mocked; the claim is the thing under test).
- Migration replay — `prisma migrate reset` leaves the constraint present (asserted via
  `pg_constraint`).

### End-to-end — Playwright (one smoke test, Phase 5)
Against `next start` with the compose stack up, using Mailpit's REST API to read mail:
1. Open `/book/intro-call`, pick a day and slot, book with name/email.
2. Assert the confirmation screen and that Mailpit received invitee + host messages with a
   `text/calendar` attachment.
3. Follow the manage link from the email body, cancel, assert the cancelled state.
4. Reload the booking page and assert the slot is offered again.

### Manual QA
Per-phase checklists in `docs/phases.md` cover what automation cannot: importing .ics files into
real calendar apps, subscribing to the feed, visual states in both themes, keyboard-only runs,
screen-reader announcements, and SMTP-down behavior.

## Exact commands

```
docker compose up -d          # Postgres + Mailpit
npm install                   # exact pinned versions; commit package-lock.json
npx prisma migrate dev        # apply migrations
npm run db:seed               # seed host + example event type

npm run lint                  # ESLint
npm run test                  # Vitest unit + component (no DB required)
npm run test:integration      # Vitest, DB-backed suite (requires compose stack)
npm run test:e2e              # Playwright smoke test (requires compose stack)
npm run build                 # production build
```

Expected `package.json` scripts:

```
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run --project unit",
  "test:watch": "vitest",
  "test:integration": "vitest run --project integration",
  "test:e2e": "playwright test",
  "db:seed": "prisma db seed",
  "reminders:once": "tsx jobs/reminders.ts"
}
```

(Exact Vitest project wiring is an implementation detail; the split — unit runnable without
Docker, integration requiring it — is the contract.)

## Definition of "tests pass" for a feature

- `npm run lint` — no errors.
- `npm run build` — succeeds.
- `npm run test` — passes.
- `npm run test:integration` — passes for any feature touching bookings, availability writes, or
  reminders.
- From Phase 5 on, `npm run test:e2e` — passes.

Never commit a feature with any of these failing. Two failed fix attempts on the same problem:
stop and report (see Boundaries in `docs/rules.md`).
