# Contributing to bookline

Thanks for taking the time to contribute. bookline is a self-hosted, single-host appointment
booking app (Next.js App Router, TypeScript, Prisma, PostgreSQL). This guide covers getting the
project running locally and the checks a change must pass before it can merge.

By participating you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Prerequisites

- Node.js 24 (the version CI runs).
- Docker, for the PostgreSQL 16 and Mailpit containers.

The slot engine relies on the platform IANA timezone database via Luxon, and the concurrency
guarantee relies on a PostgreSQL exclusion constraint, so the tests need a real Postgres 16 — an
in-memory or SQLite substitute will not exercise the behavior that matters.

## Local setup

```bash
# 1. Start Postgres 16 (port 5432) and Mailpit (SMTP 1025, web UI 8025).
docker compose up -d

# 2. Install exact, pinned dependencies.
npm ci

# 3. Copy the environment template and adjust if needed.
cp .env.example .env

# 4. Apply migrations. This creates the btree_gist extension and the
#    booking_no_overlap exclusion constraint the concurrency tests depend on.
npx prisma migrate deploy

# 5. Seed the single host account and an example event type.
npm run db:seed

# 6. Run the app.
npm run dev
```

If Docker Compose is unavailable, an equivalent `docker run` for `postgres:16` exposing port 5432
with the `bookline`/`bookline`/`bookline` user/password/database works too; keep `DATABASE_URL` in
`.env` pointed at whatever host port you publish.

Mailpit captures all outgoing mail — open http://localhost:8025 to read confirmation, reminder, and
cancellation emails, including their `.ics` attachments.

## The checks a change must pass

Run these locally before opening a pull request. CI runs the same gates (see
`.github/workflows/ci.yml`) against Node 24 with a `postgres:16` service container, and the branch
must stay green.

```bash
npm run typecheck        # tsc --noEmit, strict mode
npm run lint             # ESLint (next/core-web-vitals)
npm run test             # Vitest unit + component; no database required
npm run test:integration # Vitest against real Postgres; requires the compose stack
npm run build            # next build (production)
```

`npm run test:integration` must pass for any change touching bookings, availability writes, the ics
pipeline, or reminders — that is where the database-enforced guarantees
(`simultaneous-booking-single-winner`, exclusion-constraint semantics, reminder idempotency) are
verified. If the integration suite cannot find a database, start the compose stack first and re-run
`npx prisma migrate deploy`.

The Playwright end-to-end smoke test (`npm run test:e2e`) is a local-only check: it needs a browser
download plus a booted `next start` and a live Mailpit inbox, so it is intentionally not part of CI.
Run it against the compose stack when you touch the end-to-end booking flow.

## Conventions

These are enforced in review; `docs/rules.md` is the full contract.

- **Dates and times** go through Luxon in `lib/slots/` and `lib/ics/` — never raw `Date`
  arithmetic, `getTimezoneOffset`, or string slicing. Timestamps are stored in UTC, availability
  rules live in the host's IANA zone, and rendering uses the visitor's zone.
- **Database access** goes through Prisma (`lib/db.ts`). Every schema change is a new migration
  file; applied migrations are never edited afterward, including the raw-SQL exclusion constraint.
- **Route handlers** validate input with the Zod schemas in `lib/validation/` and return errors only
  through `lib/errors.ts`, which produces the single `{ "error": { "code", "message", "fields?" } }`
  response shape. Never leak a stack trace, SQL, or token material to a client.
- **Booking writes** happen inside a transaction where the exclusion constraint is the authority for
  conflicts; handle the `23P01` violation path rather than checking-then-inserting.
- **No new dependency** without discussing it first, and versions are pinned exactly (no `^`/`~`);
  commit `package-lock.json` with any dependency change.
- **TypeScript strict**, explicit return types on exported functions, no `any` in domain code.
- **Commits** follow Conventional Commits with a short, imperative, lower-case subject
  (`feat(slots): project weekly rules to utc instants`). One discrete change per commit; do not
  bundle a whole feature into one. No emoji, and no AI/attribution trailers anywhere.

## Pull requests

- Keep the PR focused on one change and describe what it does and why.
- Fill in the pull request template, including which gates you ran.
- Confirm `typecheck`, `lint`, `test`, `test:integration`, and `build` all pass locally.
- Add or extend tests for behavior you change — the slot engine, ics writer, and the DB-enforced
  booking/reminder paths are the highest-value targets (`docs/testing.md`).
- If a change alters the database schema, include the migration and note it in the PR.
- Never modify `docs/PRD.md` or `docs/architecture.md` without flagging it — they are the contract.

Security issues should be reported privately, not as a pull request or public issue — see
[SECURITY.md](./SECURITY.md).
