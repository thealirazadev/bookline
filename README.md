# bookline

An appointment booking app for a single host (freelancer, consultant, barber). The host defines
event types (duration, buffers, notice rules) and weekly availability with date overrides, then
shares a public booking page. Visitors see open slots in their own timezone, book with name and
email, and both sides get confirmation emails with a calendar invite; cancel and reschedule work
through signed links, and an iCal feed lets external calendars subscribe.

Status: planning — docs under review

## Planned stack

- Next.js 15 (App Router) + TypeScript
- PostgreSQL + Prisma (migrations, exclusion constraint for double-booking prevention)
- Luxon for timezone and DST-correct slot math
- Auth.js (next-auth) credentials login for the single host account
- Nodemailer over SMTP (Mailpit as the dev mailbox), hand-rolled RFC 5545 .ics writer
- Tailwind CSS, Vitest + Playwright, ESLint + Prettier

See `docs/` for the PRD, architecture, API contracts, phases, and rules.

## Install

TBD until implementation starts.

## Run

TBD until implementation starts.

## Test

TBD until implementation starts.

## License

MIT
