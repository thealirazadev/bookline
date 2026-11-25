# Design decisions

The engineering choices bookline's correctness depends on, why each was made, and the bugs and
edge cases that shaped them. `docs/architecture.md` describes the system as a whole; this page
explains the reasoning behind the parts most likely to be questioned.

## 1. One host, email only, deliberately narrow scope

bookline serves exactly one host account (seeded, no self-signup) and visitors who never create an
account. It is email only, with no payments, teams or round-robin scheduling, two-way
Google/Outlook OAuth sync, SMS or push, recurring appointments, or localization. The read-only iCal
feed is the calendar-interop story instead of OAuth sync, because it delivers "my bookings show up
in my calendar" without token lifecycles or provider coupling. There is no rate limiting or CAPTCHA
on the public booking form; that is an accepted gap for a single-host deploy, not an oversight.
Keeping the scope this tight is what lets one process, one database and one in-process scheduler
be enough.

## 2. Instants in UTC, availability rules in the host's IANA zone

Booking times are `timestamptz` columns in UTC. Weekly rules, overrides and blackouts are stored
as minutes of the day interpreted in the host's timezone and projected to UTC per date when slots
are generated; the visitor's zone is used only for rendering and day bucketing. Storing wall-clock
booking times would make every query DST-ambiguous, while storing only UTC rules would lose the
host's intent ("9 to 5 local") the moment their offset changes. Column names carry their unit and
frame (`durationMin`, `startMinute`, `startUtc`, `blockEndUtc`) so the frame is never guessed. All
date math goes through Luxon, chosen over date-fns-tz and the Temporal polyfill because it uses the
platform's IANA data and has well-defined behavior for nonexistent and repeated local times.

## 3. DST and midnight-crossing windows are handled explicitly in the engine

`lib/slots/engine.ts` is a pure function with fixed inputs, which is what makes the edge cases
testable. On a spring-forward night a nonexistent wall time is detected by a failed round trip
(Luxon shifts it forward, so the requested hour and minute do not come back) and produces no slot.
A candidate whose real end runs past the window's real end instant is also dropped, because a
window loses an hour of elapsed time across the gap. On a fall-back night each repeated wall time
yields one slot at the earlier offset; Luxon leaves that choice to the runtime's Intl data, so
`earliestInstant` makes it explicitly and the engine never emits duplicate instants. The extra hour
has no distinct wall-clock label and is not bookable. A window whose end is at or before its start
crosses midnight: its end is extended by 1440 minutes and its slots belong to the weekday the
window starts on. The availability validator applies the same extension, so overlap checks catch a
22:00 to 02:00 window colliding with an early-morning one. Because a visitor's date can intersect
two host dates, the engine scans one extra host day on each side before filtering by the
visitor's local date.

## 4. The engine guards a non-positive duration itself

A `durationMin` of 0 or less made the candidate loop step by zero or a negative amount and never
terminate, hanging every request that touched slots. The event-type schema already rejects it, but
the engine is a standalone function with its own callers (the booking routes, the benchmark
script), so `generateSlots` returns an empty list for a non-positive duration. A regression test
hangs without the guard.

## 5. A Postgres exclusion constraint is the double-booking authority

The initial migration enables `btree_gist` and adds `booking_no_overlap`:
`EXCLUDE USING gist ("hostId" WITH =, tstzrange("blockStartUtc", "blockEndUtc") WITH &&) WHERE
(status = 'confirmed')`. Buffers are frozen into the block columns at booking time, so "no overlap"
also means "buffers respected"; ranges are half-open, so back-to-back bookings that touch are
allowed; and cancelled rows leave the constraint's scope and free their slot. An application-level
"is this slot free?" check would be a time-of-check to time-of-use race under load, so it is not
relied on, and this is also why SQLite and MySQL are not options. The typed Prisma client surfaces
the violation only as an error whose message names `23P01` or the constraint, while a raw query
exposes `meta.code`, so `isSlotConflict` in `lib/bookings/conflict.ts` checks both. Status values
are a `CHECK` constraint rather than an enum, so adding a state is a migration away.

## 6. Re-validation ignores existing bookings, so a race reports 409, not 422

Before inserting, `createBooking` re-runs the engine for the requested instant to enforce notice,
horizon and availability windows, rather than trusting the client's slot list. It does this with
`blocks: []`, excluding existing bookings on purpose. A slot that another visitor just took
therefore still reaches the insert, is rejected by the constraint, and comes back as 409
`SLOT_TAKEN` with refreshed slots for that day. A real rule violation is 422 `SLOT_UNAVAILABLE`.
Without this split a lost race would be misreported as "outside availability". Reschedule follows
the same path and excludes the booking's own block so its current time stays selectable.

## 7. Cancel and reschedule are guarded updates, not read then update

