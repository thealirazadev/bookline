# Launch checklist: bookline

Fill near the end of implementation. Nothing is checked until verified against a production-like
build. Adapt notes inline as items are verified.

## Environment and configuration
- [ ] Production env vars set on the host: `DATABASE_URL`, `AUTH_SECRET`, `LINK_TOKEN_SECRET`,
      `APP_BASE_URL`, `SMTP_*`, `MAIL_FROM` (seed vars only needed for first boot).
- [ ] `AUTH_SECRET` and `LINK_TOKEN_SECRET` are distinct, strong, and not the dummy values.
- [ ] `.env` / real secrets not committed; `.env.example` current with dummies only.
- [ ] Production database migrated (`prisma migrate deploy`); `booking_no_overlap` constraint
      present (check `pg_constraint`).
- [ ] Seed run once; seed credentials rotated or removed from the environment afterwards.
- [ ] Debug/verbose logging off in production; structured logs only, redaction verified.

## Security
- [ ] All `/dashboard` and host API routes reject unauthenticated requests (spot-check with curl).
- [ ] Manage token tampering returns the friendly invalid-link page; nothing sensitive in the
      response.
- [ ] No secrets, tokens, or full email addresses in server logs.
- [ ] SMTP credentials and DB URL absent from client bundles (grep the build output).
- [ ] HTTPS enforced at the proxy/host; `APP_BASE_URL` is https.

## Correctness spot-checks
- [ ] Book a slot from a timezone different from the host's; times correct on both sides.
- [ ] Double-booking race re-tested against production DB (two rapid submissions).
- [ ] .ics from a production email imports into Google Calendar, Apple Calendar, and Outlook.
- [ ] Reschedule updates (not duplicates) the calendar event; cancel removes it.
- [ ] iCal feed subscribed from an external calendar over the public URL; refresh drops a
      cancelled booking.
- [ ] Reminder email arrives at the configured lead time, exactly once.

## Email
- [ ] Production SMTP relay configured; SPF/DKIM aligned for `MAIL_FROM`'s domain.
- [ ] Confirmation, cancellation, reschedule, and reminder emails render correctly (text + HTML)
      in a real client.
- [ ] SMTP outage path verified: booking stored, `emailStatus: "pending"`, warning logged.

## UX states
- [ ] Loading skeletons on month grid, slot list, dashboard tables.
- [ ] Empty states: no slots on a day, no availability at all, no upcoming/past bookings, no
      event types.
- [ ] Custom 404 and error pages exist and are styled.
- [ ] SLOT_TAKEN flow shows the toast and refreshed slots.
- [ ] Long names/reasons/descriptions do not break layout or emails.

## Accessibility and cross-device
- [ ] Keyboard-only booking and cancellation completed end to end.
- [ ] Month grid arrow-key navigation and screen-reader announcements verified.
- [ ] Contrast passes AA in both themes; `prefers-reduced-motion` respected.
- [ ] Mobile layout checked (single-column booking page, stacked dashboard cards, 44px targets).

## Final
- [ ] `npm run build`, `lint`, `test`, `test:integration`, `test:e2e` all pass on the release
      commit.
- [ ] All phase verification checklists in `docs/phases.md` complete.
- [ ] `docs/memory.md` up to date (Completed / Decisions).
