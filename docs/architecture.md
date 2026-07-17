# Architecture: bookline

## App flow

### Public booking

1. A visitor opens `/book` (event type list) or `/book/[eventTypeSlug]` (the booking page). These
   are server components; the booking page shell renders with the event type's details.
2. The client detects the visitor timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`
   and offers a manual override select. The month grid and slot list are client components that
   fetch `GET /api/availability` (which days have slots) and `GET /api/slots` (slots for a day),
   passing the visitor timezone for day bucketing. All slot instants travel as UTC ISO strings;
   the client only formats them for display.
3. Slot generation runs server-side in `lib/slots/`: load the host timezone, the event type, weekly
   rules, overrides, blackouts, and confirmed bookings for the range; project rules from host-local
   wall times to UTC instants with Luxon; subtract booked block ranges, minimum notice, and the
   max-days-ahead horizon; bucket the surviving slots by visitor-local date.
4. The visitor submits `POST /api/bookings` with the event type slug, the chosen UTC start, name,
   email, and their timezone. Inside a transaction the server re-validates the slot against the
   engine, then inserts the booking. A Postgres exclusion constraint on the occupied time range is
   the authoritative double-booking guard: on constraint violation the API returns 409 with
   refreshed slots and the UI shows "that time was just taken".
5. On success the server generates a stable .ics UID, renders confirmation emails for invitee and
   host with a METHOD:REQUEST .ics attachment, and sends them via SMTP. Email failure never rolls
   back a stored booking; it is logged and the response flags the email as pending.

### Manage (cancel / reschedule)

6. Confirmation and reminder emails link to `/manage/[token]`. The token is
   `base64url(bookingId) + "." + HMAC-SHA256(bookingId, LINK_TOKEN_SECRET)` — stateless, no
   expiry column; validity is derived from booking status and start time.
7. Cancel: `POST /api/manage/[token]/cancel` sets status to `cancelled`, frees the slot (the
   exclusion constraint only covers confirmed rows), increments SEQUENCE, and emails both sides a
   METHOD:CANCEL invite for the same UID.
8. Reschedule: the manage page reuses the same month/day picker; `POST /api/manage/[token]/reschedule`
   re-runs the full engine validation and the same constraint-guarded transaction, updates the
   times in place, keeps the UID, increments SEQUENCE, and emails both sides the updated invite.

### Host

9. The host signs in at `/login` (Auth.js credentials, single seeded account, JWT session cookie).
   `middleware.ts` guards `/dashboard` and host APIs.
10. Dashboard pages are server components that read via `lib/queries/` (Prisma) directly; all
    mutations (event type CRUD, availability, host cancel) go through the JSON routes in
    `docs/api-contracts.md` so every write shares one validated, documented surface.
11. External calendars subscribe to `GET /api/ical/[feedToken]` — a text/calendar feed of the
    host's confirmed bookings, token stored on the host row.

### Reminders

12. `instrumentation.ts` starts a 60-second interval loop (Node runtime, dev and self-hosted
    single-instance deploys). Each tick claims due reminders with an atomic
    `UPDATE ... WHERE reminder_sent_at IS NULL`-style write, then sends one reminder email per
    claimed booking. Claim-before-send makes a double-fire harmless. Trade-off: this assumes one
    long-running server process; a serverless deploy would need an external cron hitting a
    protected route instead — documented, out of scope for v1.

```
Visitor browser                         Host browser
  |  /book/[slug]  (SSR shell)            |  /login -> /dashboard (SSR, session cookie)
  v                                       v
Next.js route handlers  <--- middleware guard for /dashboard + host APIs
  |        |         |
  |        |         +--> lib/email/ --SMTP--> Mailpit (dev) / real SMTP (prod)
  |        |                   ^ .ics from lib/ics/
  |        +--> lib/slots/  (Luxon: host-tz rules -> UTC instants -> visitor-tz rendering)
  v
