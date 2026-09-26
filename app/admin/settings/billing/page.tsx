import { requireParent } from "@/lib/auth/session";
import { PLAN_LIMITS, PLAN_NAMES, PLAN_PRICES, type PaidPlanId } from "@/lib/billing/plans";
import { trialDaysLeft } from "@/lib/billing/access";
import { formatMoney } from "@/lib/money/format";
import { Alert, Badge, Card, PageHeader, buttonClass } from "@/components/ui";
import { SettingsNav } from "../SettingsNav";

export const metadata = { title: "Billing" };

const FEATURES: Record<PaidPlanId, string[]> = {
  family: ["Up to 3 kids", "Unlimited chores", "2 kids' tablets", "2 parents"],
  family_plus: ["Up to 8 kids", "Unlimited chores", "5 kids' tablets", "4 parents", "CSV export", "Savings match", "Custom themes"],
};

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ success?: string; canceled?: string }> }) {
  const ctx = await requireParent();
  const sp = await searchParams;
  const sub = ctx.subscription;
  const now = new Date();
  const money = (c: number) => formatMoney(c, "CAD", ctx.locale);
  const days = trialDaysLeft(sub, now);
  const hasStripe = Boolean(sub?.stripe_subscription_id);

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsNav active="/admin/settings/billing" />

      {sp.success ? <div className="mb-4"><Alert tone="good">Thanks! Your plan updates in a few seconds.</Alert></div> : null}
      {sp.canceled ? <div className="mb-4"><Alert tone="warn">Checkout canceled. Nothing was charged.</Alert></div> : null}

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl font-bold">{PLAN_NAMES[ctx.plan]}</h2>
          <Badge tone={ctx.access === "full" ? "good" : "bad"}>{sub?.status ?? "none"}</Badge>
          {sub?.cancel_at_period_end ? <Badge tone="warn">Cancels at period end</Badge> : null}
        </div>
        {ctx.plan === "trial" ? (
          <p className="mt-2 text-ink-soft">{days > 0 ? `${days} days left in your free trial. No card needed until you choose a plan.` : "Your free trial has ended. Your data is safe: pick a plan to keep going."}</p>
        ) : null}
        {ctx.plan === "comp" ? <p className="mt-2 text-ink-soft">Complimentary plan. You&apos;ll never be billed. 🎁</p> : null}
        {sub?.current_period_end && ctx.plan !== "comp" ? (
          <p className="mt-2 text-ink-soft">
            {sub.cancel_at_period_end ? "Access until" : "Renews"} {new Date(sub.current_period_end).toLocaleDateString(ctx.locale === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long" })}
          </p>
        ) : null}
        {ctx.isOwner && hasStripe ? (
          <form action="/api/stripe/portal" method="post" className="mt-4">
            <button className={buttonClass("secondary")}>Manage billing (card, invoices, cancel)</button>
          </form>
        ) : null}
      </Card>

      {!ctx.isOwner ? (
        <Alert tone="warn">Only the household owner can change the plan.</Alert>
      ) : ctx.plan === "comp" ? null : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {(["family", "family_plus"] as const).map((plan) => (
            <Card key={plan} className={plan === "family_plus" ? "ring-2 ring-amber" : ""}>
              <h3 className="font-display text-2xl font-bold">{PLAN_NAMES[plan]}</h3>
              <p className="mt-1">
                <span className="font-display text-3xl font-bold text-maple">{money(PLAN_PRICES[plan].monthly)}</span>
                <span className="text-ink-soft"> /month + tax</span>
              </p>
              <p className="text-sm text-ink-soft">or {money(PLAN_PRICES[plan].yearly)}/year (2 months free)</p>
              <ul className="my-4 flex flex-col gap-1 text-sm">
                {FEATURES[plan].map((f) => <li key={f}>✓ {f}</li>)}
              </ul>
              {hasStripe && ctx.plan === plan ? (
                <Badge tone="good">Your plan</Badge>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(["monthly", "yearly"] as const).map((interval) => (
                    <form key={interval} action="/api/stripe/checkout" method="post">
                      <input type="hidden" name="plan" value={plan} />
                      <input type="hidden" name="interval" value={interval} />
                      <button className={buttonClass(interval === "yearly" ? "primary" : "secondary")}>
                        {hasStripe ? "Switch" : "Choose"} {interval}
                      </button>
                    </form>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-ink-soft">Limits: {PLAN_LIMITS[plan].kids} kids · {PLAN_LIMITS[plan].devices} tablets · {PLAN_LIMITS[plan].parents} parents</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
