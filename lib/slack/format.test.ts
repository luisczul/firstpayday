import { describe, expect, it } from "vitest";
import { activitySource, formatActivity } from "./format";
import { formatDigest } from "./digest";

const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 FirstPaydayApp/1.0.0 (iOS)";
const ANDROID = "Mozilla/5.0 (Linux; Android 16) Chrome/140.0 Mobile Safari/537.36 FirstPaydayApp/1.0.0 (Android)";

describe("activitySource", () => {
  it("tells the website, both apps and the kids' tablet apart", () => {
    expect(activitySource("Mozilla/5.0 (Macintosh) Safari/605")).toBe("web");
    expect(activitySource(null)).toBe("web");
    expect(activitySource(IOS)).toBe("ios");
    expect(activitySource(ANDROID)).toBe("android");
    expect(activitySource(IOS, true)).toBe("tablet-ios");
    expect(activitySource("Mozilla/5.0 (iPad)", true)).toBe("tablet-web");
  });
});

describe("formatActivity", () => {
  it("names the kid, the chore, the amount, the home and where it happened", () => {
    const line = formatActivity(
      { kind: "chore_done", householdId: "h", submissionId: "s" },
      { homeName: "Czul family", currency: "CAD", kidName: "Nora", choreTitle: "Make your bed", amountCents: 50, kidCount: 2 },
      "tablet-android",
    );
    expect(line).toBe("🧹 *Nora* did “Make your bed” ($0.50) · 🏡 Czul family (2 kids) · 🧒 kids' tablet (Android app)");
  });

  it("covers signups, bulk approvals, payouts and negative adjustments", () => {
    expect(formatActivity({ kind: "signup", email: "a@b.ca" }, {}, "ios")).toBe("🎉 New signup: a@b.ca · 📱 iOS app");
    expect(formatActivity({ kind: "approved", count: 3 }, { kidName: "Leo" }, "web")).toContain("3 chores approved for *Leo*");
    expect(formatActivity({ kind: "payout", amountCents: -500, detail: "cash" }, { kidName: "Leo", currency: "CAD" }, "web")).toContain("Paid *Leo* $5.00 (cash)");
    expect(formatActivity({ kind: "adjustment", amountCents: -200, detail: "Broke a glass" }, { kidName: "Leo" }, "web")).toContain("−$2.00");
  });

  it("escapes Slack markup in names typed by families", () => {
    expect(formatActivity({ kind: "kids_added", count: 1, detail: "<@here> & co" }, {}, "web")).toContain("&lt;@here&gt; &amp; co");
  });
});

describe("formatDigest", () => {
  it("summarises signups, active homes with their kids, and totals", () => {
    const text = formatDigest({
      date: "Oct 6, 2026",
      signups: ["a@b.ca"],
      newHomes: 1,
      activeHomes: [{ name: "Czul family", currency: "CAD", kids: ["Nora", "Leo"], choresDone: 4, approved: 3, paidCents: 500 }],
      totals: { homes: 7, kids: 12, parents: 9 },
    });
    expect(text).toContain("New signups: *1* (a@b.ca)");
    expect(text).toContain("🏡 Czul family (Nora, Leo): 4 chores done, 3 approved, $5.00 paid");
    expect(text).toContain("All time: 7 homes, 12 kids, 9 parents");
  });
});