Prisma --> PostgreSQL
           bookings EXCLUDE USING gist (host_id =, occupied tstzrange &&) WHERE confirmed
External calendars --GET--> /api/ical/[feedToken]
```

## Proposed folder and file tree

```
bookline/
  app/
    layout.tsx                    Root layout: html/body, theme, fonts
    globals.css                   Tailwind directives + design tokens
    page.tsx                      Redirects to /book
    not-found.tsx                 Global 404
    error.tsx                     Route-level error boundary
    login/page.tsx                Host login form
    book/
      page.tsx                    Public list of active event types
      [eventTypeSlug]/page.tsx    Booking page: month grid, slot list, form
    manage/
      [token]/page.tsx            Booking summary + cancel / reschedule entry
      [token]/reschedule/page.tsx Reschedule picker (reuses booking components)
    dashboard/
      layout.tsx                  Authed shell with nav
      page.tsx                    Upcoming/past bookings
      event-types/page.tsx        Event type list
      event-types/new/page.tsx    Create form
      event-types/[id]/page.tsx   Edit form
      availability/page.tsx       Weekly rules, overrides, blackouts editor
      settings/page.tsx           Host timezone, iCal feed URL display
    api/
      auth/[...nextauth]/route.ts Auth.js handler
      availability/route.ts       GET: days with open slots (public)
      slots/route.ts              GET: slots for one day (public)
      bookings/route.ts           POST: create booking (public)
      manage/[token]/route.ts     GET: booking details for manage page
      manage/[token]/cancel/route.ts      POST
      manage/[token]/reschedule/route.ts  POST
      event-types/route.ts        GET list / POST create (host)
      event-types/[id]/route.ts   PATCH / DELETE (host)
      host/availability/route.ts  GET / PUT weekly rules (host)
      host/overrides/route.ts     GET / POST; [id]/route.ts DELETE (host)
      host/blackouts/route.ts     GET / POST; [id]/route.ts DELETE (host)
      host/bookings/[id]/cancel/route.ts  POST (host cancel)
      ical/[feedToken]/route.ts   GET: text/calendar feed (token-authed)
  components/
    booking/
      MonthGrid.tsx               Client: month calendar, available-day marks
      SlotList.tsx                Client: slot buttons for the selected day
      TimezoneSelect.tsx          Client: detected tz + manual override
      BookingForm.tsx             Client: name/email, submit, slot-taken recovery
      BookingConfirmation.tsx     Success summary with manage link note
    dashboard/
      BookingsTable.tsx           Upcoming/past tabs, host-tz times
      EventTypeForm.tsx           Create/edit with field-level errors
      WeeklyRulesEditor.tsx       Per-weekday window rows
      OverridesEditor.tsx         Date overrides + blackout dates
    ui/
      Button.tsx  Input.tsx  Select.tsx  Badge.tsx  EmptyState.tsx
      Skeleton.tsx  Toast.tsx  ConfirmDialog.tsx
  lib/
    slots/
      engine.ts                   generateSlots(): the projection algorithm
      windows.ts                  Rule/override/blackout resolution per host-local date
      types.ts                    SlotQuery, Slot, DayAvailability
    ics/
      writer.ts                   RFC 5545 VCALENDAR/VEVENT writer (fold, escape, CRLF)
      invite.ts                   Booking -> REQUEST / CANCEL invite objects
      feed.ts                     Host bookings -> subscribable calendar
    email/
      mailer.ts                   Nodemailer transport from env, failure-safe send
      templates.ts                Confirmation / cancellation / reschedule / reminder bodies
    auth.ts                       Auth.js config (credentials provider, session helpers)
    tokens.ts                     Manage-token sign/verify (node:crypto HMAC)
    db.ts                         Prisma client singleton
    env.ts                        Validated env access (server-only)
    logger.ts                     Structured JSON logger with redaction
    errors.ts                     ApiError type + error-response helper (single format)
    queries/
      bookings.ts  eventTypes.ts  availability.ts   Read helpers for server components
    validation/
      booking.ts  eventType.ts  availability.ts     Zod schemas shared by routes
  jobs/
    reminders.ts                  Claim-and-send due reminders (called by instrumentation)
  instrumentation.ts              Starts the reminder interval (Node runtime only)
  middleware.ts                   Session guard for /dashboard and host APIs
  prisma/
    schema.prisma
    migrations/                   Includes raw SQL for btree_gist + exclusion constraint
    seed.ts                       Seeds host account + example event type from env
  tests/
    unit/                         Engine, ics writer, tokens, validation, templates
    integration/                  Booking concurrency + reminder idempotency vs real Postgres
    components/                   Testing Library component tests
    e2e/                          Playwright booking-flow smoke test
  docker-compose.yml              Postgres + Mailpit for local dev
  .env.example
  next.config.ts  tailwind.config.ts  postcss.config.mjs  tsconfig.json
  vitest.config.ts  playwright.config.ts  eslint config  .prettierrc
  package.json  package-lock.json
