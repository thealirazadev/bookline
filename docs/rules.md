# Rules: bookline

Binding for anyone implementing this project. When a rule and a request conflict, flag it instead
of silently diverging (see Boundaries).

## Conventions

### Libraries and patterns
- **Next.js App Router**, server components by default; `"use client"` only where interactivity or
  browser APIs (timezone detection, form state) require it.
- **All date/time math goes through Luxon** in `lib/slots/` and `lib/ics/`. Never use raw `Date`
  arithmetic, `getTimezoneOffset`, or string slicing on ISO dates for logic. UTC in the database,
  host-IANA-zone for rules, visitor-IANA-zone for rendering — no exceptions, no local-time storage.
- **All DB access goes through Prisma** via `lib/db.ts`. Raw SQL is allowed only inside migration
  files (exclusion constraint, extension) and, if unavoidable, `$queryRaw` with parameters in a
  clearly commented spot.
- **Every route handler validates its input with the Zod schemas in `lib/validation/`** before
  touching the DB, and produces errors only via `lib/errors.ts`.
- Booking writes happen inside a transaction; the exclusion constraint is the authority for slot
  conflicts. Never "check then insert" without handling the constraint violation path.
- .ics output goes through `lib/ics/writer.ts` only; no inline calendar strings in templates.
- Email goes through `lib/email/mailer.ts` only; a failed send is logged and surfaced, never thrown
  through a route into a 500 after the booking is already stored.
- Styling is Tailwind with the tokens in `tailwind.config.ts`; no inline styles except truly
  dynamic values, no CSS-in-JS.

### What to avoid
- No `Date`-based timezone math, no `moment`, no second date library.
- No caching of generated slots across requests in v1.
- No client-side state library; plain React state only.
- No API routes that duplicate what a server component already reads, and no server component that
  performs writes — writes go through the documented routes.
- No `any` in domain code; engine and ics inputs/outputs are fully typed.
- No unpinned or `^`/`~` dependency ranges; no dead code or speculative abstractions.

### Naming
- Components `PascalCase.tsx` (`MonthGrid.tsx`); non-component modules `camelCase.ts`
  (`engine.ts`, `tokens.ts`); route folders follow Next conventions.
- Functions are descriptive verbs: `generateSlots`, `buildInviteIcs`, `verifyManageToken`.
- Types/interfaces `PascalCase` (`Slot`, `BookingInput`); constants `UPPER_SNAKE_CASE`.
- DB fields carry their unit and reference frame in the name: `durationMin`, `startMinute`
  (host-local wall minutes), `startUtc`, `blockEndUtc`. Never a bare `time` or `date` column.
- Error codes `UPPER_SNAKE_CASE` (`SLOT_TAKEN`), stable once published in `api-contracts.md`.

### Commit format
- Conventional Commits, short imperative subject, no trailing period, <= 72 chars:
  `feat(slots): project weekly rules to utc instants`.
- Allowed types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `style`, `build`, `ci`.
- **One commit per feature/task**, in the order listed per phase in `docs/phases.md`. Never batch.

### Dependencies and schema
- Pin exact versions in `package.json`; commit `package-lock.json` with every dependency change.
- Adding, removing, or upgrading any dependency requires owner approval first.
- **Never modify the database schema directly.** Every schema change is a Prisma migration file;
  applied migrations are never edited afterward — fixes are new migrations. This includes the raw
  SQL constraint: changing it means a new migration that drops and recreates it.

## Error handling and logging

- Every external call — Postgres via Prisma, SMTP via Nodemailer, any file I/O — handles failure
  explicitly. No bare call that assumes success.
- **One error response format everywhere** (defined in `docs/api-contracts.md`, produced by
  `lib/errors.ts`): `{ "error": { "code", "message", "fields?" } }`. Route handlers never leak raw
  Prisma/Zod/SMTP errors or stack traces to the client.
- Specific mappings that must exist:
  - Exclusion-constraint violation (Postgres `23P01`) -> 409 `SLOT_TAKEN` with refreshed slots.
  - Zod failure -> 400 `VALIDATION_ERROR` with per-field messages.
  - Bad/tampered manage token -> 404 `TOKEN_INVALID` (indistinguishable from missing, on purpose).
  - SMTP failure after a stored booking -> booking stands, `warn` log, response notes email pending.
