# API Contracts: bookline

This contract is agreed before any frontend or backend code is written. All endpoints are Next.js
route handlers under `/api`. Request/response bodies are JSON unless noted (`text/calendar` for the
feed). All instants are UTC ISO 8601 strings with a `Z` suffix; the client formats them for
display. Timezone parameters are IANA names and are validated server-side.

Auth levels:

- **public** — no auth.
- **token** — a signed manage token or the iCal feed token in the path.
- **host** — Auth.js session cookie required; unauthenticated requests get `401 UNAUTHORIZED`.

## Error format (single format, used everywhere)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields.",
    "fields": { "email": "Enter a valid email address." }
  }
}
```

- `code` is a stable machine string; `message` is friendly, human, and safe to show verbatim.
- `fields` appears only on `VALIDATION_ERROR`.
- Extra data for recovery (e.g. refreshed slots on `SLOT_TAKEN`) rides alongside `error` at the
  top level, never inside it.

| Code | HTTP | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Body/query/params failed validation; see `fields` |
| `UNAUTHORIZED` | 401 | Missing or invalid host session |
| `NOT_FOUND` | 404 | Unknown resource, unknown/invalid token (deliberately identical) |
| `TOKEN_INVALID` | 404 | Manage token malformed or signature mismatch |
| `SLOT_TAKEN` | 409 | Exclusion constraint rejected the booking; response carries `refreshedSlots` |
| `SLOT_UNAVAILABLE` | 422 | Instant fails engine rules (notice, horizon, outside windows) |
| `BOOKING_NOT_ACTIONABLE` | 410 | Booking already cancelled or in the past |
| `INTERNAL` | 500 | Anything unexpected; detail only in server logs |

## Public booking endpoints

### GET /api/availability — days with open slots (public)

Query: `eventType` (slug), `month` (`YYYY-MM`, visitor-local), `tz` (IANA).

```json
// 200
{
  "eventType": { "slug": "intro-call", "name": "Intro call", "durationMin": 30 },
  "month": "2026-08",
  "timezone": "America/Los_Angeles",
  "days": [
    { "date": "2026-08-03", "hasSlots": true },
    { "date": "2026-08-04", "hasSlots": false }
  ]
}
```

Days are visitor-local dates covering the requested month; days entirely before
`now + minNotice` or beyond `maxDaysAhead` are `false`. Unknown/inactive slug -> 404.

### GET /api/slots — slots for one day (public)

Query: `eventType` (slug), `date` (`YYYY-MM-DD`, visitor-local), `tz` (IANA).

```json
// 200
{
  "date": "2026-08-03",
  "timezone": "America/Los_Angeles",
  "slots": [
    { "startUtc": "2026-08-03T16:00:00Z", "endUtc": "2026-08-03T16:30:00Z" },
    { "startUtc": "2026-08-03T16:30:00Z", "endUtc": "2026-08-03T17:00:00Z" }
  ]
}
```

`slots` contains every open instant whose start falls on `date` in `tz`, already filtered by
notice, horizon, buffers, and existing bookings. Empty day -> `"slots": []` (200, not an error).

### POST /api/bookings — create a booking (public)

```json
// request
{
  "eventType": "intro-call",
  "startUtc": "2026-08-03T16:00:00Z",
  "name": "Dana Ortiz",
  "email": "dana@example.com",
  "timezone": "America/Los_Angeles"
}
```

```json
// 201
{
  "booking": {
    "id": "bk_01j9x7",
    "eventType": { "slug": "intro-call", "name": "Intro call" },
    "startUtc": "2026-08-03T16:00:00Z",
    "endUtc": "2026-08-03T16:30:00Z",
    "inviteeName": "Dana Ortiz",
    "inviteeTimezone": "America/Los_Angeles",
    "status": "confirmed"
  },
  "manageUrl": "https://app.example.com/manage/YmtfMDFqOXg3.k2v...",
  "emailStatus": "sent"
}
```

- `emailStatus` is `"sent"` or `"pending"` (SMTP failed; booking stands; failure logged).
- Validation failure -> 400 `VALIDATION_ERROR` with `fields`.
- Instant no longer passes engine rules (stale list, notice window crossed) -> 422
  `SLOT_UNAVAILABLE`.
- Lost the race (exclusion constraint) -> 409:

```json
// 409
{
  "error": { "code": "SLOT_TAKEN", "message": "That time was just booked. Pick another slot." },
  "refreshedSlots": [
    { "startUtc": "2026-08-03T16:30:00Z", "endUtc": "2026-08-03T17:00:00Z" }
  ]
}
```

`refreshedSlots` covers the same visitor-local `date` as the attempted slot.

## Manage endpoints (token auth)

The token in the path is `base64url(bookingId) + "." + hmacSha256(bookingId, LINK_TOKEN_SECRET)`.
Malformed or mismatched -> 404 `TOKEN_INVALID`. Cancelled or past booking -> 410
`BOOKING_NOT_ACTIONABLE` (GET still returns the booking with its status so the page can explain).

### GET /api/manage/[token] — booking details for the manage page

```json
// 200
{
  "booking": {
    "id": "bk_01j9x7",
    "eventType": { "slug": "intro-call", "name": "Intro call", "durationMin": 30 },
    "startUtc": "2026-08-03T16:00:00Z",
    "endUtc": "2026-08-03T16:30:00Z",
    "inviteeName": "Dana Ortiz",
    "inviteeTimezone": "America/Los_Angeles",
    "status": "confirmed"
  },
  "actions": { "cancellable": true, "reschedulable": true }
}
```

### POST /api/manage/[token]/cancel

```json
// request
{ "reason": "Conflict came up" }          // reason optional, <= 500 chars
```

```json
// 200
{ "booking": { "id": "bk_01j9x7", "status": "cancelled" }, "emailStatus": "sent" }
```

Sets status `cancelled`, frees the slot, increments SEQUENCE, emails both sides METHOD:CANCEL.

### POST /api/manage/[token]/reschedule

```json
// request
{ "startUtc": "2026-08-04T17:00:00Z", "timezone": "America/Los_Angeles" }
```

```json
// 200
{
  "booking": {
    "id": "bk_01j9x7",
    "startUtc": "2026-08-04T17:00:00Z",
    "endUtc": "2026-08-04T17:30:00Z",
    "status": "confirmed"
  },
  "emailStatus": "sent"
}
```

Re-runs the full engine validation and the constraint-guarded transaction. Same UID, SEQUENCE + 1,
both sides emailed an updated METHOD:REQUEST invite. Failure modes identical to
`POST /api/bookings` (400 / 422 / 409 with `refreshedSlots`). The booking's own previous slot does
not conflict with itself.

## iCal feed (token auth)

### GET /api/ical/[feedToken]

- `200` with `Content-Type: text/calendar; charset=utf-8` when `feedToken` matches the host row;
  anything else -> 404 (plain, no error body needed).
- Body: one `VCALENDAR` (`PRODID`, `VERSION:2.0`, `CALSCALE:GREGORIAN`, `X-WR-CALNAME` with the
  host name) containing a `VEVENT` per confirmed booking from 30 days past to the horizon: `UID`
  (= `icsUid`), `SEQUENCE`, `DTSTAMP`, `DTSTART`/`DTEND` in UTC, `SUMMARY` ("Intro call — Dana
  Ortiz"), `DESCRIPTION` (invitee email, manage note), `STATUS:CONFIRMED`.
- Cancelled bookings are omitted; subscribers drop their UIDs on refresh. No METHOD property (this
  is a published calendar, not an invite).

## Host endpoints (session auth)

Auth.js owns `/api/auth/*` (sign-in, sign-out, session). Everything below returns
401 `UNAUTHORIZED` without a valid session.

### Event types

- `GET /api/event-types` -> `{ "eventTypes": [ ... ] }` (all, including inactive).
- `POST /api/event-types` — create.

```json
// request
{
  "name": "Intro call",
  "slug": "intro-call",
  "description": "30 minutes to meet.",
  "durationMin": 30,
  "bufferBeforeMin": 0,
  "bufferAfterMin": 10,
  "minNoticeMin": 240,
  "maxDaysAhead": 30,
  "reminderLeadMin": 60,
  "active": true
}
```

```json
// 201
{ "eventType": { "id": "et_01h2k4", "slug": "intro-call", "...": "all fields above" } }
```

- `PATCH /api/event-types/[id]` — partial update, same fields, same validation. Edits never touch
  existing bookings' stored times or blocks.
- `DELETE /api/event-types/[id]` — 409 `VALIDATION_ERROR` if the type has any booking (deactivate
  instead); 200 `{ "deleted": true }` otherwise.
- Duplicate slug -> 400 `VALIDATION_ERROR` with `fields.slug`.

### Availability

- `GET /api/host/availability` -> current weekly rules.
- `PUT /api/host/availability` — replaces the full weekly rule set atomically:

```json
// request
{
  "rules": [
    { "weekday": 0, "startMinute": 540, "endMinute": 1020 },
    { "weekday": 4, "startMinute": 1320, "endMinute": 120 }
  ]
}
```

`weekday` 0 = Monday .. 6 = Sunday. `endMinute <= startMinute` = crosses midnight. Overlapping
windows on the same weekday -> 400 `VALIDATION_ERROR`. Response echoes the stored rules with ids.

- `GET /api/host/overrides`, `POST /api/host/overrides`
  (`{ "date": "2026-08-15", "windows": [{ "startMinute": 600, "endMinute": 840 }] }` — replaces
  that date's rows), `DELETE /api/host/overrides/[id]`.
- `GET /api/host/blackouts`, `POST /api/host/blackouts` (`{ "date": "2026-08-20" }`),
  `DELETE /api/host/blackouts/[id]`. Duplicate date -> 400.

### Host bookings

- Dashboard reads go through server components (`lib/queries/bookings.ts`), not a JSON route.
- `POST /api/host/bookings/[id]/cancel` — body `{ "reason": "..." }` (optional). Same behavior and
  response shape as the invitee cancel; `cancelledBy` recorded as `host`. Unknown id -> 404;
  already cancelled/past -> 410.