```

## Tech stack with rationale

Major versions listed now; exact versions are pinned at install time and `package-lock.json` is
committed. Every runtime dependency below is proposed and needs owner approval before install.

- **Next.js 15 (App Router) + TypeScript 5 + React 19** — matches the conventions of the sibling
  projects (`woo-headless`). Server components keep slot generation, secrets, and Prisma on the
  server; route handlers give a documentable JSON API for the booking flow.
- **PostgreSQL 16 + Prisma 6** — Postgres is required, not incidental: the double-booking guarantee
  is a `tstzrange` **exclusion constraint** (`btree_gist`), which SQLite/MySQL cannot express.
  Prisma provides typed queries and a migration workflow; the exclusion constraint and extension
  are added as raw SQL inside a normal Prisma migration file (Prisma's schema DSL cannot declare
  them, the migration system carries them fine).
- **Luxon 3** — the date library for all timezone math. Chosen over date-fns-tz (clunkier API for
  wall-time -> instant projection) and the Temporal polyfill (Temporal's disambiguation control is
  attractive but the polyfill is heavy and Temporal is not yet boring). Luxon uses the platform's
  Intl IANA data (no bundled tz database), is immutable, and has documented DST semantics the
  engine builds its policy on: nonexistent local times are detectably shifted (skip policy below),
  ambiguous local times resolve to the earlier offset.
- **Auth.js (next-auth) 5, credentials provider** — boring, audited session handling (CSRF, cookie
  flags, JWT session) for a single seeded host account; hand-rolling sessions saves one dependency
  but re-implements exactly the code most likely to be wrong. Password hashed with **bcryptjs 3**
  (pure JS, no native build step).
- **Zod 3** — one validation layer for every route handler body/query; schemas double as the
  source of the field-level error messages in `docs/api-contracts.md`.
- **Nodemailer 6 + SMTP** — plain SMTP keeps the project provider-agnostic. Dev mailbox is
  **Mailpit** via `docker-compose.yml` (SMTP on 1025, web UI on 8025) so email flows are testable
  locally with zero external accounts.
- **Hand-rolled .ics writer (no dependency)** — RFC 5545 output is a differentiator here: METHOD,
  stable UID, SEQUENCE, and CANCEL handling must be exactly right, and the popular `ics` package
  gets METHOD/SEQUENCE control wrong or awkward. The needed subset (VCALENDAR, VEVENT, TZID-free
  UTC times, 75-octet folding, text escaping, CRLF) is ~100 lines and fully unit-testable.
- **Tailwind CSS 3.4** — matches sibling projects; tokens from `docs/design.md` live in
  `tailwind.config.ts`.
- **Vitest 3 + Testing Library, Playwright 1.x** — Vitest for the engine/ics/unit and component
  layers, one Playwright smoke test for the booking flow. Integration tests (concurrency,
  reminders) run against the Docker Postgres.
- **ESLint + Prettier** — as in sibling projects.

## Data model

Tables as Prisma models; all timestamps `timestamptz` in UTC. Local-time fields are explicitly
minutes-of-day integers in the **host's** timezone.

```
Host {
  id            String   @id (cuid)
  email         String   @unique
  passwordHash  String
  name          String
  timezone      String            // IANA, e.g. "Europe/Berlin" — validated against Intl
  feedToken     String   @unique  // random 32-byte hex; iCal feed auth
  createdAt / updatedAt
}