- User-facing copy is friendly and generic; server logs carry the detail. Never show a stack trace,
  SQL, or token material to a user.
- **Structured logging from day one** via `lib/logger.ts`: JSON entries
  `{ level, event, bookingId?, code?, durationMs? }`. Log at boundaries (route handlers, mailer,
  reminder job), not scattered `console.log`. Redact emails to `f***@example.com` form and never
  log tokens, password hashes, or SMTP credentials.

## Security

- No hardcoded secrets. Everything sensitive lives in `.env` (see `.env.example`, kept current with
  dummy values); access only through `lib/env.ts`; nothing secret gets a `NEXT_PUBLIC_` prefix.
- **Validate all input server-side** with Zod: bodies, query params, route params. Timezone strings
  are validated as real IANA zones (probe with Luxon) — never trusted into date math raw. Booking
  start instants are validated by re-running the engine, not by trusting the client's slot list.
- Sanitize/escape everything user-entered when rendered: invitee name and cancel reason in emails
  and dashboard (React escapes by default — no `dangerouslySetInnerHTML` for user input, and email
  templates escape into HTML explicitly). .ics TEXT values are escaped per RFC 5545.
- Parameterized queries only (Prisma; any raw SQL uses bound parameters).
- Passwords: bcrypt-hashed, never logged; login failures return one generic message.
- Manage tokens: HMAC-SHA256 with `LINK_TOKEN_SECRET`, compared with `timingSafeEqual`; a token
  grants access to exactly one booking's manage actions and dies with the booking's status.
- **Access matrix (enforced in `middleware.ts` + per-route session checks):**
  - Public, no auth: `/book*`, `/manage/[token]*`, `GET /api/availability`, `GET /api/slots`,
    `POST /api/bookings`, `/api/manage/*`, `GET /api/ical/[feedToken]`.
  - Host session required: `/dashboard*`, `/api/event-types*`, `/api/host/*`.
  - The iCal feed authenticates by unguessable `feedToken` only; a wrong token is a plain 404.

## Simplicity (YAGNI / KISS)

- Build only what the current phase in `docs/phases.md` requires. No speculative features, no
  config options or flags not needed today.
- Prefer the boring, direct solution over the clever or "scalable" one. One host, one process, one
  database.
- No abstraction until three real, existing use cases demand it. No new wrapper classes,
  factories, managers, or utils files without owner approval first.
- Before submitting, self-review: "fewer lines without hurting readability?" If yes, rewrite first.
- If a solution exceeds ~150 lines, pause and justify it before continuing. (The slot engine and
  ics writer are expected to be the only justified cases.)
- Use built-ins and existing approved libraries instead of reimplementing: `crypto` for HMAC and
  random tokens, Luxon for tz math, Prisma for SQL.

## Code style — no AI fingerprints

- Never mention AI, assistants, or any model/tool names in code, comments, commit messages,
  docstrings, or docs. No "Generated by" or "Co-authored-by" attribution lines in commits.
- Comments are sparse and explain non-obvious logic only — the DST round-trip check and the
  claim-before-send reminder update deserve comments; a `getBookings` call does not.
- Concise docstrings on non-obvious exported functions; no boilerplate.
- No emoji anywhere in code, comments, docs, or commit messages.
- TypeScript strict mode; explicit return types on exported functions; ESLint + Prettier clean.

## Boundaries — never without asking the owner first

- Never delete or rewrite a file wholesale; targeted edits only, and flag destructive changes first.
- Never modify `docs/PRD.md` or `docs/architecture.md` without flagging it — they are the contract.
- Never add a dependency without approval (what, why, size, alternative — then wait).
- If a task is ambiguous or two docs disagree, ask instead of assuming.
- Stop after two failed fix attempts on the same problem; report what was tried, the errors, and a
  proposed next step instead of churning.
- Mid-phase requests not in `docs/PRD.md`: ask whether to (a) add to the current phase, (b) create
  a new phase, or (c) log to the Backlog in `docs/phases.md`. Never silently absorb scope.