Both transitions originally read the booking's status and then updated it by id alone. A cancel
committing in between let a reschedule move and re-invite a cancelled booking, and let two cancels
both send emails. Each transition is now a single `update` whose `where` restates what was read:
`{ id, status: "confirmed", startUtc: { gt: now } }`. Under READ COMMITTED, Postgres re-evaluates
that predicate against the latest committed row, so the losing transition matches nothing and
Prisma raises P2025, which `isRecordNotFound` maps to 410 `BOOKING_NOT_ACTIONABLE`. A guarded
`update` was chosen over `updateMany` because it returns the row needed for the invite email
without a second, separately racy read. Integration tests force the exact interleaving by
committing a cancel inside the caller's own status read.

## 8. A hand-rolled RFC 5545 writer

`lib/ics/writer.ts` is about 130 lines and has no dependency. Invites only update in place in a
recipient's calendar when METHOD, UID and SEQUENCE are exactly right, and the common `ics` package
makes METHOD and SEQUENCE awkward to control. Each booking gets one UID at creation; every
reschedule increments `icsSequence` and sends METHOD:REQUEST, and a cancellation sends
METHOD:CANCEL with the same UID and a higher sequence. Lines use CRLF and are folded at 75 octets
by iterating code points, so a multi-byte character (including 4-byte emoji) is never split. TEXT
values escape backslash, semicolon, comma and newlines; parameter values such as `CN` cannot be
escaped, so quotes and newlines are stripped and the value is quoted when it contains `,`, `;` or
`:`.

## 9. Unguessable links instead of accounts

Visitors manage a booking through a stateless HMAC-SHA256 token, `base64url(bookingId).signature`,
signed with `LINK_TOKEN_SECRET`. Nothing is stored, so there is nothing to rotate or expire
separately: the token's usefulness ends with the booking's status and start time. Verification
rejects non-canonical base64url encodings that decode to the same id, checks the signature length,
and compares with `timingSafeEqual`. A bad token is 404 `TOKEN_INVALID`, indistinguishable from a
missing booking. The host's iCal feed uses a 256-bit random `feedToken` generated at seed time; a
miss returns a bare 404 and the feed is served with `Cache-Control: no-store`. `LINK_TOKEN_SECRET`
is kept separate from `AUTH_SECRET` so either can be rotated alone.

## 10. An email failure never undoes a booking

`sendMail` in `lib/email/mailer.ts` catches every transport error, logs it with the address
redacted, and returns `false`. A booking that is already committed stands, the response reports
`emailStatus: "pending"`, and a warning is logged. Throwing would turn an SMTP outage into a 500
for a booking that actually exists. This is also why CI needs no SMTP server: the DB-backed suites
run against a dead SMTP port and take the pending path.

## 11. Reminders are claimed atomically before they are sent

`runReminders` claims due bookings with one statement,
`UPDATE "Booking" SET "reminderSentAt" = now ... WHERE "reminderSentAt" IS NULL AND status =
'confirmed' ... RETURNING id`, joined to the event type's lead time. Two concurrent runs, or a
double fire, can never claim the same booking, so a reminder is sent at most once. If a send fails,
the claim is released (`reminderSentAt` set back to NULL) so the next tick retries a transient
outage. The trade-off is that a crash between claim and send loses that reminder rather than
duplicating it. The loop runs every 60 seconds inside the server via `instrumentation.ts` and skips
a tick while the previous one is still running; this assumes one long-running process, and
`npm run reminders:once` is the entry point for an external cron in a serverless or multi-instance
deploy.

## 12. Intake answers are snapshotted onto the booking

Each `IntakeAnswer` stores the question's label and display order at booking time, plus a nullable
`questionId` with `ON DELETE SET NULL`. A booking is a historical record, so its detail page,
email and invite must read exactly as the invitee answered even after the host edits or removes
the question; rendering by joining to the live questions would silently rewrite or drop that
history. Editing an event type's questions is a delete-and-recreate inside a transaction, which the
`SET NULL` survives. Per-answer rules (required, single-choice membership, 200 and 2000 character
caps) depend on the event type's questions, so they run in `createBooking` at request time and
return 400 with `answers.<questionId>` field keys; the wire schema keeps only a blunt length
ceiling as a safety net.

## 13. Dependency conflicts are resolved with scoped overrides

`@auth/core` declares an optional peer on an older nodemailer for its Email provider, which
bookline does not use (credentials login, its own mailer). Rather than setting
`legacy-peer-deps=true` repo-wide, `package.json` overrides nodemailer only under `next-auth`, so
the one deliberate deviation is stated and peer checking stays on everywhere else. Next pins
`postcss` and `sharp` to versions with published advisories, and no Next upgrade clears them, so
both are overridden under `next`. npm applies a new override only on a full re-resolve of the
lockfile, not on a plain `npm install` over an existing one. Auth.js also needs `trustHost: true`
for a self-hosted `next start` deploy, or every `/api/auth/*` call fails with UntrustedHost.
