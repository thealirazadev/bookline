# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub's private vulnerability reporting:
open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public
issue, and do not include real invitee data in a report.

Useful things to include: the affected endpoint or module, the version or commit, a minimal
reproduction, and what an attacker gains. You can expect an acknowledgement within about a week.
Fixes land on `main`; there is no separate backport branch.

## Supported versions

This is a self-hosted single-host application with no released version line. Only the current
`main` branch is supported — deploy from it and keep dependencies current.

## Security model

Knowing what is and is not a boundary makes reports easier to triage.

- **Manage links are bearer tokens.** `/manage/<token>` uses a stateless
  `base64url(bookingId).HMAC-SHA256(bookingId, LINK_TOKEN_SECRET)` value, compared in constant time
  and bound to one booking id — a token for one booking cannot act on another. Anyone holding the
  link can view, reschedule, or cancel that booking, which is deliberate: invitees have no accounts.
  Actionability is derived from live state, so a cancelled or already-started booking cannot be
  changed even with a valid token. Treat the emailed link as a secret.
- **The iCal feed URL is a bearer token.** `/api/ical/<feedToken>` is authorized solely by a
  256-bit random token on the host row, and the feed contains invitee names and email addresses.
  Anyone with the URL can read the host's confirmed bookings. Unknown tokens get a bare 404. There
  is currently no self-service rotation: rotating a leaked feed token means updating the
  `Host.feedToken` column.
- **Host authentication** is an Auth.js credentials login (bcrypt) with a JWT session cookie.
  `middleware.ts` guards `/dashboard`, `/api/event-types/*`, and `/api/host/*`; every host route
  additionally re-checks ownership server-side rather than trusting an id from the request.
- **Double booking** is prevented by a Postgres exclusion constraint, not by application checks, so
  a race that defeats the application pre-check still cannot produce overlapping confirmed bookings.
- **Secrets** live only in the environment (`lib/env.ts` validates them at startup and never logs
  values). `AUTH_SECRET` and `LINK_TOKEN_SECRET` must be independently generated so either can be
  rotated alone. Logs redact email addresses and never carry tokens or password hashes.
- **Known gaps, accepted for v1 and documented in `docs/PRD.md`:** there is no rate limiting or
  CAPTCHA on the public booking form, and there is no visitor account system. Reports about these
  are welcome but they are known trade-offs rather than new findings.

## Deploying safely

- Serve over HTTPS only; both the session cookie and the manage links depend on it.
- Generate `AUTH_SECRET` and `LINK_TOKEN_SECRET` with `openssl rand -base64 32`, keep them distinct,
  and never reuse the `.env.example` dummies.
- Keep PostgreSQL on a private network; the app is the only thing that should reach it.
- Change the seeded host password immediately after `npm run db:seed`.
