/**
 * Capture the README screenshots in docs/images from the running app.
 *
 * Prerequisites: the demo database is seeded (scripts/demo-seed.ts) and the app
 * is serving it, e.g.
 *
 *   DATABASE_URL=postgresql://bookline:bookline@localhost:5433/bookline_demo \
 *     npm run build && DATABASE_URL=... npm run start
 *
 * Then, against that server:
 *
 *   BASE_URL=http://localhost:3000 npx tsx scripts/capture-screenshots.ts
 *
 * Every shot is a genuine capture of the running app: the script drives the real
 * booking flow (picks a day, reads the rendered slots, books one) and the real
 * host dashboard (credentials login). Timezone is set per browser context so the
 * public page renders the host's Berlin availability in the visitor's own zone.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const HOST_EMAIL = "jordan.avery@example.com";
const HOST_PASSWORD = "demo-password";

const OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "docs",
  "images",
);
const VIEWPORT = { width: 1280, height: 800 };

/** A future weekday (host-local) that has full availability, as YYYY-MM-DD. */
function pickWeekday(daysAhead: number): { iso: string; label: string } {
  const now = new Date();
  const d = new Date(now);
  let added = 0;
  while (added < daysAhead || d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) added += 1;
  }
  const iso = d.toISOString().slice(0, 10);
  const label = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
  return { iso, label };
}

async function selectDay(page: Page, label: string): Promise<void> {
  const cell = page.getByRole("gridcell", {
    name: new RegExp(`^${label},`),
  });
  await cell.first().waitFor({ state: "visible", timeout: 15000 });
  await cell.first().click();
  // Wait for at least one real slot button to render.
  await page
    .getByRole("button", { name: /\d{1,2}:\d{2}\s?(AM|PM)/i })
    .first()
    .waitFor({ state: "visible", timeout: 15000 });
}

async function shot(page: Page, name: string, fullPage = true): Promise<void> {
  const file = path.join(OUT_DIR, name);
  await page.screenshot({ path: file, fullPage });
  process.stdout.write(`captured ${name}\n`);
}

async function captureBookingPage(
  browser: Browser,
  colorScheme: "light" | "dark",
  dayLabel: string,
): Promise<void> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme,
    timezoneId: "Europe/Berlin",
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/book/intro-call`, { waitUntil: "networkidle" });
  await selectDay(page, dayLabel);
  await shot(page, `booking-page-${colorScheme}.png`);
  await context.close();
}

async function captureTimezoneView(
  browser: Browser,
  dayLabel: string,
): Promise<void> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: "light",
    timezoneId: "America/New_York",
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/book/intro-call`, { waitUntil: "networkidle" });
  await selectDay(page, dayLabel);
  await shot(page, "booking-timezone-new-york.png");
  await context.close();
}

async function captureConfirmation(
  browser: Browser,
  dayLabel: string,
): Promise<void> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: "light",
    timezoneId: "Europe/Berlin",
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/book/consultation`, {
    waitUntil: "networkidle",
  });
  await selectDay(page, dayLabel);
  // Choose the last slot of the day to avoid colliding with seeded bookings.
  const slots = page.getByRole("button", { name: /\d{1,2}:\d{2}\s?(AM|PM)/i });
  await slots.last().click();
  await page.getByLabel("Name").fill("Alex Rivera");
  await page.getByLabel("Email").fill("alex.rivera@example.com");
  await page.getByRole("button", { name: /Confirm booking/i }).click();
  await page
    .getByRole("heading", { name: /You're booked/i })
    .waitFor({ state: "visible", timeout: 15000 });
  await shot(page, "booking-confirmation.png");
  await context.close();
}

async function captureDashboard(
  browser: Browser,
  colorScheme: "light" | "dark",
): Promise<void> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme,
    timezoneId: "Europe/Berlin",
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(HOST_EMAIL);
  await page.getByLabel("Password").fill(HOST_PASSWORD);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page
    .getByRole("heading", { name: "Bookings", level: 1 })
    .waitFor({ state: "visible", timeout: 15000 });
  // Let the table paint its rows.
  await page.getByRole("table").first().waitFor({ state: "visible" });
  await shot(page, `dashboard-${colorScheme}.png`);
  await context.close();
}

async function main(): Promise<void> {
  const near = pickWeekday(1);
  const browser = await chromium.launch();
  try {
    await captureBookingPage(browser, "light", near.label);
    await captureBookingPage(browser, "dark", near.label);
    await captureTimezoneView(browser, near.label);
    await captureConfirmation(browser, pickWeekday(6).label);
    await captureDashboard(browser, "light");
    await captureDashboard(browser, "dark");
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `capture failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
