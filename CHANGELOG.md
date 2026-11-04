# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). No versioned release has
been tagged yet; everything below is the current, unreleased state of `main`.

## [Unreleased]

### Added

- Timezone-correct slot engine (`lib/slots/`): weekly availability rules stored as host-local
  minutes-of-day, projected to UTC instants and rendered in the visitor's timezone. Handles DST
  spring-forward (skipped hour yields no slot), fall-back (each wall time once), and
  midnight-crossing windows, with minimum notice, maximum-days-ahead horizon, buffers, per-date
  overrides, and blackout dates.
- Concurrency-safe booking flow: bookings are written inside a transaction where a PostgreSQL
  `btree_gist` exclusion constraint (`booking_no_overlap`) is the authority. Simultaneous bookings
  for the same slot resolve to exactly one winner; the loser gets a friendly `SLOT_TAKEN` response
  with refreshed slots.
- Calendar interop: a hand-rolled RFC 5545 writer (`lib/ics/`) producing confirmation invites
  (`METHOD:REQUEST`) with a stable UID, incrementing SEQUENCE across reschedules, and
  `METHOD:CANCEL` on cancellation; plus a per-host tokenized read-only iCal feed of confirmed
  bookings.
- Public booking page: month grid with per-day availability, a slot list, browser timezone
  auto-detection with a manual override, and a booking form. The month grid is an ARIA grid with
  roving tabindex and full keyboard navigation.
- Cancel and reschedule via stateless HMAC-signed manage links, with no visitor account; tampered
  tokens return a friendly invalid-link page.
- Host area: Auth.js credentials login for a single seeded host, a dashboard of upcoming and past
  bookings with host-initiated cancel, event type CRUD, and an availability editor (weekly rules,
  per-date overrides, blackout dates) with server-side overlap rejection.
- Reminder emails: an atomic claim-then-send job delivers exactly one reminder per booking at the
  configured lead time, idempotent under a double-fire, runnable in-process or via external cron.
- Structured JSON logging, a single API error-response format, and server-side Zod validation on
  every route.
- Repository tooling: CI (GitHub Actions) running typecheck, lint, unit, integration, and build
  against a `postgres:16` service container; Dependabot; MIT license; and a security policy.

### Fixed

- Slot engine: an ambiguous fall-back wall time now always resolves to the earlier instant. It
  previously depended on whether the server clock was in daylight or standard time.
- Rescheduling to a new time clears the reminder claim, so the moved booking gets its own reminder.
- Override and blackout dates, and the public `date` / `month` query parameters, must be real
  calendar dates (no `2026-02-30` or month `13`).
- Invitee names with line breaks or other control characters are rejected, so they cannot forge
  extra lines in emails.
- Host login spends the same bcrypt work for an unknown email as for a wrong password, so response
  time does not reveal the host address.

[Unreleased]: https://github.com/thealirazadev/bookline/commits/main
