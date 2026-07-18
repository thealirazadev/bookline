# Launch checklist: bookline

Status as of 2026-07-18, verified against a local production-like build (`next build` +
`next start`, Postgres 16 and Mailpit via Docker). Items tied to the production host, a real SMTP
relay, HTTPS, and real calendar apps remain open for the deploy step.

## Environment and configuration
- [ ] Production env vars set on the host: `DATABASE_URL`, `AUTH_SECRET`, `LINK_TOKEN_SECRET`,
      `APP_BASE_URL`, `SMTP_*`, `MAIL_FROM` (seed vars only needed for first boot). _(deploy step)_
- [ ] `AUTH_SECRET` and `LINK_TOKEN_SECRET` are distinct, strong, and not the dummy values.
      _(deploy step; `.env.example` keeps them distinct with placeholder values)_
- [x] `.env` / real secrets not committed; `.env.example` current with dummies only. (`.env` is
      gitignored; `lib/env.ts` validates all runtime vars at startup.)
- [x] Production database migrated (`prisma migrate deploy`); `booking_no_overlap` constraint
      present (check `pg_constraint`). (Verified: constraint + `btree_gist` present after a clean
      migrate deploy on an empty schema.)
- [ ] Seed run once; seed credentials rotated or removed from the environment afterwards.
      _(deploy step; seed is idempotent and refuses an invalid IANA timezone.)_
- [x] Debug/verbose logging off in production; structured logs only, redaction verified.
      (`lib/logger.ts` emits JSON only; emails logged as `f***@example.com`, no tokens/hashes.)

## Security
- [x] All `/dashboard` and host API routes reject unauthenticated requests (spot-check with curl).
      (Verified: `/dashboard` -> 307 `/login`; `/api/event-types`, `/api/host/*` -> 401 JSON.)
- [x] Manage token tampering returns the friendly invalid-link page; nothing sensitive in the
      response. (Verified: tampered token -> 404 `TOKEN_INVALID`; manage page shows "This link
      isn't valid".)
- [x] No secrets, tokens, or full email addresses in server logs. (Logger redacts; tokens never
      logged.)
- [x] SMTP credentials and DB URL absent from client bundles (grep the build output). (0 matches
      across `.next/static`.)
- [ ] HTTPS enforced at the proxy/host; `APP_BASE_URL` is https. _(deploy step)_

## Correctness spot-checks
- [x] Book a slot from a timezone different from the host's; times correct on both sides. (Verified
      via curl with a Berlin host and LA/Tokyo visitors; DST unit tests cover the edges.)
- [x] Double-booking race re-tested against Postgres (two rapid submissions). (Integration test
      `simultaneous-booking-single-winner`: one 201, one 409, one confirmed row.)
- [ ] .ics from a production email imports into Google Calendar, Apple Calendar, and Outlook.
      _(needs real calendar apps; writer output validated by unit tests and Mailpit inspection.)_
- [x] Reschedule updates (not duplicates) the calendar event; cancel removes it. (Verified: same
      UID, SEQUENCE increments; CANCEL uses METHOD:CANCEL with the same UID.)
- [x] iCal feed lists confirmed bookings and drops cancelled ones; token-less URL 404s. (Verified
      via the feed endpoint; subscribing from a real calendar app is a deploy-time check.)
- [x] Reminder email arrives at the configured lead time, exactly once. (Verified with
      `reminders:once`; idempotency proven by concurrent-run integration test.)

## Email
- [ ] Production SMTP relay configured; SPF/DKIM aligned for `MAIL_FROM`'s domain. _(deploy step)_
- [x] Confirmation, cancellation, reschedule, and reminder emails render correctly (text + HTML).
      (Verified in Mailpit; user text HTML-escaped, times in the invitee's timezone, manage link
      present; rendering in a real client is a deploy-time check.)
- [x] SMTP outage path verified: booking stored, `emailStatus: "pending"`, warning logged. (Mailer
      never throws; a failed send returns pending and logs a warn.)

## UX states
- [x] Loading skeletons on month grid, slot list, dashboard tables. (Month grid + slot list
      skeletons; `app/dashboard/loading.tsx` and `app/book/loading.tsx`.)
- [x] Empty states: no slots on a day, no availability at all, no upcoming/past bookings, no
      event types. (All present via the shared `EmptyState`.)
- [x] Custom 404 and error pages exist and are styled. (`app/not-found.tsx`, `app/error.tsx`.)
- [x] SLOT_TAKEN flow shows the toast and refreshed slots. (Verified: 409 swaps the slot list and
      shows the toast.)
- [x] Long names/reasons/descriptions do not break layout or emails. (Names HTML-escaped in email;
      table cells wrap; reason/description length-capped.)

## Accessibility and cross-device
- [x] Keyboard-only booking and cancellation completed end to end. (Playwright smoke test drives
      the flow; month grid is fully keyboard operable.)
- [x] Month grid arrow-key navigation and screen-reader announcements verified. (Component test
      covers arrow/Enter nav; cells carry availability in their accessible name; `aria-live`
      regions announce timezone and slot changes.)
- [ ] Contrast passes AA in both themes; `prefers-reduced-motion` respected. (`prefers-reduced-
      motion` handled in `globals.css` + `motion-reduce:` utilities; contrast uses the design
      tokens but a formal audit is still open.)
- [x] Mobile layout checked (single-column booking page, stacked dashboard cards, 44px targets).
      (Responsive classes; dashboard table collapses to cards; 44px control heights.)

## Final
- [x] `npm run build`, `lint`, `test`, `test:integration`, `test:e2e` all pass on the release
      commit.
- [x] All phase verification checklists in `docs/phases.md` complete.
- [x] `docs/memory.md` up to date (Completed / Decisions).
