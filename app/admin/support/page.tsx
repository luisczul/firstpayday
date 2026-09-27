import { requireParent } from "@/lib/auth/session";
import { parentT } from "@/lib/i18n/parent";
import { Card, PageHeader } from "@/components/ui";
import { SupportForm } from "./SupportForm";
import { intlLocale } from "@/lib/i18n";
import { SettingsNav } from "../settings/SettingsNav";

export async function generateMetadata() {
  const ctx = await requireParent();
  return { title: parentT(ctx.locale)("b.support.title") };
}


export default async function SupportPage() {
  const ctx = await requireParent();
  const t = parentT(ctx.locale);
  const KIND: Record<string, string> = {
    feature: t("b.support.kind.feature"),
    bug: t("b.support.kind.bug"),
    question: t("b.support.kind.question"),
    other: t("b.support.kind.other"),
  };
  const STATUS: Record<string, string> = { new: t("b.support.status.new"), read: t("b.support.status.read"), done: t("b.support.status.done") };
  const { data: mine } = await ctx.supabase
    .from("support_messages")
    .select("id, kind, message, status, created_at")
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <>
      <PageHeader title={t("b.support.title")} subtitle={t("b.support.subtitle")} />
      <SettingsNav active="/admin/support" locale={ctx.locale} />
      <Card className="mb-6">
        <SupportForm email={ctx.user.email} />
      </Card>
      {mine && mine.length > 0 ? (
        <section>
          <h2 className="mb-3 font-display text-2xl font-bold">{t("b.support.yourMessages")}</h2>
          <ul className="flex flex-col gap-2">
            {mine.map((m) => (
              <li key={m.id} className="rounded-2xl bg-card p-4 ring-1 ring-line">
                <p className="text-sm font-bold text-ink-soft">
                  {KIND[m.kind] ?? m.kind} · {new Date(m.created_at).toLocaleDateString(intlLocale(ctx.locale), { dateStyle: "medium" })} ·{" "}
                  {STATUS[m.status] ?? m.status}
                </p>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-ink">{m.message}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
