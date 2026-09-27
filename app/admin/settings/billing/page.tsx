import { requireParent } from "@/lib/auth/session";
import { parentT } from "@/lib/i18n/parent";
import { FREE_KIDS, billingEnabled, PRICE_PER_EXTRA_KID_CENTS, billableExtraKids, monthlyPriceCents } from "@/lib/billing/plans";
import { hasPaidSubscription, trialDaysLeft } from "@/lib/billing/access";
import { formatMoney } from "@/lib/money/format";
import { Alert, Badge, Card, PageHeader, buttonClass } from "@/components/ui";
import { SettingsNav } from "../SettingsNav";
import { intlLocale } from "@/lib/i18n";
import type { ParentKey } from "@/lib/i18n/parent";

export async function generateMetadata() {
  const ctx = await requireParent();
  return { title: parentT(ctx.locale)("b.billing.title") };
}

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
  const t = parentT(ctx.locale);
  const planName = { trial: t("b.billing.plan.trial"), family: t("b.billing.plan.family"), family_plus: t("b.billing.plan.family"), comp: t("b.billing.plan.comp"), free: t("b.billing.plan.free") }[ctx.plan];
  const statusKey = `b.billing.status.${sub?.status ?? ""}` as ParentKey;
  const statusLabel = sub ? (t(statusKey) === statusKey ? sub.status : t(statusKey)) : "";
  const extraKids = billableExtraKids(kids);

  if (!billingEnabled() && !paid) {
    return (
      <>
        <PageHeader title={parentT(ctx.locale)("b.common.settings")} />
        <SettingsNav active="/admin/settings/billing" locale={ctx.locale} />
        <Card>
          <h2 className="font-display text-2xl font-bold">{t("b.billing.freeTitle")}</h2>
          <p className="mt-3 text-lg">{t("b.billing.freeBody")}</p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={parentT(ctx.locale)("b.common.settings")} />
      <SettingsNav active="/admin/settings/billing" locale={ctx.locale} />

      {sp.success ? <div className="mb-4"><Alert tone="good">{t("b.billing.success")}</Alert></div> : null}
      {sp.canceled ? <div className="mb-4"><Alert tone="warn">{t("b.billing.canceled")}</Alert></div> : null}
      {ctx.access !== "full" ? (
        <div className="mb-4">
          <Alert tone="bad">{t("b.billing.readOnly", { kids })}</Alert>
        </div>
      ) : null}

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl font-bold">{paid ? t("b.billing.familySub") : planName}</h2>
          {sub ? <Badge tone={ctx.access === "full" ? "good" : "bad"}>{statusLabel}</Badge> : null}
          {sub?.cancel_at_period_end ? <Badge tone="warn">{t("b.billing.cancelsAtEnd")}</Badge> : null}
        </div>
        <p className="mt-3 text-lg">
          <b>{kids}</b> {kids === 1 ? t("b.billing.kidOne") : t("b.billing.kidMany")} · {t("b.billing.firstKidFree")} ·{" "}
          {extra > 0 ? (
            <>
              {extra} × {money(PRICE_PER_EXTRA_KID_CENTS)} = <b>{t("b.billing.perMonth", { price: money(monthlyPriceCents(kids)) })}</b> {t("b.billing.plusTax")}
            </>
          ) : (
            t("b.billing.nothingToPay")
          )}
        </p>
        {ctx.plan === "trial" && days > 0 ? (
          <p className="mt-2 text-ink-soft">{days === 1 ? t("b.billing.trialOne") : t("b.billing.trialMany", { n: days })}</p>
        ) : null}
        {ctx.plan === "comp" ? <p className="mt-2 text-ink-soft">{t("b.billing.comp")}</p> : null}
        {paid && sub?.current_period_end ? (
          <p className="mt-2 text-ink-soft">
            {t(sub.cancel_at_period_end ? "b.billing.accessUntil" : "b.billing.renews", {
              date: new Date(sub.current_period_end).toLocaleDateString(intlLocale(ctx.locale), { dateStyle: "long" }),
            })}{" "}
            {t("b.billing.prorated")}
          </p>
        ) : null}

        {!ctx.isOwner ? (
          <p className="mt-4 text-sm text-ink-soft">{t("b.billing.ownerOnly")}</p>
        ) : ctx.plan === "comp" ? null : !paid && kids <= FREE_KIDS ? (
          <p className="mt-4 rounded-xl bg-moss/10 px-4 py-3 font-semibold text-moss">
            {t("b.billing.freePlan", { price: money(PRICE_PER_EXTRA_KID_CENTS) })}
          </p>
        ) : paid ? (
          <form action="/api/stripe/portal" method="post" className="mt-5">
            <button className={buttonClass("secondary")}>{t("b.billing.manage")}</button>
          </form>
        ) : (
          <form action="/api/stripe/checkout" method="post" className="mt-5 flex flex-wrap items-center gap-3">
            <button className={buttonClass("primary", "lg")}>
              {t("b.billing.subscribe", { price: money(extraKids * PRICE_PER_EXTRA_KID_CENTS) })}
            </button>
            <span className="text-sm text-ink-soft">
              {extraKids === 1
                ? t("b.billing.extraOne", { price: money(PRICE_PER_EXTRA_KID_CENTS) })
                : t("b.billing.extraMany", { n: extraKids, price: money(PRICE_PER_EXTRA_KID_CENTS) })}
            </span>
          </form>
        )}
      </Card>

      <Card>
        <h3 className="font-display text-xl font-bold">{t("b.billing.howTitle")}</h3>
        <ul className="mt-2 flex flex-col gap-1 text-ink-soft">
          <li>{t("b.billing.how1")}</li>
          <li>{t("b.billing.how2", { price: money(PRICE_PER_EXTRA_KID_CENTS) })}</li>
          <li>{t("b.billing.how3")}</li>
          <li>{t("b.billing.how4")}</li>
        </ul>
      </Card>
    </>
  );
}
