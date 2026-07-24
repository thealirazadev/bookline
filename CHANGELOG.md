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

[Unreleased]: https://github.com/thealirazadev/bookline/commits/main
