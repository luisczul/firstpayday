import { requireParent } from "@/lib/auth/session";
import { FREE_KIDS, PLAN_NAMES, PRICE_PER_EXTRA_KID_CENTS, billableExtraKids, monthlyPriceCents } from "@/lib/billing/plans";
import { hasPaidSubscription, trialDaysLeft } from "@/lib/billing/access";
import { formatMoney } from "@/lib/money/format";
import { Alert, Badge, Card, PageHeader, buttonClass } from "@/components/ui";
import { SettingsNav } from "../SettingsNav";

export const metadata = { title: "Billing" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ success?: string; canceled?: string }> }) {
  const ctx = await requireParent();
  const sp = await searchParams;
  const sub = ctx.subscription;
  const now = new Date();
  const money = (c: number) => formatMoney(c, "CAD", ctx.locale);
  const days = trialDaysLeft(sub, now);
  const paid = hasPaidSubscription(sub, now);
  const kids = ctx.activeKids;
  const extra = Math.max(0, kids - FREE_KIDS);

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsNav active="/admin/settings/billing" />

      {sp.success ? <div className="mb-4"><Alert tone="good">Thanks! Your subscription is starting; this page updates in a few seconds.</Alert></div> : null}
      {sp.canceled ? <div className="mb-4"><Alert tone="warn">Checkout canceled. Nothing was charged.</Alert></div> : null}
      {ctx.access !== "full" ? (
        <div className="mb-4">
          <Alert tone="bad">
            You have {kids} kids but no active subscription, so the board is read-only. Subscribe below, or archive kids down to 1 to keep using it for free.
          </Alert>
        </div>
      ) : null}

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl font-bold">{paid ? "Family subscription" : PLAN_NAMES[ctx.plan]}</h2>
          {sub ? <Badge tone={ctx.access === "full" ? "good" : "bad"}>{sub.status}</Badge> : null}
          {sub?.cancel_at_period_end ? <Badge tone="warn">Cancels at period end</Badge> : null}
        </div>
        <p className="mt-3 text-lg">
          <b>{kids}</b> kid{kids === 1 ? "" : "s"} · first kid free · {extra > 0 ? <>{extra} × {money(PRICE_PER_EXTRA_KID_CENTS)} = <b>{money(monthlyPriceCents(kids))}/month</b> + tax</> : "nothing to pay"}
        </p>
        {ctx.plan === "trial" && days > 0 ? (
          <p className="mt-2 text-ink-soft">Free trial: {days} day{days === 1 ? "" : "s"} left. Extra kids are free until then.</p>
        ) : null}
        {ctx.plan === "comp" ? <p className="mt-2 text-ink-soft">Complimentary plan. You&apos;ll never be billed. 🎁</p> : null}
        {paid && sub?.current_period_end ? (
          <p className="mt-2 text-ink-soft">
            {sub.cancel_at_period_end ? "Access until" : "Renews"} {new Date(sub.current_period_end).toLocaleDateString(ctx.locale === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long" })}.
            {" "}Adding or archiving a kid updates your subscription automatically (prorated).
          </p>
        ) : null}

        {!ctx.isOwner ? (
          <p className="mt-4 text-sm text-ink-soft">Only the household owner can manage billing.</p>
        ) : ctx.plan === "comp" ? null : paid ? (
          <form action="/api/stripe/portal" method="post" className="mt-5">
            <button className={buttonClass("secondary")}>Manage billing (card, invoices, cancel)</button>
          </form>
        ) : (
          <form action="/api/stripe/checkout" method="post" className="mt-5 flex flex-wrap items-center gap-3">
            <button className={buttonClass("primary", "lg")}>
              Subscribe: {money(billableExtraKids(kids) * PRICE_PER_EXTRA_KID_CENTS)}/month
            </button>
            <span className="text-sm text-ink-soft">
              {billableExtraKids(kids)} extra kid{billableExtraKids(kids) === 1 ? "" : "s"} × {money(PRICE_PER_EXTRA_KID_CENTS)}. Cancel any time.
            </span>
          </form>
        )}
      </Card>

      <Card>
        <h3 className="font-display text-xl font-bold">How pricing works</h3>
        <ul className="mt-2 flex flex-col gap-1 text-ink-soft">
          <li>✓ Your first kid is free, forever, with every feature.</li>
          <li>✓ Each additional kid is {money(PRICE_PER_EXTRA_KID_CENTS)} CAD/month (+ tax).</li>
          <li>✓ New homes get 14 days free with any number of kids.</li>
          <li>✓ If a subscription ends, nothing is deleted: the board goes read-only until you subscribe or archive down to one kid.</li>
        </ul>
      </Card>
    </>
  );
}
