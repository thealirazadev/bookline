---
name: Bug report
about: Something is not working as expected
title: "bug: "
labels: bug
assignees: ""
---

## What happened

A clear description of the bug and what you expected instead.

## Steps to reproduce

1. Go to '...'
2. Book / reschedule / cancel '...'
3. See the error

## Area

Which part of the app is affected? Delete the ones that do not apply.

- [ ] Public booking page / slot picker
- [ ] Slot engine / timezone math (wrong slots, DST, midnight-crossing)
- [ ] Booking, cancel, or reschedule flow
- [ ] Calendar interop (.ics attachment or iCal feed)
- [ ] Reminder emails
- [ ] Host auth / dashboard / event types / availability editor

## Timezones (if the bug involves times)

- Host timezone:
- Visitor timezone shown in the picker:
- The specific date/slot involved (with the wall-clock time you saw):

## Environment

- bookline commit / branch:
- Node version:
- PostgreSQL version:
- Browser (for UI issues):

## Logs and evidence

Relevant structured log lines (`{ level, event, ... }`), API responses, or screenshots. Redact
invitee names, email addresses, and any manage-link or feed tokens before posting.

## Additional context

Anything else that helps narrow it down.
