import { formatMoney } from "@/lib/money/format";

/** What happened. Each kind is one line in the owner's Slack activity channel. */
export type ActivityKind =
  | "signup"
  | "login"
  | "home_created"
  | "kids_added"
  | "chore_done"
  | "chore_redone"
  | "approved"
  | "sent_back"
  | "rejected"
  | "payout"
  | "adjustment"
  | "family_treat"
  | "tablet_paired"
  | "parent_joined"
  | "account_deleted"
  | "home_deleted";

export interface ActivityEvent {
  kind: ActivityKind;
  householdId?: string;
  kidId?: string;
  submissionId?: string;
  email?: string;
  /** Kid names, chore title, note… whatever the line needs. */
  detail?: string;
  amountCents?: number;
  count?: number;
}

/** Where it came from: the website, one of the native apps, or the kids' tablet running in either. */
export type ActivitySource = "web" | "ios" | "android" | "tablet-web" | "tablet-ios" | "tablet-android" | "server";

export function activitySource(userAgent: string | null | undefined, onTablet = false): ActivitySource {
  const app = /FirstPaydayApp\/[^ ]+ \((iOS|Android)\)/.exec(userAgent ?? "")?.[1];
  const base = app === "iOS" ? "ios" : app === "Android" ? "android" : "web";
  return onTablet ? (`tablet-${base}` as ActivitySource) : base;
}

const SOURCE_LABEL: Record<ActivitySource, string> = {
  web: "💻 web",
  ios: "📱 iOS app",
  android: "🤖 Android app",
  "tablet-web": "🧒 kids' tablet (web)",
  "tablet-ios": "🧒 kids' tablet (iOS app)",
  "tablet-android": "🧒 kids' tablet (Android app)",
  server: "⚙️ server",
};

const EMOJI: Record<ActivityKind, string> = {
  signup: "🎉",
  login: "🔑",
  home_created: "🏠",
  kids_added: "👧",
  chore_done: "🧹",
  chore_redone: "🔁",
  approved: "✅",
  sent_back: "↩️",
  rejected: "🚫",
  payout: "💵",
  adjustment: "✏️",
  family_treat: "🍦",
  tablet_paired: "📲",
  parent_joined: "🤝",
  account_deleted: "🗑️",
  home_deleted: "🗑️",
};

/** Context looked up from the database before formatting (all optional: a missing row never blocks the message). */
export interface ActivityContext {
  homeName?: string;
  currency?: string;
  kidName?: string;
  choreTitle?: string;
  kidCount?: number;
  /** The submission's amount when the event didn't carry one. */
  amountCents?: number;
}

/** Slack mrkdwn: escape the three characters Slack treats as markup. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function formatActivity(e: ActivityEvent, ctx: ActivityContext, source: ActivitySource): string {
  const cents = e.amountCents ?? ctx.amountCents;
  const money = cents !== undefined ? formatMoney(Math.abs(cents), ctx.currency ?? "CAD", "en") : "";
  const kid = ctx.kidName ? `*${esc(ctx.kidName)}*` : "a kid";
  const chore = ctx.choreTitle ? `“${esc(ctx.choreTitle)}”` : "a chore";
  const detail = e.detail ? esc(e.detail) : "";
  const what = (() => {
    switch (e.kind) {
      case "signup":
        return `New signup: ${esc(e.email ?? "?")}`;
      case "login":
        return `Parent logged in: ${esc(e.email ?? "?")}`;
      case "home_created":
        return `New home created${e.email ? ` by ${esc(e.email)}` : ""}`;
      case "kids_added":
        return `${e.count ?? 1} kid${(e.count ?? 1) === 1 ? "" : "s"} added: ${detail}`;
      case "chore_done":
        return `${kid} did ${chore}${money ? ` (${money})` : ""}`;
      case "chore_redone":
        return `${kid} fixed ${chore}${money ? ` (${money})` : ""}`;
      case "approved":
        return e.count && e.count > 1 ? `${e.count} chores approved for ${kid}` : `Approved ${kid}'s ${chore}${money ? ` (${money})` : ""}`;
      case "sent_back":
        return `Sent back ${kid}'s ${chore}`;
      case "rejected":
        return `Rejected ${kid}'s ${chore}`;
      case "payout":
        return `Paid ${kid} ${money}${detail ? ` (${detail})` : ""}`;
      case "adjustment":
        return `Balance change for ${kid}: ${e.amountCents !== undefined && e.amountCents < 0 ? "−" : "+"}${money}${detail ? ` (${detail})` : ""}`;
      case "family_treat":
        return `Family treat ${money}${detail ? ` (${detail})` : ""}`;
      case "tablet_paired":
        return "A device became the kids' tablet";
      case "parent_joined":
        return `A parent joined${e.email ? `: ${esc(e.email)}` : ""}`;
      case "account_deleted":
        return `Account deleted${e.email ? `: ${esc(e.email)}` : ""}${detail ? ` (home “${detail}”)` : ""}`;
      case "home_deleted":
        return `Home deleted${detail ? `: “${detail}”` : ""}${e.email ? ` by ${esc(e.email)}` : ""}`;
    }
  })();
  const home = ctx.homeName ? ` · 🏡 ${esc(ctx.homeName)}${ctx.kidCount ? ` (${ctx.kidCount} kid${ctx.kidCount === 1 ? "" : "s"})` : ""}` : "";
  return `${EMOJI[e.kind]} ${what}${home} · ${SOURCE_LABEL[source]}`;
}