EventType {
  id                String  @id
  hostId            String  -> Host
  name              String
  slug              String  @unique   // public URL segment
  description       String            // may be empty
  durationMin       Int               // > 0
  bufferBeforeMin   Int               // >= 0, blocks time before the appointment
  bufferAfterMin    Int               // >= 0, blocks time after
  minNoticeMin      Int               // >= 0, earliest bookable = now + minNotice
  maxDaysAhead      Int               // >= 1, horizon in host-local days
  reminderLeadMin   Int               // >= 0; 0 disables reminders for this type
  active            Boolean           // inactive: hidden publicly, history kept
  createdAt / updatedAt
}

AvailabilityRule {                     // weekly recurring windows, host timezone
  id           String @id
  hostId       String -> Host
  weekday      Int                     // 0 = Monday .. 6 = Sunday
  startMinute  Int                     // 0..1439, wall-clock minutes in host tz
  endMinute    Int                     // 1..1440; endMinute <= startMinute means the
}                                      // window crosses midnight into the next day

DateOverride {                         // replaces ALL weekly rules for `date`
  id           String @id
  hostId       String -> Host
  date         String                  // "YYYY-MM-DD", a host-local calendar date
  startMinute  Int                     // same semantics as AvailabilityRule
  endMinute    Int
}                                      // multiple rows per date = multiple windows

BlackoutDate {                         // zero slots on `date`, beats rules and overrides
  id      String @id
  hostId  String -> Host
  date    String                       // host-local "YYYY-MM-DD"
  @@unique([hostId, date])
}

Booking {
  id               String   @id
  hostId           String   -> Host
  eventTypeId      String   -> EventType
  inviteeName      String
  inviteeEmail     String
  inviteeTimezone  String              // IANA, for email rendering
  startUtc         DateTime            // appointment start (UTC)
  endUtc           DateTime            // appointment end   (UTC)
  blockStartUtc    DateTime            // startUtc - bufferBefore at booking time
  blockEndUtc      DateTime            // endUtc + bufferAfter at booking time
  status           String              // 'confirmed' | 'cancelled'
  icsUid           String   @unique    // stable across reschedules, e.g. "<id>@bookline"
  icsSequence      Int                 // starts 0, +1 per reschedule or cancel
  cancelledAt      DateTime?
  cancelReason     String?
  cancelledBy      String?             // 'invitee' | 'host'
  reminderSentAt   DateTime?           // claim marker for the reminder job
  createdAt / updatedAt
}
```

Raw SQL carried in the initial migration (Prisma DSL cannot express it):

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking" ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    "hostId" WITH =,
    tstzrange("blockStartUtc", "blockEndUtc") WITH &&
  ) WHERE (status = 'confirmed');
```

Notes:

- Buffers are frozen into `blockStartUtc`/`blockEndUtc` at booking time so later event-type edits
  never silently change what an existing booking occupies. The constraint compares block ranges on
  both sides, so "no overlap" already means "buffers respected".
- Rescheduling updates the four time columns on the same row inside a transaction; the exclusion
  constraint re-checks automatically. Cancelled rows leave the constraint's scope, freeing the slot.
- `status` stays a plain string with a CHECK constraint in the migration rather than an enum, to
  keep future states a migration away.

## The slot engine (`lib/slots/`)

The one algorithm the whole product hangs on. Pure functions; no I/O — callers pass rules,
overrides, blackouts, and existing block ranges in.

