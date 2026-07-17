# Design: bookline UI

Implementable directly with Tailwind and the tokens below. Two audiences share one system: the
public booking page (visitor-facing, calm and minimal) and the dashboard (host-facing, denser).
All components support light and dark themes and meet the accessibility rules at the end.

## Principles

- The visitor's decision — day, then time — is the loudest thing on the booking page. Everything
  else recedes.
- Times are always labeled with their timezone. Never show a bare "9:00" without the active zone
  visible on screen.
- Nothing shifts layout while slots load: skeletons occupy final space.
- Destructive actions (cancel booking, delete event type) always confirm.

## Color and theme

Tailwind `class` dark-mode strategy. Tokens as CSS variables in `app/globals.css`, mapped in
`tailwind.config.ts` to semantic names (`bg-surface`, `text-fg`), never raw hex in components.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `bg` | `#ffffff` | `#0c1017` | Page background |
| `surface` | `#f6f7f9` | `#151b24` | Cards, panels, header |
| `surface-2` | `#edeff3` | `#1d2530` | Skeletons, subtle fills, hover rows |
| `border` | `#e1e4e9` | `#2a3441` | Card and input borders |
| `fg` | `#111827` | `#e7eaf0` | Primary text |
| `fg-muted` | `#5c6572` | `#98a3b3` | Secondary text, timezone labels |
| `accent` | `#0f766e` | `#2dd4bf` | Primary actions, selected slot, links |
| `accent-fg` | `#ffffff` | `#0c1017` | Text on accent |
| `accent-hover` | `#115e59` | `#5eead4` | Accent hover |
| `success` | `#16a34a` | `#4ade80` | Confirmed badge |
| `warning` | `#d97706` | `#fbbf24` | Pending-email notice |
| `danger` | `#dc2626` | `#f87171` | Cancelled badge, destructive buttons, errors |
| `focus-ring` | `#0f766e` | `#5eead4` | Focus outline |

Text/background pairs target WCAG AA (>= 4.5:1 body, >= 3:1 large text and UI borders); verify
accent-on-surface and muted-on-surface in both themes during implementation.

## Typography

System UI stack (`ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial,
sans-serif`). Tabular numerals (`tabular-nums`) for every time, date, and duration so slot lists
and tables align.

| Role | Size | Weight | Line height |
| --- | --- | --- | --- |
| Page title | 1.75rem (28px) | 700 | 1.2 |
| Section heading | 1.25rem (20px) | 600 | 1.3 |
| Slot button / body | 1rem (16px) | 500 / 400 | 1.5 |
| Meta, timezone label | 0.875rem (14px) | 400 | 1.45 |
| Table text | 0.875rem (14px) | 400 | 1.5 |
| Badge | 0.75rem (12px) | 600, uppercase tracking | 1.2 |

## Spacing, radius, shadow

- 4/8px scale: Tailwind steps `1`(4) `2`(8) `3`(12) `4`(16) `6`(24) `8`(32) `12`(48). Card padding
  16-24px; booking page column gap 32px; form field gap 16px.
- Radius: `sm` 6px (inputs, badges, calendar day cells), `md` 10px (buttons, slot buttons, cards),
  `lg` 16px (dialogs, toasts).
- Shadow: cards `0 1px 2px rgba(0,0,0,0.06)`; dialogs/toasts `0 12px 32px rgba(0,0,0,0.18)`. Dark
  mode leans on `border`/`surface-2` instead of heavier shadows.

## Booking page layout

Two columns on desktop (>= 900px): left = event type summary (name, duration, description,
timezone select); right = month grid, then slot list for the selected day, then the booking form
after a slot is chosen. Single column stacked on mobile, in that order. Max width 960px, centered,
16px gutters mobile / 24px desktop.

## Component states

### Month grid day cell
- **Available:** `fg` text, small accent dot beneath the number; hover `surface-2`; selected
  `accent` background with `accent-fg` text.
- **Unavailable / outside horizon:** `fg-muted` at 50% opacity, not focusable as an action,
  `aria-disabled`.
- **Today:** 1px `accent` outline when not selected.
- **Outside current month:** hidden (empty cell), grid position preserved.
- **Loading:** each cell a `surface-2` pulse block; grid dimensions identical to loaded state.

