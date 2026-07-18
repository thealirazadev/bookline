import { expect, test } from "@playwright/test";

const MAILPIT = "http://localhost:8025";

// Deterministic visitor timezone so slot labels are stable.
test.use({ timezoneId: "America/New_York" });

interface MailMessage {
  ID: string;
  To: { Address: string }[];
  Subject: string;
}

async function clearMailpit() {
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" }).catch(
    () => undefined,
  );
}

async function mailpitMessages(): Promise<MailMessage[]> {
  const res = await fetch(`${MAILPIT}/api/v1/messages`);
  const data = (await res.json()) as { messages: MailMessage[] };
  return data.messages;
}

test("book, receive invite, cancel via manage link, slot frees", async ({
  page,
}) => {
  await clearMailpit();

  await page.goto("/book/intro-call");

  // Pick the first day that has open times.
  const availableDay = page
    .locator('[role="gridcell"][aria-disabled="false"]')
    .first();
  await availableDay.waitFor({ timeout: 15000 });
  await availableDay.click();

  // Pick the first slot and remember its label to check it frees up later.
  const slot = page
    .getByRole("button", { name: /\d{1,2}:\d{2}\s?(AM|PM)/i })
    .first();
  await slot.waitFor({ timeout: 15000 });
  const slotLabel = (await slot.textContent())?.trim() ?? "";
  expect(slotLabel).not.toBe("");
  await slot.click();

  await page.getByLabel("Name").fill("E2E Tester");
  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByRole("button", { name: "Confirm booking" }).click();

  await expect(page.getByText("You're booked")).toBeVisible({ timeout: 15000 });

  // Both sides receive mail; the invitee message carries a calendar invite.
  await expect
    .poll(async () => (await mailpitMessages()).length, { timeout: 15000 })
    .toBeGreaterThanOrEqual(2);
  const messages = await mailpitMessages();
  const invitee = messages.find((m) =>
    m.To.some((t) => t.Address === "e2e@example.com"),
  );
  const host = messages.find((m) =>
    m.To.some((t) => t.Address === "host@example.com"),
  );
  expect(invitee).toBeDefined();
  expect(host).toBeDefined();

  const detail = await (
    await fetch(`${MAILPIT}/api/v1/message/${invitee?.ID}`)
  ).json();
  const attachments = (detail.Attachments ?? []) as { ContentType: string }[];
  expect(
    attachments.some((a) => a.ContentType.includes("text/calendar")),
  ).toBe(true);

  // Follow the manage link from the invitee email body and cancel.
  const manageUrl = String(detail.Text).match(
    /https?:\/\/[^\s]+\/manage\/[^\s]+/,
  )?.[0];
  expect(manageUrl).toBeTruthy();

  await page.goto(manageUrl as string);
  await page.getByRole("button", { name: "Cancel booking" }).first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel booking" })
    .click();
  await expect(
    page.getByText("cancelled", { exact: true }),
  ).toBeVisible({ timeout: 15000 });

  // The slot is offered again on the same day.
  await page.goto("/book/intro-call");
  await page
    .locator('[role="gridcell"][aria-disabled="false"]')
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: slotLabel }).first(),
  ).toBeVisible({ timeout: 15000 });
});
