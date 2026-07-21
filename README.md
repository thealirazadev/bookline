# bookline

[![CI](https://github.com/thealirazadev/bookline/actions/workflows/ci.yml/badge.svg)](https://github.com/thealirazadev/bookline/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An appointment booking app for a single host (freelancer, consultant, barber). The host defines
event types (duration, buffers, notice rules) and weekly availability with date overrides, then
shares a public booking page. Visitors see open slots in their own timezone, book with name and
email, and both sides get confirmation emails with a calendar invite; cancel and reschedule work
through signed links, and an iCal feed lets external calendars subscribe.

Status: in development

## Stack

- Next.js 15 (App Router) + TypeScript
- PostgreSQL + Prisma (migrations, exclusion constraint for double-booking prevention)
- Luxon for timezone and DST-correct slot math
- Auth.js (next-auth) credentials login for the single host account
- Nodemailer over SMTP (Mailpit as the dev mailbox), hand-rolled RFC 5545 .ics writer
- Tailwind CSS, Vitest + Playwright, ESLint + Prettier

See `docs/` for the PRD, architecture, API contracts, phases, and rules.

## Design decisions

The trade-offs the correctness of this app hangs on, and the alternatives that were rejected. Full
rationale lives in `docs/architecture.md` and `docs/memory.md`.

- **All instants stored in UTC; availability rules stored in the host's IANA timezone.** Bookings
  are `timestamptz` in UTC; weekly rules, overrides, and blackouts are minutes-of-day integers
  interpreted in the host's zone and projected to UTC per date. Storing wall-clock times would make
  every query DST-ambiguous; storing only UTC would lose the host's intent ("I work 9–5 local") the
  moment their offset changes. Keeping both, with UTC as the single source of truth, is what makes
  the slot math correct across transitions.
- **Fall-back DST policy: the repeated hour is offered once, at the earlier offset.** When the clocks
  go back, a wall-clock hour occurs twice. Luxon resolves an ambiguous local time to the earlier
  offset, so each wall time yields exactly one slot and the engine emits no duplicate instants. The
  extra real hour has no distinct wall-clock label and is deliberately not bookable. (Spring forward:
  a wall time that does not exist is detected by a failed round-trip and dropped.)
- **Double-booking is prevented by a database exclusion constraint, not application code.** A
  Postgres `EXCLUDE USING gist (hostId WITH =, tstzrange(blockStartUtc, blockEndUtc) WITH &&) WHERE
  (status = 'confirmed')` (via `btree_gist`) is the authority. The application re-runs the slot
  engine before inserting only to produce friendly errors; correctness under concurrency must never
  depend on that check winning a race. Rejected: application-level "is this slot free?" checking,
  which is a time-of-check/time-of-use bug under load. This is also why Postgres is required and
  SQLite/MySQL are not an option — neither can express the constraint.
- **A read-only iCal feed is the v1 calendar-interop story, not two-way OAuth sync.** Hosts subscribe
  an external calendar to a per-host, token-authed `text/calendar` feed. Rejected for v1: two-way
  Google/Outlook OAuth calendar sync — far more integration surface, token lifecycle, and provider
  coupling than a single-host tool needs. The feed delivers the "my bookings show up in my calendar"
  outcome with none of that.
- **Luxon for all timezone math, over date-fns-tz and the Temporal polyfill.** Luxon uses the
  platform's Intl IANA data (no bundled tz database), is immutable, and has documented DST
  disambiguation semantics the engine's skip/earlier-offset policy is built on. date-fns-tz has a
  clunkier wall-time→instant API; the Temporal polyfill is attractive but heavy and not yet boring.
- **A hand-rolled RFC 5545 .ics writer, no dependency.** METHOD (REQUEST/CANCEL), a stable UID
  across reschedules, and a correctly incremented SEQUENCE have to be exactly right for invites to
  update in place instead of duplicating. The popular `ics` package handles METHOD/SEQUENCE
  awkwardly; the needed subset (VCALENDAR/VEVENT, UTC times, 75-octet folding, TEXT escaping, CRLF)
  is ~130 fully unit-tested lines.
- **The reminder scheduler runs in-process and assumes one long-running server.** `instrumentation.ts`
  starts a 60-second loop that claims due reminders with a single atomic
  `UPDATE ... WHERE reminderSentAt IS NULL`, so a double fire is harmless. Trade-off: this assumes a
  single always-on process. A serverless or multi-instance deploy would instead hit
  `npm run reminders:once` from an external cron — supported, and the documented path for that shape.

## Requirements

- Node.js 20+ (developed on 24)
- Docker (for Postgres 16 and Mailpit)

## Install

```bash
cp .env.example .env        # then set AUTH_SECRET and LINK_TOKEN_SECRET
npm install
```

Generate the two secrets with `openssl rand -base64 32` and keep `LINK_TOKEN_SECRET`
distinct from `AUTH_SECRET`.

## Run

Bring up Postgres 16 and Mailpit, apply migrations, seed, then start the app:

```bash
docker compose up -d        # Postgres on 5432, Mailpit SMTP 1025 / UI 8025
npx prisma migrate deploy   # or: npx prisma migrate dev
npm run db:seed             # host + example event type from SEED_HOST_*
npm run dev                 # http://localhost:3000
```

If host port 5432 is already in use, publish Postgres on another port and point
`DATABASE_URL` at it, for example:

```bash
docker run -d --name bookline-postgres \
  -e POSTGRES_USER=bookline -e POSTGRES_PASSWORD=bookline -e POSTGRES_DB=bookline \
  -p 5433:5432 postgres:16
# then set DATABASE_URL=postgresql://bookline:bookline@localhost:5433/bookline
```

The double-booking guarantee relies on a PostgreSQL `btree_gist` exclusion
constraint, so a real Postgres (not SQLite) is required.

## Test

```bash
npm run lint                # ESLint
npm run test                # Vitest unit + component (no DB required)
npm run test:integration    # Vitest DB-backed suite (requires the compose stack)
npm run test:e2e            # Playwright smoke test (requires the compose stack)
npm run build               # production build
```

## License

MIT
