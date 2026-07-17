# bookline

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
