import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

// A co-parent missed the invite: the owner taps Resend; a fresh link arrives, the old one stops working.
const MAILPIT = "http://127.0.0.1:54324";

async function inviteLinks(to: string): Promise<string[]> {
  const list = (await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json()) as { messages: { ID: string }[] };
  const links: string[] = [];
  for (const m of list.messages ?? []) {
    const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()) as { HTML: string };
    const link = /https?:\/\/[^"'\s<>]+\/invite\/[A-Za-z0-9_-]+/.exec(msg.HTML)?.[0];
    if (link) links.push(link);
  }
  return links;
}

test("resend an invitation: new link by email, old link no longer works", async ({ page }) => {
  const partner = `partner-${randomUUID().slice(0, 8)}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(`owner-${randomUUID().slice(0, 8)}@example.test`);
  await page.getByLabel("Password").fill(`owner-${randomUUID()}`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create my account" }).click();
  await page.getByLabel("Home name").fill("Invite family");
  await page.getByRole("button", { name: /add your kids/ }).click();
  await expect(page).toHaveURL(/onboarding\/kids/);

  await page.goto("/admin/settings/members");
  await page.getByLabel("Email").fill(partner);
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByText("Invite sent by email.")).toBeVisible();
  await expect.poll(async () => (await inviteLinks(partner)).length).toBe(1);
  const [first] = await inviteLinks(partner);

  await page.getByRole("button", { name: /Resend/ }).click();
  await expect(page.getByText(`Invite sent again to ${partner}. The new link works for 7 days.`)).toBeVisible();
  await expect.poll(async () => (await inviteLinks(partner)).length).toBe(2);
  const second = (await inviteLinks(partner)).find((l) => l !== first)!;
  expect(second).toBeTruthy();

  const path = (u: string) => new URL(u).pathname;
  await page.goto(path(first!));
  await expect(page.getByRole("heading", { name: /expired|no longer/i })).toBeVisible();
  await page.goto(path(second));
  await expect(page.getByRole("heading", { name: /Invite family/ })).toBeVisible();
});
