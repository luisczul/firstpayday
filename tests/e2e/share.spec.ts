import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// A parent shares First Payday with two friends: personalized emails arrive, the list tracks them,
// a same-day resend is refused politely, and a friend who signs up shows as Joined.
const MAILPIT = "http://127.0.0.1:54324";

type Mail = { Subject: string; HTML: string; ReplyTo: { Address: string }[] };

async function mailsTo(to: string): Promise<Mail[]> {
  const list = (await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json()) as { messages: { ID: string }[] };
  const out: Mail[] = [];
  for (const m of list.messages ?? []) out.push((await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()) as Mail);
  return out;
}

async function signUp(page: Page, email: string, home: string) {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(`pw-${randomUUID()}`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create my account" }).click();
  await page.getByLabel("Home name").fill(home);
  await page.getByRole("button", { name: /add your kids/ }).click();
  await expect(page).toHaveURL(/onboarding\/kids/);
}

test("share First Payday with friends and track the invitations", async ({ page, browser }) => {
  const id = randomUUID().slice(0, 8);
  const owner = `sharer-${id}@example.test`;
  const f1 = `friend1-${id}@example.test`;
  const f2 = `friend2-${id}@example.test`;
  await signUp(page, owner, "Share family");

  await page.goto("/admin/share");
  await expect(page.getByRole("heading", { name: "💌 Share First Payday" })).toBeVisible();
  await page.getByLabel("Their emails").fill(`${f1.toUpperCase()}, ${f2}\n${f1}`);
  await expect(page.getByText("2 of 10")).toBeVisible();
  await page.getByLabel("Your name").fill("Nicolle");
  await page.getByLabel("A personal note").fill("The kids <3 it, you should try!");
  await page.getByRole("button", { name: "Send invitations" }).click();

  const results = page.getByRole("status");
  await expect(results.getByText(f1)).toBeVisible();
  await expect(results.getByText("Sent ✓")).toHaveCount(2);

  for (const to of [f1, f2]) {
    await expect.poll(async () => (await mailsTo(to)).length).toBe(1);
    const [mail] = await mailsTo(to);
    expect(mail!.Subject).toBe("Nicolle thinks you'll love First Payday");
    expect(mail!.HTML).toContain("<strong>Nicolle</strong> is using First Payday with their kids");
    expect(mail!.HTML).toContain("The kids &lt;3 it, you should try!");
    expect(mail!.HTML).toContain("?ref=share");
    expect(mail!.HTML).toContain(owner);
    expect(mail!.ReplyTo.map((r) => r.Address)).toEqual([owner]);
  }

  const rows = page.getByTestId("share-row");
  await expect(rows).toHaveCount(2);
  for (const to of [f1, f2]) await expect(rows.filter({ hasText: to }).getByText("Sent", { exact: true })).toBeVisible();

  // The name was saved as the parent's display name.
  await page.reload();
  await expect(page.getByLabel("Your name")).toHaveValue("Nicolle");

  // Same-day resend: refused politely, no new email.
  await page.getByRole("button", { name: `Resend ${f1}` }).click();
  await expect(page.getByText(`You already emailed ${f1} in the last 24 hours. You can send it again tomorrow.`)).toBeVisible();
  // Sending to the same address again the same day is reported, not re-sent.
  await page.getByLabel("Their emails").fill(f2);
  await page.getByRole("button", { name: "Send invitations" }).click();
  await expect(page.getByRole("status").getByText("Already sent in the last 24 hours")).toBeVisible();
  // Someone already on First Payday is reported too.
  await page.getByLabel("Their emails").fill(owner);
  await page.getByRole("button", { name: "Send invitations" }).click();
  await expect(page.getByRole("status").getByText("That's your own email")).toBeVisible();
  expect((await mailsTo(f1)).length).toBe(1);
  expect((await mailsTo(f2)).length).toBe(1);

  // Friend 1 signs up: the list shows Joined.
  const ctx = await browser.newContext();
  await signUp(await ctx.newPage(), f1, "Friend family");
  await ctx.close();
  await page.reload();
  await expect(rows.filter({ hasText: f1 }).getByText("Joined ✓")).toBeVisible();
  await expect(rows.filter({ hasText: f1 }).getByRole("button", { name: /Resend/ })).toHaveCount(0);
  await expect(rows.filter({ hasText: f2 }).getByText("Sent", { exact: true })).toBeVisible();

  // Reachable from the settings tabs (phones) and the sidebar.
  await page.goto("/admin/settings");
  await expect(page.getByRole("link", { name: "💌 Share", exact: true })).toBeVisible();
});