### Slot button
Full-width list of times, 44px min height, radius `md`.
- **Rest:** `surface` bg, `border`, time in `fg` with `tabular-nums`.
- **Hover:** `accent` border, `surface-2` bg.
- **Focus-visible:** 2px `focus-ring` outline, 2px offset.
- **Selected:** `accent` bg, `accent-fg` text; adjacent "Confirm" affordance appears (two-tap
  pattern: select, then confirm).
- **Just taken (409 refresh):** the stale button is removed with the list re-render; a toast
  explains; no dead buttons left behind.

### Timezone select
A labeled `<select>` ("Timezone") listing IANA zones with city-style labels, defaulted to the
detected zone with "(detected)" suffix. Changing it re-renders instantly; the active zone is also
echoed under the slot list ("Times shown in Asia/Karachi").

### Forms (booking form, login, event type, availability editors)
Inputs 44px height, `sm` radius, visible label above, `fg-muted` helper text below.
- **Focus:** 2px `focus-ring` outline.
- **Error:** `danger` border + message below the field, `aria-describedby` wired; the first
  errored field gets focus after a failed submit.
- **Disabled:** `opacity-50 cursor-not-allowed`.
- **Submitting:** button shows spinner + label change ("Booking..."), width stable,
  `aria-busy="true"`, controls disabled to block double submit.

### Buttons
Variants `primary` (accent), `secondary` (surface + border), `ghost`, `danger`. Same state matrix
as sibling projects: hover shade, 2px focus ring, active `scale-[0.98]`, disabled
`opacity-50` + `aria-disabled`, loading keeps width with spinner. Never remove a focus ring.

### Badges
`confirmed` (success tint), `cancelled` (danger tint), `email pending` (warning tint). Filled
soft backgrounds (10-15% tint) with dark-enough text for AA.

### Dashboard table
Row height 48px, `border` dividers, hover `surface-2`. Upcoming/past as tabs (underline style,
accent for active). Cancelled rows keep full opacity but carry the danger badge. On mobile the
table collapses to stacked cards (name, time, badge).

### Toast
Bottom-center, `lg` radius, auto-dismiss 6s with a close button, `role="status"`
(`aria-live="polite"`). The `SLOT_TAKEN` toast is the loudest instance: "That time was just
booked. Here are the updated times." and it must accompany a visibly refreshed list.

### Confirm dialog
Focus-trapped, `Esc` cancels, initial focus on the least destructive action, destructive button in
`danger`. Used for: cancel booking (both sides), delete event type, delete override/blackout,
import-destructive actions.

### Empty states
Shared `EmptyState` component: short heading, one line of guidance, optional action. Required
instances: no slots on a day ("No open times on this day — try another date"), month with no
availability, dashboard with no upcoming bookings, no past bookings, no event types yet ("Create
your first event type"), empty weekly rules ("You have no availability — visitors can't book").

### Error states
Route error boundary: calm card, "Something went wrong", one retry button, no technical detail.
Invalid manage link: dedicated page, "This link isn't valid", suggestion to check the newest
email. Booking already cancelled: neutral card stating the status and its time.

### Loading
`Skeleton` primitive on `surface-2` with `animate-pulse`, matching final footprint: month grid
block, slot-list rows, dashboard table rows. Booking form never skeletons (rendered with the page).

## Accessibility baseline (required)

- Semantic HTML: `<header>`, `<main>`, `<nav>` in the dashboard, one `<h1>` per page, headings in
  order, lists for slot lists (`<ul>`), a real `<table>` (or properly labeled stacked cards) for
  bookings.
- Every form input has a visible `<label>`; icon-only buttons have `aria-label`.
- Month grid: arrow-key navigation between days, `Home`/`End` to week edges, `PageUp`/`PageDown`
  to change month; the grid uses the ARIA grid pattern with `aria-selected` and each cell's
  accessible name including its availability ("August 3, 4 times available").
- Full keyboard operability everywhere; dialogs focus-trapped, `Esc` closes, focus returns to the
  trigger; no keyboard traps.
- Visible `focus-ring` on all interactive elements; never `outline: none` without replacement.
- Slot refreshes and toasts announce via `aria-live="polite"`; the timezone change announces the
  new zone.
- Contrast: WCAG AA in both themes using the token pairs above.
- `prefers-reduced-motion`: disable pulse shimmer and scale transitions.
