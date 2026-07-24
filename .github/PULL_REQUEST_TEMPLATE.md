## What and why

Describe the change and the problem it solves. Link any related issue (`Closes #123`).

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / internal change
- [ ] Documentation
- [ ] Build / CI / tooling

## Checklist

- [ ] The change is focused on one thing and the commits follow Conventional Commits
      (short, imperative, lower-case; no emoji; no attribution trailers).
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run test` passes (unit + component).
- [ ] `npm run test:integration` passes against Postgres 16 — required for anything touching
      bookings, availability writes, the ics pipeline, or reminders.
- [ ] `npm run build` succeeds.
- [ ] Added or updated tests for the behavior I changed (see `docs/testing.md`).
- [ ] No new dependency, or it was discussed and pinned exactly with `package-lock.json` committed.

## Database changes

- [ ] No schema change, or:
- [ ] Included a new Prisma migration (applied migrations are never edited afterward).
- [ ] `npx prisma migrate deploy` applies cleanly on a fresh database, including `btree_gist` and
      the `booking_no_overlap` exclusion constraint.

## Timezone / calendar impact

For changes to the slot engine, booking flow, or calendar output, confirm as applicable:

- [ ] Times remain UTC-in-database, host-zone for rules, visitor-zone for rendering.
- [ ] DST and midnight-crossing behavior is unchanged or covered by a test.
- [ ] `.ics` UID stays stable across reschedules and SEQUENCE increments; CANCEL uses the same UID.

## Notes for reviewers

Anything worth calling out: trade-offs, follow-ups, or manual QA performed (e.g. importing an `.ics`
into a real calendar, subscribing to the feed, keyboard-only or screen-reader checks).