Inputs: event type (duration, buffers, notice, horizon), host timezone, visitor timezone, the
visitor-local date (or month) requested, weekly rules, overrides, blackouts, confirmed bookings'
block ranges, and `now`.

1. **Resolve candidate host-local dates.** A visitor-local date can intersect up to two host-local
   dates, and midnight-crossing windows spill from the previous day, so scan host-local dates from
   one day before to one day after the requested visitor-local range.
2. **Resolve windows per host-local date.** Blackout -> no windows. Any override rows for the date
   -> exactly those windows. Otherwise -> weekly rules for that weekday. A window with
   `endMinute <= startMinute` ends on the following host-local day.
3. **Project wall times to UTC.** For each window, build the start instant with Luxon from
   (date, minutes, host zone) and step candidate starts every `durationMin`. DST policy:
   - **Skipped local times (spring forward):** a candidate whose wall time does not exist is
     dropped. Detection: construct the DateTime, convert back to wall clock; if it does not
     round-trip, the local time was skipped.
   - **Repeated local times (fall back):** Luxon resolves ambiguous wall times to the earlier
     offset; each wall time therefore produces exactly one slot and no duplicates. The extra real
     hour has no wall-clock label of its own and is deliberately not offered.
   - Window ends are projected the same way, so a window spanning the transition shrinks or grows
     by real elapsed time exactly as the wall clock does.
4. **Filter candidates.** Keep a candidate iff: `[start, start+duration)` fits inside the window;
   `start >= now + minNoticeMin`; the start's host-local date is within `maxDaysAhead` of today
   (host-local); and `[start-bufferBefore, start+duration+bufferAfter)` overlaps no existing
   confirmed block range.
5. **Bucket by visitor-local date** and return slots as UTC ISO instants; the client formats them.

Booking re-runs steps 2–4 for the submitted instant inside the transaction (friendly validation),
and the exclusion constraint remains the authority under concurrency.

## Where state lives

- **PostgreSQL** — the single source of truth: host, event types, availability, bookings, reminder
  claims, ics sequence numbers. Every schema change is a Prisma migration; applied migrations are
  never edited.
- **Server, per request** — slot generation output; never cached across requests (correctness over
  caching for v1 — availability must reflect bookings instantly).
- **Session cookie** — Auth.js JWT for the host; no server session table.
- **Client, ephemeral only** — selected month/day/slot, chosen timezone override, form fields,
  toast state. Plain React state; no client state library and nothing persisted in the browser.
- **Emails/tokens** — manage tokens are stateless HMAC values; nothing stored beyond the booking
  row itself.

## External dependencies

- PostgreSQL 16 and Mailpit, both provided by `docker-compose.yml` for local dev.
- An SMTP relay in production (any provider; only standard SMTP env vars are consumed).
- No third-party APIs, no OAuth providers, no CDNs.

### Required environment variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Server-only | Postgres connection string for Prisma |
| `AUTH_SECRET` | Server-only | Auth.js JWT/session signing secret |
| `LINK_TOKEN_SECRET` | Server-only | HMAC key for manage-link tokens (independent of AUTH_SECRET so either can rotate alone) |
| `APP_BASE_URL` | Server-only | Absolute base URL used in emails and feed links |
| `SMTP_HOST` / `SMTP_PORT` | Server-only | SMTP relay (Mailpit: `localhost` / `1025` in dev) |
| `SMTP_USER` / `SMTP_PASS` | Server-only | SMTP auth; empty for Mailpit |
| `MAIL_FROM` | Server-only | From header, e.g. `Bookline <bookings@example.com>` |
| `SEED_HOST_EMAIL` / `SEED_HOST_PASSWORD` | Server-only | Initial host credentials, consumed by `prisma/seed.ts` only |
| `SEED_HOST_NAME` / `SEED_HOST_TIMEZONE` | Server-only | Initial host profile, seed only |

All env access goes through `lib/env.ts`; nothing here carries a `NEXT_PUBLIC_` prefix. See
`.env.example` for dummies.
